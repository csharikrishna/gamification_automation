// Multiplying Ball Race - Scoring & Stage Mechanics
// Manages smooth score interpolation, stage health tracking, and unbiased finish evaluation.

class ScoringSystem {
  // Bidirectional score interpolation (P0-08, RACE-09)
  static interpolateScore(lane, dt) {
    if (lane.displayScore !== lane.exactScore) {
      const diff = lane.exactScore - lane.displayScore;
      const speed = Math.max(1, Math.abs(diff) * 12);
      if (diff > 0) {
        lane.displayScore = Math.min(lane.exactScore, lane.displayScore + speed * dt);
      } else {
        lane.displayScore = Math.max(lane.exactScore, lane.displayScore - speed * dt);
      }
    }
  }

  // Evaluates winner with zero lane bias and handles simultaneous finish / timeout
  static evaluateFinish(lanes, simTime, maxDuration) {
    const leftFinished = lanes.left.reachedBottom;
    const rightFinished = lanes.right.reachedBottom;

    if (leftFinished && rightFinished) {
      const leftTime = lanes.left.finishedTime || simTime;
      const rightTime = lanes.right.finishedTime || simTime;
      const diff = Math.abs(leftTime - rightTime);

      // Simultaneous finish within 0.05s awarded to higher score, or DRAW if tied
      if (diff < 0.05) {
        if (lanes.left.score === lanes.right.score) {
          return {
            name: 'DRAW',
            side: 'both',
            isDraw: true,
            finishTime: Number(Math.min(leftTime, rightTime).toFixed(2)),
            winningScore: lanes.left.score,
            losingScore: lanes.right.score
          };
        }
        const winnerSide = lanes.left.score > lanes.right.score ? 'left' : 'right';
        const winLane = lanes[winnerSide];
        const loseLane = lanes[winnerSide === 'left' ? 'right' : 'left'];
        return {
          name: winLane.name,
          side: winnerSide,
          color: winLane.color,
          finishTime: Number(Math.min(leftTime, rightTime).toFixed(2)),
          winningScore: winLane.score,
          losingScore: loseLane.score
        };
      }

      // Conclusive finish
      const winnerSide = leftTime < rightTime ? 'left' : 'right';
      const winLane = lanes[winnerSide];
      const loseLane = lanes[winnerSide === 'left' ? 'right' : 'left'];
      return {
        name: winLane.name,
        side: winnerSide,
        color: winLane.color,
        finishTime: Number(Math.min(leftTime, rightTime).toFixed(2)),
        winningScore: winLane.score,
        losingScore: loseLane.score
      };
    }

    if (leftFinished) {
      return {
        name: lanes.left.name,
        side: 'left',
        color: lanes.left.color,
        finishTime: Number((lanes.left.finishedTime || simTime).toFixed(2)),
        winningScore: lanes.left.score,
        losingScore: lanes.right.score
      };
    }

    if (rightFinished) {
      return {
        name: lanes.right.name,
        side: 'right',
        color: lanes.right.color,
        finishTime: Number((lanes.right.finishedTime || simTime).toFixed(2)),
        winningScore: lanes.right.score,
        losingScore: lanes.left.score
      };
    }

    // Timeout boundary: highest score or DRAW
    if (simTime >= maxDuration) {
      if (lanes.left.score === lanes.right.score) {
        return {
          name: 'DRAW',
          side: 'both',
          isDraw: true,
          finishTime: maxDuration,
          winningScore: lanes.left.score,
          losingScore: lanes.right.score,
          isTimeout: true
        };
      }
      const winnerSide = lanes.left.score > lanes.right.score ? 'left' : 'right';
      const winLane = lanes[winnerSide];
      const loseLane = lanes[winnerSide === 'left' ? 'right' : 'left'];
      return {
        name: winLane.name,
        side: winnerSide,
        color: winLane.color,
        finishTime: maxDuration,
        winningScore: winLane.score,
        losingScore: loseLane.score,
        isTimeout: true
      };
    }

    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScoringSystem };
}
