/**
 * AIDirector - AI Director Model for Automated Game & Physics Formulation.
 * Backward-compatibility shim delegating to core/ai-director/ai-director.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/ai-director/ai-director');
} else if (typeof window !== 'undefined' && window.AIDirector) {
  // Already defined by core/ai-director/ai-director.js
}
