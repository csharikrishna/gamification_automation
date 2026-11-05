// Multiplying Ball Race - Celebration, Finish Line & Watermark Layer
// Renders collector trays, finish line, race progress bar, winner spotlight/reservoir aura,
// frosted esports victory presentation card with condition headline, and brand watermark.

function drawFinishLineAndProgress(renderer, engine) {
  const ctx = renderer.ctx;
  const w = renderer.width;
  const bottomY = engine.bottomY;
  const tok = renderer.getThemeTokens();

  // Collector trays at bottom
  for (const side of ['left', 'right']) {
    const lane = engine.lanes[side];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(lane.minX + 8, bottomY - 55, lane.width - 16, 60, 12);
    ctx.fillStyle = tok.reservoir.trayBg;
    ctx.fill();
    ctx.strokeStyle = tok.reservoir.trayBorder;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  // Dashed finish line
  ctx.save();
  ctx.strokeStyle = tok.reservoir.finishLine;
  ctx.lineWidth = 2.0;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(50, bottomY - 60);
  ctx.lineTo(520, bottomY - 60);
  ctx.moveTo(560, bottomY - 60);
  ctx.lineTo(1030, bottomY - 60);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Sleek progress bar at bottom edge
  const progress = Math.min(1.0, engine.simTime / (engine.durationSeconds || 20));
  const barY = 1888;
  const barH = 6;
  ctx.save();
  ctx.fillStyle = tok.reservoir.progressBg;
  ctx.fillRect(60, barY, w - 120, barH);

  const activeColor = engine.winner ? tok.celebration.gold : tok.text.gold;
  ctx.fillStyle = activeColor;
  ctx.shadowColor = activeColor;
  ctx.shadowBlur = 6;
  ctx.fillRect(60, barY, (w - 120) * progress, barH);
  ctx.restore();
}

function drawArenaCelebrationGlow(renderer, engine) {
  const ctx = renderer.ctx;
  const winner = engine.winner;
  if (!winner) return;
  const tok = renderer.getThemeTokens();

  ctx.save();
  ctx.globalAlpha = engine.winnerBannerAlpha;

  const isDraw = !!winner.isDraw || winner.side === 'draw';

  if (isDraw) {
    // Balanced highlight for both reservoir collector trays on draw
    for (const side of ['left', 'right']) {
      const lane = engine.lanes[side];
      if (lane) {
        ctx.strokeStyle = tok.scoreboard.statusActive;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(lane.minX + 8, engine.bottomY - 55, lane.width - 16, 60, 12);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  const winLane = engine.lanes[winner.side];
  const otherSide = winner.side === 'left' ? 'right' : 'left';
  const loseLane = engine.lanes[otherSide];
  const winTok = tok.lanes[winner.side] || tok.lanes.left;

  // 1. Subtle, elegant dimming veil over losing lane to direct focal attention
  if (loseLane) {
    ctx.fillStyle = renderer.theme === 'dark' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(loseLane.minX - 6, engine.topY, loseLane.width + 12, engine.trackHeight + 70);
  }

  // 2. Crisp, Professional Spotlight over Winning Chassis & Reservoir
  if (winLane) {
    const reservoirCenterX = winLane.minX + winLane.width / 2;
    const reservoirFloorY = engine.bottomY - 25;

    const winAura = ctx.createRadialGradient(
      reservoirCenterX,
      reservoirFloorY,
      15,
      reservoirCenterX,
      reservoirFloorY,
      220
    );
    winAura.addColorStop(0, winTok.glowColor);
    winAura.addColorStop(0.5, winTok.subtleBg || 'rgba(0,0,0,0)');
    winAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = winAura;
    ctx.fillRect(winLane.minX - 20, engine.bottomY - 100, winLane.width + 40, 140);

    // Clean, refined team-accented outline around the winning lane chassis
    ctx.strokeStyle = tok.celebration.gold;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = tok.celebration.gold;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(winLane.minX, engine.topY, winLane.width, engine.trackHeight, 20);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crisp metallic trim on reservoir collector tray
    ctx.strokeStyle = tok.reservoir.trayBorder;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(winLane.minX + 8, engine.bottomY - 55, winLane.width - 16, 60, 12);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCelebration(renderer, engine) {
  const ctx = renderer.ctx;
  const w = renderer.width;
  const winner = engine.winner;
  if (!winner) return;

  ctx.save();
  ctx.globalAlpha = engine.winnerBannerAlpha;
  const tok = renderer.getThemeTokens();

  const leftLane = engine.lanes.left;
  const rightLane = engine.lanes.right;
  const isDraw = !!winner.isDraw || winner.side === 'draw';
  const isLeftWin = !isDraw && winner.side === 'left';
  const isRightWin = !isDraw && winner.side === 'right';

  const leftBalls = leftLane.balls ? leftLane.balls.length : (leftLane.exactScore || 0);
  const rightBalls = rightLane.balls ? rightLane.balls.length : (rightLane.exactScore || 0);
  const winnerTeamName = isDraw ? 'DRAW' : (isLeftWin ? 'PURPLE' : 'GREEN');

  // 1. Frosted Esports Lower-Third Container
  const cardW = 960;
  const cardH = 142;
  const cardX = (w - cardW) / 2;
  const cardY = 1680;

  // Ambient drop shadow
  ctx.save();
  ctx.shadowColor = tok.celebration.cardShadow;
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 18);
  ctx.fillStyle = tok.celebration.cardBg;
  ctx.fill();
  ctx.restore();

  // Subtle glass vertical gradient fill
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 18);
  ctx.fillStyle = tok.celebration.cardBg;
  ctx.fill();

  // 1px Refined Metallic/Neon Border
  ctx.strokeStyle = tok.celebration.cardBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Specular entry sheen sweep across the glass card
  const sheenProgress = Math.min(1.0, engine.winnerBannerAlpha * 1.4);
  const sheenX = cardX - 80 + sheenProgress * (cardW + 160);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 18);
  ctx.clip();
  const sheenGrad = ctx.createLinearGradient(sheenX - 35, cardY, sheenX + 35, cardY + cardH);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheenGrad.addColorStop(0.5, renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(sheenX - 50, cardY, 100, cardH);
  ctx.restore();

  // -------------------------------------------------------------
  // Tier 1: Top Broadcast Badge & Motion Replay Cue (cardY + 12)
  // -------------------------------------------------------------
  const badgeX = cardX + 20;
  const badgeY = cardY + 12;
  const badgeH = 26;

  let badgeText;
  let badgeBorderColor;
  let badgeBgColor;
  let badgeTextColor;

  if (isDraw) {
    badgeText = '⚖️ MATCH TIED · OFFICIAL DRAW';
    badgeBorderColor = tok.scoreboard.statusActive;
    badgeBgColor = renderer.theme === 'dark' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.10)';
    badgeTextColor = tok.scoreboard.statusActive;
  } else {
    badgeText = `👑 VICTORY · ${winnerTeamName} TEAM`;
    badgeBorderColor = tok.celebration.gold;
    badgeBgColor = renderer.theme === 'dark' ? 'rgba(255, 215, 0, 0.14)' : 'rgba(217, 119, 6, 0.12)';
    badgeTextColor = tok.celebration.gold;
  }

  ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
  const badgeTextW = ctx.measureText(badgeText).width;
  const badgeW = Math.max(160, Math.min(270, Math.ceil(badgeTextW + 28)));

  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = badgeBgColor;
  ctx.fill();
  ctx.strokeStyle = badgeBorderColor;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = badgeTextColor;
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Replay Cue: Sleek Minimalist Loop Cue
  const replayW = 100;
  const replayH = 26;
  const replayX = cardX + cardW - 20 - replayW;
  const replayY = cardY + 12;

  ctx.beginPath();
  ctx.roundRect(replayX, replayY, replayW, replayH, 6);
  ctx.fillStyle = renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  ctx.fill();
  ctx.strokeStyle = tok.celebration.cardBorder;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.celebration.statNumber;
  ctx.fillText('REPLAY ↻', replayX + replayW / 2, replayY + replayH / 2);

  // Center Headline
  const headlineMinX = badgeX + badgeW + 14;
  const headlineMaxX = replayX - 14;
  const availableHeadlineW = Math.max(100, headlineMaxX - headlineMinX);
  const headlineCenterX = (headlineMinX + headlineMaxX) / 2;
  const headlineCenterY = badgeY + badgeH / 2;

  let decidingReason = '';
  if (winner.decidingReason && typeof winner.decidingReason === 'string') {
    decidingReason = winner.decidingReason.trim();
  } else if (winner.condition && typeof winner.condition === 'string') {
    decidingReason = winner.condition.trim();
  } else if (winner.narrative && typeof winner.narrative === 'string') {
    decidingReason = winner.narrative.trim();
  } else if (engine.result && engine.result.decidingReason) {
    decidingReason = String(engine.result.decidingReason).trim();
  } else if (engine.config && engine.config.decidingReason) {
    decidingReason = String(engine.config.decidingReason).trim();
  }

  if (!decidingReason) {
    const totalTiers = (leftLane.tiles && leftLane.tiles.length) || 6;
    if (isDraw) {
      if (winner.isTimeout) {
        decidingReason = 'MATCH TIED · EQUAL PROGRESS AT TIMEOUT';
      } else {
        decidingReason = 'MATCH TIED · SIMULTANEOUS FINISH IN RESERVOIR';
      }
    } else if (typeof winner.finishTime === 'number' && !winner.isTimeout) {
      decidingReason = `FIRST TO CLEAR TIER ${totalTiers} & REACH RESERVOIR (${winner.finishTime.toFixed(2)}s)`;
    } else if (winner.isTimeout) {
      const winLane = isLeftWin ? leftLane : rightLane;
      const loseLane = isLeftWin ? rightLane : leftLane;
      const winTier = Math.min(totalTiers, (winLane.currentTier || 0) + 1);
      const loseTier = Math.min(totalTiers, (loseLane.currentTier || 0) + 1);
      if (winTier > loseTier) {
        decidingReason = `DECIDED ON TIER PROGRESS (TIER ${winTier} VS ${loseTier}) AT TIMEOUT`;
      } else {
        decidingReason = 'DECIDED ON TIEBREAKER HP & SCORE AT TIMEOUT';
      }
    } else {
      decidingReason = 'CHAMPIONSHIP VICTORY';
    }
  }

  let headlineFontSize = 12;
  ctx.font = `700 ${headlineFontSize}px "Inter", "Segoe UI", sans-serif`;
  let measuredW = ctx.measureText(decidingReason).width;

  while (measuredW > availableHeadlineW && headlineFontSize > 9.5) {
    headlineFontSize -= 0.5;
    ctx.font = `700 ${headlineFontSize}px "Inter", "Segoe UI", sans-serif`;
    measuredW = ctx.measureText(decidingReason).width;
  }

  let displayHeadline = decidingReason;
  if (measuredW > availableHeadlineW) {
    while (displayHeadline.length > 4 && ctx.measureText(displayHeadline + '…').width > availableHeadlineW) {
      displayHeadline = displayHeadline.slice(0, -1).trim();
    }
    displayHeadline += '…';
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(headlineMinX, badgeY - 2, availableHeadlineW, badgeH + 4);
  ctx.clip();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${headlineFontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.fillStyle = tok.celebration.headline;
  ctx.fillText(displayHeadline, headlineCenterX, headlineCenterY);
  ctx.restore();

  // Clean Horizontal Hairline Divider
  ctx.beginPath();
  ctx.moveTo(cardX + 20, cardY + 47);
  ctx.lineTo(cardX + cardW - 20, cardY + 47);
  ctx.strokeStyle = tok.celebration.divider;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // -------------------------------------------------------------
  // Tier 2: Physical Marble Scoreboard Comparison (cardY + 50 to cardY + 135)
  // -------------------------------------------------------------
  const leftIsWinner = isLeftWin;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX + 24, cardY + 58, 4, 66, 2);
  ctx.fillStyle = leftIsWinner ? tok.celebration.gold : tok.lanes.left.color;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '950 44px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = (leftIsWinner || isDraw) ? tok.celebration.statNumber : tok.celebration.statLabel;
  ctx.fillText(leftBalls.toLocaleString(), cardX + 38, cardY + 91);

  ctx.font = '800 14px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.lanes.left.color;
  ctx.fillText('PURPLE TEAM', cardX + 135, cardY + 80);

  ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
  let leftStatus;
  if (isDraw) {
    leftStatus = `TIED · TIER ${Math.min(6, leftLane.currentTier + 1)}/6`;
    ctx.fillStyle = tok.celebration.statNumber;
  } else if (leftIsWinner) {
    leftStatus = 'CHAMPION 🏆 (1st PLACE)';
    ctx.fillStyle = tok.celebration.gold;
  } else {
    leftStatus = `RUNNER-UP · TIER ${Math.min(6, leftLane.currentTier + 1)}/6`;
    ctx.fillStyle = tok.celebration.statLabel;
  }
  ctx.fillText(`${leftBalls} MARBLES · ${leftStatus}`, cardX + 135, cardY + 102);
  ctx.restore();

  // Center VS / Match Verdict Divider
  ctx.save();
  const midPillW = 90;
  const midPillH = 26;
  const midPillX = w / 2 - midPillW / 2;
  const midPillY = cardY + 78;

  ctx.beginPath();
  ctx.roundRect(midPillX, midPillY, midPillW, midPillH, 13);
  ctx.fillStyle = isDraw ? (renderer.theme === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.10)') : tok.celebration.vsBg;
  ctx.fill();
  ctx.strokeStyle = isDraw ? tok.scoreboard.statusActive : tok.celebration.vsBorder;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 11px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = isDraw ? tok.scoreboard.statusActive : tok.celebration.vsText;
  ctx.fillText(isDraw ? 'TIED' : 'VS', w / 2, midPillY + midPillH / 2);
  ctx.restore();

  // Right Team Presentation Block
  const rightIsWinner = isRightWin;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX + cardW - 28, cardY + 58, 4, 66, 2);
  ctx.fillStyle = rightIsWinner ? tok.celebration.gold : tok.lanes.right.color;
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '950 44px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = (rightIsWinner || isDraw) ? tok.celebration.statNumber : tok.celebration.statLabel;
  ctx.fillText(rightBalls.toLocaleString(), cardX + cardW - 38, cardY + 91);

  ctx.font = '800 14px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.lanes.right.color;
  ctx.fillText('GREEN TEAM', cardX + cardW - 135, cardY + 80);

  ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
  let rightStatus;
  if (isDraw) {
    rightStatus = `TIED · TIER ${Math.min(6, rightLane.currentTier + 1)}/6`;
    ctx.fillStyle = tok.celebration.statNumber;
  } else if (rightIsWinner) {
    rightStatus = 'CHAMPION 🏆 (1st PLACE)';
    ctx.fillStyle = tok.celebration.gold;
  } else {
    rightStatus = `RUNNER-UP · TIER ${Math.min(6, rightLane.currentTier + 1)}/6`;
    ctx.fillStyle = tok.celebration.statLabel;
  }
  ctx.fillText(`${rightBalls} MARBLES · ${rightStatus}`, cardX + cardW - 135, cardY + 102);
  ctx.restore();
  ctx.restore();

  ctx.restore();
}

function drawWinnerBanner(renderer, engine) {
  drawCelebration(renderer, engine);
}

function drawWatermark(renderer) {
  const ctx = renderer.ctx;
  const tok = renderer.getThemeTokens();
  ctx.save();
  ctx.font = '800 13px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.watermark;
  ctx.textAlign = 'center';
  ctx.fillText('BURSTPOINT · ARCADE SIMULATION', renderer.width / 2, 1905);
  ctx.restore();
}

if (typeof window !== 'undefined') {
  window.drawFinishLineAndProgress = drawFinishLineAndProgress;
  window.drawArenaCelebrationGlow = drawArenaCelebrationGlow;
  window.drawCelebration = drawCelebration;
  window.drawWinnerBanner = drawWinnerBanner;
  window.drawWatermark = drawWatermark;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    drawFinishLineAndProgress,
    drawArenaCelebrationGlow,
    drawCelebration,
    drawWinnerBanner,
    drawWatermark
  };
}
