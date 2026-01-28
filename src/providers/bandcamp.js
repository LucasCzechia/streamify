const log = require('../utils/logger');
const { spawn } = require('child_process');

async function getInfo(url, config) {
    log.info('BANDCAMP', `Getting info: ${url}`);

    return new Promise((resolve, reject) => {
        const args = [
            '-q', '--no-warnings',
            '--skip-download',
            '-J',
            url
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
                    duration: data.duration || 0,
                    author: data.uploader || data.artist,
                    thumbnail: data.thumbnail,
                    uri: data.webpage_url,
                    streamUrl: `/bandcamp/stream/${Buffer.from(url).toString('base64')}`,
                    source: 'bandcamp',
                    isLive: false
                });
            } catch (e) {
                reject(new Error('Failed to parse Bandcamp data'));
            }
        });
    });
}

module.exports = { getInfo };
