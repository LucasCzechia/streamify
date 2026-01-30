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
    providers: {
        youtube: { enabled: true },
        spotify: { enabled: true },
        soundcloud: { enabled: true }
    },
    spotify: {
        clientId: null,
        clientSecret: null
    },
    voiceChannelStatus: {
        enabled: false,
        template: '🎶 Now Playing: {title} - {artist} | Requested by: {requester}'
    },
    audio: {
        bitrate: '128k',
        format: 'opus',
        vbr: true,
        compressionLevel: 10,
        application: 'audio'
    },
    ytdlp: {
        format: 'bestaudio/bestaudio[ext=webm]/bestaudio[ext=mp4]/18/22/best',
        additionalArgs: []
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

const MIN_YTDLP_VERSION = '2026.01.19';

function checkYtdlpVersion(ytdlpPath) {
    try {
        const version = execSync(`"${ytdlpPath}" --version`, { encoding: 'utf-8' }).trim();
        const versionDate = version.split('.').slice(0, 3).join('.');

        if (versionDate < MIN_YTDLP_VERSION) {
            console.warn(`[CONFIG] ⚠️  yt-dlp version ${version} is outdated`);
            console.warn(`[CONFIG] ⚠️  Live YouTube streams require yt-dlp >= ${MIN_YTDLP_VERSION}`);
            console.warn(`[CONFIG] ⚠️  Update with: yt-dlp --update-to nightly`);
        }
    } catch (e) {
        console.warn('[CONFIG] Could not check yt-dlp version:', e.message);
    }
}

function load(options = {}) {
    options = options || {};
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
        providers: {
            youtube: { enabled: true, ...fileConfig.providers?.youtube, ...options.providers?.youtube },
            spotify: { enabled: true, ...fileConfig.providers?.spotify, ...options.providers?.spotify },
            soundcloud: { enabled: true, ...fileConfig.providers?.soundcloud, ...options.providers?.soundcloud }
        },
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
        ytdlp: {
            ...defaults.ytdlp,
            ...fileConfig.ytdlp,
            ...options.ytdlp
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

    checkYtdlpVersion(config.ytdlpPath);

    return config;
}

function loadConfig(options = {}) {
    return load(options);
}

module.exports = { load, loadConfig, defaults };
