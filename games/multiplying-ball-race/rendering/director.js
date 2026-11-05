// Multiplying Ball Race - Video Director
// Event-driven camera framing, dynamic down-track panning, focus targeting, tension zooming, and impact screen shake.

class VideoDirector {
  constructor() {
    this.camera = { zoom: 1.0, panY: 0, panX: 0, targetPanY: 0, targetPanX: 0, targetZoom: 1.0 };
    this.shake = { x: 0, y: 0, intensity: 0 };
    this.lastTierBroken = -1;
  }

  update(engine) {
    const t = engine.simTime;
    const dur = engine.durationSeconds || 20;

    // Phase detection & camera targeting
    if (t < 2.0) {
      // 0–2s Hook: Wide framing showcasing the match title and opening balls
      this.camera.targetZoom = 1.0;
      this.camera.targetPanY = 0;
      this.camera.targetPanX = 0;
    } else if (!engine.winner && t < dur - 3.2) {
      // 2s–16.8s Competition & Escalation:
      // Focus on active gameplay zone (leading action Y)
      const leftBalls = engine.lanes.left.balls;
      const rightBalls = engine.lanes.right.balls;

      const leadingTier = Math.max(engine.lanes.left.currentTier, engine.lanes.right.currentTier);
      const stageHeight = engine.trackHeight / (engine.numStages + 1);
      const activeTileY = engine.topY + (leadingTier + 1) * stageHeight;

      let maxBallY = 0;
      for (let i = 0; i < leftBalls.length; i++) {
        if (leftBalls[i].y > maxBallY) maxBallY = leftBalls[i].y;
      }
      for (let i = 0; i < rightBalls.length; i++) {
        if (rightBalls[i].y > maxBallY) maxBallY = rightBalls[i].y;
      }

      const focusY = maxBallY > 0 ? (maxBallY * 0.70 + activeTileY * 0.30) : activeTileY;
      const clampedFocusY = Math.max(engine.topY + 160, Math.min(engine.bottomY - 140, focusY));

      // Active downward pan tracking: smoothly track action down the track (up to 280px)
      const panProgress = Math.max(0, Math.min(1.0, (clampedFocusY - (engine.topY + 160)) / (engine.trackHeight - 320)));
      this.camera.targetPanY = -panProgress * 280;

      // Dynamic horizontal emphasis: gently guide attention toward active/leading lane
      const leftLead = engine.lanes.left.currentTier > engine.lanes.right.currentTier || engine.lanes.left.scoreScale > 1.1;
      const rightLead = engine.lanes.right.currentTier > engine.lanes.left.currentTier || engine.lanes.right.scoreScale > 1.1;
      if (leftLead && !rightLead) {
        this.camera.targetPanX = -32;
      } else if (rightLead && !leftLead) {
        this.camera.targetPanX = 32;
      } else {
        this.camera.targetPanX = 0;
      }

      // Dynamic tension zoom
      const escalationProgress = Math.sin((t / dur) * Math.PI);
      this.camera.targetZoom = 1.03 + escalationProgress * 0.05;
    } else {
      // Winner Celebration: Frame reservoir and celebration in active viewport
      this.camera.targetZoom = 1.04;
      this.camera.targetPanY = -180;
      this.camera.targetPanX = 0;
    }

    // Smooth camera damping
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.08;
    this.camera.panY += (this.camera.targetPanY - this.camera.panY) * 0.08;
    this.camera.panX += (this.camera.targetPanX - this.camera.panX) * 0.08;

    // Screen shake decay
    if (this.shake.intensity > 0.04) {
      this.shake.intensity *= 0.88;
      const angle = (t * 42.1) % (Math.PI * 2);
      this.shake.x = Math.cos(angle) * this.shake.intensity * 7;
      this.shake.y = Math.sin(angle) * this.shake.intensity * 7;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
      this.shake.intensity = 0;
    }

    // Detect new gate breaks for tactile impact shake
    const currentLeadingTier = Math.max(engine.lanes.left.currentTier, engine.lanes.right.currentTier);
    if (currentLeadingTier > this.lastTierBroken) {
      this.lastTierBroken = currentLeadingTier;
      this.shake.intensity = currentLeadingTier >= 4 ? 0.95 : 0.50;
    }
  }

  applyCamera(ctx, w, h) {
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx + this.shake.x + this.camera.panX, cy + this.shake.y + this.camera.panY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-cx, -cy);
  }

  restoreCamera(ctx) {
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.VideoDirector = VideoDirector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VideoDirector };
}
