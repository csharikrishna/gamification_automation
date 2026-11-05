// Multiplying Ball Race - Marbles Rendering Layer
// Renders 3D spherical shaded balls, high-density silhouette contrast rim,
// tactile glass depth, specular reflections, Fresnel rims, and multiplication emergence flashes.

function drawBalls(renderer, engine) {
  const ctx = renderer.ctx;
  const t = engine.simTime;
  const tok = renderer.getThemeTokens();

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

if (typeof window !== 'undefined') {
  window.drawBalls = drawBalls;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBalls };
}
