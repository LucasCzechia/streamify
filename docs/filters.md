# Audio Filters

Filters are applied in real-time via ffmpeg. When you change a filter during playback, Streamify uses **Seamless Transitions** to prepare the new stream in the background and swap it instantly once ready, ensuring no audio gaps.

## Available Filters

| Filter | Type | Range | Description |
|--------|------|-------|-------------|
| `bass` | number | -20 to 20 | Bass boost/cut in dB |
| `treble` | number | -20 to 20 | Treble boost/cut in dB |
| `speed` | number | 0.5 to 2.0 | Playback speed |
| `pitch` | number | 0.5 to 2.0 | Pitch shift |
| `volume` | number | 0 to 200 | Volume percentage |
| `tremolo` | object | see below | Volume oscillation |
| `vibrato` | object | see below | Pitch oscillation |
| `rotation` | object | see below | Audio rotation (8D) |
| `lowpass` | number | 100 to 20000 | Low-pass filter (Hz) |
| `highpass` | number | 20 to 10000 | High-pass filter (Hz) |
| `karaoke` | boolean | — | Reduce vocals |
| `nightcore` | boolean | — | Speed + pitch up preset |
| `vaporwave` | boolean | — | Speed + pitch down preset |
| `bassboost` | boolean | — | Strong bass boost preset |
| `8d` | boolean | — | 8D panning effect |

## Usage (Discord Player)

```javascript
// Set individual filters
await player.setFilter('bass', 10);
await player.setFilter('treble', 5);
await player.setFilter('speed', 1.25);
await player.setFilter('volume', 120);

// Object filters
await player.setFilter('tremolo', { frequency: 4, depth: 0.5 });
await player.setFilter('vibrato', { frequency: 4, depth: 0.5 });
await player.setFilter('rotation', { speed: 0.125 });

// Frequency filters
await player.setFilter('lowpass', 1000);   // Cut above 1000Hz
await player.setFilter('highpass', 200);   // Cut below 200Hz

// Presets (boolean)
await player.setFilter('nightcore', true);
await player.setFilter('vaporwave', true);
await player.setFilter('bassboost', true);
await player.setFilter('karaoke', true);
await player.setFilter('8d', true);

// Clear all filters
await player.clearFilters();

// Get current filters
console.log(player.filters);
// { bass: 10, nightcore: true, ... }
```

## Usage (HTTP Server)

```javascript
// Add filters as query parameters
const url = streamify.youtube.getStreamUrl('dQw4w9WgXcQ', {
    bass: 10,
    speed: 1.25,
    nightcore: true
});
// http://127.0.0.1:8787/youtube/stream/dQw4w9WgXcQ?bass=10&speed=1.25&nightcore=true
```

## Filter Details

### Tremolo
Volume oscillation effect.

```javascript
await player.setFilter('tremolo', {
    frequency: 4,    // 0.1 to 20 Hz
    depth: 0.5       // 0 to 1
});
```

### Vibrato
Pitch oscillation effect.

```javascript
await player.setFilter('vibrato', {
    frequency: 4,    // 0.1 to 14 Hz
    depth: 0.5       // 0 to 1
});
```

### Rotation
Advanced 8D effect with configurable speed.

```javascript
await player.setFilter('rotation', {
    speed: 0.125     // 0.01 to 5 rotations per second
});
```

### Karaoke
Reduces vocals by removing the center channel. Works best on stereo tracks with centered vocals.

```javascript
await player.setFilter('karaoke', true);
```

## Presets

### Nightcore
Speeds up and raises pitch for that anime soundtrack feel.

- Speed: 1.25x
- Pitch: 1.25x

### Vaporwave
Slows down and lowers pitch for that aesthetic.

- Speed: 0.8x
- Pitch: 0.8x

### Bassboost
Strong bass boost (+10dB).

### 8D
Audio pans around in a circle. Same as `rotation` with speed 0.125.

## Combining Filters

Filters can be combined:

```javascript
await player.setFilter('bass', 10);
await player.setFilter('speed', 1.25);
await player.setFilter('8d', true);
// All three active simultaneously
```

Note: `nightcore` and `vaporwave` both modify speed/pitch, so using both may produce unexpected results.

## 15-Band Equalizer

Fine-grained control over frequency response with 15 bands.

### Bands

| Band | Frequency |
|------|-----------|
| 0 | 25 Hz |
| 1 | 40 Hz |
| 2 | 63 Hz |
| 3 | 100 Hz |
| 4 | 160 Hz |
| 5 | 250 Hz |
| 6 | 400 Hz |
| 7 | 630 Hz |
| 8 | 1000 Hz |
| 9 | 1600 Hz |
| 10 | 2500 Hz |
| 11 | 4000 Hz |
| 12 | 6300 Hz |
| 13 | 10000 Hz |
| 14 | 16000 Hz |

### Usage

```javascript
// Set custom EQ (15 band values, -0.25 to 1.0)
await player.setEQ([
    0.3,   // 25 Hz (sub bass)
    0.25,  // 40 Hz
    0.2,   // 63 Hz
    0.1,   // 100 Hz
    0,     // 160 Hz
    -0.1,  // 250 Hz
    0,     // 400 Hz
    0.1,   // 630 Hz
    0.2,   // 1000 Hz
    0.25,  // 1600 Hz
    0.3,   // 2500 Hz
    0.3,   // 4000 Hz
    0.25,  // 6300 Hz
    0.2,   // 10000 Hz
    0.15   // 16000 Hz
]);

// Clear EQ
await player.clearEQ();
```

## EQ Presets

Built-in presets for common genres and use cases.

### Available Presets

| Preset | Description |
|--------|-------------|
| `flat` | No EQ changes |
| `rock` | Enhanced mids and highs |
| `pop` | Balanced with slight bass |
| `jazz` | Warm, smooth sound |
| `classical` | Wide, natural sound |
| `electronic` | Heavy bass, crisp highs |
| `hiphop` | Deep bass, clear vocals |
| `acoustic` | Natural, warm |
| `rnb` | Smooth bass, warm mids |
| `latin` | Punchy, rhythmic |
| `loudness` | Overall boost |
| `piano` | Clear mids |
| `vocal` | Enhanced vocal range |
| `bass_heavy` | Maximum bass |
| `treble_heavy` | Maximum highs |

### Usage

```javascript
// Apply preset
await player.setPreset('rock');
await player.setPreset('electronic');

// List available presets
const presets = player.getPresets();
// ['flat', 'rock', 'pop', ...]

// Clear preset
await player.clearEQ();
```

## Biquad Filters

Professional-grade frequency filters.

### Bandpass

Only allows frequencies within a range.

```javascript
await player.setFilter('bandpass', {
    frequency: 1000,  // Center frequency (Hz)
    width: 200        // Bandwidth (Hz)
});
```

### Band Reject (Notch)

Removes frequencies within a range.

```javascript
await player.setFilter('bandreject', {
    frequency: 1000,
    width: 200
});
```

### Low Shelf

Boosts or cuts frequencies below a point.

```javascript
await player.setFilter('lowshelf', {
    frequency: 200,   // Cutoff frequency (Hz)
    gain: 6           // dB (-20 to 20)
});
```

### High Shelf

Boosts or cuts frequencies above a point.

```javascript
await player.setFilter('highshelf', {
    frequency: 3000,
    gain: 6
});
```

### Peaking EQ

Boosts or cuts a specific frequency range.

```javascript
await player.setFilter('peaking', {
    frequency: 1000,  // Center frequency
    gain: 6,          // dB
    q: 1              // Width (higher = narrower)
});
```

## Effect Presets (Stacked)

Streamify supports "Effect Presets" which can be stacked on top of each other. These are more powerful than standard filters because they can combine multiple FFmpeg settings.

### Available Effect Presets

| Preset | Description |
|--------|-------------|
| `bassboost` | Strong low-end boost |
| `subboost` | Extreme sub-woofer boost |
| `nightcore` | High speed and pitch |
| `vaporwave` | Low speed and pitch |
| `reverb` | Adds room acoustics / echo |
| `surround` | Virtual surround sound mapping |
| `boost` | General volume and clarity boost |
| `karaoke` | Vocal reduction |
| `8d` | Fast circular panning |

### Usage

```javascript
// Set a single effect with intensity (0.0 to 2.0)
await player.setEffectPresets({ name: 'reverb', intensity: 0.8 });

// Stack multiple effects
await player.setEffectPresets([
    { name: 'bassboost', intensity: 1.2 },
    { name: 'nightcore', intensity: 1.0 }
]);

// Clear all effects
await player.clearEffectPresets();

// Get active effects
const active = player.getActiveEffectPresets();
// [{ name: 'reverb', intensity: 0.8 }]
```

## Additional Effects

| Effect | Description |
|--------|-------------|
| `flanger` | Sweeping comb filter effect |
| `phaser` | Phase-shifting effect |
| `chorus` | Thickens sound with slight detuning |
| `compressor` | Dynamic range compression |
| `normalizer` | Loudness normalization |
| `mono` | Convert stereo to mono |
| `surround` | Surround sound effect |

```javascript
await player.setFilter('flanger', true);
await player.setFilter('phaser', true);
await player.setFilter('chorus', true);
await player.setFilter('compressor', true);
await player.setFilter('normalizer', true);
await player.setFilter('mono', true);
```
