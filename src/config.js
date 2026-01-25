const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const defaults = {
    port: 8787,
    host: '0.0.0.0',
    ytdlpPath: null,
    ffmpegPath: null,
    cookies: null,
    cookiesPath: null,
    spotify: {
        clientId: null,
        clientSecret: null
    },
    audio: {
        bitrate: '128k',
        format: 'opus'
    },
    cache: {
        enabled: true,
        searchTTL: 300,
        infoTTL: 3600,
        redis: null
    }
};

function findExecutable(name) {
    try {
        const result = execSync(`which ${name}`, { encoding: 'utf-8' }).trim();
        return result || null;
    } catch {
        return null;
    }
}

function load(options = {}) {
    let fileConfig = {};

    if (options.configPath && fs.existsSync(options.configPath)) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
        } catch (e) {
            console.warn('[CONFIG] Failed to parse config file:', e.message);
        }
    } else if (fs.existsSync('./config.json')) {
        try {
            fileConfig = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
        } catch (e) {}
    }

    const config = {
        ...defaults,
        ...fileConfig,
        ...options,
        spotify: {
            ...defaults.spotify,
            ...fileConfig.spotify,
            ...options.spotify
        },
        audio: {
            ...defaults.audio,
            ...fileConfig.audio,
            ...options.audio
        },
        cache: {
            ...defaults.cache,
            ...fileConfig.cache,
            ...options.cache
        }
    };

    config.port = parseInt(process.env.PORT || config.port, 10);
    config.host = process.env.HOST || config.host;

    if (process.env.SPOTIFY_CLIENT_ID) {
        config.spotify.clientId = process.env.SPOTIFY_CLIENT_ID;
    }
    if (process.env.SPOTIFY_CLIENT_SECRET) {
        config.spotify.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    }
    if (process.env.COOKIES) {
        config.cookies = process.env.COOKIES;
    }
    if (process.env.COOKIES_PATH) {
        config.cookiesPath = process.env.COOKIES_PATH;
    }
    if (process.env.YTDLP_PATH) {
        config.ytdlpPath = process.env.YTDLP_PATH;
    }

    if (config.cookies && !config.cookiesPath) {
        const tempDir = path.join(require('os').tmpdir(), 'streamify');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        config.cookiesPath = path.join(tempDir, 'cookies.txt');
        fs.writeFileSync(config.cookiesPath, config.cookies);
        console.log('[CONFIG] Cookies written to temp file');
    }

    if (!config.ytdlpPath) {
        config.ytdlpPath = findExecutable('yt-dlp');
    }
    if (!config.ffmpegPath) {
        config.ffmpegPath = findExecutable('ffmpeg');
    }

    if (!config.ytdlpPath) {
        throw new Error('yt-dlp not found. Install it: pip install yt-dlp');
    }
    if (!config.ffmpegPath) {
        throw new Error('ffmpeg not found. Install it: apt install ffmpeg');
    }

    return config;
}

function loadConfig(options = {}) {
    return load(options);
}

module.exports = { load, loadConfig, defaults };
