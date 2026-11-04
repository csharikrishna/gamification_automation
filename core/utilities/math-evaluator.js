// Mathematical Equation Evaluation Engine for Viral Math Showdowns
// Evaluates functions f(n) vs g(n) for n = 1, 2, 3, 4, 5, 6... with exact values and tier multipliers.

class MathEvaluator {
  // Built-in viral math formula libraries
  static PRESETS = {
    'n!_vs_n^n': {
      title: '⚡ MATH SHOWDOWN: n! VS nⁿ ⚡',
      subtitle: 'Which function explodes faster into infinity?',
      left: {
        formulaName: 'f(n) = n!',
        shortName: 'FACTORIAL (n!)',
        type: 'factorial',
        eval: (n) => MathEvaluator.factorial(n),
        color: '#cb72ff',
        accentColor: '#f59aff',
        glowColor: 'rgba(203,114,255,0.45)'
      },
      right: {
        formulaName: 'g(n) = nⁿ',
        shortName: 'HYPER-POWER (nⁿ)',
        type: 'n_pow_n',
        eval: (n) => Math.pow(n, n),
        color: '#00f0ff',
        accentColor: '#8df9ff',
        glowColor: 'rgba(0,240,255,0.45)'
      },
      question: 'At n=1 they tie. By n=6, one of them reaches 46,656. Who wins?',
      inflectionStep: 2
    },
    '2^n_vs_n^3': {
      title: '⚡ THE PARADOX: 2ⁿ VS n³ ⚡',
      subtitle: 'n³ leads early... but where does 2ⁿ take over?',
      left: {
        formulaName: 'f(n) = 2ⁿ',
        shortName: 'EXPONENTIAL (2ⁿ)',
        type: '2_pow_n',
        eval: (n) => Math.pow(2, n),
        color: '#ff007f',
        accentColor: '#ff66b2',
        glowColor: 'rgba(255,0,127,0.45)'
      },
      right: {
        formulaName: 'g(n) = n³',
        shortName: 'CUBIC (n³)',
        type: 'n_cubed',
        eval: (n) => Math.pow(n, 3),
        color: '#ffd700',
        accentColor: '#fff176',
        glowColor: 'rgba(255,215,0,0.45)'
      },
      question: 'n³ dominates in the beginning... watch what happens at Stage 5!',
      inflectionStep: 5
    },
    'n!_vs_2^n': {
      title: '🔥 FACTORIAL VS EXPONENTIAL: n! VS 2ⁿ 🔥',
      subtitle: 'Linear multiplier vs constant double',
      left: {
        formulaName: 'f(n) = n!',
        shortName: 'FACTORIAL (n!)',
        type: 'factorial',
        eval: (n) => MathEvaluator.factorial(n),
        color: '#79ef43',
        accentColor: '#b2ff8a',
        glowColor: 'rgba(121,239,67,0.45)'
      },
      right: {
        formulaName: 'g(n) = 2ⁿ',
        shortName: 'EXPONENTIAL (2ⁿ)',
        type: '2_pow_n',
        eval: (n) => Math.pow(2, n),
        color: '#ff5500',
        accentColor: '#ff9955',
        glowColor: 'rgba(255,85,0,0.45)'
      },
      question: '2ⁿ starts ahead... at which step does n! overtake?',
      inflectionStep: 4
    },
    'fib_vs_2^(n/2)': {
      title: '🌿 FIBONACCI VS GOLDEN RATIO 🌿',
      subtitle: 'Nature’s spiral sequence vs 1.414ⁿ',
      left: {
        formulaName: 'f(n) = F(n)',
        shortName: 'FIBONACCI F(n)',
        type: 'fibonacci',
        eval: (n) => MathEvaluator.fibonacci(n),
        color: '#00e676',
        accentColor: '#b9f6ca',
        glowColor: 'rgba(0,230,118,0.45)'
      },
      right: {
        formulaName: 'g(n) = 2^(n/2)',
        shortName: 'POWER 2^(n/2)',
        type: 'custom',
        eval: (n) => Math.round(Math.pow(2, n / 2)),
        color: '#bb44ff',
        accentColor: '#dd88ff',
        glowColor: 'rgba(187,68,255,0.45)'
      },
      question: 'Does the golden ratio outpace square-root exponential growth?',
      inflectionStep: 3
    }
  };

  static factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) {
      r *= i;
      if (!Number.isSafeInteger(r)) {
        // MATH-06, MATH-07: Guard against overflow
        return r;
      }
    }
    return r;
  }

  // MATH-01: Correct 1-based Fibonacci: F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8
  static fibonacci(n) {
    if (n <= 0) return 0;
    if (n === 1 || n === 2) return 1;
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      const c = a + b;
      a = b;
      b = c;
    }
    return b;
  }

  // Safe expression evaluator for user-defined formulas without new Function() (MATH-02..MATH-09)
  static evalFormula(expr, n = 1) {
    if (typeof expr === 'function') return expr(n);
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') throw new Error('Expression must be a string or number');

    const src = String(expr).trim();
    if (src.length === 0) throw new Error('Empty mathematical expression');
    if (src.length > 250) throw new Error(`Mathematical expression exceeds maximum allowable length (250 chars): "${expr}"`);

    // Tokenize
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '+' || ch === '-' || ch === '/' || ch === '(' || ch === ')' || ch === '!' || ch === ',') {
        tokens.push(ch);
        i++;
      } else if (ch === '*') {
        if (src[i + 1] === '*') {
          tokens.push('^');
          i += 2;
        } else {
          tokens.push('*');
          i++;
        }
      } else if (ch === '^') {
        tokens.push('^');
        i++;
      } else if (/\d/.test(ch) || (ch === '.' && i + 1 < src.length && /\d/.test(src[i + 1]))) {
        let numStr = '';
        let dotCount = 0;
        while (i < src.length && (/[\d\.]/.test(src[i]))) {
          if (src[i] === '.') {
            dotCount++;
            if (dotCount > 1) throw new Error(`Invalid mathematical characters in formula: malformed number in "${expr}"`);
          }
          numStr += src[i];
          i++;
        }
        const parsedNum = parseFloat(numStr);
        if (isNaN(parsedNum)) throw new Error(`Invalid mathematical characters in formula: "${numStr}" in "${expr}"`);
        tokens.push(parsedNum);
      } else if (/[a-zA-Z]/.test(ch)) {
        let word = '';
        while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
          word += src[i];
          i++;
        }
        const lower = word.toLowerCase();
        if (lower === 'n') {
          tokens.push(n);
        } else if (lower === 'fib' || lower === 'fibonacci') {
          tokens.push('fib');
        } else if (lower === 'factorial') {
          tokens.push('factorial');
        } else {
          throw new Error(`Invalid mathematical characters in formula: unsupported identifier "${word}" in "${expr}"`);
        }
      } else {
        throw new Error(`Invalid mathematical characters in formula: "${ch}" in "${expr}"`);
      }
    }

    if (tokens.length === 0) throw new Error('Empty mathematical expression');
    if (tokens.length > 100) throw new Error(`Expression exceeds maximum complexity (100 tokens): "${expr}"`);

    // Recursive descent parser
    let pos = 0;
    let depth = 0;

    function peek() {
      return tokens[pos];
    }

    function consume(expected) {
      const t = tokens[pos];
      if (expected !== undefined && t !== expected) {
        throw new Error(`Invalid mathematical syntax: expected "${expected}" but found "${t}" in "${expr}"`);
      }
      pos++;
      return t;
    }

    function parseExpression() {
      depth++;
      if (depth > 25) throw new Error(`Expression exceeds maximum nesting depth in "${expr}"`);
      let result = parseTerm();
      while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
        const op = consume();
        const next = parseTerm();
        result = op === '+' ? result + next : result - next;
      }
      depth--;
      return result;
    }

    function parseTerm() {
      let result = parsePower();
      while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
        const op = consume();
        const next = parsePower();
        if (op === '*') {
          result = result * next;
        } else {
          if (Math.abs(next) < 1e-12) {
            throw new Error(`Division by zero in mathematical formula "${expr}" at n=${n}`);
          }
          result = result / next;
        }
      }
      return result;
    }

    function parsePower() {
      let result = parseUnary();
      if (pos < tokens.length && tokens[pos] === '^') {
        consume('^');
        const exp = parsePower(); // right-associative
        result = Math.pow(result, exp);
      }
      return result;
    }

    function parseUnary() {
      if (pos < tokens.length && tokens[pos] === '+') {
        consume('+');
        return parseUnary();
      }
      if (pos < tokens.length && tokens[pos] === '-') {
        consume('-');
        return -parseUnary();
      }
      return parsePostfix();
    }

    function parsePostfix() {
      let val = parseFactor();
      while (pos < tokens.length && tokens[pos] === '!') {
        consume('!');
        val = MathEvaluator.factorial(Math.round(val));
      }
      return val;
    }

    function parseFactor() {
      if (pos >= tokens.length) throw new Error(`Unexpected end of expression in "${expr}"`);
      const token = peek();

      if (typeof token === 'number') {
        consume();
        return token;
      }

      if (token === '(') {
        consume('(');
        const val = parseExpression();
        consume(')');
        return val;
      }

      if (token === 'fib' || token === 'factorial') {
        const fnName = consume();
        consume('(');
        const arg = parseExpression();
        consume(')');
        if (fnName === 'fib') return MathEvaluator.fibonacci(Math.round(arg));
        if (fnName === 'factorial') return MathEvaluator.factorial(Math.round(arg));
      }

      throw new Error(`Unexpected token "${token}" in formula "${expr}"`);
    }

    const value = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected extra tokens "${tokens.slice(pos).join(' ')}" in formula "${expr}"`);
    }

    if (isNaN(value)) {
      throw new Error(`Formula "${expr}" at n=${n} evaluated to NaN`);
    }
    if (!isFinite(value)) {
      return value > 0 ? Number.MAX_SAFE_INTEGER : -Number.MAX_SAFE_INTEGER;
    }
    return value;
  }

  // Compile a math matchup into simulator tier configurations
  static generateEquationConfig(presetKey = 'n!_vs_n^n', numStages = 6) {
    const preset = this.PRESETS[presetKey] || this.PRESETS['n!_vs_n^n'];

    const leftStages = [];
    const rightStages = [];

    let prevLeftVal = preset.left.eval(1);
    let prevRightVal = preset.right.eval(1);

    for (let n = 2; n <= numStages + 1; n++) {
      const currLeftVal = preset.left.eval(n);
      const currRightVal = preset.right.eval(n);

      const leftMult = currLeftVal / Math.max(1, prevLeftVal);
      const rightMult = currRightVal / Math.max(1, prevRightVal);

      let leftLabel = `n=${n} [×${Number.isInteger(leftMult) ? leftMult : leftMult.toFixed(1)}]`;
      let rightLabel = `n=${n} [×${Number.isInteger(rightMult) ? rightMult : rightMult.toFixed(1)}]`;

      if (preset.left.type === 'factorial') leftLabel = `${n}! = ${currLeftVal.toLocaleString()}`;
      else if (preset.left.type === '2_pow_n') leftLabel = `2^${n} = ${currLeftVal.toLocaleString()}`;

      if (preset.right.type === 'n_pow_n') rightLabel = `${n}^${n} = ${currRightVal.toLocaleString()}`;
      else if (preset.right.type === 'n_cubed') rightLabel = `${n}^3 = ${currRightVal.toLocaleString()}`;
      else if (preset.right.type === '2_pow_n') rightLabel = `2^${n} = ${currRightVal.toLocaleString()}`;

      leftStages.push({
        stageNum: n,
        type: 'multiply',
        value: Math.max(1, Math.round(leftMult)),
        exactValue: currLeftVal,
        label: leftLabel
      });

      rightStages.push({
        stageNum: n,
        type: 'multiply',
        value: Math.max(1, Math.round(rightMult)),
        exactValue: currRightVal,
        label: rightLabel
      });

      prevLeftVal = currLeftVal;
      prevRightVal = currRightVal;
    }

    return {
      id: `math_showdown_${presetKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
      gameType: 'multi_race',
      isMathShowdown: true,
      title: preset.title,
      subtitle: preset.subtitle,
      durationSeconds: 16,
      fps: 60,
      hpTiers: [3, 10, 28, 75, 180, 360],
      inflectionStep: preset.inflectionStep,
      lanes: {
        left: {
          name: preset.left.shortName,
          formulaName: preset.left.formulaName,
          ruleLabel: preset.left.formulaName,
          subtitle: `starts with ${preset.left.eval(1)} ball`,
          color: preset.left.color,
          accentColor: preset.left.accentColor,
          glowColor: preset.left.glowColor,
          startBalls: preset.left.eval(1),
          stages: leftStages
        },
        right: {
          name: preset.right.shortName,
          formulaName: preset.right.formulaName,
          ruleLabel: preset.right.formulaName,
          subtitle: `starts with ${preset.right.eval(1)} ball`,
          color: preset.right.color,
          accentColor: preset.right.accentColor,
          glowColor: preset.right.glowColor,
          startBalls: preset.right.eval(1),
          stages: rightStages
        }
      },
      metadata: {
        youtubeTitle: `${preset.title} 😱 Which Function Wins? #shorts #math`,
        description: `${preset.title}\n\n${preset.question}\n\nComment your prediction before stage n=4!\n\n#math #physics #simulation #calculus #oddlysatisfying #shorts`,
        pinnedComment: `🧠 Math Challenge: ${preset.question} Drop your proof below!`,
        tags: ['math showdown', 'factorial', 'exponential growth', 'physics simulation', 'math puzzle', 'youtube shorts']
      }
    };
  }

  // Compile arbitrary custom user equations f(n) vs g(n)
  static generateCustomConfig(leftExpr = 'n!', rightExpr = 'n^n', numStages = 6) {
    const leftStart = MathEvaluator.evalFormula(leftExpr, 1);
    const rightStart = MathEvaluator.evalFormula(rightExpr, 1);

    const leftStages = [];
    const rightStages = [];

    let prevLeftVal = leftStart;
    let prevRightVal = rightStart;

    for (let n = 2; n <= numStages + 1; n++) {
      const currLeftVal = MathEvaluator.evalFormula(leftExpr, n);
      const currRightVal = MathEvaluator.evalFormula(rightExpr, n);

      const leftMult = currLeftVal / Math.max(1, prevLeftVal);
      const rightMult = currRightVal / Math.max(1, prevRightVal);

      leftStages.push({
        stageNum: n,
        type: 'multiply',
        value: Math.max(1, Math.round(leftMult)),
        exactValue: currLeftVal,
        label: `${leftExpr} [n=${n}] = ${currLeftVal.toLocaleString()}`
      });

      rightStages.push({
        stageNum: n,
        type: 'multiply',
        value: Math.max(1, Math.round(rightMult)),
        exactValue: currRightVal,
        label: `${rightExpr} [n=${n}] = ${currRightVal.toLocaleString()}`
      });

      prevLeftVal = currLeftVal;
      prevRightVal = currRightVal;
    }

    return {
      id: `math_custom_${Date.now()}`,
      gameType: 'multi_race',
      isMathShowdown: true,
      title: `⚡ MATH SHOWDOWN: ${leftExpr} VS ${rightExpr} ⚡`,
      subtitle: `Formula Battle: f(n)=${leftExpr} vs g(n)=${rightExpr}`,
      durationSeconds: 16,
      fps: 60,
      hpTiers: [3, 10, 28, 75, 180, 360],
      lanes: {
        left: {
          name: `f(n) = ${leftExpr}`,
          formulaName: `f(n) = ${leftExpr}`,
          ruleLabel: `f(n) = ${leftExpr}`,
          subtitle: `starts with ${leftStart} ball`,
          color: '#cb72ff',
          accentColor: '#f59aff',
          glowColor: 'rgba(203,114,255,0.45)',
          startBalls: Math.min(leftStart, 12),
          stages: leftStages
        },
        right: {
          name: `g(n) = ${rightExpr}`,
          formulaName: `g(n) = ${rightExpr}`,
          ruleLabel: `g(n) = ${rightExpr}`,
          subtitle: `starts with ${rightStart} ball`,
          color: '#00f0ff',
          accentColor: '#8df9ff',
          glowColor: 'rgba(0,240,255,0.45)',
          startBalls: Math.min(rightStart, 12),
          stages: rightStages
        }
      },
      metadata: {
        youtubeTitle: `⚡ ${leftExpr} VS ${rightExpr} ⚡ Formula Explosion Race #shorts`,
        description: `Can ${leftExpr} beat ${rightExpr}? Watch the numbers grow and break each barrier! #math #physics #simulation #oddlysatisfying #shorts`,
        pinnedComment: `Which formula is your favorite? Comment below!`,
        tags: ['math showdown', 'physics simulation', 'math race', 'oddly satisfying', 'youtube shorts']
      }
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MathEvaluator };
} else if (typeof window !== 'undefined') {
  window.MathEvaluator = MathEvaluator;
}
