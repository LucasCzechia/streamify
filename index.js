const { EventEmitter } = require('events');
const Server = require('./src/server');
const config = require('./src/config');
const youtube = require('./src/providers/youtube');
const spotify = require('./src/providers/spotify');
const soundcloud = require('./src/providers/soundcloud');
const log = require('./src/utils/logger');
const { setEventEmitter } = require('./src/utils/stream');

class Streamify extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.config = null;
        this.server = null;
        this.running = false;
    }

    async start() {
        if (this.running) return this;

        this.config = config.load(this.options);
        log.init(this.config);
        setEventEmitter(this);
        this.server = new Server(this.config);
        await this.server.start();
        this.running = true;
        return this;
    }

    async stop() {
        if (this.server) {
            await this.server.stop();
            this.running = false;
        }
    }

    getBaseUrl() {
        if (!this.config) throw new Error('Streamify not started. Call .start() first');
        return `http://127.0.0.1:${this.config.port}`;
    }

    detectSource(input) {
        if (!input) return { source: null, id: null, isUrl: false };

        const patterns = {
            youtube: [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                /^([a-zA-Z0-9_-]{11})$/
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
                const match = input.match(regex);
                if (match) {
                    return {
                        source,
                        id: match[1],
                        isUrl: input.includes('://') || input.includes('.com')
                    };
                }
            }
        }

        return { source: null, id: null, isUrl: false };
    }

    async resolve(input, limit = 1) {
        if (!this.running) throw new Error('Streamify not started. Call .start() first');

        const detected = this.detectSource(input);

        if (detected.source && detected.isUrl) {
            const track = await this.getInfo(detected.source, detected.id).catch(() => null);
            if (track) {
                return { source: detected.source, tracks: [track], fromUrl: true };
            }
        }

        if (detected.source === 'youtube' && detected.id && !detected.isUrl) {
            const track = await this.getInfo('youtube', detected.id).catch(() => null);
            if (track) {
                return { source: 'youtube', tracks: [track], fromUrl: true };
            }
        }

        const results = await this.search('youtube', input, limit);
        return { source: 'youtube', tracks: results.tracks, fromUrl: false, searchTime: results.searchTime };
    }

    async search(source, query, limit = 10) {
        if (!this.running) throw new Error('Streamify not started. Call .start() first');

        switch (source) {
            case 'youtube':
            case 'yt':
                return youtube.search(query, limit, this.config);
            case 'spotify':
            case 'sp':
                return spotify.search(query, limit, this.config);
            case 'soundcloud':
            case 'sc':
                return soundcloud.search(query, limit, this.config);
            default:
                throw new Error(`Unknown source: ${source}`);
        }
    }

    async getInfo(source, id) {
        if (!this.running) throw new Error('Streamify not started. Call .start() first');

        switch (source) {
            case 'youtube':
            case 'yt':
                return youtube.getInfo(id, this.config);
            case 'spotify':
            case 'sp':
                return spotify.getInfo(id, this.config);
            default:
                throw new Error(`Unknown source: ${source}`);
        }
    }

    getStreamUrl(source, id, filters = {}) {
        if (!this.config) throw new Error('Streamify not started. Call .start() first');

        let endpoint;
        switch (source) {
            case 'youtube':
            case 'yt':
                endpoint = `/youtube/stream/${id}`;
                break;
            case 'spotify':
            case 'sp':
                endpoint = `/spotify/stream/${id}`;
                break;
            case 'soundcloud':
            case 'sc':
                endpoint = `/soundcloud/stream/${id}`;
                break;
            default:
                throw new Error(`Unknown source: ${source}`);
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                params.append(key, value);
            }
        }

        const queryString = params.toString();
        return `${this.getBaseUrl()}${endpoint}${queryString ? '?' + queryString : ''}`;
    }

    async getStream(source, id, filters = {}) {
        const url = this.getStreamUrl(source, id, filters);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Stream failed: ${response.status}`);
        }
        return response.body;
    }

    youtube = {
        search: (query, limit = 10) => this.search('youtube', query, limit),
        getInfo: (id) => this.getInfo('youtube', id),
        getStreamUrl: (id, filters = {}) => this.getStreamUrl('youtube', id, filters),
        getStream: (id, filters = {}) => this.getStream('youtube', id, filters)
    };

    spotify = {
        search: (query, limit = 10) => this.search('spotify', query, limit),
        getInfo: (id) => this.getInfo('spotify', id),
        getStreamUrl: (id, filters = {}) => this.getStreamUrl('spotify', id, filters),
        getStream: (id, filters = {}) => this.getStream('spotify', id, filters)
    };

    soundcloud = {
        search: (query, limit = 10) => this.search('soundcloud', query, limit),
        getStreamUrl: (id, filters = {}) => this.getStreamUrl('soundcloud', id, filters),
        getStream: (id, filters = {}) => this.getStream('soundcloud', id, filters)
    };

    async getActiveStreams() {
        const res = await fetch(`${this.getBaseUrl()}/streams`);
        return res.json();
    }

    async getStreamInfo(streamId) {
        const res = await fetch(`${this.getBaseUrl()}/streams/${streamId}`);
        if (!res.ok) return null;
        return res.json();
    }

    async getPosition(streamId) {
        const res = await fetch(`${this.getBaseUrl()}/streams/${streamId}/position`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.position;
    }

    async applyFilters(source, trackId, currentStreamId, newFilters) {
        const position = await this.getPosition(currentStreamId);
        if (position === null) {
            throw new Error('Stream not found or already ended');
        }

        const filters = {
            ...newFilters,
            start: Math.floor(position)
        };

        return {
            url: this.getStreamUrl(source, trackId, filters),
            position,
            filters
        };
    }
}

if (require.main === module) {
    const streamify = new Streamify();
    streamify.start().then(() => {
        console.log(`[STREAMIFY] Server running at ${streamify.getBaseUrl()}`);
    }).catch(err => {
        console.error('[STREAMIFY] Failed to start:', err.message);
        process.exit(1);
    });
}

let Manager = null;
try {
    Manager = require('./src/discord/Manager');
} catch (e) {
}

Streamify.Manager = Manager;

Streamify.Player = Manager ? require('./src/discord/Player') : null;
Streamify.Queue = Manager ? require('./src/discord/Queue') : null;

module.exports = Streamify;
