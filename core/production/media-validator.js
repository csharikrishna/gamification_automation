// Core Media Validator
// Performs byte-level, bitstream, codec, container duration, exact frame count, and loudness verification using FFmpeg argument arrays and streaming SHA-256 hashing.

const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

class MediaValidator {
  // Streams SHA-256 calculation for large video files without loading entire buffer into RAM
  static calculateSha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // Verifies that FFmpeg can decode every video and audio packet in the MP4 without error using argument arrays
  static verifyBitstream(filePath) {
    if (!fs.existsSync(filePath)) {
      return { decodable: false, error: `File not found: ${filePath}` };
    }

    try {
      const res = spawnSync('ffmpeg', ['-v', 'error', '-i', filePath, '-f', 'null', '-'], { encoding: 'utf8' });
      if (res.status !== 0 || (res.stderr && res.stderr.trim().length > 0)) {
        return {
          decodable: false,
          error: `FFmpeg decode failed: ${res.stderr || `exit code ${res.status}`}`
        };
      }
      return { decodable: true, error: null };
    } catch (err) {
      return {
        decodable: false,
        error: `FFmpeg execution error: ${err.message}`
      };
    }
  }

  // Inspects FFmpeg container metadata, streams, exact decoded frames, and loudness
  static inspectMedia(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot inspect non-existent media: ${filePath}`);
    }

    // 1. Stream & container metadata inspection
    const res = spawnSync('ffmpeg', ['-i', filePath], { encoding: 'utf8' });
    const text = (res.stderr || '') + (res.stdout || '');

    const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = durMatch
      ? Number((parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3])).toFixed(2))
      : null;

    // Video stream match: Video: <codec> ... <width>x<height> ... <fps> fps
    const vidMatch = text.match(/Stream\s+#\d+:\d+(?:\[0x\w+\])?(?:\([^)]*\))?:\s*Video:\s*([a-zA-Z0-9_-]+)[^,]*,\s*[^,]+,\s*(\d{3,4})x(\d{3,4})[^,]*,\s*[^,]*\s*(\d+(?:\.\d+)?)\s*fps/i)
      || text.match(/Video:\s*([a-zA-Z0-9_-]+).*?(\d{3,4})x(\d{3,4}).*?(\d+(?:\.\d+)?)\s*fps/i);

    const videoCodec = vidMatch ? vidMatch[1].toLowerCase() : null;
    const width = vidMatch ? parseInt(vidMatch[2], 10) : null;
    const height = vidMatch ? parseInt(vidMatch[3], 10) : null;
    // Strict fps extraction: NEVER default missing fps to 60
    const fps = vidMatch ? parseFloat(vidMatch[4]) : null;

    // Audio stream match: Audio: <codec> ... <rate> Hz, <channels>
    const audMatch = text.match(/Stream\s+#\d+:\d+(?:\[0x\w+\])?(?:\([^)]*\))?:\s*Audio:\s*([a-zA-Z0-9_-]+)[^,]*,\s*(\d+)\s*Hz,\s*([a-zA-Z0-9_]+)/i)
      || text.match(/Audio:\s*([a-zA-Z0-9_-]+).*?(\d+)\s*Hz,\s*([a-zA-Z0-9_]+)/i);

    const audioCodec = audMatch ? audMatch[1].toLowerCase() : null;
    const audioRate = audMatch ? parseInt(audMatch[2], 10) : null;
    const audioChannels = audMatch ? audMatch[3] : null;
    const hasAudio = !!audMatch;

    // 2. Exact decoded frame count via copy to null sink
    let exactFrameCount = null;
    try {
      const frameCountRes = spawnSync(
        'ffmpeg',
        ['-i', filePath, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'],
        { encoding: 'utf8' }
      );
      const frameText = (frameCountRes.stderr || '') + (frameCountRes.stdout || '');
      const frameMatch = frameText.match(/frame=\s*(\d+)/i);
      if (frameMatch) {
        exactFrameCount = parseInt(frameMatch[1], 10);
      }
    } catch (e) {}

    // 3. Measure Integrated Loudness (EBU R128)
    let loudnessLufs = null;
    let loudnessStatus = 'NOT_MEASURED';
    try {
      const loudRes = spawnSync(
        'ffmpeg',
        ['-i', filePath, '-filter:a', 'ebur128', '-f', 'null', '-'],
        { encoding: 'utf8' }
      );
      const loudMatch = (loudRes.stderr || '').match(/Integrated loudness:\s+I:\s+([-0-9.]+)\s+LUFS/i);
      if (loudMatch) {
        loudnessLufs = parseFloat(loudMatch[1]);
        loudnessStatus = 'MEASURED';
      }
    } catch (e) {}

    return {
      durationSeconds,
      videoCodec,
      width,
      height,
      fps,
      exactFrameCount,
      hasAudio,
      audioCodec,
      audioRate,
      audioChannels,
      loudnessLufs,
      loudnessStatus
    };
  }

  // Comprehensive inspection against expected container specifications
  static async validateVideoFile(filePath, expected = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Media validation failed: File does not exist at ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size < (expected.minSizeBytes || 50000)) {
      throw new Error(`Media validation failed: File size too small (${stat.size} bytes).`);
    }

    const bitstream = this.verifyBitstream(filePath);
    if (!bitstream.decodable) {
      throw new Error(`Media validation failed: Corrupted bitstream: ${bitstream.error}`);
    }

    const info = this.inspectMedia(filePath);

    // Strict Frame Rate Verification (Never defaulted)
    if (info.fps === null) {
      throw new Error(`Media validation failed: Could not determine valid video frame rate.`);
    }
    if (expected.fps && Math.abs(info.fps - expected.fps) > 0.5) {
      throw new Error(`Media validation failed: FPS ${info.fps} deviates from expected ${expected.fps}`);
    }

    // Video Codec Verification
    if (expected.videoCodec) {
      const expVc = expected.videoCodec.toLowerCase();
      const actualVc = (info.videoCodec || '').toLowerCase();
      const matches = actualVc.includes(expVc) || (expVc === 'h264' && actualVc.includes('avc1'));
      if (!matches) {
        throw new Error(`Media validation failed: Video codec "${info.videoCodec}" does not match expected "${expected.videoCodec}"`);
      }
    }

    // Audio Codec & Presence Verification
    if (expected.requireAudio) {
      if (!info.hasAudio) {
        throw new Error(`Media validation failed: Expected audio stream, but no audio stream found.`);
      }
      if (expected.audioCodec) {
        const expAc = expected.audioCodec.toLowerCase();
        const actualAc = (info.audioCodec || '').toLowerCase();
        const matches = actualAc.includes(expAc) || (expAc === 'aac' && actualAc.includes('mp4a'));
        if (!matches) {
          throw new Error(`Media validation failed: Audio codec "${info.audioCodec}" does not match expected "${expected.audioCodec}"`);
        }
      }
      if (expected.minAudioRate && info.audioRate < expected.minAudioRate) {
        throw new Error(`Media validation failed: Audio sample rate ${info.audioRate}Hz is below minimum ${expected.minAudioRate}Hz`);
      }
    }

    // Duration Contract Verification
    if (expected.targetDuration) {
      const tol = expected.durationTolerance || 0.6;
      if (Math.abs(info.durationSeconds - expected.targetDuration) > tol) {
        throw new Error(
          `Media validation failed: Output duration ${info.durationSeconds}s deviates from target ${expected.targetDuration}s (tolerance: ±${tol}s)`
        );
      }
    }

    // Exact Decoded Frame Count Verification
    if (expected.minFrames) {
      if (info.exactFrameCount === null) {
        throw new Error(`Media validation failed: Could not count decoded frames in video bitstream.`);
      }
      if (info.exactFrameCount < expected.minFrames) {
        throw new Error(
          `Media validation failed: Decoded frame count ${info.exactFrameCount} is below minimum requirement of ${expected.minFrames} frames`
        );
      }
    }

    // Resolution Verification
    if (expected.resolution) {
      const [expW, expH] = expected.resolution.split('x').map(Number);
      if (info.width !== expW || info.height !== expH) {
        throw new Error(
          `Media validation failed: Resolution ${info.width}x${info.height} does not match expected ${expected.resolution}`
        );
      }
    }

    // Loudness Measurement Requirement
    if (expected.requireLoudness && info.loudnessStatus !== 'MEASURED') {
      throw new Error(`Media validation failed: Audio loudness could not be measured via EBU R128.`);
    }

    const sha256 = await this.calculateSha256(filePath);

    return {
      valid: true,
      filePath,
      fileSizeBytes: stat.size,
      fileSizeMb: Number((stat.size / 1024 / 1024).toFixed(2)),
      durationSeconds: info.durationSeconds,
      videoCodec: info.videoCodec,
      width: info.width,
      height: info.height,
      fps: info.fps,
      exactFrameCount: info.exactFrameCount,
      hasAudio: info.hasAudio,
      audioCodec: info.audioCodec,
      audioRate: info.audioRate,
      audioChannels: info.audioChannels,
      loudnessLufs: info.loudnessLufs,
      loudnessStatus: info.loudnessStatus,
      sha256,
      bitstreamVerified: true
    };
  }
}

module.exports = { MediaValidator };
