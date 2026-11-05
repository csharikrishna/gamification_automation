// Central Game Registry
// Discovers, registers, and instantiates all game adapters via the Universal GameAdapter contract.

let _MultiRaceAdapter = null;
let _MegaPlinkoGame = null;
let _SumoArenaGame = null;
let _BrickBreakerGame = null;
let _MarbleRunGame = null;

try {
  _MultiRaceAdapter = require('../games/multiplying-ball-race/game-adapter').MultiRaceAdapter;
  _MegaPlinkoGame = require('../games/mega-plinko/game-adapter').MegaPlinkoGame;
  _SumoArenaGame = require('../games/sumo-battle-royale/game-adapter').SumoArenaGame;
  _BrickBreakerGame = require('../games/neon-brick-breaker/game-adapter').BrickBreakerGame;
  _MarbleRunGame = require('../games/marble-run/game-adapter').MarbleRunGame;
} catch (err) {
  // Graceful fallback for browser/studio contexts
}

class GameRegistry {
  static getSupportedGames() {
    return [
      { id: 'multi_race', name: 'Multiplying Ball Race', alias: 'multiplying-ball-race', status: 'FLAGSHIP_CERTIFIED' },
      { id: 'mega_plinko', name: 'Mega Plinko', alias: 'mega-plinko', status: 'ADAPTED' },
      { id: 'sumo_arena', name: 'Sumo Battle Royale', alias: 'sumo-battle-royale', status: 'ADAPTED' },
      { id: 'brick_breaker', name: 'Neon Brick Breaker', alias: 'neon-brick-breaker', status: 'ADAPTED' },
      { id: 'marble_run', name: 'Rube Goldberg Marble Run', alias: 'marble-run', status: 'ADAPTED' }
    ];
  }

  static normalizeGameType(type) {
    if (!type) return 'multi_race';
    const clean = type.toLowerCase().replace(/[- ]/g, '_');
    if (clean === 'multiplying_ball_race' || clean === 'multi_race') return 'multi_race';
    if (clean === 'mega_plinko' || clean === 'plinko') return 'mega_plinko';
    if (clean === 'sumo_battle_royale' || clean === 'sumo_arena' || clean === 'sumo') return 'sumo_arena';
    if (clean === 'neon_brick_breaker' || clean === 'brick_breaker' || clean === 'bricks') return 'brick_breaker';
    if (clean === 'marble_run' || clean === 'marble' || clean === 'marblerun') return 'marble_run';
    return clean;
  }

  static createGame(config = {}) {
    const rawType = config.gameType || config.type || 'multi_race';
    const gameType = this.normalizeGameType(rawType);
    const seed = config.seed ?? 1337;

    switch (gameType) {
      case 'multi_race':
        if (!_MultiRaceAdapter) _MultiRaceAdapter = require('../games/multiplying-ball-race/game-adapter').MultiRaceAdapter;
        return new _MultiRaceAdapter(config, seed);

      case 'mega_plinko':
        if (!_MegaPlinkoGame) _MegaPlinkoGame = require('../games/mega-plinko/game-adapter').MegaPlinkoGame;
        return new _MegaPlinkoGame(config, seed);

      case 'sumo_arena':
        if (!_SumoArenaGame) _SumoArenaGame = require('../games/sumo-battle-royale/game-adapter').SumoArenaGame;
        return new _SumoArenaGame(config, seed);

      case 'brick_breaker':
        if (!_BrickBreakerGame) _BrickBreakerGame = require('../games/neon-brick-breaker/game-adapter').BrickBreakerGame;
        return new _BrickBreakerGame(config, seed);

      case 'marble_run':
        if (!_MarbleRunGame) _MarbleRunGame = require('../games/marble-run/game-adapter').MarbleRunGame;
        return new _MarbleRunGame(config, seed);

      default:
        throw new Error(`GameRegistry: Unsupported or unadapted game type "${rawType}".`);
    }
  }
}

module.exports = { GameRegistry };
