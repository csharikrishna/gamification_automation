// Multiplying Ball Race - Track & Chamber Rendering Layer
// Renders arena lane chassis, dynamic leadership spotlight, active chamber highlights, and borders.

function drawTracks(renderer, engine) {
  const ctx = renderer.ctx;
  const topY = engine.topY;
  const bottomY = engine.bottomY;
  const trackH = bottomY - topY;
  const tok = renderer.getThemeTokens();

  for (const side of ['left', 'right']) {
    const lane = engine.lanes[side];
    const otherSide = side === 'left' ? 'right' : 'left';
    const otherLane = engine.lanes[otherSide];
    const laneTok = tok.lanes[side] || tok.lanes.left;
    const isLeader = renderer.checkRaceLeader(lane, otherLane);
    const isWinner = engine.winner && engine.winner.side === side;

    ctx.save();

    // Solid tournament arena chassis with dynamic leadership shading
    ctx.beginPath();
    ctx.roundRect(lane.minX, topY, lane.width, trackH, 20);
    ctx.fillStyle = isLeader ? laneTok.trackBgLeader : laneTok.trackBg;
    ctx.fill();

    // Active Chamber Spotlight: guide visual attention directly to current breakthrough zone
    const numStages = lane.tiles.length;
    const stageHeight = trackH / (numStages + 1);
    if (!isWinner && lane.currentTier < numStages) {
      const activeTileY = topY + (lane.currentTier + 1) * stageHeight;
      const chamberY = activeTileY - stageHeight;
      const spotlightGrad = ctx.createLinearGradient(lane.minX, chamberY, lane.minX, activeTileY);
      spotlightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      spotlightGrad.addColorStop(0.5, isLeader ? laneTok.glowColor : (renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)'));
      spotlightGrad.addColorStop(1, isLeader ? laneTok.glowColor : (renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'));
      ctx.fillStyle = spotlightGrad;
      ctx.fillRect(lane.minX + 4, chamberY, lane.width - 8, stageHeight);
    }

    // Active lane emphasis: illuminated border on active/leading lane
    if (isWinner) {
      ctx.strokeStyle = tok.celebration.gold;
      ctx.lineWidth = 3.0;
      ctx.shadowColor = tok.celebration.gold;
      ctx.shadowBlur = 12;
    } else if (isLeader || lane.scoreScale > 1.08) {
      ctx.strokeStyle = laneTok.color;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = laneTok.color;
      ctx.shadowBlur = 8;
    } else {
      ctx.strokeStyle = laneTok.borderColor;
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Top accent line in team color
    ctx.beginPath();
    ctx.roundRect(lane.minX + 2, topY + 2, lane.width - 4, 5, 2.5);
    ctx.fillStyle = isWinner ? tok.celebration.gold : laneTok.color;
    ctx.fill();

    // Subtle horizontal chamber guides
    ctx.strokeStyle = renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    for (let s = 1; s <= numStages; s++) {
      const lineY = topY + s * stageHeight;
      ctx.beginPath();
      ctx.moveTo(lane.minX + 8, lineY);
      ctx.lineTo(lane.maxX - 8, lineY);
      ctx.stroke();
    }

    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.drawTracks = drawTracks;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawTracks };
}
