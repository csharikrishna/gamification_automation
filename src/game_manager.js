// Unified Game Environment Manager
// Factory and adapter that loads, ticks, and renders any game environment

let _SimulationEngine = typeof SimulationEngine !== 'undefined' ? SimulationEngine : null;
let _CanvasRenderer = typeof CanvasRenderer !== 'undefined' ? CanvasRenderer : null;
let _MegaPlinkoGame = typeof MegaPlinkoGame !== 'undefined' ? MegaPlinkoGame : null;
let _SumoArenaGame = typeof SumoArenaGame !== 'undefined' ? SumoArenaGame : null;
let _BrickBreakerGame = typeof BrickBreakerGame !== 'undefined' ? BrickBreakerGame : null;
let _MarbleRunGame = typeof MarbleRunGame !== 'undefined' ? MarbleRunGame : null;

if (typeof require !== 'undefined') {
  try {
    if (!_SimulationEngine) _SimulationEngine = require('./engine').SimulationEngine;
    if (!_CanvasRenderer) _CanvasRenderer = require('./renderer').CanvasRenderer;
    if (!_MegaPlinkoGame) _MegaPlinkoGame = require('./games/mega_plinko').MegaPlinkoGame;
    if (!_SumoArenaGame) _SumoArenaGame = require('./games/sumo_arena').SumoArenaGame;
    if (!_BrickBreakerGame) _BrickBreakerGame = require('./games/brick_breaker').BrickBreakerGame;
    if (!_MarbleRunGame) _MarbleRunGame = require('./games/marble_run').MarbleRunGame;
  } catch (e) {}
}

class GameManager {
  static createGame(config) {
    const gameType = config.gameType || config.type || 'multi_race';

    if (gameType === 'mega_plinko' && _MegaPlinkoGame) {
      return new _MegaPlinkoGame(config);
    } else if (gameType === 'sumo_arena' && _SumoArenaGame) {
      return new _SumoArenaGame(config);
    } else if (gameType === 'brick_breaker' && _BrickBreakerGame) {
      return new _BrickBreakerGame(config);
    } else if (gameType === 'marble_run' && _MarbleRunGame) {
      return new _MarbleRunGame(config);
    } else if (_SimulationEngine) {
      const engine = new _SimulationEngine(config);
      return {
        type: 'multi_race',
        engine,
        events: engine.events,
        get isFinished() { return engine.isFinished; },
        get winner() { return engine.winner; },
        update(dt) { engine.update(dt); },
        render(ctx) {
          if (!this.renderer || this.renderer.ctx !== ctx) {
            this.renderer = new _CanvasRenderer(ctx.canvas);
          }
          this.renderer.render(engine);
        }
      };
    } else {
      throw new Error(`Game engine for ${gameType} not found.`);
    }
  }
}

if (typeof window !== 'undefined') {
  window.GameManager = GameManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameManager };
}
