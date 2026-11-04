// Core Render Manager
// Coordinates Headless Chrome frame stepping, canvas streaming, and FFmpeg video encoding.
// Includes security hardening against directory traversal on the local loopback server.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { AudioSynthesizer } = require('../audio/audio-mixer');

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

async function renderVideo(options = {}) {
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

  const finalOutputDir = path.dirname(finalMp4Path);
  if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });

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
  const rootDir = path.resolve(__dirname, '../../');

  try {
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
        // Hardened path resolution: strict path.relative traversal guardrail
        let relPath = decodeURIComponent(url).replace(/^\//, '');
        if (!relPath) relPath = 'index.html';
        const filePath = path.resolve(rootDir, relPath);
        const relBoundary = path.relative(rootDir, filePath);

        if (relBoundary.startsWith('..') || path.isAbsolute(relBoundary)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

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
          events: game.events || (typeof game.getEvents === 'function' ? game.getEvents() : []),
          winner: game.winner || (typeof game.getResult === 'function' ? game.getResult()?.winner : null)
        })
      });
    }, config, options.quality || 0.82, clipStartTime, clipDuration);

    await finishPromise;
    await ffmpegVideoClosed;

    const renderTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const audioEvts = finishData?.events || finishData?.audioEvents || [];
    console.log(`\n✅ Frame rendering complete! Captured ${audioEvts.length} audio events.`);
    console.log(`🏆 Result: ${typeof finishData?.winner === 'object' ? finishData?.winner?.name : finishData?.winner || 'Completed'}`);

    if (!options.noAudio && audioEvts.length > 0) {
      console.log('🎵 Synthesizing procedural 44.1kHz audio track...');
      const audioEvents = audioEvts.map(e => ({
        ...e,
        time: (e.time !== undefined ? e.time : (e.t !== undefined ? e.t : 0)) - clipStartTime
      })).filter(e => e.time >= 0 && e.time <= clipDuration);

      const synth = new AudioSynthesizer(44100);
      synth.generateWav(audioEvents, clipDuration, tempWavPath);

      console.log('🎞️  Muxing video + audio into final MP4...');
      execSync(`ffmpeg -y -i "${tempVideoMp4}" -i "${tempWavPath}" -c:v copy -c:a aac -b:a 192k -shortest "${finalMp4Path}"`, { stdio: 'pipe' });

      if (fs.existsSync(tempVideoMp4)) fs.unlinkSync(tempVideoMp4);
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } else {
      if (fs.existsSync(finalMp4Path)) fs.unlinkSync(finalMp4Path);
      fs.renameSync(tempVideoMp4, finalMp4Path);
    }

    const fileSizeMb = (fs.statSync(finalMp4Path).size / (1024 * 1024)).toFixed(2);
    console.log('='.repeat(65));
    console.log(`🎉 VIDEO RENDERED SUCCESSFULLY in ${renderTimeSec}s!`);
    console.log(`📁 File: ${finalMp4Path} (${fileSizeMb} MB)`);
    console.log(`Resolution: 1080x1920 | ${(config.fps || 60).toFixed(2)} FPS | YouTube Shorts Optimized`);
    console.log('='.repeat(65));

    return {
      outputMp4: finalMp4Path,
      fileSizeMb: Number(fileSizeMb),
      duration: clipDuration,
      result: finishData
    };
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    if (fs.existsSync(tempVideoMp4)) { try { fs.unlinkSync(tempVideoMp4); } catch (e) {} }
    if (fs.existsSync(tempWavPath)) { try { fs.unlinkSync(tempWavPath); } catch (e) {} }
  }
}

module.exports = { renderVideo };
