const log = require('../utils/logger');

async function getInfo(url, config) {
    log.info('HTTP', `Getting info for direct URL: ${url}`);

    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL: URL must be a non-empty string');
    }

    try {
        new URL(url);
    } catch (e) {
        throw new Error(`Invalid URL format: ${url}`);
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Invalid URL protocol: ${url}`);
    }

    const filename = url.split('/').pop().split('?')[0] || 'Direct Audio';

    return {
        id: Buffer.from(url).toString('base64'),
        title: filename,
        duration: 0,
        author: 'Direct Link',
        thumbnail: null,
        uri: url,
        streamUrl: `/http/stream/${Buffer.from(url).toString('base64')}`,
        source: 'http',
        isLive: true // Treat as live/unknown duration
    };
}

module.exports = { getInfo };
