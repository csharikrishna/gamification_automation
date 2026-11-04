// Core Publishing Queue Repository
// Authoritative, consolidated queue store with atomic persistence, safe claiming, and duplicate prevention.

const fs = require('fs');
const path = require('path');
const { LIFECYCLE_STATES, LifecycleManager } = require('../contracts/lifecycle-schema');

class QueueRepository {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.queuePath = options.queuePath || path.join(this.outputDir, 'publishing_queue.json');
    this.historyPath = options.historyPath || path.join(this.outputDir, 'publishing_history.json');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this._initializeStorage();
  }

  // Ensures file exists and migrates legacy queues if present
  _initializeStorage() {
    if (!fs.existsSync(this.queuePath)) {
      // Check for legacy production queue to consolidate
      const legacyPath = path.join(this.outputDir, 'production_publishing_queue.json');
      if (fs.existsSync(legacyPath)) {
        try {
          const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
          this._writeAtomic(this.queuePath, legacyData);
          return;
        } catch (e) {}
      }
      this._writeAtomic(this.queuePath, []);
    }

    if (!fs.existsSync(this.historyPath)) {
      this._writeAtomic(this.historyPath, []);
    }
  }

  // Atomic file write using temporary file rename
  _writeAtomic(filePath, data) {
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  getAll() {
    try {
      return JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
    } catch (err) {
      console.warn(`[QueueRepository] Error reading queue, initializing empty:`, err.message);
      return [];
    }
  }

  getHistory() {
    try {
      return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
    } catch (err) {
      return [];
    }
  }

  // Enqueues an approved media artifact with duplicate checking
  enqueue(entry) {
    if (!entry.queueId) throw new Error('Queue entry must have a unique "queueId".');
    if (!entry.videoPath || !fs.existsSync(entry.videoPath)) {
      throw new Error(`Cannot enqueue item with missing on-disk media: ${entry.videoPath}`);
    }

    const queue = this.getAll();
    const existing = queue.find(q => q.queueId === entry.queueId);
    if (existing) {
      throw new Error(`Queue entry "${entry.queueId}" already exists (Duplicate Protection).`);
    }

    // Check SHA-256 duplicate guardrail
    if (entry.sha256) {
      const dup = queue.find(q => q.sha256 === entry.sha256 && q.status !== 'FAILED');
      if (dup) {
        throw new Error(`Media artifact with SHA-256 "${entry.sha256}" is already queued.`);
      }
    }

    const enriched = {
      ...entry,
      lifecycleState: entry.lifecycleState || LIFECYCLE_STATES.SCHEDULED,
      status: entry.status || 'READY_TO_PUBLISH',
      enqueuedAt: new Date().toISOString(),
      attempts: 0
    };

    queue.push(enriched);
    this._writeAtomic(this.queuePath, queue);
    return enriched;
  }

  // Atomically claims next available item for upload
  claimNext(workerId = 'worker-1') {
    const queue = this.getAll();
    const targetIdx = queue.findIndex(q => q.status === 'READY_TO_PUBLISH' || q.lifecycleState === LIFECYCLE_STATES.SCHEDULED);

    if (targetIdx === -1) return null;

    const item = queue[targetIdx];
    item.status = 'IN_PROGRESS';
    item.lifecycleState = LIFECYCLE_STATES.UPLOAD_IN_PROGRESS;
    item.claimedBy = workerId;
    item.claimedAt = new Date().toISOString();
    item.attempts = (item.attempts || 0) + 1;

    this._writeAtomic(this.queuePath, queue);
    return item;
  }

  // Completes a publish operation, updating history and removing or archiving item
  completePublish(queueId, receipt) {
    const queue = this.getAll();
    const idx = queue.findIndex(q => q.queueId === queueId);
    if (idx === -1) return false;

    const item = queue[idx];
    const isDryRun = receipt.mode === 'DRY_RUN';

    const completedRecord = {
      ...item,
      ...receipt,
      lifecycleState: isDryRun ? LIFECYCLE_STATES.UPLOAD_PREFLIGHT_PASSED : LIFECYCLE_STATES.PUBLISHED,
      status: isDryRun ? 'DRY_RUN_PASSED' : 'PUBLISHED',
      completedAt: new Date().toISOString()
    };

    // Update history
    const history = this.getHistory();
    history.push(completedRecord);
    this._writeAtomic(this.historyPath, history);

    // Remove from active queue if live publish, or mark verified if dry run
    if (!isDryRun) {
      queue.splice(idx, 1);
    } else {
      queue[idx] = completedRecord;
    }

    this._writeAtomic(this.queuePath, queue);
    return completedRecord;
  }

  // Records an upload failure with error diagnostics
  recordFailure(queueId, errorMessage) {
    const queue = this.getAll();
    const idx = queue.findIndex(q => q.queueId === queueId);
    if (idx === -1) return false;

    queue[idx].status = 'FAILED';
    queue[idx].lifecycleState = LIFECYCLE_STATES.FAILED;
    queue[idx].lastError = errorMessage;
    queue[idx].failedAt = new Date().toISOString();

    this._writeAtomic(this.queuePath, queue);
    return queue[idx];
  }

  // Recovers stale claims after unexpected process crashes
  recoverStaleClaims(timeoutMinutes = 15) {
    const queue = this.getAll();
    const now = Date.now();
    let recoveredCount = 0;

    for (const item of queue) {
      if (item.status === 'IN_PROGRESS' && item.claimedAt) {
        const claimTime = new Date(item.claimedAt).getTime();
        if (now - claimTime > timeoutMinutes * 60 * 1000) {
          item.status = 'READY_TO_PUBLISH';
          item.lifecycleState = LIFECYCLE_STATES.RETRY_PENDING;
          delete item.claimedBy;
          delete item.claimedAt;
          recoveredCount++;
        }
      }
    }

    if (recoveredCount > 0) {
      this._writeAtomic(this.queuePath, queue);
    }
    return recoveredCount;
  }
}

module.exports = { QueueRepository };
