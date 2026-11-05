// Core Publishing Scheduler
// Manages rotating multi-game calendar, social metadata packaging, and queue dispatch.

const fs = require('fs');
const path = require('path');
const { YouTubePublisher } = require('./youtube/youtube-publisher');
const { QueueRepository } = require('./queue-repository');

class PublishingScheduler {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.timezone = options.timezone || 'UTC';
    this.queueRepo = options.queueRepo || new QueueRepository({ outputDir: this.outputDir, timezone: this.timezone });
    this.queuePath = this.queueRepo.queuePath;
    this.historyPath = this.queueRepo.historyPath;
    this.publisher = options.publisher || new YouTubePublisher(options.publisherConfig || {});

    // 8-Day Publishing Cycle: 4 Releases, 2 Gap Days, 2 Weekend Maintenance/Rest Days
    this.cadence = [
      { dayIndex: 1, dayName: 'Monday', action: 'PUBLISH', gameType: 'multi_race', label: 'Game 1 — Multiplying Ball Race' },
      { dayIndex: 2, dayName: 'Tuesday', action: 'GAP_DAY', gameType: null, label: 'Gap day — No post' },
      { dayIndex: 3, dayName: 'Wednesday', action: 'PUBLISH', gameType: 'mega_plinko', label: 'Game 2 — Mega Plinko' },
      { dayIndex: 4, dayName: 'Thursday', action: 'GAP_DAY', gameType: null, label: 'Gap day — No post' },
      { dayIndex: 5, dayName: 'Friday', action: 'PUBLISH', gameType: 'sumo_arena', label: 'Game 3 — Sumo Battle Royale' },
      { dayIndex: 6, dayName: 'Saturday', action: 'MAINTENANCE', gameType: null, label: 'Weekend — Batch production / analytics' },
      { dayIndex: 7, dayName: 'Sunday', action: 'MAINTENANCE', gameType: null, label: 'Weekend — Rest / queue preparation' },
      { dayIndex: 8, dayName: 'Following Monday', action: 'PUBLISH', gameType: 'brick_breaker', label: 'Game 4 — Neon Brick Breaker' }
    ];
  }

  // Generates 32-day calendar aligned with the 8-day rotating cadence
  generateCalendar(startDate = new Date(), cycles = 4) {
    const calendar = [];
    const current = new Date(startDate);

    for (let c = 0; c < cycles; c++) {
      for (const step of this.cadence) {
        const dateStr = current.toISOString().split('T')[0];
        calendar.push({
          date: dateStr,
          dayIndex: step.dayIndex + (c * 8),
          dayName: step.dayName,
          action: step.action,
          gameType: step.gameType,
          label: step.label,
          scheduledTime: `${dateStr}T17:00:00.000Z`,
          timezone: this.timezone
        });
        current.setDate(current.getDate() + 1);
      }
    }
    return calendar;
  }

  // Generates social metadata packaging for an approved clip
  generateSocialMetadata(candidate) {
    const title = (candidate.title || `⚡ ${candidate.gameType?.toUpperCase() || 'PHYSICS'} SHOWDOWN ⚡`).substring(0, 100);
    const hook = candidate.hookText || 'Who wins this impossible showdown? 😱';
    const desc = `${title}\n\n${hook}\n\nAutonomous physics showdown simulation! 🔔 Subscribe to Burstpoint for daily satisfying marble and physics battles.\n\n#shorts #physics #gaming #marblerun #satisfying`;
    const tags = ['shorts', 'physics', 'gaming', 'marblerun', 'satisfying'];

    return {
      title,
      hook,
      description: desc,
      tags,
      pinnedComment: 'Who did you bet on? Let us know in the comments! 👇',
      categoryId: '20'
    };
  }

  // Generate an 8-day or multi-week schedule from candidate catalog
  scheduleFromCatalog(catalogPath = null, startDate = new Date(), totalDays = 32) {
    const defaultCatalogPath = path.join(this.outputDir, 'candidate_catalog_100.json');
    const targetPath = catalogPath || defaultCatalogPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Candidate catalog not found at ${targetPath}. Please run ClipFactory first.`);
    }

    const catalog = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const qualifiedCandidates = catalog.candidates.filter(c => c.isQualified && !c.isDuplicate);

    const pools = {
      multi_race: qualifiedCandidates.filter(c => c.gameType === 'multi_race'),
      mega_plinko: qualifiedCandidates.filter(c => c.gameType === 'mega_plinko'),
      sumo_arena: qualifiedCandidates.filter(c => c.gameType === 'sumo_arena'),
      brick_breaker: qualifiedCandidates.filter(c => c.gameType === 'brick_breaker')
    };

    const queue = [];
    const poolIndices = { multi_race: 0, mega_plinko: 0, sumo_arena: 0, brick_breaker: 0 };
    let currentDate = new Date(startDate);

    for (let day = 0; day < totalDays; day++) {
      const cycleStep = this.cadence[day % this.cadence.length];
      const dateStr = currentDate.toISOString().split('T')[0];

      if (cycleStep.action === 'PUBLISH' && cycleStep.gameType) {
        const pool = pools[cycleStep.gameType] || [];
        const candidateIndex = poolIndices[cycleStep.gameType] % (pool.length || 1);
        const candidate = pool[candidateIndex];
        poolIndices[cycleStep.gameType]++;

        if (candidate) {
          queue.push({
            queueId: `post_${dateStr}_${cycleStep.gameType}`,
            date: dateStr,
            dayOfWeek: cycleStep.dayName,
            cycleDay: (day % this.cadence.length) + 1,
            gameType: cycleStep.gameType,
            gameLabel: cycleStep.label,
            status: 'SCHEDULED',
            candidateId: candidate.id,
            seed: candidate.seed,
            title: candidate.title,
            hookText: candidate.hookText,
            tags: candidate.tags,
            description: `${candidate.title}\n\nCan you predict the final outcome? Watch till the end to see the winner!\n\n🔔 Subscribe to Burstpoint for daily autonomous physics simulations!`,
            pinnedComment: `Did you pick the winner? Let us know in the comments below! ⬇️`,
            scheduledTime: `${dateStr}T17:00:00.000Z`,
            retryCount: 0,
            maxRetries: 3,
            config: candidate.config,
            qualityScore: candidate.qualityScore
          });
        }
      } else {
        queue.push({
          queueId: `gap_${dateStr}`,
          date: dateStr,
          dayOfWeek: cycleStep.dayName,
          cycleDay: (day % this.cadence.length) + 1,
          action: cycleStep.action,
          gameType: null,
          gameLabel: cycleStep.label,
          status: 'GAP_DAY',
          notes: cycleStep.action === 'MAINTENANCE'
            ? 'Analytics ingestion & batch simulation pipeline'
            : 'Audience rest day between viral game releases'
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
    return queue;
  }

  // Retrieve current publishing queue
  getQueue() {
    if (!fs.existsSync(this.queuePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  // Retrieve publishing history
  getHistory() {
    if (!fs.existsSync(this.historyPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  // Dispatches next queued item for publishing (DRY_RUN or LIVE)
  async publishNext(options = {}) {
    const queue = this.getQueue();
    const history = this.getHistory();
    const workerId = options.workerId || `worker-${process.pid}`;

    let item = this.queueRepo.claimNext(workerId, options);
    let isLegacyClaim = false;

    if (!item) {
      const pendingItem = queue.find(it => it.status === 'SCHEDULED' || it.status === 'APPROVED');
      if (!pendingItem) {
        return { success: false, message: 'Publishing queue is empty or has no pending items eligible at this time.' };
      }
      item = pendingItem;
      isLegacyClaim = true;
    }

    const alreadyPublished = history.some(h => (h.candidateId && h.candidateId === item.candidateId) || (h.queueId && h.queueId === item.queueId));
    if (alreadyPublished && isLegacyClaim) {
      item.status = 'FAILED';
      item.error = 'Duplicate candidate protection triggered: already published in history!';
      fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      return { success: false, message: 'Duplicate post prevented by safety check.' };
    }

    const videoPath = item.videoPath ? path.resolve(item.videoPath) : null;

    if (!videoPath || !fs.existsSync(videoPath)) {
      const err = `Publishing halted: Media file does not exist on disk (${videoPath || 'no videoPath'}). Videos must be rendered before publishing.`;
      if (!isLegacyClaim) {
        this.queueRepo.recordFailure(item.queueId, err);
      } else {
        item.status = 'FAILED';
        item.error = err;
        fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      }
      return {
        success: false,
        status: 'FAILED',
        error: err,
        post: item,
        item
      };
    }

    try {
      const isDryRun = options.dryRun !== undefined ? options.dryRun : true;
      const receipt = await this.publisher.publish(item, { dryRun: isDryRun });

      let completed;
      let record;

      if (!isLegacyClaim) {
        completed = this.queueRepo.completePublish(item.queueId, receipt);
        record = receipt;
      } else {
        record = {
          publishId: `pub_${Date.now()}`,
          queueId: item.queueId,
          candidateId: item.candidateId,
          gameType: item.gameType,
          title: item.title,
          videoPath: item.videoPath,
          fileSize: receipt.fileSize,
          sha256: receipt.sha256,
          mode: receipt.mode,
          platform: 'youtube',
          platformVideoId: receipt.platformVideoId,
          url: receipt.url,
          publishedAt: new Date().toISOString(),
          scheduledFor: item.scheduledTime,
          status: receipt.mode === 'LIVE' ? 'PUBLISHED' : 'DRY_RUN_VERIFIED',
          metrics: receipt.metrics
        };
        item.status = record.status;
        item.publishedAt = record.publishedAt;
        item.publishId = record.publishId;
        completed = item;
        history.push(record);
        fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2));
      }

      return {
        success: true,
        status: isDryRun ? 'DRY_RUN_VERIFIED' : 'PUBLISHED',
        item: completed,
        post: completed,
        receipt,
        record
      };
    } catch (err) {
      if (!isLegacyClaim) {
        this.queueRepo.recordFailure(item.queueId, err.message);
      } else {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= (item.maxRetries || 3)) {
          item.status = 'FAILED';
          item.error = err.message;
        } else {
          item.status = 'RETRY_PENDING';
        }
        fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      }
      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        post: item,
        item
      };
    }
  }

  // Status dashboard
  getStatus() {
    const queue = this.getQueue();
    const history = this.getHistory();

    const scheduled = queue.filter(q => q.status === 'SCHEDULED').length;
    const published = history.length;
    const gapDays = queue.filter(q => q.status === 'GAP_DAY').length;

    return {
      totalQueueItems: queue.length,
      scheduledReleases: scheduled,
      gapDaysPlanned: gapDays,
      publishedPosts: published,
      nextScheduled: queue.find(q => q.status === 'SCHEDULED') || null
    };
  }
}

module.exports = { PublishingScheduler };
