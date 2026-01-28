# Sources

Streamify supports YouTube, Spotify, SoundCloud, Twitch, Mixcloud, Bandcamp, Local Files, and Direct URLs.

## Supported Features

| Source | Search | Track URL | Playlist | Album |
|--------|:------:|:---------:|:--------:|:-----:|
| YouTube | ✅ | ✅ | ✅ | — |
| Spotify | ✅ | ✅ | ✅ | ✅ |
| SoundCloud | ✅ | ✅ | ❌ | — |
| Twitch | ✅ | ✅ | — | — |
| Mixcloud | ✅ | ✅ | — | — |
| Bandcamp | ✅ | ✅ | — | ✅ |
| Direct URL | ✅ | ✅ | — | — |
| Local File | ✅ | ✅ | — | — |

## YouTube

YouTube is the primary source. All audio is streamed directly from YouTube.

```javascript
// Search
const result = await manager.search('never gonna give you up');
const result = await manager.search(query, { source: 'youtube' });

// Direct URL
const result = await manager.resolve('https://youtube.com/watch?v=dQw4w9WgXcQ');
const result = await manager.resolve('https://youtu.be/dQw4w9WgXcQ');
const result = await manager.resolve('https://music.youtube.com/watch?v=dQw4w9WgXcQ');

// Playlist
const result = await manager.loadPlaylist('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
```

### Supported URL Formats

- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/shorts/VIDEO_ID`
- `music.youtube.com/watch?v=VIDEO_ID`
- `youtube.com/playlist?list=PLAYLIST_ID`

### Cookies

For age-restricted or region-locked videos, provide YouTube cookies:

```javascript
const manager = new Streamify.Manager(client, {
    cookiesPath: './cookies.txt'
});
```

See [Configuration](./configuration.md#youtube-cookies) for setup instructions.

## Spotify

Spotify tracks are resolved to YouTube for playback. Requires API credentials.

```javascript
const manager = new Streamify.Manager(client, {
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
});
```

```javascript
// Search
const result = await manager.search('never gonna give you up', { source: 'spotify' });

// Direct URL
const result = await manager.resolve('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8');

// Playlist
const result = await manager.loadPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

// Album
const result = await manager.loadPlaylist('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv');
```

### Supported URL Formats

- `open.spotify.com/track/TRACK_ID`
- `open.spotify.com/playlist/PLAYLIST_ID`
- `open.spotify.com/album/ALBUM_ID`
- `spotify:track:TRACK_ID`

### How Resolution Works

1. Fetch track metadata from Spotify API
2. Search YouTube for `{artist} - {title}`
3. Use the first result for playback

The resolved YouTube ID is cached for 5 minutes.

## SoundCloud

SoundCloud tracks are streamed via yt-dlp.

```javascript
// Search
const result = await manager.search('never gonna give you up', { source: 'soundcloud' });

// Direct URL
const result = await manager.resolve('https://soundcloud.com/rick-astley-official/never-gonna-give-you-up');
```

### Supported URL Formats

- `soundcloud.com/USER/TRACK`

## Twitch & Mixcloud

Streaming support for live content and DJ sets.

```javascript
// Twitch Live
await manager.resolve('https://twitch.tv/monstercat');

// Mixcloud Sets
await manager.resolve('https://www.mixcloud.com/spinninrecords/spinnin-sessions-550/');
```

## Bandcamp

Support for high-quality independent music.

```javascript
await manager.resolve('https://monstercatmedia.bandcamp.com/track/the-governor');
```

## Direct URLs (HTTP)

Play raw audio files from any public URL.

```javascript
await manager.resolve('https://example.com/audio.mp3');
await manager.resolve('https://cdn.discordapp.com/attachments/.../music.ogg');
```

## Local Files

Play files directly from the host system.

```javascript
// Absolute path
await manager.resolve('/home/user/music/track.mp3');

// Relative path
await manager.resolve('./assets/sound-effect.wav');

// File URI
await manager.resolve('file:///var/lib/music/song.flac');
```

## Auto-Detection

The `resolve()` method auto-detects the source from URLs:

```javascript
// All of these work
await manager.resolve('https://youtube.com/watch?v=dQw4w9WgXcQ');
await manager.resolve('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8');
await manager.resolve('https://soundcloud.com/rick-astley-official/never-gonna-give-you-up');
await manager.resolve('https://twitch.tv/some-channel');
await manager.resolve('/path/to/local/file.mp3');
```

## Track Object

All sources return the same track structure:

```javascript
{
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    author: 'Rick Astley',
    duration: 213,           // seconds
    thumbnail: 'https://...',
    uri: 'https://...',      // Original URL
    source: 'youtube',       // youtube, spotify, soundcloud

    // Spotify only
    album: 'Whenever You Need Somebody',
    _resolvedId: 'dQw4w9WgXcQ'  // YouTube ID
}
```
