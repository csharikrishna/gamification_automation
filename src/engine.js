/**
 * SimulationEngine - Multiplying Ball Race Physical Simulation Engine.
 * Backward-compatibility shim delegating to games/multiplying-ball-race/engine/simulation.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../games/multiplying-ball-race/engine/simulation');
} else if (typeof window !== 'undefined' && window.SimulationEngine) {
  // Already defined by games/multiplying-ball-race/engine/simulation.js
}
