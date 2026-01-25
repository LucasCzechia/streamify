# Sponsorblock

Streamify integrates with [SponsorBlock](https://sponsor.ajay.app/) to automatically skip sponsored segments in YouTube videos.

## Configuration

```javascript
const manager = new Streamify.Manager(client, {
    sponsorblock: {
        enabled: true,
        categories: ['sponsor', 'selfpromo', 'intro', 'outro']
    }
});
```

## Categories

| Category | Description |
|----------|-------------|
| `sponsor` | Paid promotion, sponsored content |
| `selfpromo` | Self-promotion, merchandise, Patreon |
| `intro` | Intro animation, opening sequence |
| `outro` | Outro, end cards, credits |
| `preview` | Preview of other videos |
| `filler` | Tangents, jokes, off-topic |
| `interaction` | Subscribe reminders, like requests |
| `music_offtopic` | Non-music sections in music videos |

## Default Categories

By default, Streamify skips:
- `sponsor`
- `selfpromo`

```javascript
// Default behavior
sponsorblock: {
    enabled: true,
    categories: ['sponsor', 'selfpromo']
}
```

## Skip Everything

```javascript
sponsorblock: {
    enabled: true,
    categories: [
        'sponsor',
        'selfpromo',
        'intro',
        'outro',
        'preview',
        'filler',
        'interaction',
        'music_offtopic'
    ]
}
```

## Music Videos

For music, you might want:

```javascript
sponsorblock: {
    enabled: true,
    categories: ['sponsor', 'selfpromo', 'intro', 'outro', 'music_offtopic']
}
```

## Disabling

```javascript
sponsorblock: {
    enabled: false
}
```

Or omit the `sponsorblock` config entirely.

## How It Works

1. When a YouTube stream starts, yt-dlp queries the SponsorBlock API
2. Segment timestamps are fetched for the video
3. yt-dlp removes those segments during download
4. Audio plays seamlessly without the sponsored content

## Notes

- Only works with YouTube (Spotify/SoundCloud unaffected)
- Segments are crowdsourced and may not exist for all videos
- Popular videos have more complete segment data
- Occasionally segments may be slightly inaccurate
- No additional latency - segments are fetched during stream initialization
