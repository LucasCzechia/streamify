# HTTP Endpoints

## YouTube

### Search

```
GET /youtube/search?q=query&limit=10
```

**Response:**
```json
{
    "tracks": [
        {
            "id": "dQw4w9WgXcQ",
            "title": "Rick Astley - Never Gonna Give You Up",
            "author": "Rick Astley",
            "duration": 213,
            "thumbnail": "https://...",
            "uri": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "streamUrl": "/youtube/stream/dQw4w9WgXcQ",
            "source": "youtube"
        }
    ],
    "source": "youtube",
    "searchTime": 1234
}
```

### Get Info

```
GET /youtube/info/:videoId
```

**Response:**
```json
{
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "author": "Rick Astley",
    "duration": 213,
    "thumbnail": "https://...",
    "uri": "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "streamUrl": "/youtube/stream/dQw4w9WgXcQ",
    "source": "youtube"
}
```

### Stream

```
GET /youtube/stream/:videoId
GET /youtube/stream/:videoId?bass=10&nightcore=true&start=30
```

**Query Parameters:**
- All [filters](../filters.md) are supported
- `start` - Seek to position in seconds

**Response:** Audio stream (`audio/ogg`)

## Spotify

### Search

```
GET /spotify/search?q=query&limit=10
```

### Get Info

```
GET /spotify/info/:trackId
```

### Stream

```
GET /spotify/stream/:trackId
GET /spotify/stream/:trackId?bass=10
```

Spotify tracks are resolved to YouTube and streamed from there.

## SoundCloud

### Search

```
GET /soundcloud/search?q=query&limit=10
```

### Stream

```
GET /soundcloud/stream/:trackUrl
```

Note: `trackUrl` should be URL-encoded.

## Stream Management

### List Active Streams

```
GET /streams
```

**Response:**
```json
{
    "streams": [
        {
            "id": "yt-dQw4w9WgXcQ-1234567890",
            "source": "youtube",
            "trackId": "dQw4w9WgXcQ",
            "filters": { "bass": 10 },
            "startTime": 1234567890,
            "bytesReceived": 1048576,
            "bytesSent": 524288
        }
    ],
    "count": 1
}
```

### Get Stream Info

```
GET /streams/:streamId
```

**Response:**
```json
{
    "id": "yt-dQw4w9WgXcQ-1234567890",
    "source": "youtube",
    "trackId": "dQw4w9WgXcQ",
    "filters": { "bass": 10 },
    "startTime": 1234567890,
    "elapsed": 45000,
    "bytesReceived": 1048576,
    "bytesSent": 524288
}
```

### Get Stream Position

```
GET /streams/:streamId/position
```

**Response:**
```json
{
    "position": 45.5,
    "elapsed": 45000
}
```

Position is in seconds, useful for seeking when applying filters.

## Filter Parameters

All stream endpoints accept filter query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bass` | number | -20 to 20 |
| `treble` | number | -20 to 20 |
| `speed` | number | 0.5 to 2.0 |
| `pitch` | number | 0.5 to 2.0 |
| `volume` | number | 0 to 200 |
| `nightcore` | boolean | true |
| `vaporwave` | boolean | true |
| `bassboost` | boolean | true |
| `8d` | boolean | true |
| `start` | number | Seek seconds |

**Example:**
```
GET /youtube/stream/dQw4w9WgXcQ?bass=10&speed=1.25&nightcore=true&start=30
```

## Error Responses

```json
{
    "error": "Track not found",
    "code": 404
}
```

Common error codes:
- `400` - Invalid parameters
- `404` - Track/stream not found
- `500` - Internal error (yt-dlp/ffmpeg failure)
