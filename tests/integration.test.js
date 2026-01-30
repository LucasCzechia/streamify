const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const Streamify = require('../index');

describe('Streamify Integration', () => {
    let streamify;

    before(async () => {
        streamify = new Streamify({
            port: 3999,
            host: '127.0.0.1'
        });
        await streamify.start();
    });

    after(async () => {
        if (streamify) {
            await streamify.stop();
        }
    });

    describe('lifecycle', () => {
        it('should start successfully', () => {
            assert.strictEqual(streamify.running, true);
        });

        it('should have valid base URL', () => {
            const url = streamify.getBaseUrl();
            assert.strictEqual(url, 'http://127.0.0.1:3999');
        });

        it('should not start twice', async () => {
            const result = await streamify.start();
            assert.strictEqual(result, streamify);
        });
    });

    describe('detectSource', () => {
        it('should detect YouTube URLs', () => {
            const tests = [
                { input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'youtube' },
                { input: 'https://youtu.be/dQw4w9WgXcQ', expected: 'youtube' },
                { input: 'https://youtube.com/embed/dQw4w9WgXcQ', expected: 'youtube' }
            ];

            for (const test of tests) {
                const result = streamify.detectSource(test.input);
                assert.strictEqual(result.source, test.expected, `Failed for ${test.input}`);
                assert.strictEqual(result.id, 'dQw4w9WgXcQ');
                assert.strictEqual(result.isUrl, true);
            }
        });

        it('should detect raw YouTube IDs', () => {
            const result = streamify.detectSource('dQw4w9WgXcQ');
            assert.strictEqual(result.source, 'youtube');
            assert.strictEqual(result.id, 'dQw4w9WgXcQ');
            assert.strictEqual(result.isUrl, false);
        });

        it('should detect Spotify URLs', () => {
            const tests = [
                { input: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', expected: 'spotify' },
                { input: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', expected: 'spotify' }
            ];

            for (const test of tests) {
                const result = streamify.detectSource(test.input);
                assert.strictEqual(result.source, test.expected, `Failed for ${test.input}`);
                assert.strictEqual(result.id, '4uLU6hMCjMI75M1A2tKUQC');
            }
        });

        it('should detect SoundCloud URLs', () => {
            const result = streamify.detectSource('https://soundcloud.com/artist/track-name');
            assert.strictEqual(result.source, 'soundcloud');
        });

        it('should return null for unknown sources', () => {
            const result = streamify.detectSource('some random text');
            assert.strictEqual(result.source, null);
            assert.strictEqual(result.id, null);
        });

        it('should handle null input', () => {
            const result = streamify.detectSource(null);
            assert.strictEqual(result.source, null);
        });

        it('should handle undefined input', () => {
            const result = streamify.detectSource(undefined);
            assert.strictEqual(result.source, null);
        });

        it('should handle empty string', () => {
            const result = streamify.detectSource('');
            assert.strictEqual(result.source, null);
        });
    });

    describe('getStreamUrl', () => {
        it('should generate YouTube stream URL', () => {
            const url = streamify.getStreamUrl('youtube', 'dQw4w9WgXcQ');
            assert.strictEqual(url, 'http://127.0.0.1:3999/youtube/stream/dQw4w9WgXcQ');
        });

        it('should generate Spotify stream URL', () => {
            const url = streamify.getStreamUrl('spotify', '4uLU6hMCjMI75M1A2tKUQC');
            assert.strictEqual(url, 'http://127.0.0.1:3999/spotify/stream/4uLU6hMCjMI75M1A2tKUQC');
        });

        it('should generate SoundCloud stream URL', () => {
            const url = streamify.getStreamUrl('soundcloud', '123456');
            assert.strictEqual(url, 'http://127.0.0.1:3999/soundcloud/stream/123456');
        });

        it('should accept source aliases', () => {
            const ytUrl = streamify.getStreamUrl('yt', 'test');
            const spUrl = streamify.getStreamUrl('sp', 'test');
            const scUrl = streamify.getStreamUrl('sc', 'test');

            assert(ytUrl.includes('/youtube/'), 'Should alias yt to youtube');
            assert(spUrl.includes('/spotify/'), 'Should alias sp to spotify');
            assert(scUrl.includes('/soundcloud/'), 'Should alias sc to soundcloud');
        });

        it('should append filter parameters', () => {
            const url = streamify.getStreamUrl('youtube', 'test', { bass: 10, speed: 1.25 });
            assert(url.includes('bass=10'), 'Should include bass');
            assert(url.includes('speed=1.25'), 'Should include speed');
        });

        it('should skip null/undefined filter values', () => {
            const url = streamify.getStreamUrl('youtube', 'test', { bass: 10, treble: null, speed: undefined });
            assert(url.includes('bass=10'), 'Should include bass');
            assert(!url.includes('treble'), 'Should skip null');
            assert(!url.includes('speed'), 'Should skip undefined');
        });

        it('should throw for unknown source', () => {
            assert.throws(
                () => streamify.getStreamUrl('unknown', 'test'),
                /Unknown source/
            );
        });
    });

    describe('HTTP endpoints', () => {
        it('should respond to health check', async () => {
            const res = await fetch('http://127.0.0.1:3999/health');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.status, 'ok');
            assert(typeof data.uptime === 'number');
            assert(typeof data.activeStreams === 'number');
        });

        it('should respond to stats', async () => {
            const res = await fetch('http://127.0.0.1:3999/stats');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert(typeof data.uptime === 'number');
            assert(data.memory);
            assert(data.cache);
        });

        it('should respond to streams list', async () => {
            const res = await fetch('http://127.0.0.1:3999/streams');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert(Array.isArray(data.streams));
        });

        it('should return 404 for unknown stream ID', async () => {
            const res = await fetch('http://127.0.0.1:3999/streams/nonexistent');
            assert.strictEqual(res.status, 404);
        });
    });

    describe('YouTube search endpoint', () => {
        it('should search YouTube', async () => {
            const res = await fetch('http://127.0.0.1:3999/youtube/search?q=test&limit=1');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert(data.tracks);
            assert(Array.isArray(data.tracks));
        });

        it('should return 400 without query', async () => {
            const res = await fetch('http://127.0.0.1:3999/youtube/search');
            assert.strictEqual(res.status, 400);
        });
    });

    describe('YouTube info endpoint', () => {
        it('should get video info', async () => {
            const res = await fetch('http://127.0.0.1:3999/youtube/info/dQw4w9WgXcQ');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.id, 'dQw4w9WgXcQ');
            assert(data.title);
        });

        it('should return 500 for invalid video', async () => {
            const res = await fetch('http://127.0.0.1:3999/youtube/info/invalidvideoid123');
            assert.strictEqual(res.status, 500);
        });
    });

    describe('generic search endpoint', () => {
        it('should default to YouTube', async () => {
            const res = await fetch('http://127.0.0.1:3999/search?q=test&limit=1');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert(data.tracks);
        });

        it('should accept source parameter', async () => {
            const res = await fetch('http://127.0.0.1:3999/search?q=test&source=youtube&limit=1');
            const data = await res.json();

            assert.strictEqual(res.status, 200);
        });

        it('should return 400 without query', async () => {
            const res = await fetch('http://127.0.0.1:3999/search');
            assert.strictEqual(res.status, 400);
        });
    });

    describe('active streams API', () => {
        it('should return empty array initially', async () => {
            const streams = await streamify.getActiveStreams();
            assert(Array.isArray(streams.streams));
        });
    });

    describe('resolve method', () => {
        it('should resolve YouTube URL', async () => {
            const result = await streamify.resolve('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

            assert.strictEqual(result.source, 'youtube');
            assert(result.tracks.length > 0);
            assert.strictEqual(result.fromUrl, true);
        });

        it('should resolve raw YouTube ID', async () => {
            const result = await streamify.resolve('dQw4w9WgXcQ');

            assert.strictEqual(result.source, 'youtube');
            assert(result.tracks.length > 0);
        });

        it('should search for plain text', async () => {
            const result = await streamify.resolve('never gonna give you up', 1);

            assert.strictEqual(result.source, 'youtube');
            assert(result.tracks.length > 0);
            assert.strictEqual(result.fromUrl, false);
        });
    });

    describe('shorthand methods', () => {
        it('should have youtube.search', async () => {
            const result = await streamify.youtube.search('test', 1);
            assert(result.tracks);
        });

        it('should have youtube.getInfo', async () => {
            const result = await streamify.youtube.getInfo('dQw4w9WgXcQ');
            assert(result.id);
        });

        it('should have youtube.getStreamUrl', () => {
            const url = streamify.youtube.getStreamUrl('test');
            assert(url.includes('/youtube/stream/'));
        });
    });

    describe('error handling', () => {
        it('should throw when not started', async () => {
            const notStarted = new Streamify({ port: 3998 });

            assert.throws(
                () => notStarted.getBaseUrl(),
                /not started/
            );

            await assert.rejects(
                () => notStarted.search('youtube', 'test'),
                /not started/
            );

            await assert.rejects(
                () => notStarted.resolve('test'),
                /not started/
            );
        });
    });
});

describe('Streamify Not Started', () => {
    it('should throw for getStreamUrl without start', () => {
        const instance = new Streamify({ port: 3997 });
        assert.throws(
            () => instance.getStreamUrl('youtube', 'test'),
            /not started/
        );
    });

    it('should throw for getInfo without start', async () => {
        const instance = new Streamify({ port: 3996 });
        await assert.rejects(
            () => instance.getInfo('youtube', 'test'),
            /not started/
        );
    });
});
