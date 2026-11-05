// Core Scenario Configuration Schema Validator
// Enforces structural integrity and parameter boundaries for simulation configs.

class ConfigValidator {
  static VALID_OPERATIONS = ['multiply', 'add', 'subtract', 'divide', 'fibonacci', 'factorial', 'power'];

  static validate(config) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
      throw new Error('Config must be a valid JSON object');
    }

    if (!config.id) {
      config.id = 'simulation';
      warnings.push('Missing config.id; defaulting to "simulation"');
    } else if (typeof config.id !== 'string') {
      errors.push('Config validation failed: "id" must be a string identifier.');
    }

    const duration = config.durationSeconds ?? 16;
    if (typeof duration !== 'number' || duration <= 0) {
      errors.push(`Invalid durationSeconds: ${duration}. Must be positive number.`);
    }

    if (config.fps !== undefined && (typeof config.fps !== 'number' || config.fps <= 0)) {
      errors.push(`Invalid fps: ${config.fps}. Must be positive number.`);
    }

    const gameType = config.gameType || config.type || 'multi_race';
    const supportedTypes = ['multi_race', 'mega_plinko', 'sumo_arena', 'brick_breaker', 'marble_run'];
    if (!supportedTypes.includes(gameType)) {
      errors.push(`Unsupported gameType "${gameType}". Supported: ${supportedTypes.join(', ')}.`);
    }

    if (gameType === 'multi_race') {
      this._validateMultiRace(config, errors, warnings);
    }

    if (errors.length > 0) {
      const err = new Error(`Configuration Validation Failed:\n- ${errors.join('\n- ')}`);
      err.errors = errors;
      err.warnings = warnings;
      throw err;
    }

    return {
      valid: true,
      warnings
    };
  }

  static _validateMultiRace(config, errors, warnings) {
    if (!config.lanes || typeof config.lanes !== 'object') {
      errors.push('Missing config.lanes object');
      return;
    }

    for (const side of ['left', 'right']) {
      const lane = config.lanes[side];
      if (!lane) {
        errors.push(`Missing lane configuration for side: ${side}`);
        continue;
      }

      const startBalls = lane.startBalls ?? (side === 'left' ? 1 : 12);
      if (typeof startBalls !== 'number' || startBalls <= 0) {
        errors.push(`Invalid startBalls (${startBalls}) for lane ${side}. Must be positive integer.`);
      }

      if (lane.stages && Array.isArray(lane.stages)) {
        for (let i = 0; i < lane.stages.length; i++) {
          const stage = lane.stages[i];
          const op = stage.type || 'multiply';
          if (!this.VALID_OPERATIONS.includes(op)) {
            errors.push(`Lane ${side} stage ${i} has unsupported operation: "${op}". Valid: ${this.VALID_OPERATIONS.join(', ')}`);
          }
          if (stage.value !== undefined && (typeof stage.value !== 'number' || isNaN(stage.value))) {
            errors.push(`Lane ${side} stage ${i} has invalid numeric value: ${stage.value}`);
          }
        }
      }
    }

    if (config.hpTiers) {
      if (!Array.isArray(config.hpTiers)) {
        errors.push('config.hpTiers must be an array of positive numbers');
      } else {
        config.hpTiers.forEach((hp, idx) => {
          if (typeof hp !== 'number' || hp <= 0 || isNaN(hp)) {
            errors.push(`Invalid hpTier at index ${idx}: ${hp}. Must be positive number.`);
          }
        });
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.ConfigValidator = ConfigValidator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigValidator };
}
