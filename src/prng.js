/**
 * PRNG - Deterministic Mulberry32 Seeded Pseudo-Random Number Generator.
 * Backward-compatibility shim delegating to core/simulation/prng.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/simulation/prng');
} else if (typeof window !== 'undefined' && window.PRNG) {
  // Already defined by core/simulation/prng.js
}
