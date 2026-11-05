// Multiplying Ball Race - Canonical Visual Renderer
// Modular 1080x1920 broadcast renderer composing director, themes, and layer renderers.

let _VideoDirector = typeof VideoDirector !== 'undefined' ? VideoDirector : null;
let _THEMES = typeof THEMES !== 'undefined' ? THEMES : null;
let _drawBackground = typeof drawBackground !== 'undefined' ? drawBackground : null;
let _drawHeader = typeof drawHeader !== 'undefined' ? drawHeader : null;
let _drawScoreCard = typeof drawScoreCard !== 'undefined' ? drawScoreCard : null;
let _checkRaceLeader = typeof checkRaceLeader !== 'undefined' ? checkRaceLeader : null;
let _drawTracks = typeof drawTracks !== 'undefined' ? drawTracks : null;
let _drawObstaclesAndTiles = typeof drawObstaclesAndTiles !== 'undefined' ? drawObstaclesAndTiles : null;
let _drawBalls = typeof drawBalls !== 'undefined' ? drawBalls : null;
let _drawParticlesAndTexts = typeof drawParticlesAndTexts !== 'undefined' ? drawParticlesAndTexts : null;
let _drawFinishLineAndProgress = typeof drawFinishLineAndProgress !== 'undefined' ? drawFinishLineAndProgress : null;
let _drawArenaCelebrationGlow = typeof drawArenaCelebrationGlow !== 'undefined' ? drawArenaCelebrationGlow : null;
let _drawCelebration = typeof drawCelebration !== 'undefined' ? drawCelebration : null;
let _drawWinnerBanner = typeof drawWinnerBanner !== 'undefined' ? drawWinnerBanner : null;
let _drawWatermark = typeof drawWatermark !== 'undefined' ? drawWatermark : null;

if (typeof require !== 'undefined') {
  try {
    if (!_VideoDirector) _VideoDirector = require('./director').VideoDirector;
    if (!_THEMES) _THEMES = require('./themes').THEMES;
    if (!_drawBackground) _drawBackground = require('./layers/background').drawBackground;
    if (!_drawHeader) {
      const h = require('./layers/header');
      _drawHeader = h.drawHeader;
      _drawScoreCard = h.drawScoreCard;
      _checkRaceLeader = h.checkRaceLeader;
    }
    if (!_drawTracks) _drawTracks = require('./layers/tracks').drawTracks;
    if (!_drawObstaclesAndTiles) _drawObstaclesAndTiles = require('./layers/obstacles').drawObstaclesAndTiles;
    if (!_drawBalls) _drawBalls = require('./layers/balls').drawBalls;
    if (!_drawParticlesAndTexts) _drawParticlesAndTexts = require('./layers/particles').drawParticlesAndTexts;
    if (!_drawCelebration) {
      const c = require('./layers/celebration');
      _drawFinishLineAndProgress = c.drawFinishLineAndProgress;
      _drawArenaCelebrationGlow = c.drawArenaCelebrationGlow;
      _drawCelebration = c.drawCelebration;
      _drawWinnerBanner = c.drawWinnerBanner;
      _drawWatermark = c.drawWatermark;
    }
  } catch (e) {}
}

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width || 1080;
    this.height = canvas.height || 1920;
    this.director = new _VideoDirector();
    this.theme = 'dark';
    this.hasExplicitTheme = false;
  }

  setTheme(themeName) {
    if (themeName === 'light' || themeName === 'dark') {
      this.theme = themeName;
      this.hasExplicitTheme = true;
    }
  }

  getThemeTokens() {
    return _THEMES ? (_THEMES[this.theme] || _THEMES.dark) : {};
  }

  checkRaceLeader(lane, other) {
    return _checkRaceLeader(lane, other);
  }

  drawBackground(engine) {
    _drawBackground(this, engine);
  }

  drawHeader(engine) {
    _drawHeader(this, engine);
  }

  drawScoreCard(lane, centerX, centerY, isLeader = false, isWinner = false, engine = null) {
    _drawScoreCard(this, lane, centerX, centerY, isLeader, isWinner, engine);
  }

  drawTracks(engine) {
    _drawTracks(this, engine);
  }

  drawObstaclesAndTiles(engine) {
    _drawObstaclesAndTiles(this, engine);
  }

  drawBalls(engine) {
    _drawBalls(this, engine);
  }

  drawParticlesAndTexts(engine) {
    _drawParticlesAndTexts(this, engine);
  }

  drawFinishLineAndProgress(engine) {
    _drawFinishLineAndProgress(this, engine);
  }

  drawArenaCelebrationGlow(engine) {
    _drawArenaCelebrationGlow(this, engine);
  }

  drawCelebration(engine) {
    _drawCelebration(this, engine);
  }

  drawWinnerBanner(engine) {
    _drawWinnerBanner(this, engine);
  }

  drawWatermark() {
    _drawWatermark(this);
  }

  render(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Respect explicitly selected theme across all frames; only adopt engine.config.theme if unset
    if (!this.hasExplicitTheme && engine && engine.config && engine.config.theme) {
      this.theme = (engine.config.theme === 'light') ? 'light' : 'dark';
    }

    // Update director logic
    this.director.update(engine);

    ctx.clearRect(0, 0, w, h);

    // 1. Static Screen Background
    this.drawBackground(engine);

    // 2. Camera-Transform World Rendering (Clipped to arena viewport below broadcast header)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 312, w, h - 312);
    ctx.clip();

    this.director.applyCamera(ctx, w, h);

    // Dynamic Tracks & Tiers
    this.drawTracks(engine);

    // Pegs & Breakable Barrier Tiles
    this.drawObstaclesAndTiles(engine);

    // Balls with Individual Silhouette Delineation
    this.drawBalls(engine);

    // Flying Shards, Sparks & Floating Texts
    this.drawParticlesAndTexts(engine);

    // Bottom Reservoir & Finish Line
    this.drawFinishLineAndProgress(engine);

    // Arena-Integrated Victory Spotlight & Reservoir Glow (World space)
    if (engine.winnerBannerAlpha > 0.01) {
      this.drawArenaCelebrationGlow(engine);
    }

    this.director.restoreCamera(ctx);
    ctx.restore();

    // 3. Screen-Space UI Overlays (Fixed broadcast header, scoreboard)
    this.drawHeader(engine);

    // 4. Winner Celebration Presentation (Broadcast lower-third banner)
    if (engine.winnerBannerAlpha > 0.01) {
      this.drawCelebration(engine);
    }

    // 5. Brand watermark
    this.drawWatermark();
  }
}

if (typeof window !== 'undefined') {
  window.CanvasRenderer = CanvasRenderer;
  window.VideoDirector = _VideoDirector;
  window.THEMES = _THEMES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CanvasRenderer,
    VideoDirector: _VideoDirector,
    THEMES: _THEMES
  };
}
