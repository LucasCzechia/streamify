const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const cache = require('../src/cache');

describe('Cache', () => {
    beforeEach(() => {
        cache.clear();
    });

    afterEach(() => {
        cache.clear();
    });

    describe('set and get', () => {
        it('should store and retrieve values', () => {
            cache.set('key1', 'value1');
            assert.strictEqual(cache.get('key1'), 'value1');
        });

        it('should store complex objects', () => {
            const obj = { id: 1, data: { nested: true }, arr: [1, 2, 3] };
            cache.set('obj', obj);
            assert.deepStrictEqual(cache.get('obj'), obj);
        });

        it('should store arrays', () => {
            const arr = [1, 2, 3, { a: 1 }];
            cache.set('arr', arr);
            assert.deepStrictEqual(cache.get('arr'), arr);
        });

        it('should store null values', () => {
            cache.set('null', null);
            assert.strictEqual(cache.get('null'), null);
        });

        it('should store zero', () => {
            cache.set('zero', 0);
            assert.strictEqual(cache.get('zero'), 0);
        });

        it('should store empty string', () => {
            cache.set('empty', '');
            assert.strictEqual(cache.get('empty'), '');
        });

        it('should store false', () => {
            cache.set('false', false);
            assert.strictEqual(cache.get('false'), false);
        });

        it('should overwrite existing values', () => {
            cache.set('key', 'value1');
            cache.set('key', 'value2');
            assert.strictEqual(cache.get('key'), 'value2');
        });

        it('should return null for non-existent keys', () => {
            assert.strictEqual(cache.get('nonexistent'), null);
        });
    });

    describe('TTL expiration', () => {
        it('should expire after TTL', async () => {
            cache.set('expiring', 'value', 0.1);
            assert.strictEqual(cache.get('expiring'), 'value');

            await new Promise(r => setTimeout(r, 150));

            assert.strictEqual(cache.get('expiring'), null);
        });

        it('should use default TTL of 300 seconds', () => {
            cache.set('default', 'value');
            const stats = cache.stats();
            assert.strictEqual(stats.valid, 1);
        });

        it('should handle zero TTL', async () => {
            cache.set('zero-ttl', 'value', 0);

            await new Promise(r => setTimeout(r, 10));

            assert.strictEqual(cache.get('zero-ttl'), null);
        });

        it('should handle negative TTL as immediate expiration', async () => {
            cache.set('negative-ttl', 'value', -1);

            await new Promise(r => setTimeout(r, 10));

            assert.strictEqual(cache.get('negative-ttl'), null);
        });
    });

    describe('del', () => {
        it('should delete existing keys', () => {
            cache.set('key', 'value');
            cache.del('key');
            assert.strictEqual(cache.get('key'), null);
        });

        it('should not throw for non-existent keys', () => {
            assert.doesNotThrow(() => cache.del('nonexistent'));
        });
    });

    describe('clear', () => {
        it('should remove all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            cache.clear();

            assert.strictEqual(cache.get('key1'), null);
            assert.strictEqual(cache.get('key2'), null);
            assert.strictEqual(cache.get('key3'), null);
        });

        it('should reset stats', () => {
            cache.set('key1', 'value1');
            cache.clear();

            const stats = cache.stats();
            assert.strictEqual(stats.entries, 0);
        });
    });

    describe('stats', () => {
        it('should count valid entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const stats = cache.stats();
            assert.strictEqual(stats.entries, 2);
            assert.strictEqual(stats.valid, 2);
            assert.strictEqual(stats.expired, 0);
        });

        it('should count expired entries', async () => {
            cache.set('expiring', 'value', 0.05);
            cache.set('valid', 'value', 300);

            await new Promise(r => setTimeout(r, 100));

            const stats = cache.stats();
            assert.strictEqual(stats.entries, 2);
            assert.strictEqual(stats.valid, 1);
            assert.strictEqual(stats.expired, 1);
        });

        it('should return zero for empty cache', () => {
            const stats = cache.stats();
            assert.strictEqual(stats.entries, 0);
            assert.strictEqual(stats.valid, 0);
            assert.strictEqual(stats.expired, 0);
        });
    });

    describe('edge cases', () => {
        it('should handle special characters in keys', () => {
            cache.set('key:with:colons', 'value');
            cache.set('key/with/slashes', 'value');
            cache.set('key with spaces', 'value');
            cache.set('key\nwith\nnewlines', 'value');

            assert.strictEqual(cache.get('key:with:colons'), 'value');
            assert.strictEqual(cache.get('key/with/slashes'), 'value');
            assert.strictEqual(cache.get('key with spaces'), 'value');
            assert.strictEqual(cache.get('key\nwith\nnewlines'), 'value');
        });

        it('should handle unicode keys', () => {
            cache.set('日本語キー', 'value');
            cache.set('emoji🎵key', 'value');

            assert.strictEqual(cache.get('日本語キー'), 'value');
            assert.strictEqual(cache.get('emoji🎵key'), 'value');
        });

        it('should handle very long keys', () => {
            const longKey = 'a'.repeat(10000);
            cache.set(longKey, 'value');
            assert.strictEqual(cache.get(longKey), 'value');
        });

        it('should handle very large values', () => {
            const largeValue = { data: 'x'.repeat(100000) };
            cache.set('large', largeValue);
            assert.deepStrictEqual(cache.get('large'), largeValue);
        });

        it('should handle undefined key gracefully', () => {
            assert.strictEqual(cache.get(undefined), null);
        });

        it('should handle null key gracefully', () => {
            assert.strictEqual(cache.get(null), null);
        });
    });

    describe('concurrency simulation', () => {
        it('should handle rapid set/get operations', () => {
            for (let i = 0; i < 1000; i++) {
                cache.set(`key${i}`, `value${i}`);
            }

            for (let i = 0; i < 1000; i++) {
                assert.strictEqual(cache.get(`key${i}`), `value${i}`);
            }

            const stats = cache.stats();
            assert.strictEqual(stats.entries, 1000);
        });

        it('should handle interleaved set/get/del', () => {
            for (let i = 0; i < 100; i++) {
                cache.set(`key${i}`, `value${i}`);
                if (i % 2 === 0) {
                    cache.del(`key${i}`);
                }
            }

            let found = 0;
            for (let i = 0; i < 100; i++) {
                if (cache.get(`key${i}`) !== null) found++;
            }

            assert.strictEqual(found, 50);
        });
    });
});
