// Automated Daily Physics Shorts Production Pipeline
// Uses AI Director to formulate, simulate, and render a new viral game every day

const fs = require('fs');
const path = require('path');
const { AIDirector } = require('../../src/ai_director');
const { renderVideo } = require('../../render');

async function runDailyAutomation() {
  const args = process.argv.slice(2);
  let daysToGenerate = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) daysToGenerate = parseInt(args[++i], 10);
  }

  console.log('='.repeat(70));
  console.log(`🤖 AI DIRECTOR DAILY AUTOMATION PIPELINE`);
  console.log(`Generating & Simulating ${daysToGenerate} Day(s) of Unique Physics Games`);
  console.log('='.repeat(70));

  const director = new AIDirector();
  const queueDir = path.resolve('daily_queue');
  if (!fs.existsSync(queueDir)) fs.mkdirSync(queueDir, { recursive: true });

  const schedulePath = path.join(queueDir, 'calendar_schedule.json');
  let schedule = [];
  if (fs.existsSync(schedulePath)) {
    try { schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8')); } catch (e) {}
  }

  for (let day = 0; day < daysToGenerate; day++) {
    console.log(`\n🧠 [Day ${day + 1}/${daysToGenerate}] AI Director formulating concept...`);
    const gameConfig = await director.formulateDailyGame(day);

    const dayFolder = path.join(queueDir, gameConfig.date);
    if (!fs.existsSync(dayFolder)) fs.mkdirSync(dayFolder, { recursive: true });

    const configPath = path.join(dayFolder, 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify(gameConfig, null, 2));

    console.log(`✨ Concept formulated: "${gameConfig.title}"`);
    console.log(`🎮 Game Mode: ${gameConfig.gameType}`);
    console.log(`📁 Target folder: ${path.relative(process.cwd(), dayFolder)}`);

    const outputMp4Path = path.join(dayFolder, `${gameConfig.id}_1080x1920.mp4`);

    try {
      await renderVideo({
        config: gameConfig,
        output: outputMp4Path,
        fps: 60,
        quality: 0.82
      });

      const entry = {
        date: gameConfig.date,
        gameType: gameConfig.gameType,
        title: gameConfig.title,
        videoPath: outputMp4Path,
        metadata: gameConfig.metadata,
        generatedAt: new Date().toISOString()
      };

      schedule.push(entry);
      fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));

      console.log(`✅ [${gameConfig.date}] Video & Metadata ready in ${dayFolder}`);
    } catch (err) {
      console.error(`❌ Failed rendering day ${gameConfig.date}:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`🎉 DAILY AUTOMATION RUN COMPLETE!`);
  console.log(`All videos, configurations, and metadata are ready in ${queueDir}`);
  console.log(`Schedule calendar updated: ${schedulePath}`);
  console.log('='.repeat(70));
}

if (require.main === module) {
  runDailyAutomation().catch(console.error);
}

module.exports = { runDailyAutomation };
