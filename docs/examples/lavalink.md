# HTTP Server with Lavalink

Use Streamify's HTTP server as a stream source for Lavalink.

## Why?

- Lavalink's YouTube plugin can be unreliable
- Streamify uses yt-dlp which handles YouTube's restrictions better
- Get audio filters without Lavalink's filter support

## Setup

### 1. Start Streamify Server

```javascript
// streamify-server.js
const Streamify = require('streamify-audio');

const streamify = new Streamify({
    port: 8787,
    cookiesPath: './cookies.txt',
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});

streamify.start().then(() => {
    console.log('Streamify running at http://127.0.0.1:8787');
});
```

### 2. Configure Lavalink

In `application.yml`, allow local addresses:

```yaml
lavalink:
  server:
    sources:
      http: true
```

### 3. Bot Integration

```javascript
const { Client } = require('discord.js');
const { Manager } = require('erela.js'); // or your Lavalink client

const client = new Client({ /* intents */ });

// Initialize Streamify client
const Streamify = require('streamify-audio');
const streamify = new Streamify({ port: 8787 });

// Initialize Lavalink
const lavalinkManager = new Manager({
    nodes: [{ host: 'localhost', port: 2333, password: 'youshallnotpass' }],
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    }
});

client.on('ready', async () => {
    await streamify.start();
    lavalinkManager.init(client.user.id);
});

client.on('raw', d => lavalinkManager.updateVoiceState(d));

// Play command
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!play')) return;

    const query = message.content.slice(6);
    const vc = message.member.voice.channel;

    // Search using Streamify
    const results = await streamify.youtube.search(query);
    if (!results.tracks.length) return message.reply('No results');

    const track = results.tracks[0];

    // Get stream URL from Streamify
    const streamUrl = streamify.youtube.getStreamUrl(track.id, {
        bass: 5  // Optional: apply filters
    });

    // Create Lavalink player
    const player = lavalinkManager.create({
        guild: message.guild.id,
        voiceChannel: vc.id,
        textChannel: message.channel.id
    });

    if (player.state !== 'CONNECTED') {
        player.connect();
    }

    // Load Streamify URL in Lavalink
    const res = await lavalinkManager.search(streamUrl, message.author);
    player.queue.add(res.tracks[0]);

    if (!player.playing) player.play();

    message.reply(`Playing: **${track.title}**`);
});

client.login(process.env.TOKEN);
```

## With Filters

```javascript
// Apply filters via Streamify URL
const streamUrl = streamify.youtube.getStreamUrl(trackId, {
    bass: 10,
    nightcore: true,
    volume: 80
});

// Lavalink plays the already-filtered audio
const res = await lavalinkManager.search(streamUrl, user);
```

## Changing Filters Mid-Song

```javascript
// Get current position from Streamify's stream tracking
const position = await streamify.getPosition(currentStreamId);

// Create new URL with filters + position
const newUrl = streamify.youtube.getStreamUrl(trackId, {
    bass: 10,
    nightcore: true,
    start: Math.floor(position)  // Seek to current position
});

// Tell Lavalink to switch
const res = await lavalinkManager.search(newUrl, user);
player.play(res.tracks[0]);
// Seamless transition with new filters
```

## Benefits

1. **Reliable extraction** - yt-dlp handles YouTube's anti-bot
2. **Cookie support** - Play age-restricted content
3. **Pre-applied filters** - Don't need Lavalink filter support
4. **Spotify support** - Automatic YouTube resolution
5. **Sponsorblock** - Skip sponsors before Lavalink receives audio

## Note

This approach adds one network hop (Lavalink fetches from Streamify). For direct playback without Lavalink, use Streamify's [Discord Player mode](../discord/manager.md) instead.
