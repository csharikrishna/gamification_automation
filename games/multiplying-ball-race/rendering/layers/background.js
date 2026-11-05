// Multiplying Ball Race - Background Rendering Layer
// Renders tournament chassis background gradient, ambient floor glows, and micro grid texture.

function drawBackground(renderer, engine) {
  const ctx = renderer.ctx;
  const w = renderer.width;
  const h = renderer.height;
  const tok = renderer.getThemeTokens();

  // Rich tournament chassis background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, tok.bg.gradStops[0]);
  bgGrad.addColorStop(0.35, tok.bg.gradStops[1]);
  bgGrad.addColorStop(0.7, tok.bg.gradStops[2]);
  bgGrad.addColorStop(1, tok.bg.gradStops[3]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Left ambient floor glow (restrained)
  const leftGlow = ctx.createRadialGradient(285, 950, 40, 285, 950, 380);
  leftGlow.addColorStop(0, tok.bg.ambientLeft);
  leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 340, 540, 1200);

  // Right ambient floor glow (restrained)
  const rightGlow = ctx.createRadialGradient(795, 950, 40, 795, 950, 380);
  rightGlow.addColorStop(0, tok.bg.ambientRight);
  rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(540, 340, 540, 1200);

  // Micro grid lines for tournament arena texture
  ctx.strokeStyle = tok.bg.grid;
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

if (typeof window !== 'undefined') {
  window.drawBackground = drawBackground;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBackground };
}
