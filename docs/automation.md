# Automation

Streamify includes built-in automation features for common scenarios.

## Auto-Pause

Automatically pauses playback when users leave the voice channel and resumes when they return.

### Configuration

```javascript
const manager = new Streamify.Manager(client, {
    autoPause: {
        enabled: true,
        minUsers: 1    // Pause when users drop below this
    }
});
```

### Behavior

1. User count drops below `minUsers`
2. Playback pauses immediately
3. Stream is destroyed (saves resources)
4. Position is saved
5. When users rejoin and count reaches `minUsers`:
6. Stream recreates with seek
7. Playback resumes

### Events

```javascript
player.on('autoPause', (userCount) => {
    channel.send(`Paused (${userCount} users in channel)`);
});

player.on('autoResume', (userCount) => {
    channel.send(`Resumed (${userCount} users now)`);
});
```

### Runtime Toggle

```javascript
player.setAutoPause(false);  // Disable
player.setAutoPause(true);   // Enable
```

## Auto-Leave

Automatically leaves the voice channel after a period of inactivity.

### Configuration

```javascript
const manager = new Streamify.Manager(client, {
    autoLeave: {
        enabled: true,
        emptyDelay: 30000,         // Leave 30s after channel empty
        inactivityTimeout: 300000  // Leave after 5min of not playing
    }
});
```

### Behavior

**Empty Channel:**
1. All users leave
2. 30 second countdown starts
3. If no one rejoins, player destroys

**Inactivity:**
1. Queue ends, nothing playing
2. 5 minute countdown starts
3. If nothing plays, player destroys

### Events

```javascript
player.on('channelEmpty', () => {
    channel.send('Everyone left. Leaving in 30 seconds...');
});

player.on('destroy', () => {
    channel.send('Disconnected due to inactivity.');
});
```

## Autoplay

Automatically plays related tracks when the queue ends.

### Configuration

```javascript
const manager = new Streamify.Manager(client, {
    autoplay: {
        enabled: false,   // Off by default
        maxTracks: 5      // How many related tracks to fetch
    }
});
```

### Behavior

1. Queue ends (last track finishes)
2. Fetch related tracks from YouTube Mix or Spotify Recommendations
3. Add to queue and start playing
4. Repeat when those tracks end

### Events

```javascript
player.on('autoplayStart', (lastTrack) => {
    console.log(`Finding tracks like: ${lastTrack.title}`);
});

player.on('autoplayAdd', (tracks) => {
    channel.send(`Autoplay added ${tracks.length} tracks`);
});
```

### Runtime Toggle

```javascript
player.setAutoplay(true);   // Enable
player.setAutoplay(false);  // Disable
```

### Track Identification

Autoplay tracks are marked:

```javascript
player.on('trackStart', (track) => {
    if (track.isAutoplay) {
        channel.send(`Autoplay: **${track.title}**`);
    } else {
        channel.send(`Now playing: **${track.title}**`);
    }
});
```

## Combining Features

All automation features work together:

```javascript
const manager = new Streamify.Manager(client, {
    autoPause: {
        enabled: true,
        minUsers: 1
    },
    autoLeave: {
        enabled: true,
        emptyDelay: 30000,
        inactivityTimeout: 300000
    },
    autoplay: {
        enabled: true,
        maxTracks: 5
    }
});
```

**Scenario: User leaves during playback**
1. `autoPause` triggers → pauses playback
2. `autoLeave` starts 30s countdown
3. User rejoins within 30s
4. `autoResume` triggers → playback continues
5. Countdown cancelled

**Scenario: Queue ends**
1. `autoplay` fetches related tracks
2. Playback continues with recommendations
3. If autoplay disabled, `autoLeave` inactivity timeout starts

## Disabling All Automation

```javascript
const manager = new Streamify.Manager(client, {
    autoPause: { enabled: false },
    autoLeave: { enabled: false },
    autoplay: { enabled: false }
});
```
