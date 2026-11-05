// AI Director Model for Automated Game & Physics Formulation
// Guides, devises, and configures new daily physics environments, viral hooks, and YouTube Shorts packages.

var _https = null;
var _MathEvaluator = typeof MathEvaluator !== 'undefined' ? MathEvaluator : null;
var _ConfigValidator = typeof ConfigValidator !== 'undefined' ? ConfigValidator : null;

if (typeof require !== 'undefined') {
  try { _https = require('https'); } catch (e) {}
  try {
    if (!_MathEvaluator) _MathEvaluator = require('../utilities/math-evaluator').MathEvaluator;
  } catch (e) {
    try { _MathEvaluator = require('../../src/math_evaluator').MathEvaluator; } catch (e2) {}
  }
  try {
    if (!_ConfigValidator) _ConfigValidator = require('../contracts/scenario-schema').ConfigValidator;
  } catch (e) {
    try { _ConfigValidator = require('../../src/config_validator').ConfigValidator; } catch (e2) {}
  }
}

class AIDirector {
  constructor(options = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : null);
    this.model = options.model || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_MODEL : null) || 'gemini-1.5-flash';
  }

  // Formulate a brand new daily simulation
  async formulateDailyGame(dayOffset = 0) {
    const today = new Date();
    today.setDate(today.getDate() + dayOffset);
    // AI-11: Format using local calendar date instead of UTC ISO conversion
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // If Gemini API Key is available, prompt the LLM
    if (this.apiKey && _https) {
      try {
        const aiPrompt = `You are an expert viral YouTube Shorts and game designer specializing in physics simulations and math showdowns (e.g. n! vs n^n, 2^n vs n^3, plinko, battle royale).
Design a viral 15-second simulation for ${dateStr}.
Return ONLY valid JSON matching this schema:
{
  "gameType": "math_showdown" | "mega_plinko" | "sumo_arena" | "brick_breaker" | "marble_run" | "multi_race",
  "mathPreset": "n!_vs_n^n" | "2^n_vs_n^3" | "n!_vs_2^n" | "fib_vs_2^(n/2)",
  "title": "⚡ HOOK IN ALL CAPS WITH EMOJIS ⚡",
  "subtitle": "Clear stakes or challenge",
  "durationSeconds": 15,
  "metadata": {
    "youtubeTitle": "Viral Title with Emojis #shorts",
    "description": "Engaging description with #tags",
    "pinnedComment": "Question to viewer",
    "tags": ["tag1", "tag2"]
  }
}`;
        const llmResult = await this.callGemini(aiPrompt);
        if (llmResult && llmResult.gameType) {
          if (llmResult.gameType === 'math_showdown' && _MathEvaluator) {
            const mathConfig = _MathEvaluator.generateEquationConfig(llmResult.mathPreset || 'n!_vs_n^n');
            mathConfig.date = dateStr;
            if (llmResult.title) mathConfig.title = llmResult.title;
            return mathConfig;
          }
          llmResult.date = dateStr;
          const enriched = this.enrichConfig(llmResult);
          // AI-06: Strict schema validation on LLM output
          if (_ConfigValidator && enriched.gameType === 'multi_race') {
            _ConfigValidator.validate(enriched);
          }
          return enriched;
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to Autonomous Creative Engine:', err.message);
      }
    }

    // AI-12: Autonomous Creative Engine called without double dayOffset
    return this.formulateAutonomousGame(dateStr);
  }

  formulateAutonomousGame(dateStr) {
    const GAME_TYPES = ['math_showdown', 'mega_plinko', 'sumo_arena', 'brick_breaker', 'marble_run', 'multi_race'];
    // AI-12: Single offset calculation derived directly from dateStr
    const dayNum = Math.floor(new Date(dateStr).getTime() / (1000 * 60 * 60 * 24));
    const gameType = GAME_TYPES[Math.abs(dayNum) % GAME_TYPES.length];

    if (gameType === 'math_showdown' && _MathEvaluator) {
      const presets = ['n!_vs_n^n', '2^n_vs_n^3', 'n!_vs_2^n', 'fib_vs_2^(n/2)'];
      const key = presets[Math.abs(dayNum) % presets.length];
      const config = _MathEvaluator.generateEquationConfig(key);
      config.date = dateStr;
      return config;
    } else if (gameType === 'marble_run') {
      const themes = [
        { title: '🌀 EPIC RUBE GOLDBERG MARBLE MACHINE 🌀', sub: 'Can your marble survive the seesaws and rotary wheels?' },
        { title: '⚡ 4,000PX EXTREME MARBLE DESCENT ⚡', sub: 'The ultimate mechanical track race · Pick your racer!' },
        { title: '🏆 6 MARBLE CHAMPIONSHIP: FINAL SPRINT 🏆', sub: 'Switchback ramps into rotating paddle wheel!' }
      ];
      const pick = themes[Math.abs(dayNum) % themes.length];
      return {
        id: `marble_run_${dateStr}`,
        date: dateStr,
        gameType: 'marble_run',
        title: pick.title,
        subtitle: pick.sub,
        durationSeconds: 16,
        fps: 60,
        marbleCount: 6,
        metadata: {
          youtubeTitle: `${pick.title} 😱 Who Wins? #shorts #marblerun`,
          description: `${pick.sub}\n\nPick your color marble before it reaches the paddle wheel! Did your racer win?\n\n#physics #marblerun #oddlysatisfying #shorts`,
          pinnedComment: 'Which marble did you pick: Cyan, Gold, Rose, Viper, Violet, or Magma? 👇',
          tags: ['marble run', 'rube goldberg', 'physics simulation', 'shorts', 'satisfying']
        }
      };
    } else if (gameType === 'mega_plinko') {
      const ballCounts = [160, 200, 240, 280];
      const count = ballCounts[Math.abs(dayNum) % ballCounts.length];
      return {
        id: `plinko_${dateStr}`,
        date: dateStr,
        gameType: 'mega_plinko',
        title: '🎰 1,000× IMPOSSIBLE PLINKO JACKPOT 🎰',
        subtitle: `Dropping ${count} balls · Can anyone hit the golden 1,000× slot?`,
        durationSeconds: 16,
        fps: 60,
        ballCount: count,
        rows: 14,
        metadata: {
          youtubeTitle: `1,000× Plinko Jackpot Drop! 😱 Dropping ${count} Balls! #shorts #plinko`,
          description: `Dropping ${count} glowing physics balls down the mega peg pyramid! Will we hit the 1,000× jackpot?\n\n#physics #satisfying #oddlysatisfying #shorts #plinko`,
          pinnedComment: 'Comment "JACKPOT" if you think a ball hits the 1,000× slot! 🎰',
          tags: ['plinko', 'physics simulation', 'marble run', 'jackpot', 'shorts']
        }
      };
    } else if (gameType === 'sumo_arena') {
      return {
        id: `sumo_${dateStr}`,
        date: dateStr,
        gameType: 'sumo_arena',
        title: '👑 32 MARBLE BATTLE ROYALE · 1 WINNER 👑',
        subtitle: 'Shrinking neon death ring · Last marble standing takes the crown!',
        durationSeconds: 16,
        fps: 60,
        competitorCount: 32,
        metadata: {
          youtubeTitle: '32 Marble Battle Royale! 🤯 Who Takes The Crown? #shorts #gaming',
          description: '32 competitors enter the shrinking arena, only ONE survives! Tell me who you picked before second 3!\n\n#battle #marblerace #shorts #gaming #physics',
          pinnedComment: 'Who was your pick? Tell me at 0:03! 👑',
          tags: ['marble race', 'battle royale', 'sumo arena', 'gaming', 'shorts']
        }
      };
    } else if (gameType === 'brick_breaker') {
      return {
        id: `brick_${dateStr}`,
        date: dateStr,
        gameType: 'brick_breaker',
        title: '💥 260 BALLS VS 1,200 HP NEON BRICKS 💥',
        subtitle: 'High-speed demolition swarm · Can they clear 100% of the board?',
        durationSeconds: 16,
        fps: 60,
        ballCount: 260,
        metadata: {
          youtubeTitle: '260 Physics Balls vs 1,200 HP Bricks! 🤯 #shorts #satisfying #asmr',
          description: 'Hundreds of glowing physics balls vs tough neon bricks! Will the board reach 100% clearance?\n\n#asmr #satisfying #shorts #physics #breakout',
          pinnedComment: 'Did they clear 100% of the bricks? Comment YES or NO! 👇',
          tags: ['brick breaker', 'oddly satisfying', 'physics swarm', 'asmr', 'shorts']
        }
      };
    } else {
      // Default: Multiplier Race
      const archetypes = [
        { title: '⚡ UNDERDOG: 1 BALL VS 12 BALLS ⚡', leftStart: 1, rightStart: 12, leftVal: 3, rightVal: 2, lType: 'multiply', rType: 'add' },
        { title: '🔥 50,000 MARBLE AVALANCHE: ×4 VS ×3 🔥', leftStart: 2, rightStart: 8, leftVal: 4, rightVal: 3, lType: 'multiply', rType: 'multiply' },
        { title: '📈 EXPONENTIAL ×2 VS LINEAR +20 📈', leftStart: 4, rightStart: 24, leftVal: 2, rightVal: 20, lType: 'multiply', rType: 'add' }
      ];
      const arch = archetypes[Math.abs(dayNum) % archetypes.length];

      return {
        id: `race_${dateStr}`,
        date: dateStr,
        gameType: 'multi_race',
        title: arch.title,
        subtitle: `Can ${arch.lType === 'multiply' ? '×' + arch.leftVal : '+' + arch.leftVal} beat ${arch.rType === 'multiply' ? '×' + arch.rightVal : '+' + arch.rightVal}?`,
        durationSeconds: 15,
        fps: 60,
        lanes: {
          left: {
            name: arch.lType === 'multiply' ? 'MULTIPLY' : 'SAFE ADD',
            ruleLabel: `${arch.lType === 'multiply' ? '×' : '+'}${arch.leftVal} BALLS`,
            subtitle: `starts with ${arch.leftStart} ball${arch.leftStart > 1 ? 's' : ''}`,
            color: '#cb72ff',
            glowColor: 'rgba(203,114,255,0.45)',
            accentColor: '#f094ff',
            startBalls: arch.leftStart,
            stages: Array(6).fill(0).map(() => ({ type: arch.lType, value: arch.leftVal, label: `${arch.lType === 'multiply' ? '×' : '+'}${arch.leftVal}`, pegRows: 2, pegsPerRow: 5 }))
          },
          right: {
            name: arch.rType === 'multiply' ? 'EXPONENT' : 'STEADY ADD',
            ruleLabel: `${arch.rType === 'multiply' ? '×' : '+'}${arch.rightVal} BALLS`,
            subtitle: `starts with ${arch.rightStart} balls`,
            color: '#79ef43',
            glowColor: 'rgba(121,239,67,0.45)',
            accentColor: '#b2ff8a',
            startBalls: arch.rightStart,
            stages: Array(6).fill(0).map(() => ({ type: arch.rType, value: arch.rightVal, label: `${arch.rType === 'multiply' ? '×' : '+'}${arch.rightVal}`, pegRows: 2, pegsPerRow: 5 }))
          }
        },
        metadata: {
          youtubeTitle: `Can ${arch.leftStart} Ball Beat ${arch.rightStart} Balls?! 😱 #shorts #physics`,
          description: `${arch.title}\n\nDrop your winner prediction in the comments before second 8!\n\n#physics #satisfying #shorts #marblerun #oddlysatisfying`,
          pinnedComment: 'Who did you pick: Purple or Green? 🏁',
          tags: ['physics simulation', 'marble run', 'oddly satisfying', 'youtube shorts', 'ball race']
        }
      };
    }
  }

  enrichConfig(llmOutput) {
    const base = this.formulateAutonomousGame(llmOutput.date);
    return {
      ...base,
      ...llmOutput,
      metadata: {
        ...base.metadata,
        ...(llmOutput.metadata || {})
      }
    };
  }

  // LLM API communication via Gemini Flash endpoint
  async callGemini(prompt) {
    return new Promise((resolve, reject) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.7
        }
      });

      const parsedUrl = new URL(url);
      const req = _https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) resolve(JSON.parse(text));
            else resolve(null);
          } catch (e) {
            reject(new Error(`Failed to parse Gemini response: ${e.message}`));
          }
        });
      });

      req.setTimeout(12000, () => {
        req.destroy(new Error('Gemini API request timed out after 12 seconds'));
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

if (typeof window !== 'undefined') {
  window.AIDirector = AIDirector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIDirector };
}
