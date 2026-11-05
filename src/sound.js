/**
 * WebAudioSynthesizer - Procedural sound synthesizer for browser preview and recording.
 * Backward-compatibility shim delegating to core/audio/web-audio-synthesizer.js
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../core/audio/web-audio-synthesizer');
} else if (typeof window !== 'undefined' && window.WebAudioSynthesizer) {
  // Already defined by core/audio/web-audio-synthesizer.js
}
