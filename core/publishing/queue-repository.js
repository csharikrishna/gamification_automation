// Core Publishing Queue Repository
// Authoritative, consolidated queue store with ownership-aware atomic locking, PID validation,
// crash-recovery duplicate protection, failure classification (transient retry vs permanent fail),
// corruption defense, scheduled-time enforcement, and bounded backoff.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LIFECYCLE_STATES } = require('../contracts/lifecycle-schema');

class QueueRepository {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.resolve('output');
    this.queuePath = options.queuePath || path.join(this.outputDir, 'publishing_queue.json');
    this.historyPath = options.historyPath || path.join(this.outputDir, 'publishing_history.json');
    this.journalPath = options.journalPath || path.join(this.outputDir, 'publishing_journal.json');
    this.lockPath = `${this.queuePath}.lock`;
    this.timezone = options.timezone || 'UTC';
    this.maxRetries = options.maxRetries || 3;
    this._activeLockToken = null;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this._initializeStorage();
  }

  // Ensures storage files exist and reconciles pending write-ahead journal transactions
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

    this._reconcileJournal();
  }

  // Recovers incomplete multi-file transactions after sudden process crashes
  _reconcileJournal() {
    if (!fs.existsSync(this.journalPath)) return;
    try {
      const journal = JSON.parse(fs.readFileSync(this.journalPath, 'utf8'));
      if (journal.operation === 'COMPLETE_PUBLISH' && journal.queueId) {
        const queue = this.getAll();
        const history = this.getHistory();
        const isHistoryPresent = history.some(h => h.queueId === journal.queueId);
        if (isHistoryPresent) {
          // If already in history, ensure item is removed or updated in queue
          const qIdx = queue.findIndex(q => q.queueId === journal.queueId);
          if (qIdx !== -1) {
            if (journal.receipt?.mode !== 'DRY_RUN') {
              queue.splice(qIdx, 1);
            } else {
              queue[qIdx].status = 'DRY_RUN_PASSED';
              queue[qIdx].lifecycleState = LIFECYCLE_STATES.UPLOAD_PREFLIGHT_PASSED;
            }
            this._writeAtomic(this.queuePath, queue);
          }
        }
      }
      fs.unlinkSync(this.journalPath);
    } catch (e) {}
  }

  // Helper to check if a process ID is currently alive on the host
  static _isProcessAlive(pid) {
    if (!pid || isNaN(pid)) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM'; // Process exists but belongs to another user
    }
  }

  // Ownership-aware concurrency lock with token verification and dead-PID detection
  _acquireLock(maxWaitMs = 5000) {
    const start = Date.now();
    const token = crypto.randomBytes(16).toString('hex');

    while (Date.now() - start < maxWaitMs) {
      try {
        // wx flag creates file exclusively, failing if it already exists
        const lockContent = `${process.pid}\n${Date.now()}\n${token}`;
        fs.writeFileSync(this.lockPath, lockContent, { flag: 'wx' });
        this._activeLockToken = token;
        return true;
      } catch (err) {
        // Inspect existing lock
        try {
          if (fs.existsSync(this.lockPath)) {
            const lines = fs.readFileSync(this.lockPath, 'utf8').split('\n');
            const lockPid = parseInt(lines[0], 10);
            const lockTime = parseInt(lines[1], 10);

            const isAlive = QueueRepository._isProcessAlive(lockPid);
            const isStale = (Date.now() - lockTime > 30000); // 30 seconds threshold

            // Only remove lock if owning process is dead OR lock is severely stale (>30s) and confirmed dead
            if (!isAlive || (isStale && !isAlive)) {
              try { fs.unlinkSync(this.lockPath); } catch (e) {}
              continue;
            }
          }
        } catch (e) {}

        // Spin wait
        const waitTill = Date.now() + 40;
        while (Date.now() < waitTill) {}
      }
    }
    throw new Error(`QueueRepository: Timed out waiting for file lock (${this.lockPath})`);
  }

  // Ownership-verified lock release: only releases if current worker holds the active token
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
  // Supports options.upsert to update existing un-published items with fresh media signatures
  enqueue(entry, options = {}) {
    if (!entry.queueId) throw new Error('Queue entry must have a unique "queueId".');
    if (!entry.videoPath || !fs.existsSync(entry.videoPath)) {
      throw new Error(`Cannot enqueue item with missing on-disk media: ${entry.videoPath}`);
    }

    this._acquireLock();
    try {
      const queue = this.getAll();
      const existingIdx = queue.findIndex(q => q.queueId === entry.queueId);
      if (existingIdx !== -1) {
        if (options.upsert && queue[existingIdx].status !== 'PUBLISHED') {
          // Cleanly update existing un-published item with fresh media attributes
          queue[existingIdx] = {
            ...queue[existingIdx],
            ...entry,
            attempts: entry.attempts !== undefined ? entry.attempts : 0,
            lastError: null,
            failedAt: null,
            updatedAt: new Date().toISOString()
          };
          this._writeAtomic(this.queuePath, queue);
          return queue[existingIdx];
        }
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
  // Enforces: scheduledTime <= now, bounded retries, exponential backoff, crash recovery duplicate defense, worker isolation
  claimNext(workerId = 'worker-1', options = {}) {
    this._acquireLock();
    try {
      const queue = this.getAll();
      const history = this.getHistory();
      const now = Date.now();

      let targetIdx = -1;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const isEligibleState = item.status === 'READY_TO_PUBLISH'
          || item.status === 'RETRY_PENDING'
          || item.lifecycleState === LIFECYCLE_STATES.SCHEDULED
          || item.lifecycleState === LIFECYCLE_STATES.RETRY_PENDING;

        if (!isEligibleState) continue;

        // Crash-recovery duplicate protection: Never re-publish an item already live on platform
        const alreadyPublished = history.find(h =>
          (h.queueId === item.queueId || (h.sha256 && item.sha256 && h.sha256 === item.sha256))
          && h.status === 'PUBLISHED'
        );
        if (alreadyPublished) {
          item.status = 'PUBLISHED';
          item.lifecycleState = LIFECYCLE_STATES.PUBLISHED;
          continue;
        }

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

      receipt.idempotencyKey = receipt.idempotencyKey || `idemp_${crypto.randomUUID()}`;

      // Write-ahead journal before modifying history & queue
      this._writeAtomic(this.journalPath, {
        operation: 'COMPLETE_PUBLISH',
        idempotencyKey: receipt.idempotencyKey,
        queueId,
        receipt,
        timestamp: new Date().toISOString()
      });

      const completedRecord = {
        ...item,
        ...receipt,
        lifecycleState: isDryRun ? LIFECYCLE_STATES.UPLOAD_PREFLIGHT_PASSED : LIFECYCLE_STATES.PUBLISHED,
        status: isDryRun ? 'DRY_RUN_PASSED' : 'PUBLISHED',
        attempts: 0,
        lastError: null,
        failedAt: null,
        completedAt: new Date().toISOString()
      };

      // Update history idempotently (avoid duplicate entries if re-invoked)
      const history = this.getHistory();
      const histIdx = history.findIndex(h => h.queueId === queueId);
      if (histIdx >= 0) {
        history[histIdx] = completedRecord;
      } else {
        history.push(completedRecord);
      }
      this._writeAtomic(this.historyPath, history);

      if (!isDryRun) {
        queue.splice(idx, 1);
      } else {
        queue[idx] = completedRecord;
      }

      this._writeAtomic(this.queuePath, queue);

      // Clean up journal after successful write boundary
      try {
        if (fs.existsSync(this.journalPath)) fs.unlinkSync(this.journalPath);
      } catch (e) {}

      return completedRecord;
    } finally {
      this._releaseLock();
    }
  }

  // Records an upload failure with error diagnostics under lock
  // Classifies transient errors into RETRY_PENDING with exponential backoff
  recordFailure(queueId, errorMessage, options = {}) {
    this._acquireLock();
    try {
      const queue = this.getAll();
      const idx = queue.findIndex(q => q.queueId === queueId);
      if (idx === -1) return false;

      const item = queue[idx];
      const isTransient = options.isTransient !== undefined
        ? options.isTransient
        : /timeout|econnreset|etimedout|rate_limit|429|503|network|temporar|try again|socket/i.test(errorMessage);

      item.lastError = errorMessage;
      item.failedAt = new Date().toISOString();

      if (isTransient && (item.attempts || 0) < this.maxRetries) {
        item.status = 'RETRY_PENDING';
        item.lifecycleState = LIFECYCLE_STATES.RETRY_PENDING;
      } else {
        item.status = 'FAILED';
        item.lifecycleState = LIFECYCLE_STATES.FAILED;
      }

      this._writeAtomic(this.queuePath, queue);
      return item;
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
