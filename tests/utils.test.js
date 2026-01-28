const test = require('node:test');
const assert = require('node:assert');
const { 
    registerStream, 
    unregisterStream, 
    getActiveStreams, 
    getStreamPosition,
    updateStreamFilters,
    setEventEmitter
} = require('../src/utils/stream');
const EventEmitter = require('events');

test('Utils: Stream Management', async (t) => {
    const emitter = new EventEmitter();
    setEventEmitter(emitter);

    await t.test('should register a stream and emit event', () => {
        let eventEmitted = false;
        emitter.once('streamStart', (data) => {
            assert.strictEqual(data.id, 'test-stream');
            eventEmitted = true;
        });

        registerStream('test-stream', { source: 'youtube', videoId: 'abc' });
        
        const active = getActiveStreams();
        assert.ok(active.has('test-stream'));
        assert.ok(eventEmitted);
    });

    await t.test('should update stream filters', () => {
        updateStreamFilters('test-stream', { volume: 80 });
        const stream = getActiveStreams().get('test-stream');
        assert.strictEqual(stream.filters.volume, 80);
    });

    await t.test('should get stream position', async () => {
        const pos1 = getStreamPosition('test-stream');
        assert.ok(typeof pos1 === 'number');
        
        await new Promise(r => setTimeout(r, 100));
        
        const pos2 = getStreamPosition('test-stream');
        assert.ok(pos2 > pos1);
    });

    await t.test('should unregister a stream and emit event', () => {
        let eventEmitted = false;
        emitter.once('streamEnd', (data) => {
            assert.strictEqual(data.id, 'test-stream');
            eventEmitted = true;
        });

        unregisterStream('test-stream');
        
        const active = getActiveStreams();
        assert.strictEqual(active.has('test-stream'), false);
        assert.ok(eventEmitted);
    });
});
