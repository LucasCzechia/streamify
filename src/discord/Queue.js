class Queue {
    constructor(options = {}) {
        this.tracks = [];
        this.previous = [];
        this.current = null;
        this.maxPreviousTracks = options.maxPreviousTracks || 25;
        this.repeatMode = 'off';
    }

    add(track, position) {
        if (position !== undefined && position >= 0 && position < this.tracks.length) {
            this.tracks.splice(position, 0, track);
        } else {
            this.tracks.push(track);
        }
        return this.tracks.length;
    }

    addMany(tracks, position) {
        if (position !== undefined && position >= 0 && position < this.tracks.length) {
            this.tracks.splice(position, 0, ...tracks);
        } else {
            this.tracks.push(...tracks);
        }
        return this.tracks.length;
    }

    remove(index) {
        if (index < 0 || index >= this.tracks.length) {
            return null;
        }
        return this.tracks.splice(index, 1)[0];
    }

    clear() {
        const cleared = this.tracks.length;
        this.tracks = [];
        return cleared;
    }

    shuffle() {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
        return this.tracks.length;
    }

    move(from, to) {
        if (from < 0 || from >= this.tracks.length) return false;
        if (to < 0 || to >= this.tracks.length) return false;

        const track = this.tracks.splice(from, 1)[0];
        this.tracks.splice(to, 0, track);
        return true;
    }

    shift() {
        if (this.current) {
            this.previous.unshift(this.current);
            if (this.previous.length > this.maxPreviousTracks) {
                this.previous.pop();
            }
        }

        if (this.repeatMode === 'track' && this.current) {
            return this.current;
        }

        if (this.repeatMode === 'queue' && this.tracks.length === 0 && this.previous.length > 0) {
            this.tracks = [...this.previous].reverse();
            this.previous = [];
        }

        this.current = this.tracks.shift() || null;
        return this.current;
    }

    unshift() {
        if (this.previous.length === 0) {
            return null;
        }

        if (this.current) {
            this.tracks.unshift(this.current);
        }

        this.current = this.previous.shift();
        return this.current;
    }

    setCurrent(track) {
        this.current = track;
    }

    setRepeatMode(mode) {
        if (['off', 'track', 'queue'].includes(mode)) {
            this.repeatMode = mode;
            return true;
        }
        return false;
    }

    get size() {
        return this.tracks.length;
    }

    get isEmpty() {
        return this.tracks.length === 0;
    }

    get totalDuration() {
        let duration = this.current?.duration || 0;
        duration += this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
        return duration;
    }

    toJSON() {
        return {
            current: this.current,
            tracks: this.tracks,
            previous: this.previous,
            repeatMode: this.repeatMode,
            size: this.size
        };
    }
}

module.exports = Queue;
