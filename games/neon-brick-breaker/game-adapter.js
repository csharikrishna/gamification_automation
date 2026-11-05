// Neon Brick Breaker Swarm Physics Environment
// Hundreds of glowing physics balls demolishing high-HP neon bricks with ASMR shatter particles.
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

class BrickBreakerGame extends _GameAdapter {
  constructor(config = {}, seed = null) {
    super(config, seed);
    this.gameType = 'brick_breaker';
    this.type = 'brick_breaker';
    this.initialize(config, seed);
  }

  initialize(config = {}, seed = null) {
    this.config = config;
    this.seed = seed ?? config.seed ?? 1337;
    this.rng = new (_PRNG || class { random() { return 0.5; } range(a, b) { return (a + b) / 2; } choice(arr) { return arr[0]; } })(this.seed);

    this.title = config.title || '💥 300 BALLS VS 1,000 HP NEON BRICKS 💥';
    this.subtitle = config.subtitle || 'Can the swarm clear the entire board?';
    this.durationSeconds = config.durationSeconds || 16;
    this.fps = config.fps || 60;
    this.simTime = 0;
    this.frameIndex = 0;
    this.finished = false;

    this.events = [];
    this.particles = [];
    this.floatingTexts = [];

    // Bricks grid setup
    this.bricks = [];
    const rows = 6;
    const cols = 7;
    const startY = 360;
    const brickW = 120;
    const brickH = 55;
    const gap = 14;
    const totalW = cols * brickW + (cols - 1) * gap;
    const startX = (1080 - totalW) / 2;

    const COLORS = ['#ff007f', '#cb72ff', '#00f0ff', '#79ef43', '#ffd700', '#ff5500'];

    for (let r = 0; r < rows; r++) {
      const rowColor = COLORS[r % COLORS.length];
      const baseHp = (rows - r) * 25;
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: startX + c * (brickW + gap),
          y: startY + r * (brickH + gap),
          w: brickW,
          h: brickH,
          maxHp: baseHp,
          hp: baseHp,
          color: rowColor,
          alive: true,
          hitGlow: 0
        });
      }
    }

    this.initialTotalHp = this.bricks.reduce((sum, b) => sum + b.maxHp, 0);

    // Ball Swarm setup (launches from bottom)
    this.balls = [];
    this.totalBallBudget = config.ballCount || 240;
    this.spawnIndex = 0;

    this.winner = null;
    this.winnerBannerAlpha = 0;
    this.lastBounceTime = 0;
    this.clearedPct = 0;
  }

  step(dt = 1 / 60) {
    this.update(dt);
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    // Launch swarm from bottom cannon with deterministic seeded spread
    if (this.spawnIndex < this.totalBallBudget && this.frameIndex % 2 === 0) {
      const launchAngle = -Math.PI / 2 + this.rng.range(-0.55, 0.55);
      const speed = this.rng.range(850, 1050);
      this.balls.push({
        x: 540 + this.rng.range(-20, 20),
        y: 1720,
        vx: Math.cos(launchAngle) * speed,
        vy: Math.sin(launchAngle) * speed,
        radius: 7.5,
        color: '#00f0ff'
      });
      this.spawnIndex++;
    }

    // Decay brick glows
    for (const b of this.bricks) {
      if (b.hitGlow > 0) b.hitGlow = Math.max(0, b.hitGlow - dt * 4.0);
    }

    // Move Balls and collide
    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Outer walls
      if (ball.x - ball.radius < 40) {
        ball.x = 40 + ball.radius;
        ball.vx = Math.abs(ball.vx);
        this.logSound();
      } else if (ball.x + ball.radius > 1040) {
        ball.x = 1040 - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        this.logSound();
      }

      if (ball.y - ball.radius < 300) {
        ball.y = 300 + ball.radius;
        ball.vy = Math.abs(ball.vy);
        this.logSound();
      } else if (ball.y + ball.radius > 1750) {
        ball.y = 1750 - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        this.logSound();
      }

      // Check Brick Collisions (AABB)
      for (const brick of this.bricks) {
        if (!brick.alive) continue;

        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.w &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.h
        ) {
          // Bounce normal
          const overlapLeft = (ball.x + ball.radius) - brick.x;
          const overlapRight = (brick.x + brick.w) - (ball.x - ball.radius);
          const overlapTop = (ball.y + ball.radius) - brick.y;
          const overlapBottom = (brick.y + brick.h) - (ball.y - ball.radius);

          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            ball.vx = (overlapLeft < overlapRight ? -1 : 1) * Math.abs(ball.vx);
          } else {
            ball.vy = (overlapTop < overlapBottom ? -1 : 1) * Math.abs(ball.vy);
          }

          brick.hp = Math.max(0, brick.hp - 1);
          brick.hitGlow = 1.0;
          this.logSound(0.06, 680 + (1.0 - brick.hp / brick.maxHp) * 300);

          if (brick.hp <= 0 && brick.alive) {
            brick.alive = false;
            this.triggerBrickShatter(brick);
            this.events.push({
              time: this.simTime,
              type: 'brick_shatter',
              brickColor: brick.color
            });
          }
          break;
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 400) * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Calculate Board Clearance %
    const remainingHp = this.bricks.filter(b => b.alive).reduce((sum, b) => sum + b.hp, 0);
    this.clearedPct = Math.min(100, Math.round(((this.initialTotalHp - remainingHp) / this.initialTotalHp) * 100));

    // Finish / Victory check
    const allCleared = this.bricks.every(b => !b.alive);
    if ((allCleared || this.simTime >= this.durationSeconds - 2.5) && !this.winner) {
      this.winner = {
        name: allCleared ? '100% BOARD CLEARED!' : `${this.clearedPct}% CLEARED`,
        color: '#79ef43',
        winningScore: this.clearedPct,
        finishTime: this.simTime
      };
      this.events.push({ time: this.simTime, type: 'finish' });
    }

    if (this.winner) {
      this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
    }

    if (this.simTime >= this.durationSeconds - 0.001) {
      this.finished = true;
    }
  }

  isFinished() {
    return !!this.finished;
  }

  logSound(volume = 0.05, pitch = 640) {
    if (this.simTime - this.lastBounceTime < 0.02) return;
    this.lastBounceTime = this.simTime;
    this.events.push({ time: this.simTime, type: 'bounce', volume, pitch });
  }

  triggerBrickShatter(brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    for (let k = 0; k < 22; k++) {
      const angle = (k / 22) * Math.PI * 2;
      const spd = this.rng.range(80, 300);
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: this.rng.range(2, 6),
        color: brick.color,
        life: 0.75,
        maxLife: 0.75,
        gravity: 400
      });
    }
  }

  observe() {
    return {
      simTime: this.simTime,
      frameIndex: this.frameIndex,
      clearedPct: this.clearedPct,
      bricksRemaining: this.bricks.filter(b => b.alive).length,
      totalBricks: this.bricks.length,
      ballsActive: this.balls.length,
      winner: this.winner,
      isFinished: this.isFinished()
    };
  }

  getEvents() {
    return this.events;
  }

  getResult() {
    return {
      gameType: 'brick_breaker',
      title: this.title,
      winner: `${this.clearedPct}% CLEARED`,
      winnerColor: '#79ef43',
      score: this.clearedPct,
      winningScore: this.clearedPct,
      clearedPct: this.clearedPct,
      totalBricks: this.bricks.length,
      bricksDemolished: this.bricks.filter(b => !b.alive).length,
      finishTime: this.simTime,
      isFinished: this.isFinished(),
      stats: {
        totalBalls: this.balls.length,
        initialHp: this.initialTotalHp,
        remainingHp: this.bricks.filter(b => b.alive).reduce((s, b) => s + b.hp, 0)
      }
    };
  }

  getReplay() {
    return {
      gameType: 'brick_breaker',
      seed: this.seed,
      config: this.config,
      durationSeconds: this.simTime,
      clearedPct: this.clearedPct,
      result: this.getResult(),
      events: this.events
    };
  }

  render(ctx) {
    const w = 1080;
    const h = 1920;

    // Dark sleek background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#060812');
    bgGrad.addColorStop(0.5, '#0b0e1e');
    bgGrad.addColorStop(1, '#05070e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Top hook banner
    ctx.save();
    ctx.font = '700 24px "Inter", sans-serif';
    const textW = ctx.measureText(this.title).width;
    const pillW = textW + 56;
    ctx.beginPath();
    ctx.roundRect((w - pillW) / 2, 32, pillW, 46, 23);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#b3f8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, w / 2, 55);

    // Clearance Percentage Display
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('BOARD CLEARED', w / 2, 130);

    ctx.font = '950 84px "Inter", sans-serif';
    ctx.fillStyle = '#79ef43';
    ctx.shadowColor = '#79ef43';
    ctx.shadowBlur = 24;
    ctx.fillText(`${this.clearedPct || 0}%`, w / 2, 215);
    ctx.restore();

    // Render Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = b.hitGlow > 0.1 ? '#ffffff' : 'rgba(20, 26, 46, 0.9)';
      ctx.fill();

      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.5 + b.hitGlow * 3;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10 + b.hitGlow * 16;
      ctx.stroke();

      // HP Number
      ctx.shadowBlur = 0;
      ctx.font = '900 22px "Inter", sans-serif';
      ctx.fillStyle = b.hitGlow > 0.1 ? '#000000' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${b.hp}`, b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
    }

    // Render Swarm Balls
    for (const ball of this.balls) {
      ctx.save();
      const r = ball.radius;
      ctx.shadowColor = ball.color;
      ctx.shadowBlur = 12;

      const grad = ctx.createRadialGradient(ball.x - r * 0.35, ball.y - r * 0.35, 1, ball.x, ball.y, r * 1.3);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, ball.color);
      grad.addColorStop(1, '#001a2e');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Particles
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

    // Clearance Result Overlay
    if (this.winnerBannerAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.winnerBannerAlpha;
      ctx.fillStyle = 'rgba(5, 7, 16, 0.88)';
      ctx.fillRect(0, 0, w, h);

      const cardW = 900, cardH = 500;
      const cardX = (w - cardW) / 2, cardY = (h - cardH) / 2;

      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 30);
      ctx.fillStyle = 'rgba(18, 24, 42, 0.96)';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 30;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 48px "Inter", sans-serif';
      ctx.fillStyle = '#79ef43';
      ctx.fillText('💥 DEMOLITION RESULT 💥', w / 2, cardY + 95);

      ctx.font = '950 72px "Inter", sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 25;
      ctx.fillText(`${this.clearedPct}% CLEARED`, w / 2, cardY + 210);

      ctx.shadowBlur = 0;
      ctx.font = '800 30px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`TOTAL BRICKS DEMOLISHED: ${this.bricks.filter(b => !b.alive).length} / ${this.bricks.length}`, w / 2, cardY + 300);

      ctx.font = '700 24px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('SATISFYING? DROP A LIKE & SUBSCRIBE 🔔', w / 2, cardY + 380);
      ctx.restore();
    }
  }
}

if (typeof window !== 'undefined') {
  window.BrickBreakerGame = BrickBreakerGame;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BrickBreakerGame };
}
