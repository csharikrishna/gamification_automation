// Canonical Production Orchestrator - Stage 2: Simulation Runner
// Executes seeded deterministic simulation with trajectory logging, boundary audit, and lead change tracking.

const assert = require('assert');
const { GameRegistry } = require('../registry');
const { LIFECYCLE_STATES } = require('../../core/contracts/lifecycle-schema');

function simulateScenarios(configs) {
  const results = [];
  for (const cfg of configs) {
    const game = GameRegistry.createGame(cfg);
    const frames = cfg.durationSeconds * (cfg.fps || 60);
    const dt = 1 / (cfg.fps || 60);

    let leadChanges = 0;
    let lastLeader = null;
    let escapedMarblesCount = 0;
    let maxEarlyLeftDeficit = 0;
    let maxEarlyRightDeficit = 0;
    const timelineEvents = [];

    for (let f = 0; f < frames; f++) {
      game.step(dt);

      const obs = game.observe();
      const lTier = obs.leftTier;
      const rTier = obs.rightTier;
      let currentLeader = lTier > rTier ? 'MULTIPLY' : (rTier > lTier ? 'ADD' : 'TIED');
      if (currentLeader === 'TIED') {
        currentLeader = obs.leftScore > obs.rightScore ? 'MULTIPLY'
          : (obs.rightScore > obs.leftScore ? 'ADD' : 'TIED');
      }

      if (currentLeader !== 'TIED' && currentLeader !== lastLeader && lastLeader !== null) {
        leadChanges++;
        timelineEvents.push({
          time: Number(obs.simTime.toFixed(2)),
          event: 'LEAD_CHANGE',
          previousLeader: lastLeader,
          newLeader: currentLeader
        });
      }
      if (currentLeader !== 'TIED') lastLeader = currentLeader;

      // Track early score deficit before mid-game (early 6.0s)
      if (obs.simTime <= 6.0) {
        const leftDeficit = obs.rightScore - obs.leftScore;
        const rightDeficit = obs.leftScore - obs.rightScore;
        if (leftDeficit > maxEarlyLeftDeficit) maxEarlyLeftDeficit = leftDeficit;
        if (rightDeficit > maxEarlyRightDeficit) maxEarlyRightDeficit = rightDeficit;
      }

      // Boundary containment audit on all active physical marbles
      const leftBalls = game.engine?.lanes?.left?.balls || [];
      const rightBalls = game.engine?.lanes?.right?.balls || [];
      for (let b = 0; b < leftBalls.length; b++) {
        const ball = leftBalls[b];
        if (ball.x < -10 || ball.x > 1090 || ball.y < -100 || ball.y > 2000) escapedMarblesCount++;
      }
      for (let b = 0; b < rightBalls.length; b++) {
        const ball = rightBalls[b];
        if (ball.x < -10 || ball.x > 1090 || ball.y < -100 || ball.y > 2000) escapedMarblesCount++;
      }
    }

    const isDone = typeof game.isFinished === 'function' ? game.isFinished() : !!game.isFinished;
    assert(isDone || game.simTime >= cfg.durationSeconds, `Scenario ${cfg.id} must conclude.`);
    const obs = game.observe();

    const lFinish = game.engine?.lanes?.left?.finishedTime || null;
    const rFinish = game.engine?.lanes?.right?.finishedTime || null;
    const finishMargin = (lFinish && rFinish) ? Number(Math.abs(lFinish - rFinish).toFixed(2)) : null;

    // Track population progression across tiers
    const leftStart = cfg.lanes.left.startBalls;
    const rightStart = cfg.lanes.right.startBalls;
    const totalStart = leftStart + rightStart;
    const totalFinal = obs.leftScore + obs.rightScore;
    const totalMultiplier = Number((totalFinal / Math.max(1, totalStart)).toFixed(2));
    const totalGrowth = totalFinal - totalStart;
    const populationProgression = {
      leftStart,
      rightStart,
      totalStart,
      leftFinal: obs.leftScore,
      rightFinal: obs.rightScore,
      totalFinal,
      totalMultiplier,
      totalGrowth
    };

    // Reconcile dynamic title with actual verified finish margin if applicable
    let finalTitle = cfg.title;
    if (finishMargin !== null && finalTitle.includes('UPSET VICTORY')) {
      finalTitle = `🏆 FINAL TIER SHOWDOWN: ${finishMargin.toFixed(2)}s UPSET VICTORY 🏆`;
    }

    results.push({
      simId: cfg.id,
      archetypeId: cfg.archetypeId,
      narrativeRole: cfg.narrativeRole,
      seed: cfg.seed,
      title: finalTitle,
      status: 'COMPLETED',
      finishTime: Number((obs.winner?.finishTime || cfg.durationSeconds).toFixed(2)),
      winner: obs.winner?.name || 'DRAW',
      winningScore: obs.winner?.winningScore || 0,
      losingScore: obs.winner?.losingScore || 0,
      leftScore: obs.leftScore,
      rightScore: obs.rightScore,
      leftMetrics: obs.leftMetrics,
      rightMetrics: obs.rightMetrics,
      leadChanges,
      finishMargin,
      maxEarlyLeftDeficit,
      maxEarlyRightDeficit,
      populationProgression,
      escapedMarblesCount,
      timelineEvents,
      totalEvents: game.getEvents().length,
      events: game.getEvents(),
      config: cfg,
      lifecycleState: LIFECYCLE_STATES.SIMULATED
    });
  }
  return results;
}

module.exports = {
  simulateScenarios
};
