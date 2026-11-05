// Root shim for generate_scenarios (delegates to scripts/legacy/generate_scenarios.js)
const legacy = require('./scripts/legacy/generate_scenarios.js');

if (require.main === module) {
  const count = parseInt(process.argv[2], 10) || 8;
  legacy.generateScenarios(count);
}

module.exports = legacy;
