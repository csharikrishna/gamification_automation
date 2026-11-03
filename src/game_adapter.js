// Base Universal Game Adapter Contract
// All 4 simulation games must adhere to this interface for seamless integration
// with the AI Director, Replay Recorder, Video Renderer, and Publishing Scheduler.

class GameAdapter {
  constructor(config = {}, seed = null) {
    this.config = config;
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

  // Set up scenario configuration and seed
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

  // Returns current observable snapshot state of the simulation
  observe() {
    return {
      simTime: this.simTime,
      frameIndex: this.frameIndex,
      isFinished: this.isFinished(),
      result: this.getResult()
    };
  }

  // Advances physical simulation by deltaTime (in seconds)
  step(deltaTime = 1 / 60) {
    this.simTime += deltaTime;
    this.frameIndex++;
  }

  // Returns array of events logged in the simulation
  getEvents() {
    return this.events;
  }

  // Returns whether the simulation has concluded
  isFinished() {
    return this.finished;
  }

  // Returns structured match result (winner, score, highlights, stats)
  getResult() {
    return this.result;
  }

  // Returns replay data sufficient to reproduce the exact match
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

  // Draws the simulation state to an HTML5 Canvas 2D context (1080x1920)
  render(ctx) {
    // Implemented by game sub-classes
  }
}

if (typeof window !== 'undefined') {
  window.GameAdapter = GameAdapter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameAdapter };
}
