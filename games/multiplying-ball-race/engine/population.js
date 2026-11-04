// Multiplying Ball Race - Population Accounting & Swarm Scaling
// Exposes three distinct metrics at all times:
// 1. actualBallCount: Live physical marbles colliding in the 2D arena
// 2. totalGeneratedBalls: Monotonically increasing lifetime spawns
// 3. mathematicalPopulation / score: Exact discrete mathematical value

class PopulationManager {
  constructor(lane, maxSimulatedBalls = 200) {
    this.lane = lane;
    this.maxSimulatedBalls = maxSimulatedBalls;
  }

  // Synchronizes physical and mathematical population invariants
  syncMetrics() {
    const liveBalls = this.lane.balls.filter(b => !b._dead);
    this.lane.actualBallCount = liveBalls.length;
    this.lane.mathematicalPopulation = this.lane.exactScore;
    this.lane.score = Math.round(this.lane.exactScore);

    // Compute representative ball swarm weight when score exceeds physical cap
    this.lane.ballWeight = this.lane.balls.length > 0
      ? this.lane.exactScore / this.lane.balls.length
      : 1.0;

    return {
      actualBallCount: this.lane.actualBallCount,
      totalGeneratedBalls: this.lane.totalGeneratedBalls,
      mathematicalPopulation: this.lane.mathematicalPopulation,
      score: this.lane.score,
      ballWeight: this.lane.ballWeight
    };
  }

  // Adjusts physical marbles on multiplication or addition
  calculateSpawns(targetSimulated) {
    const currentCount = this.lane.balls.filter(b => !b._dead).length;
    if (targetSimulated > currentCount) {
      return targetSimulated - currentCount;
    }
    return 0;
  }

  // Safely removes excess physical marbles on subtraction or division
  despawnExcess(targetSimulated, rng, particleCallback = null) {
    const currentBalls = this.lane.balls.filter(b => !b._dead);
    const toRemove = currentBalls.length - targetSimulated;
    if (toRemove <= 0) return 0;

    let removedCount = 0;
    for (let j = this.lane.balls.length - 1; j >= 0 && removedCount < toRemove; j--) {
      const b = this.lane.balls[j];
      if (!b._dead) {
        b._dead = true;
        removedCount++;
        if (particleCallback) {
          particleCallback(b);
        }
      }
    }
    return removedCount;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PopulationManager };
}
