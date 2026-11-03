// Procedural Scenario Generator for Mass Video Production
// Generates diverse mathematical matchups, obstacle patterns, neon color themes, and YouTube Shorts metadata.

const fs = require('fs');
const path = require('path');

const THEMES = [
  {
    name: 'Cyberpunk Neon',
    left: { theme: 'purple', color: '#cb72ff', glowColor: 'rgba(203,114,255,0.45)', accentColor: '#f59aff' },
    right: { theme: 'green', color: '#79ef43', glowColor: 'rgba(121,239,67,0.45)', accentColor: '#b2ff8a' }
  },
  {
    name: 'Ice & Fire',
    left: { theme: 'cyan', color: '#00f0ff', glowColor: 'rgba(0,240,255,0.45)', accentColor: '#8df9ff' },
    right: { theme: 'orange', color: '#ff5500', glowColor: 'rgba(255,85,0,0.45)', accentColor: '#ff9955' }
  },
  {
    name: 'Gold & Violet',
    left: { theme: 'gold', color: '#ffd700', glowColor: 'rgba(255,215,0,0.45)', accentColor: '#fff176' },
    right: { theme: 'violet', color: '#bb44ff', glowColor: 'rgba(187,68,255,0.45)', accentColor: '#dd88ff' }
  },
  {
    name: 'Electric Pink & Cobalt Blue',
    left: { theme: 'pink', color: '#ff007f', glowColor: 'rgba(255,0,127,0.45)', accentColor: '#ff66b2' },
    right: { theme: 'blue', color: '#00b4d8', glowColor: 'rgba(0,180,216,0.45)', accentColor: '#90e0ef' }
  }
];

const ARCHETYPES = [
  {
    id: 'underdog_extreme',
    title: '⚡ 1 BALL VS 100 BALLS: CAN MULTIPLY WIN? ⚡',
    subtitle: 'Underdog starts with 1 ball · Leader starts with 100',
    leftName: '×3 UNDERDOG',
    leftStart: 1,
    leftRules: [3, 3, 3, 3, 3, 3],
    leftType: 'multiply',
    rightName: '100 HEADSTART',
    rightStart: 100,
    rightRules: [5, 5, 5, 5, 5, 5],
    rightType: 'add',
    youtubeHook: 'Can 1 Ball Beat 100 Balls?! 😱 Never Underestimate Multiplication #shorts'
  },
  {
    id: 'exponential_vs_linear',
    title: '📈 EXPONENTIAL VS LINEAR: THE ULTIMATE TEST 📈',
    subtitle: '×2 Multiplication vs +20 Steady Addition',
    leftName: 'EXPONENTIAL',
    leftStart: 5,
    leftRules: [2, 2, 2, 2, 2, 2],
    leftType: 'multiply',
    rightName: 'LINEAR',
    rightStart: 25,
    rightRules: [20, 20, 20, 20, 20, 20],
    rightType: 'add',
    youtubeHook: 'Exponential Growth vs Linear: Insane Marble Race! 🤯 #physics #shorts'
  },
  {
    id: 'high_stakes_gamble',
    title: '⚠️ HIGH STAKES: ×5 GAMBLE VS SAFE +15 ⚠️',
    subtitle: 'One mistake could wipe out the lead!',
    leftName: 'HIGH ROLLER',
    leftStart: 10,
    leftRules: [
      { type: 'multiply', value: 5, label: '×5' },
      { type: 'subtract', value: 20, label: '-20' },
      { type: 'multiply', value: 4, label: '×4' },
      { type: 'subtract', value: 50, label: '-50' },
      { type: 'multiply', value: 5, label: '×5' }
    ],
    rightName: 'STEADY SAFE',
    rightStart: 15,
    rightRules: [
      { type: 'add', value: 20, label: '+20' },
      { type: 'add', value: 25, label: '+25' },
      { type: 'add', value: 30, label: '+30' },
      { type: 'add', value: 35, label: '+35' },
      { type: 'add', value: 40, label: '+40' }
    ],
    youtubeHook: 'Gamble vs Safe Strategy: Who Takes the Trophy?! 🏆 #satisfying #shorts'
  },
  {
    id: 'avalanche_super_race',
    title: '🔥 50,000 MARBLE AVALANCHE: ×4 VS ×3 🔥',
    subtitle: 'Watch the screen completely fill up with glowing balls!',
    leftName: '×4 SURGE',
    leftStart: 2,
    leftRules: [4, 4, 4, 4, 4],
    leftType: 'multiply',
    rightName: '×3 SURGE',
    rightStart: 12,
    rightRules: [3, 3, 3, 3, 3],
    rightType: 'multiply',
    youtubeHook: 'INSANE Ball Avalanche! Can the Engine Handle This?! 🤯 #gaming #marblerun #shorts'
  }
];

function generateScenarios(count = 10, outputDir = 'configs/generated') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const generated = [];

  for (let i = 0; i < count; i++) {
    const archetype = ARCHETYPES[i % ARCHETYPES.length];
    const theme = THEMES[i % THEMES.length];
    const id = `${archetype.id}_var${i + 1}`;

    const config = {
      id,
      title: archetype.title,
      subtitle: archetype.subtitle,
      durationSeconds: 15,
      fps: 60,
      resolution: { width: 1080, height: 1920 },
      physics: {
        gravity: 1180 + (i % 3) * 60,
        bounce: 0.68 + (i % 2) * 0.04,
        maxVisibleBalls: 350
      },
      lanes: {
        left: {
          name: archetype.leftName,
          ruleLabel: Array.isArray(archetype.leftRules) && typeof archetype.leftRules[0] === 'number'
            ? `${archetype.leftType === 'multiply' ? '×' : '+'}${archetype.leftRules[0]} BALLS`
            : 'SPECIAL RULES',
          subtitle: `starts with ${archetype.leftStart} ball${archetype.leftStart > 1 ? 's' : ''}`,
          ...theme.left,
          startBalls: archetype.leftStart,
          stages: archetype.leftRules.map((rule, idx) => {
            if (typeof rule === 'object') return { ...rule, pegRows: 2, pegsPerRow: 5 + (idx % 2) };
            return {
              type: archetype.leftType,
              value: rule,
              label: archetype.leftType === 'multiply' ? `×${rule}` : `+${rule}`,
              pegRows: 2,
              pegsPerRow: 5 + (idx % 2)
            };
          })
        },
        right: {
          name: archetype.rightName,
          ruleLabel: Array.isArray(archetype.rightRules) && typeof archetype.rightRules[0] === 'number'
            ? `${archetype.rightType === 'multiply' ? '×' : '+'}${archetype.rightRules[0]} BALLS`
            : 'SPECIAL RULES',
          subtitle: `starts with ${archetype.rightStart} ball${archetype.rightStart > 1 ? 's' : ''}`,
          ...theme.right,
          startBalls: archetype.rightStart,
          stages: archetype.rightRules.map((rule, idx) => {
            if (typeof rule === 'object') return { ...rule, pegRows: 2, pegsPerRow: 5 + (idx % 2) };
            return {
              type: archetype.rightType,
              value: rule,
              label: archetype.rightType === 'multiply' ? `×${rule}` : `+${rule}`,
              pegRows: 2,
              pegsPerRow: 5 + (idx % 2)
            };
          })
        }
      },
      metadata: {
        youtubeTitle: archetype.youtubeHook,
        description: `${archetype.title}\n\nCan the underdog win or does the starting lead take the crown? Drop your prediction before the finish line!\n\n#physics #satisfying #oddlysatisfying #simulation #shorts #marblerun #math`,
        tags: ['physics simulation', 'marble race', 'oddly satisfying', 'youtube shorts', 'satisfying video', 'ball multiply', 'math simulation']
      }
    };

    const filePath = path.join(outputDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    generated.push(filePath);
  }

  console.log(`✨ Generated ${generated.length} distinct scenario configurations in ${outputDir}!`);
  return generated;
}

if (require.main === module) {
  const count = parseInt(process.argv[2], 10) || 8;
  generateScenarios(count);
}

module.exports = { generateScenarios };
