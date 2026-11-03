// High-Resolution 1080x1920 Canvas Visual Renderer
// Specializing in neon aesthetic, glowing breakable tiles, glass shatter particles, and dynamic UI overlays for YouTube Shorts

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width || 1080;
    this.height = canvas.height || 1920;
  }

  render(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Background Cyber Ambiance
    this.drawBackground(engine);

    // 2. Topline Hook Badge & Score Headers
    this.drawHeader(engine);

    // 3. Lane Tracks & Tiers
    this.drawTracks(engine);

    // 4. Pegs & Breakable Barrier Tiles
    this.drawObstaclesAndTiles(engine);

    // 5. Balls (Clean, distinct, uncluttered)
    this.drawBalls(engine);

    // 6. Flying Shards, Sparks & Floating Texts
    this.drawParticlesAndTexts(engine);

    // 7. Bottom Reservoir & Progress Bar
    this.drawFinishLineAndProgress(engine);

    // 8. Winner Overlay (if completed)
    if (engine.winnerBannerAlpha > 0.01) {
      this.drawWinnerBanner(engine);
    }

    // 9. Brand watermark
    this.drawWatermark();
  }

  drawBackground(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#060810');
    bgGrad.addColorStop(0.5, '#0a0d18');
    bgGrad.addColorStop(1, '#05070e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const left = engine.lanes.left;
    const right = engine.lanes.right;

    // Left ambient glow
    const leftGlow = ctx.createRadialGradient(285, 950, 40, 285, 950, 520);
    leftGlow.addColorStop(0, left.glowColor);
    leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 400, 540, 1100);

    // Right ambient glow
    const rightGlow = ctx.createRadialGradient(795, 950, 40, 795, 950, 520);
    rightGlow.addColorStop(0, right.glowColor);
    rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(540, 400, 540, 1100);

    // Background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
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

    // 1. Top Hook Pill with Dynamic Width & Font Scaling (VIS-03, VIS-09)
    const tagText = engine.config.title || '⚡ UNDERDOG BATTLE · MULTIPLY VS ADD ⚡';
    ctx.save();
    let fontSize = 24;
    ctx.font = `700 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    let textWidth = ctx.measureText(tagText).width;
    const maxTextWidth = w - 140;

    while (textWidth > maxTextWidth && fontSize > 14) {
      fontSize -= 1.5;
      ctx.font = `700 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
      textWidth = ctx.measureText(tagText).width;
    }

    const pillW = Math.min(w - 60, textWidth + 56);
    const pillH = 46;
    const pillX = (w - pillW) / 2;
    const pillY = 32;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 23);
    ctx.fillStyle = 'rgba(240, 195, 100, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 205, 120, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#fce5b2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, w / 2, pillY + pillH / 2);
    ctx.restore();

    // 2. Score Headers
    const left = engine.lanes.left;
    const right = engine.lanes.right;

    this.drawScoreCard(left, 285, 160);
    this.drawScoreCard(right, 795, 160);

    // VIS-01, RACE-01: Stage Indicator Badge derived from actual broken barrier progress
    const leadingTier = Math.max(left.currentTier, right.currentTier);
    const currentN = Math.min(6, leadingTier + 1);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 80, 190, 160, 36, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`STAGE n = ${currentN}`, w / 2, 208);
    ctx.restore();
  }

  drawScoreCard(lane, centerX, centerY) {
    const ctx = this.ctx;
    ctx.save();

    // Rule Title (e.g. f(n) = n! or ×3 BALLS)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 44px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = lane.color;
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 18;
    ctx.fillText(lane.formulaName || lane.ruleLabel || lane.name, centerX, centerY - 45);

    // Subtitle (starts with X balls)
    ctx.shadowBlur = 0;
    ctx.font = '600 20px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(lane.subtitle, centerX, centerY - 10);

    // Big Count Number with Spring Scale Punch
    const scoreVal = Math.round(lane.displayScore).toLocaleString();
    ctx.save();
    ctx.translate(centerX, centerY + 50);
    ctx.scale(lane.scoreScale, lane.scoreScale);

    ctx.font = '950 68px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 24;
    ctx.fillText(scoreVal, 0, 0);

    ctx.restore();
    ctx.restore();
  }

  drawTracks(engine) {
    const ctx = this.ctx;
    const topY = engine.topY;
    const bottomY = engine.bottomY;
    const trackH = bottomY - topY;

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      ctx.save();

      // Lane track container rounded rectangle
      ctx.beginPath();
      ctx.roundRect(lane.minX, topY, lane.width, trackH, 24);
      ctx.fillStyle = 'rgba(12, 16, 28, 0.65)';
      ctx.fill();

      // Neon outline
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Lane Label and Tier Progress at top
      ctx.shadowBlur = 0;
      ctx.font = '800 18px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.textAlign = 'center';
      const tierDisplay = Math.min(lane.tiles.length, lane.currentTier + 1);
      ctx.fillText(`${lane.name} · TIER ${tierDisplay}/${lane.tiles.length}`, lane.minX + lane.width / 2, topY + 28);

      // Race Leader Crown Pill (VIS-02, RACE-02: Evaluated from complete race state)
      const otherSide = side === 'left' ? 'right' : 'left';
      const otherLane = engine.lanes[otherSide];
      const isLeader = this.checkRaceLeader(lane, otherLane);
      if (isLeader) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(lane.minX + lane.width / 2 - 65, topY - 24, 130, 26, 13);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.fillStyle = '#0b0e18';
        ctx.font = '900 12px "Inter", "Segoe UI", sans-serif';
        ctx.fillText('👑 RACE LEADER', lane.minX + lane.width / 2, topY - 10);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // VIS-02, RACE-02: Comprehensive race leader comparison
  checkRaceLeader(lane, other) {
    if (lane.reachedBottom && !other.reachedBottom) return true;
    if (other.reachedBottom && !lane.reachedBottom) return false;
    if (lane.currentTier > other.currentTier) return true;
    if (lane.currentTier < other.currentTier) return false;

    // Same tier: compare damage dealt to current barrier
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

      // Draw Pachinko Pegs
      for (const peg of lane.pegs) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);

        if (peg.glow > 0.05) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = lane.accentColor;
          ctx.shadowBlur = 18 * peg.glow;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.restore();
      }

      // Draw Breakable Barrier Tiles
      for (const tile of lane.tiles) {
        ctx.save();
        const tileX = tile.minX;
        const tileY = tile.y - tile.height / 2;
        const tileW = tile.width;
        const tileH = tile.height;

        if (tile.intact) {
          // --- SOLID INTACT TILE BARRIER ---
          ctx.beginPath();
          ctx.roundRect(tileX, tileY, tileW, tileH, 8);
          ctx.fillStyle = tile.glowIntensity > 0.1
            ? `rgba(255, 255, 255, ${0.25 + tile.glowIntensity * 0.3})`
            : 'rgba(20, 24, 40, 0.92)';
          ctx.fill();

          ctx.strokeStyle = tile.crackAmount > 0.7 ? '#ffffff' : lane.color;
          ctx.lineWidth = 3 + tile.glowIntensity * 3;
          ctx.shadowColor = tile.crackAmount > 0.7 ? '#ffffff' : lane.color;
          ctx.shadowBlur = 12 + tile.glowIntensity * 16;
          ctx.stroke();

          // Dynamic Fracture Cracks from ball impact locations
          if (tile.fractures && tile.fractures.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            for (const f of tile.fractures) {
              ctx.beginPath();
              const fx = tileX + f.x;
              ctx.moveTo(fx, tile.y - 6);
              ctx.lineTo(fx + Math.cos(f.angle) * f.len, tile.y + Math.sin(f.angle) * f.len);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Tile Label Text (e.g. ×3 or +2)
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 22px "Inter", "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tile.label, tileX + tileW / 2 - 20, tile.y - 4);

          // HP Tag
          ctx.font = '800 11px monospace';
          ctx.fillStyle = lane.accentColor;
          ctx.fillText(`${Math.max(0, Math.ceil(tile.currentHP))} HP`, tileX + tileW - 45, tile.y - 4);

          // Glowing Durability Health Bar
          const barX = tileX + 24;
          const barY = tile.y + 8;
          const barW = tileW - 48;
          const barH = 4;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, 2);
          ctx.fill();

          const hpRatio = Math.max(0, Math.min(1.0, tile.currentHP / tile.maxHP));
          if (hpRatio > 0.01) {
            ctx.fillStyle = lane.accentColor;
            ctx.shadowColor = lane.accentColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * hpRatio, barH, 2);
            ctx.fill();
          }

        } else {
          // --- SHATTERED OPEN GATEWAY ---
          // The solid floor is broken! Draw open side frame indicators and dashed gateway
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(tileX + 10, tile.y);
          ctx.lineTo(tileX + tileW - 10, tile.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Broken edge brackets
          ctx.strokeStyle = lane.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = lane.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(tileX, tileY - 4); ctx.lineTo(tileX + 16, tile.y); ctx.lineTo(tileX, tileY + tileH + 4);
          ctx.moveTo(tileX + tileW, tileY - 4); ctx.lineTo(tileX + tileW - 16, tile.y); ctx.lineTo(tileX + tileW, tileY + tileH + 4);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  drawBalls(engine) {
    const ctx = this.ctx;

    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];

      for (const b of lane.balls) {
        ctx.save();
        const r = b.radius;

        // Clean ball outer glow
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 14;

        // 3D Specular Radial Gradient
        const grad = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.38, 1, b.x, b.y, r * 1.35);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, lane.accentColor);
        grad.addColorStop(0.85, lane.color);
        grad.addColorStop(1, '#1b1b22');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  drawParticlesAndTexts(engine) {
    const ctx = this.ctx;

    // Draw Particles (Shards & Sparks)
    for (const p of engine.particles) {
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type === 'shard') {
        // Tumble flying glass tile shard
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

      } else {
        // Spark circle
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw Floating Texts
    for (const ft of engine.floatingTexts) {
      ctx.save();
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = '900 38px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 18;
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

    // Glowing bottom collector tray
    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(lane.minX + 8, bottomY - 60, lane.width - 16, 68, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Dashed finish line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(50, bottomY - 65);
    ctx.lineTo(520, bottomY - 65);
    ctx.moveTo(560, bottomY - 65);
    ctx.lineTo(1030, bottomY - 65);
    ctx.stroke();
    ctx.setLineDash([]);

    // Progress bar at the very bottom
    const progress = Math.min(1.0, engine.simTime / engine.durationSeconds);
    const barY = 1880;
    const barH = 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(60, barY, w - 120, barH);

    const activeColor = engine.winner ? engine.winner.color : '#ffd700';
    ctx.fillStyle = activeColor;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 10;
    ctx.fillRect(60, barY, (w - 120) * progress, barH);
    ctx.restore();
  }

  drawWinnerBanner(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const winner = engine.winner;
    if (!winner) return;

    ctx.save();
    ctx.globalAlpha = engine.winnerBannerAlpha;

    ctx.fillStyle = 'rgba(4, 6, 14, 0.84)';
    ctx.fillRect(0, 0, w, h);

    const cardW = 900;
    const cardH = 520;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;

    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.fillStyle = 'rgba(16, 20, 36, 0.96)';
    ctx.fill();

    ctx.strokeStyle = winner.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = winner.color;
    ctx.shadowBlur = 35;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 44px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillText('🏆 1ST PLACE FINISHER! 🏆', w / 2, cardY + 80);

    ctx.font = '950 58px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = winner.color;
    ctx.shadowColor = winner.color;
    ctx.shadowBlur = 24;
    ctx.fillText(`${winner.name} TEAM`, w / 2, cardY + 160);

    ctx.shadowBlur = 0;
    const timeStr = winner.finishTime ? `${winner.finishTime.toFixed(1)}s` : '11.8s';
    ctx.font = '800 24px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`⚡ REACHED BOTTOM FIRST AT ${timeStr}! ⚡`, w / 2, cardY + 225);

    ctx.font = '700 28px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `${winner.winningScore.toLocaleString()} vs ${winner.losingScore.toLocaleString()} BALLS`,
      w / 2,
      cardY + 285
    );

    const loserTier = winner.loserStuckTier !== undefined ? winner.loserStuckTier + 1 : 4;
    ctx.font = '800 22px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ff6688';
    ctx.fillText(`RUNNER-UP: ${winner.loserName || 'OTHER'} (STUCK AT TIER ${loserTier} OF 6)`, w / 2, cardY + 345);

    const ctaY = cardY + 430;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 200, ctaY - 26, 400, 52, 26);
    ctx.fillStyle = winner.color;
    ctx.fill();

    ctx.fillStyle = '#0a0d18';
    ctx.font = '900 22px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('SUBSCRIBE FOR NEXT RACE 🔔', w / 2, ctaY);

    ctx.restore();
  }

  drawWatermark() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '800 18px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.textAlign = 'center';
    ctx.fillText('BURSTPOINT SIMULATIONS', this.width / 2, 1855);
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasRenderer };
}
