# Streamify

A Node.js audio streaming engine — reliable YouTube, Spotify, and SoundCloud playback with prefetching, real-time filters, and programmatic stream URLs. Use it for Discord bots, web apps, or any project that needs rock-solid audio streaming.

**Two modes of operation:**

1. **Discord Player** — Lavalink alternative using @discordjs/voice directly
2. **HTTP Streaming Server** — Self-hosted audio proxy for any platform

## Why Streamify?

YouTube frequently updates its anti-bot mechanisms (SABR streaming, n-parameter challenges, format enforcement), making reliable audio streaming a moving target. Streamify delegates extraction to **yt-dlp**, which is actively maintained and adapts quickly to these changes.

By managing the entire streaming pipeline locally, Streamify focuses on reliable playback rather than fragile HTTP-based extraction.

In production use, Streamify reliably plays content that commonly fails in other setups, including age-restricted and recently updated YouTube streams.

## Why not Lavalink?

Lavalink is a popular and capable solution, but it comes with trade-offs:

- Requires Java and a separate server process
- HTTP timeouts can occur during slow or complex extractions
- Limited control over the audio pipeline

## What Streamify offers

- Pure Node.js — no Java dependency
- Direct **@discordjs/voice** integration — no HTTP timeouts
- Real-time audio filters via **ffmpeg**
- Prefetching for instant track transitions
- Built-in auto-pause, auto-leave, and autoplay

## Feature Comparison

| Feature | Streamify | Lavalink |
|---------|:---------:|:--------:|
| **Setup** |
| Pure Node.js | ✅ | ❌ (Java) |
| Single process | ✅ | ❌ (separate server) |
| No HTTP layer | ✅ | ❌ |
| **Sources** |
| YouTube | ✅ | ✅ |
| Spotify | ✅ | ✅ (plugin) |
| SoundCloud | ✅ | ✅ (plugin) |
| YouTube Playlists | ✅ | ✅ |
| Spotify Playlists/Albums | ✅ | ✅ (plugin) |
| **Playback** |
| Play/Pause/Resume | ✅ | ✅ |
| Skip/Previous | ✅ | ✅ |
| Seek | ✅ | ✅ |
| Volume (0-200%) | ✅ | ✅ |
| **Queue** |
| Add/Remove/Clear | ✅ | Client-side |
| Shuffle | ✅ | Client-side |
| Move tracks | ✅ | Client-side |
| Loop (off/track/queue) | ✅ | Client-side |
| Previous track history | ✅ | ❌ |
| **Filters** |
| Bass/Treble | ✅ | ✅ |
| Speed/Pitch | ✅ | ✅ |
| Nightcore/Vaporwave | ✅ | ✅ |
| Bassboost | ✅ | ✅ |
| 8D Audio | ✅ | ✅ |
| Tremolo/Vibrato | ✅ | ✅ |
| Karaoke (vocal removal) | ✅ | ✅ |
| Low-pass/High-pass | ✅ | ✅ |
| Rotation | ✅ | ✅ |
| 15-Band Equalizer | ❌ | ✅ |
| **Automation** |
| Auto-pause (channel empty) | ✅ | ❌ |
| Auto-resume (users rejoin) | ✅ | ❌ |
| Auto-leave (inactivity) | ✅ | Client-side |
| Autoplay (related tracks) | ✅ | Plugin |
| Sponsorblock | ✅ | Plugin |
| **Events** |
| Track start/end/error | ✅ | ✅ |
| Queue end | ✅ | ✅ |
| User join/leave channel | ✅ | ❌ |
| Channel empty | ✅ | ❌ |
| Auto-pause/resume | ✅ | ❌ |
| **Performance** |
| Prefetch next track | ✅ | ❌ |
| Stream destroyed on pause | ✅ | ❌ |
| No HTTP timeouts | ✅ | ❌ |
| **Reliability** |
| Age-restricted videos | ✅ | ⚠️ |
| Cookie support | ✅ | ✅ |
| Adapts to YouTube changes | ✅ (yt-dlp) | ⚠️ |

✅ Built-in | ⚠️ Partial/Varies | ❌ Not available | Client-side = You implement | Plugin = Requires setup

## Documentation

📖 **[Full Documentation](./docs/README.md)**

- [Quick Start](./docs/quick-start.md)
- [Configuration](./docs/configuration.md)
- [Discord Player](./docs/discord/manager.md)
- [HTTP Server](./docs/http/server.md)
- [Audio Filters](./docs/filters.md)
- [Examples](./docs/examples/basic-bot.md)

## Requirements

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - `pip install yt-dlp`
- [ffmpeg](https://ffmpeg.org/) - `apt install ffmpeg`

## Installation

```bash
npm install streamify-audio @discordjs/voice @discordjs/opus
```

---

# Discord Player Mode

Complete Lavalink replacement with queue management, filters, and automation.

## Quick Start

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const Streamify = require('streamify-audio');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

const manager = new Streamify.Manager(client, {
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',
    cookiesPath: './cookies.txt',
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});

client.on('ready', () => {
    console.log('Bot ready!');
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play')) {
        const query = message.content.slice(6);
        const voiceChannel = message.member.voice.channel;

        // Search
        const result = await manager.search(query);
        const track = result.tracks[0];

        // Create player and play
        const player = await manager.create(
            message.guild.id,
            voiceChannel.id,
            message.channel.id
        );

        player.on('trackStart', (t) => {
            message.channel.send(`Now playing: ${t.title}`);
        });

        await player.play(track);
    }
});

client.login(process.env.TOKEN);
```

See the [full documentation](./docs/README.md) for detailed API reference.

---

# HTTP Server Mode

For use with Lavalink or any HTTP client. See [HTTP Server docs](./docs/http/server.md).

```javascript
const Streamify = require('streamify-audio');

const streamify = new Streamify({
    port: 8787,
    cookiesPath: './cookies.txt'
});

await streamify.start();

// Search
const results = await streamify.youtube.search('never gonna give you up');

// Get stream URL
const url = streamify.youtube.getStreamUrl(results.tracks[0].id, {
    bass: 10,
    nightcore: true
});
// http://127.0.0.1:8787/youtube/stream/dQw4w9WgXcQ?bass=10&nightcore=true
```

---

# License

MIT
