# Advanced Discord Bot

A full-featured music bot with queue management, filters, and automation.

```javascript
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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
    defaultVolume: 80,
    sponsorblock: {
        enabled: true,
        categories: ['sponsor', 'selfpromo']
    },
    autoLeave: {
        enabled: true,
        emptyDelay: 30000,
        inactivityTimeout: 300000
    },
    autoPause: {
        enabled: true,
        minUsers: 1
    },
    autoplay: {
        enabled: false,
        maxTracks: 5
    }
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const [command, ...args] = message.content.slice(1).split(' ');
    const query = args.join(' ');

    let player = manager.get(message.guild.id);

    switch (command) {
        case 'play':
        case 'p': {
            if (!query) return message.reply('Provide a search query or URL.');

            const vc = message.member.voice.channel;
            if (!vc) return message.reply('Join a voice channel first.');

            await message.react('🔍');

            try {
                // Check if playlist
                const isPlaylist = query.includes('playlist') || query.includes('/album/');

                if (isPlaylist) {
                    const result = await manager.loadPlaylist(query);
                    if (result.loadType === 'error') {
                        await message.reactions.removeAll();
                        return message.reply(`Failed: ${result.error}`);
                    }

                    if (!player) {
                        player = await manager.create(message.guild.id, vc.id, message.channel.id);
                        setupEvents(player, message.channel);
                    }

                    const tracks = result.tracks;
                    const first = tracks.shift();
                    first.requestedBy = message.author;

                    if (tracks.length > 0) {
                        tracks.forEach(t => t.requestedBy = message.author);
                        player.queue.addMany(tracks);
                    }

                    await message.reactions.removeAll();
                    message.reply(`📋 Loaded **${result.playlist.title}** (${tracks.length + 1} tracks)`);
                    await player.play(first);
                    return;
                }

                // Single track
                const result = await manager.resolve(query);
                if (!result.tracks.length) {
                    await message.reactions.removeAll();
                    return message.reply('No results found.');
                }

                const track = result.tracks[0];
                track.requestedBy = message.author;

                if (!player) {
                    player = await manager.create(message.guild.id, vc.id, message.channel.id);
                    setupEvents(player, message.channel);
                }

                await message.reactions.removeAll();
                await player.play(track);

            } catch (error) {
                await message.reactions.removeAll();
                message.reply(`Error: ${error.message}`);
            }
            break;
        }

        case 'add':
        case 'a': {
            if (!player) return message.reply('No active player.');
            if (!query) return message.reply('Provide a search query.');

            const result = await manager.search(query);
            if (!result.tracks.length) return message.reply('No results.');

            const track = result.tracks[0];
            track.requestedBy = message.author;
            player.queue.add(track);

            message.reply(`Added **${track.title}** to queue (#${player.queue.size})`);
            break;
        }

        case 'skip':
        case 's': {
            if (!player?.playing) return message.reply('Nothing playing.');
            await player.skip();
            message.react('⏭️');
            break;
        }

        case 'prev':
        case 'previous': {
            if (!player) return message.reply('No player.');
            const prev = await player.previous();
            if (prev) message.react('⏮️');
            else message.reply('No previous track.');
            break;
        }

        case 'stop': {
            if (!player) return message.reply('No player.');
            player.stop();
            message.react('⏹️');
            break;
        }

        case 'pause': {
            if (!player?.playing) return message.reply('Nothing playing.');
            player.pause();
            message.react('⏸️');
            break;
        }

        case 'resume': {
            if (!player?.paused) return message.reply('Not paused.');
            await player.resume();
            message.react('▶️');
            break;
        }

        case 'seek': {
            if (!player?.playing) return message.reply('Nothing playing.');
            const seconds = parseInt(query);
            if (isNaN(seconds)) return message.reply('Provide seconds.');
            await player.seek(seconds * 1000);
            message.reply(`Seeked to ${seconds}s`);
            break;
        }

        case 'queue':
        case 'q': {
            if (!player) return message.reply('No player.');

            const { current, tracks } = player.queue;
            let desc = current
                ? `**Now Playing:** ${current.title}\n\n`
                : 'Nothing playing.\n\n';

            if (tracks.length > 0) {
                desc += '**Up Next:**\n';
                desc += tracks.slice(0, 10).map((t, i) =>
                    `${i + 1}. ${t.title}${t.isAutoplay ? ' 📻' : ''}`
                ).join('\n');
                if (tracks.length > 10) {
                    desc += `\n... and ${tracks.length - 10} more`;
                }
            } else {
                desc += 'Queue is empty.';
            }

            message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Queue')
                    .setDescription(desc)
                    .setFooter({ text: `Loop: ${player.queue.repeatMode} | Autoplay: ${player.autoplay.enabled ? 'on' : 'off'}` })
                ]
            });
            break;
        }

        case 'shuffle': {
            if (!player) return message.reply('No player.');
            player.queue.shuffle();
            message.react('🔀');
            break;
        }

        case 'loop': {
            if (!player) return message.reply('No player.');
            const modes = ['off', 'track', 'queue'];
            const current = modes.indexOf(player.queue.repeatMode);
            const next = modes[(current + 1) % 3];
            player.setLoop(next);
            message.reply(`Loop: **${next}**`);
            break;
        }

        case 'autoplay':
        case 'ap': {
            if (!player) return message.reply('No player.');
            const enabled = player.setAutoplay(!player.autoplay.enabled);
            message.reply(`Autoplay: **${enabled ? 'on' : 'off'}**`);
            break;
        }

        case 'vol':
        case 'volume': {
            if (!player) return message.reply('No player.');
            const vol = parseInt(query);
            if (isNaN(vol)) return message.reply(`Volume: ${player.volume}%`);
            player.setVolume(vol);
            message.react('🔊');
            break;
        }

        case 'bass': {
            if (!player) return message.reply('No player.');
            await player.setFilter('bass', parseInt(query) || 10);
            message.reply(`Bass: ${parseInt(query) || 10}`);
            break;
        }

        case 'nightcore':
        case 'nc': {
            if (!player) return message.reply('No player.');
            await player.setFilter('nightcore', true);
            message.reply('Nightcore enabled');
            break;
        }

        case 'vaporwave':
        case 'vw': {
            if (!player) return message.reply('No player.');
            await player.setFilter('vaporwave', true);
            message.reply('Vaporwave enabled');
            break;
        }

        case '8d': {
            if (!player) return message.reply('No player.');
            await player.setFilter('8d', true);
            message.reply('8D enabled');
            break;
        }

        case 'karaoke': {
            if (!player) return message.reply('No player.');
            await player.setFilter('karaoke', true);
            message.reply('Karaoke enabled');
            break;
        }

        case 'clearfilters':
        case 'cf': {
            if (!player) return message.reply('No player.');
            await player.clearFilters();
            message.reply('Filters cleared');
            break;
        }

        case 'np':
        case 'nowplaying': {
            if (!player?.queue.current) return message.reply('Nothing playing.');
            const t = player.queue.current;
            const pos = Math.floor(player.position / 1000);
            const filters = Object.keys(player.filters).filter(k => player.filters[k] && k !== 'volume');

            message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(t.isAutoplay ? '📻 Autoplay' : '▶️ Now Playing')
                    .setDescription(`**${t.title}**\nby ${t.author}`)
                    .setThumbnail(t.thumbnail)
                    .addFields(
                        { name: 'Position', value: `${pos}s / ${t.duration}s`, inline: true },
                        { name: 'Volume', value: `${player.volume}%`, inline: true },
                        { name: 'Filters', value: filters.length ? filters.join(', ') : 'none', inline: true }
                    )
                ]
            });
            break;
        }

        case 'leave':
        case 'dc': {
            if (!player) return message.reply('Not connected.');
            player.destroy();
            message.react('👋');
            break;
        }
    }
});

function setupEvents(player, channel) {
    player.on('trackStart', (track) => {
        channel.send({
            embeds: [new EmbedBuilder()
                .setColor(track.isAutoplay ? 0x9b59b6 : 0x00ff00)
                .setTitle(track.isAutoplay ? '📻 Autoplay' : '▶️ Now Playing')
                .setDescription(`**${track.title}**\nby ${track.author}`)
                .setThumbnail(track.thumbnail)
                .setFooter({ text: track.requestedBy ? `Requested by ${track.requestedBy.tag}` : '' })
            ]
        });
    });

    player.on('trackError', (track, error) => {
        channel.send(`❌ Error: ${error.message}`);
    });

    player.on('queueEnd', () => {
        channel.send('📭 Queue ended.');
    });

    player.on('channelEmpty', () => {
        channel.send('⚠️ Channel empty, leaving in 30s...');
    });

    player.on('autoPause', () => {
        channel.send('⏸️ Auto-paused (empty channel)');
    });

    player.on('autoResume', () => {
        channel.send('▶️ Resumed');
    });
}

client.login(process.env.DISCORD_TOKEN);
```

## Commands

| Command | Description |
|---------|-------------|
| `!play <query>` | Play song or playlist |
| `!add <query>` | Add to queue |
| `!skip` | Skip |
| `!prev` | Previous track |
| `!stop` | Stop |
| `!pause` / `!resume` | Pause/Resume |
| `!seek <seconds>` | Seek |
| `!queue` | View queue |
| `!shuffle` | Shuffle |
| `!loop` | Toggle loop |
| `!autoplay` | Toggle autoplay |
| `!vol <0-200>` | Volume |
| `!bass <-20 to 20>` | Bass filter |
| `!nightcore` | Nightcore |
| `!vaporwave` | Vaporwave |
| `!8d` | 8D audio |
| `!karaoke` | Karaoke |
| `!clearfilters` | Clear filters |
| `!np` | Now playing |
| `!leave` | Disconnect |
