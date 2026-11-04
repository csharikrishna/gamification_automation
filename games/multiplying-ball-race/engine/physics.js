// Multiplying Ball Race - Physics World Integration
// Handles fixed substep integration, bounds containment, and kinematic damping.

class PhysicsWorld {
  constructor(options = {}) {
    this.gravity = options.gravity !== undefined ? options.gravity : 820;
    this.substeps = options.substeps !== undefined ? options.substeps : 4;
    this.drag = options.drag !== undefined ? options.drag : 0.9995;
    this.wallRestitution = options.wallRestitution !== undefined ? options.wallRestitution : 0.65;
  }

  // Integrates velocity and position for a single ball
  integrateBall(ball, dt) {
    ball.vy += this.gravity * dt;
    ball.vx *= Math.pow(this.drag, dt * 60);
    ball.vy *= Math.pow(this.drag, dt * 60);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
  }

  // Enforces side wall boundaries with elastic bounce
  constrainToWalls(ball, minX, maxX) {
    if (ball.x - ball.radius < minX) {
      ball.x = minX + ball.radius;
      ball.vx = Math.abs(ball.vx) * this.wallRestitution;
      return true;
    } else if (ball.x + ball.radius > maxX) {
      ball.x = maxX - ball.radius;
      ball.vx = -Math.abs(ball.vx) * this.wallRestitution;
      return true;
    }
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhysicsWorld };
}
