// Neon Brick Breaker Swarm Physics Environment
// Hundreds of glowing physics balls demolishing high-HP neon bricks with ASMR shatter particles.

class BrickBreakerGame {
  constructor(config = {}) {
    this.type = 'brick_breaker';
    this.title = config.title || '💥 300 BALLS VS 1,000 HP NEON BRICKS 💥';
    this.subtitle = config.subtitle || 'Can the swarm clear the entire board?';
    this.durationSeconds = config.durationSeconds || 16;
    this.fps = config.fps || 60;
    this.simTime = 0;
    this.frameIndex = 0;
    this.isFinished = false;

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
      const baseHp = (rows - r) * 25; // Top bricks have higher HP
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
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    // Launch swarm from bottom cannon
    if (this.spawnIndex < this.totalBallBudget && this.frameIndex % 2 === 0) {
      const launchAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
      const speed = Math.random() * 200 + 850;
      this.balls.push({
        x: 540 + (Math.random() - 0.5) * 40,
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

      // Ceiling
      if (ball.y - ball.radius < 260) {
        ball.y = 260 + ball.radius;
        ball.vy = Math.abs(ball.vy);
        this.logSound();
      }

      // Floor bounce (infinite rally!)
      if (ball.y + ball.radius > 1750) {
        ball.y = 1750 - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }

      // Brick collisions
      for (const brick of this.bricks) {
        if (!brick.alive) continue;

        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.w &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.h
        ) {
          // Determine collision face
          const overlapLeft = (ball.x + ball.radius) - brick.x;
          const overlapRight = (brick.x + brick.w) - (ball.x - ball.radius);
          const overlapTop = (ball.y + ball.radius) - brick.y;
          const overlapBottom = (brick.y + brick.h) - (ball.y - ball.radius);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapLeft) {
            ball.x = brick.x - ball.radius;
            ball.vx = -Math.abs(ball.vx);
          } else if (minOverlap === overlapRight) {
            ball.x = brick.x + brick.w + ball.radius;
            ball.vx = Math.abs(ball.vx);
          } else if (minOverlap === overlapTop) {
            ball.y = brick.y - ball.radius;
            ball.vy = -Math.abs(ball.vy);
          } else {
            ball.y = brick.y + brick.h + ball.radius;
            ball.vy = Math.abs(ball.vy);
          }

          brick.hp--;
          brick.hitGlow = 1.0;
          this.logSound(brick.color);

          // Brick Shatter if HP <= 0!
          if (brick.hp <= 0) {
            brick.alive = false;
            this.triggerBrickShatter(brick);
            this.events.push({ time: this.simTime, type: 'gate', tier: 4 });
          }
          break;
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Check winner / progress
    const remainingHp = this.bricks.filter(b => b.alive).reduce((s, b) => s + b.hp, 0);
    this.clearedPct = Math.min(100, Math.round(((this.initialTotalHp - remainingHp) / this.initialTotalHp) * 100));

    if ((this.clearedPct >= 100 || this.simTime >= this.durationSeconds - 2.5) && !this.winner) {
      this.winner = {
        name: 'SWARM DEMOLITION',
        color: '#00f0ff',
        winningScore: this.clearedPct
      };
      this.events.push({ time: this.simTime, type: 'finish' });
    }

    if (this.winner) {
      this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
    }

    if (this.simTime >= this.durationSeconds) {
      this.isFinished = true;
    }
  }

  logSound() {
    if (this.simTime - this.lastBounceTime < 0.02) return;
    this.lastBounceTime = this.simTime;
    this.events.push({ time: this.simTime, type: 'bounce', volume: 0.08, pitch: 700 });
  }

  triggerBrickShatter(brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    for (let k = 0; k < 22; k++) {
      const angle = (k / 22) * Math.PI * 2;
      const spd = Math.random() * 220 + 80;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: Math.random() * 4 + 2,
        color: brick.color,
        life: 0.75,
        maxLife: 0.75,
        gravity: 400
      });
    }
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

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Demolition Complete Banner
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BrickBreakerGame };
}
