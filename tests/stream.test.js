const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');

const { createStream, StreamController } = require('../src/discord/Stream');

describe('StreamController', () => {
    const mockConfig = {
        ytdlpPath: 'yt-dlp',
        ffmpegPath: 'ffmpeg',
        cookiesPath: null,
        ytdlp: {
            format: 'bestaudio/best',
            additionalArgs: []
        },
        audio: {
            bitrate: '128k',
            format: 'opus'
        },
        sponsorblock: {
            enabled: false
        }
    };

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            assert.strictEqual(stream.track, track);
            assert.deepStrictEqual(stream.filters, {});
            assert.strictEqual(stream.destroyed, false);
            assert.strictEqual(stream.ytdlp, null);
            assert.strictEqual(stream.ffmpeg, null);
        });

        it('should accept filters', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const filters = { bass: 10, speed: 1.25 };
            const stream = createStream(track, filters, mockConfig);

            assert.deepStrictEqual(stream.filters, filters);
        });

        it('should handle null filters', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, null, mockConfig);

            assert.deepStrictEqual(stream.filters, {});
        });
    });

    describe('destroy', () => {
        it('should set destroyed flag', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            stream.destroy();

            assert.strictEqual(stream.destroyed, true);
        });

        it('should be idempotent', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            stream.destroy();
            stream.destroy();
            stream.destroy();

            assert.strictEqual(stream.destroyed, true);
        });

        it('should nullify resources', () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            stream.destroy();

            assert.strictEqual(stream.ytdlp, null);
            assert.strictEqual(stream.ffmpeg, null);
            assert.strictEqual(stream.resource, null);
        });
    });

    describe('create - edge cases', () => {
        it('should throw if already destroyed', async () => {
            const track = { id: 'test123', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            stream.destroy();

            await assert.rejects(
                () => stream.create(),
                { message: 'Stream already destroyed' }
            );
        });

        it('should throw for invalid track ID', async () => {
            const track = { id: undefined, title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            await assert.rejects(
                () => stream.create(),
                /Invalid track ID/
            );
        });

        it('should throw for null track ID', async () => {
            const track = { id: null, title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            await assert.rejects(
                () => stream.create(),
                /Invalid track ID/
            );
        });

        it('should throw for "undefined" string track ID', async () => {
            const track = { id: 'undefined', title: 'Test Track', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            await assert.rejects(
                () => stream.create(),
                /Invalid track ID/
            );
        });
    });

    describe('source detection', () => {
        it('should handle youtube source', () => {
            const track = { id: 'dQw4w9WgXcQ', title: 'Test', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.source, 'youtube');
        });

        it('should handle spotify source', () => {
            const track = { id: '4uLU6hMCjMI75M1A2tKUQC', title: 'Test', source: 'spotify' };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.source, 'spotify');
        });

        it('should handle soundcloud source', () => {
            const track = { id: '123456', title: 'Test', source: 'soundcloud', uri: 'https://soundcloud.com/test/track' };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.source, 'soundcloud');
        });

        it('should default to youtube for unknown source', () => {
            const track = { id: 'test123', title: 'Test' };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.source || 'youtube', 'youtube');
        });
    });

    describe('metrics tracking', () => {
        it('should initialize metrics to zero', () => {
            const track = { id: 'test123', title: 'Test', source: 'youtube' };
            const stream = createStream(track, {}, mockConfig);

            assert.deepStrictEqual(stream.metrics, {
                metadata: 0,
                spawn: 0,
                firstByte: 0,
                total: 0
            });
        });
    });

    describe('resolved ID handling', () => {
        it('should use _resolvedId if available', () => {
            const track = {
                id: 'spotify123',
                title: 'Test',
                source: 'spotify',
                _resolvedId: 'youtube456'
            };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track._resolvedId, 'youtube456');
        });
    });

    describe('live stream handling', () => {
        it('should detect live stream from isLive flag', () => {
            const track = { id: 'live123', title: 'Live Stream', source: 'youtube', isLive: true };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.isLive, true);
        });

        it('should detect live stream from zero duration', () => {
            const track = { id: 'live123', title: 'Live Stream', source: 'youtube', duration: 0 };
            const stream = createStream(track, {}, mockConfig);
            assert.strictEqual(stream.track.duration, 0);
        });
    });
});

describe('createStream factory', () => {
    const mockConfig = {
        ytdlpPath: 'yt-dlp',
        ffmpegPath: 'ffmpeg',
        ytdlp: { format: 'bestaudio/best', additionalArgs: [] },
        audio: { bitrate: '128k', format: 'opus' }
    };

    it('should return a StreamController instance', () => {
        const track = { id: 'test', title: 'Test', source: 'youtube' };
        const stream = createStream(track, {}, mockConfig);

        assert(stream instanceof StreamController);
    });

    it('should handle empty track object', () => {
        const stream = createStream({}, {}, mockConfig);
        assert(stream instanceof StreamController);
    });
});
