// Configuration Validator for Simulation Environments
// Ensures all scenario properties, operations, and physics settings conform to schema.

class ConfigValidator {
  static VALID_OPERATIONS = ['multiply', 'add', 'subtract', 'divide'];

  static validate(config) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
      throw new Error('Config must be a valid JSON object');
    }

    // Basic properties
    if (!config.id) warnings.push('Missing config.id; defaulting to "simulation"');
    if (!config.gameType) warnings.push('Missing config.gameType; defaulting to "multi_race"');

    const duration = config.durationSeconds || 16;
    if (typeof duration !== 'number' || duration <= 0) {
      errors.push(`Invalid durationSeconds: ${duration}. Must be positive number.`);
    }

    const fps = config.fps || 60;
    if (typeof fps !== 'number' || fps <= 0) {
      errors.push(`Invalid fps: ${fps}. Must be positive number.`);
    }

    // Validate lanes
    if (!config.lanes || typeof config.lanes !== 'object') {
      errors.push('Missing config.lanes object');
    } else {
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
          lane.stages.forEach((stage, idx) => {
            const op = stage.type || 'multiply';
            if (!this.VALID_OPERATIONS.includes(op)) {
              errors.push(`Lane ${side} stage ${idx} has unsupported operation: "${op}". Valid: ${this.VALID_OPERATIONS.join(', ')}`);
            }
            if (stage.value !== undefined && (typeof stage.value !== 'number' || isNaN(stage.value))) {
              errors.push(`Lane ${side} stage ${idx} has invalid numeric value: ${stage.value}`);
            }
          });
        }
      }
    }

    // Validate hpTiers if provided
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigValidator };
} else if (typeof window !== 'undefined') {
  window.ConfigValidator = ConfigValidator;
}
