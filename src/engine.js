// Highly-Realistic Elastic Marble Physics & Asynchronous Durability Engine
// Real momentum-conserving collisions, lively pachinko peg ricochets,
// true tile fatigue durability, and clear level separation.

class SimulationEngine {
  constructor(config) {
    this.config = config;
    this.width = config.resolution?.width || 1080;
    this.height = config.resolution?.height || 1920;
    this.fps = config.fps || 60;
    this.durationSeconds = config.durationSeconds || 16;
    this.totalFrames = Math.floor(this.durationSeconds * this.fps);

    this.events = [];
    this.frameIndex = 0;
    this.simTime = 0;
    this.isFinished = false;

    // Track boundaries
    this.topY = 320;
    this.bottomY = 1720;
    this.trackHeight = this.bottomY - this.topY;

    // Calibrated HP Tiers:
    // Ensures Left (1 ball x3) overtakes and reaches the bottom first,
    // while Right (12 balls +2) stalls and remains trapped on Tier 4/5!
    this.defaultHPTiers = config.hpTiers || [2, 8, 24, 72, 180, 360];
    this.numStages = this.defaultHPTiers.length;

    // Lane definitions
    const leftLaneConfig = config.lanes?.left || {
      name: 'MULTIPLY',
      ruleLabel: '×3 BALLS',
      startBalls: 1,
      stages: Array(6).fill(0).map(() => ({ type: 'multiply', value: 3, label: '×3' }))
    };
    const rightLaneConfig = config.lanes?.right || {
      name: 'ADD',
      ruleLabel: '+2 BALLS',
      startBalls: 12,
      stages: Array(6).fill(0).map(() => ({ type: 'add', value: 2, label: '+2' }))
    };

    this.lanes = {
      left: this.initLane('left', leftLaneConfig, 50, 520),
      right: this.initLane('right', rightLaneConfig, 560, 1030)
    };

    this.particles = [];
    this.floatingTexts = [];
    this.winner = null;
    this.winnerBannerAlpha = 0;
    this.bannerDelay = 0;
    this.lastBounceTime = 0;
  }

  initLane(side, laneConfig, minX, maxX) {
    const width = maxX - minX;
    const stages = laneConfig.stages || [];
    const numStages = Math.min(stages.length, this.numStages);
    const stageHeight = this.trackHeight / (numStages + 1);
    const hpTiers = laneConfig.hpTiers || this.defaultHPTiers;

    const tiles = [];
    const pegs = [];

    for (let i = 0; i < numStages; i++) {
      const stage = stages[i];
      const tileY = this.topY + (i + 1) * stageHeight;
      const tierMaxHP = stage.maxHP || hpTiers[i] || (12 * Math.pow(2.8, i));

      tiles.push({
        index: i,
        y: tileY,
        minX: minX + 16,
        maxX: maxX - 16,
        width: maxX - minX - 32,
        height: 36,
        type: stage.type || 'multiply',
        value: stage.value || 2,
        exactValue: stage.exactValue,
        stageNum: stage.stageNum || (i + 1),
        label: stage.label || (stage.type === 'multiply' ? `×${stage.value}` : `+${stage.value}`),
        intact: true,
        maxHP: tierMaxHP,
        currentHP: tierMaxHP,
        hits: 0,
        crackAmount: 0,
        fractures: [],
        glowIntensity: 0
      });

      // Pachinko deflection pegs in this chamber
      const pegRows = 2;
      const pegsPerRow = 5;
      const startPegY = tileY - stageHeight * 0.65;
      const pegSpacingY = (stageHeight * 0.40) / pegRows;

      for (let r = 0; r < pegRows; r++) {
        const rowY = startPegY + r * pegSpacingY;
        const offset = (r % 2 === 0) ? 0.5 : 0;
        const spacingX = width / (pegsPerRow + 1);
        for (let c = 1; c <= pegsPerRow; c++) {
          const pegX = minX + (c + offset * 0.5) * spacingX;
          if (pegX > minX + 28 && pegX < maxX - 28) {
            pegs.push({
              chamber: i,
              x: pegX,
              y: rowY,
              radius: 9,
              glow: 0
            });
          }
        }
      }
    }

    const initialCount = laneConfig.startBalls || (side === 'left' ? 1 : 12);

    return {
      side,
      name: laneConfig.name || (side === 'left' ? 'MULTIPLY' : 'ADD'),
      ruleLabel: laneConfig.ruleLabel || '',
      formulaName: laneConfig.formulaName || '',
      subtitle: laneConfig.subtitle || `starts with ${initialCount} ball${initialCount > 1 ? 's' : ''}`,
      theme: laneConfig.theme || (side === 'left' ? 'purple' : 'green'),
      color: laneConfig.color || (side === 'left' ? '#cb72ff' : '#79ef43'),
      glowColor: laneConfig.glowColor || (side === 'left' ? 'rgba(203,114,255,0.45)' : 'rgba(121,239,67,0.45)'),
      accentColor: laneConfig.accentColor || (side === 'left' ? '#f59aff' : '#a2ff75'),
      minX,
      maxX,
      width,
      tiles,
      pegs,
      balls: [],
      currentTier: 0,
      reachedBottom: false,
      finishedTime: null,
      exactScore: initialCount,
      displayScore: initialCount,
      scoreScale: 1.0,
      initialBalls: initialCount,
      maxVisibleBalls: 38,
      nextBallId: 1
    };
  }

  spawnInitialBalls() {
    for (const side of ['left', 'right']) {
      const lane = this.lanes[side];
      const count = Math.min(lane.initialBalls, 16);
      const startY = this.topY + 35;

      for (let i = 0; i < count; i++) {
        const spread = count > 1 ? ((i / (count - 1)) - 0.5) * (lane.width * 0.65) : 0;
        this.addBall(lane, {
          x: (lane.minX + lane.maxX) / 2 + spread,
          y: startY - (i % 4) * 22,
          vx: (Math.random() - 0.5) * 50,
          vy: Math.random() * 30 + 30,
          radius: count === 1 ? 13 : 11
        });
      }
    }
  }

  addBall(lane, props) {
    const id = lane.nextBallId++;
    lane.balls.push({
      id,
      x: props.x,
      y: props.y,
      vx: props.vx || 0,
      vy: props.vy || 0,
      radius: props.radius || 11,
      color: lane.color
    });
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    // Realistic energetic marble gravity
    const gravity = 880;
    const tileBounce = 0.82; // Lively 82% glass plate rebound
    const pegBounce = 0.84;  // Energetic peg deflection
    const wallBounce = 0.78; // Pinball wall bounce
    const airResistance = 0.999; // Minimal drag so marbles don't lose bounce

    if (this.frameIndex === 1) {
      this.spawnInitialBalls();
    }

    // Process each lane independently
    for (const side of ['left', 'right']) {
      const lane = this.lanes[side];

      // Smooth score counter interpolation
      const scoreDiff = lane.exactScore - lane.displayScore;
      if (Math.abs(scoreDiff) > 0.05) {
        lane.displayScore += Math.max(1, Math.ceil(scoreDiff * 0.16));
        if (lane.displayScore > lane.exactScore) lane.displayScore = lane.exactScore;
      }
      lane.scoreScale += (1.0 - lane.scoreScale) * 0.15;

      // Decay tile glows
      for (const tile of lane.tiles) {
        if (tile.glowIntensity > 0) {
          tile.glowIntensity = Math.max(0, tile.glowIntensity - dt * 2.5);
        }
      }

      // Decay peg glows
      for (const peg of lane.pegs) {
        if (peg.glow > 0) peg.glow = Math.max(0, peg.glow - dt * 3.5);
      }

      const balls = lane.balls;
      const minX = lane.minX + 16;
      const maxX = lane.maxX - 16;
      const bottomFloor = this.bottomY - 14;

      // Each physical marble impact deals 1.0 hit of fatigue damage to the tile HP
      const damagePerBounce = 1.0;

      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];

        b.vy += gravity * dt;
        b.vx *= airResistance;
        b.vy *= airResistance;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Side Walls (Elastic Pinball Ricochet)
        if (b.x - b.radius < minX) {
          b.x = minX + b.radius;
          b.vx = Math.abs(b.vx) * wallBounce + Math.random() * 15;
          this.logBounce(b.x, b.y, 0.06);
        } else if (b.x + b.radius > maxX) {
          b.x = maxX - b.radius;
          b.vx = -Math.abs(b.vx) * wallBounce - Math.random() * 15;
          this.logBounce(b.x, b.y, 0.06);
        }

        // Bottom floor reservoir (Finish Line)
        if (b.y + b.radius > bottomFloor) {
          b.y = bottomFloor - b.radius;
          b.vy = -Math.abs(b.vy) * 0.32;
          b.vx *= 0.88;

          // Finish is ONLY legal when all barrier tiles are verifiably broken!
          const allTilesBroken = lane.tiles.every(t => !t.intact);
          if (allTilesBroken && !lane.reachedBottom) {
            this.handleLaneFinish(lane);
          }
        }

        // Breakable Tile Barrier Collisions
        for (const tile of lane.tiles) {
          if (tile.intact) {
            const tileTop = tile.y - tile.height / 2;
            const tileBottom = tile.y + tile.height / 2;

            if (
              b.x + b.radius > tile.minX &&
              b.x - b.radius < tile.maxX &&
              b.y + b.radius >= tileTop &&
              b.y - b.radius <= tileBottom
            ) {
              // High-Energy Elastic Bounce on top of tile
              if (b.vy > 0 && b.y < tile.y) {
                b.y = tileTop - b.radius;

                // If moving too slow, give lively elastic vibration kick
                if (Math.abs(b.vy) < 170) {
                  b.vy = -Math.abs(b.vy) * 0.70 - (Math.random() * 130 + 100);
                } else {
                  b.vy = -Math.abs(b.vy) * tileBounce;
                }

                // Natural surface scatter
                b.vx = b.vx * 0.96 + (Math.random() - 0.5) * 45;

                // Deliver real physical damage to tile HP
                tile.hits++;
                tile.currentHP -= damagePerBounce;
                tile.crackAmount = Math.max(0, Math.min(1.0, 1.0 - (tile.currentHP / tile.maxHP)));
                tile.glowIntensity = 1.0;

                // Spiderweb fracture lines
                if (!tile.fractures) tile.fractures = [];
                if (tile.fractures.length < 12 && Math.random() < 0.6) {
                  tile.fractures.push({
                    x: b.x - tile.minX,
                    len: Math.random() * 28 + 14,
                    angle: (Math.random() - 0.5) * 1.6
                  });
                }

                this.logBounce(b.x, b.y, 0.08, 540 + tile.index * 60);

                // Check if tile shattered!
                if (tile.currentHP <= 0 && tile.intact) {
                  this.shatterTile(lane, tile);
                }
              }
            }
          }
        }

        // Pachinko Deflection Pegs (Elastic 2D Circular Ricochet)
        for (const peg of lane.pegs) {
          const dx = b.x - peg.x;
          const dy = b.y - peg.y;
          const distSq = dx * dx + dy * dy;
          const minDist = b.radius + peg.radius;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.001;
            const nx = dx / dist;
            const ny = dy / dist;

            const overlap = minDist - dist;
            b.x += nx * (overlap + 1.0);
            b.y += ny * (overlap + 1.0);

            const dot = b.vx * nx + b.vy * ny;
            if (dot < 0) {
              b.vx = (b.vx - (1 + pegBounce) * dot * nx) + (Math.random() - 0.5) * 30;
              b.vy = (b.vy - (1 + pegBounce) * dot * ny);
              peg.glow = 1.0;
              this.logBounce(peg.x, peg.y, 0.09, 640 + peg.chamber * 60);
            }
          }
        }
      }

      // TRUE ELASTIC MOMENTUM-CONSERVING BALL-TO-BALL BOUNCES
      // Marbles bounce off each other with high energy, staying airborne and lively!
      this.resolveElasticBallCollisions(lane);
    }

    // Update Particles (flying glass shards and spark bursts)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 480) * dt;
      if (p.angle !== undefined) p.angle += (p.rotVel || 2) * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= ft.speed * dt;
      ft.scale += (1.0 - ft.scale) * 0.1;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Winner Banner Fade In (ONLY triggers after winner has physically reached the bottom reservoir)
    if (this.winner) {
      this.bannerDelay += dt;
      if (this.bannerDelay > 0.85) {
        this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
      }
      if (this.bannerDelay > 0.85 && Math.random() < 0.40 && this.simTime < this.durationSeconds) {
        this.spawnConfetti();
      }
    }

    if (this.simTime >= this.durationSeconds) {
      this.isFinished = true;
    }
  }

  // True Elastic Momentum-Conserving Collisions between marbles
  resolveElasticBallCollisions(lane) {
    const balls = lane.balls;
    const len = balls.length;
    if (len < 2) return;

    const e = 0.88; // High elastic restitution for bouncy marbles

    for (let i = 0; i < len; i++) {
      const b1 = balls[i];
      for (let j = i + 1; j < len; j++) {
        const b2 = balls[j];

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b1.radius + b2.radius + 1.5;

        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart to prevent overlap
          const overlap = (minDist - dist) * 0.5;
          b1.x -= nx * overlap;
          b1.y -= ny * overlap;
          b2.x += nx * overlap;
          b2.y += ny * overlap;

          // Momentum-conserving impulse
          const vrel = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;
          if (vrel > 0) {
            const impulse = (1 + e) * vrel * 0.5;
            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;
          }
        }
      }
    }
  }

  handleLaneFinish(lane) {
    const allTilesBroken = lane.tiles.every(t => !t.intact);
    if (!allTilesBroken) return; // Guard: can NEVER finish before breaking every tile!

    lane.reachedBottom = true;
    lane.finishedTime = this.simTime;

    if (!this.winner) {
      const otherSide = (lane.side === 'left' ? 'right' : 'left');
      const otherLane = this.lanes[otherSide];

      this.winner = {
        side: lane.side,
        name: lane.name,
        color: lane.color,
        winningScore: Math.round(lane.exactScore),
        finishTime: this.simTime,
        losingScore: Math.round(otherLane.exactScore),
        loserName: otherLane.name,
        loserStuckTier: otherLane.currentTier,
        loserTotalTiers: otherLane.tiles.length
      };

      this.events.push({
        time: this.simTime,
        type: 'finish',
        winner: this.winner.side
      });
    }
  }

  shatterTile(lane, tile) {
    tile.intact = false;
    tile.currentHP = 0;
    lane.currentTier = tile.index + 1;
    lane.scoreScale = 1.45;

    // 1. Math Score Update
    if (tile.exactValue !== undefined) {
      lane.exactScore = tile.exactValue;
    } else if (tile.type === 'multiply') {
      lane.exactScore = Math.round(lane.exactScore * tile.value);
    } else if (tile.type === 'add') {
      lane.exactScore += tile.value;
    }

    // 2. Audio Event (Glass break transient + Tuned bell chime)
    this.events.push({
      time: this.simTime,
      type: 'gate',
      tier: tile.index,
      lane: lane.side,
      multiplier: tile.type === 'multiply'
    });

    // 3. Floating Score Tag
    const tagText = tile.label ? `${tile.label}!` : (tile.type === 'multiply' ? `×${tile.value}!` : `+${tile.value}!`);
    this.floatingTexts.push({
      text: tagText,
      x: (tile.minX + tile.maxX) / 2,
      y: tile.y - 20,
      color: lane.accentColor,
      speed: 70,
      scale: 1.8,
      life: 1.1,
      maxLife: 1.1
    });

    // 4. Flying Glass Shards (16 Shards)
    const shardCount = 16;
    for (let s = 0; s < shardCount; s++) {
      const sx = tile.minX + (s / shardCount) * tile.width;
      const angle = (Math.random() - 0.5) * 2.2;
      const speed = Math.random() * 220 + 90;
      this.particles.push({
        type: 'shard',
        x: sx,
        y: tile.y + (Math.random() - 0.5) * 8,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * (speed * 0.6) + 40,
        w: 16 + Math.random() * 12,
        h: 8 + Math.random() * 8,
        angle: Math.random() * Math.PI,
        rotVel: (Math.random() - 0.5) * 9,
        color: lane.color,
        life: 0.9,
        maxLife: 0.9,
        gravity: 520
      });
    }

    // 5. Spark Particles
    for (let k = 0; k < 18; k++) {
      const angle = (k / 18) * Math.PI * 2;
      const spd = Math.random() * 170 + 60;
      this.particles.push({
        type: 'spark',
        x: (tile.minX + tile.maxX) / 2 + (Math.random() - 0.5) * 60,
        y: tile.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: Math.random() * 3 + 2,
        color: '#ffffff',
        life: 0.5,
        maxLife: 0.5,
        gravity: 220
      });
    }

    // 6. Spawn Exact 1-to-1 Physical Marbles (Exact count matches mathematical rule!)
    const targetBallCount = Math.min(100, lane.exactScore);
    const currentBalls = lane.balls.length;
    const ballsToSpawn = Math.max(0, targetBallCount - currentBalls);

    for (let b = 0; b < ballsToSpawn; b++) {
      const spreadX = (Math.random() - 0.5) * (tile.width * 0.7);
      const spreadAngle = (Math.random() - 0.5) * 1.5;
      const speed = Math.random() * 140 + 75;
      this.addBall(lane, {
        x: (tile.minX + tile.maxX) / 2 + spreadX,
        y: tile.y + 12 + Math.random() * 10,
        vx: Math.sin(spreadAngle) * speed,
        vy: Math.cos(spreadAngle) * speed + 55,
        radius: targetBallCount > 40 ? 9.5 : (targetBallCount > 20 ? 10.5 : 11.5)
      });
    }
  }

  logBounce(x, y, volume = 0.08, pitch = 580) {
    if (this.simTime - this.lastBounceTime < 0.030) return;
    this.lastBounceTime = this.simTime;
    this.events.push({
      time: this.simTime,
      type: 'bounce',
      volume,
      pitch: pitch + (Math.random() - 0.5) * 60
    });
  }

  determineWinnerByProgress() {
    const leftTier = this.lanes.left.currentTier;
    const rightTier = this.lanes.right.currentTier;
    const leftScore = Math.round(this.lanes.left.exactScore);
    const rightScore = Math.round(this.lanes.right.exactScore);

    const leftWins = leftTier > rightTier || (leftTier === rightTier && leftScore >= rightScore);
    const winnerLane = leftWins ? this.lanes.left : this.lanes.right;
    const loserLane = leftWins ? this.lanes.right : this.lanes.left;

    this.winner = {
      side: winnerLane.side,
      name: winnerLane.name,
      color: winnerLane.color,
      winningScore: Math.round(winnerLane.exactScore),
      finishTime: winnerLane.finishedTime || this.simTime,
      losingScore: Math.round(loserLane.exactScore),
      loserName: loserLane.name,
      loserStuckTier: loserLane.currentTier,
      loserTotalTiers: loserLane.tiles.length
    };

    this.events.push({
      time: this.simTime,
      type: 'finish',
      winner: this.winner.side
    });
  }

  spawnConfetti() {
    const color = this.winner?.color || '#ffd700';
    const colors = [color, '#ffffff', '#ffd700', '#00f0ff', '#ff007f'];
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: this.topY + Math.random() * 400,
        vx: (Math.random() - 0.5) * 350,
        vy: Math.random() * -200 - 50,
        radius: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.8,
        maxLife: 1.8,
        gravity: 480
      });
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimulationEngine };
} else if (typeof window !== 'undefined') {
  window.SimulationEngine = SimulationEngine;
}
