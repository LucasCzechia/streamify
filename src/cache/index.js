const cache = new Map();

function get(key) {
    const item = cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }

    return item.value;
}

function set(key, value, ttlSeconds = 300) {
    cache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

function del(key) {
    cache.delete(key);
}

function clear() {
    cache.clear();
}

function stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();

    for (const [key, item] of cache) {
        if (now > item.expiry) {
            expired++;
        } else {
            valid++;
        }
    }

    return {
        entries: cache.size,
        valid,
        expired
    };
}

function cleanup() {
    const now = Date.now();
    for (const [key, item] of cache) {
        if (now > item.expiry) {
            cache.delete(key);
        }
    }
}

setInterval(cleanup, 60000);

module.exports = { get, set, del, clear, stats };
