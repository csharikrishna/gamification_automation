// Root shim for auto_daily (delegates to scripts/legacy/auto_daily.js)
const legacy = require('./scripts/legacy/auto_daily.js');

if (require.main === module) {
  legacy.runDailyAutomation().catch(console.error);
}

module.exports = legacy;
