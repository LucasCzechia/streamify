# Manager

The Manager handles player creation, searching, and playlist loading.

## Creating a Manager

```javascript
const Streamify = require('streamify-audio');

const manager = new Streamify.Manager(client, {
    ytdlpPath: '/usr/local/bin/yt-dlp',
    ffmpegPath: '/usr/bin/ffmpeg',
    cookiesPath: './cookies.txt',
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});
```

See [Configuration](../configuration.md) for all options.

## Methods

### create(guildId, voiceChannelId, textChannelId)

Creates or retrieves a player for a guild.

```javascript
const player = await manager.create(
    message.guild.id,
    voiceChannel.id,
    message.channel.id
);
```

If a player already exists for the guild, returns the existing player. If the voice channel differs, disconnects and reconnects.

### get(guildId)

Gets an existing player without creating one.

```javascript
const player = manager.get(message.guild.id);
if (!player) {
    return message.reply('No player in this server.');
}
```

### destroy(guildId)

Destroys a player and disconnects from voice.

```javascript
manager.destroy(message.guild.id);
```

### destroyAll()

Destroys all players. Useful for graceful shutdown.

```javascript
process.on('SIGINT', () => {
    manager.destroyAll();
    process.exit();
});
```

### search(query, options?)

Searches for tracks.

- `query` (string) - The search term or URL
- `options` (object) - Search configuration
    - `source` (string) - `youtube`, `spotify`, or `soundcloud`
    - `limit` (number) - Number of results (default: 10)
    - `type` (string) - `video`, `live`, or `all` (YouTube only)
    - `sort` (string) - `relevance`, `popularity`, `date`, or `rating` (YouTube only)

**Example:**

```javascript
const result = await manager.search('lofi hip hop', {
    source: 'youtube',
    type: 'live',
    sort: 'popularity'
});
```

// Result
{
    loadType: 'search',  // search, empty, error
    tracks: [{
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        author: 'Rick Astley',
        duration: 213,
        thumbnail: 'https://...',
        uri: 'https://youtube.com/...',
        source: 'youtube'
    }]
}
```

### resolve(query)

Resolves a URL or falls back to search.

```javascript
// URL - loads directly
const result = await manager.resolve('https://youtube.com/watch?v=dQw4w9WgXcQ');
// { loadType: 'track', tracks: [track] }

// Search query - searches
const result = await manager.resolve('never gonna give you up');
// { loadType: 'search', tracks: [...] }
```

### loadPlaylist(url)

Loads a playlist or album.

```javascript
// YouTube playlist
const result = await manager.loadPlaylist('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

// Spotify playlist
const result = await manager.loadPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

// Spotify album
const result = await manager.loadPlaylist('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv');

// Result
{
    loadType: 'playlist',
    playlist: {
        id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        title: 'My Playlist',
        author: 'User',
        thumbnail: 'https://...',
        source: 'youtube'
    },
    tracks: [...]
}
```

### getRelated(track, limit?)

Gets related tracks for autoplay.

```javascript
const result = await manager.getRelated(currentTrack, 5);
// { tracks: [...] }
```

### getStats()

Gets manager statistics.

```javascript
const stats = manager.getStats();
// {
//     players: 5,
//     playingPlayers: 3,
//     memory: { heapUsed: 52428800, ... }
// }
```

## Events

```javascript
manager.on('playerCreate', (player) => {
    console.log(`Player created: ${player.guildId}`);
});

manager.on('playerDestroy', (player) => {
    console.log(`Player destroyed: ${player.guildId}`);
});
```

## Properties

```javascript
manager.players      // Map<guildId, Player>
manager.client       // Discord.js client
manager.config       // Resolved configuration
```
