const { EventEmitter } = require('events');
const Player = require('./Player');
const youtube = require('../providers/youtube');
const spotify = require('../providers/spotify');
const soundcloud = require('../providers/soundcloud');
const log = require('../utils/logger');
const { loadConfig } = require('../config');

class Manager extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.players = new Map();

        this.config = loadConfig({
            ytdlpPath: options.ytdlpPath,
            ffmpegPath: options.ffmpegPath,
            cookiesPath: options.cookiesPath,
            providers: options.providers,
            spotify: options.spotify,
            audio: options.audio,
            defaultVolume: options.defaultVolume || 80,
            sponsorblock: options.sponsorblock
        });

        this.defaultVolume = options.defaultVolume || 80;
        this.maxPreviousTracks = options.maxPreviousTracks || 25;

        this.autoLeave = {
            enabled: options.autoLeave?.enabled ?? true,
            emptyDelay: options.autoLeave?.emptyDelay ?? 30000,
            inactivityTimeout: options.autoLeave?.inactivityTimeout ?? 300000
        };

        this.autoPause = {
            enabled: options.autoPause?.enabled ?? true,
            minUsers: options.autoPause?.minUsers ?? 1
        };

        this.autoplay = {
            enabled: options.autoplay?.enabled ?? false,
            maxTracks: options.autoplay?.maxTracks ?? 5
        };

        this._setupVoiceStateListener();

        log.info('MANAGER', 'Streamify Manager initialized');
    }

    _setupVoiceStateListener() {
        this.client.on('voiceStateUpdate', (oldState, newState) => {
            const player = this.players.get(oldState.guild.id) || this.players.get(newState.guild.id);
            if (!player) return;

            const botId = this.client.user.id;

            if (oldState.id === botId && !newState.channelId) {
                player.destroy();
                return;
            }

            if (oldState.id === botId && newState.channelId && oldState.channelId !== newState.channelId) {
                player.voiceChannelId = newState.channelId;
                player.emit('channelMove', newState.channelId);
                return;
            }

            if (oldState.channelId === player.voiceChannelId || newState.channelId === player.voiceChannelId) {
                const channel = this.client.channels.cache.get(player.voiceChannelId);
                if (!channel) return;

                const members = channel.members.filter(m => !m.user.bot);
                const memberCount = members.size;

                if (oldState.channelId === player.voiceChannelId && newState.channelId !== player.voiceChannelId) {
                    player.emit('userLeave', oldState.member, memberCount);
                }

                if (newState.channelId === player.voiceChannelId && oldState.channelId !== player.voiceChannelId) {
                    player.emit('userJoin', newState.member, memberCount);
                }

                if (memberCount < player.autoPause.minUsers) {
                    if (memberCount === 0) {
                        player.emit('channelEmpty');
                    }

                    if (player.autoPause.enabled && player.playing && !player._autoPaused) {
                        player._autoPaused = true;
                        player.pause();
                        player.emit('autoPause', memberCount);
                        log.info('PLAYER', `Auto-paused (${memberCount} users in channel)`);
                    }

                    if (this.autoLeave.enabled) {
                        player._startEmptyTimeout();
                    }
                } else {
                    player._cancelEmptyTimeout();

                    if (player.autoPause.enabled && player._autoPaused && player.paused) {
                        player._autoPaused = false;
                        player.resume().then(success => {
                            if (success) {
                                player.emit('autoResume', memberCount);
                                log.info('PLAYER', `Auto-resumed (${memberCount} users in channel)`);
                            }
                        }).catch(err => {
                            log.error('PLAYER', `Auto-resume failed: ${err.message}`);
                        });
                    }
                }
            }
        });
    }

    async create(guildId, voiceChannelId, textChannelId) {
        if (this.players.has(guildId)) {
            const existing = this.players.get(guildId);
            if (existing.voiceChannelId !== voiceChannelId) {
                existing.voiceChannelId = voiceChannelId;
                if (existing.connected) {
                    existing.disconnect();
                }
            }
            return existing;
        }

        const player = new Player(this, {
            guildId,
            voiceChannelId,
            textChannelId,
            volume: this.defaultVolume,
            maxPreviousTracks: this.maxPreviousTracks,
            autoLeave: this.autoLeave,
            autoPause: this.autoPause,
            autoplay: this.autoplay
        });

        player.on('destroy', () => {
            this.players.delete(guildId);
            this.emit('playerDestroy', player);
        });

        this.players.set(guildId, player);
        this.emit('playerCreate', player);

        log.info('MANAGER', `Created player for guild ${guildId}`);
        return player;
    }

    get(guildId) {
        return this.players.get(guildId);
    }

    destroy(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.destroy();
            return true;
        }
        return false;
    }

    _isProviderEnabled(provider) {
        return this.config.providers?.[provider]?.enabled !== false;
    }

    async search(query, options = {}) {
        const source = options.source || this._detectSource(query) || 'youtube';
        const limit = options.limit || 10;

        log.info('MANAGER', `Search: "${query}" (source: ${source}, limit: ${limit})`);

        try {
            let result;

            switch (source) {
                case 'youtube':
                case 'yt':
                    if (!this._isProviderEnabled('youtube')) {
                        throw new Error('YouTube provider is disabled');
                    }
                    result = await youtube.search(query, limit, this.config);
                    break;

                case 'spotify':
                case 'sp':
                    if (!this._isProviderEnabled('spotify')) {
                        throw new Error('Spotify provider is disabled');
                    }
                    if (!this.config.spotify?.clientId) {
                        throw new Error('Spotify credentials not configured');
                    }
                    result = await spotify.search(query, limit, this.config);
                    break;

                case 'soundcloud':
                case 'sc':
                    if (!this._isProviderEnabled('soundcloud')) {
                        throw new Error('SoundCloud provider is disabled');
                    }
                    result = await soundcloud.search(query, limit, this.config);
                    break;

                default:
                    if (!this._isProviderEnabled('youtube')) {
                        throw new Error('YouTube provider is disabled');
                    }
                    result = await youtube.search(query, limit, this.config);
            }

            return {
                loadType: result.tracks.length > 0 ? 'search' : 'empty',
                tracks: result.tracks,
                source: result.source
            };
        } catch (error) {
            log.error('MANAGER', `Search error: ${error.message}`);
            return {
                loadType: 'error',
                tracks: [],
                error: error.message
            };
        }
    }

    async getInfo(id, source = 'youtube') {
        try {
            switch (source) {
                case 'youtube':
                case 'yt':
                    if (!this._isProviderEnabled('youtube')) {
                        throw new Error('YouTube provider is disabled');
                    }
                    return await youtube.getInfo(id, this.config);

                case 'spotify':
                case 'sp':
                    if (!this._isProviderEnabled('spotify')) {
                        throw new Error('Spotify provider is disabled');
                    }
                    return await spotify.getInfo(id, this.config);

                case 'soundcloud':
                case 'sc':
                    if (!this._isProviderEnabled('soundcloud')) {
                        throw new Error('SoundCloud provider is disabled');
                    }
                    return await soundcloud.getInfo(id, this.config);

                default:
                    if (!this._isProviderEnabled('youtube')) {
                        throw new Error('YouTube provider is disabled');
                    }
                    return await youtube.getInfo(id, this.config);
            }
        } catch (error) {
            log.error('MANAGER', `GetInfo error: ${error.message}`);
            throw error;
        }
    }

    async resolve(query) {
        const detected = this._detectSource(query);

        if (detected) {
            const match = this._extractId(query, detected);
            if (match) {
                try {
                    const track = await this.getInfo(match.id, detected);
                    if (detected === 'spotify') {
                        track._resolvedId = await this._resolveSpotifyToYouTube(track);
                    }
                    return {
                        loadType: 'track',
                        tracks: [track]
                    };
                } catch (error) {
                    log.error('MANAGER', `Resolve error: ${error.message}`);
                }
            }
        }

        return this.search(query);
    }

    async _resolveSpotifyToYouTube(track) {
        const videoId = await spotify.resolveToYouTube(track.id, this.config);
        return videoId;
    }

    _detectSource(input) {
        if (!input || typeof input !== 'string') return null;

        if (/youtube\.com\/playlist\?list=/.test(input)) return 'youtube_playlist';
        if (/open\.spotify\.com\/playlist\//.test(input)) return 'spotify_playlist';
        if (/open\.spotify\.com\/album\//.test(input)) return 'spotify_album';

        const patterns = {
            youtube: [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
                /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
            ],
            spotify: [
                /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
                /spotify:track:([a-zA-Z0-9]+)/
            ],
            soundcloud: [
                /soundcloud\.com\/([^\/]+\/[^\/\?]+)/,
                /api\.soundcloud\.com\/tracks\/(\d+)/
            ]
        };

        for (const [source, regexes] of Object.entries(patterns)) {
            for (const regex of regexes) {
                if (regex.test(input)) {
                    return source;
                }
            }
        }

        return null;
    }

    _extractId(input, source) {
        const patterns = {
            youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            youtube_playlist: /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
            spotify: /(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/,
            spotify_playlist: /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
            spotify_album: /open\.spotify\.com\/album\/([a-zA-Z0-9]+)/,
            soundcloud: /soundcloud\.com\/([^\/]+\/[^\/\?]+)|api\.soundcloud\.com\/tracks\/(\d+)/
        };

        const pattern = patterns[source];
        if (!pattern) return null;

        const match = input.match(pattern);
        if (!match) return null;

        return {
            source,
            id: match[1] || match[2]
        };
    }

    async loadPlaylist(url) {
        const detected = this._detectSource(url);
        if (!detected) {
            throw new Error('Invalid playlist URL');
        }

        const match = this._extractId(url, detected);
        if (!match) {
            throw new Error('Could not extract playlist ID');
        }

        log.info('MANAGER', `Loading playlist: ${match.id} (source: ${detected})`);

        try {
            let playlist;

            switch (detected) {
                case 'youtube_playlist':
                    if (!this._isProviderEnabled('youtube')) {
                        throw new Error('YouTube provider is disabled');
                    }
                    playlist = await youtube.getPlaylist(match.id, this.config);
                    break;

                case 'spotify_playlist':
                    if (!this._isProviderEnabled('spotify')) {
                        throw new Error('Spotify provider is disabled');
                    }
                    if (!this.config.spotify?.clientId) {
                        throw new Error('Spotify credentials not configured');
                    }
                    playlist = await spotify.getPlaylist(match.id, this.config);
                    break;

                case 'spotify_album':
                    if (!this._isProviderEnabled('spotify')) {
                        throw new Error('Spotify provider is disabled');
                    }
                    if (!this.config.spotify?.clientId) {
                        throw new Error('Spotify credentials not configured');
                    }
                    playlist = await spotify.getAlbum(match.id, this.config);
                    break;

                default:
                    throw new Error('URL is not a playlist');
            }

            return {
                loadType: 'playlist',
                playlist: {
                    id: playlist.id,
                    title: playlist.title,
                    author: playlist.author,
                    thumbnail: playlist.thumbnail,
                    source: playlist.source
                },
                tracks: playlist.tracks
            };
        } catch (error) {
            log.error('MANAGER', `Playlist load error: ${error.message}`);
            return {
                loadType: 'error',
                tracks: [],
                error: error.message
            };
        }
    }

    async getRelated(track, limit = 5) {
        log.info('MANAGER', `Getting related tracks for: ${track.title}`);

        try {
            if (track.source === 'spotify') {
                const result = await spotify.getRecommendations(track.id, limit, this.config);
                return result;
            } else {
                const videoId = track._resolvedId || track.id;
                const result = await youtube.getRelated(videoId, limit, this.config);
                return result;
            }
        } catch (error) {
            log.error('MANAGER', `Get related error: ${error.message}`);
            return { tracks: [] };
        }
    }

    destroyAll() {
        for (const [guildId, player] of this.players) {
            player.destroy();
        }
        this.players.clear();
        log.info('MANAGER', 'All players destroyed');
    }

    getStats() {
        return {
            players: this.players.size,
            playingPlayers: Array.from(this.players.values()).filter(p => p.playing).length,
            memory: process.memoryUsage()
        };
    }
}

module.exports = Manager;
