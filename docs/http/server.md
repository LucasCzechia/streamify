# HTTP Server

The HTTP server mode provides a REST API for audio streaming. Use it with Lavalink, web apps, or any HTTP client.

## Starting the Server

```javascript
const Streamify = require('streamify-audio');

const streamify = new Streamify({
    port: 8787,
    host: '0.0.0.0',
    cookiesPath: './cookies.txt',
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});

await streamify.start();
console.log(`Server running at ${streamify.getBaseUrl()}`);
// Server running at http://127.0.0.1:8787
```

## Configuration

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

    // Spotify
    spotify: {
        clientId: 'xxx',
        clientSecret: 'xxx'
    },

    // Audio output
    audio: {
        bitrate: '128k',
        format: 'opus'  // opus, mp3, aac
    },

    // Logging
    logLevel: 'info',
    silent: false,
    colors: true
});
```

## Methods

### start()

Starts the HTTP server.

```javascript
await streamify.start();
```

### stop()

Stops the HTTP server.

```javascript
await streamify.stop();
```

### getBaseUrl()

Returns the server URL.

```javascript
const url = streamify.getBaseUrl();
// http://127.0.0.1:8787
```

## Programmatic API

### Search

```javascript
// General
const results = await streamify.search('youtube', 'query', 10);

// Shorthand
const results = await streamify.youtube.search('query');
const results = await streamify.spotify.search('query');
const results = await streamify.soundcloud.search('query');
```

### Get Info

```javascript
const info = await streamify.getInfo('youtube', 'dQw4w9WgXcQ');
const info = await streamify.youtube.getInfo('dQw4w9WgXcQ');
```

### Get Stream URL

```javascript
// Without filters
const url = streamify.youtube.getStreamUrl('dQw4w9WgXcQ');

// With filters
const url = streamify.youtube.getStreamUrl('dQw4w9WgXcQ', {
    bass: 10,
    nightcore: true,
    start: 30
});
// http://127.0.0.1:8787/youtube/stream/dQw4w9WgXcQ?bass=10&nightcore=true&start=30
```

### Get Raw Stream

```javascript
const stream = await streamify.youtube.getStream('dQw4w9WgXcQ');
// Returns a readable stream
```

## Events

```javascript
streamify.on('streamStart', (event) => {
    console.log(`Stream started: ${event.trackId}`);
    // { id, source, trackId, filters, startTime }
});

streamify.on('streamEnd', (event) => {
    console.log(`Stream ended: ${event.trackId} (${event.duration}ms)`);
    // { id, source, trackId, filters, startTime, duration, code }
});

streamify.on('streamError', (event) => {
    console.error(`Stream error: ${event.error.message}`);
    // { id, source, trackId, filters, startTime, error }
});
```

## Active Streams

```javascript
// Get all active streams
const streams = await streamify.getActiveStreams();

// Get specific stream info
const info = await streamify.getStreamInfo(streamId);

// Get stream position
const position = await streamify.getPosition(streamId);
```

## CLI Usage

```bash
# Install globally
npm install -g streamify-audio

# Run
streamify --port 8787 --cookies ./cookies.txt

# With environment variables
PORT=8787 COOKIES_PATH=./cookies.txt streamify
```
