/**
 * MarbleRunGame - Rube Goldberg Marble Run Game Adapter.
 * Backward-compatibility shim delegating to games/marble-run/game-adapter.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../../games/marble-run/game-adapter');
} else if (typeof window !== 'undefined' && window.MarbleRunGame) {
  // Already defined by games/marble-run/game-adapter.js
}
