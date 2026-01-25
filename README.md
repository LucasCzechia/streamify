# 🎵 Streamify

A Node.js audio streaming engine that actually works with YouTube.

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

## 🚀 Quick Start

```bash
npm install streamify-audio @discordjs/voice @discordjs/opus
```

```javascript
const Streamify = require('streamify-audio');

const manager = new Streamify.Manager(client, {
    cookiesPath: './cookies.txt'  // optional, for age-restricted
});

// Search & play
const result = await manager.search('never gonna give you up');
const player = await manager.create(guildId, voiceChannelId);
await player.play(result.tracks[0]);

// Filters
await player.setFilter('nightcore', true);
await player.setPreset('rock');
```

---

## ✨ Features

| Feature | Streamify |
|---------|:---------:|
| 🎵 YouTube, Spotify, SoundCloud | ✅ |
| 📋 Playlists & Albums | ✅ |
| 🎚️ 25+ Audio Filters | ✅ |
| 🎛️ 15-Band Equalizer | ✅ |
| 🎨 15 EQ Presets | ✅ |
| ⏭️ Instant Skip (prefetch) | ✅ |
| ⏸️ Auto-pause when alone | ✅ |
| ▶️ Auto-resume on rejoin | ✅ |
| 🚪 Auto-leave on inactivity | ✅ |
| 📻 Autoplay related tracks | ✅ |
| 🚫 Sponsorblock | ✅ |
| 🔌 No Lavalink/Java needed | ✅ |

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

## 🎛️ Filters & Presets

```javascript
// Individual filters
await player.setFilter('bass', 10);
await player.setFilter('speed', 1.25);
await player.setFilter('nightcore', true);

// EQ presets
await player.setPreset('rock');      // rock, pop, jazz, electronic...
await player.setPreset('bassboost'); // bass_heavy, vocal, classical...

// Custom 15-band EQ
await player.setEQ([0.3, 0.2, 0.1, 0, 0, -0.1, 0, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1, 0.1]);
```

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
| `8d` | boolean | Rotating audio |
| `karaoke` | boolean | Reduce vocals |
| `bassboost` | boolean | Heavy bass |
| `tremolo` | object | Volume wobble |
| `vibrato` | object | Pitch wobble |
| `flanger` | boolean | Flanger effect |
| `phaser` | boolean | Phaser effect |
| `lowpass` | Hz | Cut highs |
| `highpass` | Hz | Cut lows |

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

---

## 📋 Requirements

- **Node.js** 18+
- **yt-dlp** — `pip install yt-dlp`
- **ffmpeg** — `apt install ffmpeg`

---

## 🔗 Links

- [GitHub](https://github.com/LucasCzechia/streamify)
- [Documentation](./docs/README.md)
- [Issues](https://github.com/LucasCzechia/streamify/issues)

---

## 📄 License

MIT © [LucasCzechia](https://github.com/LucasCzechia)
