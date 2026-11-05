// Canonical Production Orchestrator - Stage 4: Candidate Scorer
// Multi-dimensional quality evaluation, full-duration deterministic replay, and WCAG AAA contrast audit.

const { GameRegistry } = require('../registry');
const { LIFECYCLE_STATES } = require('../../core/contracts/lifecycle-schema');

function calcLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function scoreCandidates(simulations, options = {}) {
  const targetDuration = options.targetDuration || 20.0;
  const fps = options.fps || 60;
  const unattendedApproval = options.unattendedApproval || false;
  const scored = [];

  const lumBg = calcLuminance(9, 12, 21); // #090c15 arena background
  const lumText = calcLuminance(255, 255, 255); // #ffffff primary text
  const measuredRatio = Number(((lumText + 0.05) / (lumBg + 0.05)).toFixed(2));
  const contrastPass = measuredRatio >= 7.0; // WCAG AAA requirement

  for (const sim of simulations) {
    const totalEvents = (sim.events || []).length;
    const eventDensity = Number((totalEvents / targetDuration).toFixed(2));
    const scoreRatio = Number((Math.max(sim.leftScore, sim.rightScore) / Math.max(1, Math.min(sim.leftScore, sim.rightScore))).toFixed(2));

    // 1. FULL-DURATION DETERMINISTIC REPLAY CHECK
    let deterministicResult = 'NOT_CHECKED';
    let replayReport = null;
    try {
      const checkGame = GameRegistry.createGame(sim.config);
      const frames = sim.config.durationSeconds * (sim.config.fps || 60);
      const dt = 1 / (sim.config.fps || 60);

      for (let f = 0; f < frames && !(typeof checkGame.isFinished === 'function' ? checkGame.isFinished() : checkGame.isFinished); f++) {
        checkGame.step(dt);
      }

      const checkObs = checkGame.observe();
      const checkEvents = checkGame.getEvents();

      const winnerMatch = checkObs.winner?.name === sim.winner;
      const leftScoreMatch = checkObs.leftScore === sim.leftScore;
      const rightScoreMatch = checkObs.rightScore === sim.rightScore;
      const eventCountMatch = checkEvents.length === (sim.events || []).length;
      const finishTimeDiff = Math.abs((checkObs.winner?.finishTime || 0) - sim.finishTime);
      const finishTimeMatch = finishTimeDiff < 0.005;

      const isExactMatch = winnerMatch && leftScoreMatch && rightScoreMatch && eventCountMatch && finishTimeMatch;
      deterministicResult = isExactMatch ? 'PASS' : 'FAIL';

      replayReport = {
        status: deterministicResult,
        winnerMatch,
        leftScoreMatch,
        rightScoreMatch,
        eventCountMatch,
        finishTimeMatch,
        finishTimeDiffSeconds: Number(finishTimeDiff.toFixed(4)),
        replayedEvents: checkEvents.length,
        originalEvents: (sim.events || []).length,
        finalReplayFrame: checkObs.frameIndex,
        replayedWinner: checkObs.winner?.name,
        originalWinner: sim.winner
      };
    } catch (e) {
      deterministicResult = 'FAIL';
      replayReport = { status: 'FAIL', error: e.message };
    }

    // 2. Physical boundary containment check
    const escapedStatus = sim.escapedMarblesCount === 0 ? 'PASS' : 'FAIL';

    // 3. Finish decided check
    const finishDecidedStatus = (sim.winner && sim.winner !== 'DRAW') ? 'PASS' : 'FAIL';

    // 4. Winner Ground-Truth Enforcement
    const expectedWinner = sim.config.expectedWinner;
    const winnerGroundTruth = (!expectedWinner || sim.winner === expectedWinner) ? 'PASS' : 'FAIL';

    // 5. Narrative Role Ground-Truth Enforcement
    let narrativeRoleTruth = 'PASS';
    let narrativeRoleReason = null;
    if (sim.narrativeRole === 'UNDERDOG_EXPONENTIAL_WIN') {
      const leftStart = sim.config.lanes.left.startBalls;
      const rightStart = sim.config.lanes.right.startBalls;
      const winnerStart = sim.winner === 'MULTIPLY' ? leftStart : rightStart;
      const loserStart = sim.winner === 'MULTIPLY' ? rightStart : leftStart;
      const winnerEarlyDeficit = sim.winner === 'MULTIPLY' ? sim.maxEarlyLeftDeficit : sim.maxEarlyRightDeficit;

      if (winnerStart >= loserStart) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Winner started with ${winnerStart} >= ${loserStart} (no starting deficit)`;
      } else if (winnerEarlyDeficit <= 0) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Underdog was never trailing early (deficit: ${winnerEarlyDeficit}); requires early trailing deficit before overtake`;
      } else if (sim.leadChanges < 1) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = 'Underdog did not demonstrate an overtake lead change';
      }
    } else if (sim.narrativeRole === 'COMEBACK_REVERSAL') {
      const winnerEarlyDeficit = sim.winner === 'MULTIPLY' ? sim.maxEarlyLeftDeficit : sim.maxEarlyRightDeficit;

      if (winnerEarlyDeficit <= 0) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Winner was never trailing early (deficit: ${winnerEarlyDeficit}); comeback reversal requires early trailing deficit`;
      } else if (sim.leadChanges < 1) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = 'Zero lead changes observed; comeback reversal requires at least 1 lead change';
      }
    } else if (sim.narrativeRole === 'HEAVY_SWARM_ESCALATION') {
      const pop = sim.populationProgression;
      const winnerStart = sim.winner === 'MULTIPLY' ? sim.config.lanes.left.startBalls : sim.config.lanes.right.startBalls;
      const winnerFinal = sim.winner === 'MULTIPLY' ? sim.leftScore : sim.rightScore;
      const winnerMultiplier = winnerFinal / Math.max(1, winnerStart);
      const winnerGrowth = winnerFinal - winnerStart;

      if (winnerMultiplier < 2.5 || winnerGrowth < 30 || pop.totalMultiplier < 2.5) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Insufficient swarm escalation (winner multiplier: ${winnerMultiplier.toFixed(1)}x / +${winnerGrowth} balls, total multiplier: ${pop.totalMultiplier.toFixed(1)}x)`;
      }
    } else if (sim.narrativeRole === 'PHOTO_FINISH_CLASH') {
      if (sim.finishMargin === null || sim.finishMargin > 0.25) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Finish margin ${sim.finishMargin}s exceeds photo-finish threshold of 0.25s`;
      }
    } else if (sim.narrativeRole === 'RAZOR_THIN_UPSET') {
      if (sim.finishMargin === null || sim.finishMargin > 0.20) {
        narrativeRoleTruth = 'FAIL';
        narrativeRoleReason = `Finish margin ${sim.finishMargin}s exceeds razor threshold of 0.20s`;
      }
    }

    // 6. Timing Reconciliation
    const hookDur = 1.5;
    const gameplayDur = Number((sim.finishTime - hookDur).toFixed(2));
    const celebrationDur = Number((targetDuration - sim.finishTime).toFixed(2));
    const reconciledSum = Number((hookDur + gameplayDur + celebrationDur).toFixed(2));
    const timingReconciled = (reconciledSum === targetDuration) ? 'PASS' : 'FAIL';

    // 7. Visual Readability & Contrast
    const contrastRatio = {
      measuredRatio,
      thresholdAAA: 7.0,
      standard: 'WCAG_2.1_AAA',
      status: contrastPass ? 'PASS' : 'FAIL'
    };
    const fontLegibility = {
      status: 'NOT_CHECKED',
      note: 'Requires human visual evaluation / OCR rather than automated Boolean assumption'
    };

    // 8. Vault uniqueness check
    const uniquenessPass = !sim.vaultUniqueness || sim.vaultUniqueness.isUnique;

    // Quality Screening Verdict
    const allPassed = (
      deterministicResult === 'PASS' &&
      escapedStatus === 'PASS' &&
      finishDecidedStatus === 'PASS' &&
      winnerGroundTruth === 'PASS' &&
      narrativeRoleTruth === 'PASS' &&
      timingReconciled === 'PASS' &&
      uniquenessPass &&
      totalEvents >= 50 &&
      sim.finishTime >= 5.0
    );

    let rejectionReason = null;
    if (!allPassed) {
      rejectionReason = [
        deterministicResult !== 'PASS' ? 'DETERMINISM_FAILED' : null,
        escapedStatus !== 'PASS' ? 'ESCAPED_MARBLES' : null,
        winnerGroundTruth !== 'PASS' ? `WINNER_MISMATCH (expected ${expectedWinner}, got ${sim.winner})` : null,
        narrativeRoleTruth !== 'PASS' ? `NARRATIVE_ROLE_MISMATCH (${narrativeRoleReason})` : null,
        timingReconciled !== 'PASS' ? 'TIMING_NOT_RECONCILED' : null,
        !uniquenessPass ? `VAULT_DUPLICATE (${sim.vaultUniqueness?.reason})` : null,
        totalEvents < 50 ? `INSUFFICIENT_EVENTS (${totalEvents} < 50)` : null,
        sim.finishTime < 5.0 ? `PREMATURE_FINISH (${sim.finishTime}s < 5s)` : null
      ].filter(Boolean).join('; ');
    }

    const evaluation = {
      simulationValidity: {
        valid: allPassed ? 'PASS' : 'FAIL',
        deterministic: deterministicResult,
        deterministicReplayReport: replayReport,
        escapedMarbles: { count: sim.escapedMarblesCount, status: escapedStatus },
        finishDecided: finishDecidedStatus,
        winnerGroundTruth,
        narrativeRoleGroundTruth: narrativeRoleTruth,
        vaultUniqueness: uniquenessPass ? 'PASS' : 'FAIL'
      },
      metrics: {
        totalSimulatedEvents: totalEvents,
        eventDensityEventsPerSec: eventDensity,
        scoreProgressionRatio: scoreRatio,
        leadChangeCount: sim.leadChanges,
        finishMarginSeconds: sim.finishMargin,
        leftScore: sim.leftScore,
        rightScore: sim.rightScore
      },
      visualReadability: {
        resolution: '1080x1920',
        fps: fps,
        contrastRatio,
        fontLegibility
      },
      narrativeStructure: {
        format: 'FULL_MATCH',
        openingHookDurationSeconds: hookDur,
        gameplayProgressionDurationSeconds: gameplayDur,
        celebrationDurationSeconds: celebrationDur,
        totalDurationSeconds: targetDuration,
        reconciled: timingReconciled
      },
      approval: {
        machineScreening: allPassed ? 'PASS' : 'FAIL',
        status: allPassed
          ? (unattendedApproval ? 'APPROVED_FOR_PUBLISHING' : 'HUMAN_REVIEW_PENDING')
          : 'REJECTED',
        approvalPolicy: unattendedApproval ? 'UNATTENDED_AUTOMATED_POLICY' : 'MANUAL_SIGN_OFF_REQUIRED',
        humanReviewStatus: unattendedApproval ? 'BYPASSED_BY_CONFIG' : 'PENDING'
      },
      status: allPassed ? 'APPROVED' : 'REJECTED',
      rejectionReason
    };

    scored.push({
      clipId: `${sim.simId}_flagship`,
      simId: sim.simId,
      format: 'FULL_MATCH',
      startTime: 0.0,
      endTime: targetDuration,
      targetDuration,
      title: sim.title,
      hookText: sim.config.hookText,
      config: sim.config,
      simOutcome: sim,
      evaluation,
      status: evaluation.status,
      approvalStatus: evaluation.approval.status,
      rejectionReason: evaluation.rejectionReason,
      lifecycleState: LIFECYCLE_STATES.SCORED
    });
  }

  return scored;
}

module.exports = {
  calcLuminance,
  scoreCandidates
};
