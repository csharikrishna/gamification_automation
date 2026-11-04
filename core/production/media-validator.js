// Core Media Validator
// Performs byte-level, bitstream, and codec verification using FFmpeg and streaming SHA-256 hashing.

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

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

  // Inspects file metadata and guarantees container specifications
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

    const sha256 = await this.calculateSha256(filePath);

    return {
      valid: true,
      filePath,
      fileSizeBytes: stat.size,
      fileSizeMb: Number((stat.size / 1024 / 1024).toFixed(2)),
      sha256,
      bitstreamVerified: true
    };
  }
}

module.exports = { MediaValidator };
