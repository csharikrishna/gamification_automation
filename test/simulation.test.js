const assert = require('assert');
const fs = require('fs');
const { SimulationEngine } = require('../src/engine.js');
const { MathEvaluator } = require('../src/math_evaluator.js');
const { ConfigValidator } = require('../src/config_validator.js');

console.log('🧪 RUNNING COMPREHENSIVE SIMULATION VERIFICATION TEST SUITE (P0 / P1 / MATH / AUD)...\n');

// =========================================================================
// TEST 1: P0-01 Initial Ball Count Verification (No 16-ball cap)
// =========================================================================
console.log('▶ TEST 1: P0-01 Initial Ball Count Verification');
{
  const testConfig = {
    id: 'test_pop',
    gameType: 'multi_race',
    durationSeconds: 2,
    fps: 60,
    lanes: {
      left: { startBalls: 25, stages: [] },
      right: { startBalls: 100, stages: [] }
    }
  };

  const engine = new SimulationEngine(testConfig);
  engine.update(1 / 60); // First frame spawns initial balls

  assert.strictEqual(engine.lanes.left.balls.length, 25, 'Left lane must spawn exactly 25 balls, not capped at 16!');
  assert.strictEqual(engine.lanes.right.balls.length, 100, 'Right lane must spawn exactly 100 balls, not capped at 16!');
  console.log('  ✓ PASSED: Initial balls (25 and 100) spawned without arbitrary 16-ball cap.\n');
}

// =========================================================================
// TEST 2: P0-04 & TEST-05 Subtraction Operations & Population Adjustment
// =========================================================================
console.log('▶ TEST 2: P0-04 Subtraction Operation & Despawning');
{
  const subConfig = {
    id: 'test_sub',
    gameType: 'multi_race',
    durationSeconds: 2,
    fps: 60,
    lanes: {
      left: {
        startBalls: 50,
        stages: [{ type: 'subtract', value: 20, maxHP: 1 }]
      },
      right: {
        startBalls: 10,
        stages: [{ type: 'add', value: 5, maxHP: 1 }]
      }
    }
  };

  const engine = new SimulationEngine(subConfig);
  engine.update(1 / 60);

  assert.strictEqual(engine.lanes.left.exactScore, 50);
  assert.strictEqual(engine.lanes.left.balls.length, 50);

  // Trigger subtraction tile shatter
  const tile = engine.lanes.left.tiles[0];
  engine.shatterTile(engine.lanes.left, tile);

  assert.strictEqual(engine.lanes.left.exactScore, 30, 'Score must decrease by 20 on subtract!');
  assert.strictEqual(engine.lanes.left.balls.length, 30, 'Simulated marble population must shrink from 50 to 30!');
  console.log('  ✓ PASSED: Subtraction tile applied correctly and physical marbles removed.\n');
}

// =========================================================================
// TEST 3: P0-08 Bidirectional Score Counter Interpolation
// =========================================================================
console.log('▶ TEST 3: P0-08 Decreasing Score Counter Interpolation');
{
  const testConfig = {
    id: 'test_interp',
    gameType: 'multi_race',
    durationSeconds: 2,
    fps: 60,
    lanes: {
      left: { startBalls: 50, stages: [] },
      right: { startBalls: 10, stages: [] }
    }
  };

  const engine = new SimulationEngine(testConfig);
  engine.update(1 / 60);

  // Force score decrease
  const lane = engine.lanes.left;
  lane.displayScore = 50;
  lane.exactScore = 20; // Score dropped

  engine.update(1 / 60);

  assert(lane.displayScore < 50, `Display score (${lane.displayScore}) must decrement downward towards 20!`);
  assert(lane.displayScore >= 20, `Display score must not overshoot below exact score!`);
  console.log(`  ✓ PASSED: Score interpolated downward smoothly (${lane.displayScore} < 50).\n`);
}

// =========================================================================
// TEST 4: P0-05 & PHY-10 Configurable Physics
// =========================================================================
console.log('▶ TEST 4: P0-05 Configurable Physics Parameter Verification');
{
  const customPhysConfig = {
    id: 'test_phys',
    gameType: 'multi_race',
    durationSeconds: 2,
    fps: 60,
    physics: {
      gravity: 1200,
      tileBounce: 0.95,
      pegBounce: 0.90,
      wallBounce: 0.85,
      airResistance: 0.995,
      ballRestitution: 0.92,
      substeps: 4
    },
    lanes: {
      left: { startBalls: 5, stages: [] },
      right: { startBalls: 5, stages: [] }
    }
  };

  const engine = new SimulationEngine(customPhysConfig);

  assert.strictEqual(engine.gravity, 1200, 'Custom gravity must be respected!');
  assert.strictEqual(engine.tileBounce, 0.95, 'Custom tileBounce must be respected!');
  assert.strictEqual(engine.substeps, 4, 'Custom substeps must be respected!');
  console.log('  ✓ PASSED: Physics parameters read from configuration rather than hardcoded.\n');
}

// =========================================================================
// TEST 5: P0-07 & TEST-06 Simultaneous Finish Unbiased Resolution
// =========================================================================
console.log('▶ TEST 5: P0-07 Simultaneous Finish Unbiased Resolution');
{
  const finishConfig = {
    id: 'test_simul',
    gameType: 'multi_race',
    durationSeconds: 5,
    fps: 60,
    lanes: {
      left: { startBalls: 10, stages: [{ maxHP: 1 }] },
      right: { startBalls: 50, stages: [{ maxHP: 1 }] }
    }
  };

  const engine = new SimulationEngine(finishConfig);
  engine.update(1 / 60);

  // Both break all tiles and touch bottom in the same frame
  engine.lanes.left.tiles[0].intact = false;
  engine.lanes.left.reachedBottom = true;
  engine.lanes.left.finishedTime = 1.50;
  engine.lanes.left.exactScore = 10;

  engine.lanes.right.tiles[0].intact = false;
  engine.lanes.right.reachedBottom = true;
  engine.lanes.right.finishedTime = 1.50;
  engine.lanes.right.exactScore = 50; // Higher score!

  engine.evaluateRaceResolution(1 / 60);

  assert(engine.winner, 'Winner must be resolved!');
  assert.strictEqual(engine.winner.side, 'right', 'Right lane with higher score (50 vs 10) must win despite left being iterated first!');
  console.log('  ✓ PASSED: Simultaneous finish awarded to higher score without left-lane bias.\n');
}

// =========================================================================
// TEST 6: P0-09 & TEST-08 Configuration Schema Validation
// =========================================================================
console.log('▶ TEST 6: P0-09 Configuration Schema Validation');
{
  assert.throws(() => {
    ConfigValidator.validate(null);
  }, /valid JSON object/);

  assert.throws(() => {
    ConfigValidator.validate({
      lanes: {
        left: { startBalls: 1, stages: [{ type: 'unsupported_op' }] },
        right: { startBalls: 12 }
      }
    });
  }, /unsupported operation/);

  assert.throws(() => {
    ConfigValidator.validate({
      durationSeconds: -5,
      lanes: {
        left: { startBalls: 1 },
        right: { startBalls: 12 }
      }
    });
  }, /Invalid durationSeconds/);

  console.log('  ✓ PASSED: Schema validator catches null configs, negative durations, and invalid operations.\n');
}

// =========================================================================
// TEST 7: PHY-01..PHY-05 & TEST-03 Seeded PRNG Determinism & Reproducibility
// =========================================================================
console.log('▶ TEST 7: Seeded PRNG Determinism (Bit-Exact Multi-Run)');
{
  const testConfig = JSON.parse(fs.readFileSync('./configs/underdog_slow_composed.json', 'utf8'));
  testConfig.seed = 4242;

  const engine1 = new SimulationEngine(testConfig);
  const engine2 = new SimulationEngine(testConfig);

  const dt = 1 / 60;
  for (let f = 0; f < 240; f++) {
    engine1.update(dt);
    engine2.update(dt);
  }

  // Verify bit-exact ball coordinates across both runs
  assert.strictEqual(engine1.lanes.left.balls.length, engine2.lanes.left.balls.length);
  for (let i = 0; i < engine1.lanes.left.balls.length; i++) {
    const b1 = engine1.lanes.left.balls[i];
    const b2 = engine2.lanes.left.balls[i];
    assert.strictEqual(b1.x, b2.x, `Ball ${i} X must be bit-exact!`);
    assert.strictEqual(b1.y, b2.y, `Ball ${i} Y must be bit-exact!`);
    assert.strictEqual(b1.vx, b2.vx, `Ball ${i} Vx must be bit-exact!`);
    assert.strictEqual(b1.vy, b2.vy, `Ball ${i} Vy must be bit-exact!`);
  }
  console.log('  ✓ PASSED: Two independent simulation runs with seed=4242 are 100% bit-exact identical!\n');
}

// =========================================================================
// TEST 8: MATH-01 Fibonacci Indexing & Formula Parser Validation
// =========================================================================
console.log('▶ TEST 8: MATH-01 Fibonacci Indexing & Math Evaluator Precision');
{
  // Standard Fibonacci: F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8
  assert.strictEqual(MathEvaluator.fibonacci(1), 1, 'F(1) must be 1');
  assert.strictEqual(MathEvaluator.fibonacci(2), 1, 'F(2) must be 1');
  assert.strictEqual(MathEvaluator.fibonacci(3), 2, 'F(3) must be 2');
  assert.strictEqual(MathEvaluator.fibonacci(4), 3, 'F(4) must be 3');
  assert.strictEqual(MathEvaluator.fibonacci(5), 5, 'F(5) must be 5');
  assert.strictEqual(MathEvaluator.fibonacci(6), 8, 'F(6) must be 8');

  // MATH-02..MATH-05: Handle 0, negative, decimals, and reject malicious strings
  assert.strictEqual(MathEvaluator.evalFormula('n - 1', 1), 0, 'Must allow 0 result');
  assert.strictEqual(MathEvaluator.evalFormula('n * 0.5', 4), 2, 'Must allow decimals');
  assert.strictEqual(MathEvaluator.evalFormula('2 ^ 3', 1), 8, 'Exponentiation must work');

  // Division by zero security test
  assert.throws(() => {
    MathEvaluator.evalFormula('10 / 0', 1);
  }, /Division by zero/);

  // Malformed expression test
  assert.throws(() => {
    MathEvaluator.evalFormula('2 + * 3', 1);
  }, /Unexpected token/);

  // Malicious string & code injection rejection
  assert.throws(() => {
    MathEvaluator.evalFormula('process.exit()', 1);
  }, /Invalid mathematical characters/);

  assert.throws(() => {
    MathEvaluator.evalFormula('require("fs")', 1);
  }, /Invalid mathematical characters/);

  console.log('  ✓ PASSED: Fibonacci indexing, safe AST evaluator, division-by-zero, and security boundaries verified.\n');
}

// =========================================================================
// TEST 9: Full Underdog Race Strict Chronological Causality
// =========================================================================
console.log('▶ TEST 9: Underdog Slow Composed Race Causality Verification');
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

  console.log(`  ✓ Tier 6 shattered at: ${gate5Time.toFixed(3)}s`);
  console.log(`  ✓ Marbles landed in reservoir at: ${finishTime.toFixed(3)}s`);
  console.log(`  ✓ Celebration banner started at: ${bannerStartTime.toFixed(3)}s`);
  console.log('  PASSED: Shatter → Reservoir Contact → Celebration strictly preserved.\n');
}

// =========================================================================
// TEST 10: AUD-02 Waveform-Level Dynamic Ducking Amplitude Verification
// =========================================================================
console.log('▶ TEST 10: AUD-02 Waveform-Level Dynamic Ducking Amplitude Verification');
{
  const { AudioSynthesizer } = require('../core/audio/audio-mixer.js');
  const synth = new AudioSynthesizer(44100);
  const total = 44100;

  // 1. Verify Multiplication Chime Ducking
  const leftMultAlone = new Float32Array(total);
  const rightMultAlone = new Float32Array(total);
  synth.renderMultiplication(leftMultAlone, rightMultAlone, 1000, 6, 0.7, 0.7, null);

  const breakthroughEnv = new Float32Array(total);
  breakthroughEnv.fill(0.35); // -9dB during breakthrough
  const leftMultDucked = new Float32Array(total);
  const rightMultDucked = new Float32Array(total);
  synth.renderMultiplication(leftMultDucked, rightMultDucked, 1000, 6, 0.7, 0.7, breakthroughEnv);

  let peakMultAlone = 0, peakMultDucked = 0;
  for (let i = 0; i < total; i++) {
    if (Math.abs(leftMultAlone[i]) > peakMultAlone) peakMultAlone = Math.abs(leftMultAlone[i]);
    if (Math.abs(leftMultDucked[i]) > peakMultDucked) peakMultDucked = Math.abs(leftMultDucked[i]);
  }
  const multRatio = peakMultDucked / peakMultAlone;
  assert(Math.abs(multRatio - 0.35) < 0.005, `Multiplication ducked ratio (${multRatio}) must match 0.35 envelope!`);

  // 2. Verify Gate Chime Ducking During Fanfare
  const leftChimeAlone = new Float32Array(total);
  const rightChimeAlone = new Float32Array(total);
  synth.renderChime(leftChimeAlone, rightChimeAlone, 1000, 300, 0.5, 0.7, 0.7, false, null);

  const fanfareEnv = new Float32Array(total);
  fanfareEnv.fill(0.20); // -14dB during fanfare
  const leftChimeDucked = new Float32Array(total);
  const rightChimeDucked = new Float32Array(total);
  synth.renderChime(leftChimeDucked, rightChimeDucked, 1000, 300, 0.5, 0.7, 0.7, false, fanfareEnv);

  let peakChimeAlone = 0, peakChimeDucked = 0;
  for (let i = 0; i < total; i++) {
    if (Math.abs(leftChimeAlone[i]) > peakChimeAlone) peakChimeAlone = Math.abs(leftChimeAlone[i]);
    if (Math.abs(leftChimeDucked[i]) > peakChimeDucked) peakChimeDucked = Math.abs(leftChimeDucked[i]);
  }
  const chimeRatio = peakChimeDucked / peakChimeAlone;
  assert(Math.abs(chimeRatio - 0.20) < 0.005, `Gate chime ducked ratio (${chimeRatio}) must match 0.20 envelope!`);

  console.log(`  ✓ Multiplication ducked ratio: ${(multRatio * 100).toFixed(1)}% (expected 35.0%)`);
  console.log(`  ✓ Gate chime fanfare ducked ratio: ${(chimeRatio * 100).toFixed(1)}% (expected 20.0%)`);
  console.log('  PASSED: Sample-level dynamic ducking verified at waveform amplitude precision.\n');
}

console.log('🎉 ALL 10 COMPREHENSIVE SIMULATION AND REGRESSION TEST SUITES PASSED (100%)!');
