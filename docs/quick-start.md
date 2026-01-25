# Quick Start

## Installation

```bash
npm install streamify-audio @discordjs/voice @discordjs/opus
```

## Requirements

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — `pip install yt-dlp`
- [ffmpeg](https://ffmpeg.org/) — `apt install ffmpeg`

## Discord Bot (5 minutes)

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
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg'
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!')) return;

    const [cmd, ...args] = message.content.slice(1).split(' ');
    const query = args.join(' ');

    if (cmd === 'play') {
        const vc = message.member.voice.channel;
        if (!vc) return message.reply('Join a voice channel first!');

        const result = await manager.search(query);
        if (!result.tracks.length) return message.reply('No results found.');

        const player = await manager.create(message.guild.id, vc.id, message.channel.id);

        player.on('trackStart', (track) => {
            message.channel.send(`Now playing: **${track.title}**`);
        });

        await player.play(result.tracks[0]);
    }

    if (cmd === 'skip') {
        const player = manager.get(message.guild.id);
        if (player) await player.skip();
    }

    if (cmd === 'stop') {
        const player = manager.get(message.guild.id);
        if (player) player.destroy();
    }
});

client.login(process.env.TOKEN);
```

## HTTP Server (3 minutes)

```javascript
const Streamify = require('streamify-audio');

const streamify = new Streamify({ port: 8787 });
await streamify.start();

// Search
const results = await streamify.youtube.search('never gonna give you up');
console.log(results.tracks[0].title);

// Get stream URL
const url = streamify.youtube.getStreamUrl(results.tracks[0].id);
// http://127.0.0.1:8787/youtube/stream/dQw4w9WgXcQ
```

## Next Steps

- [Configuration](./configuration.md) — Add Spotify, cookies, filters
- [Discord Player](./discord/manager.md) — Full player documentation
- [HTTP Server](./http/server.md) — API endpoints
