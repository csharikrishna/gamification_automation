/**
 * SumoArenaGame - 16-Ball Battle Royale Ring Out Game Adapter.
 * Backward-compatibility shim delegating to games/sumo-battle-royale/game-adapter.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../../games/sumo-battle-royale/game-adapter');
} else if (typeof window !== 'undefined' && window.SumoArenaGame) {
  // Already defined by games/sumo-battle-royale/game-adapter.js
}
