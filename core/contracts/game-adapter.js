// Core Game Adapter Contract
// All Burstpoint simulation games (Multiplying Ball Race, Mega Plinko, Sumo Arena, Brick Breaker)
// must adhere to this contract for universal execution by the Orchestrator, AI Director, and Video Renderer.

class GameAdapter {
  constructor(config = {}, seed = null) {
    this.config = config || {};
    this.seed = seed ?? config.seed ?? 1337;
    this.simTime = 0;
    this.frameIndex = 0;
    this.events = [];
    this.replayLog = [];
    this.finished = false;
    this.result = null;

    if (config && Object.keys(config).length > 0) {
      this.initialize(config, this.seed);
    }
  }

  // Initializes the simulation scenario and deterministic seed
  initialize(config, seed) {
    this.config = config;
    this.seed = seed ?? config.seed ?? 1337;
    this.simTime = 0;
    this.frameIndex = 0;
    this.events = [];
    this.replayLog = [];
    this.finished = false;
    this.result = null;
  }

  // Advances physical simulation by deltaTime (in seconds)
  step(deltaTime = 1 / 60) {
    this.simTime += deltaTime;
    this.frameIndex++;
  }

  // Alias for step(deltaTime) for backwards compatibility
  update(deltaTime = 1 / 60) {
    return this.step(deltaTime);
  }

  // Returns current observable snapshot state of the simulation
  observe() {
    return {
      simTime: this.simTime,
      frameIndex: this.frameIndex,
      isFinished: this.isFinished(),
      result: this.getResult()
    };
  }

  // Returns array of events logged during the simulation
  getEvents() {
    return this.events;
  }

  // Returns boolean indicating whether the simulation has concluded
  isFinished() {
    return this.finished;
  }

  // Returns structured match result (winner, score, highlights, stats)
  getResult() {
    return this.result;
  }

  // Returns replay data sufficient to reproduce the exact match deterministically
  getReplay() {
    return {
      gameType: this.gameType,
      seed: this.seed,
      config: this.config,
      totalFrames: this.frameIndex,
      durationSeconds: this.simTime,
      result: this.getResult(),
      events: this.events
    };
  }

  // Draws the current simulation frame to an HTML5 Canvas 2D context (1080x1920)
  render(ctx) {
    throw new Error(`Method "render(ctx)" must be implemented by GameAdapter subclass "${this.constructor.name}".`);
  }
}

if (typeof window !== 'undefined') {
  window.GameAdapter = GameAdapter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameAdapter };
}
