// Burstpoint Universal Publisher Base Interface
// Enforces standard lifecycle, metadata validation, and media verification across publishing platforms.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class BasePublisher {
  constructor(name = 'base', options = {}) {
    this.name = name;
    this.options = options;
  }

  /**
   * Validates video file existence, non-zero size, and computes SHA-256.
   * @param {Object} entry 
   * @returns {{ valid: boolean, fileSize: number, sha256: string, error?: string }}
   */
  validateMedia(entry) {
    if (!entry || !entry.videoPath) {
      return { valid: false, error: 'Missing entry.videoPath' };
    }

    const absPath = path.resolve(entry.videoPath);
    if (!fs.existsSync(absPath)) {
      return { valid: false, error: `Media file does not exist on disk: ${absPath}` };
    }

    const stat = fs.statSync(absPath);
    if (stat.size < 1024) {
      return { valid: false, error: `Media file is suspiciously small or empty (${stat.size} bytes): ${absPath}` };
    }

    const fileBuffer = fs.readFileSync(absPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      valid: true,
      absPath,
      fileSize: stat.size,
      sha256
    };
  }

  /**
   * Probes video bitstream with FFmpeg to verify decodability and stream health.
   * @param {string} videoPath 
   */
  verifyBitstream(videoPath) {
    try {
      execSync(`ffmpeg -v error -i "${videoPath}" -f null -`, { stdio: 'pipe' });
      return { decodable: true };
    } catch (err) {
      return { decodable: false, error: err.stderr ? err.stderr.toString() : err.message };
    }
  }

  /**
   * Publishes media to the target platform.
   * Subclasses must implement this method.
   * @param {Object} entry 
   * @param {Object} options 
   */
  async publish(entry, options = {}) {
    throw new Error('publish() must be implemented by subclass');
  }

  /**
   * Retrieves analytics for a published video.
   * Subclasses must implement this method without fabricating metrics.
   * @param {string} videoId 
   */
  async getAnalytics(videoId) {
    throw new Error('getAnalytics() must be implemented by subclass');
  }
}

module.exports = { BasePublisher };
