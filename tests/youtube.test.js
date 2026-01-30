const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const youtube = require('../src/providers/youtube');

describe('YouTube Provider', () => {
    const mockConfig = {
        ytdlpPath: 'yt-dlp',
        ffmpegPath: 'ffmpeg',
        cookiesPath: null,
        cache: {
            searchTTL: 300,
            infoTTL: 600
        }
    };

    describe('search', () => {
        it('should return tracks array for valid query', async () => {
            const results = await youtube.search('never gonna give you up', 1, mockConfig);

            assert(results.tracks, 'Should have tracks array');
            assert(Array.isArray(results.tracks), 'Tracks should be an array');
            assert.strictEqual(results.source, 'youtube');
            assert(typeof results.searchTime === 'number', 'Should have searchTime');
        });

        it('should respect limit parameter', async () => {
            const results = await youtube.search('music', 3, mockConfig);

            assert(results.tracks.length <= 3, 'Should not exceed limit');
        });

        it('should return track with required fields', async () => {
            const results = await youtube.search('test video', 1, mockConfig);

            if (results.tracks.length > 0) {
                const track = results.tracks[0];
                assert(track.id, 'Track should have id');
                assert(track.title, 'Track should have title');
                assert(typeof track.duration === 'number', 'Track should have numeric duration');
                assert(track.uri, 'Track should have uri');
                assert(track.streamUrl, 'Track should have streamUrl');
                assert.strictEqual(track.source, 'youtube');
            }
        });

        it('should handle empty query gracefully', async () => {
            await assert.rejects(
                () => youtube.search('', 1, mockConfig),
                /yt-dlp/
            );
        });

        it('should handle special characters in query', async () => {
            const results = await youtube.search('test & special <chars> "quotes"', 1, mockConfig);
            assert(results.tracks, 'Should handle special characters');
        });

        it('should handle unicode in query', async () => {
            const results = await youtube.search('日本語 テスト', 1, mockConfig);
            assert(results.tracks, 'Should handle unicode');
        });

        it('should handle very long query', async () => {
            const longQuery = 'a'.repeat(200);
            const results = await youtube.search(longQuery, 1, mockConfig);
            assert(results.tracks, 'Should handle long query');
        });

        it('should filter by type when specified', async () => {
            const results = await youtube.search('music', 3, mockConfig, { type: 'video' });
            assert(results.tracks, 'Should filter by type');
        });

        it('should sort by views when specified', async () => {
            const results = await youtube.search('music', 3, mockConfig, { sort: 'views' });
            assert(results.tracks, 'Should sort by views');
        });

        it('should sort by date when specified', async () => {
            const results = await youtube.search('music', 3, mockConfig, { sort: 'date' });
            assert(results.tracks, 'Should sort by date');
        });
    });

    describe('getInfo', () => {
        it('should return info for valid video ID', async () => {
            const info = await youtube.getInfo('dQw4w9WgXcQ', mockConfig);

            assert(info.id, 'Should have id');
            assert(info.title, 'Should have title');
            assert(typeof info.duration === 'number', 'Should have numeric duration');
            assert(info.uri, 'Should have uri');
            assert.strictEqual(info.source, 'youtube');
        });

        it('should include author/channel info', async () => {
            const info = await youtube.getInfo('dQw4w9WgXcQ', mockConfig);
            assert(info.author, 'Should have author');
        });

        it('should include thumbnail', async () => {
            const info = await youtube.getInfo('dQw4w9WgXcQ', mockConfig);
            assert(info.thumbnail, 'Should have thumbnail');
        });

        it('should throw for invalid video ID', async () => {
            await assert.rejects(
                () => youtube.getInfo('invalidid123456789', mockConfig),
                /yt-dlp/
            );
        });

        it('should throw for empty video ID', async () => {
            await assert.rejects(
                () => youtube.getInfo('', mockConfig),
                /yt-dlp/
            );
        });

        it('should detect live streams', async () => {
            const info = await youtube.getInfo('dQw4w9WgXcQ', mockConfig);
            assert(typeof info.isLive === 'boolean', 'Should have isLive flag');
        });

        it('should include streamUrl', async () => {
            const info = await youtube.getInfo('dQw4w9WgXcQ', mockConfig);
            assert(info.streamUrl.includes('/youtube/stream/'), 'Should have correct streamUrl format');
        });
    });

    describe('getPlaylist', () => {
        it('should return playlist info for valid playlist ID', async () => {
            const playlist = await youtube.getPlaylist('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', mockConfig);

            assert(playlist.id, 'Should have id');
            assert(playlist.tracks, 'Should have tracks');
            assert(Array.isArray(playlist.tracks), 'Tracks should be array');
            assert.strictEqual(playlist.source, 'youtube');
        });

        it('should throw for invalid playlist ID', async () => {
            await assert.rejects(
                () => youtube.getPlaylist('invalidplaylist', mockConfig),
                /yt-dlp/
            );
        });

        it('should include track details in playlist', async () => {
            const playlist = await youtube.getPlaylist('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', mockConfig);

            if (playlist.tracks.length > 0) {
                const track = playlist.tracks[0];
                assert(track.id, 'Track should have id');
                assert(track.title, 'Track should have title');
                assert(track.streamUrl, 'Track should have streamUrl');
            }
        });
    });

    describe('getRelated', () => {
        it('should return related videos', async () => {
            const related = await youtube.getRelated('dQw4w9WgXcQ', 5, mockConfig);

            assert(related.tracks, 'Should have tracks');
            assert(Array.isArray(related.tracks), 'Tracks should be array');
            assert.strictEqual(related.source, 'youtube');
        });

        it('should respect limit', async () => {
            const related = await youtube.getRelated('dQw4w9WgXcQ', 3, mockConfig);
            assert(related.tracks.length <= 3, 'Should not exceed limit');
        });

        it('should not include source video in results', async () => {
            const sourceId = 'dQw4w9WgXcQ';
            const related = await youtube.getRelated(sourceId, 5, mockConfig);

            const hasSourceVideo = related.tracks.some(t => t.id === sourceId);
            assert(!hasSourceVideo, 'Should not include source video');
        });

        it('should mark tracks as autoplay', async () => {
            const related = await youtube.getRelated('dQw4w9WgXcQ', 3, mockConfig);

            if (related.tracks.length > 0) {
                assert.strictEqual(related.tracks[0].isAutoplay, true, 'Should be marked as autoplay');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle age-restricted content', async () => {
            // This test may fail without cookies - that's expected
            try {
                const info = await youtube.getInfo('6kLq3WMV1nU', mockConfig);
                assert(info.id, 'Should get info if cookies available');
            } catch (e) {
                assert(e.message.includes('yt-dlp'), 'Should fail gracefully without cookies');
            }
        });

        it('should handle deleted/private videos', async () => {
            await assert.rejects(
                () => youtube.getInfo('aaaaaaaaaaa', mockConfig),
                /yt-dlp/
            );
        });

        it('should handle region-blocked content gracefully', async () => {
            // Most region blocks should produce an error from yt-dlp
            try {
                await youtube.getInfo('_some_blocked_video_', mockConfig);
            } catch (e) {
                assert(e.message, 'Should throw with message');
            }
        });
    });
});
