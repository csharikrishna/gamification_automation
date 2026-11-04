// Core Replay Serialization & Determinism Verifier
// Verifies bit-exact reproducibility across independent execution runs.

const crypto = require('crypto');

class ReplayPackage {
  static create(gameAdapter) {
    const replay = gameAdapter.getReplay();
    const serialized = JSON.stringify(replay);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    return {
      ...replay,
      replayHash: hash,
      generatedAt: new Date().toISOString()
    };
  }

  static verifyBitExact(replayA, replayB) {
    const hashA = replayA.replayHash || crypto.createHash('sha256').update(JSON.stringify(replayA)).digest('hex');
    const hashB = replayB.replayHash || crypto.createHash('sha256').update(JSON.stringify(replayB)).digest('hex');
    return {
      identical: hashA === hashB,
      hashA,
      hashB
    };
  }
}

module.exports = { ReplayPackage };
