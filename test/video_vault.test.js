// Unit tests for Burstpoint Persistent Video Vault
// Verifies deterministic scenario signatures, anti-repetition indexing, and uniqueness checking

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { VideoVault } = require('../core/production/video-vault');

console.log('======================================================================');
console.log('🗄️ BURSTPOINT PERSISTENT VIDEO VAULT & ANTI-REPETITION AUDIT');
console.log('======================================================================\n');

const testStorageDir = path.resolve('storage/test_video_vault');
if (fs.existsSync(testStorageDir)) {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
}

try {
  const vault = new VideoVault({ storageDir: testStorageDir });

  // 1. Initial State
  console.log('▶ [1/7] Verifying Vault Initialization & Schema...');
  const initialIndex = vault.getIndex();
  assert.strictEqual(initialIndex.vaultVersion, '1.0.0');
  assert.strictEqual(initialIndex.totalVideos, 0);
  assert.strictEqual(Array.isArray(initialIndex.videos), true);
  console.log('  ✓ Initial empty index properly formed.\n');

  // 2. Scenario Signature Determinism
  console.log('▶ [2/7] Verifying Deterministic Scenario Hashing...');
  const cfgA = {
    gameType: 'multi_race',
    seed: 40317,
    durationSeconds: 20,
    lanes: {
      left: { startBalls: 3, stages: [{ type: 'ADD', value: 3, maxHP: 20 }] },
      right: { startBalls: 12, stages: [{ type: 'MULTIPLY', value: 2, maxHP: 25 }] }
    }
  };
  const cfgB = { ...cfgA }; // Identical
  const sigA = VideoVault.computeScenarioSignature(cfgA);
  const sigB = VideoVault.computeScenarioSignature(cfgB);
  assert.strictEqual(sigA, sigB, 'Identical configs must produce identical signature');
  assert.strictEqual(typeof sigA, 'string');
  assert.strictEqual(sigA.length, 16);

  const cfgC = { ...cfgA, seed: 40318 }; // Different seed
  const sigC = VideoVault.computeScenarioSignature(cfgC);
  assert.notStrictEqual(sigA, sigC, 'Different seed must produce different signature');
  console.log(`  ✓ Signature A: ${sigA} === Signature B: ${sigB}`);
  console.log(`  ✓ Signature C (seed diff): ${sigC} !== ${sigA}\n`);

  // 3. Archiving and Retrieval
  console.log('▶ [3/7] Testing Video Archiving & Storage...');
  const record1 = vault.archiveVideo({
    clipId: 'test_clip_01',
    gameType: 'multiplying-ball-race',
    seed: 40317,
    config: cfgA,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    videoPath: 'output/test_clip_01.mp4',
    durationSeconds: 20,
    exactFrameCount: 1200,
    fileSizeMb: 12.5,
    title: 'Test Clip 1'
  });
  assert.strictEqual(vault.getIndex().totalVideos, 1);
  assert.strictEqual(vault.hasVideo({ clipId: 'test_clip_01' }), true);
  assert.strictEqual(vault.hasVideo({ sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }), true);
  console.log('  ✓ Video successfully archived and queryable by clipId and SHA-256.\n');

  // 4. Anti-Repetition Guardrails
  console.log('▶ [4/7] Testing Anti-Repetition Protection...');
  const duplicateSigCheck = vault.checkUniqueness({ config: cfgA });
  assert.strictEqual(duplicateSigCheck.isUnique, false);
  assert(duplicateSigCheck.reason.includes('DUPLICATE_SCENARIO_SIGNATURE'));

  const duplicateHashCheck = vault.checkUniqueness({
    config: cfgC,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });
  assert.strictEqual(duplicateHashCheck.isUnique, false);
  assert(duplicateHashCheck.reason.includes('DUPLICATE_MEDIA_HASH'));

  const uniqueCheck = vault.checkUniqueness({
    config: cfgC,
    sha256: '0000000000000000000000000000000000000000000000000000000000000000'
  });
  assert.strictEqual(uniqueCheck.isUnique, true);
  console.log('  ✓ Duplicate scenario signatures rejected.');
  console.log('  ✓ Duplicate media hashes rejected.');
  console.log('  ✓ Distinct scenario accepted as unique.\n');

  // 5. Statistics Reporting
  console.log('▶ [5/7] Testing Vault Statistics...');
  const stats = vault.getStats();
  assert.strictEqual(stats.totalVideos, 1);
  assert.strictEqual(stats.totalFramesRendered, 1200);
  assert.strictEqual(stats.totalStorageMb, 12.5);
  console.log('  ✓ Stats match index contents accurately.\n');

  // 6. Corruption Defense & Quarantine Test
  console.log('▶ [6/7] Testing Catalog Corruption Defense & Quarantine...');
  // Force invalid JSON into index file
  fs.writeFileSync(vault.indexPath, '{ invalid_corrupt_json: true, missing_closing_bracket: ');
  // Vault must quarantine the corrupt file and recover from backup
  const recoveredIndex = vault.getIndex();
  assert.strictEqual(recoveredIndex.totalVideos, 1, 'Vault must recover catalog from backup on corruption');
  const corruptFiles = fs.readdirSync(testStorageDir).filter(f => f.includes('vault_index.corrupt'));
  assert(corruptFiles.length >= 1, 'Corrupted index must be quarantined to a timestamped file');
  console.log(`  ✓ Corrupt index quarantined to ${corruptFiles[0]} and catalog restored from backup.\n`);

  // 7. Reconstruction from Storage
  console.log('▶ [7/7] Testing Index Reconstruction from On-Disk Media...');
  const mockMediaDir = path.join(testStorageDir, 'mock_clips');
  fs.mkdirSync(mockMediaDir, { recursive: true });
  fs.writeFileSync(path.join(mockMediaDir, 'recovered_clip_02.mp4'), Buffer.alloc(1024 * 1024 * 2)); // 2MB
  const reconResult = vault.reconstructIndexFromVault(mockMediaDir);
  assert.strictEqual(reconResult.reconstructed, 1, 'Must reconstruct missing clip from media disk');
  assert.strictEqual(vault.hasVideo({ clipId: 'recovered_clip_02' }), true);
  console.log('  ✓ Missing disk assets successfully reconstructed into catalog.\n');

  console.log('======================================================================');
  console.log('🎉 ALL VIDEO VAULT & REPETITION PREVENTION TESTS PASSED (100%)!');
  console.log('======================================================================\n');
} finally {
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
}
