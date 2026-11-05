/**
 * MegaPlinkoGame - 1,000x Jackpot Plinko Game Adapter.
 * Backward-compatibility shim delegating to games/mega-plinko/game-adapter.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../../games/mega-plinko/game-adapter');
} else if (typeof window !== 'undefined' && window.MegaPlinkoGame) {
  // Already defined by games/mega-plinko/game-adapter.js
}
