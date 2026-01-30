const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('Error Handling', () => {
    describe('YouTube Provider Errors', () => {
        const youtube = require('../src/providers/youtube');
        const mockConfig = {
            ytdlpPath: 'yt-dlp',
            ffmpegPath: 'ffmpeg',
            cookiesPath: null
        };

        it('should handle missing binary gracefully', async () => {
            const badConfig = { ...mockConfig, ytdlpPath: 'nonexistent-binary' };

            await assert.rejects(
                () => youtube.search('test', 1, badConfig),
                Error
            );
        });

        it('should handle malformed video ID', async () => {
            await assert.rejects(
                () => youtube.getInfo('!!!invalid!!!', mockConfig),
                Error
            );
        });

        it('should handle empty search results', async () => {
            const results = await youtube.search('xyznonexistent123456789abcdef', 1, mockConfig);
            assert(Array.isArray(results.tracks));
        });
    });

    describe('Spotify Provider Errors', () => {
        const spotify = require('../src/providers/spotify');

        it('should throw clear error without credentials', async () => {
            const badConfig = { spotify: {} };

            await assert.rejects(
                () => spotify.search('test', 1, badConfig),
                /credentials/i
            );
        });

        it('should throw clear error with invalid credentials', async () => {
            const badConfig = {
                spotify: {
                    clientId: 'invalid',
                    clientSecret: 'invalid'
                }
            };

            await assert.rejects(
                () => spotify.search('test', 1, badConfig),
                Error
            );
        });
    });

    describe('SoundCloud Provider Errors', () => {
        const soundcloud = require('../src/providers/soundcloud');
        const mockConfig = {
            ytdlpPath: 'yt-dlp'
        };

        it('should return results array for search', async () => {
            const results = await soundcloud.search('test', 1, mockConfig);
            assert(results.tracks, 'Should have tracks array');
            assert(Array.isArray(results.tracks));
        });
    });

    describe('Local Provider Errors', () => {
        const local = require('../src/providers/local');

        it('should throw for non-existent files', async () => {
            await assert.rejects(
                () => local.getInfo('/nonexistent/path/file.mp3', {}),
                /not found/i
            );
        });

        it('should throw for directories', async () => {
            await assert.rejects(
                () => local.getInfo('/tmp', {}),
                /directory/i
            );
        });
    });

    describe('HTTP Provider Errors', () => {
        const http = require('../src/providers/http');

        it('should handle invalid URLs', async () => {
            await assert.rejects(
                () => http.getInfo('not-a-valid-url', {}),
                Error
            );
        });

        it('should return track info for valid URL format', async () => {
            const info = await http.getInfo('http://example.com/audio.mp3', {});
            assert(info.id, 'Should have id');
            assert(info.uri, 'Should have uri');
            assert.strictEqual(info.source, 'http');
        });
    });

    describe('Stream Controller Errors', () => {
        const { createStream } = require('../src/discord/Stream');
        const mockConfig = {
            ytdlpPath: 'yt-dlp',
            ffmpegPath: 'ffmpeg',
            ytdlp: { format: 'bestaudio/best', additionalArgs: [] },
            audio: { bitrate: '128k', format: 'opus' }
        };

        it('should handle destroyed stream gracefully', async () => {
            const track = { id: 'test', title: 'Test', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            stream.destroy();

            await assert.rejects(
                () => stream.create(),
                /destroyed/
            );
        });

        it('should handle double destroy', () => {
            const track = { id: 'test', title: 'Test', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            assert.doesNotThrow(() => {
                stream.destroy();
                stream.destroy();
                stream.destroy();
            });
        });

        it('should handle missing track ID', async () => {
            const track = { title: 'Test', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            await assert.rejects(
                () => stream.create(),
                /Invalid track ID/
            );
        });
    });

    describe('Queue Errors', () => {
        const Queue = require('../src/discord/Queue');

        it('should handle negative index in remove', () => {
            const queue = new Queue();
            queue.add({ id: '1', title: 'Track 1' });

            const removed = queue.remove(-1);
            assert.strictEqual(removed, null);
        });

        it('should handle out of bounds index in remove', () => {
            const queue = new Queue();
            queue.add({ id: '1', title: 'Track 1' });

            const removed = queue.remove(100);
            assert.strictEqual(removed, null);
        });

        it('should handle move with invalid indices', () => {
            const queue = new Queue();
            queue.add({ id: '1', title: 'Track 1' });
            queue.add({ id: '2', title: 'Track 2' });

            assert.strictEqual(queue.move(-1, 0), false);
            assert.strictEqual(queue.move(0, 100), false);
            assert.strictEqual(queue.move(100, 0), false);
        });

        it('should handle shift on empty queue', () => {
            const queue = new Queue();
            const result = queue.shift();
            assert.strictEqual(result, null);
        });

        it('should handle unshift on empty history', () => {
            const queue = new Queue();
            const result = queue.unshift();
            assert.strictEqual(result, null);
        });
    });

    describe('Config Errors', () => {
        const config = require('../src/config');

        it('should use defaults for missing options', () => {
            const loaded = config.load({});

            assert(loaded.port);
            assert(loaded.host);
            assert(loaded.ytdlpPath);
            assert(loaded.ffmpegPath);
        });

        it('should handle null options', () => {
            assert.doesNotThrow(() => {
                config.load(null);
            });
        });

        it('should handle undefined options', () => {
            assert.doesNotThrow(() => {
                config.load(undefined);
            });
        });
    });

    describe('Filter Errors', () => {
        const { buildFfmpegArgs, applyEffectPreset } = require('../src/filters/ffmpeg');
        const mockConfig = { audio: { bitrate: '128k', format: 'opus' } };

        it('should handle empty filters', () => {
            assert.doesNotThrow(() => {
                buildFfmpegArgs({}, mockConfig);
            });
        });

        it('should handle null filters', () => {
            assert.doesNotThrow(() => {
                buildFfmpegArgs(null, mockConfig);
            });
        });

        it('should handle undefined filters', () => {
            assert.doesNotThrow(() => {
                buildFfmpegArgs(undefined, mockConfig);
            });
        });

        it('should return null for unknown preset', () => {
            const result = applyEffectPreset('nonexistent');
            assert.strictEqual(result, null);
        });

        it('should handle invalid equalizer values', () => {
            assert.doesNotThrow(() => {
                buildFfmpegArgs({ equalizer: 'not an array' }, mockConfig);
            });
        });

        it('should handle invalid tremolo object', () => {
            assert.doesNotThrow(() => {
                buildFfmpegArgs({ tremolo: 'not an object' }, mockConfig);
            });
        });
    });

    describe('Cache Edge Cases', () => {
        const cache = require('../src/cache');

        beforeEach(() => {
            cache.clear();
        });

        it('should handle getting undefined key', () => {
            assert.doesNotThrow(() => {
                cache.get(undefined);
            });
        });

        it('should handle setting undefined value', () => {
            assert.doesNotThrow(() => {
                cache.set('key', undefined);
            });
        });

        it('should handle deleting non-existent key', () => {
            assert.doesNotThrow(() => {
                cache.del('nonexistent');
            });
        });

        it('should handle clearing already empty cache', () => {
            assert.doesNotThrow(() => {
                cache.clear();
                cache.clear();
            });
        });
    });

    describe('Stream Utils Errors', () => {
        const streamUtils = require('../src/utils/stream');

        it('should handle unregistering non-existent stream', () => {
            assert.doesNotThrow(() => {
                streamUtils.unregisterStream('nonexistent');
            });
        });

        it('should return null for non-existent stream position', () => {
            const position = streamUtils.getStreamPosition('nonexistent');
            assert.strictEqual(position, null);
        });

        it('should return undefined for non-existent stream by ID', () => {
            const stream = streamUtils.getStreamById('nonexistent');
            assert.strictEqual(stream, undefined);
        });

        it('should return null when updating non-existent stream', () => {
            const result = streamUtils.updateStreamFilters('nonexistent', { bass: 10 });
            assert.strictEqual(result, null);
        });
    });
});
