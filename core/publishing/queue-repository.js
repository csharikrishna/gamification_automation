// Core Publishing Queue Repository
// Authoritative, consolidated queue store with atomic persistence, safe concurrency locking,
// corruption defense, scheduled-time enforcement, and duplicate prevention.

const fs = require('fs');
const path = require('path');
const { LIFECYCLE_STATES } = require('../contracts/lifecycle-schema');

class QueueRepository {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.queuePath = options.queuePath || path.join(this.outputDir, 'publishing_queue.json');
    this.historyPath = options.historyPath || path.join(this.outputDir, 'publishing_history.json');
    this.lockPath = `${this.queuePath}.lock`;
    this.timezone = options.timezone || 'UTC';
    this.maxRetries = options.maxRetries || 3;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this._initializeStorage();
  }

  // Ensures storage files exist
  _initializeStorage() {
    if (!fs.existsSync(this.queuePath)) {
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

  // File-based concurrency lock to protect read-modify-write transactions
  _acquireLock(maxWaitMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        // wx flag creates file exclusively, failing if it already exists
        fs.writeFileSync(this.lockPath, `${process.pid}\n${Date.now()}`, { flag: 'wx' });
        return true;
      } catch (err) {
        // If stale lock (older than 10s), force remove
        try {
          if (fs.existsSync(this.lockPath)) {
            const content = fs.readFileSync(this.lockPath, 'utf8').split('\n');
            const lockTime = parseInt(content[1], 10);
            if (Date.now() - lockTime > 10000) {
              fs.unlinkSync(this.lockPath);
              continue;
            }
          }
        } catch (e) {}
        // Short spin sleep
        const waitTill = Date.now() + 50;
        while (Date.now() < waitTill) {}
      }
    }
    throw new Error(`QueueRepository: Timed out waiting for file lock (${this.lockPath})`);
  }

  _releaseLock() {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch (e) {}
  }

  // Atomic file write using temporary file rename
  _writeAtomic(filePath, data) {
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  // Corruption defense: Never silently overwrite corrupt queue data with an empty array
  getAll() {
    if (!fs.existsSync(this.queuePath)) return [];

    let raw;
    try {
      raw = fs.readFileSync(this.queuePath, 'utf8');
    } catch (readErr) {
      throw new Error(`[QueueRepository] Failed to read queue file: ${readErr.message}`);
    }

    try {
      return JSON.parse(raw);
    } catch (err) {
      // Quarantine corrupted queue file immediately
      const quarantinePath = path.join(this.outputDir, `publishing_queue.corrupt.${Date.now()}.json`);
      fs.writeFileSync(quarantinePath, raw, 'utf8');
      throw new Error(
        `[QueueRepository] Corrupt queue data detected! Quarantined to "${quarantinePath}". Halting to prevent data loss: ${err.message}`
      );
    }
  }

  getHistory() {
    if (!fs.existsSync(this.historyPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
    } catch (err) {
      const qPath = path.join(this.outputDir, `publishing_history.corrupt.${Date.now()}.json`);
      try { fs.copyFileSync(this.historyPath, qPath); } catch (e) {}
      throw new Error(`[QueueRepository] Corrupt history data detected! Quarantined to "${qPath}": ${err.message}`);
    }
  }

  // Enqueues an approved media artifact with duplicate checking under transactional lock
  enqueue(entry) {
    if (!entry.queueId) throw new Error('Queue entry must have a unique "queueId".');
    if (!entry.videoPath || !fs.existsSync(entry.videoPath)) {
      throw new Error(`Cannot enqueue item with missing on-disk media: ${entry.videoPath}`);
    }

    this._acquireLock();
    try {
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
        scheduledTime: entry.scheduledTime || new Date().toISOString(),
        timezone: this.timezone,
        attempts: entry.attempts !== undefined ? entry.attempts : 0
      };

      queue.push(enriched);
      this._writeAtomic(this.queuePath, queue);
      return enriched;
    } finally {
      this._releaseLock();
    }
  }

  // Atomically claims next eligible item for upload
  // Enforces: scheduledTime <= now, bounded retries, exponential backoff, worker isolation
  claimNext(workerId = 'worker-1', options = {}) {
    this._acquireLock();
    try {
      const queue = this.getAll();
      const now = Date.now();

      let targetIdx = -1;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const isEligibleState = item.status === 'READY_TO_PUBLISH' || item.lifecycleState === LIFECYCLE_STATES.SCHEDULED;

        if (!isEligibleState) continue;

        // 1. Invariant: Never claim an item before its scheduled time (unless explicitly requested for pre-flight)
        if (!options.ignoreScheduleTime && item.scheduledTime) {
          const schedTime = new Date(item.scheduledTime).getTime();
          if (schedTime > now) {
            continue; // Future scheduled item, skip
          }
        }

        // 2. Invariant: Bounded retry attempts
        if (item.attempts >= this.maxRetries) {
          item.status = 'FAILED';
          item.lifecycleState = LIFECYCLE_STATES.FAILED;
          item.lastError = `MAX_RETRIES_EXCEEDED (${item.attempts}/${this.maxRetries})`;
          item.failedAt = new Date().toISOString();
          continue;
        }

        // 3. Invariant: Exponential retry backoff
        if (item.attempts > 0 && item.lastAttemptTime) {
          const backoffDelayMs = Math.pow(2, item.attempts) * 60 * 1000;
          const elapsedSinceAttempt = now - new Date(item.lastAttemptTime).getTime();
          if (elapsedSinceAttempt < backoffDelayMs) {
            continue; // Backoff period has not elapsed, skip
          }
        }

        targetIdx = i;
        break;
      }

      if (targetIdx === -1) {
        // Persist any failed items transitioned due to max retries
        this._writeAtomic(this.queuePath, queue);
        return null;
      }

      const claimedItem = queue[targetIdx];
      claimedItem.status = 'IN_PROGRESS';
      claimedItem.lifecycleState = LIFECYCLE_STATES.UPLOAD_IN_PROGRESS;
      claimedItem.claimedBy = workerId;
      claimedItem.claimedAt = new Date().toISOString();
      claimedItem.lastAttemptTime = new Date().toISOString();
      claimedItem.attempts = (claimedItem.attempts || 0) + 1;

      this._writeAtomic(this.queuePath, queue);
      return claimedItem;
    } finally {
      this._releaseLock();
    }
  }

  // Completes a publish operation, updating history and removing or archiving item
  // Enforces valid platform upload verification on live uploads
  completePublish(queueId, receipt) {
    this._acquireLock();
    try {
      const queue = this.getAll();
      const idx = queue.findIndex(q => q.queueId === queueId);
      if (idx === -1) return false;

      const item = queue[idx];
      const isDryRun = receipt.mode === 'DRY_RUN';

      // Live publishing invariant: verify actual platform video ID
      if (!isDryRun) {
        if (!receipt.platformVideoId || typeof receipt.platformVideoId !== 'string' || receipt.platformVideoId.trim().length < 4) {
          throw new Error(`Cannot complete live publishing without a valid platformVideoId. Received: ${receipt.platformVideoId}`);
        }
      }

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

      if (!isDryRun) {
        queue.splice(idx, 1);
      } else {
        queue[idx] = completedRecord;
      }

      this._writeAtomic(this.queuePath, queue);
      return completedRecord;
    } finally {
      this._releaseLock();
    }
  }

  // Records an upload failure with error diagnostics under lock
  recordFailure(queueId, errorMessage) {
    this._acquireLock();
    try {
      const queue = this.getAll();
      const idx = queue.findIndex(q => q.queueId === queueId);
      if (idx === -1) return false;

      queue[idx].status = 'FAILED';
      queue[idx].lifecycleState = LIFECYCLE_STATES.FAILED;
      queue[idx].lastError = errorMessage;
      queue[idx].failedAt = new Date().toISOString();

      this._writeAtomic(this.queuePath, queue);
      return queue[idx];
    } finally {
      this._releaseLock();
    }
  }

  // Recovers stale claims after unexpected process crashes
  recoverStaleClaims(timeoutMinutes = 15) {
    this._acquireLock();
    try {
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
    } finally {
      this._releaseLock();
    }
  }
}

module.exports = { QueueRepository };
