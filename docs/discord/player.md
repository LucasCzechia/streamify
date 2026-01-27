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

### play(track, options?)

Plays a track immediately. If something is playing, adds to queue and skips.

```javascript
const result = await manager.search('never gonna give you up');
await player.play(result.tracks[0]);
```

**Options:**
- `startPosition` - Start playback at a specific position in milliseconds
- `volume` - Set volume before playing (0-200)
- `filters` - Apply filters before playing
- `replace` - Replace current track without adding to queue/history

```javascript
// Start playing at 30 seconds
await player.play(track, { startPosition: 30000 });

// Start with specific volume
await player.play(track, { volume: 50 });

// Start with filters applied
await player.play(track, { filters: { bass: 10, nightcore: true } });

// Replace current track without queueing
await player.play(track, { replace: true });

// Combine options
await player.play(track, {
    startPosition: savedPositionMs,
    volume: savedVolume,
    filters: savedFilters,
    replace: true
});
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

## Effect Presets

Effect presets are pre-configured filter combinations that stack by default.

```javascript
// Apply a single preset
await player.setEffectPresets(['bassboost']);

// Apply multiple presets (they stack)
await player.setEffectPresets(['nightcore', 'bassboost']);

// Apply with custom intensity (0.1 - 1.0)
await player.setEffectPresets([
    { name: 'nightcore', intensity: 0.8 },
    { name: 'bassboost', intensity: 0.5 }
]);

// Replace all presets instead of stacking
await player.setEffectPresets(['8d'], { replace: true });

// Get active presets
const active = player.getActiveEffectPresets();
// [{ name: 'nightcore', intensity: 0.8 }, { name: 'bassboost', intensity: 0.5 }]

// Clear all effect presets
await player.clearEffectPresets();

// List available presets
const presets = player.getEffectPresets();
// ['bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke', ...]
```

**Available Presets:**
- `bassboost` - Boost bass frequencies
- `nightcore` - Speed up with higher pitch
- `vaporwave` - Slow down with lower pitch
- `8d` - 8D rotating audio effect
- `karaoke` - Reduce vocals
- `reverb` - Add room acoustics / echo
- `surround` - Virtual surround sound mapping
- `boost` - General volume and clarity boost
- `subboost` - Extreme sub-woofer boost
- `trebleboost` - Boost treble frequencies
- `deep` - Deep bass with lower pitch
- `lofi` - Lo-fi aesthetic
- `radio` - Radio/telephone effect
- `telephone` - Old telephone effect
- `soft` - Softer, quieter sound
- `loud` - Louder, compressed sound
- `chipmunk` - High-pitched voice
- `darth` - Deep Darth Vader voice
- `echo` - Echo/reverb effect
- `vibrato` - Vibrato effect
- `tremolo` - Tremolo effect

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
