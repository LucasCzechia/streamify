const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    buildFfmpegArgs,
    getAvailableFilters,
    getPresets,
    getEffectPresets,
    applyEffectPreset,
    PRESETS,
    EFFECT_PRESETS
} = require('../src/filters/ffmpeg');

describe('FFmpeg Filters - Edge Cases', () => {
    const mockConfig = {
        audio: {
            bitrate: '128k',
            format: 'opus',
            vbr: true,
            compressionLevel: 10,
            application: 'audio'
        }
    };

    describe('buildFfmpegArgs boundary values', () => {
        it('should clamp bass to -20', () => {
            const args = buildFfmpegArgs({ bass: -50 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('bass=g=-20'), 'Should clamp to -20');
        });

        it('should clamp bass to 20', () => {
            const args = buildFfmpegArgs({ bass: 100 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('bass=g=20'), 'Should clamp to 20');
        });

        it('should clamp treble to -20', () => {
            const args = buildFfmpegArgs({ treble: -100 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('treble=g=-20'), 'Should clamp to -20');
        });

        it('should clamp treble to 20', () => {
            const args = buildFfmpegArgs({ treble: 50 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('treble=g=20'), 'Should clamp to 20');
        });

        it('should clamp speed to 0.5', () => {
            const args = buildFfmpegArgs({ speed: 0.1 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('atempo=0.5'), 'Should clamp to 0.5');
        });

        it('should clamp speed to 2.0', () => {
            const args = buildFfmpegArgs({ speed: 5 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('atempo=2'), 'Should clamp to 2.0');
        });

        it('should clamp pitch to 0.5', () => {
            const args = buildFfmpegArgs({ pitch: 0.1 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('asetrate=48000*0.5'), 'Should clamp to 0.5');
        });

        it('should clamp pitch to 2.0', () => {
            const args = buildFfmpegArgs({ pitch: 10 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('asetrate=48000*2'), 'Should clamp to 2.0');
        });

        it('should clamp volume to 0', () => {
            const args = buildFfmpegArgs({ volume: -100 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('volume=0'), 'Should clamp to 0');
        });

        it('should clamp volume to 200', () => {
            const args = buildFfmpegArgs({ volume: 500 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('volume=2'), 'Should clamp to 200% (2x)');
        });

        it('should clamp lowpass to 100 minimum', () => {
            const args = buildFfmpegArgs({ lowpass: 10 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('lowpass=f=100'), 'Should clamp to 100');
        });

        it('should clamp lowpass to 20000 maximum', () => {
            const args = buildFfmpegArgs({ lowpass: 50000 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('lowpass=f=20000'), 'Should clamp to 20000');
        });

        it('should clamp highpass to 20 minimum', () => {
            const args = buildFfmpegArgs({ highpass: 5 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('highpass=f=20'), 'Should clamp to 20');
        });

        it('should clamp highpass to 10000 maximum', () => {
            const args = buildFfmpegArgs({ highpass: 50000 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('highpass=f=10000'), 'Should clamp to 10000');
        });
    });

    describe('filter type coercion', () => {
        it('should handle string numbers for bass', () => {
            const args = buildFfmpegArgs({ bass: '10' }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(afIndex > -1, 'Should have -af flag');
            assert(args[afIndex + 1].includes('bass=g=10'), 'Should parse string to number');
        });

        it('should handle string numbers for volume', () => {
            const args = buildFfmpegArgs({ volume: '150' }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('volume=1.5'), 'Should parse string volume');
        });

        it('should handle string "true" for boolean filters', () => {
            const args = buildFfmpegArgs({ karaoke: 'true' }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('pan=stereo'), 'Should handle string true');
        });

        it('should ignore NaN values', () => {
            const args = buildFfmpegArgs({ bass: 'notanumber' }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(!filterStr.includes('bass=g=NaN'), 'Should not include NaN');
        });

        it('should ignore null values', () => {
            const args = buildFfmpegArgs({ bass: null }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(!filterStr.includes('bass'), 'Should skip null bass');
        });

        it('should ignore undefined values', () => {
            const args = buildFfmpegArgs({ bass: undefined }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(!filterStr.includes('bass'), 'Should skip undefined bass');
        });
    });

    describe('equalizer edge cases', () => {
        it('should handle empty equalizer array', () => {
            const args = buildFfmpegArgs({ equalizer: [] }, mockConfig);
            assert(args, 'Should not crash');
        });

        it('should handle partial equalizer array', () => {
            const args = buildFfmpegArgs({ equalizer: [0.5, 0.3] }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('equalizer'), 'Should apply partial eq');
        });

        it('should handle oversized equalizer array', () => {
            const bigEq = Array(30).fill(0.5);
            const args = buildFfmpegArgs({ equalizer: bigEq }, mockConfig);
            assert(args, 'Should not crash with oversized array');
        });

        it('should clamp equalizer values to -0.25', () => {
            const args = buildFfmpegArgs({ equalizer: [-1, -1, -1] }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('g=-3'), 'Should clamp gain (12 * -0.25 = -3)');
        });

        it('should clamp equalizer values to 1.0', () => {
            const args = buildFfmpegArgs({ equalizer: [2, 2, 2] }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            assert(filterStr.includes('g=12'), 'Should clamp gain (12 * 1.0 = 12)');
        });

        it('should skip zero equalizer values', () => {
            const args = buildFfmpegArgs({ equalizer: [0, 0, 0, 0.5, 0] }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            const eqCount = (filterStr.match(/equalizer=/g) || []).length;
            assert.strictEqual(eqCount, 1, 'Should only have one eq band');
        });
    });

    describe('tremolo/vibrato edge cases', () => {
        it('should clamp tremolo frequency', () => {
            const args = buildFfmpegArgs({ tremolo: { frequency: 100, depth: 0.5 } }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('tremolo=f=20'), 'Should clamp to 20');
        });

        it('should clamp tremolo depth', () => {
            const args = buildFfmpegArgs({ tremolo: { frequency: 5, depth: 5 } }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('d=1'), 'Should clamp to 1');
        });

        it('should clamp vibrato frequency', () => {
            const args = buildFfmpegArgs({ vibrato: { frequency: 100, depth: 0.5 } }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('vibrato=f=14'), 'Should clamp to 14');
        });

        it('should use defaults for missing tremolo values', () => {
            const args = buildFfmpegArgs({ tremolo: {} }, mockConfig);
            const afIndex = args.indexOf('-af');
            assert(args[afIndex + 1].includes('tremolo=f=4:d=0.5'), 'Should use defaults');
        });
    });

    describe('output format variations', () => {
        it('should output opus by default', () => {
            const args = buildFfmpegArgs({}, mockConfig);
            assert(args.includes('libopus'), 'Should use libopus');
            assert(args.includes('-f') && args[args.indexOf('-f') + 1] === 'ogg');
        });

        it('should output mp3 when configured', () => {
            const mp3Config = { ...mockConfig, audio: { ...mockConfig.audio, format: 'mp3' } };
            const args = buildFfmpegArgs({}, mp3Config);
            assert(args.includes('libmp3lame'), 'Should use libmp3lame');
        });

        it('should output aac when configured', () => {
            const aacConfig = { ...mockConfig, audio: { ...mockConfig.audio, format: 'aac' } };
            const args = buildFfmpegArgs({}, aacConfig);
            assert(args.includes('aac'), 'Should use aac');
        });

        it('should respect custom bitrate', () => {
            const customConfig = { ...mockConfig, audio: { ...mockConfig.audio, bitrate: '320k' } };
            const args = buildFfmpegArgs({}, customConfig);
            assert(args.includes('320k'), 'Should use custom bitrate');
        });
    });

    describe('multiple filters combined', () => {
        it('should combine all filter types', () => {
            const filters = {
                bass: 5,
                treble: 3,
                speed: 1.2,
                volume: 120,
                karaoke: true,
                echo: true,
                compressor: true
            };
            const args = buildFfmpegArgs(filters, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];

            assert(filterStr.includes('bass'), 'Should have bass');
            assert(filterStr.includes('treble'), 'Should have treble');
            assert(filterStr.includes('atempo'), 'Should have speed');
            assert(filterStr.includes('volume'), 'Should have volume');
            assert(filterStr.includes('pan=stereo'), 'Should have karaoke');
            assert(filterStr.includes('aecho'), 'Should have echo');
            assert(filterStr.includes('acompressor'), 'Should have compressor');
        });

        it('should maintain filter order', () => {
            const args = buildFfmpegArgs({ bass: 5, treble: 5 }, mockConfig);
            const afIndex = args.indexOf('-af');
            const filterStr = args[afIndex + 1];
            const bassPos = filterStr.indexOf('bass');
            const treblePos = filterStr.indexOf('treble');
            assert(bassPos < treblePos, 'Bass should come before treble');
        });
    });

    describe('preset functions', () => {
        it('should have all documented presets', () => {
            const presets = getPresets();
            const expected = ['flat', 'rock', 'pop', 'jazz', 'classical', 'electronic', 'hiphop', 'acoustic', 'rnb', 'latin', 'loudness', 'piano', 'vocal', 'bass_heavy', 'treble_heavy', 'extra_bass', 'crystal_clear'];

            for (const name of expected) {
                assert(presets[name], `Should have ${name} preset`);
            }
        });

        it('should have all effect presets', () => {
            const effects = getEffectPresets();
            const expected = ['bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke', 'trebleboost', 'deep', 'lofi', 'radio', 'telephone', 'soft', 'loud', 'chipmunk', 'darth', 'echo', 'vibrato', 'tremolo', 'reverb', 'surround', 'boost', 'subboost'];

            for (const name of expected) {
                assert(effects[name], `Should have ${name} effect`);
            }
        });

        it('should apply effect preset with intensity', () => {
            const result = applyEffectPreset('bassboost', 0.5);
            assert(result, 'Should return filters');
            assert(typeof result.bass === 'number', 'Should have bass');
        });

        it('should return null for unknown preset', () => {
            const result = applyEffectPreset('nonexistent');
            assert.strictEqual(result, null);
        });

        it('should scale intensity correctly', () => {
            const full = applyEffectPreset('bassboost', 1.0);
            const half = applyEffectPreset('bassboost', 0.5);

            if (full.bass && half.bass) {
                assert(half.bass < full.bass, 'Half intensity should have less bass');
            }
        });
    });
});
