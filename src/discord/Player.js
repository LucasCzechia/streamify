const { EventEmitter } = require('events');
const Queue = require('./Queue');
const { createStream } = require('./Stream');
const log = require('../utils/logger');

let voiceModule;
try {
    voiceModule = require('@discordjs/voice');
} catch (e) {
    voiceModule = {};
}

const {
    joinVoiceChannel,
    createAudioPlayer,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior
} = voiceModule;

class Player extends EventEmitter {
    constructor(manager, options) {
        super();
        this.manager = manager;
        this.guildId = options.guildId;
        this.voiceChannelId = options.voiceChannelId;
        this.textChannelId = options.textChannelId;
        this.config = manager.config;

        this.connection = null;
        this.audioPlayer = null;
        this.queue = new Queue({ maxPreviousTracks: options.maxPreviousTracks || 25 });
        this.stream = null;

        this._volume = options.volume || manager.config.defaultVolume || 80;
        this._filters = {};
        this._playing = false;
        this._paused = false;
        this._positionTimestamp = 0;
        this._positionMs = 0;
        this._destroyed = false;

        this._prefetchedStream = null;
        this._prefetchedTrack = null;
        this._prefetching = false;
        this._changingStream = false;

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

        this._emptyTimeout = null;
        this._inactivityTimeout = null;
        this._lastActivity = Date.now();
        this._autoPaused = false;
    }

    setAutoPause(enabled) {
        this.autoPause.enabled = enabled;
        return this.autoPause.enabled;
    }

    _startEmptyTimeout() {
        this._cancelEmptyTimeout();
        if (!this.autoLeave.enabled) return;

        log.info('PLAYER', `Channel empty, will leave in ${this.autoLeave.emptyDelay / 1000}s`);
        this._emptyTimeout = setTimeout(() => {
            log.info('PLAYER', 'Leaving due to empty channel');
            this.destroy();
        }, this.autoLeave.emptyDelay);
    }

    _cancelEmptyTimeout() {
        if (this._emptyTimeout) {
            clearTimeout(this._emptyTimeout);
            this._emptyTimeout = null;
        }
    }

    _resetInactivityTimeout() {
        this._lastActivity = Date.now();
        if (this._inactivityTimeout) {
            clearTimeout(this._inactivityTimeout);
        }
        if (!this.autoLeave.enabled || this.autoLeave.inactivityTimeout <= 0) return;

        this._inactivityTimeout = setTimeout(() => {
            if (!this._playing) {
                log.info('PLAYER', 'Leaving due to inactivity');
                this.destroy();
            }
        }, this.autoLeave.inactivityTimeout);
    }

    setAutoplay(enabled) {
        this.autoplay.enabled = enabled;
        return this.autoplay.enabled;
    }

    get connected() {
        return this.connection?.state?.status === VoiceConnectionStatus.Ready;
    }

    get playing() {
        return this._playing && !this._paused;
    }

    get paused() {
        return this._paused;
    }

    get volume() {
        return this._volume;
    }

    get filters() {
        return { ...this._filters };
    }

    get position() {
        if (!this._playing) return 0;
        if (this._paused) return this._positionMs;
        return this._positionMs + (Date.now() - this._positionTimestamp);
    }

    async connect() {
        if (this._destroyed) {
            throw new Error('Player has been destroyed');
        }

        if (this.connected) {
            return this;
        }

        const guild = this.manager.client.guilds.cache.get(this.guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        log.info('PLAYER', `Connecting to voice channel ${this.voiceChannelId}`);

        this.connection = joinVoiceChannel({
            channelId: this.voiceChannelId,
            guildId: this.guildId,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });

        this.audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });

        this.connection.subscribe(this.audioPlayer);
        this._setupListeners();

        try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 10000);
            log.info('PLAYER', `Connected to voice channel ${this.voiceChannelId}`);
            return this;
        } catch (error) {
            this.destroy();
            throw new Error('Failed to connect to voice channel');
        }
    }

    _setupListeners() {
        this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
            if (!this._playing || this._changingStream || this._paused) return;

            const track = this.queue.current;
            this._playing = false;
            this._positionMs = 0;

            if (this.stream) {
                this.stream.destroy();
                this.stream = null;
            }

            this.emit('trackEnd', track, 'finished');

            const next = this.queue.shift();
            if (next) {
                this._playTrack(next);
            } else {
                if (this.autoplay.enabled && track) {
                    await this._handleAutoplay(track);
                } else {
                    this.emit('queueEnd');
                    this._resetInactivityTimeout();
                }
            }
        });

        this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
            this._positionTimestamp = Date.now();
        });

        this.audioPlayer.on('error', (error) => {
            if (error.message === 'Premature close' || error.message.includes('EPIPE')) {
                return;
            }
            log.error('PLAYER', `Audio player error: ${error.message}`);
            const track = this.queue.current;

            if (this.stream) {
                this.stream.destroy();
                this.stream = null;
            }

            this._playing = false;
            this.emit('trackError', track, error);

            const next = this.queue.shift();
            if (next) {
                this._playTrack(next);
            } else {
                this.emit('queueEnd');
            }
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)
                ]);
            } catch {
                log.info('PLAYER', `Disconnected from voice channel ${this.voiceChannelId}`);
                this.destroy();
            }
        });

        this.connection.on(VoiceConnectionStatus.Destroyed, () => {
            this._destroyed = true;
        });
    }

    async play(track) {
        if (this._destroyed) {
            throw new Error('Player has been destroyed');
        }

        if (!this.connected) {
            await this.connect();
        }

        if (this.queue.current) {
            this.queue.add(track, 0);
            return this.skip();
        }

        this.queue.setCurrent(track);
        return this._playTrack(track);
    }

    async _playTrack(track) {
        if (!track) return;

        log.info('PLAYER', `Playing: ${track.title} (${track.id})`);
        this.emit('trackStart', track);

        try {
            const filtersWithVolume = {
                ...this._filters,
                volume: this._volume
            };

            if (this._prefetchedTrack?.id === track.id && this._prefetchedStream) {
                log.info('PLAYER', `Using prefetched stream for ${track.id}`);
                this.stream = this._prefetchedStream;
                this._prefetchedStream = null;
                this._prefetchedTrack = null;
            } else {
                this._clearPrefetch();
                this.stream = createStream(track, filtersWithVolume, this.config);
            }

            const resource = await this.stream.create();

            this.audioPlayer.play(resource);
            this._playing = true;
            this._paused = false;
            this._positionMs = 0;
            this._positionTimestamp = Date.now();

            this._prefetchNext();

            return track;
        } catch (error) {
            log.error('PLAYER', `Failed to play track: ${error.message}`);
            this.emit('trackError', track, error);

            const next = this.queue.shift();
            if (next) {
                return this._playTrack(next);
            } else {
                this.emit('queueEnd');
            }
        }
    }

    async _prefetchNext() {
        if (this._prefetching || this.queue.tracks.length === 0) return;

        const nextTrack = this.queue.tracks[0];
        if (!nextTrack || this._prefetchedTrack?.id === nextTrack.id) return;

        this._prefetching = true;
        this._clearPrefetch();

        log.info('PLAYER', `Prefetching: ${nextTrack.title} (${nextTrack.id})`);

        try {
            const filtersWithVolume = {
                ...this._filters,
                volume: this._volume
            };

            this._prefetchedTrack = nextTrack;
            this._prefetchedStream = createStream(nextTrack, filtersWithVolume, this.config);
            await this._prefetchedStream.create();

            log.info('PLAYER', `Prefetch ready: ${nextTrack.id}`);
        } catch (error) {
            log.debug('PLAYER', `Prefetch failed: ${error.message}`);
            this._clearPrefetch();
        } finally {
            this._prefetching = false;
        }
    }

    _clearPrefetch() {
        if (this._prefetchedStream) {
            this._prefetchedStream.destroy();
            this._prefetchedStream = null;
        }
        this._prefetchedTrack = null;
    }

    async _handleAutoplay(lastTrack) {
        log.info('PLAYER', `Autoplay: fetching related tracks for ${lastTrack.title}`);
        this.emit('autoplayStart', lastTrack);

        try {
            const result = await this.manager.getRelated(lastTrack, this.autoplay.maxTracks);

            if (result.tracks.length === 0) {
                log.info('PLAYER', 'Autoplay: no related tracks found');
                this.emit('queueEnd');
                this._resetInactivityTimeout();
                return;
            }

            const track = result.tracks[0];
            log.info('PLAYER', `Autoplay: playing ${track.title}`);

            if (result.tracks.length > 1) {
                this.queue.addMany(result.tracks.slice(1));
            }

            if (track.source === 'spotify') {
                const spotify = require('../providers/spotify');
                track._resolvedId = await spotify.resolveToYouTube(track.id, this.config);
            }

            this.queue.setCurrent(track);
            this.emit('autoplayAdd', result.tracks);
            await this._playTrack(track);
        } catch (error) {
            log.error('PLAYER', `Autoplay error: ${error.message}`);
            this.emit('queueEnd');
            this._resetInactivityTimeout();
        }
    }

    pause(destroyStream = true) {
        if (!this._playing || this._paused) return false;

        this._positionMs = this.position;
        this._paused = true;

        if (destroyStream && this.stream) {
            this._clearPrefetch();
            this.stream.destroy();
            this.stream = null;
        }

        this.audioPlayer.stop(true);
        log.info('PLAYER', `Paused at ${Math.floor(this._positionMs / 1000)}s (stream destroyed)`);

        return true;
    }

    async resume() {
        if (!this._playing || !this._paused) return false;

        if (!this.stream && this.queue.current) {
            log.info('PLAYER', `Resuming from ${Math.floor(this._positionMs / 1000)}s (recreating stream)`);

            this._changingStream = true;
            const track = this.queue.current;
            const filtersWithVolume = {
                ...this._filters,
                volume: this._volume
            };

            try {
                this.stream = createStream(track, filtersWithVolume, this.config);
                const resource = await this.stream.create(this._positionMs);

                this.audioPlayer.play(resource);
                this._paused = false;
                this._positionTimestamp = Date.now();

                this._prefetchNext();
            } catch (error) {
                log.error('PLAYER', `Resume failed: ${error.message}`);
                this._paused = false;
                this._playing = false;
                this.emit('trackError', track, error);
                return false;
            } finally {
                this._changingStream = false;
            }
        } else {
            this.audioPlayer.unpause();
            this._paused = false;
            this._positionTimestamp = Date.now();
        }

        return true;
    }

    async skip() {
        if (!this._playing && this.queue.isEmpty) {
            return null;
        }

        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        this.audioPlayer.stop();
        return this.queue.current;
    }

    async previous() {
        this._clearPrefetch();
        const prev = this.queue.unshift();
        if (!prev) return null;

        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        this.audioPlayer.stop();
        return this._playTrack(prev);
    }

    stop() {
        this._clearPrefetch();

        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        this.audioPlayer.stop();
        this._playing = false;
        this._paused = false;
        this._positionMs = 0;
        this.queue.clear();
        this.queue.setCurrent(null);
        return true;
    }

    setVolume(volume) {
        this._volume = Math.max(0, Math.min(200, volume));
        return this._volume;
    }

    async seek(positionMs) {
        if (!this._playing || !this.queue.current) return false;

        this._changingStream = true;

        const track = this.queue.current;
        const filtersWithVolume = {
            ...this._filters,
            volume: this._volume
        };

        if (this.stream) {
            this.stream.destroy();
        }

        try {
            this.stream = createStream(track, filtersWithVolume, this.config);
            const resource = await this.stream.create(positionMs);

            this.audioPlayer.play(resource);
            this._positionMs = positionMs;
            this._positionTimestamp = Date.now();
        } finally {
            this._changingStream = false;
        }

        return true;
    }

    setLoop(mode) {
        return this.queue.setRepeatMode(mode);
    }

    async setFilter(name, value) {
        this._filters[name] = value;

        if (this._playing && this.queue.current) {
            this._changingStream = true;

            const currentPos = this.position;
            const track = this.queue.current;
            const filtersWithVolume = {
                ...this._filters,
                volume: this._volume
            };

            if (this.stream) {
                this.stream.destroy();
            }

            try {
                this.stream = createStream(track, filtersWithVolume, this.config);
                const resource = await this.stream.create(currentPos);

                this.audioPlayer.play(resource);
                this._positionMs = currentPos;
                this._positionTimestamp = Date.now();
            } finally {
                this._changingStream = false;
            }
        }

        return true;
    }

    async clearFilters() {
        this._filters = {};
        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    async setEQ(bands) {
        if (!Array.isArray(bands) || bands.length !== 15) {
            throw new Error('EQ must be an array of 15 band gains (-0.25 to 1.0)');
        }
        return this.setFilter('equalizer', bands);
    }

    async setPreset(presetName) {
        const { PRESETS } = require('../filters/ffmpeg');
        if (!PRESETS[presetName]) {
            throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
        }
        delete this._filters.equalizer;
        return this.setFilter('preset', presetName);
    }

    async clearEQ() {
        delete this._filters.equalizer;
        delete this._filters.preset;
        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    getPresets() {
        const { PRESETS } = require('../filters/ffmpeg');
        return Object.keys(PRESETS);
    }

    disconnect() {
        if (this.connection) {
            this.connection.destroy();
        }
        return true;
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        log.info('PLAYER', `Destroying player for guild ${this.guildId}`);

        this._cancelEmptyTimeout();
        if (this._inactivityTimeout) {
            clearTimeout(this._inactivityTimeout);
            this._inactivityTimeout = null;
        }

        this._clearPrefetch();

        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        if (this.audioPlayer) {
            this.audioPlayer.stop(true);
        }

        if (this.connection) {
            this.connection.destroy();
        }

        this._playing = false;
        this._paused = false;
        this.queue.clear();
        this.queue.setCurrent(null);

        this.emit('destroy');
        this.removeAllListeners();
    }

    toJSON() {
        return {
            guildId: this.guildId,
            voiceChannelId: this.voiceChannelId,
            textChannelId: this.textChannelId,
            connected: this.connected,
            playing: this.playing,
            paused: this.paused,
            volume: this.volume,
            position: this.position,
            filters: this.filters,
            queue: this.queue.toJSON(),
            autoplay: this.autoplay,
            autoPause: this.autoPause,
            autoLeave: this.autoLeave
        };
    }
}

module.exports = Player;
