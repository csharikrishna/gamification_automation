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

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width || 1080;
    this.height = canvas.height || 1920;
    this.director = new VideoDirector();
  }

  render(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

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

    this.director.restoreCamera(ctx);
    ctx.restore();

    // 3. Screen-Space UI Overlays (Fixed broadcast header, scoreboard, winner banner)
    this.drawHeader(engine);

    // 4. Winner Celebration Overlay (if completed)
    if (engine.winnerBannerAlpha > 0.01) {
      this.drawWinnerBanner(engine);
    }

    // 5. Brand watermark
    this.drawWatermark();
  }

  drawBackground(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Rich dark tournament chassis background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#060810');
    bgGrad.addColorStop(0.35, '#0a0d18');
    bgGrad.addColorStop(0.7, '#070a14');
    bgGrad.addColorStop(1, '#04060c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const left = engine.lanes.left;
    const right = engine.lanes.right;

    // Left ambient glow (restrained)
    const leftGlow = ctx.createRadialGradient(285, 950, 60, 285, 950, 480);
    leftGlow.addColorStop(0, left.glowColor || 'rgba(168,85,247,0.22)');
    leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 340, 540, 1200);

    // Right ambient glow (restrained)
    const rightGlow = ctx.createRadialGradient(795, 950, 60, 795, 950, 480);
    rightGlow.addColorStop(0, right.glowColor || 'rgba(34,197,94,0.22)');
    rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(540, 340, 540, 1200);

    // Micro grid lines for tournament arena texture
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
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
    const left = engine.lanes.left;
    const right = engine.lanes.right;

    // Fixed Broadcast Header Chassis Backing
    const headerGrad = ctx.createLinearGradient(0, 0, 0, 312);
    headerGrad.addColorStop(0, '#060810');
    headerGrad.addColorStop(0.85, '#090d18');
    headerGrad.addColorStop(1, '#0c1120');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, w, 312);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(30, 312);
    ctx.lineTo(w - 30, 312);
    ctx.stroke();

    // 1. Top Broadcast Hook Banner (High mobile contrast & large bold typography)
    const isUnderdogChallenge = engine.config.title?.includes('3 BALLS VS 12');
    const headerTitle = engine.config.title || '3 BALLS VS 12 — CAN THE UNDERDOG WIN?';
    const headerSubtitle = engine.config.subtitle || 'MULTIPLY (×3) VS ADD (+2) · RACE TO THE FINISH';

    ctx.save();

    // Hook Container Bar
    const barW = w - 60;
    const barH = 100;
    const barX = 30;
    const barY = 24;

    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 22);
    ctx.fillStyle = 'rgba(14, 18, 30, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const textCenter = w / 2;

    if (isUnderdogChallenge) {
      // High-impact multi-colored title (Symmetrically anchored around textCenter)
      ctx.textBaseline = 'middle';

      // Center "VS"
      ctx.font = '800 22px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
      ctx.textAlign = 'center';
      ctx.fillText('VS', textCenter, barY + 36);

      // Left team "3 BALLS" (right-aligned to leave clean gap before VS)
      ctx.font = '900 36px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = left.color;
      ctx.textAlign = 'right';
      ctx.fillText('3 BALLS', textCenter - 26, barY + 36);

      // Right team "12 BALLS" (left-aligned to leave clean gap after VS)
      ctx.font = '900 36px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = right.color;
      ctx.textAlign = 'left';
      ctx.fillText('12 BALLS', textCenter + 26, barY + 36);

      // Subtitle
      ctx.font = '800 20px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText('CAN THE UNDERDOG WIN?', textCenter, barY + 74);
    } else {
      // Dynamic fallback for custom titles
      ctx.font = '900 30px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headerTitle, textCenter, barY + 36);

      ctx.font = '700 18px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(headerSubtitle, textCenter, barY + 74);
    }

    ctx.restore();

    // 2. Broadcast Team Scorecards
    const isLeftLeader = this.checkRaceLeader(left, right);
    const isRightLeader = this.checkRaceLeader(right, left);
    const isLeftWinner = engine.winner && engine.winner.side === 'left';
    const isRightWinner = engine.winner && engine.winner.side === 'right';
    this.drawScoreCard(left, 285, 210, isLeftLeader, isLeftWinner);
    this.drawScoreCard(right, 795, 210, isRightLeader, isRightWinner);

    // 3. Central Stage Indicator Badge
    const leadingTier = Math.max(left.currentTier, right.currentTier);
    const currentN = Math.min(6, leadingTier + 1);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 75, 192, 150, 42, 21);
    ctx.fillStyle = 'rgba(16, 22, 36, 0.90)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = '900 16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`TIER ${currentN} / 6`, w / 2, 213);

    // Progress pips underneath badge
    const pipY = 246;
    const pipSpacing = 16;
    const startPipX = w / 2 - (5 * pipSpacing) / 2;
    for (let p = 0; p < 6; p++) {
      ctx.beginPath();
      ctx.arc(startPipX + p * pipSpacing, pipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = p < currentN ? '#ffd700' : 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
    }

    ctx.restore();
  }

  drawScoreCard(lane, centerX, centerY, isLeader = false, isWinner = false) {
    const ctx = this.ctx;
    ctx.save();

    // If race winner or leader, draw glowing crown badge cleanly above scorecard
    if (isWinner) {
      ctx.beginPath();
      ctx.roundRect(centerX - 68, centerY - 72, 136, 22, 11);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.fillStyle = '#0b0e18';
      ctx.font = '900 11px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏆 WINNER 🏆', centerX, centerY - 61);
    } else if (isLeader) {
      ctx.beginPath();
      ctx.roundRect(centerX - 55, centerY - 72, 110, 22, 11);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.fillStyle = '#0b0e18';
      ctx.font = '900 11px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑 LEADER', centerX, centerY - 61);
    }

    // Team Identity Tag (e.g. PURPLE · ×2 MULTIPLY or GREEN · +8 ADD)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.beginPath();
    ctx.roundRect(centerX - 130, centerY - 42, 260, 32, 16);
    ctx.fillStyle = isWinner ? 'rgba(255, 215, 0, 0.12)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#ffd700' : lane.color;
    ctx.lineWidth = isWinner ? 2.0 : 1.2;
    ctx.stroke();

    const teamIdentity = lane.side === 'left' ? 'PURPLE' : 'GREEN';
    const cleanRule = lane.ruleLabel.includes(teamIdentity) ? lane.ruleLabel : `${teamIdentity} · ${lane.ruleLabel}`;

    ctx.font = '800 15px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = lane.color;
    ctx.fillText(cleanRule, centerX, centerY - 26);

    // Big Crisp Numeric Score with Spring-Scale Punch
    const scoreVal = Math.round(lane.displayScore).toLocaleString();
    ctx.save();
    ctx.translate(centerX, centerY + 36);
    ctx.scale(lane.scoreScale, lane.scoreScale);

    ctx.font = '950 62px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 16;
    ctx.fillText(scoreVal, 0, 0);
    ctx.restore();

    // Physical marble count badge: explicitly distinguishes actual balls in arena vs score
    const activeMarbles = lane.balls ? lane.balls.length : 0;
    ctx.font = '800 13px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    if (Math.round(lane.exactScore) !== activeMarbles) {
      ctx.fillText(`${activeMarbles} MARBLES IN ARENA (×${(lane.exactScore / activeMarbles).toFixed(1)} PWR)`, centerX, centerY + 78);
    } else {
      ctx.fillText(`${activeMarbles} MARBLES IN ARENA`, centerX, centerY + 78);
    }

    ctx.restore();
  }

  drawTracks(engine) {
    const ctx = this.ctx;
    const topY = engine.topY;
    const bottomY = engine.bottomY;
    const trackH = bottomY - topY;

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      const otherSide = side === 'left' ? 'right' : 'left';
      const otherLane = engine.lanes[otherSide];
      const isLeader = this.checkRaceLeader(lane, otherLane);
      const isWinner = engine.winner && engine.winner.side === side;

      ctx.save();

      // Solid tournament arena chassis with dynamic leadership shading
      ctx.beginPath();
      ctx.roundRect(lane.minX, topY, lane.width, trackH, 20);
      ctx.fillStyle = isLeader ? 'rgba(16, 21, 35, 0.94)' : 'rgba(11, 14, 24, 0.82)';
      ctx.fill();

      // Active Chamber Spotlight: guide visual attention directly to current breakthrough zone
      const numStages = lane.tiles.length;
      const stageHeight = trackH / (numStages + 1);
      if (!isWinner && lane.currentTier < numStages) {
        const activeTileY = topY + (lane.currentTier + 1) * stageHeight;
        const chamberY = activeTileY - stageHeight;
        const spotlightGrad = ctx.createLinearGradient(lane.minX, chamberY, lane.minX, activeTileY);
        spotlightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        spotlightGrad.addColorStop(0.5, isLeader ? (lane.side === 'left' ? 'rgba(203,114,255,0.08)' : 'rgba(121,239,67,0.08)') : 'rgba(255, 255, 255, 0.02)');
        spotlightGrad.addColorStop(1, isLeader ? (lane.side === 'left' ? 'rgba(203,114,255,0.15)' : 'rgba(121,239,67,0.15)') : 'rgba(255, 255, 255, 0.04)');
        ctx.fillStyle = spotlightGrad;
        ctx.fillRect(lane.minX + 4, chamberY, lane.width - 8, stageHeight);
      }

      // Active lane emphasis: illuminated border on active/leading lane
      if (isWinner) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 16;
      } else if (isLeader || lane.scoreScale > 1.08) {
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = 2.4;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Top accent line in team color
      ctx.beginPath();
      ctx.roundRect(lane.minX + 2, topY + 2, lane.width - 4, 6, 3);
      ctx.fillStyle = isWinner ? '#ffd700' : lane.color;
      ctx.fill();

      // Subtle horizontal chamber guides
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
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

          // 3. Subtle Organic Internal Crystalline Stress Cracks (Team Color Glow)
          // Strictly clipped inside the crystal body, omitted near center capsule
          if (tile.fractures && tile.fractures.length > 0 && hpRatio < 0.90) {
            const crackAmount = Math.max(0, 1.0 - hpRatio);
            const crackAlpha = Math.min(1.0, crackAmount * 1.25);
            // Team color glow ALWAYS preserved (purple for left, green for right)
            const glowColor = lane.color;
            const coreColor = lane.accentColor || '#ffffff';
            const halfW = tileW / 2;

            for (const f of tile.fractures) {
              const fx = tileX + f.x;
              // Ensure crack is outside center capsule area
              if (Math.abs(fx - (tileX + halfW)) < 55) continue;

              const depth = Math.min(f.depth || (f.len || 14), tileH - 7);
              const slant = f.slant !== undefined ? f.slant : Math.cos(f.angle || 0) * 0.4;
              const bDir = f.branchDir || (slant > 0 ? 1 : -1);
              const bLen = f.branchLen || (depth * 0.45);

              // Multi-segment crystalline cleavage path (zig-zag micro-facets)
              const y0 = tileY + 3;
              const y1 = y0 + depth * 0.35;
              const x1 = fx + slant * depth * 0.4;

              const y2 = y0 + depth * 0.70;
              const x2 = fx + slant * depth * 0.75 - bDir * 3;

              const y3 = y0 + depth;
              const x3 = fx + slant * depth;

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(fx, y0);
              ctx.lineTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.lineTo(x3, y3);

              // Secondary crystalline lattice bifurcation
              ctx.moveTo(x1, y1);
              ctx.lineTo(x1 + bDir * bLen, y1 + bLen * 0.55);

              if (depth > 14) {
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - bDir * (bLen * 0.5), y2 + bLen * 0.4);
              }

              // Layer 1: Diffuse team neon glow
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = 1.8;
              ctx.globalAlpha = crackAlpha * (isWarning ? 0.95 : 0.80);
              ctx.shadowColor = glowColor;
              ctx.shadowBlur = isWarning ? 9 : 6;
              ctx.stroke();

              // Layer 2: Sharp luminous crystalline core
              ctx.strokeStyle = coreColor;
              ctx.lineWidth = 0.85;
              ctx.globalAlpha = crackAlpha * 0.95;
              ctx.shadowBlur = 0;
              ctx.stroke();
              ctx.restore();
            }
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

          // D. Attached Collision Shockwave Ripples & Flashes (Tactile kinetic feedback from marble impacts)
          if (tile.recentImpacts && tile.recentImpacts.length > 0) {
            for (const imp of tile.recentImpacts) {
              const age = engine.simTime - imp.time;
              if (age < 0.22) {
                const p = age / 0.22;
                const ringRadius = 4 + p * 26;
                const alpha = (1 - p) * imp.intensity;

                ctx.save();
                // Localized semi-circular kinetic ripple arc into barrier
                ctx.beginPath();
                ctx.arc(imp.x, imp.y, ringRadius, 0, Math.PI);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.90})`;
                ctx.lineWidth = 1.8 * (1 - p);
                ctx.shadowColor = lane.accentColor;
                ctx.shadowBlur = 8;
                ctx.stroke();

                // Concentric inner harmonic wave
                ctx.beginPath();
                ctx.arc(imp.x, imp.y, ringRadius * 0.65, 0, Math.PI);
                ctx.strokeStyle = `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${alpha * 0.70})`;
                ctx.lineWidth = 1.2 * (1 - p);
                ctx.stroke();

                // Horizontal top surface kinetic energy pulse
                ctx.beginPath();
                const ripW = 20 * (1 - p);
                ctx.moveTo(Math.max(fieldX + 2, imp.x - ripW), tileY + 2);
                ctx.lineTo(Math.min(fieldX + fieldW - 2, imp.x + ripW), tileY + 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.90})`;
                ctx.lineWidth = 2.0 * (1 - p);
                ctx.stroke();

                // Kinetic impact starburst flash at exact contact point
                const starSize = 5.0 * (1 - p);
                ctx.beginPath();
                ctx.moveTo(imp.x - starSize, imp.y);
                ctx.lineTo(imp.x + starSize, imp.y);
                ctx.moveTo(imp.x, imp.y - starSize);
                ctx.lineTo(imp.x, imp.y + starSize);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 10;
                ctx.stroke();

                // Central bright flash point
                ctx.beginPath();
                ctx.arc(imp.x, imp.y, 2.5 * (1 - p), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
                ctx.restore();
              }
            }
          }

        } else {
          // --- HIGH-IMPACT SHATTER DESTRUCTION & OPEN GATEWAY ---
          const teamRgb = lane.side === 'left' ? '203, 114, 255' : '121, 239, 67';
          const accentRgb = lane.side === 'left' ? '245, 154, 255' : '178, 255, 138';

          if (tile.shatterTime !== undefined && (engine.simTime - tile.shatterTime < 0.55)) {
            const sAge = engine.simTime - tile.shatterTime;
            const centerX = tileX + tileW / 2;
            const centerY = tile.y;

            // 1. Energetic Blast Flash (Detonation flare across the chamber)
            if (sAge < 0.22) {
              const pFlash = sAge / 0.22;
              const flashAlpha = 1.0 - pFlash;
              const flashRadius = Math.min(tileW * 0.45, 30 + pFlash * 180);

              ctx.save();
              const blastGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashRadius);
              blastGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha * 0.95})`);
              blastGrad.addColorStop(0.30, `rgba(${accentRgb}, ${flashAlpha * 0.70})`);
              blastGrad.addColorStop(0.65, `rgba(${teamRgb}, ${flashAlpha * 0.30})`);
              blastGrad.addColorStop(1, `rgba(${teamRgb}, 0)`);
              ctx.fillStyle = blastGrad;
              ctx.beginPath();
              ctx.arc(centerX, centerY, flashRadius, 0, Math.PI * 2);
              ctx.fill();

              // Energetic diamond blast cross flare
              const flareLen = (1 - pFlash) * (tileW * 0.42);
              ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha * 0.85})`;
              ctx.lineWidth = 2.5 * (1 - pFlash);
              ctx.shadowColor = lane.accentColor;
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.moveTo(centerX - flareLen, centerY);
              ctx.lineTo(centerX + flareLen, centerY);
              ctx.moveTo(centerX, centerY - flareLen * 0.35);
              ctx.lineTo(centerX, centerY + flareLen * 0.35);
              ctx.stroke();
              ctx.restore();
            }

            // 2. Expanding Radial Shockwave Ring (Proportionately scaled to barrier width)
            if (sAge < 0.45) {
              const pWave = sAge / 0.45;
              const waveAlpha = 1.0 - pWave;
              const maxWave = tileW * 0.54;
              // Explosive ease-out expansion curve
              const waveRadius = 14 + (1 - Math.pow(1 - pWave, 2.5)) * maxWave;

              ctx.save();
              ctx.beginPath();
              ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.92})`;
              ctx.lineWidth = 3.0 * (1 - pWave);
              ctx.shadowColor = lane.accentColor;
              ctx.shadowBlur = 14;
              ctx.stroke();

              // Secondary trailing harmonic concentric wave ring
              ctx.beginPath();
              ctx.arc(centerX, centerY, waveRadius * 0.80, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${teamRgb}, ${waveAlpha * 0.65})`;
              ctx.lineWidth = 1.6 * (1 - pWave);
              ctx.shadowBlur = 8;
              ctx.stroke();
              ctx.restore();
            }

            // 3. Horizontal Barrier Ejection Plasma Pulse
            if (sAge < 0.20) {
              const pBeam = sAge / 0.20;
              const beamAlpha = 1.0 - pBeam;
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(tileX + 16, tile.y);
              ctx.lineTo(tileX + tileW - 16, tile.y);
              ctx.strokeStyle = `rgba(255, 255, 255, ${beamAlpha * 0.85})`;
              ctx.lineWidth = 4.5 * (1 - pBeam);
              ctx.shadowColor = lane.accentColor;
              ctx.shadowBlur = 14;
              ctx.stroke();
              ctx.restore();
            }
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

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];

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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();

        // 2. High-Density Silhouette Contrast Rim
        // Crisp 1.4px dark contour guarantees each individual marble remains sharply separated in dense swarms
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 0.9, 0, Math.PI * 2);
        ctx.fillStyle = '#05070e';
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
          ballGrad.addColorStop(0.80, lane.accentColor);
          ballGrad.addColorStop(1, lane.color);
        } else {
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.24, lane.accentColor);
          ballGrad.addColorStop(0.72, lane.color);
          ballGrad.addColorStop(1, side === 'left' ? '#3b0764' : '#052e16');
        }

        ctx.fillStyle = ballGrad;
        if (emergenceFlash > 0.08) {
          ctx.shadowColor = lane.accentColor;
          ctx.shadowBlur = 10 * emergenceFlash;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // 4. Primary razor-sharp specular reflection
        ctx.beginPath();
        ctx.arc(b.x - r * 0.33, b.y - r * 0.33, Math.max(1, r * 0.24), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
        ctx.fill();

        // 5. Secondary soft Fresnel rim reflection (adds tactile spherical volume)
        ctx.beginPath();
        ctx.arc(b.x + r * 0.28, b.y + r * 0.28, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
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

    // Collector trays at bottom
    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(lane.minX + 8, bottomY - 55, lane.width - 16, 60, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Dashed finish line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.5;
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(60, barY, w - 120, barH);

    const activeColor = engine.winner ? engine.winner.color : '#ffd700';
    ctx.fillStyle = activeColor;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(60, barY, (w - 120) * progress, barH);
    ctx.restore();
  }

  // Arena-Integrated Victory Presentation (Non-obstructive, emerges from the arena itself)
  drawWinnerBanner(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const winner = engine.winner;
    if (!winner) return;

    ctx.save();
    ctx.globalAlpha = engine.winnerBannerAlpha;

    const winLane = engine.lanes[winner.side];
    const otherSide = winner.side === 'left' ? 'right' : 'left';
    const loseLane = engine.lanes[otherSide];

    // 1. Subtle dimming veil only over losing lane (preserving complete gameplay visibility)
    if (loseLane) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
      ctx.fillRect(loseLane.minX - 10, engine.topY, loseLane.width + 20, engine.trackHeight + 80);
    }

    // 2. Winning Arena Radiant Illumination
    if (winLane) {
      // Golden victory aura radiating from winner's reservoir
      const winAura = ctx.createRadialGradient(
        winLane.minX + winLane.width / 2,
        engine.bottomY - 50,
        30,
        winLane.minX + winLane.width / 2,
        engine.bottomY - 50,
        420
      );
      winAura.addColorStop(0, 'rgba(255, 215, 0, 0.38)');
      winAura.addColorStop(0.5, winner.color === '#cb72ff' ? 'rgba(203, 114, 255, 0.22)' : 'rgba(121, 239, 67, 0.22)');
      winAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = winAura;
      ctx.fillRect(winLane.minX - 40, engine.topY, winLane.width + 80, engine.trackHeight + 140);

      // Glowing golden championship outline around the winning lane chassis
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4.0;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.roundRect(winLane.minX, engine.topY, winLane.width, engine.trackHeight, 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Compact Arena-Level Result Banner (Positioned cleanly below reservoir in bottom margin)
    const cardW = 740;
    const cardH = 82;
    const cardX = (w - cardW) / 2;
    const cardY = 1740;

    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
    ctx.fillStyle = 'rgba(12, 16, 28, 0.94)';
    ctx.fill();

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const winnerTeamName = winner.side === 'left' ? 'PURPLE' : 'GREEN';

    // Primary Victory Headline
    ctx.font = '950 26px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = winner.color;
    ctx.shadowBlur = 10;
    const winBalls = winLane.balls ? winLane.balls.length : winner.winningScore;
    const loseBalls = loseLane.balls ? loseLane.balls.length : winner.losingScore;
    const label = (winner.winningScore === winBalls && winner.losingScore === loseBalls)
      ? `${winner.winningScore.toLocaleString()} vs ${winner.losingScore.toLocaleString()} MARBLES`
      : `${winner.winningScore.toLocaleString()} vs ${winner.losingScore.toLocaleString()} SCORE (${winBalls} vs ${loseBalls} BALLS)`;
    ctx.fillText(
      `🏆 ${winnerTeamName} TEAM WINS · ${label} 🏆`,
      w / 2,
      cardY + 30
    );
    ctx.shadowBlur = 0;

    // Subtitle & Replay Cue
    ctx.font = '800 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('⚡ UNDERDOG MULTIPLIER TAKES THE RACE! · REPLAY 🔄 ⚡', w / 2, cardY + 60);

    ctx.restore();
  }

  drawWatermark() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '800 13px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
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
