# Basic Discord Bot

A simple music bot with play, skip, and stop commands.

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
    ffmpegPath: '/usr/bin/ffmpeg',
    cookiesPath: './cookies.txt',
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    },
    defaultVolume: 80
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const [command, ...args] = message.content.slice(1).split(' ');
    const query = args.join(' ');

    const player = manager.get(message.guild.id);

    switch (command) {
        case 'play':
        case 'p': {
            if (!query) {
                return message.reply('Please provide a search query or URL.');
            }

            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                return message.reply('You need to be in a voice channel.');
            }

            try {
                const result = await manager.resolve(query);

                if (!result.tracks.length) {
                    return message.reply('No results found.');
                }

                const track = result.tracks[0];
                track.requestedBy = message.author;

                let p = player;
                if (!p) {
                    p = await manager.create(
                        message.guild.id,
                        voiceChannel.id,
                        message.channel.id
                    );
                    setupEvents(p, message.channel);
                }

                await p.play(track);
            } catch (error) {
                console.error(error);
                message.reply(`Error: ${error.message}`);
            }
            break;
        }

        case 'skip':
        case 's': {
            if (!player?.playing) {
                return message.reply('Nothing is playing.');
            }
            await player.skip();
            message.react('⏭️');
            break;
        }

        case 'stop': {
            if (!player) {
                return message.reply('No active player.');
            }
            player.stop();
            message.react('⏹️');
            break;
        }

        case 'pause': {
            if (!player?.playing) {
                return message.reply('Nothing is playing.');
            }
            player.pause();
            message.react('⏸️');
            break;
        }

        case 'resume': {
            if (!player?.paused) {
                return message.reply('Not paused.');
            }
            await player.resume();
            message.react('▶️');
            break;
        }

        case 'leave':
        case 'disconnect':
        case 'dc': {
            if (!player) {
                return message.reply('Not in a voice channel.');
            }
            player.destroy();
            message.react('👋');
            break;
        }

        case 'np':
        case 'nowplaying': {
            if (!player?.queue.current) {
                return message.reply('Nothing is playing.');
            }
            const track = player.queue.current;
            const position = Math.floor(player.position / 1000);
            message.reply(`Now playing: **${track.title}** [${position}s / ${track.duration}s]`);
            break;
        }
    }
});

function setupEvents(player, channel) {
    player.on('trackStart', (track) => {
        channel.send(`🎵 Now playing: **${track.title}**`);
    });

    player.on('trackError', (track, error) => {
        channel.send(`❌ Error playing **${track.title}**: ${error.message}`);
    });

    player.on('queueEnd', () => {
        channel.send('📭 Queue finished.');
    });
}

client.login(process.env.DISCORD_TOKEN);
```

## Running

```bash
# Set environment variables
export DISCORD_TOKEN=your_token
export SPOTIFY_CLIENT_ID=your_id
export SPOTIFY_CLIENT_SECRET=your_secret

# Run
node bot.js
```

## Commands

| Command | Description |
|---------|-------------|
| `!play <query>` | Play a song |
| `!skip` | Skip current song |
| `!stop` | Stop and clear queue |
| `!pause` | Pause playback |
| `!resume` | Resume playback |
| `!leave` | Disconnect |
| `!np` | Now playing |
