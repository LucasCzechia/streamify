# 🎵 Streamify

A dual-mode Node.js audio streaming engine that actually works with YouTube.

[![npm version](https://img.shields.io/npm/v/streamify-audio.svg)](https://www.npmjs.com/package/streamify-audio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## ⚡ Why Streamify?

YouTube breaks music bots constantly. Lavalink times out. DisTube uses fragmented formats that fail. Most libraries don't work reliably anymore.

**Streamify works** because it:
- Uses **format 18** (progressive MP4, not fragmented DASH)
- Uses **web_creator** player client (bypasses restrictions)
- Pipes **directly** to Discord (no HTTP timeouts)
- Relies on **yt-dlp** (actively maintained, adapts fast)

---

## 🎯 Two Modes, One Library

Streamify offers two ways to stream audio:

| Mode | Use Case | How It Works |
|------|----------|--------------|
| 🎮 **Discord Player** | Discord music bots | Direct pipe to @discordjs/voice |
| 🌐 **HTTP Server** | Web apps, other platforms, debugging | REST API with stream URLs |

Both modes share the same providers, filters, and streaming engine.

---

## 🚀 Quick Start

```bash
npm install streamify-audio
```

### 🎮 Discord Player Mode

For Discord bots — plays directly in voice channels.

```bash
npm install @discordjs/voice @discordjs/opus
```

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const Streamify = require('streamify-audio');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const manager = new Streamify.Manager(client, {
    cookiesPath: './cookies.txt'
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play')) {
        const query = message.content.slice(6);
        const vc = message.member.voice.channel;

        const result = await manager.search(query);
        const player = await manager.create(message.guild.id, vc.id);

        player.on('trackStart', (track) => {
            message.channel.send(`🎵 Now playing: **${track.title}**`);
        });

        await player.play(result.tracks[0]);
    }
});

client.login(process.env.TOKEN);
```

### 🌐 HTTP Server Mode

For web apps, external services, or any platform that can consume audio streams.

```javascript
const Streamify = require('streamify-audio');

const streamify = new Streamify({
    port: 8787,
    host: '0.0.0.0'
});

await streamify.start();
console.log('Server running at http://localhost:8787');

// Search for tracks
const results = await streamify.youtube.search('never gonna give you up');
console.log(results.tracks[0].title);

// Get a stream URL (playable in any audio player)
const url = streamify.youtube.getStreamUrl(results.tracks[0].id);
// → http://localhost:8787/youtube/stream/dQw4w9WgXcQ

// With filters
const urlWithFilters = streamify.youtube.getStreamUrl('dQw4w9WgXcQ', {
    bass: 10,
    speed: 1.25,
    nightcore: true
});
// → http://localhost:8787/youtube/stream/dQw4w9WgXcQ?bass=10&speed=1.25&nightcore=true
```

---

## 🌐 HTTP Server API

When running in HTTP mode, Streamify exposes a REST API:

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status |
| `GET` | `/stats` | Memory, uptime, active streams |
| `GET` | `/streams` | List all active streams |
| `GET` | `/youtube/search?q=query` | Search YouTube |
| `GET` | `/youtube/info/:id` | Get track info |
| `GET` | `/youtube/stream/:id` | Stream audio (OGG/Opus) |
| `GET` | `/spotify/search?q=query` | Search Spotify |
| `GET` | `/spotify/stream/:id` | Stream Spotify track |
| `GET` | `/soundcloud/search?q=query` | Search SoundCloud |
| `GET` | `/soundcloud/stream/:id` | Stream SoundCloud track |

### Stream Parameters

Add query parameters to `/stream` endpoints for real-time audio processing:

```
/youtube/stream/dQw4w9WgXcQ?bass=10&speed=1.25&nightcore=true
```

### Example: Web Audio Player

```html
<audio controls>
    <source src="http://localhost:8787/youtube/stream/dQw4w9WgXcQ" type="audio/ogg">
</audio>
```

### Example: Fetch from Backend

```javascript
// Search
const response = await fetch('http://localhost:8787/youtube/search?q=lofi+beats');
const { tracks } = await response.json();

// Play in browser
const audio = new Audio(`http://localhost:8787/youtube/stream/${tracks[0].id}`);
audio.play();
```

---

## ✨ Features

| Feature | Discord | HTTP |
|---------|:-------:|:----:|
| 🎵 YouTube, Spotify, SoundCloud | ✅ | ✅ |
| 📺 **Voice Channel Status** | ✅ | — |
| 🔍 **Advanced Search Filters** | ✅ | ✅ |
| 📋 Playlists & Albums | ✅ | ✅ |
| 🎚️ 30+ Stackable Filters | ✅ | ✅ |
| 🎛️ 15-Band Equalizer | ✅ | ✅ |
| 🎨 15 EQ Presets | ✅ | ✅ |
| ⏭️ Instant Skip (prefetch) | ✅ | — |
| ⏸️ Auto-pause when alone | ✅ | — |
| ▶️ Auto-resume on rejoin | ✅ | — |
| 🚪 Auto-leave on inactivity | ✅ | — |
| 🚫 Sponsorblock | ✅ | ✅ |
| 📊 Timing & Performance Logs | ✅ | ✅ |
| 🔌 No Lavalink/Java needed | ✅ | ✅ |

---

## 🎮 Discord Player Features

### Voice Channel Status

Show what's playing directly in the sidebar of the voice channel.

```javascript
const manager = new Streamify.Manager(client, {
    voiceChannelStatus: {
        enabled: true,
        template: '🎶 Playing: {title} | {requester}'
    }
});
```

### Search with Filters

Filter for live streams or sort results by popularity/date.

```javascript
const results = await manager.search('lofi hip hop', {
    type: 'live',
    sort: 'popularity'
});
```

### Queue Management

```javascript
const player = manager.get(guildId);

// Add tracks
player.queue.add(track);
player.queue.addMany(tracks);

// Controls
await player.skip();
await player.previous();
await player.seek(30000); // 30 seconds

// Queue operations
player.queue.shuffle();
player.queue.move(0, 5);
player.queue.remove(2);
player.queue.clear();

// Loop modes
player.setLoop('off');    // No loop
player.setLoop('track');  // Loop current track
player.setLoop('queue');  // Loop entire queue
```

### Events

```javascript
player.on('trackStart', (track) => {
    console.log(`Playing: ${track.title}`);
});

player.on('trackEnd', (track, reason) => {
    console.log(`Ended: ${track.title} (${reason})`);
});

player.on('queueEnd', () => {
    console.log('Queue finished');
});

player.on('trackError', (track, error) => {
    console.error(`Error: ${error.message}`);
});

// Voice events
player.on('userJoin', (member, count) => { });
player.on('userLeave', (member, count) => { });
player.on('channelEmpty', () => { });
player.on('autoPause', (userCount) => { });
player.on('autoResume', (userCount) => { });
```

### Auto Features

```javascript
const manager = new Streamify.Manager(client, {
    autoLeave: {
        enabled: true,
        emptyDelay: 30000,      // Leave after 30s if channel empty
        inactivityTimeout: 300000  // Leave after 5min of no playback
    },
    autoPause: {
        enabled: true,
        minUsers: 1  // Pause when fewer than 1 user (excluding bot)
    },
    autoplay: {
        enabled: true,
        maxTracks: 5  // Add up to 5 related tracks when queue ends
    }
});
```

---

## 🎛️ Filters & Presets

Both modes support the same filters:

```javascript
// Discord mode
await player.setFilter('bass', 10);
await player.setFilter('nightcore', true);
await player.setPreset('rock');

// HTTP mode (via URL params)
const url = streamify.getStreamUrl('youtube', 'dQw4w9WgXcQ', {
    bass: 10,
    nightcore: true,
    preset: 'rock'
});
```

### EQ Presets

`flat` · `rock` · `pop` · `jazz` · `classical` · `electronic` · `hiphop` · `acoustic` · `rnb` · `latin` · `loudness` · `piano` · `vocal` · `bass_heavy` · `treble_heavy`

<details>
<summary><b>All available filters</b></summary>

| Filter | Type | Description |
|--------|------|-------------|
| `bass` | -20 to 20 | Bass boost/cut |
| `treble` | -20 to 20 | Treble boost/cut |
| `speed` | 0.5 to 2.0 | Playback speed |
| `pitch` | 0.5 to 2.0 | Pitch shift |
| `volume` | 0 to 200 | Volume % |
| `nightcore` | boolean | Speed + pitch up |
| `vaporwave` | boolean | Speed + pitch down |
| `subboost` | boolean | Extreme sub-bass boost |
| `reverb` | boolean | Room acoustics effect |
| `surround` | boolean | Surround sound mapping |
| `boost` | boolean | Clarity & volume boost |
| `8d` | boolean | Rotating audio |
| `karaoke` | boolean | Reduce vocals |
| `bassboost` | boolean | Heavy bass |
| `tremolo` | object | Volume wobble |
| `vibrato` | object | Pitch wobble |
| `rotation` | object | 8D with custom speed |
| `flanger` | boolean | Flanger effect |
| `phaser` | boolean | Phaser effect |
| `chorus` | boolean | Chorus effect |
| `compressor` | boolean | Dynamic compression |
| `normalizer` | boolean | Loudness normalization |
| `lowpass` | Hz | Cut highs |
| `highpass` | Hz | Cut lows |
| `bandpass` | object | Bandpass filter |
| `bandreject` | object | Notch filter |
| `lowshelf` | object | Low shelf EQ |
| `highshelf` | object | High shelf EQ |
| `peaking` | object | Parametric EQ |
| `mono` | boolean | Stereo to mono |
| `surround` | boolean | Surround effect |

</details>

---

## 🆚 Why Not Lavalink?

| | Streamify | Lavalink |
|--|:---------:|:--------:|
| Setup | `npm install` | Java + separate server |
| YouTube | ✅ Works | ⚠️ Timeout issues |
| Latency | ~3s start | Variable |
| Skip | Instant | 2-3s |
| Dependencies | Node.js only | Java 17+ |
| Filters | Built-in | Requires config |
| Auto-pause | ✅ Built-in | ❌ DIY |
| HTTP API | ✅ Built-in | ❌ WebSocket only |

---

## ⚙️ Configuration

### Discord Mode

```javascript
const manager = new Streamify.Manager(client, {
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',
    cookiesPath: './cookies.txt',
    providers: {
        youtube: { enabled: true },
        spotify: { enabled: true },
        soundcloud: { enabled: false }  // Disable SoundCloud
    },
    spotify: {
        clientId: 'your_client_id',
        clientSecret: 'your_client_secret'
    },
    audio: {
        bitrate: '128k',
        format: 'opus'
    },
    defaultVolume: 80,
    maxPreviousTracks: 25,
    sponsorblock: {
        enabled: true,
        categories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic']
    }
});
```

### HTTP Mode

```javascript
const streamify = new Streamify({
    port: 8787,
    host: '0.0.0.0',
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',
    cookiesPath: './cookies.txt',
    providers: {
        youtube: { enabled: true },
        spotify: { enabled: true },
        soundcloud: { enabled: true }
    },
    spotify: {
        clientId: 'your_client_id',
        clientSecret: 'your_client_secret'
    },
    audio: {
        bitrate: '128k',
        format: 'opus'
    },
    logLevel: 'info'
});
```

---

## 📋 Requirements

- **Node.js** 18+
- **yt-dlp** — `pip install yt-dlp`
- **ffmpeg** — `apt install ffmpeg`
- **@discordjs/voice** + **@discordjs/opus** — Discord mode only

---

## 📖 Documentation

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/quick-start.md) | Get running in 5 minutes |
| [Configuration](./docs/configuration.md) | All options explained |
| [Filters](./docs/filters.md) | Audio filters, EQ, presets |
| [Events](./docs/discord/events.md) | Player events reference |
| [Examples](./docs/examples/basic-bot.md) | Full bot examples |

---

## 🔗 Links

- [GitHub](https://github.com/LucasCzechia/streamify)
- [npm](https://www.npmjs.com/package/streamify-audio)
- [Issues](https://github.com/LucasCzechia/streamify/issues)

---

## 📄 License

MIT © [LucasCzechia](https://github.com/LucasCzechia)
