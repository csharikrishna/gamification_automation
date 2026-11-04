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

  // Dispatches next queued item for publishing (DRY_RUN or LIVE)
  async publishNext(options = {}) {
    const workerId = options.workerId || `worker-${process.pid}`;
    const item = this.queueRepo.claimNext(workerId, options);
    if (!item) {
      return { success: false, message: 'Publishing queue is empty or has no pending items eligible at this time.' };
    }

    const videoPath = item.videoPath ? path.resolve(item.videoPath) : null;

    // Strict on-disk file existence check
    if (!videoPath || !fs.existsSync(videoPath)) {
      const err = `Media file does not exist on disk: ${videoPath || 'undefined'}`;
      this.queueRepo.recordFailure(item.queueId, err);
      return {
        success: false,
        status: 'FAILED',
        error: err
      };
    }

    try {
      const isDryRun = options.dryRun !== undefined ? options.dryRun : true;
      const receipt = await this.publisher.publish(item, { dryRun: isDryRun });

      const completed = this.queueRepo.completePublish(item.queueId, receipt);
      return {
        success: true,
        status: isDryRun ? 'DRY_RUN_PASSED' : 'PUBLISHED',
        item: completed,
        receipt
      };
    } catch (err) {
      this.queueRepo.recordFailure(item.queueId, err.message);
      return {
        success: false,
        status: 'FAILED',
        error: err.message
      };
    }
  }
}

module.exports = { PublishingScheduler };
