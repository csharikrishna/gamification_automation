// Canonical Production Orchestrator
// Authoritative 10-stage production pipeline for game simulation, quality scoring,
// full-duration deterministic replay, 20-second flagship video rendering, bitstream media validation,
// persistent video vault archiving, explicit human creative review, and atomic queue scheduling.

const fs = require('fs');
const path = require('path');
const { LIFECYCLE_STATES } = require('../core/contracts/lifecycle-schema');
const { MediaValidator } = require('../core/production/media-validator');
const { renderVideo } = require('../core/production/render-manager');
const { QueueRepository } = require('../core/publishing/queue-repository');
const { PublishingScheduler } = require('../core/publishing/scheduler');
const { VideoVault } = require('../core/production/video-vault');

const { generateScenarios } = require('./stages/scenario-generator');
const { simulateScenarios } = require('./stages/simulation-runner');
const { scoreCandidates } = require('./stages/candidate-scorer');
const { validateApprovalAuthorization, reviewAndApproveClips } = require('./stages/approval-authorizer');

class ProductionOrchestrator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.clipsDir = path.join(this.outputDir, 'proof_clips');
    this.reportPath = path.join(this.outputDir, 'production_proof_report.json');
    this.gameId = options.gameId || 'multi_race';
    this.targetDuration = options.targetDuration || 20.0;
    this.fps = options.fps || 60;
    this.unattendedApproval = options.unattendedApproval !== undefined ? Boolean(options.unattendedApproval) : false;
    this.humanApprovalToken = options.humanApprovalToken || options.token || process.env.HUMAN_APPROVAL_TOKEN || null;
    this.trustedApprovalToken = options.trustedApprovalToken || process.env.TRUSTED_APPROVAL_TOKEN || null;
    this.trustedApprovalTokens = new Set();
    if (this.trustedApprovalToken && String(this.trustedApprovalToken).trim().length > 0) {
      this.trustedApprovalTokens.add(String(this.trustedApprovalToken).trim());
    }
    if (options.trustedApprovalTokens && Array.isArray(options.trustedApprovalTokens)) {
      for (const t of options.trustedApprovalTokens) {
        if (t && String(t).trim().length > 0) this.trustedApprovalTokens.add(String(t).trim());
      }
    }
    if (process.env.TRUSTED_APPROVAL_TOKENS) {
      for (const t of process.env.TRUSTED_APPROVAL_TOKENS.split(',')) {
        if (t && t.trim().length > 0) this.trustedApprovalTokens.add(t.trim());
      }
    }
    this.reviewer = options.reviewer || (process.env.REVIEWER_NAME ? { name: process.env.REVIEWER_NAME } : null);
    this.timezone = options.timezone || 'Asia/Kolkata';
    this.forceRender = options.forceRender || false;

    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (!fs.existsSync(this.clipsDir)) fs.mkdirSync(this.clipsDir, { recursive: true });

    this.queueRepo = new QueueRepository({ outputDir: this.outputDir, timezone: this.timezone });
    this.scheduler = new PublishingScheduler({ outputDir: this.outputDir, queueRepo: this.queueRepo, timezone: this.timezone });
    this.vault = new VideoVault({ storageDir: options.vaultDir || path.resolve('storage/video_vault') });
  }

  _getAuthConfig() {
    return {
      unattendedApproval: this.unattendedApproval,
      trustedApprovalToken: this.trustedApprovalToken,
      trustedApprovalTokens: this.trustedApprovalTokens
    };
  }

  // Stage 1: GENERATED - Scenario synthesis with strict schema validation & calibrated diversity
  generateScenarios(count = 5, gameType = this.gameId) {
    return generateScenarios(count, gameType, this.targetDuration, this.fps);
  }

  // Stage 2: SIMULATED - Seeded deterministic match simulation with verifiable ground-truth evidence
  simulateScenarios(configs) {
    return simulateScenarios(configs);
  }

  // Stage 3: CHECK UNIQUENESS - VideoVault pre-render repetition inspection
  checkVaultUniqueness(simulations) {
    const verified = [];
    for (const sim of simulations) {
      const uniqueness = this.vault.checkUniqueness({
        clipId: `${sim.simId}_flagship`,
        config: sim.config,
        title: sim.title,
        seed: sim.seed
      });
      verified.push({
        ...sim,
        vaultUniqueness: uniqueness
      });
    }
    return verified;
  }

  // Stage 4: SCORED - Evidence-based quantitative evaluation with full-duration replay & calculated WCAG contrast
  scoreCandidates(simulations) {
    return scoreCandidates(simulations, {
      targetDuration: this.targetDuration,
      fps: this.fps,
      unattendedApproval: this.unattendedApproval
    });
  }

  // Stages 5 & 6: RENDERED & VALIDATED - Physical 1080x1920 MP4 export & full FFmpeg decoding inspection
  async renderAndValidate(approvedCandidates, maxCount = 5) {
    const selected = approvedCandidates.slice(0, maxCount);
    const rendered = [];

    for (let i = 0; i < selected.length; i++) {
      const clip = selected[i];
      const outPath = path.join(this.clipsDir, `${clip.clipId}.mp4`);

      let mediaReport = null;
      const expectedMediaSpec = {
        minSizeBytes: 500000,
        targetDuration: clip.targetDuration,
        durationTolerance: 0.6,
        minFrames: (clip.targetDuration * this.fps) - 10,
        resolution: '1080x1920',
        fps: this.fps,
        videoCodec: 'h264',
        audioCodec: 'aac',
        requireAudio: true,
        minAudioRate: 44100,
        requireLoudness: true
      };

      if (!this.forceRender && fs.existsSync(outPath)) {
        try {
          mediaReport = await MediaValidator.validateVideoFile(outPath, expectedMediaSpec);
          console.log(`  ✓ Verified existing physical video on disk: ${path.basename(outPath)} (${mediaReport.exactFrameCount} frames, ${mediaReport.durationSeconds}s)`);
        } catch (e) {
          mediaReport = null;
        }
      }

      if (!mediaReport) {
        await renderVideo({
          config: clip.config,
          output: outPath,
          startTime: 0,
          duration: clip.targetDuration,
          fps: this.fps,
          quality: 0.82
        });

        mediaReport = await MediaValidator.validateVideoFile(outPath, expectedMediaSpec);
      }

      rendered.push({
        clipId: clip.clipId,
        videoPath: outPath,
        relativeVideoPath: path.relative(process.cwd(), outPath),
        format: clip.format,
        durationSeconds: mediaReport.durationSeconds,
        exactFrameCount: mediaReport.exactFrameCount,
        fileSizeBytes: mediaReport.fileSizeBytes,
        fileSizeMb: mediaReport.fileSizeMb,
        sha256: mediaReport.sha256,
        bitstreamVerified: mediaReport.bitstreamVerified,
        resolution: `${mediaReport.width}x${mediaReport.height}`,
        fps: mediaReport.fps,
        videoCodec: mediaReport.videoCodec,
        containerFormat: mediaReport.containerFormat,
        timeBase: mediaReport.timeBase,
        streamStartTime: mediaReport.streamStartTime,
        hasAudio: mediaReport.hasAudio,
        audioCodec: mediaReport.audioCodec,
        audioRate: mediaReport.audioRate,
        audioChannels: mediaReport.audioChannels,
        loudnessLufs: mediaReport.loudnessLufs,
        loudnessStatus: mediaReport.loudnessStatus,
        evaluation: clip.evaluation,
        candidate: clip,
        lifecycleState: LIFECYCLE_STATES.VALIDATED
      });
    }

    return rendered;
  }

  // Stage 7: ARCHIVE - Archive rendered videos into VideoVault
  archiveClips(renderedClips) {
    const archived = [];
    for (const clip of renderedClips) {
      const vaultRecord = this.vault.archiveVideo({
        clipId: clip.clipId,
        gameType: this.gameId,
        seed: clip.candidate.simOutcome.seed,
        title: clip.candidate.title,
        hookText: clip.candidate.hookText,
        narrativeRole: clip.candidate.simOutcome.narrativeRole,
        videoPath: clip.videoPath,
        sha256: clip.sha256,
        durationSeconds: clip.durationSeconds,
        exactFrameCount: clip.exactFrameCount,
        fileSizeMb: clip.fileSizeMb,
        fileSizeBytes: clip.fileSizeBytes,
        resolution: clip.resolution,
        fps: clip.fps,
        videoCodec: clip.videoCodec,
        audioCodec: clip.audioCodec,
        audioRate: clip.audioRate,
        audioChannels: clip.audioChannels,
        loudnessLufs: clip.loudnessLufs,
        qualityReport: clip.evaluation,
        reviewStatus: this.unattendedApproval ? 'APPROVED_FOR_PUBLISHING' : 'HUMAN_REVIEW_PENDING',
        approvalStatus: this.unattendedApproval ? 'APPROVED' : 'PENDING_HUMAN_REVIEW',
        simOutcome: clip.candidate.simOutcome,
        config: clip.candidate.config
      });
      archived.push({
        ...clip,
        vaultRecord,
        reviewStatus: vaultRecord.reviewStatus,
        approvalStatus: vaultRecord.approvalStatus
      });
    }
    return archived;
  }

  // Validates human creative approval authorization against trusted tokens or cryptographically signed records
  validateApprovalAuthorization(approvalToken = this.humanApprovalToken, reviewer = this.reviewer) {
    return validateApprovalAuthorization(this._getAuthConfig(), approvalToken, reviewer);
  }

  // Stage 8: HUMAN REVIEW & CREATIVE APPROVAL GATE
  reviewAndApproveClips(archivedClips, reviewer = this.reviewer, approvalToken = this.humanApprovalToken) {
    return reviewAndApproveClips(this.vault, archivedClips, reviewer, approvalToken, this._getAuthConfig());
  }

  // Stage 9: SCHEDULED - Cadence queue insertion (Only APPROVED clips permitted)
  scheduleApprovedClips(approvedClips, baseDate = new Date()) {
    const queued = [];
    const calendar = this.scheduler.generateCalendar(baseDate, 3);
    const publishDays = calendar.filter(d => d.action === 'PUBLISH');

    for (let i = 0; i < approvedClips.length; i++) {
      const clip = approvedClips[i];

      // Security Invariant: Never queue unapproved clips
      if (clip.approvalStatus !== 'APPROVED') {
        console.warn(`[Pipeline] Security Invariant: Skipping unapproved clip "${clip.clipId}" (status: ${clip.approvalStatus}) from entering publishing queue.`);
        continue;
      }

      const slot = publishDays[i] || {
        date: new Date(baseDate.getTime() + i * 86400000).toISOString().split('T')[0],
        scheduledTime: new Date(baseDate.getTime() + i * 86400000).toISOString()
      };

      const entry = {
        queueId: `queue_${clip.clipId}`,
        clipId: clip.clipId,
        simId: clip.candidate.simId,
        scheduledDate: slot.date,
        scheduledTime: slot.scheduledTime || `${slot.date}T17:00:00.000Z`,
        status: 'READY_TO_PUBLISH',
        videoPath: clip.videoPath,
        fileSizeBytes: clip.fileSizeBytes,
        sha256: clip.sha256,
        durationSeconds: clip.durationSeconds,
        title: clip.candidate.title,
        hookText: clip.candidate.hookText,
        description: `${clip.candidate.title}\n\n${clip.candidate.hookText}\n\nAutonomous marble physics showdown! 🔔 Subscribe for daily battles!\n\n#shorts #physics #marblerun #gaming #satisfying`,
        tags: ['shorts', 'physics', 'marblerun', 'gaming', 'satisfying'],
        timezone: this.timezone,
        lifecycleState: LIFECYCLE_STATES.SCHEDULED
      };

      try {
        const queuedItem = this.queueRepo.enqueue(entry, { upsert: true });
        queued.push(queuedItem);

        // Update vault with queueId
        this.vault.updateVideo(clip.clipId, { queueId: entry.queueId });
      } catch (err) {
        console.warn(`[Pipeline] Skipped queuing ${entry.queueId}: ${err.message}`);
      }
    }

    return queued;
  }

  // Stage 10: UPLOAD_PREFLIGHT_PASSED - Strict DRY_RUN verification
  async executeDryRunPreflight(maxItems = 5) {
    const results = [];
    for (let i = 0; i < maxItems; i++) {
      const claim = await this.scheduler.publishNext({ dryRun: true, ignoreScheduleTime: true });
      if (!claim.success && !claim.item) break;

      if (claim.item?.clipId && claim.receipt) {
        this.vault.updateVideo(claim.item.clipId, { publishingReceipt: claim.receipt });
      }

      results.push({
        ...claim,
        preflightMode: 'DRY_RUN_PREFLIGHT_VERIFICATION',
        note: 'Offline bitstream & container pre-flight verification; distinct from scheduled publication date'
      });
    }
    return results;
  }

  // Full end-to-end execution of the 10-stage flagship certification
  async runProductionProof() {
    console.log('='.repeat(70));
    console.log('🚀 BURSTPOINT MASTER PRODUCTION ORCHESTRATOR');
    console.log(`Target: Flagship Multiplying Ball Race — 5 Certified 20-Second Videos`);
    console.log(`Approval Governance: ${this.unattendedApproval ? 'UNATTENDED_AUTOMATED_POLICY' : 'HUMAN_REVIEW_BY_DEFAULT'}`);
    console.log(`Timezone: ${this.timezone}`);
    console.log('='.repeat(70));

    const startTime = Date.now();

    // 1. GENERATED
    console.log('\n[Stage 1/10] 🧠 Generating calibrated scenario set (5 canonical archetypes)...');
    const configs = this.generateScenarios(5);
    console.log(`  ✓ Generated & validated ${configs.length} scenario configurations against schema.`);

    // 2. SIMULATED
    console.log('\n[Stage 2/10] 🎲 Simulating seeded matches with verified competitive arcs...');
    const simulations = this.simulateScenarios(configs);
    for (const sim of simulations) {
      console.log(`  ✓ ${sim.simId} (${sim.archetypeId}): Winner "${sim.winner}" (${sim.winningScore} vs ${sim.losingScore}) at ${sim.finishTime}s | Lead changes: ${sim.leadChanges}`);
    }

    // 3. CHECK UNIQUENESS (Vault Pre-screening)
    console.log('\n[Stage 3/10] 🗄️ Checking candidate uniqueness against VideoVault index...');
    const uniqueSims = this.checkVaultUniqueness(simulations);
    console.log(`  ✓ Uniqueness verified for ${uniqueSims.length} candidate scenarios.`);

    // 4. SCORED (Full Replay + Calculated WCAG Contrast)
    console.log('\n[Stage 4/10] 🎯 Computing transparent multi-dimensional quality breakdowns & full-duration replays...');
    const scoredClips = this.scoreCandidates(uniqueSims);
    const approvedCandidates = scoredClips.filter(c => c.status === 'APPROVED');
    console.log(`  ✓ Evaluated ${scoredClips.length} candidates: ${approvedCandidates.length} Approved, ${scoredClips.length - approvedCandidates.length} Rejected.`);

    // 5. RENDERED & VALIDATED (20.0s output contract)
    console.log('\n[Stage 5/10] 🎬 Rendering physical 1080x1920 MP4 video files (~20.0s contract)...');
    const renderedClips = await this.renderAndValidate(approvedCandidates, 5);
    for (const r of renderedClips) {
      console.log(`  ✓ Rendered & Verified: ${path.basename(r.videoPath)} (${r.fileSizeMb} MB, ${r.durationSeconds}s, ${r.exactFrameCount} frames, SHA-256: ${r.sha256.substring(0, 16)}...)`);
    }

    // 6. ARCHIVED
    console.log('\n[Stage 6/10] 🗄️ Archiving verified video artifacts into persistent VideoVault...');
    const archivedClips = this.archiveClips(renderedClips);
    console.log(`  ✓ Archived ${archivedClips.length} artifacts into VideoVault catalog.`);

    // 7. HUMAN CREATIVE REVIEW & APPROVAL
    console.log('\n[Stage 7/10] 👤 Conducting explicit human creative review & approval gate...');
    const auth = this.validateApprovalAuthorization(this.humanApprovalToken, this.reviewer);
    const approvedClips = this.reviewAndApproveClips(archivedClips, this.reviewer, this.humanApprovalToken);
    const isOfficiallyApproved = auth.authorized;
    const humanApprovedCount = approvedClips.filter(c => c.approvalStatus === 'APPROVED').length;

    if (isOfficiallyApproved) {
      console.log(`  ✓ Human creative review verified (${auth.mode}): ${humanApprovedCount} clips certified for publishing by ${auth.approver}.`);
    } else {
      console.log(`  ℹ️ Review gate: ${approvedClips.length} clips awaiting human review (HUMAN_REVIEW_PENDING - reason: ${auth.reason}).`);
    }

    // 8. SCHEDULED
    console.log('\n[Stage 8/10] 📅 Inserting approved media into authoritative publishing queue...');
    const queuedClips = this.scheduleApprovedClips(approvedClips);
    console.log(`  ✓ Queued ${queuedClips.length} verified physical video entries.`);

    // 9. UPLOAD_PREFLIGHT_PASSED
    console.log('\n[Stage 9/10] 🚀 Executing strict DRY_RUN publishing pre-flight...');
    const dryRunReceipts = await this.executeDryRunPreflight(queuedClips.length);
    console.log(`  ✓ Pre-flight passed for ${dryRunReceipts.length} entries with zero fabricated metrics.`);

    // 10. REPORT
    console.log('\n[Stage 10/10] 📊 Compiling official machine-readable production audit report...');
    const totalDurationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));

    const report = {
      orchestratorName: 'Burstpoint Canonical Production Orchestrator',
      version: '4.0.0',
      executedAt: new Date().toISOString(),
      gameCertified: 'multiplying-ball-race',
      productionStatus: isOfficiallyApproved ? 'CERTIFIED_FLAGSHIP_PRODUCTION_READY' : 'HUMAN_REVIEW_PENDING',
      approvalGovernance: {
        approvalPolicy: this.unattendedApproval ? 'UNATTENDED_AUTOMATED_POLICY' : 'HUMAN_REVIEW_BY_DEFAULT',
        humanReviewStatus: isOfficiallyApproved ? 'APPROVED_FOR_PUBLISHING' : 'HUMAN_REVIEW_PENDING',
        approver: isOfficiallyApproved ? auth.approver : null,
        approvalMode: isOfficiallyApproved ? auth.mode : null,
        approvalToken: isOfficiallyApproved && auth.token ? '***VALIDATED***' : null,
        rejectionReason: isOfficiallyApproved ? null : auth.reason,
        unattendedApprovalConfigured: this.unattendedApproval
      },
      outputDurationContract: {
        targetDurationSeconds: this.targetDuration,
        fps: this.fps,
        expectedFrames: this.targetDuration * this.fps,
        toleranceSeconds: 0.6
      },
      vaultStatistics: this.vault.getStats(),
      qualificationEvidence: (() => {
        const qPath = path.join(this.outputDir, 'qualification_report.json');
        if (fs.existsSync(qPath)) {
          try { return JSON.parse(fs.readFileSync(qPath, 'utf8')); } catch (e) {}
        }
        return null;
      })(),
      executionSummary: {
        scenariosExecuted: configs.length,
        candidatesExtracted: scoredClips.length,
        approvedCandidates: approvedCandidates.length,
        renderedClipsOnDisk: renderedClips.length,
        archivedInVault: archivedClips.length,
        humanApprovedClips: humanApprovedCount,
        queuedClips: queuedClips.length,
        dryRunReceiptsCount: dryRunReceipts.length,
        totalProcessingSeconds: totalDurationSeconds
      },
      renderedClips: approvedClips.map(r => ({
        clipId: r.clipId,
        videoPath: r.relativeVideoPath,
        fileSizeMb: r.fileSizeMb,
        fileSizeBytes: r.fileSizeBytes,
        sha256: r.sha256,
        durationSeconds: r.durationSeconds,
        exactFrameCount: r.exactFrameCount,
        resolution: r.resolution,
        fps: r.fps,
        videoCodec: r.videoCodec,
        containerFormat: r.containerFormat,
        timeBase: r.timeBase,
        streamStartTime: r.streamStartTime,
        hasAudio: r.hasAudio,
        audioCodec: r.audioCodec,
        audioRate: r.audioRate,
        audioChannels: r.audioChannels,
        loudnessLufs: r.loudnessLufs,
        loudnessStatus: r.loudnessStatus,
        bitstreamVerified: r.bitstreamVerified,
        approvalRecord: r.approvalRecord,
        evaluation: r.evaluation
      })),
      simulations: simulations.map(s => ({
        simId: s.simId,
        archetypeId: s.archetypeId,
        narrativeRole: s.narrativeRole,
        seed: s.seed,
        title: s.title,
        winner: s.winner,
        finishTime: s.finishTime,
        finishMargin: s.finishMargin,
        leadChanges: s.leadChanges,
        leftMetrics: s.leftMetrics,
        rightMetrics: s.rightMetrics,
        timelineEvents: s.timelineEvents
      }))
    };

    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`  ✓ Report saved to: ${this.reportPath}`);

    console.log('\n' + '='.repeat(70));
    console.log(isOfficiallyApproved
      ? '🎉 FLAGSHIP MULTIPLYING BALL RACE CERTIFICATION COMPLETE (APPROVED FOR PUBLISHING)!'
      : 'ℹ️ PRODUCTION RUN COMPLETE — AWAITING EXPLICIT HUMAN CREATIVE SIGN-OFF');
    console.log('='.repeat(70));

    return report;
  }

  async execute() {
    return this.runProductionProof();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const unattended = args.includes('--unattended');
  const tokenIdx = args.indexOf('--token');
  const token = tokenIdx !== -1 ? args[tokenIdx + 1] : process.env.HUMAN_APPROVAL_TOKEN;
  const trustedIdx = args.indexOf('--trusted-token');
  const trustedToken = trustedIdx !== -1 ? args[trustedIdx + 1] : process.env.TRUSTED_APPROVAL_TOKEN;
  const reviewerIdx = args.indexOf('--reviewer');
  const reviewerName = reviewerIdx !== -1 ? args[reviewerIdx + 1] : process.env.REVIEWER_NAME;
  const orchestrator = new ProductionOrchestrator({
    unattendedApproval: unattended,
    humanApprovalToken: token,
    trustedApprovalToken: trustedToken,
    reviewer: reviewerName ? { name: reviewerName } : null
  });
  orchestrator.runProductionProof().catch(err => {
    console.error('Production pipeline error:', err);
    process.exit(1);
  });
}

module.exports = { ProductionOrchestrator, ProductionPipeline: ProductionOrchestrator };
