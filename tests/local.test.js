const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const local = require('../src/providers/local');
const { loadConfig } = require('../src/config');

test('local provider: getInfo', async (t) => {
    const config = loadConfig();
    const testFile = path.resolve(__dirname, 'test-audio.mp3');
    
    // Create a dummy file for testing
    fs.writeFileSync(testFile, 'dummy audio content');

    try {
        await t.test('should return correct info for a local file', async () => {
            const info = await local.getInfo(testFile, config);
            
            assert.strictEqual(info.source, 'local');
            assert.strictEqual(info.title, 'test-audio.mp3');
            assert.ok(info.absolutePath.endsWith('tests/test-audio.mp3'));
            assert.strictEqual(info.uri, `file://${info.absolutePath}`);
        });

        await t.test('should throw error if file does not exist', async () => {
            await assert.rejects(
                local.getInfo('non-existent-file.mp3', config),
                { message: /File not found/ }
            );
        });
    } finally {
        // Cleanup
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }
});
