const test = require('node:test');
const assert = require('node:assert');
const { loadConfig, defaults } = require('../src/config');
const fs = require('fs');
const path = require('path');

test('Config: loading', async (t) => {
    await t.test('should load default values', () => {
        const config = loadConfig({ ytdlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg' }); // Provide paths to avoid check failure
        assert.strictEqual(config.port, defaults.port);
        assert.strictEqual(config.audio.bitrate, '128k');
    });

    await t.test('should respect environment variables', () => {
        process.env.PORT = '9999';
        process.env.SPOTIFY_CLIENT_ID = 'test-id';
        
        const config = loadConfig({ ytdlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg' });
        assert.strictEqual(config.port, 9999);
        assert.strictEqual(config.spotify.clientId, 'test-id');
        
        // Cleanup
        delete process.env.PORT;
        delete process.env.SPOTIFY_CLIENT_ID;
    });

    await t.test('should load from custom config file', () => {
        const configPath = path.resolve(__dirname, 'temp-config.json');
        const customConfig = {
            port: 1234,
            audio: { bitrate: '320k' }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(customConfig));
        
        try {
            const config = loadConfig({ configPath, ytdlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg' });
            assert.strictEqual(config.port, 1234);
            assert.strictEqual(config.audio.bitrate, '320k');
        } finally {
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        }
    });
});
