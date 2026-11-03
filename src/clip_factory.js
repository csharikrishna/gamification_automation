// Automated Clip Production Factory (Milestone M3)
// Generates 100 candidate scenarios across 4 games (25 each), executes autonomous simulations,
// analyzes events and pacing, scores visual interest and technical invariants,
// rejects near-duplicates, and compiles a validated candidate clip catalog.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GameManager } = require('./game_manager.js');
const { PRNG } = require('./prng.js');

class ClipFactory {
  constructor(options = {}) {
    this.targetPerGame = options.targetPerGame || 25;
    this.outputDir = options.outputDir || path.resolve('output');
    this.qualityThreshold = options.qualityThreshold || 70;
    this.rng = new PRNG(options.seed || 5555);

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // 1. Generate 25 candidate configurations for a specific gameType
  generateScenariosForGame(gameType, count = 25) {
    const scenarios = [];

    for (let i = 1; i <= count; i++) {
      const seed = 10000 + (this.rng.int(1000, 99999));
      let cfg;

      if (gameType === 'multi_race') {
        const archetypes = [
          { title: '⚡ 1 BALL VS 100 BALLS: CAN MULTIPLY WIN? ⚡', leftStart: 1, rightStart: 100, lType: 'multiply', lVal: 3, rType: 'add', rVal: 8 },
          { title: '📈 EXPONENTIAL ×2 VS LINEAR +25 SHOWDOWN 📈', leftStart: 4, rightStart: 30, lType: 'multiply', lVal: 2, rType: 'add', rVal: 25 },
          { title: '🔥 50,000 MARBLE SURGE: ×4 VS ×3 🔥', leftStart: 2, rightStart: 12, lType: 'multiply', lVal: 4, rType: 'multiply', lVal: 3 },
          { title: '⚠️ HIGH STAKES GAMBLE: ×5 VS SAFE +15 ⚠️', leftStart: 5, rightStart: 20, lType: 'multiply', lVal: 5, rType: 'add', rVal: 15 },
          { title: '🌿 FIBONACCI VS EXPONENTIAL 2ⁿ 🌿', leftStart: 1, rightStart: 2, lType: 'multiply', lVal: 2, rType: 'multiply', rVal: 2 }
        ];
        const arch = archetypes[(i - 1) % archetypes.length];

        cfg = {
          id: `clip_race_${String(i).padStart(2, '0')}`,
          gameType: 'multi_race',
          seed,
          title: arch.title,
          subtitle: `Candidate #${i} · Seed ${seed}`,
          durationSeconds: 15,
          fps: 60,
          lanes: {
            left: {
              startBalls: arch.leftStart,
              stages: Array(6).fill(0).map((_, s) => ({
                type: arch.lType,
                value: arch.lVal,
                label: arch.lType === 'multiply' ? `×${arch.lVal}` : `+${arch.lVal}`,
                maxHP: Math.round(4 * Math.pow(2.5, s))
              }))
            },
            right: {
              startBalls: arch.rightStart,
              stages: Array(6).fill(0).map((_, s) => ({
                type: arch.rType,
                value: arch.rVal,
                label: arch.rType === 'multiply' ? `×${arch.rVal}` : `+${arch.rVal}`,
                maxHP: Math.round(4 * Math.pow(2.5, s))
              }))
            }
          },
          hookText: `Who wins: ${arch.leftStart} ball (×${arch.lVal}) or ${arch.rightStart} balls? 😱`,
          tags: ['#shorts', '#physics', '#gaming', '#marblerun', '#satisfying']
        };

      } else if (gameType === 'mega_plinko') {
        const ballCounts = [120, 160, 200, 250, 300];
        const count = ballCounts[(i - 1) % ballCounts.length];
        const titles = [
          '🎰 1,000× JACKPOT HUNT · CAN WE HIT GOLD? 🎰',
          '⚡ 250 GLOWING BALLS VS PYRAMID OF FORTUNE ⚡',
          '💰 EXTREME HIGH-ROLLER PLINKO: ALL OR NOTHING 💰',
          '🔥 UNSTOPPABLE MARBLE AVALANCHE · PICK YOUR BIN! 🔥'
        ];

        cfg = {
          id: `clip_plinko_${String(i).padStart(2, '0')}`,
          gameType: 'mega_plinko',
          seed,
          title: titles[(i - 1) % titles.length],
          subtitle: `Dropping ${count} balls · 1,000× jackpot hunt!`,
          durationSeconds: 15,
          fps: 60,
          ballCount: count,
          hookText: `Can ANY of these ${count} balls hit the 1,000× slot?! 🎰`,
          tags: ['#plinko', '#jackpot', '#satisfying', '#shorts', '#physics']
        };

      } else if (gameType === 'sumo_arena') {
        const competitorCounts = [24, 32, 40, 48];
        const count = competitorCounts[(i - 1) % competitorCounts.length];
        const titles = [
          '👑 32-MARBLE BATTLE ROYALE · 1 SOLE SURVIVOR 👑',
          '🔥 RING OF FIRE: LAST MARBLE IN THE CIRCLE WINS 🔥',
          '⚡ TITAN GOLD VS CYBER CYAN · DEADLY KNOCKOUTS ⚡',
          '💀 SHRINKING DANGER ZONE: WHO OUTLASTS THEM ALL? 💀'
        ];

        cfg = {
          id: `clip_sumo_${String(i).padStart(2, '0')}`,
          gameType: 'sumo_arena',
          seed,
          title: titles[(i - 1) % titles.length],
          subtitle: `${count} autonomous marbles battle for survival!`,
          durationSeconds: 15,
          fps: 60,
          competitorCount: count,
          hookText: `Pick your marble color before the ring shrinks! 👑`,
          tags: ['#battleroyale', '#sumo', '#marbles', '#shorts', '#gaming']
        };

      } else if (gameType === 'brick_breaker') {
        const ballBudgets = [180, 240, 300, 360];
        const count = ballBudgets[(i - 1) % ballBudgets.length];
        const titles = [
          '💥 300 BALL SWARM VS 1,000 HP NEON BRICKS 💥',
          '🌈 CAN THIS GLOWING SWARM CLEAR 100% OF THE BOARD? 🌈',
          '⚡ ASMR BRICK DEMOLITION: MAXIMUM SATISFACTION ⚡',
          '🔥 UNSTOPPABLE CANNON BARRAGE DEMOLISHES EVERYTHING 🔥'
        ];

        cfg = {
          id: `clip_breaker_${String(i).padStart(2, '0')}`,
          gameType: 'brick_breaker',
          seed,
          title: titles[(i - 1) % titles.length],
          subtitle: `${count} physics balls unleashed on heavy neon bricks!`,
          durationSeconds: 15,
          fps: 60,
          ballCount: count,
          hookText: `Watch the entire board get demolished in 15 seconds! 💥`,
          tags: ['#brickbreaker', '#asmr', '#satisfying', '#shorts', '#physics']
        };
      }

      scenarios.push(cfg);
    }

    return scenarios;
  }

  // 2. Evaluate a simulation run, measure pacing, drama, and invariants
  evaluateCandidate(config) {
    const game = GameManager.createGame(config);
    const dt = 1 / (config.fps || 60);
    const totalFrames = Math.ceil((config.durationSeconds || 15) * (config.fps || 60));

    let openingEvents = 0;
    let midEvents = 0;
    let lateEvents = 0;

    for (let f = 0; f < totalFrames; f++) {
      game.step(dt);
      const t = f * dt;

      const events = game.getEvents();
      if (events.length > 0) {
        const recent = events[events.length - 1];
        if (recent.time <= 2.0) openingEvents++;
        else if (recent.time <= 10.0) midEvents++;
        else lateEvents++;
      }
    }

    const result = game.getResult();
    const replay = game.getReplay();

    // Scoring Breakdown (0 - 100)
    // A. Hook & Opening (25 pts): activity in first 2 seconds
    const hookScore = Math.min(25, 10 + openingEvents * 1.5);

    // B. Pacing & Flow (25 pts): events distributed well over time
    const pacingScore = (midEvents > 5 && lateEvents > 2) ? 25 : 15;

    // C. Climax & Drama (25 pts): winner declared or dramatic finish
    let dramaScore = 20;
    if (config.gameType === 'multi_race' && result.winner) dramaScore = 25;
    if (config.gameType === 'mega_plinko' && result.score > 500) dramaScore = 25;
    if (config.gameType === 'sumo_arena' && result.aliveCount <= 2) dramaScore = 25;
    if (config.gameType === 'brick_breaker' && result.score >= 50) dramaScore = 25;

    // D. Technical Integrity (25 pts): 0 crashes, proper termination
    const technicalScore = result.isFinished ? 25 : 20;

    const totalScore = Math.round(hookScore + pacingScore + dramaScore + technicalScore);

    // Deduplication Fingerprint (hash of core outcome + rules)
    const outcomeSig = `${config.gameType}_${result.winner}_${result.winningScore || result.score}_${Math.round(result.finishTime || 15)}`;
    const fingerprint = crypto.createHash('md5').update(outcomeSig).digest('hex').substring(0, 10);

    return {
      id: config.id,
      gameType: config.gameType,
      seed: config.seed,
      title: config.title,
      hookText: config.hookText,
      tags: config.tags,
      qualityScore: totalScore,
      breakdown: {
        hook: Math.round(hookScore),
        pacing: pacingScore,
        drama: dramaScore,
        technical: technicalScore
      },
      resultSummary: {
        winner: result.winner,
        score: result.winningScore || result.score,
        finishTime: Number((result.finishTime || 15).toFixed(2))
      },
      fingerprint,
      isQualified: totalScore >= this.qualityThreshold,
      config
    };
  }

  // 3. Generate and evaluate the full 100-candidate batch
  generateBatch100() {
    console.log('='.repeat(70));
    console.log('🏭 BURSTPOINT CLIP PRODUCTION FACTORY — 100-CANDIDATE BATCH PIPELINE');
    console.log('='.repeat(70));

    const games = ['multi_race', 'mega_plinko', 'sumo_arena', 'brick_breaker'];
    const catalog = {
      generatedAt: new Date().toISOString(),
      totalTarget: 100,
      totalGenerated: 0,
      totalQualified: 0,
      games: {},
      candidates: []
    };

    const seenFingerprints = new Set();
    let duplicatesFiltered = 0;

    for (const g of games) {
      console.log(`\n📦 Generating & Simulating 25 Candidates for [${g}]...`);
      const scenarios = this.generateScenariosForGame(g, this.targetPerGame);
      catalog.games[g] = { target: scenarios.length, qualified: 0, list: [] };

      for (let idx = 0; idx < scenarios.length; idx++) {
        const sc = scenarios[idx];
        const evalResult = this.evaluateCandidate(sc);

        // Near-duplicate check
        if (seenFingerprints.has(evalResult.fingerprint)) {
          duplicatesFiltered++;
          evalResult.isDuplicate = true;
          evalResult.qualityScore -= 10;
        } else {
          seenFingerprints.add(evalResult.fingerprint);
          evalResult.isDuplicate = false;
        }

        if (evalResult.isQualified && !evalResult.isDuplicate) {
          catalog.games[g].qualified++;
          catalog.totalQualified++;
        }

        catalog.totalGenerated++;
        catalog.candidates.push(evalResult);
        catalog.games[g].list.push(evalResult.id);

        process.stdout.write(`  [${idx + 1}/${scenarios.length}] ${evalResult.id} (Score: ${evalResult.qualityScore}/100) — ${evalResult.isQualified ? '✅ QUALIFIED' : '⚠️ REJECTED'}\n`);
      }

      console.log(`  ✓ [${g}] Complete: ${catalog.games[g].qualified}/${scenarios.length} passed quality gate.`);
    }

    const catalogPath = path.join(this.outputDir, 'candidate_catalog_100.json');
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('🎉 100-CANDIDATE BATCH PRODUCTION COMPLETE!');
    console.log(`Total Candidates Evaluated: ${catalog.totalGenerated}/100`);
    console.log(`Total Qualified for Release: ${catalog.totalQualified}`);
    console.log(`Near-Duplicates Filtered:    ${duplicatesFiltered}`);
    console.log(`Catalog saved to:            ${catalogPath}`);
    console.log('='.repeat(70));

    return catalog;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClipFactory };
}
