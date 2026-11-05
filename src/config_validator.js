/**
 * ConfigValidator - Scenario configuration schema validator.
 * Backward-compatibility shim delegating to core/contracts/scenario-schema.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/contracts/scenario-schema');
} else if (typeof window !== 'undefined' && window.ConfigValidator) {
  // Already defined by core/contracts/scenario-schema.js
}
