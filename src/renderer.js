// High-Resolution 1080x1920 Premium Arcade Visual Renderer & Video Director
// Broadcast typography, physical tactile tiles & chrome pegs, 3D shaded balls with
// high-density silhouette separation, dynamic event-driven camera framing, and celebratory winner presentation.

class VideoDirector {
  constructor() {
    this.camera = { zoom: 1.0, panY: 0, panX: 0, targetPanY: 0, targetPanX: 0, targetZoom: 1.0 };
    this.shake = { x: 0, y: 0, intensity: 0 };
    this.lastTierBroken = -1;
  }

  update(engine) {
    const t = engine.simTime;
    const dur = engine.durationSeconds || 20;

    // Phase detection & camera targeting
    if (t < 2.0) {
      // 0–2s Hook: Wide framing showcasing the match title and opening balls
      this.camera.targetZoom = 1.0;
      this.camera.targetPanY = 0;
      this.camera.targetPanX = 0;
    } else if (!engine.winner && t < dur - 3.2) {
      // 2s–16.8s Competition & Escalation:
      // Focus on active gameplay zone (leading action Y)
      const leftBalls = engine.lanes.left.balls;
      const rightBalls = engine.lanes.right.balls;

      const leadingTier = Math.max(engine.lanes.left.currentTier, engine.lanes.right.currentTier);
      const stageHeight = engine.trackHeight / (engine.numStages + 1);
      const activeTileY = engine.topY + (leadingTier + 1) * stageHeight;

      let maxBallY = 0;
      for (let i = 0; i < leftBalls.length; i++) {
        if (leftBalls[i].y > maxBallY) maxBallY = leftBalls[i].y;
      }
      for (let i = 0; i < rightBalls.length; i++) {
        if (rightBalls[i].y > maxBallY) maxBallY = rightBalls[i].y;
      }

      const focusY = maxBallY > 0 ? (maxBallY * 0.70 + activeTileY * 0.30) : activeTileY;
      const clampedFocusY = Math.max(engine.topY + 160, Math.min(engine.bottomY - 140, focusY));

      // Active downward pan tracking: smoothly track action down the track (up to 280px)
      const panProgress = Math.max(0, Math.min(1.0, (clampedFocusY - (engine.topY + 160)) / (engine.trackHeight - 320)));
      this.camera.targetPanY = -panProgress * 280;

      // Dynamic horizontal emphasis: gently guide attention toward active/leading lane
      const leftLead = engine.lanes.left.currentTier > engine.lanes.right.currentTier || engine.lanes.left.scoreScale > 1.1;
      const rightLead = engine.lanes.right.currentTier > engine.lanes.left.currentTier || engine.lanes.right.scoreScale > 1.1;
      if (leftLead && !rightLead) {
        this.camera.targetPanX = -32;
      } else if (rightLead && !leftLead) {
        this.camera.targetPanX = 32;
      } else {
        this.camera.targetPanX = 0;
      }

      // Dynamic tension zoom
      const escalationProgress = Math.sin((t / dur) * Math.PI);
      this.camera.targetZoom = 1.03 + escalationProgress * 0.05;
    } else {
      // Winner Celebration: Frame reservoir and celebration in active viewport
      this.camera.targetZoom = 1.04;
      this.camera.targetPanY = -180;
      this.camera.targetPanX = 0;
    }

    // Smooth camera damping
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.08;
    this.camera.panY += (this.camera.targetPanY - this.camera.panY) * 0.08;
    this.camera.panX += (this.camera.targetPanX - this.camera.panX) * 0.08;

    // Screen shake decay
    if (this.shake.intensity > 0.04) {
      this.shake.intensity *= 0.88;
      const angle = (t * 42.1) % (Math.PI * 2);
      this.shake.x = Math.cos(angle) * this.shake.intensity * 7;
      this.shake.y = Math.sin(angle) * this.shake.intensity * 7;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
      this.shake.intensity = 0;
    }

    // Detect new gate breaks for tactile impact shake
    const currentLeadingTier = Math.max(engine.lanes.left.currentTier, engine.lanes.right.currentTier);
    if (currentLeadingTier > this.lastTierBroken) {
      this.lastTierBroken = currentLeadingTier;
      this.shake.intensity = currentLeadingTier >= 4 ? 0.95 : 0.50;
    }
  }

  applyCamera(ctx, w, h) {
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx + this.shake.x + this.camera.panX, cy + this.shake.y + this.camera.panY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-cx, -cy);
  }

  restoreCamera(ctx) {
    ctx.restore();
  }
}

const THEMES = {
  dark: {
    name: 'dark',
    bg: {
      gradStops: ['#070a13', '#0a0e1a', '#080c16', '#04060c'],
      grid: 'rgba(255, 255, 255, 0.022)',
      ambientLeft: 'rgba(192, 132, 252, 0.08)',
      ambientRight: 'rgba(74, 222, 128, 0.08)'
    },
    header: {
      gradStops: ['#060810', '#0a0e1a', '#0d1322'],
      border: 'rgba(255, 255, 255, 0.10)',
      barBg: 'rgba(14, 19, 32, 0.94)',
      barBorder: 'rgba(255, 255, 255, 0.14)',
      titleColor: '#ffffff',
      subtitleColor: '#ffd700',
      badgeBg: 'rgba(16, 22, 38, 0.92)',
      badgeBorder: 'rgba(255, 255, 255, 0.18)',
      pipActive: '#ffd700',
      pipInactive: 'rgba(255, 255, 255, 0.20)'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.70)',
      muted: 'rgba(255, 255, 255, 0.45)',
      gold: '#ffd700'
    },
    scoreboard: {
      cardBg: 'rgba(14, 19, 32, 0.92)',
      cardBgWinner: 'rgba(255, 215, 0, 0.12)',
      cardBorder: 'rgba(255, 255, 255, 0.12)',
      numberColor: '#ffffff',
      labelColor: 'rgba(255, 255, 255, 0.72)',
      metaPillBg: 'rgba(255, 255, 255, 0.06)',
      metaPillText: 'rgba(255, 255, 255, 0.65)',
      statusActive: '#38bdf8',
      crownBg: '#ffd700',
      crownText: '#0a0e1a'
    },
    lanes: {
      left: {
        name: 'PURPLE',
        color: '#c084fc',
        accentColor: '#e879f9',
        darkBase: '#3b0764',
        trackBg: 'rgba(11, 14, 24, 0.85)',
        trackBgLeader: 'rgba(16, 21, 36, 0.94)',
        borderColor: 'rgba(192, 132, 252, 0.35)',
        glowColor: 'rgba(192, 132, 252, 0.20)'
      },
      right: {
        name: 'GREEN',
        color: '#4ade80',
        accentColor: '#86efac',
        darkBase: '#052e16',
        trackBg: 'rgba(11, 14, 24, 0.85)',
        trackBgLeader: 'rgba(16, 21, 36, 0.94)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        glowColor: 'rgba(74, 222, 128, 0.20)'
      }
    },
    pegs: {
      fillLight: '#ffffff',
      fillMid: '#94a3b8',
      fillDark: '#475569',
      shadow: 'rgba(0, 0, 0, 0.45)',
      rim: 'rgba(255, 255, 255, 0.40)'
    },
    tiles: {
      pylonBg: '#151b2b',
      pylonBorder: 'rgba(255, 255, 255, 0.20)',
      bodyGrad: ['#0b101c', '#121828', '#090d16'],
      gaugeTrack: 'rgba(4, 7, 14, 0.85)',
      gaugeBorder: 'rgba(255, 255, 255, 0.12)',
      labelColor: '#ffffff',
      labelShadow: 'rgba(0, 0, 0, 0.95)',
      borderDefault: 'rgba(255, 255, 255, 0.25)'
    },
    balls: {
      shadow: 'rgba(0, 0, 0, 0.45)',
      contour: '#05070e',
      specular: 'rgba(255, 255, 255, 0.92)',
      fresnel: 'rgba(255, 255, 255, 0.25)'
    },
    reservoir: {
      trayBg: 'rgba(255, 255, 255, 0.03)',
      trayBorder: 'rgba(255, 255, 255, 0.16)',
      finishLine: 'rgba(255, 255, 255, 0.35)',
      progressBg: 'rgba(255, 255, 255, 0.08)'
    },
    celebration: {
      cardBg: 'rgba(11, 16, 28, 0.94)',
      cardBorder: 'rgba(255, 255, 255, 0.16)',
      cardShadow: 'rgba(0, 0, 0, 0.75)',
      headline: 'rgba(255, 255, 255, 0.70)',
      divider: 'rgba(255, 255, 255, 0.08)',
      statNumber: '#ffffff',
      statLabel: 'rgba(255, 255, 255, 0.55)',
      vsBg: 'rgba(255, 255, 255, 0.04)',
      vsBorder: 'rgba(255, 255, 255, 0.12)',
      vsText: 'rgba(255, 255, 255, 0.50)',
      gold: '#ffd700'
    },
    watermark: 'rgba(255, 255, 255, 0.22)'
  },
  light: {
    name: 'light',
    bg: {
      gradStops: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#f1f5f9'],
      grid: 'rgba(0, 0, 0, 0.035)',
      ambientLeft: 'rgba(147, 51, 234, 0.04)',
      ambientRight: 'rgba(22, 163, 74, 0.04)'
    },
    header: {
      gradStops: ['#ffffff', '#f8fafc', '#edf2f7'],
      border: 'rgba(0, 0, 0, 0.10)',
      barBg: 'rgba(255, 255, 255, 0.95)',
      barBorder: 'rgba(0, 0, 0, 0.12)',
      titleColor: '#0f172a',
      subtitleColor: '#b45309',
      badgeBg: 'rgba(241, 245, 249, 0.95)',
      badgeBorder: 'rgba(0, 0, 0, 0.15)',
      pipActive: '#d97706',
      pipInactive: 'rgba(0, 0, 0, 0.16)'
    },
    text: {
      primary: '#0f172a',
      secondary: 'rgba(51, 65, 85, 0.80)',
      muted: 'rgba(100, 116, 139, 0.60)',
      gold: '#d97706'
    },
    scoreboard: {
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBgWinner: 'rgba(254, 243, 199, 0.85)',
      cardBorder: 'rgba(0, 0, 0, 0.12)',
      numberColor: '#0f172a',
      labelColor: 'rgba(51, 65, 85, 0.85)',
      metaPillBg: 'rgba(0, 0, 0, 0.05)',
      metaPillText: 'rgba(71, 85, 105, 0.85)',
      statusActive: '#0284c7',
      crownBg: '#d97706',
      crownText: '#ffffff'
    },
    lanes: {
      left: {
        name: 'PURPLE',
        color: '#7e22ce', // Deep violet for AAA contrast on light
        accentColor: '#9333ea',
        darkBase: '#581c87',
        trackBg: 'rgba(255, 255, 255, 0.90)',
        trackBgLeader: 'rgba(250, 245, 255, 0.98)',
        borderColor: 'rgba(126, 34, 206, 0.40)',
        glowColor: 'rgba(126, 34, 206, 0.15)'
      },
      right: {
        name: 'GREEN',
        color: '#15803d', // Deep emerald green for AAA contrast on light
        accentColor: '#16a34a',
        darkBase: '#14532d',
        trackBg: 'rgba(255, 255, 255, 0.90)',
        trackBgLeader: 'rgba(240, 253, 244, 0.98)',
        borderColor: 'rgba(21, 128, 61, 0.40)',
        glowColor: 'rgba(21, 128, 61, 0.15)'
      }
    },
    pegs: {
      fillLight: '#64748b',
      fillMid: '#475569',
      fillDark: '#1e293b',
      shadow: 'rgba(0, 0, 0, 0.15)',
      rim: 'rgba(0, 0, 0, 0.25)'
    },
    tiles: {
      pylonBg: '#e2e8f0',
      pylonBorder: 'rgba(0, 0, 0, 0.15)',
      bodyGrad: ['#ffffff', '#f8fafc', '#edf2f7'],
      gaugeTrack: 'rgba(226, 232, 240, 0.95)',
      gaugeBorder: 'rgba(0, 0, 0, 0.15)',
      labelColor: '#0f172a',
      labelShadow: 'rgba(255, 255, 255, 0.90)',
      borderDefault: 'rgba(0, 0, 0, 0.20)'
    },
    balls: {
      shadow: 'rgba(0, 0, 0, 0.25)',
      contour: 'rgba(15, 23, 42, 0.35)',
      specular: 'rgba(255, 255, 255, 0.95)',
      fresnel: 'rgba(255, 255, 255, 0.35)'
    },
    reservoir: {
      trayBg: 'rgba(0, 0, 0, 0.03)',
      trayBorder: 'rgba(0, 0, 0, 0.18)',
      finishLine: 'rgba(0, 0, 0, 0.35)',
      progressBg: 'rgba(0, 0, 0, 0.08)'
    },
    celebration: {
      cardBg: 'rgba(255, 255, 255, 0.96)',
      cardBorder: 'rgba(0, 0, 0, 0.14)',
      cardShadow: 'rgba(0, 0, 0, 0.25)',
      headline: 'rgba(51, 65, 85, 0.85)',
      divider: 'rgba(0, 0, 0, 0.08)',
      statNumber: '#0f172a',
      statLabel: 'rgba(71, 85, 105, 0.75)',
      vsBg: 'rgba(0, 0, 0, 0.05)',
      vsBorder: 'rgba(0, 0, 0, 0.12)',
      vsText: 'rgba(71, 85, 105, 0.85)',
      gold: '#b45309'
    },
    watermark: 'rgba(15, 23, 42, 0.35)'
  }
};

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width || 1080;
    this.height = canvas.height || 1920;
    this.director = new VideoDirector();
    this.theme = 'dark';
  }

  setTheme(themeName) {
    this.theme = (themeName === 'light') ? 'light' : 'dark';
  }

  getThemeTokens() {
    return THEMES[this.theme] || THEMES.dark;
  }

  render(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (engine.config && engine.config.theme) {
      this.setTheme(engine.config.theme);
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

  drawBackground(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const tok = this.getThemeTokens();

    // Rich tournament chassis background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, tok.bg.gradStops[0]);
    bgGrad.addColorStop(0.35, tok.bg.gradStops[1]);
    bgGrad.addColorStop(0.7, tok.bg.gradStops[2]);
    bgGrad.addColorStop(1, tok.bg.gradStops[3]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Left ambient floor glow (restrained)
    const leftGlow = ctx.createRadialGradient(285, 950, 40, 285, 950, 380);
    leftGlow.addColorStop(0, tok.bg.ambientLeft);
    leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 340, 540, 1200);

    // Right ambient floor glow (restrained)
    const rightGlow = ctx.createRadialGradient(795, 950, 40, 795, 950, 380);
    rightGlow.addColorStop(0, tok.bg.ambientRight);
    rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(540, 340, 540, 1200);

    // Micro grid lines for tournament arena texture
    ctx.strokeStyle = tok.bg.grid;
    ctx.lineWidth = 1;
    for (let x = 60; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 60; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  drawHeader(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const tok = this.getThemeTokens();
    const left = engine.lanes.left;
    const right = engine.lanes.right;

    // Fixed Broadcast Header Chassis Backing
    const headerGrad = ctx.createLinearGradient(0, 0, 0, 312);
    headerGrad.addColorStop(0, tok.header.gradStops[0]);
    headerGrad.addColorStop(0.75, tok.header.gradStops[1]);
    headerGrad.addColorStop(1, tok.header.gradStops[2]);
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, w, 312);

    ctx.strokeStyle = tok.header.border;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(30, 312);
    ctx.lineTo(w - 30, 312);
    ctx.stroke();

    // 1. Top Broadcast Hook Banner
    const isUnderdogChallenge = engine.config.title?.includes('3 BALLS VS 12');
    const headerTitle = engine.config.title || '3 BALLS VS 12 — CAN THE UNDERDOG WIN?';
    const headerSubtitle = engine.config.subtitle || 'MULTIPLY (×3) VS ADD (+2) · RACE TO THE FINISH';

    ctx.save();
    const barW = w - 60;
    const barH = 88;
    const barX = 30;
    const barY = 20;

    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 20);
    ctx.fillStyle = tok.header.barBg;
    ctx.fill();
    ctx.strokeStyle = tok.header.barBorder;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const textCenter = w / 2;

    if (isUnderdogChallenge) {
      ctx.textBaseline = 'middle';
      ctx.font = '800 20px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.text.secondary;
      ctx.textAlign = 'center';
      ctx.fillText('VS', textCenter, barY + 32);

      ctx.font = '900 32px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.lanes.left.color;
      ctx.textAlign = 'right';
      ctx.fillText('3 BALLS', textCenter - 28, barY + 32);

      ctx.font = '900 32px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.lanes.right.color;
      ctx.textAlign = 'left';
      ctx.fillText('12 BALLS', textCenter + 28, barY + 32);

      ctx.font = '800 17px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.header.subtitleColor;
      ctx.textAlign = 'center';
      ctx.fillText('CAN THE UNDERDOG WIN?', textCenter, barY + 65);
    } else {
      ctx.font = '900 28px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.header.titleColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headerTitle, textCenter, barY + 32);

      ctx.font = '700 16px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = tok.header.subtitleColor;
      ctx.fillText(headerSubtitle, textCenter, barY + 65);
    }
    ctx.restore();

    // 2. Broadcast Team Scorecards
    const isLeftLeader = this.checkRaceLeader(left, right);
    const isRightLeader = this.checkRaceLeader(right, left);
    const isLeftWinner = engine.winner && engine.winner.side === 'left';
    const isRightWinner = engine.winner && engine.winner.side === 'right';

    this.drawScoreCard(left, 285, 216, isLeftLeader, isLeftWinner, engine);
    this.drawScoreCard(right, 795, 216, isRightLeader, isRightWinner, engine);

    // 3. Central Stage Indicator Badge
    const leadingTier = Math.max(left.currentTier, right.currentTier);
    const currentN = Math.min(6, leadingTier + 1);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 70, 196, 140, 38, 19);
    ctx.fillStyle = tok.header.badgeBg;
    ctx.fill();
    ctx.strokeStyle = tok.header.badgeBorder;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '900 14px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = tok.header.titleColor;
    ctx.fillText(`TIER ${currentN} / 6`, w / 2, 215);

    // Progress pips underneath badge
    const pipY = 248;
    const pipSpacing = 16;
    const startPipX = w / 2 - (5 * pipSpacing) / 2;
    for (let p = 0; p < 6; p++) {
      ctx.beginPath();
      ctx.arc(startPipX + p * pipSpacing, pipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = p < currentN ? tok.header.pipActive : tok.header.pipInactive;
      ctx.fill();
    }
    ctx.restore();
  }

  drawScoreCard(lane, centerX, centerY, isLeader = false, isWinner = false, engine = null) {
    const ctx = this.ctx;
    const tok = this.getThemeTokens();
    const laneTok = tok.lanes[lane.side] || tok.lanes.left;
    ctx.save();

    const cardW = 280;
    const cardH = 160;
    const cardX = centerX - cardW / 2;
    const cardY = centerY - cardH / 2;

    // Card background & subtle border
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = isWinner ? tok.scoreboard.cardBgWinner : tok.scoreboard.cardBg;
    ctx.fill();

    ctx.strokeStyle = isWinner ? tok.celebration.gold : (isLeader ? laneTok.color : tok.scoreboard.cardBorder);
    ctx.lineWidth = (isWinner || isLeader) ? 2.0 : 1.0;
    if (isLeader || isWinner) {
      ctx.shadowColor = isWinner ? tok.celebration.gold : laneTok.color;
      ctx.shadowBlur = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 1. Top row: Team Rule Pill (left) + Starting Baseline Headstart Pill (right)
    const teamName = lane.side === 'left' ? 'PURPLE' : 'GREEN';
    const ruleLabel = lane.ruleLabel || (lane.side === 'left' ? '×2' : '+8');
    const startCount = lane.initialBalls || (lane.side === 'left' ? 3 : 12);

    // Team Pill
    ctx.beginPath();
    ctx.roundRect(cardX + 12, cardY + 12, 140, 24, 12);
    ctx.fillStyle = isWinner ? 'rgba(255, 215, 0, 0.15)' : (this.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');
    ctx.fill();
    ctx.strokeStyle = isWinner ? tok.celebration.gold : laneTok.color;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = laneTok.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${teamName} · ${ruleLabel}`, cardX + 12 + 70, cardY + 24);

    // Start Pill (distinguishes baseline starting balls from current swarm)
    const startPillX = cardX + cardW - 12 - 96;
    ctx.beginPath();
    ctx.roundRect(startPillX, cardY + 12, 96, 24, 12);
    ctx.fillStyle = tok.scoreboard.metaPillBg;
    ctx.fill();
    ctx.strokeStyle = tok.scoreboard.cardBorder;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.scoreboard.metaPillText;
    ctx.fillText(`START: ${startCount}`, startPillX + 48, cardY + 24);

    // 2. Middle row: Big Crisp Numeric Current Score with punch scale
    const scoreVal = Math.round(lane.displayScore).toLocaleString();
    ctx.save();
    ctx.translate(centerX, cardY + 76);
    ctx.scale(lane.scoreScale, lane.scoreScale);

    ctx.font = '950 50px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.scoreboard.numberColor;
    if (isWinner || isLeader) {
      ctx.shadowColor = laneTok.color;
      ctx.shadowBlur = 10;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scoreVal, 0, 0);
    ctx.restore();

    // 3. Bottom row: Active Marbles in Arena (left) + Race Placement / Progress (right)
    const activeMarbles = lane.balls ? lane.balls.length : 0;
    const bottomPillY = cardY + cardH - 32;

    // Active marbles tag
    ctx.font = '700 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.scoreboard.labelColor;
    ctx.textAlign = 'left';
    ctx.fillText(`${activeMarbles} IN ARENA`, cardX + 16, bottomPillY + 10);

    // Race Placement / Tier Progress Tag (right aligned)
    // NEVER allow score to contradict race winner!
    let statusText = '';
    let statusColor = tok.scoreboard.statusActive;

    if (engine && engine.winner) {
      if (isWinner) {
        statusText = '🏆 1st PLACE';
        statusColor = tok.celebration.gold;
      } else {
        statusText = '2nd PLACE';
        statusColor = tok.scoreboard.metaPillText;
      }
    } else if (lane.reachedBottom) {
      statusText = '🏁 FINISHED';
      statusColor = tok.celebration.gold;
    } else if (isLeader) {
      statusText = `⚡ LEADER · T${lane.currentTier + 1}`;
      statusColor = tok.celebration.gold;
    } else {
      statusText = `TIER ${lane.currentTier + 1}/6`;
      statusColor = tok.scoreboard.metaPillText;
    }

    ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'right';
    ctx.fillText(statusText, cardX + cardW - 16, bottomPillY + 10);

    ctx.restore();
  }

  drawTracks(engine) {
    const ctx = this.ctx;
    const topY = engine.topY;
    const bottomY = engine.bottomY;
    const trackH = bottomY - topY;
    const tok = this.getThemeTokens();

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      const otherSide = side === 'left' ? 'right' : 'left';
      const otherLane = engine.lanes[otherSide];
      const laneTok = tok.lanes[side] || tok.lanes.left;
      const isLeader = this.checkRaceLeader(lane, otherLane);
      const isWinner = engine.winner && engine.winner.side === side;

      ctx.save();

      // Solid tournament arena chassis with dynamic leadership shading
      ctx.beginPath();
      ctx.roundRect(lane.minX, topY, lane.width, trackH, 20);
      ctx.fillStyle = isLeader ? laneTok.trackBgLeader : laneTok.trackBg;
      ctx.fill();

      // Active Chamber Spotlight: guide visual attention directly to current breakthrough zone
      const numStages = lane.tiles.length;
      const stageHeight = trackH / (numStages + 1);
      if (!isWinner && lane.currentTier < numStages) {
        const activeTileY = topY + (lane.currentTier + 1) * stageHeight;
        const chamberY = activeTileY - stageHeight;
        const spotlightGrad = ctx.createLinearGradient(lane.minX, chamberY, lane.minX, activeTileY);
        spotlightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        spotlightGrad.addColorStop(0.5, isLeader ? laneTok.glowColor : (this.theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)'));
        spotlightGrad.addColorStop(1, isLeader ? laneTok.glowColor : (this.theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'));
        ctx.fillStyle = spotlightGrad;
        ctx.fillRect(lane.minX + 4, chamberY, lane.width - 8, stageHeight);
      }

      // Active lane emphasis: illuminated border on active/leading lane
      if (isWinner) {
        ctx.strokeStyle = tok.celebration.gold;
        ctx.lineWidth = 3.0;
        ctx.shadowColor = tok.celebration.gold;
        ctx.shadowBlur = 12;
      } else if (isLeader || lane.scoreScale > 1.08) {
        ctx.strokeStyle = laneTok.color;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = laneTok.color;
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = laneTok.borderColor;
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Top accent line in team color
      ctx.beginPath();
      ctx.roundRect(lane.minX + 2, topY + 2, lane.width - 4, 5, 2.5);
      ctx.fillStyle = isWinner ? tok.celebration.gold : laneTok.color;
      ctx.fill();

      // Subtle horizontal chamber guides
      ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 1;
      for (let s = 1; s <= numStages; s++) {
        const lineY = topY + s * stageHeight;
        ctx.beginPath();
        ctx.moveTo(lane.minX + 8, lineY);
        ctx.lineTo(lane.maxX - 8, lineY);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  checkRaceLeader(lane, other) {
    if (lane.reachedBottom && !other.reachedBottom) return true;
    if (other.reachedBottom && !lane.reachedBottom) return false;
    if (lane.currentTier > other.currentTier) return true;
    if (lane.currentTier < other.currentTier) return false;

    const t1 = lane.tiles[lane.currentTier];
    const t2 = other.tiles[other.currentTier];
    if (t1 && t2) {
      const dmg1 = t1.maxHP - t1.currentHP;
      const dmg2 = t2.maxHP - t2.currentHP;
      if (Math.abs(dmg1 - dmg2) > 3) return dmg1 > dmg2;
    }
    return lane.exactScore > other.exactScore;
  }

  drawObstaclesAndTiles(engine) {
    const ctx = this.ctx;

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];

      // 1. Draw Pachinko Pegs (3D Chrome Arcade Pinball Bumpers)
      for (const peg of lane.pegs) {
        ctx.save();
        const r = peg.radius;

        // Subtle contact shadow
        ctx.beginPath();
        ctx.arc(peg.x, peg.y + 2, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();

        // 3D Metallic Chrome Peg
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
        const pegGrad = ctx.createRadialGradient(peg.x - r * 0.35, peg.y - r * 0.35, 1, peg.x, peg.y, r);
        if (peg.glow > 0.05) {
          pegGrad.addColorStop(0, '#ffffff');
          pegGrad.addColorStop(0.4, '#ffffff');
          pegGrad.addColorStop(1, lane.color);
        } else {
          pegGrad.addColorStop(0, '#ffffff');
          pegGrad.addColorStop(0.28, '#e2e8f0');
          pegGrad.addColorStop(0.70, '#94a3b8');
          pegGrad.addColorStop(1, '#475569');
        }
        ctx.fillStyle = pegGrad;
        ctx.fill();

        // Dark nickel outer rim with crisp chrome outline
        ctx.strokeStyle = peg.glow > 0.05 ? '#ffffff' : 'rgba(255, 255, 255, 0.40)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Impact flash shockwave ring when hit
        if (peg.glow > 0.15) {
          ctx.beginPath();
          ctx.arc(peg.x, peg.y, r + peg.glow * 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${peg.glow * 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 2. Draw Multiplier Barrier Tiles (Interactive Kinetic Energy Gates)
      for (const tile of lane.tiles) {
        ctx.save();
        const tileX = tile.minX;
        const tileY = tile.y - tile.height / 2;
        const tileW = tile.width;
        const tileH = tile.height;
        const isActive = (tile.index === lane.currentTier);

        if (tile.intact) {
          // A. Metallic Anchor Pylons on Lane Walls (Visual Support Brackets)
          const pylonW = 18;
          ctx.fillStyle = '#181e2e';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1.2;

          // Left Pylon
          ctx.beginPath();
          ctx.roundRect(tileX, tileY - 4, pylonW, tileH + 8, [6, 2, 2, 6]);
          ctx.fill();
          ctx.stroke();

          // Left pylon neon power conduit
          ctx.beginPath();
          ctx.moveTo(tileX + pylonW - 3, tileY + 2);
          ctx.lineTo(tileX + pylonW - 3, tileY + tileH - 2);
          ctx.strokeStyle = isActive ? lane.color : 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Right Pylon
          ctx.beginPath();
          ctx.roundRect(tileX + tileW - pylonW, tileY - 4, pylonW, tileH + 8, [2, 6, 6, 2]);
          ctx.fillStyle = '#181e2e';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();

          // Right pylon neon power conduit
          ctx.beginPath();
          ctx.moveTo(tileX + tileW - pylonW + 3, tileY + 2);
          ctx.lineTo(tileX + tileW - pylonW + 3, tileY + tileH - 2);
          ctx.strokeStyle = isActive ? lane.color : 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // B. Unified Arcade Energy Barrier / Crystalline Gate
          const fieldX = tileX + pylonW + 2;
          const fieldW = tileW - (pylonW * 2) - 4;
          const hpRatio = Math.max(0, Math.min(1.0, tile.currentHP / tile.maxHP));
          const isWarning = (hpRatio < 0.28);
          const warningPulse = isWarning ? (Math.sin(engine.simTime * 18) * 0.25 + 0.75) : 1.0;
          const isHitFlash = (tile.glowIntensity > 0.15);

          // 1. Crystal Substrate Body (Rounded continuous slab)
          ctx.beginPath();
          ctx.roundRect(fieldX, tileY + 2, fieldW, tileH - 4, 8);
          const bodyGrad = ctx.createLinearGradient(fieldX, tileY, fieldX, tileY + tileH);
          bodyGrad.addColorStop(0, '#0c111e');
          bodyGrad.addColorStop(0.5, '#131b2e');
          bodyGrad.addColorStop(1, '#090d18');
          ctx.fillStyle = bodyGrad;
          ctx.fill();

          // 2. Dynamic Energy Shield / Plasma Core
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8, 6);
          ctx.clip();

          // Internal Shield Plasma Fill
          const shieldGrad = ctx.createLinearGradient(fieldX, tileY + 4, fieldX + fieldW, tileY + 4);
          if (isHitFlash) {
            shieldGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            shieldGrad.addColorStop(0.5, isWarning ? 'rgba(255, 170, 0, 0.50)' : `rgba(${lane.side === 'left' ? '245,154,255' : '178,255,138'}, 0.50)`);
            shieldGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
          } else if (isWarning) {
            // Vibrant warning state: pulsing amber/neon warning hue
            shieldGrad.addColorStop(0, `rgba(255, 80, 0, ${0.15 * warningPulse})`);
            shieldGrad.addColorStop(0.5, `rgba(255, 185, 0, ${0.40 * warningPulse})`);
            shieldGrad.addColorStop(1, `rgba(255, 80, 0, ${0.15 * warningPulse})`);
          } else if (isActive) {
            // Stable charged team color energy field
            const shieldAlpha = 0.20 + hpRatio * 0.22;
            shieldGrad.addColorStop(0, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${shieldAlpha * 0.6})`);
            shieldGrad.addColorStop(0.5, `rgba(${lane.side === 'left' ? '245,154,255' : '178,255,138'}, ${shieldAlpha})`);
            shieldGrad.addColorStop(1, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${shieldAlpha * 0.6})`);
          } else {
            shieldGrad.addColorStop(0, 'rgba(50, 65, 95, 0.15)');
            shieldGrad.addColorStop(0.5, 'rgba(70, 90, 130, 0.25)');
            shieldGrad.addColorStop(1, 'rgba(50, 65, 95, 0.15)');
          }
          ctx.fillStyle = shieldGrad;
          ctx.fillRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8);

          // Subtle horizontal energy scanlines
          ctx.strokeStyle = isWarning
            ? `rgba(255, 190, 0, ${0.12 * warningPulse})`
            : (isActive ? `rgba(255, 255, 255, 0.08)` : 'rgba(255, 255, 255, 0.03)');
          ctx.lineWidth = 1.0;
          for (let ly = tileY + 8; ly < tileY + tileH - 8; ly += 5) {
            ctx.beginPath();
            ctx.moveTo(fieldX + 4, ly);
            ctx.lineTo(fieldX + fieldW - 4, ly);
            ctx.stroke();
          }

          // 3. Dynamic Internal Shield Energy Excitation & Stress Field (Zero Disconnected Slashes)
          // Clean team-color energy pulse responding to cumulative barrier degradation
          if (hpRatio < 0.85) {
            const stressAmount = Math.max(0, 1.0 - hpRatio);
            const stressAlpha = Math.min(0.85, stressAmount * 0.9);
            
            ctx.save();
            const stressGrad = ctx.createLinearGradient(fieldX, tileY, fieldX + fieldW, tileY);
            if (isWarning) {
              stressGrad.addColorStop(0, `rgba(255, 70, 0, ${stressAlpha * 0.35})`);
              stressGrad.addColorStop(0.5, `rgba(255, 180, 0, ${stressAlpha * 0.65})`);
              stressGrad.addColorStop(1, `rgba(255, 70, 0, ${stressAlpha * 0.35})`);
            } else {
              stressGrad.addColorStop(0, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${stressAlpha * 0.25})`);
              stressGrad.addColorStop(0.5, `rgba(255, 255, 255, ${stressAlpha * 0.45})`);
              stressGrad.addColorStop(1, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${stressAlpha * 0.25})`);
            }
            ctx.fillStyle = stressGrad;
            ctx.fillRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8);
            ctx.restore();
          }

          ctx.restore(); // end clip

          // 4. Sleek Internal Durability Gauge (High-Tech Arcade Power Rail)
          const gaugePad = 16;
          const gaugeX = fieldX + gaugePad;
          const gaugeW = fieldW - (gaugePad * 2);
          const gaugeH = 4;
          const gaugeY = tileY + tileH - 8;

          // Gauge Track Backing
          ctx.fillStyle = 'rgba(4, 7, 14, 0.85)';
          ctx.beginPath();
          ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Luminous Gauge Fill
          if (hpRatio > 0.01) {
            const fillW = Math.max(3, gaugeW * hpRatio);
            const fillGrad = ctx.createLinearGradient(gaugeX, gaugeY, gaugeX + fillW, gaugeY);
            if (isWarning) {
              fillGrad.addColorStop(0, '#ff3d00');
              fillGrad.addColorStop(0.7, '#ff9100');
              fillGrad.addColorStop(1, '#ffd700');
            } else if (isActive) {
              fillGrad.addColorStop(0, lane.color);
              fillGrad.addColorStop(0.6, lane.accentColor);
              fillGrad.addColorStop(1, '#ffffff');
            } else {
              fillGrad.addColorStop(0, 'rgba(80, 105, 145, 0.5)');
              fillGrad.addColorStop(1, 'rgba(140, 165, 210, 0.7)');
            }
            ctx.fillStyle = fillGrad;
            ctx.beginPath();
            ctx.roundRect(gaugeX, gaugeY, fillW, gaugeH, 2);
            ctx.fill();

            // Leading Edge Energy Bead
            if (isActive && hpRatio > 0.05) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(gaugeX + fillW, gaugeY + gaugeH / 2, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = isWarning ? '#ff9100' : lane.accentColor;
              ctx.shadowBlur = 6;
              ctx.fill();
              ctx.restore();
            }
          }

          // Gauge Calibrated Tick Marks
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1.0;
          for (let t = 1; t <= 3; t++) {
            const tx = gaugeX + (gaugeW / 4) * t;
            ctx.beginPath();
            ctx.moveTo(tx, gaugeY - 1);
            ctx.lineTo(tx, gaugeY + gaugeH + 1);
            ctx.stroke();
          }

          // 5. Crystalline Outer Frame & Top-Edge Specular Highlight
          ctx.beginPath();
          ctx.roundRect(fieldX, tileY + 2, fieldW, tileH - 4, 8);
          ctx.strokeStyle = isHitFlash
            ? '#ffffff'
            : (isWarning
                ? `rgba(255, 140, 0, ${0.65 * warningPulse + 0.25})`
                : (isActive ? `rgba(255, 255, 255, 0.45)` : 'rgba(255, 255, 255, 0.16)'));
          ctx.lineWidth = isActive ? 1.5 : 1.0;
          if (isActive || isWarning) {
            ctx.shadowColor = isWarning ? '#ff5722' : lane.color;
            ctx.shadowBlur = (isWarning ? 12 : 8) * warningPulse;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Top edge specular glass bevel
          ctx.beginPath();
          ctx.moveTo(fieldX + 8, tileY + 3.5);
          ctx.lineTo(fieldX + fieldW - 8, tileY + 3.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
          ctx.lineWidth = 1.0;
          ctx.stroke();

          // C. Central Kinetic Multiplier Capsule (Seamlessly Docked Arcade Core)
          const coreW = 108;
          const coreH = tileH + 8;
          const coreX = tileX + (tileW - coreW) / 2;
          const coreY = tile.y - coreH / 2;
          const pulse = Math.sin(engine.simTime * 6.5) * 0.12 + 0.88;

          ctx.beginPath();
          ctx.roundRect(coreX, coreY, coreW, coreH, coreH / 2);
          const coreGrad = ctx.createLinearGradient(coreX, coreY, coreX, coreY + coreH);
          const isTriggerActive = (tile.triggerPulse && tile.triggerPulse > 0.05);
          if (tile.triggerPulse) tile.triggerPulse *= 0.90;

          // Always maintain a rich, high-contrast dark crystal body for maximum text legibility
          if (isTriggerActive || tile.glowIntensity > 0.25) {
            coreGrad.addColorStop(0, '#1c243a');
            coreGrad.addColorStop(0.5, '#121828');
            coreGrad.addColorStop(1, '#090d16');
          } else if (isActive) {
            coreGrad.addColorStop(0, '#161d30');
            coreGrad.addColorStop(0.5, '#0e1322');
            coreGrad.addColorStop(1, '#070a12');
          } else {
            coreGrad.addColorStop(0, '#101422');
            coreGrad.addColorStop(1, '#060810');
          }
          ctx.fillStyle = coreGrad;
          ctx.fill();

          // High-luminance neon border rim
          ctx.strokeStyle = (isTriggerActive || tile.glowIntensity > 0.2)
            ? '#ffffff'
            : (isActive ? lane.accentColor : 'rgba(255, 255, 255, 0.22)');
          ctx.lineWidth = isActive ? 2.2 : 1.2;
          if (isActive || isTriggerActive) {
            ctx.shadowColor = (isTriggerActive || tile.glowIntensity > 0.2) ? '#ffffff' : lane.color;
            ctx.shadowBlur = (isTriggerActive ? 18 : 10) * pulse;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Crisp Multiplier Rule Label with dark backdrop contrast
          ctx.font = '950 25px "Inter", "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.70)';
          ctx.fillText(tile.label, tileX + tileW / 2, tile.y);
          ctx.restore();

          // D. Attached Collision Kinetic Feedback (Tight Localized Contact Flares, No Semicircular Wireframes)
          if (tile.recentImpacts && tile.recentImpacts.length > 0) {
            for (const imp of tile.recentImpacts) {
              const age = engine.simTime - imp.time;
              if (age < 0.12) {
                const p = age / 0.12;
                const alpha = (1 - p) * imp.intensity;

                ctx.save();
                // Horizontal top surface kinetic energy pulse
                ctx.beginPath();
                const ripW = 14 * (1 - p);
                ctx.moveTo(Math.max(fieldX + 2, imp.x - ripW), tileY + 2);
                ctx.lineTo(Math.min(fieldX + fieldW - 2, imp.x + ripW), tileY + 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.90})`;
                ctx.lineWidth = 1.8 * (1 - p);
                ctx.shadowColor = lane.accentColor;
                ctx.shadowBlur = 6;
                ctx.stroke();

                // Tight kinetic impact starburst at contact point
                const starSize = 4.0 * (1 - p);
                ctx.beginPath();
                ctx.moveTo(imp.x - starSize, imp.y);
                ctx.lineTo(imp.x + starSize, imp.y);
                ctx.moveTo(imp.x, imp.y - starSize);
                ctx.lineTo(imp.x, imp.y + starSize);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
                ctx.lineWidth = 1.2;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 8;
                ctx.stroke();

                // Core contact spark
                ctx.beginPath();
                ctx.arc(imp.x, imp.y, 2.0 * (1 - p), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
                ctx.restore();
              }
            }
          }

        } else {
          // --- HIGH-SPEED LINEAR SEAM DISCHARGE & CLEAN OPEN GATEWAY ---
          const teamRgb = lane.side === 'left' ? '203, 114, 255' : '121, 239, 67';
          const accentRgb = lane.side === 'left' ? '245, 154, 255' : '178, 255, 138';

          if (tile.shatterTime !== undefined && (engine.simTime - tile.shatterTime < 0.11)) {
            const sAge = engine.simTime - tile.shatterTime;
            const p = sAge / 0.11;
            const alpha = 1.0 - p;
            const centerX = tileX + tileW / 2;
            const centerY = tile.y;

            ctx.save();

            // 1. Horizontal Linear Seam Plasma Discharge (Clean threshold snap, NO expanding circular shockwave)
            const seamW = tileW - 32;
            const seamX = tileX + 16;
            const seamGrad = ctx.createLinearGradient(seamX, centerY, seamX + seamW, centerY);
            seamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            seamGrad.addColorStop(0.2, `rgba(${teamRgb}, ${alpha * 0.75})`);
            seamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.95})`);
            seamGrad.addColorStop(0.8, `rgba(${teamRgb}, ${alpha * 0.75})`);
            seamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.beginPath();
            ctx.moveTo(seamX, centerY);
            ctx.lineTo(seamX + seamW, centerY);
            ctx.strokeStyle = seamGrad;
            ctx.lineWidth = 3.2 * (1 - p);
            ctx.shadowColor = lane.accentColor;
            ctx.shadowBlur = 12;
            ctx.stroke();

            // Secondary hairline core fracture
            ctx.beginPath();
            ctx.moveTo(seamX + 20, centerY);
            ctx.lineTo(seamX + seamW - 20, centerY);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 1.2 * (1 - p);
            ctx.shadowBlur = 0;
            ctx.stroke();

            // 2. Compact Trigger Core Starburst (Tight 12px radius, vanishes in 0.08s)
            if (sAge < 0.08) {
              const pCore = sAge / 0.08;
              const coreAlpha = 1.0 - pCore;
              const coreR = 4 + (1 - Math.pow(1 - pCore, 2)) * 8;

              ctx.beginPath();
              ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha * 0.9})`;
              ctx.shadowColor = lane.accentColor;
              ctx.shadowBlur = 10;
              ctx.fill();

              const flareLen = (1 - pCore) * 18;
              ctx.beginPath();
              ctx.moveTo(centerX - flareLen, centerY);
              ctx.lineTo(centerX + flareLen, centerY);
              ctx.moveTo(centerX, centerY - flareLen * 0.45);
              ctx.lineTo(centerX, centerY + flareLen * 0.45);
              ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha * 0.95})`;
              ctx.lineWidth = 1.4 * (1 - pCore);
              ctx.stroke();
            }

            ctx.restore();
          }

          // Open threshold with clean dotted energy line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(tileX + 16, tile.y);
          ctx.lineTo(tileX + tileW - 16, tile.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Gateway mounting pylons with persistent team illumination
          ctx.strokeStyle = lane.color;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(tileX, tileY + 4); ctx.lineTo(tileX + 12, tileY + 4);
          ctx.moveTo(tileX, tileY + tileH - 4); ctx.lineTo(tileX + 12, tileY + tileH - 4);
          ctx.moveTo(tileX + tileW, tileY + 4); ctx.lineTo(tileX + tileW - 12, tileY + 4);
          ctx.moveTo(tileX + tileW, tileY + tileH - 4); ctx.lineTo(tileX + tileW - 12, tileY + tileH - 4);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  drawBalls(engine) {
    const ctx = this.ctx;
    const t = engine.simTime;
    const tok = this.getThemeTokens();

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      const laneTok = tok.lanes[side] || tok.lanes.left;

      for (let i = 0; i < lane.balls.length; i++) {
        const b = lane.balls[i];
        if (!b || b._dead) continue;

        ctx.save();

        // Emergence scaling & multiplier energy ionization wake
        let scale = 1.0;
        let emergenceFlash = 0;
        if (b.spawnTime !== undefined) {
          const age = t - b.spawnTime;
          if (age < 0.28) {
            const p = Math.max(0, age / 0.28);
            scale = 0.40 + 0.60 * Math.sin(p * Math.PI * 0.5);
            emergenceFlash = 1.0 - p;
          }
        }

        const r = b.radius * scale;

        // 1. Contact shadow under each ball
        ctx.beginPath();
        ctx.arc(b.x + 1.5, b.y + 2, r, 0, Math.PI * 2);
        ctx.fillStyle = tok.balls.shadow;
        ctx.fill();

        // 2. High-Density Silhouette Contrast Rim
        // Guarantees each individual marble remains sharply separated in dense swarms
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 0.9, 0, Math.PI * 2);
        ctx.fillStyle = tok.balls.contour;
        ctx.fill();

        // 3. 3D Spherical Shading with Tactile Glass Depth
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(
          b.x - r * 0.35,
          b.y - r * 0.35,
          Math.max(0.5, r * 0.08),
          b.x,
          b.y,
          r * 1.05
        );

        if (emergenceFlash > 0.05) {
          // Radiant energy gleam when newly multiplied by gate
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.35, '#ffffff');
          ballGrad.addColorStop(0.80, laneTok.accentColor);
          ballGrad.addColorStop(1, laneTok.color);
        } else {
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.24, laneTok.accentColor);
          ballGrad.addColorStop(0.72, laneTok.color);
          ballGrad.addColorStop(1, laneTok.darkBase);
        }

        ctx.fillStyle = ballGrad;
        if (emergenceFlash > 0.08) {
          ctx.shadowColor = laneTok.accentColor;
          ctx.shadowBlur = 10 * emergenceFlash;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // 4. Primary razor-sharp specular reflection
        ctx.beginPath();
        ctx.arc(b.x - r * 0.33, b.y - r * 0.33, Math.max(1, r * 0.24), 0, Math.PI * 2);
        ctx.fillStyle = tok.balls.specular;
        ctx.fill();

        // 5. Secondary soft Fresnel rim reflection
        ctx.beginPath();
        ctx.arc(b.x + r * 0.28, b.y + r * 0.28, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
        ctx.fillStyle = tok.balls.fresnel;
        ctx.fill();

        ctx.restore();
      }
    }
  }

  drawParticlesAndTexts(engine) {
    const ctx = this.ctx;

    // Draw Particles (Shards, Sparks, Spawn Bursts)
    for (let i = 0; i < engine.particles.length; i++) {
      const p = engine.particles[i];
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type === 'shard') {
        // Tumbling geometric crystalline shard
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);

        ctx.beginPath();
        if (p.vertices && p.vertices.length > 2) {
          ctx.moveTo(p.vertices[0][0], p.vertices[0][1]);
          for (let v = 1; v < p.vertices.length; v++) {
            ctx.lineTo(p.vertices[v][0], p.vertices[v][1]);
          }
          ctx.closePath();
        } else {
          ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        // Faceted crystal gradient fill
        const shardGrad = ctx.createLinearGradient(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
        shardGrad.addColorStop(0, '#ffffff');
        shardGrad.addColorStop(0.35, p.accentColor || p.color);
        shardGrad.addColorStop(1, p.color);
        ctx.fillStyle = shardGrad;
        ctx.fill();

        // Glowing specular facet edge
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Interior specular facet creases creating authentic 3D crystal depth
        if (p.vertices && p.vertices.length > 2) {
          ctx.beginPath();
          if (p.vertices.length === 3) {
            ctx.moveTo(p.vertices[0][0], p.vertices[0][1]);
            ctx.lineTo(0, 0);
          } else if (p.vertices.length === 4) {
            ctx.moveTo(p.vertices[0][0], p.vertices[0][1]);
            ctx.lineTo(p.vertices[2][0], p.vertices[2][1]);
            ctx.moveTo(p.vertices[1][0], p.vertices[1][1]);
            ctx.lineTo(p.vertices[3][0], p.vertices[3][1]);
          }
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

      } else if (p.type === 'spawn_burst') {
        // Multiplier emergence ring
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === 'ember') {
        // Atmospheric celebratory golden motes
        ctx.fillStyle = p.color || '#ffd700';
        ctx.shadowColor = p.color || '#ffd700';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

      } else if (p.color === '#00f0ff' || p.color === '#ff007f') {
        // High-contrast arena kinetic spark
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.82 + 0.18 * Math.sin((p.maxLife - p.life) * 5.2 + p.x);
        const r = (p.radius || 2.0) * pulse;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else {
        // High-luminance spark / crystal ember particle
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
        ctx.fill();

        // Brilliant white-hot spark center
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.radius || 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    // Draw Floating Multiplier Tags (e.g. ×2! or +8!)
    for (let i = 0; i < engine.floatingTexts.length; i++) {
      const ft = engine.floatingTexts[i];
      ctx.save();
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = '900 36px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 14;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }
  }

  drawFinishLineAndProgress(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const bottomY = engine.bottomY;
    const tok = this.getThemeTokens();

    // Collector trays at bottom
    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(lane.minX + 8, bottomY - 55, lane.width - 16, 60, 12);
      ctx.fillStyle = tok.reservoir.trayBg;
      ctx.fill();
      ctx.strokeStyle = tok.reservoir.trayBorder;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // Dashed finish line
    ctx.save();
    ctx.strokeStyle = tok.reservoir.finishLine;
    ctx.lineWidth = 2.0;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(50, bottomY - 60);
    ctx.lineTo(520, bottomY - 60);
    ctx.moveTo(560, bottomY - 60);
    ctx.lineTo(1030, bottomY - 60);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Sleek progress bar at bottom edge
    const progress = Math.min(1.0, engine.simTime / (engine.durationSeconds || 20));
    const barY = 1888;
    const barH = 6;
    ctx.save();
    ctx.fillStyle = tok.reservoir.progressBg;
    ctx.fillRect(60, barY, w - 120, barH);

    const activeColor = engine.winner ? tok.celebration.gold : tok.text.gold;
    ctx.fillStyle = activeColor;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(60, barY, (w - 120) * progress, barH);
    ctx.restore();
  }

  // World-space Arena Celebration Lighting (Sleek broadcast spotlighting resting marbles in reservoir)
  drawArenaCelebrationGlow(engine) {
    const ctx = this.ctx;
    const winner = engine.winner;
    if (!winner) return;
    const tok = this.getThemeTokens();

    ctx.save();
    ctx.globalAlpha = engine.winnerBannerAlpha;

    const winLane = engine.lanes[winner.side];
    const otherSide = winner.side === 'left' ? 'right' : 'left';
    const loseLane = engine.lanes[otherSide];
    const winTok = tok.lanes[winner.side] || tok.lanes.left;

    // 1. Subtle, elegant dimming veil over losing lane to direct focal attention
    if (loseLane) {
      ctx.fillStyle = this.theme === 'dark' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(loseLane.minX - 6, engine.topY, loseLane.width + 12, engine.trackHeight + 70);
    }

    // 2. Crisp, Professional Spotlight over Winning Chassis & Reservoir
    if (winLane) {
      const reservoirCenterX = winLane.minX + winLane.width / 2;
      const reservoirFloorY = engine.bottomY - 25;

      const winAura = ctx.createRadialGradient(
        reservoirCenterX,
        reservoirFloorY,
        15,
        reservoirCenterX,
        reservoirFloorY,
        220
      );
      winAura.addColorStop(0, winTok.glowColor);
      winAura.addColorStop(0.5, winTok.subtleBg || 'rgba(0,0,0,0)');
      winAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = winAura;
      ctx.fillRect(winLane.minX - 20, engine.bottomY - 100, winLane.width + 40, 140);

      // Clean, refined team-accented outline around the winning lane chassis
      ctx.strokeStyle = tok.celebration.gold;
      ctx.lineWidth = 2.0;
      ctx.shadowColor = tok.celebration.gold;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(winLane.minX, engine.topY, winLane.width, engine.trackHeight, 20);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Crisp metallic trim on reservoir collector tray
      ctx.strokeStyle = tok.reservoir.trayBorder;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(winLane.minX + 8, engine.bottomY - 55, winLane.width - 16, 60, 12);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Broadcast-Grade Victory Presentation (Sleek minimalist esports lower-third banner)
  drawCelebration(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const winner = engine.winner;
    if (!winner) return;

    ctx.save();
    ctx.globalAlpha = engine.winnerBannerAlpha;
    const tok = this.getThemeTokens();

    const leftLane = engine.lanes.left;
    const rightLane = engine.lanes.right;
    const isLeftWin = winner.side === 'left';
    const isDraw = !!winner.isDraw;

    const leftBalls = leftLane.balls ? leftLane.balls.length : (leftLane.exactScore || 0);
    const rightBalls = rightLane.balls ? rightLane.balls.length : (rightLane.exactScore || 0);
    const winnerTeamName = isDraw ? 'DRAW' : (isLeftWin ? 'PURPLE' : 'GREEN');

    // 1. Frosted Esports Lower-Third Container
    const cardW = 960;
    const cardH = 142;
    const cardX = (w - cardW) / 2;
    const cardY = 1680;

    // Ambient drop shadow
    ctx.save();
    ctx.shadowColor = tok.celebration.cardShadow;
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = tok.celebration.cardBg;
    ctx.fill();
    ctx.restore();

    // Subtle glass vertical gradient fill
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = tok.celebration.cardBg;
    ctx.fill();

    // 1px Refined Metallic/Neon Border
    ctx.strokeStyle = tok.celebration.cardBorder;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Specular entry sheen sweep across the glass card
    const sheenProgress = Math.min(1.0, engine.winnerBannerAlpha * 1.4);
    const sheenX = cardX - 80 + sheenProgress * (cardW + 160);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 18);
    ctx.clip();
    const sheenGrad = ctx.createLinearGradient(sheenX - 35, cardY, sheenX + 35, cardY + cardH);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sheenGrad.addColorStop(0.5, this.theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(sheenX - 50, cardY, 100, cardH);
    ctx.restore();

    // -------------------------------------------------------------
    // Tier 1: Top Broadcast Badge & Motion Replay Cue (cardY + 13)
    // -------------------------------------------------------------
    // Championship Winner Broadcast Badge
    const badgeX = cardX + 22;
    const badgeY = cardY + 13;
    const badgeW = 260;
    const badgeH = 26;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fillStyle = this.theme === 'dark' ? 'rgba(255, 215, 0, 0.14)' : 'rgba(217, 119, 6, 0.12)';
    ctx.fill();
    ctx.strokeStyle = tok.celebration.gold;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.celebration.gold;
    ctx.fillText(`👑 VICTORY · ${winnerTeamName} TEAM`, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Center Headline: Clearly Explains the Actual Deciding Condition!
    let decidingReason = 'CHAMPIONSHIP VICTORY';
    if (isDraw) {
      decidingReason = 'SIMULTANEOUS DRAW AT FINISH';
    } else if (winner.finishTime && !winner.isTimeout) {
      decidingReason = `FIRST TO CLEAR TIER 6 & REACH RESERVOIR (${winner.finishTime.toFixed(2)}s)`;
    } else if (winner.isTimeout) {
      decidingReason = `DECIDED ON TIER PROGRESS AT TIMEOUT`;
    }

    ctx.font = '700 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.celebration.headline;
    ctx.fillText(decidingReason, w / 2, badgeY + badgeH / 2);

    // Replay Cue: Sleek Minimalist Loop Cue
    const replayW = 118;
    const replayH = 26;
    const replayX = cardX + cardW - 22 - replayW;
    const replayY = cardY + 13;

    ctx.beginPath();
    ctx.roundRect(replayX, replayY, replayW, replayH, 6);
    ctx.fillStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
    ctx.fill();
    ctx.strokeStyle = tok.celebration.cardBorder;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.celebration.statNumber;
    ctx.fillText('REPLAY ↻', replayX + replayW / 2, replayY + replayH / 2);

    // Clean Horizontal Hairline Divider
    ctx.beginPath();
    ctx.moveTo(cardX + 20, cardY + 47);
    ctx.lineTo(cardX + cardW - 20, cardY + 47);
    ctx.strokeStyle = tok.celebration.divider;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // -------------------------------------------------------------
    // Tier 2: Physical Marble Scoreboard Comparison (cardY + 50 to cardY + 135)
    // -------------------------------------------------------------
    // Left Team Presentation Block
    const leftIsWinner = isLeftWin;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX + 24, cardY + 58, 4, 66, 2);
    ctx.fillStyle = leftIsWinner ? tok.celebration.gold : tok.lanes.left.color;
    ctx.fill();

    // Large Numeric Score
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '950 44px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = leftIsWinner ? tok.celebration.statNumber : tok.celebration.statLabel;
    ctx.fillText(leftBalls.toLocaleString(), cardX + 38, cardY + 91);

    // Team Identity & Physical Marbles Label
    ctx.font = '800 14px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.lanes.left.color;
    ctx.fillText('PURPLE TEAM', cardX + 135, cardY + 80);

    ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = leftIsWinner ? tok.celebration.gold : tok.celebration.statLabel;
    const leftStatus = leftIsWinner ? 'CHAMPION 🏆 (1st PLACE)' : `RUNNER-UP · TIER ${Math.min(6, leftLane.currentTier + 1)}/6`;
    ctx.fillText(`${leftBalls} MARBLES · ${leftStatus}`, cardX + 135, cardY + 102);
    ctx.restore();

    // Center VS / Match Verdict Divider
    ctx.save();
    const midPillW = 90;
    const midPillH = 26;
    const midPillX = w / 2 - midPillW / 2;
    const midPillY = cardY + 78;

    ctx.beginPath();
    ctx.roundRect(midPillX, midPillY, midPillW, midPillH, 13);
    ctx.fillStyle = tok.celebration.vsBg;
    ctx.fill();
    ctx.strokeStyle = tok.celebration.vsBorder;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 11px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.celebration.vsText;
    ctx.fillText('VS', w / 2, midPillY + midPillH / 2);
    ctx.restore();

    // Right Team Presentation Block
    const rightIsWinner = !isLeftWin && winner.side === 'right';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX + cardW - 28, cardY + 58, 4, 66, 2);
    ctx.fillStyle = rightIsWinner ? tok.celebration.gold : tok.lanes.right.color;
    ctx.fill();

    // Large Numeric Score (Right-aligned)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '950 44px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = rightIsWinner ? tok.celebration.statNumber : tok.celebration.statLabel;
    ctx.fillText(rightBalls.toLocaleString(), cardX + cardW - 38, cardY + 91);

    // Team Identity & Physical Marbles Label (Right-aligned)
    ctx.font = '800 14px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.lanes.right.color;
    ctx.fillText('GREEN TEAM', cardX + cardW - 135, cardY + 80);

    ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = rightIsWinner ? tok.celebration.gold : tok.celebration.statLabel;
    const rightStatus = rightIsWinner ? 'CHAMPION 🏆 (1st PLACE)' : `RUNNER-UP · TIER ${Math.min(6, rightLane.currentTier + 1)}/6`;
    ctx.fillText(`${rightBalls} MARBLES · ${rightStatus}`, cardX + cardW - 135, cardY + 102);
    ctx.restore();

    ctx.restore();
  }

  drawWinnerBanner(engine) {
    this.drawCelebration(engine);
  }

  drawWatermark() {
    const ctx = this.ctx;
    const tok = this.getThemeTokens();
    ctx.save();
    ctx.font = '800 13px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.watermark;
    ctx.textAlign = 'center';
    ctx.fillText('BURSTPOINT · ARCADE SIMULATION', this.width / 2, 1905);
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.CanvasRenderer = CanvasRenderer;
  window.VideoDirector = VideoDirector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasRenderer, VideoDirector };
}
