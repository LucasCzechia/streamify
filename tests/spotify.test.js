const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const spotify = require('../src/providers/spotify');

describe('Spotify Provider', () => {
    const mockConfig = {
        ytdlpPath: 'yt-dlp',
        ffmpegPath: 'ffmpeg',
        spotify: {
            clientId: process.env.SPOTIFY_CLIENT_ID || null,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET || null
        },
        cache: {
            searchTTL: 300,
            infoTTL: 600
        }
    };

    const hasCredentials = mockConfig.spotify.clientId && mockConfig.spotify.clientSecret;

    describe('search', () => {
        it('should throw without credentials', async function() {
            if (hasCredentials) this.skip();

            const badConfig = { ...mockConfig, spotify: {} };
            await assert.rejects(
                () => spotify.search('test', 1, badConfig),
                /credentials/i
            );
        });

        it('should return tracks for valid query', async function() {
            if (!hasCredentials) this.skip();

            const results = await spotify.search('never gonna give you up', 1, mockConfig);

            assert(results.tracks, 'Should have tracks');
            assert(Array.isArray(results.tracks), 'Tracks should be array');
            assert.strictEqual(results.source, 'spotify');
        });

        it('should respect limit', async function() {
            if (!hasCredentials) this.skip();

            const results = await spotify.search('music', 5, mockConfig);
            assert(results.tracks.length <= 5, 'Should not exceed limit');
        });

        it('should return track with required fields', async function() {
            if (!hasCredentials) this.skip();

            const results = await spotify.search('test', 1, mockConfig);

            if (results.tracks.length > 0) {
                const track = results.tracks[0];
                assert(track.id, 'Should have id');
                assert(track.title, 'Should have title');
                assert(track.author, 'Should have author');
                assert(track.album, 'Should have album');
                assert(typeof track.duration === 'number', 'Should have numeric duration');
                assert(track.uri, 'Should have uri');
                assert(track.streamUrl, 'Should have streamUrl');
                assert.strictEqual(track.source, 'spotify');
            }
        });

        it('should handle empty results', async function() {
            if (!hasCredentials) this.skip();

            const results = await spotify.search('xyznonexistenttrack12345', 1, mockConfig);
            assert(Array.isArray(results.tracks), 'Should return empty array');
        });

        it('should handle special characters', async function() {
            if (!hasCredentials) this.skip();

            const results = await spotify.search('rock & roll "classics"', 1, mockConfig);
            assert(results.tracks, 'Should handle special chars');
        });
    });

    describe('getInfo', () => {
        it('should throw without credentials', async function() {
            if (hasCredentials) this.skip();

            const badConfig = { ...mockConfig, spotify: {} };
            await assert.rejects(
                () => spotify.getInfo('4uLU6hMCjMI75M1A2tKUQC', badConfig),
                /credentials/i
            );
        });

        it('should return info for valid track ID', async function() {
            if (!hasCredentials) this.skip();

            const info = await spotify.getInfo('4uLU6hMCjMI75M1A2tKUQC', mockConfig);

            assert(info.id, 'Should have id');
            assert(info.title, 'Should have title');
            assert(info.author, 'Should have author');
            assert(info.album, 'Should have album');
            assert.strictEqual(info.source, 'spotify');
        });

        it('should throw for invalid track ID', async function() {
            if (!hasCredentials) this.skip();

            await assert.rejects(
                () => spotify.getInfo('invalidtrackid', mockConfig),
                /Spotify API error/
            );
        });

        it('should include duration in seconds', async function() {
            if (!hasCredentials) this.skip();

            const info = await spotify.getInfo('4uLU6hMCjMI75M1A2tKUQC', mockConfig);
            assert(typeof info.duration === 'number', 'Duration should be number');
            assert(info.duration > 0, 'Duration should be positive');
            assert(info.duration < 3600, 'Duration should be in seconds not ms');
        });
    });

    describe('resolveToYouTube', () => {
        it('should resolve Spotify track to YouTube ID', async function() {
            if (!hasCredentials) this.skip();

            const youtubeId = await spotify.resolveToYouTube('4uLU6hMCjMI75M1A2tKUQC', mockConfig);

            assert(youtubeId, 'Should return YouTube ID');
            assert(typeof youtubeId === 'string', 'Should be string');
            assert(youtubeId.length === 11, 'YouTube IDs are 11 characters');
        });

        it('should cache resolved IDs', async function() {
            if (!hasCredentials) this.skip();

            const trackId = '4uLU6hMCjMI75M1A2tKUQC';

            const start1 = Date.now();
            const id1 = await spotify.resolveToYouTube(trackId, mockConfig);
            const time1 = Date.now() - start1;

            const start2 = Date.now();
            const id2 = await spotify.resolveToYouTube(trackId, mockConfig);
            const time2 = Date.now() - start2;

            assert.strictEqual(id1, id2, 'Should return same ID');
            assert(time2 < time1 / 2, 'Cached lookup should be faster');
        });

        it('should throw for invalid track', async function() {
            if (!hasCredentials) this.skip();

            await assert.rejects(
                () => spotify.resolveToYouTube('invalidtrack', mockConfig),
                /Spotify API error/
            );
        });
    });

    describe('getPlaylist', () => {
        it('should return playlist tracks', async function() {
            if (!hasCredentials) this.skip();

            const playlist = await spotify.getPlaylist('37i9dQZF1DXcBWIGoYBM5M', mockConfig);

            assert(playlist.id, 'Should have id');
            assert(playlist.title, 'Should have title');
            assert(playlist.tracks, 'Should have tracks');
            assert(Array.isArray(playlist.tracks), 'Tracks should be array');
            assert.strictEqual(playlist.source, 'spotify');
        });

        it('should throw for invalid playlist', async function() {
            if (!hasCredentials) this.skip();

            await assert.rejects(
                () => spotify.getPlaylist('invalidplaylist', mockConfig),
                /Spotify API error/
            );
        });
    });

    describe('getAlbum', () => {
        it('should return album tracks', async function() {
            if (!hasCredentials) this.skip();

            const album = await spotify.getAlbum('4aawyAB9vmqN3uQ7FjRGTy', mockConfig);

            assert(album.id, 'Should have id');
            assert(album.title, 'Should have title');
            assert(album.author, 'Should have author');
            assert(album.tracks, 'Should have tracks');
            assert(Array.isArray(album.tracks), 'Tracks should be array');
            assert.strictEqual(album.source, 'spotify');
        });

        it('should throw for invalid album', async function() {
            if (!hasCredentials) this.skip();

            await assert.rejects(
                () => spotify.getAlbum('invalidalbum', mockConfig),
                /Spotify API error/
            );
        });
    });

    describe('getRecommendations', () => {
        it('should return recommended tracks', async function() {
            if (!hasCredentials) this.skip();

            const recs = await spotify.getRecommendations('4uLU6hMCjMI75M1A2tKUQC', 5, mockConfig);

            assert(recs.tracks, 'Should have tracks');
            assert(Array.isArray(recs.tracks), 'Tracks should be array');
            assert.strictEqual(recs.source, 'spotify');
        });

        it('should mark tracks as autoplay', async function() {
            if (!hasCredentials) this.skip();

            const recs = await spotify.getRecommendations('4uLU6hMCjMI75M1A2tKUQC', 3, mockConfig);

            if (recs.tracks.length > 0) {
                assert.strictEqual(recs.tracks[0].isAutoplay, true);
            }
        });

        it('should respect limit', async function() {
            if (!hasCredentials) this.skip();

            const recs = await spotify.getRecommendations('4uLU6hMCjMI75M1A2tKUQC', 3, mockConfig);
            assert(recs.tracks.length <= 3, 'Should not exceed limit');
        });
    });
});
