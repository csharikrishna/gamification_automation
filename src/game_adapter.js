/**
 * GameAdapter - Core Universal Game Adapter Contract.
 * Backward-compatibility shim delegating to core/contracts/game-adapter.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/contracts/game-adapter');
} else if (typeof window !== 'undefined' && window.GameAdapter) {
  // Already defined by core/contracts/game-adapter.js
}
