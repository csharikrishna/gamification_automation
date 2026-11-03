// Audio Synthesizer for Automated Simulation Videos
// Generates crisp, synchronized 44.1kHz 16-bit stereo WAV audio from simulation events

const fs = require('fs');

class AudioSynthesizer {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
  }

  generateWav(events, totalDurationSeconds, outputPath) {
    const totalSamples = Math.ceil(totalDurationSeconds * this.sampleRate);
    const leftChannel = new Float32Array(totalSamples);
    const rightChannel = new Float32Array(totalSamples);

    for (const ev of events) {
      const startSample = Math.floor(ev.time * this.sampleRate);
      if (startSample >= totalSamples) continue;

      const pan = ev.lane === 'left' ? -0.45 : ev.lane === 'right' ? 0.45 : 0;
      const leftGain = Math.cos((pan + 1) * Math.PI / 4);
      const rightGain = Math.sin((pan + 1) * Math.PI / 4);

      if (ev.type === 'bounce') {
        this.renderClick(leftChannel, rightChannel, startSample, ev.pitch || 600, ev.volume || 0.12, leftGain, rightGain);
      } else if (ev.type === 'gate') {
        const baseFreq = 320 * Math.pow(1.18, ev.tier || 0);
        this.renderChime(leftChannel, rightChannel, startSample, baseFreq, ev.multiplier ? 0.45 : 0.35, leftGain, rightGain);
      } else if (ev.type === 'tally') {
        this.renderBlip(leftChannel, rightChannel, startSample, 880 + (ev.count || 0) % 200, 0.08, leftGain, rightGain);
      } else if (ev.type === 'finish') {
        this.renderFanfare(leftChannel, rightChannel, startSample);
      }
    }

    const wavBuffer = this.encodeWAV([leftChannel, rightChannel], this.sampleRate);
    fs.writeFileSync(outputPath, wavBuffer);
    return outputPath;
  }

  renderClick(left, right, startSample, freq, volume, leftGain, rightGain) {
    const duration = 0.035; // 35ms
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const env = Math.exp(-t * 90);
      const val = Math.sin(2 * Math.PI * freq * t) * env * volume;
      left[startSample + i] += val * leftGain;
      right[startSample + i] += val * rightGain;
    }
  }

  renderBlip(left, right, startSample, freq, volume, leftGain, rightGain) {
    const duration = 0.04;
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const env = Math.exp(-t * 60);
      const val = Math.sin(2 * Math.PI * freq * t) * env * volume;
      left[startSample + i] += val * leftGain;
      right[startSample + i] += val * rightGain;
    }
  }

  renderChime(left, right, startSample, baseFreq, volume, leftGain, rightGain) {
    const duration = 0.65; // 650ms glass break + resonant chime
    const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - startSample);
    const harmonics = [
      { f: baseFreq, g: 0.60 },
      { f: baseFreq * 1.5, g: 0.35 },
      { f: baseFreq * 2.0, g: 0.25 },
      { f: baseFreq * 2.75, g: 0.15 }
    ];

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;

      // Initial glass crack/shatter noise burst in the first 45ms
      let crackNoise = 0;
      if (t < 0.045) {
        crackNoise = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.45;
      }

      const env = Math.exp(-t * 6.5);
      let sample = 0;
      for (const h of harmonics) {
        sample += Math.sin(2 * Math.PI * h.f * t) * h.g;
      }
      const val = (sample * env * volume) + crackNoise;
      left[startSample + i] += val * leftGain;
      right[startSample + i] += val * rightGain;
    }
  }

  renderFanfare(left, right, startSample) {
    const notes = [440, 554.37, 659.25, 880, 1108.7]; // A major triumphant chord
    const noteSpacing = 0.08;

    notes.forEach((noteFreq, idx) => {
      const noteStart = startSample + Math.floor(idx * noteSpacing * this.sampleRate);
      const duration = 1.2;
      const numSamples = Math.min(Math.floor(duration * this.sampleRate), left.length - noteStart);
      for (let i = 0; i < numSamples; i++) {
        const t = i / this.sampleRate;
        const env = Math.exp(-t * 3.5);
        const val = Math.sin(2 * Math.PI * noteFreq * t) * env * 0.28;
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
        // Soft clipping / limiting
        let sample = channels[ch][i];
        if (sample > 0.95) sample = 0.95;
        if (sample < -0.95) sample = -0.95;
        const intSample = Math.floor(sample * 32767);
        buffer.writeInt16LE(intSample, offset);
        offset += 2;
      }
    }
    return buffer;
  }
}

module.exports = { AudioSynthesizer };
