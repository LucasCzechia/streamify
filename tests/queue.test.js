const test = require('node:test');
const assert = require('node:assert');
const Queue = require('../src/discord/Queue');

test('Queue: management', async (t) => {
    await t.test('should add tracks', () => {
        const queue = new Queue();
        queue.add({ id: '1', title: 'Track 1' });
        queue.add({ id: '2', title: 'Track 2' });
        assert.strictEqual(queue.size, 2);
        assert.strictEqual(queue.tracks[0].id, '1');
    });

    await t.test('should add many tracks', () => {
        const queue = new Queue();
        queue.addMany([{ id: '1' }, { id: '2' }]);
        assert.strictEqual(queue.size, 2);
    });

    await t.test('should remove tracks', () => {
        const queue = new Queue();
        queue.addMany([{ id: '1' }, { id: '2' }]);
        const removed = queue.remove(0);
        assert.strictEqual(removed.id, '1');
        assert.strictEqual(queue.size, 1);
    });

    await t.test('should move tracks', () => {
        const queue = new Queue();
        queue.addMany([{ id: '1' }, { id: '2' }, { id: '3' }]);
        queue.move(2, 0); // Move '3' to front
        assert.strictEqual(queue.tracks[0].id, '3');
        assert.strictEqual(queue.tracks[1].id, '1');
    });

    await t.test('should shift tracks and track history', () => {
        const queue = new Queue({ maxPreviousTracks: 2 });
        const t1 = { id: '1' };
        const t2 = { id: '2' };
        const t3 = { id: '3' };
        
        queue.addMany([t1, t2, t3]);
        
        assert.strictEqual(queue.shift().id, '1');
        assert.strictEqual(queue.current.id, '1');
        
        assert.strictEqual(queue.shift().id, '2');
        assert.strictEqual(queue.previous[0].id, '1');
        
        assert.strictEqual(queue.shift().id, '3');
        assert.strictEqual(queue.previous[0].id, '2');
        assert.strictEqual(queue.previous[1].id, '1');
    });

    await t.test('should handle repeat track mode', () => {
        const queue = new Queue();
        const t1 = { id: '1' };
        queue.add(t1);
        queue.shift(); // current = t1
        
        queue.setRepeatMode('track');
        assert.strictEqual(queue.shift().id, '1');
        assert.strictEqual(queue.shift().id, '1');
    });

    await t.test('should handle repeat queue mode', () => {
        const queue = new Queue();
        const t1 = { id: '1' };
        const t2 = { id: '2' };
        queue.addMany([t1, t2]);
        
        queue.setRepeatMode('queue');
        queue.shift(); // current = t1
        queue.shift(); // current = t2
        
        assert.strictEqual(queue.shift().id, '1');
        assert.strictEqual(queue.current.id, '1');
    });

    await t.test('should unshift (previous)', () => {
        const queue = new Queue();
        const t1 = { id: '1' };
        const t2 = { id: '2' };
        queue.addMany([t1, t2]);
        
        queue.shift(); // current = t1
        queue.shift(); // current = t2
        
        const prev = queue.unshift();
        assert.strictEqual(prev.id, '1');
        assert.strictEqual(queue.current.id, '1');
        assert.strictEqual(queue.tracks[0].id, '2');
    });
});
