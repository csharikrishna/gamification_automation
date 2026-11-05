// Multiplying Ball Race - Header & Scoreboard Rendering Layer
// Renders top broadcast hook banner, team scorecards, stage indicators, and leader tags.

function checkRaceLeader(lane, other) {
  if (lane.reachedBottom && !other.reachedBottom) return true;
  if (other.reachedBottom && !lane.reachedBottom) return false;
  if (lane.currentTier > other.currentTier) return true;
  if (lane.currentTier < other.currentTier) return false;

  const t1 = lane.tiles[lane.currentTier];
  const t2 = other.tiles[other.currentTier];
  if (t1 && t2) {
    const dmg1 = t1.maxHP - t1.currentHP;
    const dmg2 = t2.maxHP - t2.currentHP;
    if (Math.abs(dmg1 - dmg2) > 3) return dmg1 > dmg2;
  }
  return lane.exactScore > other.exactScore;
}

function drawHeader(renderer, engine) {
  const ctx = renderer.ctx;
  const w = renderer.width;
  const tok = renderer.getThemeTokens();
  const left = engine.lanes.left;
  const right = engine.lanes.right;

  // Fixed Broadcast Header Chassis Backing
  const headerGrad = ctx.createLinearGradient(0, 0, 0, 312);
  headerGrad.addColorStop(0, tok.header.gradStops[0]);
  headerGrad.addColorStop(0.75, tok.header.gradStops[1]);
  headerGrad.addColorStop(1, tok.header.gradStops[2]);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, w, 312);

  ctx.strokeStyle = tok.header.border;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(30, 312);
  ctx.lineTo(w - 30, 312);
  ctx.stroke();

  // 1. Top Broadcast Hook Banner
  const isUnderdogChallenge = engine.config.title?.includes('3 BALLS VS 12');
  const headerTitle = engine.config.title || '3 BALLS VS 12 — CAN THE UNDERDOG WIN?';
  const headerSubtitle = engine.config.subtitle || 'MULTIPLY (×3) VS ADD (+2) · RACE TO THE FINISH';

  ctx.save();
  const barW = w - 60;
  const barH = 88;
  const barX = 30;
  const barY = 20;

  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 20);
  ctx.fillStyle = tok.header.barBg;
  ctx.fill();
  ctx.strokeStyle = tok.header.barBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const textCenter = w / 2;

  if (isUnderdogChallenge) {
    ctx.textBaseline = 'middle';
    ctx.font = '800 20px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.text.secondary;
    ctx.textAlign = 'center';
    ctx.fillText('VS', textCenter, barY + 32);

    ctx.font = '900 32px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.lanes.left.color;
    ctx.textAlign = 'right';
    ctx.fillText('3 BALLS', textCenter - 28, barY + 32);

    ctx.font = '900 32px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.lanes.right.color;
    ctx.textAlign = 'left';
    ctx.fillText('12 BALLS', textCenter + 28, barY + 32);

    ctx.font = '800 17px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.header.subtitleColor;
    ctx.textAlign = 'center';
    ctx.fillText('CAN THE UNDERDOG WIN?', textCenter, barY + 65);
  } else {
    ctx.font = '900 28px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.header.titleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headerTitle, textCenter, barY + 32);

    ctx.font = '700 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = tok.header.subtitleColor;
    ctx.fillText(headerSubtitle, textCenter, barY + 65);
  }
  ctx.restore();

  // 2. Broadcast Team Scorecards
  const isLeftLeader = checkRaceLeader(left, right);
  const isRightLeader = checkRaceLeader(right, left);
  const isMatchDraw = engine.winner && (!!engine.winner.isDraw || engine.winner.side === 'draw');
  const isLeftWinner = !isMatchDraw && engine.winner && engine.winner.side === 'left';
  const isRightWinner = !isMatchDraw && engine.winner && engine.winner.side === 'right';

  drawScoreCard(renderer, left, 285, 216, isLeftLeader, isLeftWinner, engine);
  drawScoreCard(renderer, right, 795, 216, isRightLeader, isRightWinner, engine);

  // 3. Central Stage Indicator Badge
  const leadingTier = Math.max(left.currentTier, right.currentTier);
  const currentN = Math.min(6, leadingTier + 1);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(w / 2 - 70, 196, 140, 38, 19);
  ctx.fillStyle = tok.header.badgeBg;
  ctx.fill();
  ctx.strokeStyle = tok.header.badgeBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = '900 14px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tok.header.titleColor;
  ctx.fillText(`TIER ${currentN} / 6`, w / 2, 215);

  // Progress pips underneath badge
  const pipY = 248;
  const pipSpacing = 16;
  const startPipX = w / 2 - (5 * pipSpacing) / 2;
  for (let p = 0; p < 6; p++) {
    ctx.beginPath();
    ctx.arc(startPipX + p * pipSpacing, pipY, 4, 0, Math.PI * 2);
    ctx.fillStyle = p < currentN ? tok.header.pipActive : tok.header.pipInactive;
    ctx.fill();
  }
  ctx.restore();
}

function drawScoreCard(renderer, lane, centerX, centerY, isLeader = false, isWinner = false, engine = null) {
  const ctx = renderer.ctx;
  const tok = renderer.getThemeTokens();
  const laneTok = tok.lanes[lane.side] || tok.lanes.left;
  ctx.save();

  const cardW = 280;
  const cardH = 160;
  const cardX = centerX - cardW / 2;
  const cardY = centerY - cardH / 2;

  // Card background & subtle border
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fillStyle = isWinner ? tok.scoreboard.cardBgWinner : tok.scoreboard.cardBg;
  ctx.fill();

  ctx.strokeStyle = isWinner ? tok.celebration.gold : (isLeader ? laneTok.color : tok.scoreboard.cardBorder);
  ctx.lineWidth = (isWinner || isLeader) ? 2.0 : 1.0;
  if (isLeader || isWinner) {
    ctx.shadowColor = isWinner ? tok.celebration.gold : laneTok.color;
    ctx.shadowBlur = 10;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 1. Top row: Team Rule Pill (left) + Starting Baseline Headstart Pill (right)
  const teamName = lane.side === 'left' ? 'PURPLE' : 'GREEN';
  const ruleLabel = lane.ruleLabel || (lane.side === 'left' ? '×2' : '+8');
  const startCount = lane.initialBalls || (lane.side === 'left' ? 3 : 12);

  // Team Pill
  ctx.beginPath();
  ctx.roundRect(cardX + 12, cardY + 12, 140, 24, 12);
  ctx.fillStyle = isWinner ? 'rgba(255, 215, 0, 0.15)' : (renderer.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');
  ctx.fill();
  ctx.strokeStyle = isWinner ? tok.celebration.gold : laneTok.color;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = laneTok.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${teamName} · ${ruleLabel}`, cardX + 12 + 70, cardY + 24);

  // Start Pill (distinguishes baseline starting balls from current swarm)
  const startPillX = cardX + cardW - 12 - 96;
  ctx.beginPath();
  ctx.roundRect(startPillX, cardY + 12, 96, 24, 12);
  ctx.fillStyle = tok.scoreboard.metaPillBg;
  ctx.fill();
  ctx.strokeStyle = tok.scoreboard.cardBorder;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.font = '700 11px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.scoreboard.metaPillText;
  ctx.fillText(`START: ${startCount}`, startPillX + 48, cardY + 24);

  // 2. Middle row: Big Crisp Numeric Current Score with punch scale
  const scoreVal = Math.round(lane.displayScore).toLocaleString();
  ctx.save();
  ctx.translate(centerX, cardY + 76);
  ctx.scale(lane.scoreScale, lane.scoreScale);

  ctx.font = '950 50px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.scoreboard.numberColor;
  if (isWinner || isLeader) {
    ctx.shadowColor = laneTok.color;
    ctx.shadowBlur = 10;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(scoreVal, 0, 0);
  ctx.restore();

  // 3. Bottom row: Active Marbles in Arena (left) + Race Placement / Progress (right)
  const activeMarbles = lane.balls ? lane.balls.length : 0;
  const bottomPillY = cardY + cardH - 32;

  // Active marbles tag
  ctx.font = '700 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = tok.scoreboard.labelColor;
  ctx.textAlign = 'left';
  ctx.fillText(`${activeMarbles} IN ARENA`, cardX + 16, bottomPillY + 10);

  // Race Placement / Tier Progress Tag (right aligned)
  let statusText = '';
  let statusColor = tok.scoreboard.statusActive;

  if (engine && engine.winner) {
    if (engine.winner.isDraw || engine.winner.side === 'draw') {
      statusText = '🤝 TIED · DRAW';
      statusColor = tok.scoreboard.statusActive;
    } else if (isWinner) {
      statusText = '🏆 1st PLACE';
      statusColor = tok.celebration.gold;
    } else {
      statusText = '2nd PLACE';
      statusColor = tok.scoreboard.metaPillText;
    }
  } else if (lane.reachedBottom) {
    statusText = '🏁 FINISHED';
    statusColor = tok.celebration.gold;
  } else if (isLeader) {
    statusText = `⚡ LEADER · T${lane.currentTier + 1}`;
    statusColor = tok.celebration.gold;
  } else {
    statusText = `TIER ${lane.currentTier + 1}/6`;
    statusColor = tok.scoreboard.metaPillText;
  }

  ctx.font = '800 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillStyle = statusColor;
  ctx.textAlign = 'right';
  ctx.fillText(statusText, cardX + cardW - 16, bottomPillY + 10);

  ctx.restore();
}

if (typeof window !== 'undefined') {
  window.drawHeader = drawHeader;
  window.drawScoreCard = drawScoreCard;
  window.checkRaceLeader = checkRaceLeader;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawHeader, drawScoreCard, checkRaceLeader };
}
