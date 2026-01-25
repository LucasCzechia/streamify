# Player

The Player handles playback, filters, and voice connection for a single guild.

## Getting a Player

```javascript
// Create new or get existing
const player = await manager.create(guildId, voiceChannelId, textChannelId);

// Get existing only
const player = manager.get(guildId);
```

## Playback Methods

### play(track)

Plays a track immediately. If something is playing, adds to queue and skips.

```javascript
const result = await manager.search('never gonna give you up');
await player.play(result.tracks[0]);
```

### pause()

Pauses playback and destroys the stream to save resources.

```javascript
player.pause();
```

### resume()

Resumes playback by recreating the stream and seeking to the saved position.

```javascript
await player.resume();
```

### skip()

Skips to the next track in queue.

```javascript
await player.skip();
```

### previous()

Goes back to the previous track.

```javascript
await player.previous();
```

### stop()

Stops playback and clears the queue.

```javascript
player.stop();
```

### seek(positionMs)

Seeks to a position in milliseconds.

```javascript
await player.seek(30000);  // Seek to 30 seconds
```

## Volume

```javascript
// Set volume (0-200)
player.setVolume(80);

// Get current volume
console.log(player.volume);  // 80
```

## Filters

```javascript
// Set a filter
await player.setFilter('bass', 10);
await player.setFilter('nightcore', true);

// Clear all filters
await player.clearFilters();

// Get current filters
console.log(player.filters);  // { bass: 10, nightcore: true }
```

See [Filters](../filters.md) for all available filters.

## Loop Modes

```javascript
player.setLoop('off');     // No looping
player.setLoop('track');   // Loop current track
player.setLoop('queue');   // Loop entire queue
```

## Toggles

```javascript
// Autoplay (play related tracks when queue ends)
player.setAutoplay(true);
player.setAutoplay(false);

// Auto-pause (pause when channel empty)
player.setAutoPause(true);
player.setAutoPause(false);
```

## Connection

```javascript
// Connect to voice
await player.connect();

// Disconnect (keeps player)
player.disconnect();

// Destroy player completely
player.destroy();
```

## State Properties

```javascript
player.connected    // true if connected to voice
player.playing      // true if playing (not paused)
player.paused       // true if paused
player.position     // Current position in ms
player.volume       // Current volume (0-200)
player.filters      // Current filters object

player.guildId          // Guild ID
player.voiceChannelId   // Voice channel ID
player.textChannelId    // Text channel ID

player.autoplay     // { enabled, maxTracks }
player.autoPause    // { enabled, minUsers }
player.autoLeave    // { enabled, emptyDelay, inactivityTimeout }
```

## Queue Access

```javascript
player.queue.current   // Currently playing track
player.queue.tracks    // Upcoming tracks
player.queue.previous  // Previously played tracks
```

See [Queue](./queue.md) for queue methods.

## Serialization

```javascript
const json = player.toJSON();
// {
//     guildId: '...',
//     voiceChannelId: '...',
//     connected: true,
//     playing: true,
//     paused: false,
//     volume: 80,
//     position: 45000,
//     filters: { bass: 10 },
//     queue: { current: {...}, tracks: [...] },
//     autoplay: { enabled: false },
//     autoPause: { enabled: true },
//     autoLeave: { enabled: true }
// }
```
