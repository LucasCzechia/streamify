const { EventEmitter } = require('events');
const Queue = require('./Queue');
const { createStream } = require('./Stream');
const { applyEffectPreset, EFFECT_PRESETS } = require('../filters/ffmpeg');
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
        this._effectPresets = [];
        this._playing = false;
        this._paused = false;
        this._positionTimestamp = 0;
        this._positionMs = 0;
        this._destroyed = false;

        this._prefetchedStream = null;
        this._prefetchedTrack = null;
        this._prefetching = false;
        this._changingStream = false;
        this._manualSkip = false;

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

        this.voiceChannelStatus = {
            enabled: options.voiceChannelStatus?.enabled ?? false,
            template: options.voiceChannelStatus?.template ?? '🎶 Now Playing: {title} - {artist} | Requested by: {requester}'
        };

        this._emptyTimeout = null;
        this._inactivityTimeout = null;
        this._lastActivity = Date.now();
        this._autoPaused = false;
        this._lastStatusUpdate = 0;
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
            if (!this._playing || this._changingStream || this._paused || this._manualSkip) return;

            const track = this.queue.current;
            this._playing = false;
            this._positionMs = 0;

            if (this.stream) {
                this.stream.destroy();
                this.stream = null;
            }

            this.emit('trackEnd', track, 'finished');

            if (!this._manualSkip) {
                const next = this.queue.shift();
                if (next) {
                    this._playTrack(next);
                } else {
                    if (this.autoplay.enabled && track) {
                        await this._handleAutoplay(track);
                    } else {
                        this._clearVoiceChannelStatus();
                        this.emit('queueEnd');
                        this._resetInactivityTimeout();
                    }
                }
            }
        });

        this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
            this._positionTimestamp = Date.now();
        });

        this.audioPlayer.on('error', (error) => {
            if (this._manualSkip || this._changingStream) {
                return;
            }

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
                // Use setImmediate to break recursion stack on consecutive failures
                setImmediate(() => this._playTrack(next));
            } else {
                this._clearVoiceChannelStatus();
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

    async play(track, options = {}) {
        if (this._destroyed) {
            throw new Error('Player has been destroyed');
        }

        if (!this.connected) {
            await this.connect();
        }

        const playOptions = {
            startPosition: options.startPosition || options.seek || 0,
            volume: options.volume,
            filters: options.filters,
            replace: options.replace || false
        };

        if (options.volume !== undefined) {
            this._volume = Math.max(0, Math.min(200, options.volume));
        }

        if (options.filters) {
            this._filters = { ...this._filters, ...options.filters };
        }

        if (this.queue.current && !playOptions.replace) {
            this.queue.add(track, 0);
            return this.skip();
        }

        if (playOptions.replace && this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        this.queue.setCurrent(track);
        return this._playTrack(track, playOptions.startPosition);
    }

    async _playTrack(track, startPosition = 0) {
        if (!track) return;

        log.info('PLAYER', `Playing: ${track.title} (${track.id})` + (startPosition > 0 ? ` @ ${Math.floor(startPosition / 1000)}s` : ''));
        this.emit('trackStart', track);

        let newStream = null;
        try {
            const filtersWithVolume = { ...this._filters, volume: this._volume };

            if (startPosition === 0 && this._prefetchedTrack?.id === track.id && this._prefetchedStream) {
                log.debug('PLAYER', `Using prefetched stream for ${track.id}`);
                newStream = this._prefetchedStream;
                this._prefetchedStream = null;
                this._prefetchedTrack = null;
            } else {
                // If not using prefetch, we don't clear it yet in case we need to fallback
                newStream = createStream(track, filtersWithVolume, this.config);
            }

            const resource = await newStream.create(startPosition);

            // SEAMLESS SWAP: Only destroy old stream AFTER the new one is ready
            const oldStream = this.stream;
            this.stream = newStream;
            this.audioPlayer.play(resource);

            if (oldStream && oldStream !== newStream) {
                oldStream.destroy();
            }

            this._playing = true;
            this._paused = false;
            this._positionMs = startPosition;
            this._positionTimestamp = Date.now();

            this._prefetchNext();
            setImmediate(() => this._updateVoiceChannelStatus(track));

            return track;
        } catch (error) {
            if (newStream && newStream !== this.stream) {
                newStream.destroy();
            }

            if (this._manualSkip || this._changingStream || error.message.includes('Stream destroyed')) {
                log.debug('PLAYER', `Playback cancelled for ${track.id}`);
                return;
            }

            log.error('PLAYER', `Failed to play track: ${error.message}`);
            this.emit('trackError', track, error);
            
            const next = this.queue.shift();
            if (next) {
                setImmediate(() => this._playTrack(next));
            } else {
                this.emit('queueEnd');
            }
        }
    }

    _clearPrefetch() {
        if (this._prefetchedStream) {
            this._prefetchedStream.destroy();
            this._prefetchedStream = null;
        }
        this._prefetchedTrack = null;
    }

    async _prefetchNext() {
        if (this._prefetching || this.queue.tracks.length === 0) return;

        const nextTrack = this.queue.tracks[0];
        if (!nextTrack || this._prefetchedTrack?.id === nextTrack.id) return;

        this._prefetching = true;
        this._clearPrefetch();

        log.debug('PLAYER', `Prefetching: ${nextTrack.title} (${nextTrack.id})`);

        try {
            const filtersWithVolume = {
                ...this._filters,
                volume: this._volume
            };

            this._prefetchedTrack = nextTrack;
            this._prefetchedStream = createStream(nextTrack, filtersWithVolume, this.config);
            await this._prefetchedStream.create();

            log.debug('PLAYER', `Prefetch ready: ${nextTrack.id}`);
        } catch (error) {
            log.debug('PLAYER', `Prefetch failed: ${error.message}`);
            this._clearPrefetch();
        } finally {
            this._prefetching = false;
        }
    }

    async _updateVoiceChannelStatus(track, force = false) {
        if (!this.voiceChannelStatus.enabled || !track) return;

        const now = Date.now();
        if (!force && now - this._lastStatusUpdate < 300000) {
            log.debug('PLAYER', 'Skipping voice channel status update due to rate limit');
            return;
        }

        const guild = this.manager.client.guilds.cache.get(this.guildId);
        const channel = guild?.channels.cache.get(this.voiceChannelId);
        if (!channel) return;

        const botMember = guild.members.me || guild.members.cache.get(this.manager.client.user.id);
        if (!channel.permissionsFor(botMember)?.has('ManageChannels')) {
            log.warn('PLAYER', `Missing 'ManageChannels' permission to update status in ${channel.name}`);
            return;
        }

        try {
            const requesterName = typeof track.requestedBy === 'string' ? track.requestedBy : (track.requestedBy?.username || 'Unknown');
            const statusText = this.voiceChannelStatus.template
                .replace('{title}', track.title || 'Unknown')
                .replace('{artist}', track.author || 'Unknown')
                .replace('{requester}', requesterName)
                .substring(0, 500);

            log.info('PLAYER', `Updating voice status: ${statusText}`);

            await this.manager.client.rest.put(`/channels/${this.voiceChannelId}/voice-status`, {
                body: { status: statusText }
            });
            
            this._lastStatusUpdate = now;
            log.info('PLAYER', `Voice channel status updated successfully`);
        } catch (error) {
            log.error('PLAYER', `Failed to update voice channel status: ${error.message}`);
        }
    }

    async _clearVoiceChannelStatus() {
        if (!this.voiceChannelStatus.enabled) return;

        try {
            await this.manager.client.rest.put(`/channels/${this.voiceChannelId}/voice-status`, {
                body: { status: "" }
            });
            log.info('PLAYER', 'Cleared voice channel status');
        } catch (error) {
            log.error('PLAYER', `Failed to clear voice channel status: ${error.message}`);
        }
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
        log.info('PLAYER', `Paused playback at ${Math.floor(this._positionMs / 1000)}s (Reason: User Request)`);
        this._clearVoiceChannelStatus();

        return true;
    }

    async resume() {
        if (!this._playing || !this._paused) return false;

        if (!this.stream && this.queue.current) {
            log.info('PLAYER', `Resuming playback from ${Math.floor(this._positionMs / 1000)}s`);

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
                this._updateVoiceChannelStatus(track, true);
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
            this._updateVoiceChannelStatus(this.queue.current, true);
        }

        return true;
    }

    async skip() {
        if (!this._playing && this.queue.isEmpty) return null;

        this._changingStream = true;
        this._manualSkip = true;

        const track = this.queue.current;
        const next = this.queue.shift();
        
        this.audioPlayer.stop(); // Triggers Idle if playing, but guards will catch it
        this.emit('trackEnd', track, 'skipped');
        log.info('PLAYER', `Skipping track (Next: ${next ? next.title : 'End of queue'})`);

        try {
            if (next) {
                await this._playTrack(next);
            }
        } finally {
            this._manualSkip = false;
            this._changingStream = false;
        }

        return this.queue.current || next;
    }

    async previous() {
        this._changingStream = true;
        this._manualSkip = true;
        this._clearPrefetch();

        const prev = this.queue.unshift();
        if (!prev) {
            this._manualSkip = false;
            this._changingStream = false;
            return null;
        }

        const track = this.queue.current;
        this.audioPlayer.stop();
        
        this.emit('trackEnd', track, 'skipped');
        log.info('PLAYER', `Rewinding to previous track: ${prev.title}`);

        try {
            await this._playTrack(prev);
        } finally {
            this._manualSkip = false;
            this._changingStream = false;
        }

        return this.queue.current || prev;
    }

    stop() {
        this._clearPrefetch();

        const track = this.queue.current;
        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }

        this._playing = false;
        this._paused = false;
        this.audioPlayer.stop();
        
        this._positionMs = 0;
        this.queue.clear();
        this.queue.setCurrent(null);
        
        this.emit('trackEnd', track, 'stopped');
        log.info('PLAYER', 'Stopped playback and cleared queue');
        this._clearVoiceChannelStatus();
        
        return true;
    }

    setVolume(volume) {
        const oldVolume = this._volume;
        this._volume = Math.max(0, Math.min(200, volume));
        log.info('PLAYER', `Volume adjusted: ${oldVolume}% -> ${this._volume}%`);
        return this._volume;
    }

    async seek(positionMs) {
        if (!this._playing || !this.queue.current) return false;

        this._changingStream = true;
        const track = this.queue.current;

        log.info('PLAYER', `Seeking to ${Math.floor(positionMs / 1000)}s`);

        try {
            await this._playTrack(track, positionMs);
            return true;
        } finally {
            this._changingStream = false;
        }
    }

    setLoop(mode) {
        log.info('PLAYER', `Loop mode changed to: ${mode.toUpperCase()}`);
        return this.queue.setRepeatMode(mode);
    }

    async setFilter(name, value) {
        this._filters[name] = value;

        if (this._playing && this.queue.current) {
            this._changingStream = true;
            try {
                await this._playTrack(this.queue.current, this.position);
            } finally {
                this._changingStream = false;
            }
        }

        return true;
    }

    async clearFilters() {
        this._filters = {};
        log.info('PLAYER', 'All audio filters cleared');
        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    async setEQ(bands) {
        if (!Array.isArray(bands) || bands.length !== 15) {
            throw new Error('EQ must be an array of 15 band gains (-0.25 to 1.0)');
        }
        log.info('PLAYER', 'Applying custom 15-band Equalizer');
        return this.setFilter('equalizer', bands);
    }

    async setPreset(presetName) {
        const { PRESETS } = require('../filters/ffmpeg');
        if (!PRESETS[presetName]) {
            throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
        }
        delete this._filters.equalizer;
        log.info('PLAYER', `Applying EQ preset: ${presetName.toUpperCase()}`);
        return this.setFilter('preset', presetName);
    }

    async clearEQ() {
        delete this._filters.equalizer;
        delete this._filters.preset;
        log.info('PLAYER', 'Equalizer cleared');
        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    getPresets() {
        const { PRESETS } = require('../filters/ffmpeg');
        return Object.keys(PRESETS);
    }

    async setEffectPresets(presets, options = {}) {
        if (!Array.isArray(presets)) {
            presets = [presets];
        }

        const replace = options.replace ?? false;
        const newPresets = [];

        for (const preset of presets) {
            const name = typeof preset === 'string' ? preset : preset.name;
            const intensity = typeof preset === 'object' ? (preset.intensity ?? 1.0) : 1.0;

            if (!EFFECT_PRESETS[name]) {
                log.warn('PLAYER', `Unknown effect preset: ${name}`);
                continue;
            }
            newPresets.push({ name, intensity });
        }

        if (replace) {
            this._effectPresets = newPresets;
        } else {
            const existingNames = this._effectPresets.map(p => p.name);
            for (const preset of newPresets) {
                const idx = existingNames.indexOf(preset.name);
                if (idx >= 0) {
                    this._effectPresets[idx] = preset;
                } else {
                    this._effectPresets.push(preset);
                }
            }
        }

        // Re-calculate all filters from active presets
        this._filters = {};
        for (const preset of this._effectPresets) {
            const filters = applyEffectPreset(preset.name, preset.intensity);
            if (filters) {
                Object.assign(this._filters, filters);
            }
        }

        log.info('PLAYER', `Active effects: ${this._effectPresets.map(p => p.name).join(' + ') || 'NONE'}`);

        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    getActiveEffectPresets() {
        return [...this._effectPresets];
    }

    async clearEffectPresets() {
        this._effectPresets = [];
        this._filters = {};
        log.info('PLAYER', 'All effect presets cleared');
        if (this._playing && this.queue.current) {
            return this.setFilter('_trigger', null);
        }
        return true;
    }

    getEffectPresets() {
        return Object.keys(EFFECT_PRESETS);
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

        this._clearVoiceChannelStatus();
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
