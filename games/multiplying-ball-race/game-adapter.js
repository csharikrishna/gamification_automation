// Multiplying Ball Race - Official Game Adapter Contract Implementation
// Conforms strictly to Universal GameAdapter interface for integration with the
// Canonical Production Orchestrator, AI Director, and Video Renderer.

const { GameAdapter } = require('../../core/contracts/game-adapter');
const { SimulationEngine } = require('./engine/simulation');
const { CanvasRenderer } = require('./rendering/renderer');

class MultiRaceAdapter extends GameAdapter {
  constructor(config = {}, seed = null) {
    super(config, seed);
    this.gameType = 'multi_race';
    this.type = 'multi_race';
  }

  initialize(config, seed) {
    super.initialize(config, seed);
    this.engine = new SimulationEngine({
      ...config,
      seed: this.seed
    });
    this.renderer = null;
  }

  step(deltaTime = 1 / 60) {
    super.step(deltaTime);
    this.engine.update(deltaTime);
    this.finished = this.engine.isFinished;
    this.result = this.engine.winner ? this.getResult() : null;
  }

  observe() {
    const metrics = this.engine.getMetrics();
    return {
      simTime: this.engine.simTime,
      frameIndex: this.engine.frameIndex,
      isFinished: this.engine.isFinished,
      winner: this.engine.winner,
      leftScore: this.engine.lanes.left.exactScore,
      rightScore: this.engine.lanes.right.exactScore,
      leftMetrics: metrics.left,
      rightMetrics: metrics.right,
      leftTier: this.engine.lanes.left.currentTier,
      rightTier: this.engine.lanes.right.currentTier,
      result: this.getResult()
    };
  }

  getEvents() {
    return this.engine.events;
  }

  isFinished() {
    return this.engine.isFinished;
  }

  getResult() {
    if (!this.engine.winner) return null;
    const w = this.engine.winner;
    return {
      gameType: 'multi_race',
      winner: w.name,
      winnerSide: w.side,
      winnerColor: w.color,
      isDraw: !!w.isDraw,
      winningScore: w.winningScore,
      losingScore: w.losingScore,
      finishTime: w.finishTime,
      isFinished: true
    };
  }

  getReplay() {
    return {
      gameType: 'multi_race',
      seed: this.seed,
      config: this.config,
      totalFrames: this.engine.frameIndex,
      durationSeconds: Number(this.engine.simTime.toFixed(3)),
      result: this.getResult(),
      events: this.engine.events,
      metrics: this.engine.getMetrics()
    };
  }

  setTheme(theme) {
    this.theme = theme;
    if (this.config) this.config.theme = theme;
    if (this.engine && this.engine.config) this.engine.config.theme = theme;
    if (this.renderer && typeof this.renderer.setTheme === 'function') {
      this.renderer.setTheme(theme);
    }
  }

  render(ctx, options = {}) {
    if (!this.renderer || this.renderer.ctx !== ctx) {
      this.renderer = new CanvasRenderer(ctx.canvas);
    }
    const theme = options.theme || this.theme || (this.config && this.config.theme);
    if (theme && typeof this.renderer.setTheme === 'function') {
      this.renderer.setTheme(theme);
    }
    this.renderer.render(this.engine);
  }
}

if (typeof window !== 'undefined') {
  window.MultiRaceAdapter = MultiRaceAdapter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiRaceAdapter };
}
