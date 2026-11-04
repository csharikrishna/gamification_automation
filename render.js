// Burstpoint Video Renderer Entrypoint
// Forwards to core/production/render-manager with CLI argument support.

const { renderVideo } = require('./core/production/render-manager');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    config: 'configs/underdog_slow_composed.json',
    output: null,
    fps: 60,
    startTime: 0,
    duration: null,
    noAudio: false,
    quality: 0.82
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config' && args[i + 1]) options.config = args[++i];
    else if (arg === '--output' && args[i + 1]) options.output = args[++i];
    else if (arg === '--fps' && args[i + 1]) options.fps = parseInt(args[++i], 10);
    else if (arg === '--start' && args[i + 1]) options.startTime = parseFloat(args[++i]);
    else if (arg === '--duration' && args[i + 1]) options.duration = parseFloat(args[++i]);
    else if (arg === '--quality' && args[i + 1]) options.quality = parseFloat(args[++i]);
    else if (arg === '--no-audio') options.noAudio = true;
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs();
  renderVideo(options).catch(err => {
    console.error('Render error:', err);
    process.exit(1);
  });
}

module.exports = { renderVideo, parseArgs };
