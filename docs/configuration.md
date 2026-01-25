# Configuration

## Discord Player Mode

```javascript
const manager = new Streamify.Manager(client, {
    // Paths (required)
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',

    // YouTube cookies (optional)
    cookiesPath: './cookies.txt',

    // Providers (optional - all enabled by default)
    providers: {
        youtube: { enabled: true },
        spotify: { enabled: true },
        soundcloud: { enabled: true }
    },

    // Spotify credentials (optional)
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    },

    // Audio settings
    audio: {
        bitrate: '128k',      // Audio bitrate
        format: 'opus'        // opus, mp3, aac
    },

    // Defaults
    defaultVolume: 80,        // 0-200
    maxPreviousTracks: 25,    // History size

    // Sponsorblock
    sponsorblock: {
        enabled: true,
        categories: ['sponsor', 'selfpromo', 'intro', 'outro']
    },

    // Auto-leave
    autoLeave: {
        enabled: true,
        emptyDelay: 30000,        // Leave 30s after channel empty
        inactivityTimeout: 300000 // Leave after 5min idle
    },

    // Auto-pause
    autoPause: {
        enabled: true,
        minUsers: 1               // Pause when users drop below this
    },

    // Autoplay
    autoplay: {
        enabled: false,
        maxTracks: 5              // Related tracks to fetch
    }
});
```

## HTTP Server Mode

```javascript
const streamify = new Streamify({
    // Server
    port: 8787,
    host: '0.0.0.0',

    // Paths
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',

    // YouTube cookies
    cookiesPath: './cookies.txt',
    // Or direct string:
    cookies: '# Netscape HTTP Cookie File\n...',

    // Providers (optional - all enabled by default)
    providers: {
        youtube: { enabled: true },
        spotify: { enabled: true },
        soundcloud: { enabled: true }
    },

    // Spotify
    spotify: {
        clientId: 'xxx',
        clientSecret: 'xxx'
    },

    // Audio
    audio: {
        bitrate: '128k',
        format: 'opus'
    },

    // Logging
    logLevel: 'info',    // none, error, warn, info, debug
    silent: false,
    colors: true
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret |
| `YTDLP_PATH` | Path to yt-dlp binary |
| `FFMPEG_PATH` | Path to ffmpeg binary |
| `COOKIES_PATH` | Path to YouTube cookies file |
| `PORT` | HTTP server port |

## YouTube Cookies

For age-restricted or region-locked videos:

1. Install browser extension "Get cookies.txt"
2. Visit youtube.com while logged in
3. Export cookies in Netscape format
4. Save as `cookies.txt`

```javascript
// File path
cookiesPath: './cookies.txt'

// Or direct string
cookies: `# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	0	COOKIE_NAME	COOKIE_VALUE`
```

## Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Copy Client ID and Client Secret

```javascript
spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
}
```

Spotify tracks are resolved to YouTube for playback.

## Providers

Enable or disable individual providers:

```javascript
providers: {
    youtube: { enabled: true },
    spotify: { enabled: true },
    soundcloud: { enabled: false }  // Disabled
}
```

All providers are enabled by default. When a disabled provider is accessed, an error is thrown:

```
Error: SoundCloud provider is disabled
```

This is useful if you only want to support specific platforms.
