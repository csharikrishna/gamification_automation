// Root shim for pipeline (delegates to scripts/legacy/pipeline.js)
const legacy = require('./scripts/legacy/pipeline.js');

if (require.main === module) {
  legacy.runBatchPipeline().catch(console.error);
}

module.exports = legacy;
