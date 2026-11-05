/**
 * BrickBreakerGame - Neon Brick Breaker Swarm Game Adapter.
 * Backward-compatibility shim delegating to games/neon-brick-breaker/game-adapter.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../../games/neon-brick-breaker/game-adapter');
} else if (typeof window !== 'undefined' && window.BrickBreakerGame) {
  // Already defined by games/neon-brick-breaker/game-adapter.js
}
