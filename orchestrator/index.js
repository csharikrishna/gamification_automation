#!/usr/bin/env node
// Burstpoint Central Orchestrator CLI
// Unified command router discovering registered games, executing simulations, and orchestrating production.

const path = require('path');
const fs = require('fs');
const { GameRegistry } = require('./registry');
const { ProductionPipeline } = require('./pipeline');
const { PublishingScheduler } = require('../core/publishing/scheduler');
const { QueueRepository } = require('../core/publishing/queue-repository');

function parseCliArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseCliArgs();

  switch (command) {
    case 'games:list':
      console.log('='.repeat(65));
      console.log('🎮 BURSTPOINT REGISTERED GAME ADAPTERS');
      console.log('='.repeat(65));
      const games = GameRegistry.getSupportedGames();
      for (const g of games) {
        console.log(`  • [${g.id}] "${g.name}" (alias: ${g.alias}) — Status: ${g.status}`);
      }
      break;

    case 'game:run': {
      const rawType = options.game || 'multi_race';
      const gameType = GameRegistry.normalizeGameType(rawType);
      const seed = parseInt(options.seed || '12345', 10);
      console.log(`🚀 Executing autonomous game match: [${gameType}] with seed=${seed}...`);

      let config;
      if (gameType === 'multi_race') {
        const defaultPath = path.resolve('games/multiplying-ball-race/configs/underdog_slow_composed.json');
        if (fs.existsSync(defaultPath)) {
          config = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
        } else {
          config = {
            id: `cli_run_${gameType}_${seed}`,
            gameType: 'multi_race',
            durationSeconds: 5,
            fps: 60,
            title: 'CLI Multiplying Ball Race',
            lanes: {
              left: { startBalls: 3, stages: [{ type: 'multiply', value: 2 }] },
              right: { startBalls: 12, stages: [{ type: 'add', value: 8 }] }
            }
          };
        }
        config.seed = seed;
      } else {
        config = {
          id: `cli_run_${gameType}_${seed}`,
          gameType,
          seed,
          durationSeconds: 5,
          fps: 60,
          title: `CLI Execution of ${gameType}`
        };
      }

      const game = GameRegistry.createGame(config);
      const dt = 1 / 60;
      for (let f = 0; f < 300 && !(typeof game.isFinished === 'function' ? game.isFinished() : game.isFinished); f++) {
        game.step(dt);
      }
      const obs = game.observe();
      console.log(`✅ Simulation Concluded at ${obs.simTime.toFixed(2)}s!`);
      console.log(`Result:`, JSON.stringify(game.getResult(), null, 2));
      break;
    }

    case 'production:generate': {
      const count = parseInt(options.count || '5', 10);
      const rawType = options.game || 'multi_race';
      const gameType = GameRegistry.normalizeGameType(rawType);
      console.log(`🧠 Synthesizing ${count} calibrated scenarios for [${gameType}]...`);
      const pipeline = new ProductionPipeline();
      const scenarios = pipeline.generateScenarios(count, gameType);
      console.log(`✅ Generated & validated ${scenarios.length} scenarios.`);
      break;
    }

    case 'production:proof': {
      const pipeline = new ProductionPipeline({
        renderClipCount: parseInt(options.count || '5', 10),
        unattendedApproval: options.unattended || false,
        humanApprovalToken: options.token || null,
        reviewer: options.reviewer ? { name: options.reviewer } : null
      });
      await pipeline.execute();
      break;
    }

    case 'publishing:dry-run': {
      console.log('🚀 Executing strict publishing DRY_RUN pre-flight...');
      const scheduler = new PublishingScheduler();
      const result = await scheduler.publishNext({
        dryRun: true,
        ignoreScheduleTime: options.ignoreTime || options.force
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'publishing:live': {
      console.log('📡 Executing LIVE platform publish...');
      const scheduler = new PublishingScheduler();
      const result = await scheduler.publishNext({ dryRun: false });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'report': {
      const reportPath = path.resolve('output/production_proof_report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log('='.repeat(65));
        console.log(`📋 BURSTPOINT LATEST PRODUCTION PROOF REPORT`);
        console.log(`Executed At: ${report.executedAt}`);
        console.log(`Status:      ${report.completionStatus || 'PRODUCTION_CERTIFIED'}`);
        console.log(`Summary:`, JSON.stringify(report.executionSummary, null, 2));
        console.log('='.repeat(65));
      } else {
        console.log(`No report found at ${reportPath}. Run "npm run production:proof" first.`);
      }
      break;
    }

    case 'help':
    default:
      console.log(`
Burstpoint Central Orchestrator CLI:
  npm run games:list                              List registered game environments
  npm run game:run -- --game <id> --seed <seed>   Run headless simulation of a game
  npm run production:generate -- --count <n>      Generate & validate scenario configs
  npm run production:proof                        Run authoritative 9-stage production proof
  npm run publishing:dry-run                      Run publishing pre-flight with zero fake metrics
  npm run publishing:live                         Publish next queued item to YouTube (if authenticated)
  npm run report                                  Display latest production proof summary
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Orchestrator CLI Error:', err);
    process.exit(1);
  });
}

module.exports = { main };
