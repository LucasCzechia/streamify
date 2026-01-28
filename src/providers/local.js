const log = require('../utils/logger');
const path = require('path');
const fs = require('fs');

async function getInfo(filePath, config) {
    log.info('LOCAL', `Getting info for local file: ${filePath}`);

    // Validate path
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const filename = path.basename(absolutePath);

    return {
        id: Buffer.from(absolutePath).toString('base64'),
        title: filename,
        duration: 0, // Would need ffprobe for accuracy
        author: 'Local File',
        thumbnail: null,
        uri: `file://${absolutePath}`,
        streamUrl: `/local/stream/${Buffer.from(absolutePath).toString('base64')}`,
        source: 'local',
        isLive: false,
        absolutePath
    };
}

module.exports = { getInfo };
