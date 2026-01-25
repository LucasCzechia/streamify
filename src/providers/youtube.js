const { spawn } = require('child_process');
const { buildFfmpegArgs } = require('../filters/ffmpeg');
const { registerStream, unregisterStream } = require('../utils/stream');
const log = require('../utils/logger');

async function search(query, limit, config) {
    const startTime = Date.now();
    log.info('YOUTUBE', `Searching: "${query}" (limit: ${limit})`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--flat-playlist',
            '--skip-download',
            '-J',
            `ytsearch${limit}:${query}`
        ];

        if (config.cookiesPath) {
            args.unshift('--cookies', config.cookiesPath);
        }

        const proc = spawn(config.ytdlpPath, args, {
            env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
            }
            try {
                const data = JSON.parse(stdout);
                const tracks = (data.entries || []).map(entry => ({
                    id: entry.id,
                    title: entry.title,
                    duration: entry.duration || 0,
                    author: entry.channel || entry.uploader,
                    thumbnail: entry.thumbnails?.[0]?.url,
                    uri: `https://www.youtube.com/watch?v=${entry.id}`,
                    streamUrl: `/youtube/stream/${entry.id}`,
                    source: 'youtube',
                    isLive: entry.live_status === 'is_live' || entry.is_live === true || !entry.duration
                }));
                const elapsed = Date.now() - startTime;
                log.info('YOUTUBE', `Found ${tracks.length} results (${elapsed}ms)`);
                resolve({ tracks, source: 'youtube', searchTime: elapsed });
            } catch (e) {
                reject(new Error('Failed to parse yt-dlp output'));
            }
        });
    });
}

async function getInfo(videoId, config) {
    log.info('YOUTUBE', `Getting info: ${videoId}`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--skip-download',
            '-J',
            `https://www.youtube.com/watch?v=${videoId}`
        ];

        if (config.cookiesPath) {
            args.unshift('--cookies', config.cookiesPath);
        }

        const proc = spawn(config.ytdlpPath, args, {
            env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
            }
            try {
                const data = JSON.parse(stdout);
                const isLive = data.live_status === 'is_live' || data.is_live === true || !data.duration;
                resolve({
                    id: data.id,
                    title: data.title,
                    duration: data.duration || 0,
                    author: data.channel || data.uploader,
                    thumbnail: data.thumbnail,
                    uri: data.webpage_url,
                    streamUrl: `/youtube/stream/${data.id}`,
                    source: 'youtube',
                    isLive
                });
            } catch (e) {
                reject(new Error('Failed to parse yt-dlp output'));
            }
        });
    });
}

async function stream(videoId, filters, config, res) {
    const streamId = `yt-${videoId}-${Date.now()}`;
    const streamStartTime = Date.now();

    const filterStr = Object.entries(filters || {})
        .filter(([k, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'none';

    log.info('YOUTUBE', `Stream: ${videoId} | Filters: ${filterStr}`);

    res.setHeader('Content-Type', 'audio/ogg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const ytdlpArgs = [
        '-f', '18/bestaudio/best',
        '-o', '-',
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    if (config.cookiesPath) {
        ytdlpArgs.unshift('--cookies', config.cookiesPath);
    }

    const ytdlp = spawn(config.ytdlpPath, ytdlpArgs, {
        env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
    });

    const ffmpegArgs = buildFfmpegArgs(filters, config);
    const ffmpeg = spawn(config.ffmpegPath, ffmpegArgs);

    registerStream(streamId, { ytdlp, ffmpeg, videoId, source: 'youtube', filters });

    let bytesReceived = 0;
    let bytesSent = 0;

    ytdlp.stdout.on('data', (chunk) => {
        bytesReceived += chunk.length;
    });

    ffmpeg.stdout.on('data', (chunk) => {
        bytesSent += chunk.length;
    });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    ytdlp.stderr.on('data', (data) => {
        const msg = data.toString();
        if (!msg.includes('[download]') && !msg.includes('ETA')) {
            log.debug('YTDLP', msg.trim());
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('error')) {
            log.error('FFMPEG', msg.trim());
        }
    });

    const cleanup = (code = 0, error = null) => {
        if (ytdlp && !ytdlp.killed) ytdlp.kill('SIGTERM');
        if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGTERM');
        unregisterStream(streamId, code, error);
    };

    ytdlp.on('error', (error) => {
        log.error('YOUTUBE', videoId, error.message);
        cleanup(1, error);
    });

    ffmpeg.on('error', (error) => {
        log.error('FFMPEG', videoId, error.message);
        cleanup(1, error);
    });

    ffmpeg.on('close', (code) => {
        const elapsed = Date.now() - streamStartTime;
        log.info('YOUTUBE', `Stream ended: ${videoId} | Code: ${code} | ${elapsed}ms | Received: ${bytesReceived} | Sent: ${bytesSent}`);
        cleanup(code);
    });

    ytdlp.on('close', (code) => {
        if (code !== 0 && code !== null) {
            log.debug('YOUTUBE', `yt-dlp ended for ${videoId} (code: ${code})`);
        }
        ffmpeg.stdin.end();
    });

    res.on('close', () => {
        const elapsed = Date.now() - streamStartTime;
        log.info('YOUTUBE', `Client disconnected: ${videoId} | ${elapsed}ms | Received: ${bytesReceived} | Sent: ${bytesSent}`);
        cleanup(0);
    });
}

async function getPlaylist(playlistId, config) {
    log.info('YOUTUBE', `Getting playlist: ${playlistId}`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--flat-playlist',
            '--skip-download',
            '-J',
            `https://www.youtube.com/playlist?list=${playlistId}`
        ];

        if (config.cookiesPath) {
            args.unshift('--cookies', config.cookiesPath);
        }

        const proc = spawn(config.ytdlpPath, args, {
            env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
            }
            try {
                const data = JSON.parse(stdout);
                const tracks = (data.entries || []).map(entry => ({
                    id: entry.id,
                    title: entry.title,
                    duration: entry.duration || 0,
                    author: entry.channel || entry.uploader,
                    thumbnail: entry.thumbnails?.[0]?.url,
                    uri: `https://www.youtube.com/watch?v=${entry.id}`,
                    streamUrl: `/youtube/stream/${entry.id}`,
                    source: 'youtube',
                    isLive: entry.live_status === 'is_live' || entry.is_live === true || !entry.duration
                }));
                log.info('YOUTUBE', `Playlist loaded: ${data.title || playlistId} (${tracks.length} tracks)`);
                resolve({
                    id: playlistId,
                    title: data.title,
                    author: data.channel || data.uploader,
                    thumbnail: data.thumbnails?.[0]?.url,
                    tracks,
                    source: 'youtube'
                });
            } catch (e) {
                reject(new Error('Failed to parse playlist data'));
            }
        });
    });
}

async function getRelated(videoId, limit, config) {
    log.info('YOUTUBE', `Getting related for: ${videoId} (limit: ${limit})`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--flat-playlist',
            '--skip-download',
            '-J',
            `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`
        ];

        if (config.cookiesPath) {
            args.unshift('--cookies', config.cookiesPath);
        }

        const proc = spawn(config.ytdlpPath, args, {
            env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
            }
            try {
                const data = JSON.parse(stdout);
                const entries = data.entries || [];
                const tracks = entries
                    .filter(entry => entry.id !== videoId)
                    .slice(0, limit)
                    .map(entry => ({
                        id: entry.id,
                        title: entry.title,
                        duration: entry.duration,
                        author: entry.channel || entry.uploader,
                        thumbnail: entry.thumbnails?.[0]?.url,
                        uri: `https://www.youtube.com/watch?v=${entry.id}`,
                        streamUrl: `/youtube/stream/${entry.id}`,
                        source: 'youtube',
                        isAutoplay: true
                    }));
                log.info('YOUTUBE', `Found ${tracks.length} related tracks`);
                resolve({ tracks, source: 'youtube' });
            } catch (e) {
                reject(new Error('Failed to parse related tracks'));
            }
        });
    });
}

module.exports = { search, getInfo, stream, getPlaylist, getRelated };
