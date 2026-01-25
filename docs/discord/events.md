# Events

## Manager Events

```javascript
manager.on('playerCreate', (player) => {
    console.log(`Player created for guild ${player.guildId}`);
});

manager.on('playerDestroy', (player) => {
    console.log(`Player destroyed for guild ${player.guildId}`);
});
```

## Player Events

### Track Events

#### trackStart

Fired when a track starts playing.

```javascript
player.on('trackStart', (track) => {
    channel.send({
        embeds: [{
            title: 'Now Playing',
            description: `**${track.title}**\nby ${track.author}`,
            thumbnail: { url: track.thumbnail }
        }]
    });
});
```

#### trackEnd

Fired when a track finishes.

```javascript
player.on('trackEnd', (track, reason) => {
    // reason: 'finished' | 'skipped' | 'stopped'
    console.log(`Track ended: ${track.title} (${reason})`);
});
```

#### trackError

Fired when a track fails to play.

```javascript
player.on('trackError', (track, error) => {
    channel.send(`Failed to play **${track.title}**: ${error.message}`);
});
```

#### queueEnd

Fired when the queue is empty and playback stops.

```javascript
player.on('queueEnd', () => {
    channel.send('Queue finished. Add more songs or enable autoplay!');
});
```

### Voice Events

#### userJoin

Fired when a user joins the voice channel.

```javascript
player.on('userJoin', (member, count) => {
    console.log(`${member.user.tag} joined (${count} users now)`);
});
```

#### userLeave

Fired when a user leaves the voice channel.

```javascript
player.on('userLeave', (member, count) => {
    console.log(`${member.user.tag} left (${count} users remaining)`);
});
```

#### channelEmpty

Fired when all users leave the voice channel.

```javascript
player.on('channelEmpty', () => {
    channel.send('Everyone left. I\'ll leave in 30 seconds...');
});
```

#### channelMove

Fired when the bot is moved to a different voice channel.

```javascript
player.on('channelMove', (newChannelId) => {
    console.log(`Moved to channel ${newChannelId}`);
});
```

### Automation Events

#### autoPause

Fired when playback is automatically paused.

```javascript
player.on('autoPause', (userCount) => {
    channel.send(`Paused (${userCount} users in channel)`);
});
```

#### autoResume

Fired when playback is automatically resumed.

```javascript
player.on('autoResume', (userCount) => {
    channel.send(`Resumed (${userCount} users rejoined)`);
});
```

#### autoplayStart

Fired when autoplay starts fetching related tracks.

```javascript
player.on('autoplayStart', (lastTrack) => {
    console.log(`Finding tracks related to: ${lastTrack.title}`);
});
```

#### autoplayAdd

Fired when autoplay adds tracks to the queue.

```javascript
player.on('autoplayAdd', (tracks) => {
    channel.send(`Autoplay added ${tracks.length} tracks`);
});
```

### Lifecycle Events

#### destroy

Fired when the player is destroyed.

```javascript
player.on('destroy', () => {
    console.log('Player destroyed');
});
```

## Example: Full Event Setup

```javascript
function setupPlayerEvents(player, textChannel) {
    player.on('trackStart', (track) => {
        const embed = {
            color: 0x00ff00,
            title: track.isAutoplay ? 'Autoplay' : 'Now Playing',
            description: `**${track.title}**\nby ${track.author}`,
            thumbnail: { url: track.thumbnail }
        };
        textChannel.send({ embeds: [embed] });
    });

    player.on('trackError', (track, error) => {
        textChannel.send(`Failed to play **${track.title}**: ${error.message}`);
    });

    player.on('queueEnd', () => {
        if (!player.autoplay.enabled) {
            textChannel.send('Queue ended. Use `!autoplay` to keep the music going!');
        }
    });

    player.on('channelEmpty', () => {
        textChannel.send('Channel empty. Leaving in 30 seconds...');
    });

    player.on('autoPause', () => {
        textChannel.send('Paused - everyone left the channel.');
    });

    player.on('autoResume', () => {
        textChannel.send('Resumed - welcome back!');
    });

    player.on('destroy', () => {
        textChannel.send('Disconnected.');
    });
}

// Usage
const player = await manager.create(guildId, vcId, tcId);
setupPlayerEvents(player, textChannel);
```
