const express = require('express');
const youtube = require('./providers/youtube');
const spotify = require('./providers/spotify');
const soundcloud = require('./providers/soundcloud');
const cache = require('./cache');
const { getActiveStreams, getStreamById, getStreamPosition } = require('./utils/stream');
const log = require('./utils/logger');

class Server {
    constructor(config) {
        this.config = config;
        this.app = express();
        this.server = null;
        this.startTime = null;
        this.setupRoutes();
    }

    _isProviderEnabled(provider) {
        return this.config.providers?.[provider]?.enabled !== false;
    }

    setupRoutes() {
        this.app.use(express.json());

        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
                activeStreams: getActiveStreams().size
            });
        });

        this.app.get('/stats', (req, res) => {
            const mem = process.memoryUsage();
            res.json({
                uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
                activeStreams: getActiveStreams().size,
                memory: {
                    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
                    rss: Math.round(mem.rss / 1024 / 1024) + 'MB'
                },
                cache: cache.stats(),
                config: {
                    spotify: !!this.config.spotify?.clientId,
                    cookies: !!this.config.cookiesPath
                }
            });
        });

        this.app.get('/streams', (req, res) => {
            const streams = [];
            for (const [id, stream] of getActiveStreams()) {
                streams.push({
                    id,
                    source: stream.source,
                    trackId: stream.videoId || stream.trackId,
                    position: getStreamPosition(id),
                    filters: stream.filters || {},
                    startTime: stream.startTime,
                    duration: Date.now() - stream.startTime
                });
            }
            res.json({ streams });
        });

        this.app.get('/streams/:streamId', (req, res) => {
            const stream = getStreamById(req.params.streamId);
            if (!stream) {
                return res.status(404).json({ error: 'Stream not found' });
            }
            res.json({
                id: req.params.streamId,
                source: stream.source,
                trackId: stream.videoId || stream.trackId,
                position: getStreamPosition(req.params.streamId),
                filters: stream.filters || {},
                startTime: stream.startTime,
                duration: Date.now() - stream.startTime
            });
        });

        this.app.get('/streams/:streamId/position', (req, res) => {
            const position = getStreamPosition(req.params.streamId);
            if (position === null) {
                return res.status(404).json({ error: 'Stream not found' });
            }
            res.json({ position, positionMs: Math.floor(position * 1000) });
        });

        this.app.get('/youtube/search', async (req, res) => {
            try {
                if (!this._isProviderEnabled('youtube')) {
                    return res.status(400).json({ error: 'YouTube provider is disabled' });
                }
                const { q, limit = 10 } = req.query;
                if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });

                const cacheKey = `yt:search:${q}:${limit}`;
                const cached = cache.get(cacheKey);
                if (cached) return res.json(cached);

                const results = await youtube.search(q, parseInt(limit), this.config);
                cache.set(cacheKey, results, this.config.cache.searchTTL);
                res.json(results);
            } catch (error) {
                log.error('YOUTUBE', 'Search failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/youtube/info/:videoId', async (req, res) => {
            try {
                if (!this._isProviderEnabled('youtube')) {
                    return res.status(400).json({ error: 'YouTube provider is disabled' });
                }
                const { videoId } = req.params;

                const cacheKey = `yt:info:${videoId}`;
                const cached = cache.get(cacheKey);
                if (cached) return res.json(cached);

                const info = await youtube.getInfo(videoId, this.config);
                cache.set(cacheKey, info, this.config.cache.infoTTL);
                res.json(info);
            } catch (error) {
                log.error('YOUTUBE', 'Info failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/youtube/stream/:videoId', (req, res) => {
            if (!this._isProviderEnabled('youtube')) {
                return res.status(400).json({ error: 'YouTube provider is disabled' });
            }
            youtube.stream(req.params.videoId, req.query, this.config, res);
        });

        this.app.get('/spotify/search', async (req, res) => {
            try {
                if (!this._isProviderEnabled('spotify')) {
                    return res.status(400).json({ error: 'Spotify provider is disabled' });
                }
                if (!this.config.spotify?.clientId) {
                    return res.status(400).json({ error: 'Spotify not configured' });
                }
                const { q, limit = 10 } = req.query;
                if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });

                const cacheKey = `sp:search:${q}:${limit}`;
                const cached = cache.get(cacheKey);
                if (cached) return res.json(cached);

                const results = await spotify.search(q, parseInt(limit), this.config);
                cache.set(cacheKey, results, this.config.cache.searchTTL);
                res.json(results);
            } catch (error) {
                log.error('SPOTIFY', 'Search failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/spotify/info/:trackId', async (req, res) => {
            try {
                if (!this._isProviderEnabled('spotify')) {
                    return res.status(400).json({ error: 'Spotify provider is disabled' });
                }
                if (!this.config.spotify?.clientId) {
                    return res.status(400).json({ error: 'Spotify not configured' });
                }
                const { trackId } = req.params;

                const cacheKey = `sp:info:${trackId}`;
                const cached = cache.get(cacheKey);
                if (cached) return res.json(cached);

                const info = await spotify.getInfo(trackId, this.config);
                cache.set(cacheKey, info, this.config.cache.infoTTL);
                res.json(info);
            } catch (error) {
                log.error('SPOTIFY', 'Info failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/spotify/stream/:trackId', async (req, res) => {
            try {
                if (!this._isProviderEnabled('spotify')) {
                    return res.status(400).json({ error: 'Spotify provider is disabled' });
                }
                if (!this.config.spotify?.clientId) {
                    return res.status(400).json({ error: 'Spotify not configured' });
                }
                await spotify.stream(req.params.trackId, req.query, this.config, res);
            } catch (error) {
                log.error('SPOTIFY', 'Stream failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/soundcloud/search', async (req, res) => {
            try {
                if (!this._isProviderEnabled('soundcloud')) {
                    return res.status(400).json({ error: 'SoundCloud provider is disabled' });
                }
                const { q, limit = 10 } = req.query;
                if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });

                const cacheKey = `sc:search:${q}:${limit}`;
                const cached = cache.get(cacheKey);
                if (cached) return res.json(cached);

                const results = await soundcloud.search(q, parseInt(limit), this.config);
                cache.set(cacheKey, results, this.config.cache.searchTTL);
                res.json(results);
            } catch (error) {
                log.error('SOUNDCLOUD', 'Search failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/soundcloud/stream/:trackId', (req, res) => {
            if (!this._isProviderEnabled('soundcloud')) {
                return res.status(400).json({ error: 'SoundCloud provider is disabled' });
            }
            soundcloud.stream(req.params.trackId, req.query, this.config, res);
        });

        this.app.get('/search', async (req, res) => {
            try {
                const { q, source = 'youtube', limit = 10 } = req.query;
                if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });

                let results;
                switch (source) {
                    case 'spotify':
                        if (!this._isProviderEnabled('spotify')) {
                            return res.status(400).json({ error: 'Spotify provider is disabled' });
                        }
                        if (!this.config.spotify?.clientId) {
                            return res.status(400).json({ error: 'Spotify not configured' });
                        }
                        results = await spotify.search(q, parseInt(limit), this.config);
                        break;
                    case 'soundcloud':
                        if (!this._isProviderEnabled('soundcloud')) {
                            return res.status(400).json({ error: 'SoundCloud provider is disabled' });
                        }
                        results = await soundcloud.search(q, parseInt(limit), this.config);
                        break;
                    default:
                        if (!this._isProviderEnabled('youtube')) {
                            return res.status(400).json({ error: 'YouTube provider is disabled' });
                        }
                        results = await youtube.search(q, parseInt(limit), this.config);
                }
                res.json(results);
            } catch (error) {
                log.error('SEARCH', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/stream/:source/:id', (req, res) => {
            const { source, id } = req.params;
            switch (source) {
                case 'youtube':
                    if (!this._isProviderEnabled('youtube')) {
                        return res.status(400).json({ error: 'YouTube provider is disabled' });
                    }
                    youtube.stream(id, req.query, this.config, res);
                    break;
                case 'spotify':
                    if (!this._isProviderEnabled('spotify')) {
                        return res.status(400).json({ error: 'Spotify provider is disabled' });
                    }
                    spotify.stream(id, req.query, this.config, res);
                    break;
                case 'soundcloud':
                    if (!this._isProviderEnabled('soundcloud')) {
                        return res.status(400).json({ error: 'SoundCloud provider is disabled' });
                    }
                    soundcloud.stream(id, req.query, this.config, res);
                    break;
                default:
                    res.status(400).json({ error: 'Invalid source' });
            }
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, this.config.host, () => {
                this.startTime = Date.now();
                log.success('STREAMIFY', `Running on http://${this.config.host}:${this.config.port}`);
                log.info('STREAMIFY', `YouTube: ${this._isProviderEnabled('youtube') ? 'enabled' : 'disabled'}`);
                log.info('STREAMIFY', `Spotify: ${!this._isProviderEnabled('spotify') ? 'disabled' : (this.config.spotify?.clientId ? 'enabled' : 'disabled (no credentials)')}`);
                log.info('STREAMIFY', `SoundCloud: ${this._isProviderEnabled('soundcloud') ? 'enabled' : 'disabled'}`);
                log.info('STREAMIFY', `Cookies: ${this.config.cookiesPath ? 'configured' : 'not configured'}`);
                resolve();
            });

            this.server.on('error', reject);
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(resolve);
            } else {
                resolve();
            }
        });
    }
}

module.exports = Server;
