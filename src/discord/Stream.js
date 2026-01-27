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
    }

    async create(seekPosition = 0) {
        if (this.destroyed) {
            throw new Error('Stream already destroyed');
        }

        if (this.resource) {
            return this.resource;
        }

        this.startTime = Date.now();
        const source = this.track.source || 'youtube';

        let videoId = this.track._resolvedId || this.track.id;

        if (source === 'spotify' && !this.track._resolvedId) {
            log.info('STREAM', `Resolving Spotify track to YouTube: ${this.track.title}`);
            try {
                const spotify = require('../providers/spotify');
                videoId = await spotify.resolveToYouTube(this.track.id, this.config);
                this.track._resolvedId = videoId;
            } catch (error) {
                log.error('STREAM', `Spotify resolution failed: ${error.message}`);
                throw new Error(`Failed to resolve Spotify track: ${error.message}`);
            }
        }

        if (!videoId || videoId === 'undefined') {
            throw new Error(`Invalid track ID: ${videoId} (source: ${source}, title: ${this.track.title})`);
        }

        log.info('STREAM', `Creating stream for ${videoId} (${source})`);

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

        this.ytdlp = spawn(this.config.ytdlpPath, ytdlpArgs, { env });

        const ffmpegFilters = { ...this.filters };
        const ffmpegArgs = buildFfmpegArgs(ffmpegFilters, this.config);
        this.ffmpeg = spawn(this.config.ffmpegPath, ffmpegArgs, { env });

        this.ytdlp.stdout.pipe(this.ffmpeg.stdin);

        let ytdlpError = '';
        this.ytdlp.stderr.on('data', (data) => {
            if (this.destroyed) return;
            const msg = data.toString();
            ytdlpError += msg;
            if (msg.includes('ERROR:') && !msg.includes('Retrying') && !msg.includes('Broken pipe')) {
                log.error('YTDLP', msg.trim());
            } else if (!msg.includes('[download]') && !msg.includes('ETA') && !msg.includes('[youtube]') && !msg.includes('Retrying fragment') && !msg.includes('Got error')) {
                log.debug('YTDLP', msg.trim());
            }
        });

        this.ffmpeg.stderr.on('data', (data) => {
            if (this.destroyed) return;
            const msg = data.toString();
            if ((msg.includes('Error') || msg.includes('error')) && !msg.includes('Connection reset') && !msg.includes('Broken pipe')) {
                log.error('FFMPEG', msg.trim());
            }
        });

        this.ytdlp.on('close', (code) => {
            if (code !== 0 && code !== null && !this.destroyed) {
                log.error('STREAM', `yt-dlp failed (code: ${code}) for ${videoId}`);
            }
            if (this.ffmpeg && !this.ffmpeg.killed && this.ffmpeg.stdin) {
                try { this.ffmpeg.stdin.end(); } catch(e) {}
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

        await this._waitForData(isLive);

        this.resource = createAudioResource(this.ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: false
        });

        const elapsed = Date.now() - this.startTime;
        log.info('STREAM', `Ready ${elapsed}ms`);

        return this.resource;
    }

    _waitForData(isLive = false) {
        return new Promise((resolve, reject) => {
            const timeoutMs = isLive ? 30000 : 15000;
            const timeout = setTimeout(() => {
                log.warn('STREAM', `Timeout waiting for data, proceeding anyway`);
                resolve();
            }, timeoutMs);

            let resolved = false;

            this.ffmpeg.stdout.once('readable', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve();
                }
            });

            this.ffmpeg.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error('ffmpeg closed before producing data'));
                }
            });

            this.ytdlp.on('close', (code) => {
                if (!resolved && code !== 0 && code !== null) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`yt-dlp failed with code ${code}`));
                }
            });
        });
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        const elapsed = this.startTime ? Date.now() - this.startTime : 0;
        log.info('STREAM', `Destroying stream | Duration: ${elapsed}ms`);

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