// Rube Goldberg Marble Run Physics Environment (Adapted from brepre109/marble-machine)
// Smooth vertical camera tracking down an intricate multi-tier obstacle course with seesaws, wheels, and zig-zag ramps.

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

class MarbleRunGame extends _GameAdapter {
  constructor(config = {}, seed = null) {
    super(config, seed);
    this.gameType = 'marble_run';
    this.type = 'marble_run';
    this.initialize(config, seed);
  }

  initialize(config = {}, seed = null) {
    this.config = config;
    this.seed = seed ?? config.seed ?? 1337;
    this.rng = new (_PRNG || class { random() { return 0.5; } range(a, b) { return (a + b) / 2; } choice(arr) { return arr[0]; } })(this.seed);

    this.title = config.title || '🌀 EPIC RUBE GOLDBERG MARBLE MACHINE 🌀';
    this.subtitle = config.subtitle || 'Can the lead marble navigate all 5 mechanical tiers?';
    this.durationSeconds = config.durationSeconds || 16;
    this.fps = config.fps || 60;
    this.simTime = 0;
    this.frameIndex = 0;
    this.finished = false;

    this.events = [];
    this.particles = [];
    this.floatingTexts = [];

    // Course layout
    this.width = 1080;
    this.courseHeight = 4200;
    this.camY = 0;
    this.targetCamY = 0;

    // Obstacles: Ramps, Pins, Seesaws, and Rotary Wheels
    this.ramps = [];
    this.pegs = [];
    this.seesaws = [];
    this.wheels = [];
    this.buildCourse();

    // Marbles racing
    this.marbles = [];
    const colors = ['#00f0ff', '#ffd700', '#ff007f', '#79ef43', '#cb72ff', '#ff5500'];
    const names = ['AERO CYAN', 'SOLAR GOLD', 'NEON ROSE', 'TOXIC VIPER', 'SHADOW VIOLET', 'MAGMA ORANGE'];
    const marbleCount = config.marbleCount || 6;

    for (let i = 0; i < marbleCount; i++) {
      this.marbles.push({
        id: i + 1,
        name: names[i % names.length],
        color: colors[i % colors.length],
        x: 480 + (i - marbleCount / 2) * 28,
        y: 80 - i * 35,
        vx: (this.rng.random() - 0.5) * 30,
        vy: this.rng.random() * 20 + 20,
        radius: 13,
        trail: []
      });
    }

    this.winner = null;
    this.winnerBannerAlpha = 0;
    this.lastBounceTime = 0;
  }

  buildCourse() {
    // Stage 1: Funnel Drop & Zig-zag Ramps (y: 150 to 950)
    this.ramps.push(
      { x1: 60, y1: 180, x2: 440, y2: 320, w: 16 },
      { x1: 1020, y1: 180, x2: 640, y2: 320, w: 16 },
      { x1: 1020, y1: 420, x2: 120, y2: 640, w: 18 },
      { x1: 60, y1: 720, x2: 960, y2: 940, w: 18 }
    );

    // Stage 2: Pachinko Pin Matrix (y: 1050 to 1600)
    for (let r = 0; r < 5; r++) {
      const rowY = 1080 + r * 110;
      const count = r % 2 === 0 ? 8 : 7;
      const spacing = 860 / (count + 1);
      const startX = 110 + (r % 2 === 0 ? 0 : spacing / 2);
      for (let c = 1; c <= count; c++) {
        this.pegs.push({
          x: startX + c * spacing,
          y: rowY,
          radius: 11,
          glow: 0
        });
      }
    }

    // Stage 3: Dynamic Seesaws (y: 1750 to 2400)
    this.seesaws.push(
      { x: 380, y: 1820, length: 360, angle: 0.22, targetAngle: 0.22, angularVel: 0 },
      { x: 700, y: 2060, length: 360, angle: -0.22, targetAngle: -0.22, angularVel: 0 },
      { x: 380, y: 2300, length: 360, angle: 0.22, targetAngle: 0.22, angularVel: 0 }
    );

    // Stage 4: Rotary Paddle Wheel (y: 2550 to 3000)
    this.wheels.push({
      x: 540,
      y: 2750,
      radius: 170,
      blades: 6,
      angle: 0,
      speed: 1.8
    });
    // Funnel under wheel
    this.ramps.push(
      { x1: 80, y1: 2950, x2: 440, y2: 3120, w: 18 },
      { x1: 1000, y1: 2950, x2: 640, y2: 3120, w: 18 }
    );

    // Stage 5: Final Sprint to Finish Gate (y: 3300 to 4000)
    this.ramps.push(
      { x1: 1020, y1: 3250, x2: 180, y2: 3550, w: 18 },
      { x1: 60, y1: 3650, x2: 880, y2: 3950, w: 18 }
    );

    this.finishY = 4050;
  }

  step(dt = 1 / 60) {
    this.update(dt);
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    const gravity = 1250;
    const bounce = 0.65;
    const friction = 0.992;

    // Rotate wheels
    for (const w of this.wheels) {
      w.angle += w.speed * dt;
    }

    // Decay peg glows
    for (const p of this.pegs) {
      if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 3.5);
    }

    // Update seesaws tilt damping
    for (const s of this.seesaws) {
      s.angle += (s.targetAngle - s.angle) * 0.12;
    }

    // Update Marbles
    let lowestY = 0;
    let leadMarble = this.marbles[0];

    for (const m of this.marbles) {
      m.vy += gravity * dt;
      m.vx *= friction;
      m.vy *= friction;

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Outer walls
      if (m.x - m.radius < 50) {
        m.x = 50 + m.radius;
        m.vx = Math.abs(m.vx) * bounce;
      } else if (m.x + m.radius > 1030) {
        m.x = 1030 - m.radius;
        m.vx = -Math.abs(m.vx) * bounce;
      }

      // Collide with Ramps
      for (const r of this.ramps) {
        this.collideMarbleWithSegment(m, r.x1, r.y1, r.x2, r.y2, bounce);
      }

      // Collide with Pegs
      for (const p of this.pegs) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + p.radius;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          m.x = p.x + nx * minDist;
          m.y = p.y + ny * minDist;
          const dot = m.vx * nx + m.vy * ny;
          if (dot < 0) {
            m.vx = (m.vx - 2 * dot * nx) * bounce;
            m.vy = (m.vy - 2 * dot * ny) * bounce;
            p.glow = 1.0;
            this.logBounce(p.x, p.y, 0.08, 620);
          }
        }
      }

      // Collide with Seesaws
      for (const s of this.seesaws) {
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const halfL = s.length / 2;
        const x1 = s.x - cos * halfL;
        const y1 = s.y - sin * halfL;
        const x2 = s.x + cos * halfL;
        const y2 = s.y + sin * halfL;

        if (this.collideMarbleWithSegment(m, x1, y1, x2, y2, bounce)) {
          // Weight tips the seesaw!
          s.targetAngle = m.x > s.x ? 0.32 : -0.32;
        }
      }

      // Collide with Wheel blades
      for (const w of this.wheels) {
        const distToCenter = Math.hypot(m.x - w.x, m.y - w.y);
        if (distToCenter < w.radius + m.radius) {
          for (let b = 0; b < w.blades; b++) {
            const bladeAngle = w.angle + (b / w.blades) * Math.PI * 2;
            const bx = w.x + Math.cos(bladeAngle) * w.radius;
            const by = w.y + Math.sin(bladeAngle) * w.radius;
            this.collideMarbleWithSegment(m, w.x, w.y, bx, by, bounce);
          }
        }
      }

      // Finish line check
      if (m.y >= this.finishY && !this.winner) {
        this.winner = {
          name: m.name,
          color: m.color,
          winningScore: 1
        };
        this.events.push({ time: this.simTime, type: 'finish' });
      }

      if (m.y > lowestY) {
        lowestY = m.y;
        leadMarble = m;
      }
    }

    // Camera smoothly follows the action downwards
    const desiredCamY = Math.max(0, Math.min(this.courseHeight - 1600, lowestY - 700));
    this.camY += (desiredCamY - this.camY) * 0.08;

    if (this.simTime >= this.durationSeconds - 2.5 && !this.winner) {
      this.winner = {
        name: leadMarble.name,
        color: leadMarble.color,
        winningScore: 1
      };
      this.events.push({ time: this.simTime, type: 'finish' });
    }

    if (this.winner) {
      this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
    }

    if (this.simTime >= this.durationSeconds) {
      this.finished = true;
    }
  }

  collideMarbleWithSegment(m, x1, y1, x2, y2, bounce) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLenSq = dx * dx + dy * dy;
    if (segLenSq === 0) return false;

    // Project marble onto line segment
    const t = Math.max(0, Math.min(1, ((m.x - x1) * dx + (m.y - y1) * dy) / segLenSq));
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    const distX = m.x - nearX;
    const distY = m.y - nearY;
    const distSq = distX * distX + distY * distY;

    if (distSq < m.radius * m.radius && distSq > 0.001) {
      const dist = Math.sqrt(distSq);
      const nx = distX / dist;
      const ny = distY / dist;
      const overlap = m.radius - dist;

      m.x += nx * overlap;
      m.y += ny * overlap;

      const dot = m.vx * nx + m.vy * ny;
      if (dot < 0) {
        m.vx = (m.vx - 2 * dot * nx) * bounce;
        m.vy = (m.vy - 2 * dot * ny) * bounce;
        this.logBounce(m.x, m.y, 0.08, 550);
        return true;
      }
    }
    return false;
  }

  logBounce(x, y, volume = 0.08, pitch = 550) {
    if (this.simTime - this.lastBounceTime < 0.03) return;
    this.lastBounceTime = this.simTime;
    this.events.push({ time: this.simTime, type: 'bounce', volume, pitch });
  }

  isFinished() {
    return !!this.finished;
  }

  getResult() {
    return {
      gameType: 'marble_run',
      title: this.title,
      winner: this.winner ? this.winner.name : null,
      winnerColor: this.winner ? this.winner.color : null,
      score: this.winner ? this.winner.winningScore : 0,
      winningScore: this.winner ? this.winner.winningScore : 0,
      finishTime: this.simTime,
      isFinished: this.isFinished(),
      color: this.winner ? this.winner.color : null
    };
  }

  getEvents() {
    return this.events;
  }

  getReplay() {
    return {
      gameType: 'marble_run',
      seed: this.seed,
      durationSeconds: this.durationSeconds,
      fps: this.fps,
      events: this.events,
      result: this.getResult()
    };
  }

  observe() {
    return {
      simTime: this.simTime,
      frameIndex: this.frameIndex,
      isFinished: this.isFinished(),
      result: this.getResult(),
      leadMarble: this.marbles[0]?.name
    };
  }

  render(ctx) {
    const w = 1080;
    const h = 1920;

    // Dark background
    ctx.fillStyle = '#070912';
    ctx.fillRect(0, 0, w, h);

    // World rendering with Camera Offset
    ctx.save();
    ctx.translate(0, -this.camY);

    // Background track depth lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < this.courseHeight; y += 80) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(1030, y);
      ctx.stroke();
    }

    // Outer Course Guides
    ctx.strokeStyle = 'rgba(203, 114, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(50, this.courseHeight);
    ctx.moveTo(1030, 0); ctx.lineTo(1030, this.courseHeight);
    ctx.stroke();

    // Ramps
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    for (const r of this.ramps) {
      ctx.lineWidth = r.w || 16;
      ctx.beginPath();
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
      ctx.stroke();
    }

    // Pegs
    for (const p of this.pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.glow > 0.05 ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
      ctx.shadowColor = '#cb72ff';
      ctx.shadowBlur = p.glow > 0.05 ? 18 : 0;
      ctx.fill();
    }

    // Seesaws
    for (const s of this.seesaws) {
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      const halfL = s.length / 2;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(s.x - cos * halfL, s.y - sin * halfL);
      ctx.lineTo(s.x + cos * halfL, s.y + sin * halfL);
      ctx.stroke();

      // Pivot
      ctx.beginPath();
      ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Rotary Wheels
    for (const wheel of this.wheels) {
      ctx.strokeStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(wheel.x, wheel.y, wheel.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 10;
      for (let b = 0; b < wheel.blades; b++) {
        const bladeAngle = wheel.angle + (b / wheel.blades) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wheel.x, wheel.y);
        ctx.lineTo(wheel.x + Math.cos(bladeAngle) * wheel.radius, wheel.y + Math.sin(bladeAngle) * wheel.radius);
        ctx.stroke();
      }
    }

    // Finish Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 8;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(50, this.finishY);
    ctx.lineTo(1030, this.finishY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marbles
    for (const m of this.marbles) {
      const r = m.radius;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 14;

      const grad = ctx.createRadialGradient(m.x - r * 0.35, m.y - r * 0.35, 1, m.x, m.y, r * 1.3);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, m.color);
      grad.addColorStop(1, '#05070f');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Static Screen HUD Overlay (stays fixed regardless of camera)
    ctx.save();
    // Top banner
    ctx.font = '700 24px "Inter", sans-serif';
    const textW = ctx.measureText(this.title).width;
    const pillW = textW + 56;
    ctx.beginPath();
    ctx.roundRect((w - pillW) / 2, 32, pillW, 46, 23);
    ctx.fillStyle = 'rgba(203, 114, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#cb72ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#fce5ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, w / 2, 55);

    // Track Distance Progress Bar
    const progress = Math.min(1.0, this.camY / (this.courseHeight - 1600));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(80, 1870, w - 160, 8);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(80, 1870, (w - 160) * progress, 8);
    ctx.restore();

    // Winner Podium Card
    if (this.winnerBannerAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.winnerBannerAlpha;
      ctx.fillStyle = 'rgba(5, 7, 16, 0.88)';
      ctx.fillRect(0, 0, w, h);

      const cardW = 920, cardH = 500;
      const cardX = (w - cardW) / 2, cardY = (h - cardH) / 2;

      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 30);
      ctx.fillStyle = 'rgba(18, 22, 42, 0.96)';
      ctx.fill();
      ctx.strokeStyle = this.winner.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = this.winner.color;
      ctx.shadowBlur = 35;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 48px "Inter", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🏆 RACE FINISH! 🏆', w / 2, cardY + 95);

      ctx.font = '950 68px "Inter", sans-serif';
      ctx.fillStyle = this.winner.color;
      ctx.shadowColor = this.winner.color;
      ctx.shadowBlur = 25;
      ctx.fillText(`${this.winner.name}`, w / 2, cardY + 200);

      ctx.shadowBlur = 0;
      ctx.font = '800 32px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`CROSSED THE FINISH LINE 1ST!`, w / 2, cardY + 295);

      ctx.font = '700 24px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('DID YOU PICK THE WINNER? COMMENT BELOW ⬇️', w / 2, cardY + 375);
      ctx.restore();
    }
  }
}

if (typeof window !== 'undefined') {
  window.MarbleRunGame = MarbleRunGame;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MarbleRunGame };
}
