const { spawn } = require('child_process');
const { buildFfmpegArgs } = require('../filters/ffmpeg');
const { registerStream, unregisterStream } = require('../utils/stream');
const log = require('../utils/logger');

async function search(query, limit, config) {
    const startTime = Date.now();
    log.info('SOUNDCLOUD', `Searching: "${query}" (limit: ${limit})`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--flat-playlist',
            '--skip-download',
            '-J',
            `scsearch${limit}:${query}`
        ];

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
                    duration: entry.duration,
                    author: entry.uploader,
                    thumbnail: entry.thumbnails?.[0]?.url,
                    uri: entry.url || entry.webpage_url,
                    streamUrl: `/soundcloud/stream/${entry.id}`,
                    source: 'soundcloud'
                }));
                const elapsed = Date.now() - startTime;
                log.info('SOUNDCLOUD', `Found ${tracks.length} results (${elapsed}ms)`);
                resolve({ tracks, source: 'soundcloud', searchTime: elapsed });
            } catch (e) {
                reject(new Error('Failed to parse yt-dlp output'));
            }
        });
    });
}

async function getInfo(trackId, config) {
    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--skip-download',
            '-J',
            `https://soundcloud.com/track/${trackId}`
        ];

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
                resolve({
                    id: data.id,
                    title: data.title,
                    duration: data.duration,
                    author: data.uploader,
                    thumbnail: data.thumbnail,
                    uri: data.webpage_url,
                    streamUrl: `/soundcloud/stream/${data.id}`,
                    source: 'soundcloud'
                });
            } catch (e) {
                reject(new Error('Failed to parse yt-dlp output'));
            }
        });
    });
}

function stream(trackUrl, filters, config, res) {
    const streamId = `sc-${Date.now()}`;
    const streamStartTime = Date.now();

    const filterStr = Object.entries(filters || {})
        .filter(([k, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'none';

    log.info('SOUNDCLOUD', `Stream: ${trackUrl} | Filters: ${filterStr}`);

    res.setHeader('Content-Type', 'audio/ogg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const url = trackUrl.startsWith('http') ? trackUrl : `https://api.soundcloud.com/tracks/${trackUrl}/stream`;

    const ytdlp = spawn(config.ytdlpPath, [
        '-f', 'bestaudio/best',
        '-o', '-',
        url
    ], {
        env: { ...process.env, PATH: '/usr/local/bin:/root/.deno/bin:' + process.env.PATH }
    });

    const ffmpegArgs = buildFfmpegArgs(filters, config);
    const ffmpeg = spawn(config.ffmpegPath, ffmpegArgs);

    registerStream(streamId, { ytdlp, ffmpeg, source: 'soundcloud', trackId: trackUrl, filters });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    ytdlp.stderr.on('data', (data) => {
        const msg = data.toString();
        if (!msg.includes('[download]') && !msg.includes('ETA')) {
            log.debug('SOUNDCLOUD', msg.trim());
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

    ytdlp.on('error', (err) => cleanup(1, err));
    ffmpeg.on('error', (err) => cleanup(1, err));
    ffmpeg.on('close', (code) => {
        const elapsed = Date.now() - streamStartTime;
        log.info('SOUNDCLOUD', `Stream ended: ${trackUrl} | ${elapsed}ms | Code: ${code}`);
        cleanup(code);
    });
    ytdlp.on('close', () => {
        if (ffmpeg.stdin) {
            try { ffmpeg.stdin.end(); } catch (e) {}
        }
    });
    res.on('close', () => {
        const elapsed = Date.now() - streamStartTime;
        log.info('SOUNDCLOUD', `Client disconnected: ${trackUrl} | ${elapsed}ms`);
        cleanup(0);
    });
}

module.exports = { search, getInfo, stream };
