// Multiplying Ball Race - Collision Solver
// Implements O(N) Spatial Hash Grid for high-density 180-200 marble swarms,
// elastic ball-to-ball collisions with Baumgarte position correction,
// and elastic peg/barrier ricochets.

class CollisionSolver {
  constructor(options = {}) {
    this.restitution = options.restitution !== undefined ? options.restitution : 0.68;
    this.pegRestitution = options.pegRestitution !== undefined ? options.pegRestitution : 0.72;
    this.wallRestitution = options.wallRestitution !== undefined ? options.wallRestitution : 0.65;
    this.cellSize = 30; // Grid cell slightly larger than max ball diameter (23px)
  }

  // O(N) Spatial Grid Elastic Ball-to-Ball Collision Resolution
  resolveBallCollisions(balls) {
    const len = balls.length;
    if (len < 2) return;

    const e = this.restitution;
    const cellSize = this.cellSize;
    const grid = new Map();

    for (let i = 0; i < len; i++) {
      const b = balls[i];
      if (b._dead) continue;
      const cx = Math.floor(b.x / cellSize);
      const cy = Math.floor(b.y / cellSize);
      const key = (cx << 16) | (cy & 0xFFFF);
      let list = grid.get(key);
      if (!list) {
        list = [];
        grid.set(key, list);
      }
      list.push(b);
    }

    for (let i = 0; i < len; i++) {
      const b1 = balls[i];
      if (b1._dead) continue;
      const cx = Math.floor(b1.x / cellSize);
      const cy = Math.floor(b1.y / cellSize);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const neighborKey = ((cx + ox) << 16) | ((cy + oy) & 0xFFFF);
          const neighbors = grid.get(neighborKey);
          if (!neighbors) continue;

          for (let k = 0; k < neighbors.length; k++) {
            const b2 = neighbors[k];
            if (b2._dead || b1.id >= b2.id) continue;

            let dx = b2.x - b1.x;
            let dy = b2.y - b1.y;
            let distSq = dx * dx + dy * dy;
            const minDist = b1.radius + b2.radius;

            // Coincident ball separation
            if (distSq < 0.001) {
              dx = (b1.id % 2 === 0 ? 1 : -1) * 0.5;
              dy = 0.5;
              distSq = dx * dx + dy * dy;
            }

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.001;
              const nx = dx / dist;
              const ny = dy / dist;

              // Shared position correction without explosive overshoot
              const overlap = minDist - dist;
              const slop = 0.15;
              const corr = Math.max(0, overlap - slop) * 0.40;
              b1.x -= nx * corr;
              b1.y -= ny * corr;
              b2.x += nx * corr;
              b2.y += ny * corr;

              const vrel = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;
              if (vrel > 0) {
                const impulse = (1 + e) * vrel * 0.5;
                b1.vx -= impulse * nx;
                b1.vy -= impulse * ny;
                b2.vx += impulse * nx;
                b2.vy += impulse * ny;

                // Tangential rolling friction damping
                const tx = -ny;
                const ty = nx;
                const vrelT = (b1.vx - b2.vx) * tx + (b1.vy - b2.vy) * ty;
                const fImpulse = vrelT * 0.15;
                b1.vx -= fImpulse * tx;
                b1.vy -= fImpulse * ty;
                b2.vx += fImpulse * tx;
                b2.vy += fImpulse * ty;
              }
            }
          }
        }
      }
    }
  }

  // Resolves elastic circular ricochet with pachinko peg
  resolvePegCollision(ball, peg) {
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const distSq = dx * dx + dy * dy;
    const minDist = ball.radius + peg.radius;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;

      // Position pushout
      ball.x = peg.x + nx * minDist;
      ball.y = peg.y + ny * minDist;

      // Normal velocity reflection
      const vDotN = ball.vx * nx + ball.vy * ny;
      if (vDotN < 0) {
        ball.vx -= (1 + this.pegRestitution) * vDotN * nx;
        ball.vy -= (1 + this.pegRestitution) * vDotN * ny;
        peg.glow = 1.0;
        return true;
      }
    }
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollisionSolver };
}
