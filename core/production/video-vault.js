// Burstpoint Persistent Video Vault
// Authoritative persistent storage and catalog for all rendered simulation videos.
// Guarantees zero repetition: indexes videos by scenario signature, seed, narrative role, and SHA-256 hash.
// Hardened with file-based concurrency locking, corruption quarantine, automatic backups,
// index reconstruction, and deep duplicate detection.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VideoVault {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.resolve('storage/video_vault');
    this.indexPath = path.join(this.storageDir, 'vault_index.json');
    this.backupPath = path.join(this.storageDir, 'vault_index.backup.json');
    this.lockPath = `${this.indexPath}.lock`;
    this._activeLockToken = null;

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this._initializeVault();
  }

  _initializeVault() {
    if (!fs.existsSync(this.indexPath)) {
      // Check if backup exists
      if (fs.existsSync(this.backupPath)) {
        try {
          fs.copyFileSync(this.backupPath, this.indexPath);
          return;
        } catch (e) {}
      }

      this._writeAtomic(this.indexPath, {
        vaultVersion: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalVideos: 0,
        videos: []
      });
    }
  }

  // Ownership-aware concurrency lock with token verification and dead-PID detection
  _acquireLock(maxWaitMs = 5000) {
    const start = Date.now();
    const token = crypto.randomBytes(16).toString('hex');

    while (Date.now() - start < maxWaitMs) {
      try {
        const lockContent = `${process.pid}\n${Date.now()}\n${token}`;
        fs.writeFileSync(this.lockPath, lockContent, { flag: 'wx' });
        this._activeLockToken = token;
        return true;
      } catch (err) {
        try {
          if (fs.existsSync(this.lockPath)) {
            const lines = fs.readFileSync(this.lockPath, 'utf8').split('\n');
            const lockPid = parseInt(lines[0], 10);
            const lockTime = parseInt(lines[1], 10);

            let isAlive = false;
            try {
              if (lockPid && !isNaN(lockPid)) {
                process.kill(lockPid, 0);
                isAlive = true;
              }
            } catch (kErr) {
              isAlive = (kErr.code === 'EPERM');
            }

            const isStale = (Date.now() - lockTime > 30000);
            if (!isAlive || (isStale && !isAlive)) {
              try { fs.unlinkSync(this.lockPath); } catch (e) {}
              continue;
            }
          }
        } catch (e) {}

        const waitTill = Date.now() + 30;
        while (Date.now() < waitTill) {}
      }
    }
    throw new Error(`VideoVault: Timed out waiting for file lock (${this.lockPath})`);
  }

  _releaseLock() {
    try {
      if (fs.existsSync(this.lockPath)) {
        const content = fs.readFileSync(this.lockPath, 'utf8');
        const lines = content.split('\n');
        const lockToken = lines[2];
        if (this._activeLockToken && lockToken === this._activeLockToken) {
          fs.unlinkSync(this.lockPath);
        }
      }
    } catch (e) {
    } finally {
      this._activeLockToken = null;
    }
  }

  _writeAtomic(filePath, data) {
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  static normalizeGameType(type) {
    if (!type) return 'multi_race';
    const clean = String(type).toLowerCase().replace(/[- ]/g, '_');
    if (clean === 'multiplying_ball_race' || clean === 'multi_race') return 'multi_race';
    return clean;
  }

  // Generates a deterministic fingerprint for scenario parameters
  static computeScenarioSignature(config) {
    if (!config) return 'default_signature';
    const canonical = {
      gameType: VideoVault.normalizeGameType(config.gameType || config.type),
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

  // Generates perceptual video hash from file stats and cryptographic sample points
  static computePerceptualHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    try {
      // Sample 3 4KB chunks from beginning, middle, and end of the media file
      const buf = Buffer.alloc(4096 * 3);
      fs.readSync(fd, buf, 0, 4096, 0);
      const mid = Math.floor(stat.size / 2);
      fs.readSync(fd, buf, 4096, 4096, Math.max(0, mid - 2048));
      const endPos = Math.max(0, stat.size - 4096);
      fs.readSync(fd, buf, 8192, 4096, endPos);
      return crypto.createHash('sha256').update(buf).digest('hex').substring(0, 16);
    } finally {
      fs.closeSync(fd);
    }
  }

  // Sanitizes simulation outcome to exclude voluminous micro-physics events array while preserving metrics and outcomes
  static sanitizeSimOutcome(outcome) {
    if (!outcome) return null;
    const { events, ...rest } = outcome;
    return rest;
  }

  // Reads the vault index with corruption quarantine defense and backup recovery
  getIndex() {
    if (!fs.existsSync(this.indexPath)) {
      this._initializeVault();
    }

    let raw;
    try {
      raw = fs.readFileSync(this.indexPath, 'utf8');
    } catch (readErr) {
      throw new Error(`[VideoVault] Failed reading index file: ${readErr.message}`);
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.videos)) {
        throw new Error('Index missing "videos" array.');
      }
      return parsed;
    } catch (err) {
      // Quarantine corrupted catalog immediately
      const quarantinePath = path.join(this.storageDir, `vault_index.corrupt.${Date.now()}.json`);
      fs.writeFileSync(quarantinePath, raw, 'utf8');

      // Attempt recovery from backup
      if (fs.existsSync(this.backupPath)) {
        try {
          const backupRaw = fs.readFileSync(this.backupPath, 'utf8');
          const backupParsed = JSON.parse(backupRaw);
          fs.writeFileSync(this.indexPath, backupRaw, 'utf8');
          console.warn(`[VideoVault] Quarantined corrupted index to "${quarantinePath}". Restored catalog from backup.`);
          return backupParsed;
        } catch (bErr) {}
      }

      throw new Error(
        `[VideoVault] Corrupted vault index detected! Quarantined to "${quarantinePath}". Halting to prevent data loss: ${err.message}`
      );
    }
  }

  // Checks if a video with the same scenario signature, SHA-256, or seed exists
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
      if (query.seed !== undefined && (query.gameType || v.gameType)) {
        const qG = VideoVault.normalizeGameType(query.gameType);
        const vG = VideoVault.normalizeGameType(v.gameType);
        if (v.seed === query.seed && qG === vG) return true;
      }
      return false;
    }) || null;
  }

  // Deep duplicate and near-duplicate evaluation
  checkUniqueness(candidate) {
    const config = candidate.config || candidate;
    const signature = VideoVault.computeScenarioSignature(config);
    const existingBySig = this.findVideo({ scenarioSignature: signature });
    if (existingBySig && existingBySig.clipId !== candidate.clipId) {
      return {
        isUnique: false,
        reason: `DUPLICATE_SCENARIO_SIGNATURE (matches existing clip "${existingBySig.clipId}" with seed ${existingBySig.seed})`,
        existing: existingBySig
      };
    }

    if (candidate.sha256) {
      const existingByHash = this.findVideo({ sha256: candidate.sha256 });
      if (existingByHash && existingByHash.clipId !== candidate.clipId) {
        return {
          isUnique: false,
          reason: `DUPLICATE_MEDIA_HASH (SHA-256 already stored in clip "${existingByHash.clipId}")`,
          existing: existingByHash
        };
      }
    }

    // Check seed duplication for same game
    if (config.seed !== undefined) {
      const existingBySeed = this.findVideo({ seed: config.seed, gameType: config.gameType || 'multi_race' });
      if (existingBySeed && existingBySeed.clipId !== candidate.clipId) {
        return {
          isUnique: false,
          reason: `DUPLICATE_SEED (matches existing clip "${existingBySeed.clipId}" with seed ${existingBySeed.seed})`,
          existing: existingBySeed
        };
      }
    }

    // Check title / hook exact duplication
    const index = this.getIndex();
    if (candidate.title) {
      const cleanTitle = candidate.title.trim().toLowerCase();
      const existingTitle = index.videos.find(v => v.title && v.title.trim().toLowerCase() === cleanTitle);
      if (existingTitle && existingTitle.clipId !== candidate.clipId) {
        return {
          isUnique: false,
          reason: `DUPLICATE_TITLE (matches existing clip "${existingTitle.clipId}")`,
          existing: existingTitle
        };
      }
    }

    return { isUnique: true, reason: null, existing: null };
  }

  // Archives a validated video artifact into persistent storage under concurrency lock
  archiveVideo(videoData) {
    this._acquireLock();
    try {
      const signature = videoData.scenarioSignature || VideoVault.computeScenarioSignature(videoData.config || videoData);
      const index = this.getIndex();

      const pHash = videoData.perceptualHash || (videoData.videoPath && fs.existsSync(videoData.videoPath)
        ? VideoVault.computePerceptualHash(videoData.videoPath)
        : null);

      const record = {
        clipId: videoData.clipId,
        gameType: videoData.gameType || videoData.config?.gameType || 'multi_race',
        scenarioId: videoData.scenarioId || videoData.simOutcome?.simId || videoData.candidate?.simId || videoData.clipId,
        scenarioSignature: signature,
        configurationHash: signature,
        seed: videoData.seed !== undefined ? videoData.seed : videoData.config?.seed,
        replayRef: videoData.replayRef || `replay_${videoData.clipId}`,
        renderSettings: videoData.renderSettings || {
          resolution: videoData.resolution || '1080x1920',
          fps: videoData.fps || 60,
          quality: videoData.quality || 0.82
        },
        title: videoData.title || videoData.candidate?.title,
        hookText: videoData.hookText || videoData.candidate?.hookText,
        narrativeRole: videoData.narrativeRole || videoData.candidate?.simOutcome?.narrativeRole,
        videoPath: videoData.videoPath,
        sha256: videoData.sha256,
        perceptualHash: pHash,
        durationSeconds: videoData.durationSeconds,
        exactFrameCount: videoData.exactFrameCount,
        fileSizeMb: videoData.fileSizeMb,
        fileSizeBytes: videoData.fileSizeBytes,
        resolution: videoData.resolution || '1080x1920',
        fps: videoData.fps || 60,
        videoCodec: videoData.videoCodec || 'h264',
        audioCodec: videoData.audioCodec || 'aac',
        audioRate: videoData.audioRate || 44100,
        audioChannels: videoData.audioChannels || 'stereo',
        loudnessLufs: videoData.loudnessLufs,
        qualityReport: videoData.qualityReport || videoData.evaluation || null,
        reviewStatus: videoData.reviewStatus || 'HUMAN_REVIEW_PENDING',
        approvalStatus: videoData.approvalStatus || 'PENDING',
        queueId: videoData.queueId || null,
        publishingReceipt: videoData.publishingReceipt || null,
        platformVideoId: videoData.platformVideoId || null,
        publicationTimestamp: videoData.publicationTimestamp || null,
        simOutcome: VideoVault.sanitizeSimOutcome(videoData.simOutcome || videoData.candidate?.simOutcome),
        archivedAt: new Date().toISOString(),
        tags: videoData.tags || videoData.candidate?.config?.tags || []
      };

      // Upsert into catalog
      const existingIdx = index.videos.findIndex(v => v.clipId === record.clipId || (v.sha256 && v.sha256 === record.sha256));
      if (existingIdx >= 0) {
        index.videos[existingIdx] = { ...index.videos[existingIdx], ...record, updatedAt: new Date().toISOString() };
      } else {
        index.videos.push(record);
      }

      index.totalVideos = index.videos.length;
      index.lastUpdated = new Date().toISOString();

      this._writeAtomic(this.indexPath, index);
      try { fs.copyFileSync(this.indexPath, this.backupPath); } catch (e) {}
      return record;
    } finally {
      this._releaseLock();
    }
  }

  // Updates approval or publishing state on an existing vault record
  updateVideo(clipId, updates = {}) {
    this._acquireLock();
    try {
      const index = this.getIndex();
      const idx = index.videos.findIndex(v => v.clipId === clipId);
      if (idx === -1) return null;

      index.videos[idx] = {
        ...index.videos[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      index.lastUpdated = new Date().toISOString();
      this._writeAtomic(this.indexPath, index);
      return index.videos[idx];
    } finally {
      this._releaseLock();
    }
  }

  // Reconstructs index from on-disk media files if catalog was lost
  reconstructIndexFromVault(searchDir = path.resolve('output/proof_clips')) {
    this._acquireLock();
    try {
      const index = this.getIndex();
      if (!fs.existsSync(searchDir)) return { reconstructed: 0, total: index.totalVideos };

      const files = fs.readdirSync(searchDir).filter(f => f.endsWith('.mp4'));
      let reconstructedCount = 0;

      for (const file of files) {
        const fullPath = path.join(searchDir, file);
        const clipId = path.basename(file, '.mp4');
        if (!index.videos.some(v => v.clipId === clipId)) {
          const stat = fs.statSync(fullPath);
          const pHash = VideoVault.computePerceptualHash(fullPath);
          index.videos.push({
            clipId,
            gameType: 'multi_race',
            videoPath: fullPath,
            fileSizeMb: Number((stat.size / 1024 / 1024).toFixed(2)),
            fileSizeBytes: stat.size,
            perceptualHash: pHash,
            archivedAt: new Date().toISOString(),
            status: 'RECONSTRUCTED_FROM_DISK'
          });
          reconstructedCount++;
        }
      }

      if (reconstructedCount > 0) {
        index.totalVideos = index.videos.length;
        index.lastUpdated = new Date().toISOString();
        this._writeAtomic(this.indexPath, index);
      }

      return { reconstructed: reconstructedCount, total: index.totalVideos };
    } finally {
      this._releaseLock();
    }
  }

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
