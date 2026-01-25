#!/usr/bin/env node

const Streamify = require('../index');

const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config' || arg === '-c') {
        options.configPath = args[++i];
    } else if (arg === '--port' || arg === '-p') {
        options.port = parseInt(args[++i], 10);
    } else if (arg === '--host' || arg === '-h') {
        options.host = args[++i];
    } else if (arg === '--cookies') {
        options.cookiesPath = args[++i];
    } else if (arg === '--help') {
        console.log(`
Streamify - Audio Streaming Proxy for Discord Bots

Usage: streamify [options]

Options:
  -c, --config <path>   Path to config file (default: ./config.json)
  -p, --port <port>     Port to listen on (default: 8787)
  -h, --host <host>     Host to bind to (default: 0.0.0.0)
  --cookies <path>      Path to YouTube cookies file
  --help                Show this help message

Environment Variables:
  PORT                  Server port
  HOST                  Server host
  SPOTIFY_CLIENT_ID     Spotify API client ID
  SPOTIFY_CLIENT_SECRET Spotify API client secret
  COOKIES_PATH          Path to cookies file
  YTDLP_PATH            Path to yt-dlp binary

Examples:
  streamify
  streamify --port 3000
  streamify --config ./my-config.json
  PORT=3000 SPOTIFY_CLIENT_ID=xxx streamify
`);
        process.exit(0);
    }
}

const log = require('../src/utils/logger');
log.init(options);
log.banner();

const server = new Streamify(options);

server.start().then(() => {
    console.log(`
Ready! API Endpoints:
  GET /health              - Service health
  GET /stats               - Service statistics

  GET /youtube/search      - Search YouTube
  GET /youtube/stream/:id  - Stream from YouTube

  GET /spotify/search      - Search Spotify
  GET /spotify/stream/:id  - Stream from Spotify

  GET /soundcloud/search   - Search SoundCloud
  GET /soundcloud/stream/:id - Stream from SoundCloud

Filter Parameters (add to stream URLs):
  ?bass=5        Bass boost (-20 to 20)
  ?treble=5      Treble boost (-20 to 20)
  ?speed=1.25    Playback speed (0.5 to 2.0)
  ?pitch=1.1     Pitch shift (0.5 to 2.0)
  ?volume=150    Volume percentage (0 to 200)
  ?nightcore=true  Nightcore preset
  ?vaporwave=true  Vaporwave preset
  ?bassboost=true  Bass boost preset
  ?8d=true         8D audio effect
`);
}).catch(err => {
    console.error('Failed to start:', err.message);
    process.exit(1);
});
