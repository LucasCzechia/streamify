# Queue

The Queue manages tracks for a player.

## Accessing the Queue

```javascript
const player = manager.get(guildId);
const queue = player.queue;
```

## Properties

```javascript
queue.current      // Currently playing track (or null)
queue.tracks       // Array of upcoming tracks
queue.previous     // Array of previously played tracks
queue.size         // Number of upcoming tracks
queue.isEmpty      // true if no upcoming tracks
queue.totalDuration // Total duration in ms (current + upcoming)
queue.repeatMode   // 'off', 'track', or 'queue'
```

## Adding Tracks

### add(track, position?)

Add a single track.

```javascript
// Add to end
queue.add(track);

// Add at specific position
queue.add(track, 0);  // Next up
queue.add(track, 2);  // Third in queue
```

### addMany(tracks, position?)

Add multiple tracks.

```javascript
// Add to end
queue.addMany(tracks);

// Add at position
queue.addMany(tracks, 0);
```

## Removing Tracks

### remove(index)

Remove a track by index.

```javascript
const removed = queue.remove(0);  // Remove next track
console.log(removed.title);
```

### clear()

Clear all upcoming tracks.

```javascript
const count = queue.clear();
console.log(`Cleared ${count} tracks`);
```

## Reordering

### shuffle()

Randomize track order.

```javascript
queue.shuffle();
```

### move(from, to)

Move a track to a different position.

```javascript
queue.move(5, 0);  // Move track 5 to next up
queue.move(0, 3);  // Move next track to position 3
```

## Loop Mode

```javascript
queue.setRepeatMode('off');    // No looping
queue.setRepeatMode('track');  // Repeat current track
queue.setRepeatMode('queue');  // Repeat entire queue
```

Or use the player shorthand:

```javascript
player.setLoop('queue');
```

## Internal Methods

These are used internally by the Player:

### shift()

Moves current to previous, gets next track as current.

```javascript
const next = queue.shift();  // Returns next track or null
```

### unshift()

Goes back to previous track.

```javascript
const prev = queue.unshift();  // Returns previous track or null
```

### setCurrent(track)

Sets the current track directly.

```javascript
queue.setCurrent(track);
```

## Example: Queue Display

```javascript
function displayQueue(player) {
    const { current, tracks } = player.queue;

    let text = '';

    if (current) {
        text += `**Now Playing:** ${current.title}\n\n`;
    }

    if (tracks.length > 0) {
        text += '**Up Next:**\n';
        tracks.slice(0, 10).forEach((track, i) => {
            text += `${i + 1}. ${track.title}\n`;
        });
        if (tracks.length > 10) {
            text += `... and ${tracks.length - 10} more`;
        }
    } else {
        text += 'Queue is empty.';
    }

    return text;
}
```

## Example: Playlist Loading

```javascript
async function loadPlaylist(player, url) {
    const result = await manager.loadPlaylist(url);

    if (result.loadType === 'error') {
        throw new Error(result.error);
    }

    const tracks = result.tracks;

    if (player.queue.current) {
        // Add all to queue
        player.queue.addMany(tracks);
        return `Added ${tracks.length} tracks to queue`;
    } else {
        // Play first, queue rest
        const first = tracks.shift();
        player.queue.addMany(tracks);
        await player.play(first);
        return `Playing **${result.playlist.title}** (${tracks.length + 1} tracks)`;
    }
}
```

## Serialization

```javascript
const json = queue.toJSON();
// {
//     current: { id, title, ... },
//     tracks: [...],
//     previous: [...],
//     repeatMode: 'off',
//     size: 5
// }
```
