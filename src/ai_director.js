// AI Director Model for Automated Game & Physics Formulation
// Guides, devises, and configures new daily physics environments, viral hooks, and YouTube Shorts packages.

var _https = null;
var _MathEvaluator = typeof MathEvaluator !== 'undefined' ? MathEvaluator : null;
var _ConfigValidator = typeof ConfigValidator !== 'undefined' ? ConfigValidator : null;

if (typeof require !== 'undefined') {
  try { _https = require('https'); } catch (e) {}
  try { if (!_MathEvaluator) _MathEvaluator = require('./math_evaluator').MathEvaluator; } catch (e) {}
  try { if (!_ConfigValidator) _ConfigValidator = require('./config_validator').ConfigValidator; } catch (e) {}
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
          youtubeTitle: `${pick.title} 😱 #shorts #marblerun #physics`,
          description: `${pick.title}\n\n6 marbles enter the multi-tier Rube Goldberg track! Who takes 1st place?\n\n#physics #marblerun #oddlysatisfying #gaming #shorts`,
          pinnedComment: '🏎️ Which color are you rooting for: Cyan, Gold, Rose, or Viper? Comment below!',
          tags: ['marble run', 'rube goldberg', 'physics simulation', 'oddly satisfying', 'youtube shorts']
        }
      };
    } else if (gameType === 'mega_plinko') {
      const themes = [
        { title: '🎰 THE 1,000× IMPOSSIBLE PLINKO JACKPOT 🎰', sub: 'Dropping 250 balls · Can anyone hit the golden 1,000× slot?' },
        { title: '🔥 500 MARBLE AVALANCHE PLINKO 🔥', sub: 'Total payout counter challenge · Watch the screen explode!' },
        { title: '⚡ HIGH-STAKES PLINKO: 1000× OR BUST ⚡', sub: 'The ultimate physics drop · Drop your prediction below!' }
      ];
      const pick = themes[Math.abs(dayNum) % themes.length];
      return {
        id: `plinko_${dateStr}`,
        date: dateStr,
        gameType: 'mega_plinko',
        title: pick.title,
        subtitle: pick.sub,
        durationSeconds: 16,
        fps: 60,
        ballCount: 220 + (dayNum % 80),
        rows: 14,
        metadata: {
          youtubeTitle: `${pick.title} 😱 #shorts #satisfying #plinko`,
          description: `${pick.title}\n\n${pick.sub}\n\nDrop your guess in the comments before the final ball drops!\n\n#physics #satisfying #oddlysatisfying #marblerun #plinko #shorts`,
          pinnedComment: '🎯 Which multiplier bin are you betting on: 1,000×, 100×, or 25×? Drop it now!',
          tags: ['plinko', 'physics simulation', 'marble run', 'jackpot', 'oddly satisfying', 'youtube shorts', 'satisfying']
        }
      };
    } else if (gameType === 'sumo_arena') {
      const themes = [
        { title: '👑 32 MARBLE BATTLE ROYALE · 1 SURVIVOR 👑', sub: 'Shrinking neon death ring · Last marble standing takes the crown!' },
        { title: '⚔️ CLAN WAR: 32 MARBLES KNOCKOUT ARENA ⚔️', sub: 'Titan Gold vs Cyber Cyan vs Neon Magenta · Who survives?' },
        { title: '💥 50 MARBLE SUMO ARENA: MASS KNOCKOUT 💥', sub: 'Elastic collision chaos · Pick your favorite color!' }
      ];
      const pick = themes[Math.abs(dayNum) % themes.length];
      return {
        id: `sumo_${dateStr}`,
        date: dateStr,
        gameType: 'sumo_arena',
        title: pick.title,
        subtitle: pick.sub,
        durationSeconds: 16,
        fps: 60,
        competitorCount: 32,
        initialRadius: 430,
        metadata: {
          youtubeTitle: `${pick.title} 🤯 #shorts #gaming #marblerace`,
          description: `${pick.title}\n\n32 competitors enter, only ONE survives the shrinking ring! Who did you pick?\n\n#battle #marblerace #physics #oddlysatisfying #gaming #shorts`,
          pinnedComment: '🔥 Pick your color before second 3: Gold, Cyan, Magenta, or Lime? Tell me who you got!',
          tags: ['marble race', 'battle royale', 'sumo arena', 'physics', 'satisfying', 'youtube shorts']
        }
      };
    } else if (gameType === 'brick_breaker') {
      const themes = [
        { title: '💥 300 BALLS VS 1,200 HP NEON BRICKS 💥', sub: 'High-speed demolition swarm · Can they clear 100% of the board?' },
        { title: '💎 ASMR BRICK DEMOLITION: 100% CLEAR? 💎', sub: 'Extreme ricochet rally · Watch the bricks shatter!' },
        { title: '🚀 500 LASER MARBLES VS TITAN BRICK WALL 🚀', sub: 'Satisfying clearing mechanics · Relaxing ASMR physics!' }
      ];
      const pick = themes[Math.abs(dayNum) % themes.length];
      return {
        id: `brick_${dateStr}`,
        date: dateStr,
        gameType: 'brick_breaker',
        title: pick.title,
        subtitle: pick.sub,
        durationSeconds: 16,
        fps: 60,
        ballCount: 260 + (dayNum % 60),
        metadata: {
          youtubeTitle: `${pick.title} 🤯 #shorts #satisfying #asmr`,
          description: `${pick.title}\n\nHundreds of glowing physics balls vs tough neon bricks! Will the board reach 100% clearance?\n\n#asmr #satisfying #physics #brickbreaker #oddlysatisfying #shorts`,
          pinnedComment: '⚡ Do you think the swarm clears 100% or fails? Guess the final % before the end!',
          tags: ['brick breaker', 'oddly satisfying', 'physics swarm', 'asmr', 'youtube shorts', 'demolition']
        }
      };
    } else {
      const matchups = [
        { leftStart: 1, leftMult: 3, rightStart: 12, rightAdd: 2, title: '⚡ UNDERDOG: 1 BALL (×3) VS 12 BALLS (+2) ⚡' },
        { leftStart: 2, leftMult: 4, rightStart: 100, rightAdd: 20, title: '💰 POOR VS RICH: 2 BALLS (×4) VS 100 BALLS 💰' },
        { leftStart: 5, leftMult: 3, rightStart: 35, rightAdd: 10, title: '🚀 EXPONENTIAL SURGE: CAN MULTIPLY WIN? 🚀' }
      ];
      const m = matchups[Math.abs(dayNum) % matchups.length];
      return {
        id: `race_${dateStr}`,
        date: dateStr,
        gameType: 'multi_race',
        title: m.title,
        subtitle: 'Can exponential math beat an initial headstart?',
        durationSeconds: 15,
        fps: 60,
        resolution: { width: 1080, height: 1920 },
        lanes: {
          left: {
            name: 'MULTIPLY',
            ruleLabel: `×${m.leftMult} BALLS`,
            subtitle: `starts with ${m.leftStart} ball`,
            color: '#cb72ff',
            glowColor: 'rgba(203,114,255,0.45)',
            accentColor: '#f59aff',
            startBalls: m.leftStart,
            stages: Array(6).fill(0).map(() => ({ type: 'multiply', value: m.leftMult, label: `×${m.leftMult}` }))
          },
          right: {
            name: 'ADD',
            ruleLabel: `+${m.rightAdd} BALLS`,
            subtitle: `starts with ${m.rightStart} balls`,
            color: '#79ef43',
            glowColor: 'rgba(121,239,67,0.45)',
            accentColor: '#b2ff8a',
            startBalls: m.rightStart,
            stages: Array(6).fill(0).map(() => ({ type: 'add', value: m.rightAdd, label: `+${m.rightAdd}` }))
          }
        },
        metadata: {
          youtubeTitle: `${m.title} 😱 Multiplying Physics #shorts`,
          description: `${m.title}\n\nExponential multiplication vs linear addition! Who takes the crown?\n\n#physics #satisfying #math #oddlysatisfying #shorts`,
          pinnedComment: '🤔 Who did you bet on: MULTIPLY or ADD? Comment below!',
          tags: ['physics simulation', 'marble run', 'multiplying balls', 'oddly satisfying', 'youtube shorts']
        }
      };
    }
  }

  enrichConfig(config) {
    if (!config.resolution) config.resolution = { width: 1080, height: 1920 };
    if (!config.fps) config.fps = 60;
    if (!config.durationSeconds) config.durationSeconds = 16;
    return config;
  }

  async callGemini(promptText) {
    if (!_https) throw new Error('https module not available in this environment');
    return new Promise((resolve, reject) => {
      // AI-03: Configurable model name
      const model = this.model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const req = _https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
        // AI-05: Strict HTTP status code validation
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Gemini API HTTP Error ${res.statusCode}: ${res.statusMessage}`));
          res.resume();
          return;
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('Empty response from model');
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error(`Failed to parse Gemini model response: ${e.message}`));
          }
        });
      });

      // AI-04: Robust 12-second timeout handling
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
