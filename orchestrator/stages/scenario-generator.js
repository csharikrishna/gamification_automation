// Canonical Production Orchestrator - Stage 1: Scenario Generator
// Generates calibrated canonical archetypes verified for genuine outcome diversity & competition.

const { ConfigValidator } = require('../../core/contracts/scenario-schema');
const { LIFECYCLE_STATES } = require('../../core/contracts/lifecycle-schema');

const CANONICAL_ARCHETYPES = [
  {
    id: 'underdog_classic',
    seed: 40317,
    title: '⚡ 3 BALLS VS 12 BALLS: CAN THE UNDERDOG WIN? ⚡',
    hookText: 'Can 3 multiplying balls beat 12 balls? 😱',
    leftStart: 3,
    rightStart: 12,
    lType: 'multiply',
    lVal: 2,
    rType: 'add',
    rVal: 6,
    lHp: [8, 18, 38, 75, 140, 220],
    rHp: [24, 50, 95, 160, 240, 320],
    expectedWinner: 'MULTIPLY',
    narrativeRole: 'UNDERDOG_EXPONENTIAL_WIN'
  },
  {
    id: 'close_clash',
    seed: 303,
    title: '📈 PHOTO FINISH: MULTIPLY VS ADD NECK-AND-NECK 📈',
    hookText: 'Look at how close this finish is! 😱',
    leftStart: 4,
    rightStart: 14,
    lType: 'multiply',
    lVal: 2,
    rType: 'add',
    rVal: 8,
    lHp: [14, 28, 56, 110, 190, 260],
    rHp: [22, 44, 82, 140, 210, 275],
    expectedWinner: 'ADD',
    narrativeRole: 'PHOTO_FINISH_CLASH'
  },
  {
    id: 'lead_reversal',
    seed: 101,
    title: '💥 EARLY DEFICIT TO DRAMATIC FINAL TIER REVERSAL 💥',
    hookText: 'Watch the insane final tier comeback! 🤯',
    leftStart: 2,
    rightStart: 16,
    lType: 'multiply',
    lVal: 2,
    rType: 'add',
    rVal: 6,
    lHp: [6, 14, 32, 70, 150, 230],
    rHp: [26, 48, 85, 145, 230, 310],
    expectedWinner: 'MULTIPLY',
    narrativeRole: 'COMEBACK_REVERSAL'
  },
  {
    id: 'high_escalation',
    seed: 707,
    title: '🔥 HIGH MULTIPLIER: ×3 GAMBLE VS +14 TANK 🔥',
    hookText: 'Can high multipliers survive against the additive tank? 🤯',
    leftStart: 2,
    rightStart: 18,
    lType: 'multiply',
    lVal: 3,
    rType: 'add',
    rVal: 14,
    lHp: [12, 30, 75, 160, 300, 450],
    rHp: [28, 55, 100, 175, 270, 360],
    expectedWinner: 'ADD',
    narrativeRole: 'HEAVY_SWARM_ESCALATION'
  },
  {
    id: 'razor_upset',
    seed: 1100,
    title: '🏆 FINAL TIER SHOWDOWN: 0.07s UPSET VICTORY 🏆',
    hookText: 'Only 0.07 seconds apart at the finish! 😱',
    leftStart: 3,
    rightStart: 18,
    lType: 'multiply',
    lVal: 2,
    rType: 'add',
    rVal: 8,
    lHp: [8, 16, 35, 75, 145, 230],
    rHp: [28, 52, 90, 150, 230, 320],
    expectedWinner: 'MULTIPLY',
    narrativeRole: 'RAZOR_THIN_UPSET'
  }
];

function generateScenarios(count = 5, gameType = 'multi_race', targetDuration = 20.0, fps = 60) {
  const isFlagship = (gameType === 'multi_race' || gameType === 'multiplying-ball-race');
  if (!isFlagship) {
    console.warn(`[Orchestrator] Note: Game "${gameType}" is registered under GameAdapter contract, but only "multi_race" is currently certified for production.`);
  }

  const configs = [];
  for (let i = 0; i < count; i++) {
    const arch = CANONICAL_ARCHETYPES[i % CANONICAL_ARCHETYPES.length];
    const seed = arch.seed;

    const cfg = {
      id: `flagship_scenario_${String(i + 1).padStart(2, '0')}`,
      archetypeId: arch.id,
      gameType: gameType,
      seed,
      title: arch.title,
      subtitle: `Calibrated Flagship Showcase #${i + 1} · Seed ${seed}`,
      durationSeconds: targetDuration,
      fps: fps,
      maxSimulatedBalls: 200,
      hpTiers: arch.lHp,
      expectedWinner: arch.expectedWinner,
      narrativeRole: arch.narrativeRole,
      lanes: {
        left: {
          name: 'MULTIPLY',
          startBalls: arch.leftStart,
          stages: arch.lHp.map((hp, s) => ({
            type: arch.lType,
            value: arch.lVal,
            label: arch.lType === 'multiply' ? `×${arch.lVal}` : `+${arch.lVal}`,
            maxHP: hp
          }))
        },
        right: {
          name: 'ADD',
          startBalls: arch.rightStart,
          stages: arch.rHp.map((hp, s) => ({
            type: arch.rType,
            value: arch.rVal,
            label: arch.rType === 'multiply' ? `×${arch.rVal}` : `+${arch.rVal}`,
            maxHP: hp
          }))
        }
      },
      hookText: arch.hookText,
      tags: ['#shorts', '#physics', '#gaming', '#marblerun', '#satisfying'],
      lifecycleState: LIFECYCLE_STATES.GENERATED
    };

    ConfigValidator.validate(cfg);
    configs.push(cfg);
  }

  return configs;
}

module.exports = {
  CANONICAL_ARCHETYPES,
  generateScenarios
};
