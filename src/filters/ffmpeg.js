const EQ_BANDS = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

const PRESETS = {
    flat: Array(15).fill(0),
    rock: [0.3, 0.25, 0.2, 0.1, -0.05, -0.1, 0.1, 0.25, 0.35, 0.4, 0.4, 0.35, 0.3, 0.25, 0.2],
    pop: [0.2, 0.35, 0.4, 0.35, 0.2, 0, -0.1, -0.1, 0, 0.15, 0.2, 0.25, 0.3, 0.35, 0.35],
    jazz: [0.2, 0.15, 0.1, 0, -0.1, -0.1, 0, 0.1, 0.2, 0.25, 0.25, 0.2, 0.15, 0.1, 0.1],
    classical: [0.3, 0.25, 0.2, 0.15, 0.1, 0, -0.1, -0.1, 0, 0.1, 0.2, 0.25, 0.3, 0.35, 0.35],
    electronic: [0.4, 0.35, 0.25, 0, -0.1, -0.15, 0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.35, 0.3, 0.25],
    hiphop: [0.4, 0.35, 0.3, 0.2, 0.1, 0, -0.1, -0.1, 0, 0.15, 0.2, 0.15, 0.1, 0.1, 0.15],
    acoustic: [0.3, 0.25, 0.2, 0.15, 0.1, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.1, 0.15, 0.2, 0.25],
    rnb: [0.35, 0.4, 0.35, 0.2, 0.05, -0.05, 0, 0.1, 0.15, 0.15, 0.1, 0.05, 0.1, 0.15, 0.2],
    latin: [0.25, 0.2, 0.1, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.35, 0.35, 0.3, 0.25, 0.2],
    loudness: [0.4, 0.35, 0.25, 0.1, 0, -0.1, -0.1, 0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.45, 0.45],
    piano: [0.2, 0.15, 0.1, 0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.1, 0.15, 0.2],
    vocal: [-0.2, -0.15, -0.1, 0, 0.2, 0.35, 0.4, 0.4, 0.35, 0.2, 0, -0.1, -0.15, -0.15, -0.1],
    bass_heavy: [0.5, 0.45, 0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    treble_heavy: [0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.5]
};

function buildEqualizer(bands) {
    if (!bands || !Array.isArray(bands)) return null;

    const eqParts = [];
    for (let i = 0; i < Math.min(bands.length, 15); i++) {
        const gain = bands[i];
        if (typeof gain === 'number' && gain !== 0) {
            const clampedGain = Math.max(-0.25, Math.min(1.0, gain));
            const freq = EQ_BANDS[i];
            const width = freq < 1000 ? freq * 0.5 : freq * 0.3;
            eqParts.push(`equalizer=f=${freq}:width_type=h:width=${width}:g=${clampedGain * 12}`);
        }
    }

    return eqParts.length > 0 ? eqParts.join(',') : null;
}

function buildFfmpegArgs(filters = {}, config = {}) {
    const args = ['-i', 'pipe:0', '-vn'];
    const audioFilters = [];

    if (filters.equalizer && Array.isArray(filters.equalizer)) {
        const eq = buildEqualizer(filters.equalizer);
        if (eq) audioFilters.push(eq);
    }

    if (filters.preset && PRESETS[filters.preset]) {
        const eq = buildEqualizer(PRESETS[filters.preset]);
        if (eq) audioFilters.push(eq);
    }

    const bass = parseFloat(filters.bass);
    if (!isNaN(bass) && bass !== 0) {
        const clampedBass = Math.max(-20, Math.min(20, bass));
        audioFilters.push(`bass=g=${clampedBass}`);
    }

    const treble = parseFloat(filters.treble);
    if (!isNaN(treble) && treble !== 0) {
        const clampedTreble = Math.max(-20, Math.min(20, treble));
        audioFilters.push(`treble=g=${clampedTreble}`);
    }

    const speed = parseFloat(filters.speed);
    if (!isNaN(speed) && speed !== 1) {
        const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
        if (clampedSpeed < 1) {
            audioFilters.push(`atempo=${clampedSpeed}`);
        } else if (clampedSpeed <= 2) {
            audioFilters.push(`atempo=${clampedSpeed}`);
        }
    }

    const pitch = parseFloat(filters.pitch);
    if (!isNaN(pitch) && pitch !== 1) {
        const clampedPitch = Math.max(0.5, Math.min(2.0, pitch));
        audioFilters.push(`asetrate=48000*${clampedPitch},aresample=48000`);
    }

    const volume = parseFloat(filters.volume);
    if (!isNaN(volume) && volume !== 100) {
        const clampedVolume = Math.max(0, Math.min(200, volume));
        audioFilters.push(`volume=${clampedVolume / 100}`);
    }

    if (filters.tremolo) {
        const freq = parseFloat(filters.tremolo.frequency) || 4;
        const depth = parseFloat(filters.tremolo.depth) || 0.5;
        const clampedFreq = Math.max(0.1, Math.min(20, freq));
        const clampedDepth = Math.max(0, Math.min(1, depth));
        audioFilters.push(`tremolo=f=${clampedFreq}:d=${clampedDepth}`);
    }

    if (filters.vibrato) {
        const freq = parseFloat(filters.vibrato.frequency) || 4;
        const depth = parseFloat(filters.vibrato.depth) || 0.5;
        const clampedFreq = Math.max(0.1, Math.min(14, freq));
        const clampedDepth = Math.max(0, Math.min(1, depth));
        audioFilters.push(`vibrato=f=${clampedFreq}:d=${clampedDepth}`);
    }

    if (filters.rotation) {
        const rotSpeed = parseFloat(filters.rotation.speed) || 0.125;
        const clampedSpeed = Math.max(0.01, Math.min(5, rotSpeed));
        audioFilters.push(`apulsator=mode=sine:hz=${clampedSpeed}:width=1`);
    }

    if (filters.lowpass) {
        const freq = parseFloat(filters.lowpass);
        if (!isNaN(freq)) {
            const clampedFreq = Math.max(100, Math.min(20000, freq));
            audioFilters.push(`lowpass=f=${clampedFreq}`);
        }
    }

    if (filters.highpass) {
        const freq = parseFloat(filters.highpass);
        if (!isNaN(freq)) {
            const clampedFreq = Math.max(20, Math.min(10000, freq));
            audioFilters.push(`highpass=f=${clampedFreq}`);
        }
    }

    if (filters.bandpass) {
        const freq = parseFloat(filters.bandpass.frequency) || 1000;
        const width = parseFloat(filters.bandpass.width) || 200;
        audioFilters.push(`bandpass=f=${freq}:width_type=h:width=${width}`);
    }

    if (filters.bandreject || filters.notch) {
        const opt = filters.bandreject || filters.notch;
        const freq = parseFloat(opt.frequency) || 1000;
        const width = parseFloat(opt.width) || 200;
        audioFilters.push(`bandreject=f=${freq}:width_type=h:width=${width}`);
    }

    if (filters.lowshelf) {
        const freq = parseFloat(filters.lowshelf.frequency) || 200;
        const gain = parseFloat(filters.lowshelf.gain) || 0;
        audioFilters.push(`lowshelf=f=${freq}:g=${gain}`);
    }

    if (filters.highshelf) {
        const freq = parseFloat(filters.highshelf.frequency) || 3000;
        const gain = parseFloat(filters.highshelf.gain) || 0;
        audioFilters.push(`highshelf=f=${freq}:g=${gain}`);
    }

    if (filters.peaking) {
        const freq = parseFloat(filters.peaking.frequency) || 1000;
        const gain = parseFloat(filters.peaking.gain) || 0;
        const q = parseFloat(filters.peaking.q) || 1;
        audioFilters.push(`equalizer=f=${freq}:width_type=q:width=${q}:g=${gain}`);
    }

    if (filters.karaoke === 'true' || filters.karaoke === true) {
        audioFilters.push('pan=stereo|c0=c0-c1|c1=c1-c0');
    }

    if (filters.mono === 'true' || filters.mono === true) {
        audioFilters.push('pan=mono|c0=0.5*c0+0.5*c1');
    }

    if (filters.surround === 'true' || filters.surround === true) {
        audioFilters.push('surround');
    }

    if (filters.flanger === 'true' || filters.flanger === true) {
        audioFilters.push('flanger');
    }

    if (filters.phaser === 'true' || filters.phaser === true) {
        audioFilters.push('aphaser');
    }

    if (filters.chorus === 'true' || filters.chorus === true) {
        audioFilters.push('chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3');
    }

    if (filters.compressor === 'true' || filters.compressor === true) {
        audioFilters.push('acompressor=threshold=-20dB:ratio=4:attack=5:release=50');
    }

    if (filters.normalizer === 'true' || filters.normalizer === true) {
        audioFilters.push('loudnorm');
    }

    if (filters.nightcore === 'true' || filters.nightcore === true) {
        audioFilters.push('atempo=1.25');
        audioFilters.push('asetrate=48000*1.25,aresample=48000');
    }

    if (filters.vaporwave === 'true' || filters.vaporwave === true) {
        audioFilters.push('atempo=0.8');
        audioFilters.push('asetrate=48000*0.8,aresample=48000');
    }

    if (filters.bassboost === 'true' || filters.bassboost === true) {
        audioFilters.push('bass=g=10');
    }

    if (filters['8d'] === 'true' || filters['8d'] === true) {
        audioFilters.push('apulsator=mode=sine:hz=0.125');
    }

    if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
    }

    const bitrate = config.audio?.bitrate || '128k';
    const format = config.audio?.format || 'opus';

    if (format === 'opus') {
        args.push('-acodec', 'libopus', '-b:a', bitrate, '-f', 'ogg');
    } else if (format === 'mp3') {
        args.push('-acodec', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3');
    } else if (format === 'aac') {
        args.push('-acodec', 'aac', '-b:a', bitrate, '-f', 'adts');
    } else {
        args.push('-acodec', 'libopus', '-b:a', bitrate, '-f', 'ogg');
    }

    args.push('-');

    return args;
}

function getAvailableFilters() {
    return {
        bass: { type: 'number', min: -20, max: 20, description: 'Bass boost/cut in dB' },
        treble: { type: 'number', min: -20, max: 20, description: 'Treble boost/cut in dB' },
        speed: { type: 'number', min: 0.5, max: 2.0, description: 'Playback speed multiplier' },
        pitch: { type: 'number', min: 0.5, max: 2.0, description: 'Pitch shift multiplier' },
        volume: { type: 'number', min: 0, max: 200, description: 'Volume percentage' },
        equalizer: { type: 'array', length: 15, itemType: 'number', min: -0.25, max: 1.0, description: '15-band equalizer (bands 0-14)' },
        preset: { type: 'string', values: Object.keys(PRESETS), description: 'EQ preset name' },
        tremolo: { type: 'object', properties: { frequency: { min: 0.1, max: 20 }, depth: { min: 0, max: 1 } }, description: 'Tremolo effect' },
        vibrato: { type: 'object', properties: { frequency: { min: 0.1, max: 14 }, depth: { min: 0, max: 1 } }, description: 'Vibrato effect' },
        rotation: { type: 'object', properties: { speed: { min: 0.01, max: 5 } }, description: 'Audio rotation (8D)' },
        lowpass: { type: 'number', min: 100, max: 20000, description: 'Low-pass filter (Hz)' },
        highpass: { type: 'number', min: 20, max: 10000, description: 'High-pass filter (Hz)' },
        bandpass: { type: 'object', properties: { frequency: {}, width: {} }, description: 'Band-pass filter' },
        bandreject: { type: 'object', properties: { frequency: {}, width: {} }, description: 'Band-reject/notch filter' },
        lowshelf: { type: 'object', properties: { frequency: {}, gain: {} }, description: 'Low-shelf filter' },
        highshelf: { type: 'object', properties: { frequency: {}, gain: {} }, description: 'High-shelf filter' },
        peaking: { type: 'object', properties: { frequency: {}, gain: {}, q: {} }, description: 'Peaking EQ filter' },
        karaoke: { type: 'boolean', description: 'Reduce vocals' },
        mono: { type: 'boolean', description: 'Convert to mono' },
        surround: { type: 'boolean', description: 'Surround sound effect' },
        flanger: { type: 'boolean', description: 'Flanger effect' },
        phaser: { type: 'boolean', description: 'Phaser effect' },
        chorus: { type: 'boolean', description: 'Chorus effect' },
        compressor: { type: 'boolean', description: 'Dynamic range compression' },
        normalizer: { type: 'boolean', description: 'Loudness normalization' },
        nightcore: { type: 'boolean', description: 'Nightcore preset' },
        vaporwave: { type: 'boolean', description: 'Vaporwave preset' },
        bassboost: { type: 'boolean', description: 'Bass boost preset' },
        '8d': { type: 'boolean', description: '8D audio effect' }
    };
}

function getPresets() {
    return PRESETS;
}

function getEQBands() {
    return EQ_BANDS;
}

module.exports = { buildFfmpegArgs, getAvailableFilters, getPresets, getEQBands, PRESETS, EQ_BANDS };
