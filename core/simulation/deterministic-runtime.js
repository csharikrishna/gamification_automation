// Core Deterministic Runtime & Stepper
// Manages fixed-timestep stepping, accumulator updates, and runtime diagnostics.

class DeterministicRuntime {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.fps = options.fps || engine.config?.fps || 60;
    this.fixedDeltaTime = 1 / this.fps;
    this.maxFrames = Math.ceil((options.durationSeconds || engine.config?.durationSeconds || 20) * this.fps);
    this.currentFrame = 0;
  }

  // Runs full simulation to conclusion or frame limit synchronously
  runToCompletion() {
    const startTime = Date.now();
    while (this.currentFrame < this.maxFrames && !(typeof this.engine.isFinished === 'function' ? this.engine.isFinished() : this.engine.isFinished)) {
      this.step();
    }
    const elapsedMs = Date.now() - startTime;
    return {
      totalFrames: this.currentFrame,
      simTime: this.engine.simTime,
      elapsedMs,
      fpsEquivalent: Number(((this.currentFrame / (elapsedMs || 1)) * 1000).toFixed(1)),
      winner: this.engine.winner
    };
  }

  // Steps a single fixed frame
  step() {
    this.engine.update(this.fixedDeltaTime);
    this.currentFrame++;
  }
}

module.exports = { DeterministicRuntime };
