// Multiplying Ball Race - Audio Modes Configuration
// Defines 3 configurable audio operational modes:
// Mode A: Pure physics / ASMR (Impacts, ricochets, shatters, multipliers, victory cheer)
// Mode B: Minimal commentator (Opening hook narration, key inflection moment, decisive finish)
// Mode C: Full commentary (Continuous play-by-play narrative synthesis)

const AUDIO_MODES = Object.freeze({
  MODE_A_ASMR: 'A',
  MODE_B_MINIMAL: 'B',
  MODE_C_FULL: 'C'
});

const DEFAULT_AUDIO_CONFIG = {
  activeMode: AUDIO_MODES.MODE_A_ASMR,
  sampleRate: 44100,
  channels: 2,
  bitDepth: 16,
  normalizationTargetDb: -14,
  peakLimiterDb: -1.0,
  duckingAmountDb: -6.0,
  duckingDurationSeconds: 1.5,
  soundLibrary: {
    bounceFreqBase: 480,
    gateShatterFreq: 880,
    multiplierFanfareFreq: 1040,
    cheerHarmonics: [440, 554.37, 659.25, 880]
  }
};

module.exports = {
  AUDIO_MODES,
  DEFAULT_AUDIO_CONFIG
};
