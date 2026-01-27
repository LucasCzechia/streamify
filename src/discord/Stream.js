const { spawn } = require('child_process');
const { buildFfmpegArgs } = require('../filters/ffmpeg');
const log = require('../utils/logger');

let voiceModule;
try {
    voiceModule = require('@discordjs/voice');
} catch (e) {
    voiceModule = null;
}

const { createAudioResource, StreamType } = voiceModule || {};

class StreamController {
    constructor(track, filters, config) {
        this.track = track;
        this.filters = filters || {};
        this.config = config;
        this.ytdlp = null;
        this.ffmpeg = null;
        this.resource = null;
        this.destroyed = false;
        this.startTime = null;
        this.bytesReceived = 0;
        this.bytesSent = 0;
        this.ytdlpError = '';
        this.ffmpegError = '';
        
        // Timing metrics
        this.metrics = {
            metadata: 0,
            spawn: 0,
            firstByte: 0,
            total: 0
        };
    }

    async create(seekPosition = 0) {
        if (this.destroyed) {
            throw new Error('Stream already destroyed');
        }

        if (this.resource) {
            return this.resource;
        }

        this.startTime = Date.now();
        const startTimestamp = this.startTime;
        const source = this.track.source || 'youtube';

        let videoId = this.track._resolvedId || this.track.id;

        if (source === 'spotify' && !this.track._resolvedId) {
            log.info('STREAM', `Resolving Spotify track to YouTube: ${this.track.title}`);
            try {
                const spotify = require('../providers/spotify');
                videoId = await spotify.resolveToYouTube(this.track.id, this.config);
                this.track._resolvedId = videoId;
                this.metrics.metadata = Date.now() - startTimestamp;
            } catch (error) {
                log.error('STREAM', `Spotify resolution failed: ${error.message}`);
                throw new Error(`Failed to resolve Spotify track: ${error.message}`);
            }
        } else {
            this.metrics.metadata = Date.now() - startTimestamp;
        }

        if (!videoId || videoId === 'undefined') {
            throw new Error(`Invalid track ID: ${videoId} (source: ${source}, title: ${this.track.title})`);
        }

        log.info('STREAM', `Creating stream for ${videoId} (${source})`);
        
        // Log Filter Chain
        const filterNames = Object.keys(this.filters).filter(k => k !== 'start' && k !== '_trigger');
        if (filterNames.length > 0) {
            const chain = filterNames.map(name => {
                const val = this.filters[name];
                const displayVal = typeof val === 'object' ? JSON.stringify(val) : val;
                return `[${name} (${displayVal})]`;
            }).join(' -> ');
            log.debug('STREAM', `Filter Chain: ${chain}`);
        }

        let url;
        if (source === 'soundcloud') {
            url = this.track.uri || `https://api.soundcloud.com/tracks/${videoId}/stream`;
        } else {
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }

        const isYouTube = source === 'youtube' || source === 'spotify';
        const isLive = this.track.isLive === true || this.track.duration === 0;

        let formatString;
        if (isLive) {
            formatString = 'bestaudio*/best';
        } else {
            formatString = isYouTube ? '18/22/bestaudio[ext=webm]/bestaudio/best' : 'bestaudio/best';
        }

        const ytdlpArgs = [
            '-f', formatString,
            '--no-playlist',
            '--no-check-certificates',
            '--no-warnings',
            '--retries', '3',
            '--fragment-retries', '3',
            '-o', '-',
            url
        ];

        if (isLive) {
            ytdlpArgs.push('--no-live-from-start');
            log.info('STREAM', `Live stream detected, using live-compatible format`);
        } else if (isYouTube) {
            ytdlpArgs.push('--extractor-args', 'youtube:player_client=web_creator');
        }

        if (seekPosition > 0) {
            const seekSeconds = Math.floor(seekPosition / 1000);
            ytdlpArgs.push('--download-sections', `*${seekSeconds}-`);
            log.info('STREAM', `Seeking to ${seekSeconds}s`);
        }

        if (this.config.cookiesPath) {
            ytdlpArgs.unshift('--cookies', this.config.cookiesPath);
        }

        if (this.config.sponsorblock?.enabled !== false && isYouTube) {
            const categories = this.config.sponsorblock?.categories || ['sponsor', 'selfpromo'];
            ytdlpArgs.push('--sponsorblock-remove', categories.join(','));
        }

        const env = { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH };

        const spawnStart = Date.now();
        this.ytdlp = spawn(this.config.ytdlpPath, ytdlpArgs, { env });

        const ffmpegFilters = { ...this.filters };
        const ffmpegArgs = buildFfmpegArgs(ffmpegFilters, this.config);
        this.ffmpeg = spawn(this.config.ffmpegPath, ffmpegArgs, { env });
        
        this.metrics.spawn = Date.now() - spawnStart;

        const { pipeline } = require('stream');

        this._firstDataTime = null;
        
        this.ytdlp.stdout.on('data', (chunk) => {
            this.bytesReceived += chunk.length;
        });

        this.ffmpeg.stdout.on('data', (chunk) => {
            if (!this._firstDataTime) {
                this._firstDataTime = Date.now() - this.startTime;
                this.metrics.firstByte = Date.now() - (startTimestamp + this.metrics.metadata + this.metrics.spawn);
            }
            this.bytesSent += chunk.length;
        });

        pipeline(this.ytdlp.stdout, this.ffmpeg.stdin, (err) => {
            if (err && !this.destroyed) {
                if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE' && err.code !== 'EPIPE') {
                    log.debug('STREAM', `Pipeline error: ${err.message}`);
                }
            }
        });

        this.ytdlp.stderr.on('data', (data) => {
            if (this.destroyed) return;
            const msg = data.toString();
            this.ytdlpError += msg;
            if (msg.includes('ERROR:') && !msg.includes('Retrying') && !msg.includes('Broken pipe')) {
                log.error('YTDLP', msg.trim());
            } else if (!msg.includes('[download]') && !msg.includes('ETA') && !msg.includes('[youtube]') && !msg.includes('Retrying fragment') && !msg.includes('Got error')) {
                log.debug('YTDLP', msg.trim());
            }
        });

        this.ffmpeg.stderr.on('data', (data) => {
            if (this.destroyed) return;
            const msg = data.toString();
            this.ffmpegError += msg;
            if ((msg.includes('Error') || msg.includes('error')) && !msg.includes('Connection reset') && !msg.includes('Broken pipe')) {
                log.error('FFMPEG', msg.trim());
            }
        });

        this.ytdlp.on('close', (code) => {
            if (code !== 0 && code !== null && !this.destroyed) {
                log.error('STREAM', `yt-dlp failed (code: ${code}) for ${videoId}`);
                if (this.ytdlpError) {
                    log.error('STREAM', `yt-dlp stderr: ${this.ytdlpError.slice(-500)}`);
                }
            }
            if (this.ffmpeg && !this.ffmpeg.killed && this.ffmpeg.stdin) {
                this.ffmpeg.stdin.end();
            }
        });

        this.ytdlp.on('error', (error) => {
            if (error.code !== 'EPIPE' && !this.destroyed) {
                log.error('STREAM', `yt-dlp spawn error: ${error.message}`);
            }
        });

        this.ffmpeg.on('error', (error) => {
            if (error.code !== 'EPIPE' && !this.destroyed) {
                log.error('STREAM', `ffmpeg spawn error: ${error.message}`);
            }
        });

        this.ytdlp.stdout.on('error', (error) => {
            if (error.code !== 'EPIPE' && !this.destroyed) {
                log.debug('STREAM', `yt-dlp stdout error: ${error.message}`);
            }
        });

        this.ffmpeg.stdin.on('error', (error) => {
            if (error.code !== 'EPIPE' && !this.destroyed) {
                log.debug('STREAM', `ffmpeg stdin error: ${error.message}`);
            }
        });

        this.ffmpeg.stdout.on('error', (error) => {
            if (error.code !== 'EPIPE' && !this.destroyed) {
                log.debug('STREAM', `ffmpeg stdout error: ${error.message}`);
            }
        });

        await this._waitForData(isLive);

        this.resource = createAudioResource(this.ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: false
        });

        const elapsed = Date.now() - startTimestamp;
        this.metrics.total = elapsed;
        
        log.info('STREAM', `Ready ${elapsed}ms | Metrics: [Metadata: ${this.metrics.metadata}ms | Spawn: ${this.metrics.spawn}ms | FirstByte: ${this.metrics.firstByte}ms] | Buffered: ${this.bytesSent}b`);

        return this.resource;
    }

    _waitForData(isLive = false) {
        return new Promise((resolve, reject) => {
            const timeoutMs = isLive ? 30000 : 15000;
            const timeout = setTimeout(() => {
                log.warn('STREAM', `Timeout waiting for data, proceeding anyway (received: ${this.bytesSent}, isLive: ${isLive})`);
                resolve();
            }, timeoutMs);

            let resolved = false;

            const checkInterval = setInterval(() => {
                if (resolved) {
                    clearInterval(checkInterval);
                    return;
                }
                if (this.bytesSent > 0) {
                    resolved = true;
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);

            this.ffmpeg.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    reject(new Error(`ffmpeg closed before producing data. ffmpeg stderr: ${this.ffmpegError.slice(-200) || 'none'} | yt-dlp stderr: ${this.ytdlpError.slice(-200) || 'none'}`));
                }
            });

            this.ytdlp.on('close', (code) => {
                if (!resolved && code !== 0) {
                    resolved = true;
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    reject(new Error(`yt-dlp failed with code ${code}. stderr: ${this.ytdlpError.slice(-200) || 'none'}`));
                }
            });
        });
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        const elapsed = this.startTime ? Date.now() - this.startTime : 0;
        log.info('STREAM', `Destroying stream | Duration: ${elapsed}ms | Data Out: ${(this.bytesSent / 1024 / 1024).toFixed(2)} MB`);

        try {
            if (this.ytdlp && this.ffmpeg) {
                this.ytdlp.stdout.unpipe(this.ffmpeg.stdin);
            }
        } catch (e) {}

        if (this.ytdlp && !this.ytdlp.killed) {
            try {
                this.ytdlp.stdout.destroy();
                this.ytdlp.kill('SIGKILL');
            } catch (e) {}
        }

        if (this.ffmpeg && !this.ffmpeg.killed) {
            try {
                this.ffmpeg.stdin.destroy();
                this.ffmpeg.stdout.destroy();
                this.ffmpeg.kill('SIGKILL');
            } catch (e) {}
        }

        this.ytdlp = null;
        this.ffmpeg = null;
        this.resource = null;
    }
}

function createStream(track, filters, config) {
    return new StreamController(track, filters, config);
}

module.exports = { createStream, StreamController };