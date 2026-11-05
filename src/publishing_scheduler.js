/**
 * PublishingScheduler - Rotating multi-game calendar and publishing automation.
 * Backward-compatibility shim delegating to core/publishing/scheduler.js
 */

const { PublishingScheduler } = require('../core/publishing/scheduler');

module.exports = { PublishingScheduler };
