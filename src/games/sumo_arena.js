// Sumo Battle Royale Knockout Arena Physics Environment
// Circular shrinking arena, elastic marble collisions, knockouts, kill feed, and Sole Survivor ceremony.

class SumoArenaGame {
  constructor(config = {}) {
    this.type = 'sumo_arena';
    this.title = config.title || '👑 MARBLE BATTLE ROYALE · 32 MARBLES 1 WINNER 👑';
    this.subtitle = config.subtitle || 'Pick your color before the knockouts begin!';
    this.durationSeconds = config.durationSeconds || 16;
    this.fps = config.fps || 60;
    this.simTime = 0;
    this.frameIndex = 0;
    this.isFinished = false;

    this.events = [];
    this.particles = [];
    this.floatingTexts = [];
    this.killFeed = [];

    this.centerX = 540;
    this.centerY = 1000;
    this.arenaRadius = config.initialRadius || 420;
    this.minArenaRadius = 260;
    this.shrinkSpeed = (this.arenaRadius - this.minArenaRadius) / (this.durationSeconds * 0.7);

    // Marble Competitors
    const TEAMS = [
      { name: 'TITAN GOLD', color: '#ffd700', flag: '👑' },
      { name: 'CYBER CYAN', color: '#00f0ff', flag: '⚡' },
      { name: 'NEON MAGENTA', color: '#ff007f', flag: '🔥' },
      { name: 'TOXIC LIME', color: '#79ef43', flag: '☣️' },
      { name: 'VIOLET SHADOW', color: '#bb44ff', flag: '🔮' },
      { name: 'INFERNO ORANGE', color: '#ff5500', flag: '💥' },
      { name: 'ICE BLIZZARD', color: '#a0e8ff', flag: '❄️' },
      { name: 'EMERALD VIPER', color: '#00e676', flag: '🐍' }
    ];

    const totalCompetitors = config.competitorCount || 32;
    this.marbles = [];

    for (let i = 0; i < totalCompetitors; i++) {
      const team = TEAMS[i % TEAMS.length];
      const angle = (i / totalCompetitors) * Math.PI * 2;
      const r = Math.random() * (this.arenaRadius * 0.65);
      this.marbles.push({
        id: i + 1,
        name: `${team.name} #${Math.floor(i / TEAMS.length) + 1}`,
        color: team.color,
        flag: team.flag,
        x: this.centerX + Math.cos(angle) * r,
        y: this.centerY + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        radius: 14,
        mass: 1.0,
        alive: true,
        knockoutTime: null,
        kills: 0
      });
    }

    this.totalInitial = totalCompetitors;
    this.aliveCount = totalCompetitors;
    this.winner = null;
    this.winnerBannerAlpha = 0;
    this.lastBounceTime = 0;
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    // Shrink arena
    if (this.arenaRadius > this.minArenaRadius) {
      this.arenaRadius = Math.max(this.minArenaRadius, this.arenaRadius - this.shrinkSpeed * dt);
    }

    // Marble-to-Marble Collisions (Elastic 2D Physics)
    const alive = this.marbles.filter(m => m.alive);
    const len = alive.length;

    for (let i = 0; i < len; i++) {
      const m1 = alive[i];
      for (let j = i + 1; j < len; j++) {
        const m2 = alive[j];

        const dx = m2.x - m1.x;
        const dy = m2.y - m1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = m1.radius + m2.radius;

        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = (minDist - dist) * 0.5;
          m1.x -= nx * overlap;
          m1.y -= ny * overlap;
          m2.x += nx * overlap;
          m2.y += ny * overlap;

          // Normal relative velocity
          const kx = m1.vx - m2.vx;
          const ky = m1.vy - m2.vy;
          const p = 2 * (nx * kx + ny * ky) / (m1.mass + m2.mass);

          // Impulse with recoil
          m1.vx -= p * m2.mass * nx * 1.08;
          m1.vy -= p * m2.mass * ny * 1.08;
          m2.vx += p * m1.mass * nx * 1.08;
          m2.vy += p * m1.mass * ny * 1.08;

          this.logCollision((m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
        }
      }
    }

    // Move marbles & check arena boundary
    for (const m of alive) {
      // Gentle center-seeking gravity impulse to keep the action intense
      const toCenterX = this.centerX - m.x;
      const toCenterY = this.centerY - m.y;
      const distFromCenter = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

      // Random jitter / drive
      m.vx += (Math.random() - 0.5) * 80 * dt;
      m.vy += (Math.random() - 0.5) * 80 * dt;

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      m.vx *= 0.992;
      m.vy *= 0.992;

      // Check if knocked out of the ring!
      if (distFromCenter > this.arenaRadius) {
        m.alive = false;
        m.knockoutTime = this.simTime;
        this.aliveCount--;

        this.events.push({ time: this.simTime, type: 'gate', tier: 2 });

        // Add to kill feed
        this.killFeed.unshift({
          text: `💀 ${m.name} ELIMINATED!`,
          time: this.simTime,
          color: m.color
        });
        if (this.killFeed.length > 4) this.killFeed.pop();

        // Explosion particles
        for (let k = 0; k < 18; k++) {
          const angle = (k / 18) * Math.PI * 2;
          const spd = Math.random() * 200 + 100;
          this.particles.push({
            x: m.x,
            y: m.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            radius: Math.random() * 4 + 2,
            color: m.color,
            life: 0.8,
            maxLife: 0.8,
            gravity: 300
          });
        }
      }
    }

    // Fall animation for knocked out marbles
    for (const m of this.marbles) {
      if (!m.alive && m.knockoutTime && this.simTime - m.knockoutTime < 1.0) {
        m.y += 450 * dt;
        m.radius = Math.max(0, m.radius - 12 * dt);
      }
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Check winner
    if ((this.aliveCount <= 1 || this.simTime >= this.durationSeconds - 2.5) && !this.winner) {
      const survivor = this.marbles.find(m => m.alive) || this.marbles[0];
      this.winner = {
        name: survivor.name,
        color: survivor.color,
        flag: survivor.flag,
        winningScore: 1,
        totalKnockouts: this.totalInitial - 1
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

  logCollision(x, y) {
    if (this.simTime - this.lastBounceTime < 0.04) return;
    this.lastBounceTime = this.simTime;
    this.events.push({ time: this.simTime, type: 'bounce', volume: 0.14, pitch: 480 });
  }

  render(ctx) {
    const w = 1080;
    const h = 1920;

    // Dark cyber arena floor
    const bgGrad = ctx.createRadialGradient(this.centerX, this.centerY, 80, this.centerX, this.centerY, 900);
    bgGrad.addColorStop(0, '#101426');
    bgGrad.addColorStop(0.6, '#0a0d18');
    bgGrad.addColorStop(1, '#05060b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Top hook banner
    ctx.save();
    ctx.font = '700 24px "Inter", sans-serif';
    const textW = ctx.measureText(this.title).width;
    const pillW = textW + 56;
    ctx.beginPath();
    ctx.roundRect((w - pillW) / 2, 32, pillW, 46, 23);
    ctx.fillStyle = 'rgba(255, 0, 127, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#ffcce6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, w / 2, 55);

    // Alive Marbles Ticker
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('ALIVE IN THE RING', w / 2, 130);

    ctx.font = '950 82px "Inter", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.fillText(`${this.aliveCount} / ${this.totalInitial}`, w / 2, 215);
    ctx.restore();

    // Circular Battle Arena Ring
    ctx.save();
    // Inner arena glow
    const ringGlow = ctx.createRadialGradient(this.centerX, this.centerY, 50, this.centerX, this.centerY, this.arenaRadius);
    ringGlow.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    ringGlow.addColorStop(0.85, 'rgba(255, 0, 127, 0.15)');
    ringGlow.addColorStop(1, 'rgba(255, 0, 127, 0.4)');
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Ring Outer Border Line (Danger boundary)
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric grid lines in arena
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 2;
    for (let r = 100; r < this.arenaRadius; r += 90) {
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Kill Feed overlay at bottom
    ctx.save();
    let feedY = 1680;
    for (const item of this.killFeed) {
      ctx.font = '800 24px "Inter", sans-serif';
      ctx.fillStyle = item.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 10;
      ctx.fillText(item.text, w / 2, feedY);
      feedY += 36;
    }
    ctx.restore();

    // Render Marbles
    for (const m of this.marbles) {
      if (m.radius <= 0) continue;
      ctx.save();
      const r = m.radius;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = m.alive ? 16 : 4;

      const grad = ctx.createRadialGradient(m.x - r * 0.35, m.y - r * 0.35, 1, m.x, m.y, r * 1.35);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, m.color);
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
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

    // Sole Survivor Banner
    if (this.winnerBannerAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.winnerBannerAlpha;
      ctx.fillStyle = 'rgba(5, 7, 16, 0.88)';
      ctx.fillRect(0, 0, w, h);

      const cardW = 920, cardH = 520;
      const cardX = (w - cardW) / 2, cardY = (h - cardH) / 2;

      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 32);
      ctx.fillStyle = 'rgba(18, 22, 40, 0.96)';
      ctx.fill();
      ctx.strokeStyle = this.winner.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = this.winner.color;
      ctx.shadowBlur = 35;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 48px "Inter", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('👑 SOLE SURVIVOR! 👑', w / 2, cardY + 95);

      ctx.font = '950 64px "Inter", sans-serif';
      ctx.fillStyle = this.winner.color;
      ctx.shadowColor = this.winner.color;
      ctx.shadowBlur = 25;
      ctx.fillText(`${this.winner.name}`, w / 2, cardY + 195);

      ctx.shadowBlur = 0;
      ctx.font = '800 32px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`OUTLASTED ALL 31 COMPETITORS!`, w / 2, cardY + 285);

      ctx.font = '700 24px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('DID YOU PICK THE WINNER? COMMENT BELOW ⬇️', w / 2, cardY + 365);
      ctx.restore();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SumoArenaGame };
}
