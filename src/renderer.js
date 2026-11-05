// Backward-Compatibility Export Shim: src/renderer.js
// Canonical implementation lives at games/multiplying-ball-race/rendering/renderer.js

if (typeof require !== 'undefined') {
  module.exports = require('../games/multiplying-ball-race/rendering/renderer');
} else if (typeof window !== 'undefined' && window.CanvasRenderer) {
  // Already attached to window by canonical modules
}
