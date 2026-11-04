// Multiplying Ball Race - Audio Events Definition
// Structures all event types captured during simulation for offline synthesis.

const AUDIO_EVENT_TYPES = Object.freeze({
  BOUNCE: 'bounce',
  GATE: 'gate',
  SHATTER: 'shatter',
  MULTIPLICATION: 'multiplication',
  CHEER: 'cheer',
  NARRATION: 'narration'
});

class AudioEventLogger {
  static formatBounce(time, side, x, y, volume = 0.08, freq = 540) {
    return {
      time: Number(time.toFixed(3)),
      type: AUDIO_EVENT_TYPES.BOUNCE,
      lane: side,
      x: Math.round(x),
      y: Math.round(y),
      volume,
      frequency: freq
    };
  }

  static formatGate(time, side, tierIndex, isMultiplier = false) {
    return {
      time: Number(time.toFixed(3)),
      type: AUDIO_EVENT_TYPES.GATE,
      lane: side,
      tier: tierIndex,
      multiplier: isMultiplier
    };
  }

  static formatCheer(time, winnerName) {
    return {
      time: Number(time.toFixed(3)),
      type: AUDIO_EVENT_TYPES.CHEER,
      winner: winnerName
    };
  }
}

module.exports = {
  AUDIO_EVENT_TYPES,
  AudioEventLogger
};
