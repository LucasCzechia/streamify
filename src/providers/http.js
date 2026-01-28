const log = require('../utils/logger');

async function getInfo(url, config) {
    log.info('HTTP', `Getting info for direct URL: ${url}`);

    // For direct URLs, we can't easily get metadata without downloading or using ffprobe
    // For now, we'll return a basic object. 
    // In a full implementation, we might use ffprobe here.
    
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
