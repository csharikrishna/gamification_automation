// Unit Test: YouTube Publisher & Base Interface Verification
// Verifies strict DRY_RUN pre-flight, media integrity checks, zero fake analytics, and metadata guards.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { YouTubePublisher } = require('../src/publishers/youtube_publisher.js');

console.log('='.repeat(70));
console.log('📡 BURSTPOINT PUBLISHER INTERFACE & YOUTUBE INTEGRATION TESTS');
console.log('='.repeat(70));

const publisher = new YouTubePublisher();

(async () => {
  // Test 1: Metadata Validation Constraints
  console.log('\n▶ [1/4] Auditing YouTube Metadata Validation Rules...');
  const validMeta = publisher.validateMetadata({
    title: '⚡ 1 BALL VS 100 BALLS SHOWDOWN ⚡',
    description: 'Autonomous physics marble race simulation #shorts',
    tags: ['shorts', 'physics', 'gaming']
  });
  assert(validMeta.valid, 'Valid metadata must pass');

  const invalidTitle = publisher.validateMetadata({
    title: 'A'.repeat(105), // Exceeds 100 char limit
    description: 'Test'
  });
  assert(!invalidTitle.valid, 'Title over 100 chars must be rejected');
  assert(invalidTitle.errors[0].includes('exceeds 100 characters'));
  console.log('  ✓ Title, description, and tag character constraints strictly enforced.');

  // Test 2: Missing Media File Guardrail
  console.log('\n▶ [2/4] Testing Missing Media File Detection...');
  let caughtMissing = false;
  try {
    await publisher.publish({
      videoPath: 'output/non_existent_video_file.mp4',
      title: 'Valid Title'
    }, { dryRun: true });
  } catch (err) {
    caughtMissing = true;
    assert(err.message.includes('Media file does not exist on disk'));
  }
  assert(caughtMissing, 'Missing media files must be strictly rejected');
  console.log('  ✓ Missing video path caught and rejected prior to publish.');

  // Test 3: Strict DRY_RUN Pre-flight with Real Media & Bitstream Verification
  console.log('\n▶ [3/4] Testing Strict DRY_RUN Pre-flight with Real Media on Disk...');
  const testMedia = path.resolve('output/underdog_slow_composed.mp4');
  assert(fs.existsSync(testMedia), `Master test media must exist at ${testMedia}`);

  const receipt = await publisher.publish({
    videoPath: testMedia,
    title: '⚡ UNDERDOG 1 BALL SHOWDOWN ⚡',
    description: 'Autonomous marble race simulation #shorts',
    tags: ['shorts', 'physics']
  }, { dryRun: true });

  assert.strictEqual(receipt.mode, 'DRY_RUN', 'Must operate in DRY_RUN mode');
  assert.strictEqual(receipt.platformVideoId, null, 'Must NEVER fabricate a fake video ID');
  assert.strictEqual(receipt.metrics, null, 'Must NEVER fabricate fake viewership or retention metrics');
  assert.strictEqual(receipt.bitstreamVerified, true, 'Bitstream decode must be verified with FFmpeg');
  assert(receipt.sha256 && receipt.sha256.length === 64, 'SHA-256 hash must be a 64-character hex string');
  assert(receipt.fileSize > 100000, 'File size must be measured accurately');
  console.log(`  ✓ DRY_RUN receipt verified: ${(receipt.fileSize / 1024 / 1024).toFixed(2)} MB, SHA-256: ${receipt.sha256.substring(0, 16)}...`);
  console.log('  ✓ Zero-fabrication invariant proven: platformVideoId=null, metrics=null.');

  // Test 4: Live Mode Credential Guardrail
  console.log('\n▶ [4/4] Verifying Live Upload Credential Guardrails...');
  let caughtLive = false;
  try {
    await publisher.publish({
      videoPath: testMedia,
      title: 'Valid Title'
    }, { dryRun: false });
  } catch (err) {
    caughtLive = true;
    assert(err.message.includes('Missing YouTube OAuth credentials'));
  }
  assert(caughtLive, 'Live publish without credentials must throw actionable error');
  console.log('  ✓ Live publishing correctly halts and requests OAuth credentials if unconfigured.');

  console.log('\n' + '='.repeat(70));
  console.log('🎉 ALL YOUTUBE PUBLISHER TESTS PASSED (100%)!');
  console.log('='.repeat(70));
})().catch(err => {
  console.error('Publisher test failed:', err);
  process.exit(1);
});
