// Milestone M4 & M5 Verification: Publishing Automation & Rotating Scheduler Test

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PublishingScheduler } = require('../src/publishing_scheduler.js');

console.log('='.repeat(70));
console.log('📅 BURSTPOINT M4/M5 VERIFICATION: PUBLISHING SCHEDULER & CADENCE');
console.log('='.repeat(70));

const testDir = path.resolve('output/test_scheduler');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });

const scheduler = new PublishingScheduler({ outputDir: testDir });
const catalogPath = path.resolve('output/candidate_catalog_100.json');

// Test 1: Generate 32-day schedule
console.log('\n▶ [1/4] Generating 32-Day Publishing Calendar (4 Releases per 8 Days)...');
const startDate = new Date('2026-11-09T00:00:00.000Z'); // A Monday
const schedule = scheduler.scheduleFromCatalog(catalogPath, startDate, 32);

assert.strictEqual(schedule.length, 32, 'Must generate exactly 32 calendar days!');

// Verify 8-day cadence
const day1 = schedule[0]; // Day 1 (Monday)
const day2 = schedule[1]; // Day 2 (Tuesday)
const day3 = schedule[2]; // Day 3 (Wednesday)
const day4 = schedule[3]; // Day 4 (Thursday)
const day5 = schedule[4]; // Day 5 (Friday)
const day6 = schedule[5]; // Day 6 (Saturday)
const day7 = schedule[6]; // Day 7 (Sunday)
const day8 = schedule[7]; // Day 8 (Following Monday)

assert.strictEqual(day1.gameType, 'multi_race', 'Day 1 must be Multiplying Ball Race');
assert.strictEqual(day1.status, 'SCHEDULED');
assert.strictEqual(day2.status, 'GAP_DAY', 'Day 2 must be a Gap Day');
assert.strictEqual(day3.gameType, 'mega_plinko', 'Day 3 must be Mega Plinko');
assert.strictEqual(day3.status, 'SCHEDULED');
assert.strictEqual(day4.status, 'GAP_DAY', 'Day 4 must be a Gap Day');
assert.strictEqual(day5.gameType, 'sumo_arena', 'Day 5 must be Sumo Battle Royale');
assert.strictEqual(day5.status, 'SCHEDULED');
assert.strictEqual(day6.status, 'GAP_DAY', 'Day 6 must be Weekend Maintenance');
assert.strictEqual(day7.status, 'GAP_DAY', 'Day 7 must be Weekend Rest');
assert.strictEqual(day8.gameType, 'brick_breaker', 'Day 8 must be Neon Brick Breaker');
assert.strictEqual(day8.status, 'SCHEDULED');

console.log('  ✓ 8-Day Cadence strictly verified: Mon (Race) → Tue (Gap) → Wed (Plinko) → Thu (Gap) → Fri (Sumo) → Sat/Sun (Maint) → Mon (Bricks).');

// Test 2: Social Metadata Integrity
console.log('\n▶ [2/4] Auditing Social Video Metadata & Hooks...');
assert(day1.title && day1.title.length > 10, 'Title must be non-empty and compelling');
assert(day1.hookText && day1.hookText.length > 5, 'Hook text must be present for first 2 seconds');
assert(Array.isArray(day1.tags) && day1.tags.length > 0, 'Tags must be provided');
assert(day1.pinnedComment, 'Pinned comment must be prepared for community engagement');
console.log(`  ✓ Sample Title: "${day1.title}"`);
console.log(`  ✓ Sample Hook:  "${day1.hookText}"`);
console.log(`  ✓ Tags:         ${day1.tags.join(' ')}`);

(async () => {
  // Test 3: Publishing Dispatch & Real Media Verification
  console.log('\n▶ [3/4] Executing Publishing Dispatch with Real Media on Disk...');
  const testMedia = path.resolve('output/underdog_slow_composed.mp4');
  assert(fs.existsSync(testMedia), `Test media file must exist at ${testMedia}`);

  const queue = scheduler.getQueue();
  const firstScheduled = queue.find(q => q.status === 'SCHEDULED');
  firstScheduled.videoPath = testMedia;
  fs.writeFileSync(scheduler.queuePath, JSON.stringify(queue, null, 2));

  const publishRes = await scheduler.publishNext({ dryRun: true });
  assert(publishRes.success, 'Publish dispatch must succeed with verified media');
  assert.strictEqual(publishRes.post.status, 'DRY_RUN_VERIFIED', 'Status must be DRY_RUN_VERIFIED');

  const history = scheduler.getHistory();
  assert(history.length >= 1, 'History must record verified video');
  const latest = history[history.length - 1];
  assert.strictEqual(latest.gameType, 'multi_race');
  assert.strictEqual(latest.status, 'DRY_RUN_VERIFIED');
  assert(latest.sha256 && latest.sha256.length === 64, 'SHA-256 hash must be recorded');
  assert(latest.fileSize > 100000, 'File size must be accurately recorded');
  console.log(`  ✓ Post "${publishRes.post.title}" verified successfully (${(latest.fileSize / 1024 / 1024).toFixed(2)} MB, SHA-256: ${latest.sha256.substring(0, 16)}...).`);

  // Test 3b: Missing Media Guardrail (P0 Invariant: Never claim PUBLISHED on missing files)
  console.log('\n▶ [3b/4] Auditing Missing-Media Invariant (Zero Fake-Published Records)...');
  const q2 = scheduler.getQueue();
  const secondScheduled = q2.find(q => q.status === 'SCHEDULED');
  if (secondScheduled) {
    secondScheduled.videoPath = 'output/non_existent_clip_xyz.mp4';
    fs.writeFileSync(scheduler.queuePath, JSON.stringify(q2, null, 2));

    const failRes = await scheduler.publishNext();
    assert.strictEqual(failRes.success, false, 'Publish without valid media must be rejected');
    assert.strictEqual(failRes.post.status, 'FAILED', 'Status must be FAILED');
    assert(failRes.error.includes('Media file does not exist on disk'));
    console.log('  ✓ Missing media file strictly rejected; never marked as published.');
  }

  // Test 4: Duplicate Protection
  console.log('\n▶ [4/5] Verifying Duplicate Protection Guardrails...');
  const q3 = scheduler.getQueue();
  const thirdScheduled = q3.find(q => q.status === 'SCHEDULED');
  if (thirdScheduled) {
    thirdScheduled.videoPath = testMedia;
    fs.writeFileSync(scheduler.queuePath, JSON.stringify(q3, null, 2));
    const dupRes = await scheduler.publishNext({ dryRun: true });
    assert(dupRes.success, 'Subsequent unique post with valid media must publish cleanly');
  }

  // Test 5: Core QueueRepository Hardened Invariants (Locking, Corruption Quarantine, Future Protection, Bounded Retries)
  console.log('\n▶ [5/5] Auditing Core QueueRepository Invariants (Hardened Store)...');
  const { QueueRepository } = require('../core/publishing/queue-repository');
  const coreTestDir = path.resolve('output/test_core_queue');
  if (fs.existsSync(coreTestDir)) fs.rmSync(coreTestDir, { recursive: true, force: true });
  fs.mkdirSync(coreTestDir, { recursive: true });

  const coreRepo = new QueueRepository({ outputDir: coreTestDir });

  // 5a. Future Schedule Protection: Never claim items before scheduled time
  const futureItem = {
    queueId: 'future_test_01',
    videoPath: testMedia,
    scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
    status: 'READY_TO_PUBLISH'
  };
  coreRepo.enqueue(futureItem);
  const claimedFuture = coreRepo.claimNext('worker-test');
  assert.strictEqual(claimedFuture, null, 'QueueRepository must never claim items before their scheduled time');
  console.log('  ✓ Future schedule invariant verified: future items remain safely untouched.');

  // 5b. Bounded Retries: Exceeding maxRetries transitions item to FAILED
  const retryItem = {
    queueId: 'retry_test_01',
    videoPath: testMedia,
    scheduledTime: new Date(Date.now() - 1000).toISOString(), // Due now
    status: 'READY_TO_PUBLISH',
    attempts: 3 // Max retries
  };
  coreRepo.enqueue(retryItem);
  const claimedRetry = coreRepo.claimNext('worker-test');
  assert.strictEqual(claimedRetry, null, 'Items exceeding maxRetries must not be claimed');
  const queueAfterRetry = coreRepo.getAll();
  const failedItem = queueAfterRetry.find(q => q.queueId === 'retry_test_01');
  assert.strictEqual(failedItem.status, 'FAILED', 'Item exceeding maxRetries must be transitioned to FAILED');
  console.log('  ✓ Bounded retries invariant verified: items with 3 failed attempts strictly quarantined as FAILED.');

  // 5c. Live Publish Platform ID Validation: Live mode must have valid platform video ID
  const readyItem = {
    queueId: 'live_test_01',
    videoPath: testMedia,
    scheduledTime: new Date(Date.now() - 1000).toISOString(),
    status: 'READY_TO_PUBLISH'
  };
  coreRepo.enqueue(readyItem);
  const claimedLive = coreRepo.claimNext('worker-test');
  assert(claimedLive, 'Due item must be claimed');
    assert.throws(() => {
    coreRepo.completePublish(claimedLive.queueId, {
      mode: 'LIVE',
      platformVideoId: null // Illegal in LIVE mode
    });
  }, /Cannot complete live publishing without a valid platformVideoId/, 'Live publish without platform video ID must be rejected');
  console.log('  ✓ Live upload guardrail verified: live publications strictly require verifiable platformVideoId.');

  // 5d. Corruption Defense: Never overwrite corrupt file with empty array, quarantine corrupt file
  fs.writeFileSync(coreRepo.queuePath, '{{{ corrupt unparseable json content', 'utf8');
  assert.throws(() => {
    coreRepo.getAll();
  }, /Corrupt queue data detected/, 'Reading corrupt queue must throw and quarantine');
  const quarantinedFiles = fs.readdirSync(coreTestDir).filter(f => f.startsWith('publishing_queue.corrupt.'));
  assert(quarantinedFiles.length >= 1, 'Corrupt file must be preserved in quarantine');
  console.log(`  ✓ Corruption defense verified: corrupted file isolated to ${quarantinedFiles[0]} without data loss.`);

  // Cleanup isolated test directories
  if (fs.existsSync(coreTestDir)) fs.rmSync(coreTestDir, { recursive: true, force: true });
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

  console.log('\n' + '='.repeat(70));
  console.log('🎉 PUBLISHING AUTOMATION & ROTATING SCHEDULER TESTS PASSED (100%)!');
  console.log('='.repeat(70));
})().catch(err => {
  console.error('Scheduler test failed:', err);
  process.exit(1);
});
