// Publishing Automation & Rotating Scheduler (Milestone M4 & M5)
// Implements the repeating 8-day publishing cadence (4 releases per 8 days with gap days & weekend maintenance).
// Manages upload queue, generates social metadata, handles retry mechanics, and logs performance records.

const fs = require('fs');
const path = require('path');

class PublishingScheduler {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.queuePath = path.join(this.outputDir, 'publishing_queue.json');
    this.historyPath = path.join(this.outputDir, 'publishing_history.json');

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

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Generate an 8-day or multi-week schedule from the candidate catalog
  scheduleFromCatalog(catalogPath = null, startDate = new Date(), totalDays = 32) {
    const defaultCatalogPath = path.join(this.outputDir, 'candidate_catalog_100.json');
    const targetPath = catalogPath || defaultCatalogPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Candidate catalog not found at ${targetPath}. Please run ClipFactory first.`);
    }

    const catalog = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const qualifiedCandidates = catalog.candidates.filter(c => c.isQualified && !c.isDuplicate);

    // Group qualified candidates by gameType
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
        const pool = pools[cycleStep.gameType];
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
            status: 'SCHEDULED', // SCHEDULED, APPROVED, PUBLISHED, FAILED
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
        // Gap Day / Weekend Record
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

  // Simulate/Execute publishing next eligible post with safety retries and duplicate protection
  publishNext(options = {}) {
    const queue = this.getQueue();
    const history = this.getHistory();

    const pendingItem = queue.find(item => item.status === 'SCHEDULED' || item.status === 'APPROVED');

    if (!pendingItem) {
      return { success: false, message: 'No scheduled posts pending in queue.' };
    }

    // Duplicate protection check against history
    const alreadyPublished = history.some(h => h.candidateId === pendingItem.candidateId);
    if (alreadyPublished) {
      pendingItem.status = 'FAILED';
      pendingItem.error = 'Duplicate candidate protection triggered: already published in history!';
      fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      return { success: false, message: 'Duplicate post prevented by safety check.' };
    }

    try {
      // Simulate/Execute publish action
      const publishRecord = {
        publishId: `pub_${Date.now()}`,
        queueId: pendingItem.queueId,
        candidateId: pendingItem.candidateId,
        gameType: pendingItem.gameType,
        title: pendingItem.title,
        publishedAt: new Date().toISOString(),
        scheduledFor: pendingItem.scheduledTime,
        status: 'SUCCESS',
        metrics: {
          simulatedViews: 12500,
          averageRetentionPct: 88.4,
          likes: 940,
          comments: 112
        }
      };

      pendingItem.status = 'PUBLISHED';
      pendingItem.publishedAt = publishRecord.publishedAt;
      pendingItem.publishId = publishRecord.publishId;

      history.push(publishRecord);

      fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2));

      return {
        success: true,
        post: pendingItem,
        record: publishRecord
      };
    } catch (err) {
      pendingItem.retryCount++;
      if (pendingItem.retryCount >= pendingItem.maxRetries) {
        pendingItem.status = 'FAILED';
        pendingItem.error = err.message;
      } else {
        pendingItem.status = 'RETRY_PENDING';
      }
      fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
      return { success: false, error: err.message };
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PublishingScheduler };
}
