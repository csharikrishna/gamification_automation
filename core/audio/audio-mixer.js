// Audio Synthesizer for Automated Simulation Videos
// Generates crisp, synchronized 44.1kHz 16-bit stereo WAV audio from simulation events
// Features event-priority mixing, dynamic ducking, velocity-sensitive collisions,
// master-bus headroom management, and soft-knee peak saturation.

const fs = require('fs');

class AudioSynthesizer {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
  }

  generateWav(events, totalDurationSeconds, outputPath) {
    const totalSamples = Math.ceil(totalDurationSeconds * this.sampleRate);
    const leftChannel = new Float32Array(totalSamples);
    const rightChannel = new Float32Array(totalSamples);

    // 1. Identify high-priority intervals: gate breakthroughs (0.75s, gain 0.35) and finish fanfare (2.8s, gain 0.20)
    const breakthroughAndFanfareIntervals = [];
    const gateEvents = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'finish') {
        const startSec = Math.max(0, ev.time);
        breakthroughAndFanfareIntervals.push({ start: startSec, end: startSec + 2.8, gain: 0.20, eventIndex: i });
      } else if (ev.type === 'gate') {
        const startSec = Math.max(0, ev.time);
        breakthroughAndFanfareIntervals.push({ start: startSec, end: startSec + 0.75, gain: 0.35, eventIndex: i });
        gateEvents.push({ event: ev, index: i, start: startSec, end: startSec + 0.75 });
      }
    }

    // Master ducking envelope for all background audio layers (bounce, tally, multiplication chimes)
    const backgroundDuckingEnvelope = this.createDuckingEnvelope(totalSamples, breakthroughAndFanfareIntervals);

    // 2. Synthesize events with priority, velocity sensitivity, and sample-level dynamic ducking
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const startSample = Math.floor(ev.time * this.sampleRate);
      if (startSample >= totalSamples) continue;

      const pan = ev.lane === 'left' ? -0.45 : ev.lane === 'right' ? 0.45 : 0;
      const leftGain = Math.cos((pan + 1) * Math.PI / 4);
      const rightGain = Math.sin((pan + 1) * Math.PI / 4);

      if (ev.type === 'bounce') {
        // Velocity-sensitive collision intensity
        const force = ev.impactForce || ev.force || 1.0;
        const basePitch = ev.pitch || (force > 1.4 ? 480 : 640);
        const baseVol = ev.volume || (force > 1.4 ? 0.14 : 0.08);
        this.renderClick(leftChannel, rightChannel, startSample, basePitch, baseVol, leftGain, rightGain, backgroundDuckingEnvelope);
      } else if (ev.type === 'gate') {
        // High-priority barrier breakthrough with sub-harmonic thump & resonant chime
        const tier = ev.tier || 0;
        const baseFreq = 300 * Math.pow(1.15, tier);
        const isFinalTier = (tier >= 5);
        // Gate chimes receive ducking from finish fanfare and any overlapping external gate breakthroughs
        const chimeIntervals = breakthroughAndFanfareIntervals.filter(interval => interval.eventIndex !== i);
        const chimeDucking = chimeIntervals.length > 0
          ? this.createDuckingEnvelope(totalSamples, chimeIntervals)
          : null;
        this.renderChime(leftChannel, rightChannel, startSample, baseFreq, isFinalTier ? 0.55 : 0.42, leftGain, rightGain, isFinalTier, chimeDucking);
      } else if (ev.type === 'multiplication') {
        // Multiplication crystalline shimmer receives dynamic ducking envelope
        this.renderMultiplication(leftChannel, rightChannel, startSample, ev.count || 6, leftGain, rightGain, backgroundDuckingEnvelope);
      } else if (ev.type === 'tally') {
        this.renderBlip(leftChannel, rightChannel, startSample, 880 + (ev.count || 0) % 200, 0.08, leftGain, rightGain, backgroundDuckingEnvelope);
      } else if (ev.type === 'finish') {
        this.renderFanfare(leftChannel, rightChannel, startSample);
      }
    }

    // 3. Master Bus Headroom Management & Peak Soft Limiting
    const wavBuffer = this.encodeWAV([leftChannel, rightChannel], this.sampleRate);
    fs.writeFileSync(outputPath, wavBuffer);
    return outputPath;
  }

  createDuckingEnvelope(totalSamples, intervals) {
    const duckingEnvelope = new Float32Array(totalSamples);
    duckingEnvelope.fill(1.0);

    const attackSamples = Math.floor(0.020 * this.sampleRate); // 20ms attack
    const releaseSamples = Math.floor(0.060 * this.sampleRate); // 60ms release

    for (const interval of intervals) {
      const startIdx = Math.floor(interval.start * this.sampleRate);
      const endIdx = Math.min(totalSamples, Math.floor(interval.end * this.sampleRate));
      const targetGain = interval.gain;

      // Attack phase with cosine smoothing
      const attStart = Math.max(0, startIdx - attackSamples);
      for (let s = attStart; s < startIdx && s < totalSamples; s++) {
        const progress = (s - attStart) / attackSamples;
        const g = 1.0 - (1.0 - targetGain) * (0.5 - 0.5 * Math.cos(Math.PI * progress));
        if (g < duckingEnvelope[s]) duckingEnvelope[s] = g;
      }

      // Sustained ducking phase
      for (let s = startIdx; s < endIdx && s < totalSamples; s++) {
        if (targetGain < duckingEnvelope[s]) duckingEnvelope[s] = targetGain;
      }

      // Release phase with cosine smoothing
      const relEnd = Math.min(totalSamples, endIdx + releaseSamples);
      for (let s = endIdx; s < relEnd && s < totalSamples; s++) {
        const progress = (s - endIdx) / releaseSamples;
        const g = targetGain + (1.0 - targetGain) * (0.5 - 0.5 * Math.cos(Math.PI * progress));
        if (g < duckingEnvelope[s]) duckingEnvelope[s] = g;
      }
    }

    return duckingEnvelope;
  }

  renderClick(left, right, startSample, freq, volume, leftGain, rightGain, duckingEnvelope = null) {
    const duration = 0.035; // 35ms
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      const duck = duckingEnvelope ? duckingEnvelope[idx] : 1.0;
      const t = i / this.sampleRate;
      const env = Math.exp(-t * 90);
      const val = Math.sin(2 * Math.PI * freq * t) * env * volume * duck;
      left[idx] += val * leftGain;
      right[idx] += val * rightGain;
    }
  }

  renderBlip(left, right, startSample, freq, volume, leftGain, rightGain, duckingEnvelope = null) {
    const duration = 0.04;
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      const duck = duckingEnvelope ? duckingEnvelope[idx] : 1.0;
      const t = i / this.sampleRate;
      const env = Math.exp(-t * 60);
      const val = Math.sin(2 * Math.PI * freq * t) * env * volume * duck;
      left[idx] += val * leftGain;
      right[idx] += val * rightGain;
    }
  }

  renderMultiplication(left, right, startSample, count, leftGain, rightGain, duckingEnvelope = null) {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 crystalline shimmer chord
    const noteSpacing = 0.035;
    notes.forEach((freq, idx) => {
      const noteStart = startSample + Math.floor(idx * noteSpacing * this.sampleRate);
      if (noteStart >= left.length) return;
      const duration = 0.38;
      const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - noteStart);
      for (let i = 0; i < numSamples; i++) {
        const sIdx = noteStart + i;
        const duck = duckingEnvelope ? duckingEnvelope[sIdx] : 1.0;
        const t = i / this.sampleRate;
        const env = Math.exp(-t * 8.5);
        const val = Math.sin(2 * Math.PI * freq * t) * env * 0.16 * duck;
        left[sIdx] += val * leftGain;
        right[sIdx] += val * rightGain;
      }
    });
  }

  renderChime(left, right, startSample, baseFreq, volume, leftGain, rightGain, isFinalTier = false, duckingEnvelope = null) {
    const duration = isFinalTier ? 0.95 : 0.65;
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    const harmonics = [
      { f: baseFreq, g: 0.55 },
      { f: baseFreq * 1.5, g: 0.30 },
      { f: baseFreq * 2.0, g: 0.22 },
      { f: baseFreq * 2.75, g: 0.14 }
    ];

    for (let i = 0; i < numSamples; i++) {
      const sIdx = startSample + i;
      const duck = duckingEnvelope ? duckingEnvelope[sIdx] : 1.0;
      const t = i / this.sampleRate;

      // Deterministic fracture snap noise
      let crackNoise = 0;
      if (t < 0.05) {
        const pseudoNoise = (Math.sin(i * 127.1 + t * 43758.54) * 43758.54) % 1;
        crackNoise = (pseudoNoise * 2 - 1) * Math.exp(-t * 110) * 0.38;
      }

      // Sub-harmonic resonant impact thump for final-tier breakthrough
      let subThump = 0;
      if (isFinalTier && t < 0.25) {
        subThump = Math.sin(2 * Math.PI * 75 * t) * Math.exp(-t * 18) * 0.35;
      }

      const env = Math.exp(-t * (isFinalTier ? 4.5 : 6.5));
      let sample = 0;
      for (const h of harmonics) {
        sample += Math.sin(2 * Math.PI * h.f * t) * h.g;
      }
      const val = ((sample * env * volume) + crackNoise + subThump) * duck;
      left[sIdx] += val * leftGain;
      right[sIdx] += val * rightGain;
    }
  }

  renderFanfare(left, right, startSample) {
    const notes = [440, 554.37, 659.25, 880, 1108.7]; // A major triumphant chord
    const noteSpacing = 0.08;

    notes.forEach((noteFreq, idx) => {
      const noteStart = startSample + Math.floor(idx * noteSpacing * this.sampleRate);
      const duration = 1.4;
      const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - noteStart);
      for (let i = 0; i < numSamples; i++) {
        const t = i / this.sampleRate;
        const env = Math.exp(-t * 3.2);
        const val = Math.sin(2 * Math.PI * noteFreq * t) * env * 0.24;
        left[noteStart + i] += val * 0.7;
        right[noteStart + i] += val * 0.7;
      }
    });
  }

  encodeWAV(channels, sampleRate) {
    const numChannels = channels.length;
    const length = channels[0].length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    // 1. Master Bus Headroom Scan: Measure peak sample across all channels
    let maxPeak = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      for (let i = 0; i < length; i++) {
        const absVal = Math.abs(channels[ch][i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }
    }

    // Dynamic normalization with 1.2dB headroom margin if peak exceeds safe threshold
    const targetPeak = 0.88;
    const normalizer = maxPeak > targetPeak ? (targetPeak / maxPeak) : 1.0;

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1 size
    buffer.writeUInt16LE(1, 20);  // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        // Apply normalizer and smooth hyperbolic tangent soft-limiting (zero clipping)
        let sample = channels[ch][i] * normalizer;
        sample = Math.tanh(sample * 1.05); // Smooth saturation curve
        if (sample > 0.96) sample = 0.96;
        if (sample < -0.96) sample = -0.96;

        const intSample = Math.floor(sample * 32767);
        buffer.writeInt16LE(intSample, offset);
        offset += 2;
      }
    }
    return buffer;
  }
}

module.exports = { AudioSynthesizer };
