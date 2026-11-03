const assert = require('assert');
const fs = require('fs');
const { SimulationEngine } = require('../src/engine.js');
const { MathEvaluator } = require('../src/math_evaluator.js');

console.log('🧪 RUNNING SIMULATION LOGICAL VERIFICATION TEST SUITE...\n');

// =========================================================================
// TEST 1: Strict Chronological Causality (Shatter -> Drop -> Reservoir -> Banner)
// =========================================================================
console.log('▶ TEST 1: Strict Chronological Causality Verification');
{
  const config = JSON.parse(fs.readFileSync('./configs/underdog_slow_composed.json', 'utf8'));
  const engine = new SimulationEngine(config);
  const dt = 1 / 60;

  let gate5Time = null;
  let finishTime = null;
  let bannerStartTime = null;

  for (let f = 0; f < engine.totalFrames; f++) {
    engine.update(dt);

    const gate5 = engine.events.find(e => e.type === 'gate' && e.tier === 5);
    if (gate5 && gate5Time === null) {
      gate5Time = gate5.time;
    }

    const finish = engine.events.find(e => e.type === 'finish');
    if (finish && finishTime === null) {
      finishTime = finish.time;
    }

    if (engine.winnerBannerAlpha > 0 && bannerStartTime === null) {
      bannerStartTime = engine.simTime;
    }
  }

  assert(gate5Time !== null, 'Tier 6 barrier must shatter!');
  assert(finishTime !== null, 'Finish event must trigger after balls land in reservoir!');
  assert(gate5Time < finishTime, `Shatter (${gate5Time.toFixed(3)}s) must occur BEFORE finish (${finishTime.toFixed(3)}s)!`);
  assert(finishTime < bannerStartTime, `Finish (${finishTime.toFixed(3)}s) must occur BEFORE banner fade-in (${bannerStartTime.toFixed(3)}s)!`);

  const left = engine.lanes.left;
  const right = engine.lanes.right;

  assert.strictEqual(left.reachedBottom, true, 'Left lane must reach reservoir bottom!');
  assert.strictEqual(left.tiles[5].intact, false, 'Left lane final tile must be broken!');
  assert.strictEqual(right.reachedBottom, false, 'Right lane must NOT reach bottom!');
  assert.strictEqual(right.tiles[5].intact, true, 'Right lane final tile must remain intact (trapped)!');

  console.log(`  ✓ Tier 6 shattered at: ${gate5Time.toFixed(3)}s`);
  console.log(`  ✓ Marbles landed in reservoir at: ${finishTime.toFixed(3)}s`);
  console.log(`  ✓ Celebration banner started at: ${bannerStartTime.toFixed(3)}s`);
  console.log('  PASSED: Celebration strictly occurs AFTER last tile breaks and marbles land.\n');
}

// =========================================================================
// TEST 2: Exact 1-to-1 Ball Inventory Match
// =========================================================================
console.log('▶ TEST 2: Exact 1-to-1 Ball Inventory Verification');
{
  const config = JSON.parse(fs.readFileSync('./configs/underdog_slow_composed.json', 'utf8'));
  const engine = new SimulationEngine(config);
  const dt = 1 / 60;

  for (let f = 0; f < 300; f++) engine.update(dt);

  // Both lanes must maintain ball count <= scoreboard target
  for (const side of ['left', 'right']) {
    const lane = engine.lanes[side];
    const target = Math.min(100, lane.exactScore);
    assert.strictEqual(lane.balls.length, target, `${side} ball array length (${lane.balls.length}) must match target (${target})!`);
  }
  console.log('  PASSED: Visual ball count matches mathematical score.\n');
}

// =========================================================================
// TEST 3: Math Evaluator Multi-Formula Showdowns
// =========================================================================
console.log('▶ TEST 3: Mathematical Showdown Asynchronous Durability');
{
  const config = MathEvaluator.generateEquationConfig('n!_vs_n^n');
  const engine = new SimulationEngine(config);
  const dt = 1 / 60;

  for (let f = 0; f < engine.totalFrames; f++) engine.update(dt);

  assert(engine.winner, 'Winner must be established for n! vs n^n!');
  assert.strictEqual(engine.winner.side, 'right', 'Hyper-power n^n must defeat n!!');
  assert.strictEqual(engine.lanes.right.reachedBottom, true, 'n^n must reach the bottom floor!');
  console.log(`  ✓ Winner: ${engine.winner.name} finished at ${engine.winner.finishTime.toFixed(2)}s`);
  console.log('  PASSED: Mathematical evaluation engine verified.\n');
}

console.log('🎉 ALL LOGICAL VERIFICATION TESTS PASSED SUCCESSFULLY!');
