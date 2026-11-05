/**
 * MathEvaluator - Mathematical expression evaluator and formula generator.
 * Backward-compatibility shim delegating to core/utilities/math-evaluator.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/utilities/math-evaluator');
} else if (typeof window !== 'undefined' && window.MathEvaluator) {
  // Already defined by core/utilities/math-evaluator.js
}
