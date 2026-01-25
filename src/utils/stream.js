const activeStreams = new Map();
let emitter = null;

function setEventEmitter(eventEmitter) {
    emitter = eventEmitter;
}

function registerStream(id, streamData) {
    const data = {
        ...streamData,
        startTime: Date.now(),
        streamStartTime: Date.now(),
        seekOffset: streamData.filters?.start || 0,
        paused: false,
        pausedAt: null
    };
    activeStreams.set(id, data);

    if (emitter) {
        emitter.emit('streamStart', {
            id,
            source: streamData.source,
            trackId: streamData.videoId || streamData.trackId || id,
            filters: streamData.filters || {},
            startTime: data.startTime
        });
    }
}

function unregisterStream(id, code = 0, error = null) {
    const stream = activeStreams.get(id);
    if (!stream) return;

    activeStreams.delete(id);

    if (emitter) {
        if (error) {
            emitter.emit('streamError', {
                id,
                source: stream.source,
                trackId: stream.videoId || stream.trackId || id,
                filters: stream.filters || {},
                startTime: stream.startTime,
                error
            });
        } else {
            emitter.emit('streamEnd', {
                id,
                source: stream.source,
                trackId: stream.videoId || stream.trackId || id,
                filters: stream.filters || {},
                startTime: stream.startTime,
                duration: Date.now() - stream.startTime,
                code
            });
        }
    }
}

function getActiveStreams() {
    return activeStreams;
}

function getStreamPosition(id) {
    const stream = activeStreams.get(id);
    if (!stream) return null;

    const elapsed = (Date.now() - stream.streamStartTime) / 1000;
    return stream.seekOffset + elapsed;
}

function getStreamById(id) {
    return activeStreams.get(id);
}

function updateStreamFilters(id, newFilters) {
    const stream = activeStreams.get(id);
    if (!stream) return null;

    stream.filters = { ...stream.filters, ...newFilters };
    return stream;
}

function killAllStreams() {
    for (const [id, stream] of activeStreams) {
        if (stream.ytdlp && !stream.ytdlp.killed) {
            stream.ytdlp.kill('SIGTERM');
        }
        if (stream.ffmpeg && !stream.ffmpeg.killed) {
            stream.ffmpeg.kill('SIGTERM');
        }
    }
    activeStreams.clear();
}

process.on('SIGTERM', killAllStreams);
process.on('SIGINT', killAllStreams);

module.exports = {
    registerStream,
    unregisterStream,
    getActiveStreams,
    getStreamById,
    getStreamPosition,
    updateStreamFilters,
    killAllStreams,
    setEventEmitter
};
