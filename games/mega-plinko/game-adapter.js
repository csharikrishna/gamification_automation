// Mega Plinko 1000x Jackpot Pyramid Physics Environment
// Vertical 1080x1920 layout, peg pyramid, multiplier slot bins, jackpot explosions.
// Conforms strictly to Universal GameAdapter contract with 100% Deterministic Seeded PRNG.

var _PRNG = typeof PRNG !== 'undefined'
  ? PRNG
  : (typeof require !== 'undefined' ? (function() {
      try { return require('../../core/simulation/prng').PRNG; } catch (e) { return require('../../src/prng').PRNG; }
    })() : null);

var _GameAdapter = typeof GameAdapter !== 'undefined'
  ? GameAdapter
  : (typeof require !== 'undefined' ? (function() {
      try { return require('../../core/contracts/game-adapter').GameAdapter; } catch (e) { return require('../../src/game_adapter').GameAdapter; }
    })() : class {});

class MegaPlinkoGame extends _GameAdapter {
  constructor(config = {}, seed = null) {
    super(config, seed);
    this.gameType = 'mega_plinko';
    this.type = 'mega_plinko';
    this.initialize(config, seed);
  }

  initialize(config = {}, seed = null) {
    this.config = config;
    this.seed = seed ?? config.seed ?? 1337;
    this.rng = new (_PRNG || class { random() { return 0.5; } range(a, b) { return (a + b) / 2; } choice(arr) { return arr[0]; } })(this.seed);

    this.title = config.title || '⚡ 1,000× JACKPOT PLINKO · CAN ANYONE HIT 1000×? ⚡';
    this.subtitle = config.subtitle || 'Dropping 250 balls · Pick your slot!';
    this.durationSeconds = config.durationSeconds || 16;
    this.fps = config.fps || 60;
    this.simTime = 0;
    this.frameIndex = 0;
    this.isFinished = false;

    this.events = [];
    this.balls = [];
    this.particles = [];
    this.floatingTexts = [];
    this.jackpotActive = false;
    this.jackpotFlash = 0;

    // Plinko geometry
    this.topY = 320;
    this.bottomY = 1680;
    this.centerX = 540;
    this.rows = config.rows || 14;
    this.ballBudget = config.ballCount || 200;
    this.spawnRate = 18;

    // Build Peg Pyramid
    this.pegs = [];
    const pyStartW = 140;
    const pyEndW = 960;
    const pyH = this.bottomY - this.topY - 140;
    const rowH = pyH / this.rows;

    for (let r = 0; r < this.rows; r++) {
      const y = this.topY + (r + 1) * rowH;
      const count = r + 3;
      const w = pyStartW + (pyEndW - pyStartW) * (r / (this.rows - 1));
      const spacing = w / (count - 1);
      const startX = this.centerX - w / 2;

      for (let c = 0; c < count; c++) {
        this.pegs.push({
          x: startX + c * spacing,
          y,
          radius: 8.5,
          glow: 0
        });
      }
    }

    // Slots at the bottom
    const slotValues = [1000, 100, 25, 10, 2, 0.5, 0.2, 0.5, 2, 10, 25, 100, 1000];
    const slotCount = slotValues.length;
    const slotsStartX = 50;
    const slotsW = 980;
    const slotW = slotsW / slotCount;
    this.slotBins = [];

    for (let i = 0; i < slotCount; i++) {
      const val = slotValues[i];
      let color = '#79ef43';
      if (val >= 1000) color = '#ffd700';
      else if (val >= 100) color = '#ff007f';
      else if (val >= 10) color = '#cb72ff';
      else if (val >= 2) color = '#00f0ff';

      this.slotBins.push({
        index: i,
        minX: slotsStartX + i * slotW,
        maxX: slotsStartX + (i + 1) * slotW,
        centerY: this.bottomY + 50,
        height: 100,
        value: val,
        color,
        hitCount: 0,
        glow: 0
      });
    }

    this.totalScore = 0;
    this.displayScore = 0;
    this.jackpotHits = 0;
    this.lastBounceTime = 0;
    this.winner = null;
    this.winnerBannerAlpha = 0;
  }

  step(dt = 1 / 60) {
    this.update(dt);
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    const gravity = 1150;
    const bounce = 0.72;
    const friction = 0.994;

    // Deterministic ball spawns
    if (this.simTime < this.durationSeconds - 4.5 && this.balls.length < this.ballBudget) {
      if (this.frameIndex % 3 === 0) {
        this.spawnBall();
      }
    }

    // Score interpolation
    const diff = this.totalScore - this.displayScore;
    if (Math.abs(diff) > 0.05) {
      this.displayScore += Math.max(1, Math.ceil(diff * 0.15));
    }

    // Decay glows
    for (const p of this.pegs) {
      if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 4.0);
    }
    for (const s of this.slotBins) {
      if (s.glow > 0) s.glow = Math.max(0, s.glow - dt * 3.0);
    }

    // Update balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.collected) continue;

      b.vy += gravity * dt;
      b.vx *= friction;
      b.vy *= friction;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Outer walls
      if (b.x - b.radius < 45) {
        b.x = 45 + b.radius;
        b.vx = Math.abs(b.vx) * bounce;
      } else if (b.x + b.radius > 1035) {
        b.x = 1035 - b.radius;
        b.vx = -Math.abs(b.vx) * bounce;
      }

      // Peg collisions (Deterministic seeded scatter)
      for (const p of this.pegs) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b.radius + p.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx = (b.vx - 2 * dot * nx) * bounce + this.rng.range(-17.5, 17.5);
            b.vy = (b.vy - 2 * dot * ny) * bounce;
            p.glow = 1.0;
            this.logBounce(p.x, p.y, 0.07, 650 + (p.y / this.bottomY) * 300);
          }
        }
      }

      // Check slot collection at bottom
      if (b.y >= this.bottomY) {
        for (const slot of this.slotBins) {
          if (b.x >= slot.minX && b.x <= slot.maxX) {
            b.collected = true;
            slot.hitCount++;
            slot.glow = 1.0;
            const points = slot.value * 10;
            this.totalScore += points;

            this.events.push({
              time: this.simTime,
              type: 'gate',
              tier: slot.value >= 1000 ? 5 : slot.value >= 100 ? 3 : 1,
              multiplier: slot.value >= 10
            });

            // Floating text
            this.floatingTexts.push({
              text: `+${slot.value}×`,
              x: (slot.minX + slot.maxX) / 2,
              y: this.bottomY - 10,
              color: slot.color,
              speed: 70,
              scale: slot.value >= 1000 ? 2.2 : slot.value >= 100 ? 1.6 : 1.2,
              life: 1.0,
              maxLife: 1.0
            });

            // Jackpot celebration if 1000x!
            if (slot.value >= 1000) {
              this.jackpotHits++;
              this.jackpotFlash = 1.0;
              this.triggerJackpotBurst((slot.minX + slot.maxX) / 2, this.bottomY);
            }
            break;
          }
        }
      }
    }

    // Flash decay
    if (this.jackpotFlash > 0) {
      this.jackpotFlash = Math.max(0, this.jackpotFlash - dt * 2.0);
    }

    // Particles & Floating texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 350) * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= ft.speed * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Finish & Winner summary
    if (this.simTime >= this.durationSeconds - 2.5 && !this.winner) {
      this.winner = {
        name: 'TOTAL PAYOUT',
        color: '#ffd700',
        winningScore: Math.round(this.totalScore),
        jackpots: this.jackpotHits
      };
      this.events.push({ time: this.simTime, type: 'finish' });
    }

    if (this.winner) {
      this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
    }

    if (this.simTime >= this.durationSeconds - 0.001) {
      this.isFinished = true;
    }
  }

  spawnBall() {
    const colors = ['#00f0ff', '#cb72ff', '#79ef43', '#ffd700', '#ff007f'];
    const color = this.rng.choice(colors);
    this.balls.push({
      x: this.centerX + this.rng.range(-30, 30),
      y: this.topY - 30 - this.rng.range(0, 20),
      vx: this.rng.range(-25, 25),
      vy: this.rng.range(20, 40),
      radius: 9,
      color,
      collected: false
    });
  }

  logBounce(x, y, volume = 0.08, pitch = 600) {
    if (this.simTime - this.lastBounceTime < 0.03) return;
    this.lastBounceTime = this.simTime;
    this.events.push({ time: this.simTime, type: 'bounce', volume, pitch });
  }

  triggerJackpotBurst(x, y) {
    for (let k = 0; k < 30; k++) {
      const angle = (k / 30) * Math.PI * 2;
      const speed = this.rng.range(100, 380);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        radius: this.rng.range(3, 7),
        color: '#ffd700',
        life: 1.2,
        maxLife: 1.2,
        gravity: 400
      });
    }
  }

  observe() {
    return {
      simTime: this.simTime,
      frameIndex: this.frameIndex,
      totalScore: Math.round(this.totalScore),
      displayScore: Math.round(this.displayScore),
      ballsActive: this.balls.filter(b => !b.collected).length,
      jackpotHits: this.jackpotHits,
      isFinished: this.isFinished,
      winner: this.winner
    };
  }

  getEvents() {
    return this.events;
  }

  getResult() {
    return {
      gameType: 'mega_plinko',
      title: this.title,
      winner: 'TOTAL PAYOUT',
      winnerColor: '#ffd700',
      score: Math.round(this.totalScore),
      winningScore: Math.round(this.totalScore),
      jackpotHits: this.jackpotHits,
      finishTime: this.simTime,
      isFinished: this.isFinished,
      stats: {
        totalBalls: this.balls.length,
        collectedBalls: this.balls.filter(b => b.collected).length,
        jackpotHits: this.jackpotHits,
        slotHitCounts: this.slotBins.map(s => ({ value: s.value, hits: s.hitCount }))
      }
    };
  }

  getReplay() {
    return {
      gameType: 'mega_plinko',
      seed: this.seed,
      config: this.config,
      durationSeconds: this.simTime,
      totalScore: Math.round(this.totalScore),
      jackpotHits: this.jackpotHits,
      events: this.events,
      result: this.getResult()
    };
  }

  render(ctx) {
    const w = 1080;
    const h = 1920;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090814');
    bgGrad.addColorStop(0.5, '#0d0d1e');
    bgGrad.addColorStop(1, '#07060f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Screen flash on jackpot
    if (this.jackpotFlash > 0.02) {
      ctx.fillStyle = `rgba(255, 215, 0, ${this.jackpotFlash * 0.28})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Top hook banner
    ctx.save();
    ctx.font = '700 24px "Inter", "Segoe UI", sans-serif';
    const textW = ctx.measureText(this.title).width;
    const pillW = textW + 56;
    const pillH = 46;
    ctx.beginPath();
    ctx.roundRect((w - pillW) / 2, 32, pillW, pillH, 23);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#fff4a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, w / 2, 55);

    // Dynamic Live Score Ticker
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('TOTAL WINNINGS', w / 2, 130);

    ctx.font = '950 86px "Inter", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 24;
    ctx.fillText(`$${this.displayScore.toLocaleString()}`, w / 2, 215);

    // Subtitle
    ctx.shadowBlur = 0;
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(this.subtitle, w / 2, 275);
    ctx.restore();

    // Pegs Pyramid
    for (const p of this.pegs) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.glow > 0.1 ? '#ffffff' : '#6c7a9c';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = p.glow * 18;
      ctx.fill();
      ctx.restore();
    }

    // Bottom Bins
    for (const slot of this.slotBins) {
      ctx.save();
      const sw = slot.maxX - slot.minX;
      ctx.beginPath();
      ctx.roundRect(slot.minX + 2, this.bottomY, sw - 4, slot.height, 12);
      ctx.fillStyle = slot.glow > 0.1 ? slot.color : 'rgba(20, 26, 46, 0.85)';
      ctx.fill();
      ctx.strokeStyle = slot.color;
      ctx.lineWidth = 2.5 + slot.glow * 3;
      ctx.shadowColor = slot.color;
      ctx.shadowBlur = 12 + slot.glow * 20;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = '900 24px "Inter", sans-serif';
      ctx.fillStyle = slot.glow > 0.1 ? '#000000' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = slot.value >= 1000 ? '1000×' : `${slot.value}×`;
      ctx.fillText(label, (slot.minX + slot.maxX) / 2, this.bottomY + 45);

      // Hit count badge
      if (slot.hitCount > 0) {
        ctx.font = '700 16px "Inter", sans-serif';
        ctx.fillStyle = slot.glow > 0.1 ? '#000000' : slot.color;
        ctx.fillText(`${slot.hitCount} hits`, (slot.minX + slot.maxX) / 2, this.bottomY + 75);
      }
      ctx.restore();
    }

    // Render Balls
    for (const b of this.balls) {
      if (b.collected) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }

    // Floating Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.font = `950 ${Math.round(28 * ft.scale)}px "Inter", sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.globalAlpha = ft.life / ft.maxLife;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 15;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Winner Banner Overlay
    if (this.winnerBannerAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.winnerBannerAlpha;
      ctx.fillStyle = 'rgba(5, 7, 16, 0.85)';
      ctx.fillRect(0, 0, w, h);

      const cardW = 900, cardH = 500;
      const cardX = (w - cardW) / 2, cardY = (h - cardH) / 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 30);
      ctx.fillStyle = 'rgba(16, 20, 36, 0.96)';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 30;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 48px "Inter", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🎰 PLINKO TOURNAMENT OVER 🎰', w / 2, cardY + 90);

      ctx.font = '950 64px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.fillText(`$${Math.round(this.totalScore).toLocaleString()}`, w / 2, cardY + 200);

      ctx.font = '800 32px "Inter", sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(`JACKPOT 1,000× HITS: ${this.jackpotHits}`, w / 2, cardY + 290);

      ctx.font = '800 24px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('DID YOUR PICK WIN? COMMENT BELOW ⬇️', w / 2, cardY + 370);
      ctx.restore();
    }
  }
}

if (typeof window !== 'undefined') {
  window.MegaPlinkoGame = MegaPlinkoGame;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MegaPlinkoGame };
}
