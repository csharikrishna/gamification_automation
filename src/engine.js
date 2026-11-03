// Highly-Realistic Deterministic Elastic Marble Physics & Asynchronous Durability Engine
// Built for YouTube Shorts / TikTok vertical (1080x1920) 60 FPS simulations.
// Features: Seeded PRNG, Substep Anti-Tunneling, Decoupled Population Model,
// Full Operation Support (+, -, *, /), and Unbiased Race Resolution.

var _ConfigValidator = (typeof require !== 'undefined')
  ? require('./config_validator.js').ConfigValidator
  : (typeof window !== 'undefined' ? window.ConfigValidator : null);

// Fast, High-Quality Deterministic Seeded PRNG (Mulberry32)
var _EnginePRNG = (typeof PRNG !== 'undefined')
  ? PRNG
  : (typeof require !== 'undefined' ? require('./prng.js').PRNG : class {
      constructor(seed = 1337) { this.s = (seed >>> 0) || 1337; }
      random() { let t = (this.s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
      range(min, max) { return min + this.random() * (max - min); }
    });

class SimulationEngine {
  constructor(config = {}) {
    // P0-09: Validate configuration schema before execution
    if (_ConfigValidator) {
      _ConfigValidator.validate(config);
    }
    this.config = config;

    // Seeded PRNG for 100% Bit-Exact Determinism (PHY-01, TEST-03)
    this.seed = config.seed ?? 1337;
    this.rng = new _EnginePRNG(this.seed);

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

    // Configurable Physics Parameters (P0-05, PHY-10)
    const phys = config.physics || {};
    this.gravity = phys.gravity ?? 880;
    this.tileBounce = phys.tileBounce ?? 0.82;
    this.pegBounce = phys.pegBounce ?? 0.84;
    this.wallBounce = phys.wallBounce ?? 0.78;
    this.airResistance = phys.airResistance ?? 0.999;
    this.ballRestitution = phys.ballRestitution ?? 0.88;
    this.substeps = phys.substeps ?? 2; // PHY-07: Substeps eliminate tunneling through thin barriers

    // Population Architecture (P0-10, P0-01, P0-02, P0-03)
    // Max simulated physical marbles ceiling to prevent O(N^2) lag while maintaining swarm fidelity
    this.maxSimulatedBalls = config.maxSimulatedBalls || 180;

    // Durability progression
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
        value: stage.value !== undefined ? stage.value : 2,
        exactValue: stage.exactValue,
        stageNum: stage.stageNum || (i + 1),
        label: stage.label || (stage.type === 'multiply' ? `×${stage.value}` : (stage.type === 'subtract' ? `-${stage.value}` : `+${stage.value}`)),
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

    const initialCount = laneConfig.startBalls !== undefined ? laneConfig.startBalls : (side === 'left' ? 1 : 12);

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
      nextBallId: 1,
      lastBounceTime: 0 // AUD-03: Independent per-lane audio cooldown
    };
  }

  // P0-01: Removed arbitrary 16-ball cap. Exact population initialization.
  spawnInitialBalls() {
    for (const side of ['left', 'right']) {
      const lane = this.lanes[side];
      const count = Math.min(lane.initialBalls, this.maxSimulatedBalls);
      const startY = this.topY + 35;

      for (let i = 0; i < count; i++) {
        const spread = count > 1 ? ((i / (count - 1)) - 0.5) * (lane.width * 0.70) : 0;
        this.addBall(lane, {
          x: (lane.minX + lane.maxX) / 2 + spread,
          y: startY - (i % 6) * 18,
          vx: this.rng.range(-20, 20),
          vy: this.rng.range(20, 50),
          radius: count === 1 ? 13 : (count > 60 ? 9.5 : (count > 25 ? 10.5 : 11.5))
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
      color: lane.color,
      spawnTime: props.spawnTime !== undefined ? props.spawnTime : this.simTime,
      sourceX: props.sourceX !== undefined ? props.sourceX : props.x,
      sourceY: props.sourceY !== undefined ? props.sourceY : props.y
    });
  }

  update(dt = 1 / 60) {
    this.simTime += dt;
    this.frameIndex++;

    if (this.frameIndex === 1) {
      this.spawnInitialBalls();
    }

    // P0-08, RACE-09: Proper bidirectional score interpolation
    for (const side of ['left', 'right']) {
      const lane = this.lanes[side];
      const scoreDiff = lane.exactScore - lane.displayScore;
      if (Math.abs(scoreDiff) > 0.05) {
        if (scoreDiff > 0) {
          lane.displayScore += Math.max(1, Math.ceil(scoreDiff * 0.16));
          if (lane.displayScore > lane.exactScore) lane.displayScore = lane.exactScore;
        } else {
          lane.displayScore += Math.min(-1, Math.floor(scoreDiff * 0.16));
          if (lane.displayScore < lane.exactScore) lane.displayScore = lane.exactScore;
        }
      }
      lane.scoreScale += (1.0 - lane.scoreScale) * 0.15;

      // Decay glows
      for (const tile of lane.tiles) {
        if (tile.glowIntensity > 0) {
          tile.glowIntensity = Math.max(0, tile.glowIntensity - dt * 2.5);
        }
      }
      for (const peg of lane.pegs) {
        if (peg.glow > 0) peg.glow = Math.max(0, peg.glow - dt * 3.5);
      }
    }

    // PHY-07: Substep physics execution to prevent discrete tunneling through thin tiles
    const subDt = dt / this.substeps;
    for (let step = 0; step < this.substeps; step++) {
      this.updatePhysicsSubstep(subDt);
    }

    // Update Particles
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

    // P0-06, P0-07, RACE-04, RACE-10: Unbiased Race Resolution at end of frame
    this.evaluateRaceResolution(dt);

    if (this.simTime >= this.durationSeconds - 0.001 || (this.totalFrames && this.frameIndex >= this.totalFrames)) {
      this.isFinished = true;
    }
  }

  updatePhysicsSubstep(subDt) {
    this.isUpdatingPhysics = true;
    const bottomFloor = this.bottomY - 14;

    for (const side of ['left', 'right']) {
      const lane = this.lanes[side];
      const balls = lane.balls;
      const minX = lane.minX + 16;
      const maxX = lane.maxX - 16;

      // P0-10: Each simulated marble carries a weight multiplier representing the mathematical population
      // This ensures that when population exceeds simulated max, tile damage scales proportionally!
      const swarmWeight = Math.max(1, lane.exactScore / Math.max(1, balls.length));
      const damagePerBounce = 1.0 * swarmWeight;

      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (!b || b._dead) continue;

        const prevY = b.y;

        b.vy += this.gravity * subDt;
        b.vx *= this.airResistance;
        b.vy *= this.airResistance;

        b.x += b.vx * subDt;
        b.y += b.vy * subDt;

        // PHY-14: Hard safety clamp ensures balls can never tunnel or escape track boundaries
        b.x = Math.max(minX + b.radius, Math.min(maxX - b.radius, b.x));

        // Side Walls (Deterministic Pinball Ricochet)
        if (b.x - b.radius <= minX) {
          b.x = minX + b.radius;
          b.vx = Math.abs(b.vx) * this.wallBounce + this.rng.range(0, 15);
          this.logBounce(lane.side, b.x, b.y, 0.06);
        } else if (b.x + b.radius >= maxX) {
          b.x = maxX - b.radius;
          b.vx = -Math.abs(b.vx) * this.wallBounce - this.rng.range(0, 15);
          this.logBounce(lane.side, b.x, b.y, 0.06);
        }

        // Breakable Tile Barrier Collisions (Continuous sweep to prevent tunneling)
        for (const tile of lane.tiles) {
          if (tile.intact) {
            const tileTop = tile.y - tile.height / 2;
            const tileBottom = tile.y + tile.height / 2;

            if (b.x + b.radius > tile.minX && b.x - b.radius < tile.maxX) {
              if ((prevY + b.radius <= tileTop + 6 && b.y + b.radius >= tileTop) ||
                  (b.y + b.radius >= tileTop && b.y < tileBottom && b.vy >= 0)) {
                b.y = tileTop - b.radius;

                if (Math.abs(b.vy) < 160) {
                  b.vy = -Math.abs(b.vy) * 0.75 - this.rng.range(110, 220);
                } else {
                  b.vy = -Math.abs(b.vy) * this.tileBounce;
                }

                const tileCenter = (tile.minX + tile.maxX) / 2;
                const halfW = tile.width / 2;
                const centerDist = (b.x - tileCenter) / halfW;
                b.vx = b.vx * 0.96 + Math.sign(centerDist || (this.rng.random() < 0.5 ? 1 : -1)) * (36 + Math.abs(centerDist) * 55) + this.rng.range(-15, 15);

                // Record localized collision impact for visual feedback
                if (!tile.recentImpacts) tile.recentImpacts = [];
                tile.recentImpacts.push({
                  x: b.x,
                  y: tileTop,
                  time: this.simTime,
                  intensity: Math.min(1.0, Math.abs(b.vy) / 280 + 0.35)
                });
                if (tile.recentImpacts.length > 8) tile.recentImpacts.shift();

                // Interactive trigger core activation if ball hits near central multiplier capsule
                if (Math.abs(b.x - tileCenter) < 58) {
                  tile.triggerPulse = 1.0;
                }

                // Only take damage and shatter before race is decided
                if (!this.winner) {
                  tile.hits++;
                  tile.currentHP = Math.max(0, tile.currentHP - damagePerBounce);
                  tile.crackAmount = Math.max(0, Math.min(1.0, 1.0 - (tile.currentHP / tile.maxHP)));
                  tile.glowIntensity = 1.0;

                  // Localized stress fractures contained within barrier power cells
                  if (!tile.fractures) tile.fractures = [];
                  if (tile.fractures.length < 16 && this.rng.random() < 0.6) {
                    tile.fractures.push({
                      x: b.x - tile.minX,
                      y: 4,
                      len: this.rng.range(6, 18),
                      angle: this.rng.range(-Math.PI, Math.PI)
                    });
                    if (tile.fractures.length > 20) tile.fractures.shift();
                  }

                  this.logBounce(lane.side, b.x, b.y, 0.08, 540 + tile.index * 60);

                  if (tile.currentHP <= 0 && tile.intact) {
                    this.shatterTile(lane, tile);
                  }
                } else {
                  this.logBounce(lane.side, b.x, b.y, 0.04, 520);
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
              b.vx = (b.vx - (1 + this.pegBounce) * dot * nx) + this.rng.range(-15, 15);
              b.vy = (b.vy - (1 + this.pegBounce) * dot * ny);
              peg.glow = 1.0;
              this.logBounce(lane.side, peg.x, peg.y, 0.09, 640 + peg.chamber * 60);
            }
          }
        }

        // Bottom floor reservoir (Finish Line with gentle concave basin for natural settling)
        const laneCenterX = (lane.minX + lane.maxX) / 2;
        const normDistX = Math.min(1.0, Math.abs(b.x - laneCenterX) / (lane.width * 0.48));
        const basinFloorY = bottomFloor - 8 * (1 - normDistX * normDistX);

        if (b.y + b.radius > basinFloorY) {
          b.y = basinFloorY - b.radius;
          b.vy = -Math.abs(b.vy) * 0.35;
          b.vx = b.vx * 0.982 + ((laneCenterX - b.x) / lane.width) * 12;

          const allTilesBroken = lane.tiles.every(t => !t.intact);
          if (allTilesBroken && !lane.reachedBottom) {
            lane.reachedBottom = true;
            lane.finishedTime = this.simTime;
          }
        }
      }

      // PHY-06, PHY-08: Relaxed 2-pass elastic collisions with coincident separation
      this.resolveElasticBallCollisions(lane);
      this.resolveElasticBallCollisions(lane);

      // Post-collision barrier containment: ensure ball-to-ball repulsion never pushes balls past intact tiles
      for (const b of lane.balls) {
        if (b._dead) continue;
        for (const tile of lane.tiles) {
          if (tile.intact && b.x + b.radius > tile.minX && b.x - b.radius < tile.maxX) {
            const tileTop = tile.y - tile.height / 2;
            if (b.y + b.radius > tileTop && b.y < tile.y) {
              b.y = tileTop - b.radius;
              if (b.vy > 0) b.vy = -b.vy * 0.5;
            }
          }
        }
      }

      // Safe purge of despawned balls after substep physics completes
      lane.balls = lane.balls.filter(b => !b._dead);
    }
    this.isUpdatingPhysics = false;
  }

  // PHY-06, PHY-08: Momentum-conserving marble collisions with coincident protection
  // Risk B: O(N) Spatial Grid Collision Solver for 180-Marble Swarms
  resolveElasticBallCollisions(lane) {
    const balls = lane.balls;
    const len = balls.length;
    if (len < 2) return;

    const e = this.ballRestitution;
    const cellSize = 30; // Grid cell slightly larger than max diameter (23px)
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

            // PHY-06: Coincident ball separation
            if (distSq < 0.001) {
              dx = (b1.id % 2 === 0 ? 1 : -1) * 0.5;
              dy = 0.5;
              distSq = dx * dx + dy * dy;
            }

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.001;
              const nx = dx / dist;
              const ny = dy / dist;

              // Baumgarte position correction: shared 50/50 without explosive overshooting
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

                // Tangential rolling friction damping allows marbles to fluidly rotate past each other
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

  shatterTile(lane, tile) {
    tile.intact = false;
    tile.currentHP = 0;
    tile.shatterTime = this.simTime;
    lane.currentTier = tile.index + 1;
    lane.scoreScale = 1.45;

    // Propel all balls in this chamber downward through the open gate
    const stageHeight = this.trackHeight / (this.numStages + 1);
    const chamberTop = tile.y - stageHeight;
    for (const b of lane.balls) {
      if (!b._dead && b.y < tile.y + 20 && b.y > chamberTop && b.x > tile.minX && b.x < tile.maxX) {
        b.vy = Math.max(b.vy, 175) + this.rng.range(35, 95);
        b.vx += this.rng.range(-20, 20);
      }
    }

    // 1. Math Score Update
    if (tile.exactValue !== undefined) {
      lane.exactScore = tile.exactValue;
    } else if (tile.type === 'multiply') {
      lane.exactScore = Math.round(lane.exactScore * tile.value);
    } else if (tile.type === 'add') {
      lane.exactScore += tile.value;
    } else if (tile.type === 'subtract') {
      lane.exactScore = Math.max(0, lane.exactScore - tile.value);
    } else if (tile.type === 'divide') {
      lane.exactScore = Math.max(1, Math.round(lane.exactScore / Math.max(1, tile.value)));
    }

    // 2. Audio Event
    this.events.push({
      time: this.simTime,
      type: 'gate',
      tier: tile.index,
      lane: lane.side,
      multiplier: tile.type === 'multiply'
    });

    // 3. Floating Score Tag
    let tagText = tile.label;
    if (!tagText) {
      if (tile.type === 'multiply') tagText = `×${tile.value}!`;
      else if (tile.type === 'add') tagText = `+${tile.value}!`;
      else if (tile.type === 'subtract') tagText = `-${tile.value}!`;
      else if (tile.type === 'divide') tagText = `÷${tile.value}!`;
    }
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

    // 4. Flying Glass Shards (16 Shards) (PHY-05)
    const shardCount = 16;
    for (let s = 0; s < shardCount; s++) {
      const sx = tile.minX + (s / shardCount) * tile.width;
      const angle = this.rng.range(-1.1, 1.1);
      const speed = this.rng.range(90, 310);
      this.particles.push({
        type: 'shard',
        x: sx,
        y: tile.y + this.rng.range(-4, 4),
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * (speed * 0.6) + 40,
        w: this.rng.range(16, 28),
        h: this.rng.range(8, 16),
        angle: this.rng.range(0, Math.PI),
        rotVel: this.rng.range(-4.5, 4.5),
        color: lane.color,
        life: 0.9,
        maxLife: 0.9,
        gravity: 520
      });
    }

    // 5. Spark Particles
    for (let k = 0; k < 18; k++) {
      const angle = (k / 18) * Math.PI * 2;
      const spd = this.rng.range(60, 230);
      this.particles.push({
        type: 'spark',
        x: (tile.minX + tile.maxX) / 2 + this.rng.range(-30, 30),
        y: tile.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: this.rng.range(2, 5),
        color: '#ffffff',
        life: 0.5,
        maxLife: 0.5,
        gravity: 220
      });
    }

    // 6. Decoupled Physical Population Adjustment (P0-02, P0-03, P0-10)
    const targetSimulated = Math.min(this.maxSimulatedBalls, lane.exactScore);
    const currentBalls = lane.balls.length;

    if (targetSimulated > currentBalls) {
      // Spawn new marbles
      const toSpawn = targetSimulated - currentBalls;
      this.events.push({
        time: this.simTime,
        type: 'multiplication',
        lane: lane.side,
        count: toSpawn
      });

      // Spawn visual energy burst at the shattering tile
      for (let s = 0; s < 12; s++) {
        const sAngle = (s / 12) * Math.PI * 2;
        const sSpeed = this.rng.range(50, 160);
        this.particles.push({
          type: 'spawn_burst',
          x: (tile.minX + tile.maxX) / 2 + this.rng.range(-tile.width * 0.3, tile.width * 0.3),
          y: tile.y,
          vx: Math.cos(sAngle) * sSpeed,
          vy: Math.sin(sAngle) * sSpeed,
          radius: this.rng.range(2.5, 6),
          color: lane.accentColor,
          life: 0.45,
          maxLife: 0.45,
          gravity: 120
        });
      }

      for (let b = 0; b < toSpawn; b++) {
        const spreadX = this.rng.range(-tile.width * 0.36, tile.width * 0.36);
        const spreadAngle = this.rng.range(-0.65, 0.65);
        const speed = this.rng.range(95, 230);
        const spawnX = (tile.minX + tile.maxX) / 2 + spreadX;
        const spawnY = tile.y + 8 + this.rng.range(0, 24);
        this.addBall(lane, {
          x: spawnX,
          y: spawnY,
          vx: Math.sin(spreadAngle) * speed,
          vy: Math.abs(Math.cos(spreadAngle) * speed) + 85,
          radius: targetSimulated > 50 ? 9.5 : (targetSimulated > 20 ? 10.5 : 11.5),
          spawnTime: this.simTime,
          sourceX: spawnX,
          sourceY: tile.y
        });
      }
    } else if (targetSimulated < currentBalls) {
      // Remove excess marbles on subtraction or division safely without mutating array during iteration
      const toRemove = currentBalls - targetSimulated;
      let removedCount = 0;
      for (let j = lane.balls.length - 1; j >= 0 && removedCount < toRemove; j--) {
        const rem = lane.balls[j];
        if (!rem._dead) {
          rem._dead = true;
          removedCount++;
          this.particles.push({
            type: 'spark',
            x: rem.x,
            y: rem.y,
            vx: this.rng.range(-60, 60),
            vy: this.rng.range(-60, 60),
            radius: 4,
            color: '#ff4466',
            life: 0.6,
            maxLife: 0.6,
            gravity: -100
          });
        }
      }
      if (!this.isUpdatingPhysics) {
        lane.balls = lane.balls.filter(b => !b._dead);
      }
    }
  }

  // P0-06, P0-07, RACE-04, RACE-10: Deterministic & Unbiased Race Resolution
  evaluateRaceResolution(dt) {
    if (this.winner) {
      this.bannerDelay += dt;
      if (this.bannerDelay > 0.85) {
        this.winnerBannerAlpha = Math.min(1.0, this.winnerBannerAlpha + dt * 2.2);
      }
      if (this.bannerDelay > 0.85 && this.rng.random() < 0.40 && this.simTime < this.durationSeconds) {
        this.spawnConfetti();
      }
      return;
    }

    const left = this.lanes.left;
    const right = this.lanes.right;

    const leftFinished = left.reachedBottom;
    const rightFinished = right.reachedBottom;

    if (leftFinished || rightFinished) {
      let winnerSide = null;
      let isDraw = false;

      if (leftFinished && !rightFinished) {
        winnerSide = 'left';
      } else if (rightFinished && !leftFinished) {
        winnerSide = 'right';
      } else {
        // Both reached bottom in the exact same frame! (P0-07, RACE-04)
        if (left.exactScore > right.exactScore) {
          winnerSide = 'left';
        } else if (right.exactScore > left.exactScore) {
          winnerSide = 'right';
        } else if (left.finishedTime < right.finishedTime) {
          winnerSide = 'left';
        } else if (right.finishedTime < left.finishedTime) {
          winnerSide = 'right';
        } else {
          isDraw = true;
          winnerSide = 'draw';
        }
      }

      const winnerLane = winnerSide === 'left' ? left : right;
      const loserLane = winnerSide === 'left' ? right : left;

      this.winner = {
        side: winnerSide,
        isDraw,
        name: isDraw ? 'DRAW' : winnerLane.name,
        color: isDraw ? '#ffffff' : winnerLane.color,
        winningScore: isDraw ? Math.round(left.exactScore) : Math.round(winnerLane.exactScore),
        finishTime: isDraw ? left.finishedTime : winnerLane.finishedTime,
        losingScore: isDraw ? Math.round(right.exactScore) : Math.round(loserLane.exactScore),
        loserName: isDraw ? 'DRAW' : loserLane.name,
        loserStuckTier: isDraw ? left.currentTier : loserLane.currentTier,
        loserTotalTiers: left.tiles.length,
        isTimeout: false
      };

      this.events.push({
        time: this.simTime,
        type: 'finish',
        winner: this.winner.side
      });

    } else if (this.simTime >= this.durationSeconds - 0.001 || (this.totalFrames && this.frameIndex >= this.totalFrames)) {
      // P0-06, RACE-03: Race timeout resolution
      const leftTier = left.currentTier;
      const rightTier = right.currentTier;

      let winnerSide = null;
      let isDraw = false;

      if (leftTier > rightTier) {
        winnerSide = 'left';
      } else if (rightTier > leftTier) {
        winnerSide = 'right';
      } else {
        // Compare damage dealt to current barrier
        const leftTile = left.tiles[leftTier];
        const rightTile = right.tiles[rightTier];
        const leftDmg = leftTile ? (leftTile.maxHP - leftTile.currentHP) : 0;
        const rightDmg = rightTile ? (rightTile.maxHP - rightTile.currentHP) : 0;

        if (leftDmg > rightDmg) {
          winnerSide = 'left';
        } else if (rightDmg > leftDmg) {
          winnerSide = 'right';
        } else if (left.exactScore > right.exactScore) {
          winnerSide = 'left';
        } else if (right.exactScore > left.exactScore) {
          winnerSide = 'right';
        } else {
          isDraw = true;
          winnerSide = 'draw';
        }
      }

      const winnerLane = winnerSide === 'left' ? left : right;
      const loserLane = winnerSide === 'left' ? right : left;

      this.winner = {
        side: winnerSide,
        isDraw,
        name: isDraw ? 'DRAW' : winnerLane.name,
        color: isDraw ? '#ffffff' : winnerLane.color,
        winningScore: isDraw ? Math.round(left.exactScore) : Math.round(winnerLane.exactScore),
        finishTime: this.simTime,
        losingScore: isDraw ? Math.round(right.exactScore) : Math.round(loserLane.exactScore),
        loserName: isDraw ? 'DRAW' : loserLane.name,
        loserStuckTier: isDraw ? left.currentTier : loserLane.currentTier,
        loserTotalTiers: left.tiles.length,
        isTimeout: true
      };

      this.events.push({
        time: this.simTime,
        type: 'finish',
        winner: this.winner.side
      });
    }
  }

  // AUD-02, AUD-03: Per-lane bounce cooldown and spatial panning
  logBounce(side, x, y, volume = 0.08, pitch = 580) {
    const lane = this.lanes[side];
    if (lane && this.simTime - lane.lastBounceTime < 0.030) return;
    if (lane) lane.lastBounceTime = this.simTime;

    this.events.push({
      time: this.simTime,
      type: 'bounce',
      lane: side,
      volume,
      pitch: pitch + this.rng.range(-30, 30)
    });
  }

  spawnConfetti() {
    const color = this.winner?.color || '#ffd700';
    const colors = [color, '#ffffff', '#ffd700', '#00f0ff', '#ff007f'];
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.rng.range(0, this.width),
        y: this.topY + this.rng.range(0, 400),
        vx: this.rng.range(-175, 175),
        vy: this.rng.range(-250, -50),
        radius: this.rng.range(3, 8),
        color: colors[Math.floor(this.rng.range(0, colors.length))],
        life: 1.8,
        maxLife: 1.8,
        gravity: 480
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.SimulationEngine = SimulationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimulationEngine };
}
