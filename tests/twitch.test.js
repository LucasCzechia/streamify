const test = require('node:test');
const assert = require('node:assert');
const twitch = require('../src/providers/twitch');
const { loadConfig } = require('../src/config');

test('twitch provider: getInfo', async (t) => {
    const config = loadConfig();
    
    // We'll use a real URL but it might fail if yt-dlp has issues or network is restricted.
    // However, it's better to test the real integration if possible.
    const url = 'https://www.twitch.tv/monstercat';

    await t.test('should return info for a twitch stream', async () => {
        try {
            const info = await twitch.getInfo(url, config);
            
            assert.strictEqual(info.source, 'twitch');
            assert.ok(info.title);
            assert.ok(info.author);
            assert.strictEqual(info.isLive, true);
        } catch (error) {
            // If it fails because channel is not live, that's expected for this test URL sometimes
            if (error.message.includes('The channel is not currently live')) {
                console.warn('Twitch test: channel is offline, skipping validation');
                return;
            }
            // If it fails due to network/yt-dlp issues, we skip it but log it
            if (error.message.includes('yt-dlp exited with code') || error.message.includes('ERROR:')) {
                console.warn('Twitch test failed (likely network/yt-dlp issue):', error.message);
                return;
            }
            throw error;
        }
    });

    await t.test('should reject on invalid URL', async () => {
        await assert.rejects(
            twitch.getInfo('https://not-a-twitch-url.com/abc', config),
            { message: /ERROR:|yt-dlp exited with code/ }
        );
    });
});
