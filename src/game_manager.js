// Unified Game Environment Manager
// Factory and adapter that loads, ticks, and renders any game environment via GameAdapter contract

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
  } catch (e) {
    console.warn('[GameManager] Notice while loading module:', e.message);
  }
}

class GameManager {
  static getSupportedGames() {
    return ['multi_race', 'mega_plinko', 'sumo_arena', 'brick_breaker'];
  }

  static createGame(config) {
    const gameType = config.gameType || config.type || 'multi_race';
    const seed = config.seed ?? 1337;

    if (gameType === 'mega_plinko' && _MegaPlinkoGame) {
      return new _MegaPlinkoGame(config, seed);
    } else if (gameType === 'sumo_arena' && _SumoArenaGame) {
      return new _SumoArenaGame(config, seed);
    } else if (gameType === 'brick_breaker' && _BrickBreakerGame) {
      return new _BrickBreakerGame(config, seed);
    } else if (gameType === 'marble_run' && _MarbleRunGame) {
      return new _MarbleRunGame(config, seed);
    } else if (gameType === 'multi_race' && _SimulationEngine) {
      const engine = new _SimulationEngine(config);
      return {
        gameType: 'multi_race',
        type: 'multi_race',
        engine,
        config,
        seed,
        events: engine.events,
        get simTime() { return engine.simTime; },
        get frameIndex() { return engine.frameIndex; },
        get isFinished() { return engine.isFinished; },
        get winner() { return engine.winner; },
        step(dt) { engine.update(dt); },
        update(dt) { engine.update(dt); },
        observe() {
          return {
            simTime: engine.simTime,
            frameIndex: engine.frameIndex,
            leftScore: engine.lanes.left.exactScore,
            rightScore: engine.lanes.right.exactScore,
            leftTier: engine.lanes.left.currentTier,
            rightTier: engine.lanes.right.currentTier,
            isFinished: engine.isFinished,
            winner: engine.winner
          };
        },
        getEvents() { return engine.events; },
        getResult() {
          return {
            gameType: 'multi_race',
            winner: engine.winner?.name || (engine.winner?.side === 'left' ? 'LEFT' : 'RIGHT'),
            winnerSide: engine.winner?.side,
            winnerColor: engine.winner?.color,
            isDraw: !!engine.winner?.isDraw,
            winningScore: engine.winner?.winningScore,
            losingScore: engine.winner?.losingScore,
            finishTime: engine.winner?.finishTime,
            isFinished: engine.isFinished
          };
        },
        getReplay() {
          return {
            gameType: 'multi_race',
            seed: engine.seed,
            config,
            events: engine.events,
            result: this.getResult()
          };
        },
        render(ctx) {
          if (!this.renderer || this.renderer.ctx !== ctx) {
            this.renderer = new _CanvasRenderer(ctx.canvas);
          }
          this.renderer.render(engine);
        }
      };
    } else {
      throw new Error(`Game engine for gameType "${gameType}" not found or unsupported.`);
    }
  }
}

if (typeof window !== 'undefined') {
  window.GameManager = GameManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameManager };
}
