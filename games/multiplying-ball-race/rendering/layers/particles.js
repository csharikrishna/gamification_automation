// Multiplying Ball Race - Particles & VFX Rendering Layer
// Renders geometric crystalline shards, sparks, celebratory embers, and floating multiplier tags.

function drawParticlesAndTexts(renderer, engine) {
  const ctx = renderer.ctx;

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

    } else if (p.type === 'ember') {
      // Atmospheric celebratory golden motes
      ctx.fillStyle = p.color || '#ffd700';
      ctx.shadowColor = p.color || '#ffd700';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

    } else if (p.color === '#00f0ff' || p.color === '#ff007f') {
      // High-contrast arena kinetic spark
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.82 + 0.18 * Math.sin((p.maxLife - p.life) * 5.2 + p.x);
      const r = (p.radius || 2.0) * pulse;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

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

if (typeof window !== 'undefined') {
  window.drawParticlesAndTexts = drawParticlesAndTexts;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawParticlesAndTexts };
}
