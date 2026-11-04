// Burstpoint Persistent Video Vault
// Authoritative persistent storage and catalog for all rendered simulation videos.
// Guarantees zero repetition: indexes videos by scenario signature, seed, narrative role, and SHA-256 hash.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VideoVault {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.resolve('storage/video_vault');
    this.indexPath = path.join(this.storageDir, 'vault_index.json');
    this.lockPath = `${this.indexPath}.lock`;

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this._initializeVault();
  }

  _initializeVault() {
    if (!fs.existsSync(this.indexPath)) {
      fs.writeFileSync(this.indexPath, JSON.stringify({
        vaultVersion: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalVideos: 0,
        videos: []
      }, null, 2), 'utf8');
    }
  }

  // Generates a deterministic fingerprint for scenario parameters
  static computeScenarioSignature(config) {
    const canonical = {
      gameType: config.gameType || 'multi_race',
      seed: config.seed,
      duration: config.durationSeconds,
      lanes: config.lanes ? {
        left: {
          startBalls: config.lanes.left?.startBalls,
          stages: (config.lanes.left?.stages || []).map(s => ({ type: s.type, value: s.value, maxHP: s.maxHP }))
        },
        right: {
          startBalls: config.lanes.right?.startBalls,
          stages: (config.lanes.right?.stages || []).map(s => ({ type: s.type, value: s.value, maxHP: s.maxHP }))
        }
      } : null
    };

    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex').substring(0, 16);
  }

  // Reads the vault index atomically
  getIndex() {
    try {
      if (!fs.existsSync(this.indexPath)) this._initializeVault();
      return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    } catch (err) {
      console.error(`[VideoVault] Failed reading vault index: ${err.message}`);
      return { vaultVersion: '1.0.0', lastUpdated: new Date().toISOString(), totalVideos: 0, videos: [] };
    }
  }

  // Checks if a video with the same scenario signature or SHA-256 already exists
  hasVideo(query = {}) {
    const index = this.getIndex();
    return index.videos.some(v => {
      if (query.sha256 && v.sha256 === query.sha256) return true;
      if (query.scenarioSignature && v.scenarioSignature === query.scenarioSignature) return true;
      if (query.clipId && v.clipId === query.clipId) return true;
      if (query.seed !== undefined && query.gameType && v.seed === query.seed && v.gameType === query.gameType) return true;
      return false;
    });
  }

  // Finds an existing video record
  findVideo(query = {}) {
    const index = this.getIndex();
    return index.videos.find(v => {
      if (query.sha256 && v.sha256 === query.sha256) return true;
      if (query.scenarioSignature && v.scenarioSignature === query.scenarioSignature) return true;
      if (query.clipId && v.clipId === query.clipId) return true;
      if (query.seed !== undefined && query.gameType && v.seed === query.seed && v.gameType === query.gameType) return true;
      return false;
    }) || null;
  }

  // Evaluates whether a new candidate video is unique or a repetition
  checkUniqueness(candidate) {
    const signature = VideoVault.computeScenarioSignature(candidate.config || candidate);
    const existingBySig = this.findVideo({ scenarioSignature: signature });
    if (existingBySig) {
      return {
        isUnique: false,
        reason: `DUPLICATE_SCENARIO_SIGNATURE (matches existing clip "${existingBySig.clipId}" with seed ${existingBySig.seed})`,
        existing: existingBySig
      };
    }

    if (candidate.sha256) {
      const existingByHash = this.findVideo({ sha256: candidate.sha256 });
      if (existingByHash) {
        return {
          isUnique: false,
          reason: `DUPLICATE_MEDIA_HASH (SHA-256 already stored in clip "${existingByHash.clipId}")`,
          existing: existingByHash
        };
      }
    }

    return { isUnique: true, reason: null, existing: null };
  }

  // Archives a validated video artifact into persistent storage
  archiveVideo(videoData) {
    const signature = videoData.scenarioSignature || VideoVault.computeScenarioSignature(videoData.config || videoData);
    const index = this.getIndex();

    const record = {
      clipId: videoData.clipId,
      gameType: videoData.gameType || videoData.config?.gameType || 'multi_race',
      seed: videoData.seed || videoData.config?.seed,
      scenarioSignature: signature,
      title: videoData.title || videoData.candidate?.title,
      hookText: videoData.hookText || videoData.candidate?.hookText,
      narrativeRole: videoData.narrativeRole || videoData.candidate?.simOutcome?.narrativeRole,
      videoPath: videoData.videoPath,
      sha256: videoData.sha256,
      durationSeconds: videoData.durationSeconds,
      exactFrameCount: videoData.exactFrameCount,
      fileSizeMb: videoData.fileSizeMb,
      fileSizeBytes: videoData.fileSizeBytes,
      resolution: videoData.resolution,
      fps: videoData.fps,
      videoCodec: videoData.videoCodec || 'h264',
      audioCodec: videoData.audioCodec || 'aac',
      audioRate: videoData.audioRate || 44100,
      audioChannels: videoData.audioChannels || 'stereo',
      loudnessLufs: videoData.loudnessLufs,
      simOutcome: videoData.simOutcome || videoData.candidate?.simOutcome,
      archivedAt: new Date().toISOString(),
      tags: videoData.tags || videoData.candidate?.config?.tags || []
    };

    // Upsert into catalog
    const existingIdx = index.videos.findIndex(v => v.clipId === record.clipId || v.sha256 === record.sha256);
    if (existingIdx >= 0) {
      index.videos[existingIdx] = { ...index.videos[existingIdx], ...record, updatedAt: new Date().toISOString() };
    } else {
      index.videos.push(record);
    }

    index.totalVideos = index.videos.length;
    index.lastUpdated = new Date().toISOString();

    const tmpPath = `${this.indexPath}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.indexPath);

    return record;
  }

  // Automatically populates vault from the latest production proof report
  syncFromProductionReport(reportPath = path.resolve('output/production_proof_report.json')) {
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Production report not found at: ${reportPath}`);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const synced = [];

    for (const clip of report.renderedClips || []) {
      const sim = (report.simulations || []).find(s => clip.clipId.startsWith(s.simId));
      const archived = this.archiveVideo({
        ...clip,
        simOutcome: sim,
        gameType: report.gameCertified || 'multi_race',
        seed: sim?.seed,
        title: sim?.title,
        narrativeRole: sim?.narrativeRole
      });
      synced.push(archived);
    }

    return {
      syncedCount: synced.length,
      totalInVault: this.getIndex().totalVideos,
      records: synced
    };
  }

  // Returns vault metrics and summary
  getStats() {
    const index = this.getIndex();
    const games = new Set(index.videos.map(v => v.gameType));
    const totalFrames = index.videos.reduce((sum, v) => sum + (v.exactFrameCount || 0), 0);
    const totalMb = index.videos.reduce((sum, v) => sum + (v.fileSizeMb || 0), 0);

    return {
      totalVideos: index.totalVideos,
      distinctGames: Array.from(games),
      totalFramesRendered: totalFrames,
      totalStorageMb: Number(totalMb.toFixed(2)),
      lastUpdated: index.lastUpdated,
      videosSummary: index.videos.map(v => ({
        clipId: v.clipId,
        gameType: v.gameType,
        seed: v.seed,
        durationSeconds: v.durationSeconds,
        title: v.title,
        winner: v.simOutcome?.winner,
        sha256: v.sha256?.substring(0, 16) + '...'
      }))
    };
  }
}

module.exports = { VideoVault };
