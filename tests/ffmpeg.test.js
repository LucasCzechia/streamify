const test = require('node:test');
const assert = require('node:assert');
const { buildFfmpegArgs, applyEffectPreset } = require('../src/filters/ffmpeg');

test('ffmpeg filters: buildFfmpegArgs', async (t) => {
    await t.test('should return default args with no filters', () => {
        const args = buildFfmpegArgs();
        assert.ok(args.includes('-acodec'));
        assert.ok(args.includes('libopus'));
        assert.ok(args.includes('-f'));
        assert.ok(args.includes('ogg'));
    });

    await t.test('should include volume filter', () => {
        const args = buildFfmpegArgs({ volume: 50 });
        const afIndex = args.indexOf('-af');
        assert.ok(afIndex !== -1);
        assert.ok(args[afIndex + 1].includes('volume=0.5'));
    });

    await t.test('should include bass filter', () => {
        const args = buildFfmpegArgs({ bass: 10 });
        const afIndex = args.indexOf('-af');
        assert.ok(args[afIndex + 1].includes('bass=g=10'));
    });

    await t.test('should include multiple filters', () => {
        const args = buildFfmpegArgs({ volume: 150, speed: 1.5 });
        const afIndex = args.indexOf('-af');
        assert.ok(args[afIndex + 1].includes('volume=1.5'));
        assert.ok(args[afIndex + 1].includes('atempo=1.5'));
    });

    await t.test('should handle nightcore preset', () => {
        const args = buildFfmpegArgs({ nightcore: true });
        const afIndex = args.indexOf('-af');
        assert.ok(args[afIndex + 1].includes('atempo=1.25'));
        assert.ok(args[afIndex + 1].includes('asetrate=48000*1.25'));
    });

    await t.test('should respect audio config', () => {
        const config = { audio: { bitrate: '192k', format: 'mp3' } };
        const args = buildFfmpegArgs({}, config);
        assert.ok(args.includes('192k'));
        assert.ok(args.includes('libmp3lame'));
        assert.ok(args.includes('mp3'));
    });
});

test('ffmpeg filters: applyEffectPreset', async (t) => {
    await t.test('should return correct filters for bassboost', () => {
        const effect = applyEffectPreset('bassboost');
        assert.strictEqual(effect.bass, 12);
        assert.ok(Array.isArray(effect.equalizer));
    });

    await t.test('should scale with intensity', () => {
        const effect = applyEffectPreset('bassboost', 0.5);
        assert.strictEqual(effect.bass, 6);
    });

    await t.test('should return null for unknown preset', () => {
        const effect = applyEffectPreset('nonexistent');
        assert.strictEqual(effect, null);
    });
});
