// High-Performance Deterministic 1080x1920 60FPS Video Renderer
// Headless Chrome -> Universal Game Manager -> Canvas Stream -> FFmpeg Pipe + Procedural Audio Synthesis

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { AudioSynthesizer } = require('./src/audio_generator');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_BIN
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Google Chrome executable not found. Please install Chrome or set CHROME_BIN.');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    config: 'configs/underdog_x3_vs_plus2.json',
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

async function renderVideo(options) {
  let config = null;

  if (typeof options.config === 'object') {
    config = options.config;
  } else {
    const configPath = path.resolve(options.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  if (options.duration) config.durationSeconds = options.duration;
  if (options.fps) config.fps = options.fps;

  const outputDir = path.resolve('output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputBaseName = config.id || `sim_${Date.now()}`;
  const finalMp4Path = options.output
    ? path.resolve(options.output)
    : path.join(outputDir, `${outputBaseName}_1080x1920.mp4`);

  // RENDER-06: Ensure destination directory exists recursively
  const finalOutputDir = path.dirname(finalMp4Path);
  if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });

  // RENDER-04: Upfront FFmpeg availability check
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch (err) {
    throw new Error(`FFmpeg is not installed or not in PATH: ${err.message}`);
  }

  const tempVideoMp4 = path.join(outputDir, `temp_${Date.now()}_video.mp4`);
  const tempWavPath = path.join(outputDir, `temp_${Date.now()}_audio.wav`);

  const clipStartTime = options.startTime || 0;
  const clipDuration = options.duration || (config.durationSeconds - clipStartTime);
  const totalFrames = Math.ceil(clipDuration * (config.fps || 60));

  console.log('='.repeat(65));
  console.log(`🎬 BURSTPOINT 1080x1920 UNIVERSAL VIDEO RENDERER`);
  console.log(`Game Mode: ${config.gameType || config.type || 'multi_race'}`);
  console.log(`Title:     ${config.title}`);
  console.log(`Duration:  ${clipDuration.toFixed(2)}s (${totalFrames} frames @ ${config.fps || 60} FPS, start: ${clipStartTime}s)`);
  console.log(`Output:    ${finalMp4Path}`);
  console.log('='.repeat(65));

  // 1. Launch FFmpeg in image2pipe mode
  const ffmpegVideoProc = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(config.fps || 60),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    tempVideoMp4
  ]);

  ffmpegVideoProc.stderr.on('data', () => {});

  const ffmpegVideoClosed = new Promise((resolve, reject) => {
    ffmpegVideoProc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg video encode failed with code ${code}`));
    });
  });

  let browser = null;
  let server = null;

  try {
    // 2. Set up local HTTP Server to stream frames
    let finishData = null;
    let receivedFrames = 0;
    let resolveFinish = null;
    const finishPromise = new Promise(res => { resolveFinish = res; });

    server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];

      if (req.method === 'POST' && url === '/frame') {
        req.pipe(ffmpegVideoProc.stdin, { end: false });
        req.on('end', () => {
          receivedFrames++;
          if (receivedFrames % 120 === 0 || receivedFrames === totalFrames) {
            const pct = ((receivedFrames / totalFrames) * 100).toFixed(1);
            process.stdout.write(`\r⏳ Rendering progress: ${receivedFrames}/${totalFrames} frames (${pct}%)`);
          }
          res.writeHead(200);
          res.end('ok');
        });
      } else if (req.method === 'POST' && url === '/finish') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try { finishData = JSON.parse(body); } catch (e) {}
          res.writeHead(200);
          res.end('ok');
          ffmpegVideoProc.stdin.end();
          resolveFinish();
        });
      } else {
        let relPath = url.replace(/^\//, '');
        if (!relPath) relPath = 'index.html';
        let filePath = path.resolve(__dirname, relPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.css': 'text/css'
          };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    const serverPort = await new Promise(resolve => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    const chromePath = findChrome();
    const startTime = Date.now();

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: [
        '--window-size=1080,1920',
        '--disable-gpu-sandbox',
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err.message));
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.setCacheEnabled(false);
    await page.goto(`http://127.0.0.1:${serverPort}/index.html`, { waitUntil: 'domcontentloaded' });

    // Run deterministic frame generation in browser via GameManager
    await page.evaluate(async (simConfig, jpegQuality, clipStartSec, clipDurationSec) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      document.body.appendChild(canvas);

      const game = GameManager.createGame(simConfig);

      const fps = simConfig.fps || 60;
      const dt = 1 / fps;
      const startFrame = Math.floor(clipStartSec * fps);
      const endFrame = startFrame + Math.ceil(clipDurationSec * fps);

      for (let f = 0; f < endFrame; f++) {
        game.update(dt);
        if (f >= startFrame) {
          game.render(ctx);

          const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', jpegQuality || 0.82);
          });

          await fetch('/frame', { method: 'POST', body: blob });
        }
      }

      await fetch('/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: game.events || [],
          winner: game.winner || null
        })
      });
    }, config, options.quality, clipStartTime, clipDuration);

    await finishPromise;
    await ffmpegVideoClosed;

    process.stdout.write('\n');
    console.log(`✅ Frame rendering complete! Captured ${finishData?.events?.length || 0} audio events.`);
    if (finishData?.winner) {
      console.log(`🏆 Result: ${finishData.winner.name || 'FINISHED'}`);
    }

    // Audio generation & multiplexing
    if (!options.noAudio && finishData?.events && finishData.events.length > 0) {
      console.log(`🎵 Synthesizing procedural 44.1kHz audio track...`);
      const synth = new AudioSynthesizer(44100);
      const clipEvents = finishData.events
        .map(e => ({ ...e, time: (e.time !== undefined ? e.time : (e.t !== undefined ? e.t : 0)) }))
        .filter(e => e.time >= clipStartTime && e.time <= (clipStartTime + clipDuration))
        .map(e => ({ ...e, time: Math.max(0, e.time - clipStartTime) }));
      synth.generateWav(clipEvents, clipDuration, tempWavPath);

      console.log(`🎞️  Muxing video + audio into final MP4...`);
      await new Promise((resolve, reject) => {
        const muxProc = spawn('ffmpeg', [
          '-y',
          '-i', tempVideoMp4,
          '-i', tempWavPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
          '-shortest',
          finalMp4Path
        ]);
        muxProc.stderr.on('data', () => {});
        muxProc.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg audio mux failed with code ${code}`));
        });
      });
    } else {
      fs.copyFileSync(tempVideoMp4, finalMp4Path);
    }

    // RENDER-10: Verify output MP4 integrity
    if (!fs.existsSync(finalMp4Path) || fs.statSync(finalMp4Path).size < 1000) {
      throw new Error(`Export verification failed: ${finalMp4Path} was not created or is empty.`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const stat = fs.statSync(finalMp4Path);

    console.log('='.repeat(65));
    console.log(`🎉 VIDEO RENDERED SUCCESSFULLY in ${elapsed}s!`);
    console.log(`📁 File: ${finalMp4Path} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`Resolution: 1080x1920 | 60.00 FPS | YouTube Shorts Optimized`);
    console.log('='.repeat(65));

    if (config.metadata) {
      const metaPath = finalMp4Path.replace(/\.mp4$/, '_metadata.json');
      fs.writeFileSync(metaPath, JSON.stringify(config.metadata, null, 2));
      console.log(`📋 Metadata exported: ${path.basename(metaPath)}`);
    }

    return finalMp4Path;
  } finally {
    // RENDER-01, RENDER-09, RENDER-11: Guaranteed resource and temporary-file cleanup
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    if (server) {
      try { server.close(); } catch (e) {}
    }
    try {
      if (fs.existsSync(tempVideoMp4)) fs.unlinkSync(tempVideoMp4);
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } catch (e) {}
  }
}

if (require.main === module) {
  const options = parseArgs();
  renderVideo(options).catch(err => {
    console.error('Render error:', err);
    process.exit(1);
  });
}

module.exports = { renderVideo };
