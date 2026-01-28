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

        // Skip metadata resolution if we already have it
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
            this.metrics.metadata = 0; // Already resolved
        }

        if (!videoId || videoId === 'undefined') {
            throw new Error(`Invalid track ID: ${videoId} (source: ${source}, title: ${this.track.title})`);
        }

        log.info('STREAM', `Creating stream for ${videoId} (${source})`);
        
        // Log Filter Chain Trace (No data impact)
        const filterNames = Object.keys(this.filters).filter(k => k !== 'start' && k !== '_trigger' && k !== 'volume');
        if (filterNames.length > 0) {
            const chain = filterNames.map(name => {
                const val = this.filters[name];
                let displayVal = typeof val === 'object' ? JSON.stringify(val) : val;
                if (displayVal === true || displayVal === 'true') displayVal = 'ON';
                return `[${name.toUpperCase()} (${displayVal})]`;
            }).join(' ➔ ');
            log.info('STREAM', `Filter Chain: ${chain}`);
        }

        const isYouTube = source === 'youtube' || source === 'spotify';
        const isLive = this.track.isLive === true || this.track.duration === 0;
        const isLocal = source === 'local';

        let ytdlp;
        let ffmpegIn;

        const env = { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH };
        const spawnStart = Date.now();

        if (isLocal) {
            // Skip yt-dlp for local files
            ffmpegIn = 'pipe:0'; // We'll just pass the file path to ffmpeg -i
            this.metrics.spawn = Date.now() - spawnStart;
        } else {
            let url;
            if (source === 'soundcloud') {
                url = this.track.uri || `https://api.soundcloud.com/tracks/${videoId}/stream`;
            } else if (['twitch', 'mixcloud', 'bandcamp', 'http'].includes(source)) {
                url = this.track.uri || videoId;
            } else {
                url = `https://www.youtube.com/watch?v=${videoId}`;
            }

            let formatString;
            if (isLive) {
                formatString = 'bestaudio*/best';
            } else {
                formatString = this.config.ytdlp.format;
            }

            const ytdlpArgs = [
                '-f', formatString,
                '--no-playlist',
                '--no-check-certificates',
                '--no-warnings',
                '--no-cache-dir',
                '--no-mtime',
                '--buffer-size', '16K',
                '--quiet',
                '--retries', '3',
                '--fragment-retries', '3',
                '-o', '-',
                ...this.config.ytdlp.additionalArgs,
                url
            ];

            if (isLive) {
                ytdlpArgs.push('--no-live-from-start');
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

            this.ytdlp = spawn(this.config.ytdlpPath, ytdlpArgs, { env });
            ffmpegIn = 'pipe:0';
        }

        const ffmpegFilters = { ...this.filters };
        const ffmpegArgs = buildFfmpegArgs(ffmpegFilters, this.config);
        
        // If local, inject the input file before other args
        if (isLocal) {
            const filePath = this.track.absolutePath || videoId.replace('file://', '');
            ffmpegArgs.unshift('-i', filePath);
            if (seekPosition > 0) {
                const seekSeconds = (seekPosition / 1000).toFixed(3);
                ffmpegArgs.unshift('-ss', seekSeconds);
            }
        }

        this.ffmpeg = spawn(this.config.ffmpegPath, ffmpegArgs, { env });
        this.metrics.spawn = Date.now() - spawnStart;

        if (this.ytdlp) {
            this.ytdlp.stdout.pipe(this.ffmpeg.stdin);

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

            this.ytdlp.on('close', (code) => {
                if (code !== 0 && code !== null && !this.destroyed) {
                    log.error('STREAM', `yt-dlp failed (code: ${code}) for ${videoId}`);
                }
                if (this.ffmpeg && !this.ffmpeg.killed && this.ffmpeg.stdin) {
                    try { this.ffmpeg.stdin.end(); } catch(e) {}
                }
            });
        }

        this.ffmpeg.stderr.on('data', (data) => {
            if (this.destroyed) return;
            const msg = data.toString();
            this.ffmpegError += msg;
            if ((msg.includes('Error') || msg.includes('error')) && !msg.includes('Connection reset') && !msg.includes('Broken pipe')) {
                log.error('FFMPEG', msg.trim());
            }
        });

        await this._waitForData(isLive);

        if (this.destroyed || !this.ffmpeg) {
            throw new Error('Stream destroyed during initialization');
        }

        this.resource = createAudioResource(this.ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: false
        });

        const elapsed = Date.now() - startTimestamp;
        this.metrics.total = elapsed;
        
        log.info('STREAM', `Ready ${elapsed}ms | Metrics: [Metadata: ${this.metrics.metadata}ms | Spawn: ${this.metrics.spawn}ms | FirstByte: ${this.metrics.firstByte}ms]`);

        return this.resource;
    }

    _waitForData(isLive = false) {
        const ffmpeg = this.ffmpeg;
        const ytdlp = this.ytdlp;

        return new Promise((resolve, reject) => {
            if (!ffmpeg) return resolve();

            const timeoutMs = isLive ? 30000 : 15000;
            const timeout = setTimeout(() => {
                log.warn('STREAM', `Timeout waiting for data, proceeding anyway`);
                resolve();
            }, timeoutMs);

            let resolved = false;

            // USE READABLE EVENT: Zero-consumption way to detect data
            const onReadable = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.metrics.firstByte = Date.now() - (this.startTime + this.metrics.metadata + this.metrics.spawn);
                    if (ffmpeg.stdout) ffmpeg.stdout.removeListener('readable', onReadable);
                    resolve();
                }
            };

            if (ffmpeg.stdout) {
                ffmpeg.stdout.on('readable', onReadable);
            }

            ffmpeg.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    if (ffmpeg.stdout) ffmpeg.stdout.removeListener('readable', onReadable);
                    
                    if (this.destroyed) {
                        return reject(new Error('Stream destroyed during initialization'));
                    }

                    const sourceErr = ytdlp ? `yt-dlp stderr: ${this.ytdlpError.slice(-200) || 'none'}` : `ffmpeg stderr: ${this.ffmpegError.slice(-200) || 'none'}`;
                    reject(new Error(`ffmpeg closed before producing data. ${sourceErr}`));
                }
            });

            if (ytdlp) {
                ytdlp.on('close', (code) => {
                    if (!resolved && code !== 0 && code !== null) {
                        resolved = true;
                        clearTimeout(timeout);
                        if (ffmpeg.stdout) ffmpeg.stdout.removeListener('readable', onReadable);

                        if (this.destroyed) {
                            return reject(new Error('Stream destroyed during initialization'));
                        }
                        
                        reject(new Error(`yt-dlp failed with code ${code}`));
                    }
                });
            }
        });
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        const elapsed = this.startTime ? Date.now() - this.startTime : 0;
        log.info('STREAM', `Destroying stream | Duration: ${Math.floor(elapsed / 1000)}s`);

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