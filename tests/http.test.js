const test = require('node:test');
const assert = require('node:assert');
const httpProvider = require('../src/providers/http');
const { loadConfig } = require('../src/config');

test('http provider: getInfo', async (t) => {
    const config = loadConfig();
    const testUrl = 'https://example.com/music/track1.mp3?query=1';

    await t.test('should return basic info for a direct URL', async () => {
        const info = await httpProvider.getInfo(testUrl, config);
        
        assert.strictEqual(info.source, 'http');
        assert.strictEqual(info.title, 'track1.mp3');
        assert.strictEqual(info.uri, testUrl);
        assert.strictEqual(info.isLive, true);
        assert.ok(info.id);
    });

    await t.test('should handle URLs without clear filenames', async () => {
        const info = await httpProvider.getInfo('https://example.com/stream', config);
        assert.strictEqual(info.title, 'stream');
    });
});
