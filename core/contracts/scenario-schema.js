// Core Scenario Configuration Schema Validator
// Enforces structural integrity and parameter boundaries for simulation configs.

class ConfigValidator {
  static validate(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Config validation failed: Configuration must be a non-null object.');
    }

    if (!config.id) {
      config.id = 'simulation';
    } else if (typeof config.id !== 'string') {
      throw new Error('Config validation failed: "id" must be a string identifier.');
    }

    if (typeof config.durationSeconds !== 'number' || config.durationSeconds <= 0) {
      throw new Error(`Config validation failed: "durationSeconds" must be a positive number (got ${config.durationSeconds}).`);
    }

    if (config.fps !== undefined && (typeof config.fps !== 'number' || config.fps <= 0)) {
      throw new Error(`Config validation failed: "fps" must be a positive number (got ${config.fps}).`);
    }

    const gameType = config.gameType || config.type || 'multi_race';
    const supportedTypes = ['multi_race', 'mega_plinko', 'sumo_arena', 'brick_breaker', 'marble_run'];
    if (!supportedTypes.includes(gameType)) {
      throw new Error(`Config validation failed: Unsupported gameType "${gameType}". Supported: ${supportedTypes.join(', ')}.`);
    }

    if (gameType === 'multi_race') {
      this._validateMultiRace(config);
    }

    return true;
  }

  static _validateMultiRace(config) {
    if (!config.lanes || typeof config.lanes !== 'object') {
      throw new Error('Config validation failed: "lanes" object is required for multi_race.');
    }

    for (const side of ['left', 'right']) {
      const lane = config.lanes[side];
      if (!lane) {
        throw new Error(`Config validation failed: Missing "${side}" lane configuration.`);
      }

      if (lane.startBalls !== undefined && (typeof lane.startBalls !== 'number' || lane.startBalls < 0)) {
        throw new Error(`Config validation failed: "${side}.startBalls" must be a non-negative number.`);
      }

      if (lane.stages && Array.isArray(lane.stages)) {
        for (let i = 0; i < lane.stages.length; i++) {
          const stage = lane.stages[i];
          const validTypes = ['multiply', 'add', 'subtract', 'divide', 'fibonacci', 'factorial', 'power'];
          if (stage.type && !validTypes.includes(stage.type)) {
            throw new Error(`Config validation failed: "${side}" stage ${i} has invalid type "${stage.type}". Valid: ${validTypes.join(', ')}.`);
          }
          if (stage.value !== undefined && typeof stage.value !== 'number') {
            throw new Error(`Config validation failed: "${side}" stage ${i} "value" must be a number.`);
          }
        }
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
