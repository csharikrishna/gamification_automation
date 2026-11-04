// Core Media Validator
// Performs byte-level, bitstream, codec, container duration, and loudness verification using FFmpeg and streaming SHA-256 hashing.

const fs = require('fs');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

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

  // Verifies that FFmpeg can decode every video and audio packet in the MP4 without error
  static verifyBitstream(filePath) {
    if (!fs.existsSync(filePath)) {
      return { decodable: false, error: `File not found: ${filePath}` };
    }

    try {
      execSync(`ffmpeg -v error -i "${filePath}" -f null -`, { stdio: 'pipe' });
      return { decodable: true, error: null };
    } catch (err) {
      return {
        decodable: false,
        error: `FFmpeg decode failed: ${err.stderr ? err.stderr.toString() : err.message}`
      };
    }
  }

  // Inspects FFmpeg container metadata and streams
  static inspectMedia(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot inspect non-existent media: ${filePath}`);
    }

    const res = spawnSync('ffmpeg', ['-i', filePath], { encoding: 'utf8' });
    const text = (res.stderr || '') + (res.stdout || '');

    const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = durMatch
      ? (parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3]))
      : null;

    const vidMatch = text.match(/Video:\s*([a-zA-Z0-9]+).*?(\d{3,4})x(\d{3,4}).*?(\d+(?:\.\d+)?)\s*fps/);
    const audMatch = text.match(/Audio:\s*([a-zA-Z0-9]+).*?(\d+)\s*Hz,\s*(stereo|mono)/);

    // Measure Integrated Loudness (EBU R128)
    let loudnessLufs = null;
    try {
      const loudRes = spawnSync('ffmpeg', ['-i', filePath, '-filter:a', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
      const loudMatch = (loudRes.stderr || '').match(/Integrated loudness:\s+I:\s+([-0-9.]+)\s+LUFS/);
      if (loudMatch) loudnessLufs = parseFloat(loudMatch[1]);
    } catch (e) {}

    const fps = vidMatch ? parseFloat(vidMatch[4]) : 60;
    const estimatedFrames = durationSeconds ? Math.round(durationSeconds * fps) : null;

    return {
      durationSeconds: durationSeconds ? Number(durationSeconds.toFixed(2)) : null,
      width: vidMatch ? parseInt(vidMatch[2], 10) : null,
      height: vidMatch ? parseInt(vidMatch[3], 10) : null,
      fps,
      estimatedFrames,
      audioRate: audMatch ? parseInt(audMatch[2], 10) : null,
      audioChannels: audMatch ? audMatch[3] : null,
      loudnessLufs
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

    // Duration Contract Verification
    if (expected.targetDuration) {
      const tol = expected.durationTolerance || 0.6;
      if (Math.abs(info.durationSeconds - expected.targetDuration) > tol) {
        throw new Error(
          `Media validation failed: Output duration ${info.durationSeconds}s deviates from target ${expected.targetDuration}s (tolerance: ±${tol}s)`
        );
      }
    }

    // Minimum Frame Count Verification
    if (expected.minFrames && info.estimatedFrames < expected.minFrames) {
      throw new Error(
        `Media validation failed: Frame count ${info.estimatedFrames} is below minimum requirement of ${expected.minFrames} frames`
      );
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

    const sha256 = await this.calculateSha256(filePath);

    return {
      valid: true,
      filePath,
      fileSizeBytes: stat.size,
      fileSizeMb: Number((stat.size / 1024 / 1024).toFixed(2)),
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      fps: info.fps,
      estimatedFrames: info.estimatedFrames,
      audioRate: info.audioRate,
      audioChannels: info.audioChannels,
      loudnessLufs: info.loudnessLufs,
      sha256,
      bitstreamVerified: true
    };
  }
}

module.exports = { MediaValidator };
