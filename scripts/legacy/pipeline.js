// Batch Automated Video Production Pipeline
// Generates scenarios, renders 1080x1920 MP4s, and compiles a publishing manifest.

const fs = require('fs');
const path = require('path');
const { generateScenarios } = require('./generate_scenarios');
const { renderVideo } = require('../../render');

async function runBatchPipeline() {
  const count = parseInt(process.argv[2], 10) || 3;
  console.log('='.repeat(70));
  console.log(`🚀 STARTING BATCH PRODUCTION PIPELINE: ${count} VIDEOS`);
  console.log('='.repeat(70));

  const configFiles = generateScenarios(count, 'configs/generated');
  const manifest = [];
  const outputDir = path.resolve('output');

  for (let i = 0; i < configFiles.length; i++) {
    const configPath = configFiles[i];
    console.log(`\n▶ [${i + 1}/${configFiles.length}] Processing ${path.basename(configPath)}...`);

    try {
      const mp4Path = await renderVideo({
        config: configPath,
        fps: 60,
        quality: 0.88
      });

      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      manifest.push({
        id: rawConfig.id,
        title: rawConfig.title,
        videoPath: mp4Path,
        metadata: rawConfig.metadata,
        renderedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(`❌ Failed rendering ${configPath}:`, err.message);
    }
  }

  const manifestPath = path.join(outputDir, 'batch_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log(`🎉 BATCH PRODUCTION COMPLETE!`);
  console.log(`Produced ${manifest.length} ready-to-upload YouTube Shorts in ${outputDir}`);
  console.log(`Publishing Manifest saved to: ${manifestPath}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  runBatchPipeline().catch(console.error);
}

module.exports = { runBatchPipeline };
