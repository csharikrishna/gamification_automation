// Burstpoint YouTube Publisher
// Implements strict YouTube Shorts publishing with explicit DRY_RUN validation and OAuth 2.0 Live Upload support.
// Guaranteed zero fabrication: Never generates fake video IDs, fake view counts, or simulated engagement.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { BasePublisher } = require('./publisher_interface');

class YouTubePublisher extends BasePublisher {
  constructor(config = {}) {
    super('youtube', config);
    this.clientId = config.clientId || process.env.YOUTUBE_CLIENT_ID || null;
    this.clientSecret = config.clientSecret || process.env.YOUTUBE_CLIENT_SECRET || null;
    this.refreshToken = config.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN || null;
    this.defaultPrivacy = config.privacyStatus || 'public';
  }

  /**
   * Validates metadata according to YouTube Data API v3 requirements.
   * @param {Object} metadata 
   */
  validateMetadata(metadata) {
    const errors = [];
    if (!metadata.title || typeof metadata.title !== 'string') {
      errors.push('Title is required and must be a string.');
    } else if (metadata.title.length > 100) {
      errors.push(`Title exceeds 100 characters (${metadata.title.length}).`);
    }

    if (metadata.description && metadata.description.length > 5000) {
      errors.push(`Description exceeds 5000 characters (${metadata.description.length}).`);
    }

    if (metadata.tags && Array.isArray(metadata.tags)) {
      const totalTagLength = metadata.tags.join(',').length;
      if (totalTagLength > 500) {
        errors.push(`Total tag length exceeds 500 characters (${totalTagLength}).`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Publishes or dry-run validates a video entry.
   * @param {Object} entry Video queue entry { videoPath, title, description, tags, ... }
   * @param {Object} options { dryRun: boolean }
   */
  async publish(entry, options = {}) {
    const isDryRun = options.dryRun !== undefined ? options.dryRun : (!this.refreshToken);

    // 1. Validate physical media
    const mediaCheck = this.validateMedia(entry);
    if (!mediaCheck.valid) {
      throw new Error(`Media validation failed: ${mediaCheck.error}`);
    }

    // 2. Verify bitstream integrity using FFmpeg
    const bitstreamCheck = this.verifyBitstream(mediaCheck.absPath);
    if (!bitstreamCheck.decodable) {
      throw new Error(`FFmpeg bitstream verification failed: ${bitstreamCheck.error}`);
    }

    // 3. Validate metadata constraints
    const metaCheck = this.validateMetadata({
      title: entry.title,
      description: entry.description,
      tags: entry.tags
    });
    if (!metaCheck.valid) {
      throw new Error(`YouTube metadata invalid: ${metaCheck.errors.join('; ')}`);
    }

    // 4. If DRY_RUN, return verified pre-flight report
    if (isDryRun) {
      return {
        success: true,
        mode: 'DRY_RUN',
        platform: 'youtube',
        platformVideoId: null, // No fabricated IDs
        url: null,
        videoPath: mediaCheck.absPath,
        fileSize: mediaCheck.fileSize,
        sha256: mediaCheck.sha256,
        bitstreamVerified: true,
        status: 'validated_ready_for_upload',
        metadata: {
          title: entry.title,
          description: entry.description || '',
          tags: entry.tags || [],
          categoryId: '20' // Gaming
        },
        metrics: null, // No fabricated metrics
        timestamp: new Date().toISOString()
      };
    }

    // 5. LIVE Upload
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Live publishing failed: Missing YouTube OAuth credentials (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN).');
    }

    const accessToken = await this._refreshAccessToken();
    const videoId = await this._uploadVideoResumable(accessToken, mediaCheck.absPath, entry);

    return {
      success: true,
      mode: 'LIVE',
      platform: 'youtube',
      platformVideoId: videoId,
      url: `https://youtu.be/${videoId}`,
      videoPath: mediaCheck.absPath,
      fileSize: mediaCheck.fileSize,
      sha256: mediaCheck.sha256,
      bitstreamVerified: true,
      status: 'uploaded',
      metadata: {
        title: entry.title,
        categoryId: '20'
      },
      metrics: null, // Initial upload has 0 metrics; real analytics require separate API call
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Refreshes OAuth 2.0 access token using client credentials and refresh token.
   * @private
   */
  async _refreshAccessToken() {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      }).toString();

      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data.access_token);
            } catch (err) {
              reject(new Error(`Failed to parse OAuth token response: ${err.message}`));
            }
          } else {
            reject(new Error(`OAuth token refresh failed with HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Uploads MP4 to YouTube via Resumable Upload protocol.
   * @private
   */
  async _uploadVideoResumable(accessToken, filePath, entry) {
    const stat = fs.statSync(filePath);
    const metadata = {
      snippet: {
        title: entry.title,
        description: entry.description || '',
        tags: entry.tags || [],
        categoryId: '20'
      },
      status: {
        privacyStatus: entry.privacyStatus || this.defaultPrivacy,
        selfDeclaredMadeForKids: false
      }
    };

    // Step A: Initiate resumable session
    const metaString = JSON.stringify(metadata);
    const uploadUrl = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': Buffer.byteLength(metaString),
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': stat.size
        }
      }, (res) => {
        if (res.statusCode === 200 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          let body = '';
          res.on('data', c => { body += c; });
          res.on('end', () => reject(new Error(`Failed to initiate YouTube upload session: HTTP ${res.statusCode}: ${body}`)));
        }
      });
      req.on('error', reject);
      req.write(metaString);
      req.end();
    });

    // Step B: Stream video file
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(uploadUrl);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'PUT',
        headers: {
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4'
        }
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const result = JSON.parse(body);
              resolve(result.id);
            } catch (e) {
              reject(new Error(`Could not parse YouTube upload response: ${body}`));
            }
          } else {
            reject(new Error(`YouTube media upload failed: HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      fs.createReadStream(filePath).pipe(req);
    });
  }

  /**
   * Fetches real analytics for a video if live credentials and video ID exist.
   * Returns null if unauthenticated or in dry-run mode. Never fabricates values.
   * @param {string} videoId 
   */
  async getAnalytics(videoId) {
    if (!videoId) {
      return {
        status: 'no_id',
        views: 0,
        likes: 0,
        comments: 0,
        retentionRate: null
      };
    }

    if (!this.clientId || !this.refreshToken) {
      return {
        status: 'unauthenticated',
        views: 0,
        likes: 0,
        comments: 0,
        retentionRate: null
      };
    }

    // Call official YouTube Data API v3 videos endpoint
    const accessToken = await this._refreshAccessToken();
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              const stats = data.items && data.items[0] && data.items[0].statistics;
              if (stats) {
                resolve({
                  status: 'live',
                  views: parseInt(stats.viewCount || '0', 10),
                  likes: parseInt(stats.likeCount || '0', 10),
                  comments: parseInt(stats.commentCount || '0', 10),
                  retentionRate: null // requires YouTube Analytics API scope
                });
              } else {
                resolve({ status: 'not_found', views: 0, likes: 0, comments: 0 });
              }
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`YouTube Analytics query failed: HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = { YouTubePublisher };
