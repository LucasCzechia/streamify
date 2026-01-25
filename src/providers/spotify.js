const youtube = require('./youtube');
const log = require('../utils/logger');

let accessToken = null;
let tokenExpiry = 0;

const youtubeIdCache = new Map();
const CACHE_TTL = 300000;

async function getAccessToken(config) {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const { clientId, clientSecret } = config.spotify;
    if (!clientId || !clientSecret) {
        throw new Error('Spotify credentials not configured');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        throw new Error('Failed to get Spotify access token');
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    return accessToken;
}

async function spotifyApi(endpoint, config) {
    const token = await getAccessToken(config);
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
    }

    return response.json();
}

async function search(query, limit, config) {
    const startTime = Date.now();
    log.info('SPOTIFY', `Searching: "${query}" (limit: ${limit})`);

    const data = await spotifyApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, config);

    const tracks = (data.tracks?.items || []).map(track => ({
        id: track.id,
        title: track.name,
        author: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        thumbnail: track.album.images?.[0]?.url,
        uri: track.external_urls.spotify,
        streamUrl: `/spotify/stream/${track.id}`,
        source: 'spotify'
    }));

    const elapsed = Date.now() - startTime;
    log.info('SPOTIFY', `Found ${tracks.length} results (${elapsed}ms)`);
    return { tracks, source: 'spotify', searchTime: elapsed };
}

async function getInfo(trackId, config) {
    log.info('SPOTIFY', `Getting info: ${trackId}`);
    const track = await spotifyApi(`/tracks/${trackId}`, config);

    return {
        id: track.id,
        title: track.name,
        author: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        thumbnail: track.album.images?.[0]?.url,
        uri: track.external_urls.spotify,
        streamUrl: `/spotify/stream/${track.id}`,
        source: 'spotify'
    };
}

async function resolveToYouTube(trackId, config) {
    const cached = youtubeIdCache.get(trackId);
    if (cached && Date.now() < cached.expires) {
        log.info('SPOTIFY', `Using cached YouTube ID: ${cached.videoId}`);
        return cached.videoId;
    }

    const track = await getInfo(trackId, config);
    const searchQuery = `${track.author} - ${track.title}`;
    log.info('SPOTIFY', `Searching YouTube: "${searchQuery}"`);

    const ytResults = await youtube.search(searchQuery, 1, config);

    if (!ytResults.tracks?.length) {
        throw new Error('Could not find matching YouTube video');
    }

    const videoId = ytResults.tracks[0].id;
    youtubeIdCache.set(trackId, { videoId, expires: Date.now() + CACHE_TTL });
    log.info('SPOTIFY', `Resolved to YouTube: ${videoId}`);

    return videoId;
}

async function stream(trackId, filters, config, res) {
    const startTime = Date.now();
    log.info('SPOTIFY', `Stream: ${trackId}`);

    try {
        const videoId = await resolveToYouTube(trackId, config);
        const elapsed = Date.now() - startTime;
        log.info('SPOTIFY', `Resolution took ${elapsed}ms`);
        return youtube.stream(videoId, filters, config, res);
    } catch (error) {
        log.error('SPOTIFY', error.message);
        res.status(404).json({ error: error.message });
    }
}

async function getPlaylist(playlistId, config) {
    log.info('SPOTIFY', `Getting playlist: ${playlistId}`);

    const data = await spotifyApi(`/playlists/${playlistId}`, config);

    const tracks = (data.tracks?.items || [])
        .filter(item => item.track)
        .map(item => ({
            id: item.track.id,
            title: item.track.name,
            author: item.track.artists.map(a => a.name).join(', '),
            album: item.track.album.name,
            duration: Math.floor(item.track.duration_ms / 1000),
            thumbnail: item.track.album.images?.[0]?.url,
            uri: item.track.external_urls.spotify,
            streamUrl: `/spotify/stream/${item.track.id}`,
            source: 'spotify'
        }));

    log.info('SPOTIFY', `Playlist loaded: ${data.name} (${tracks.length} tracks)`);

    return {
        id: playlistId,
        title: data.name,
        author: data.owner?.display_name,
        thumbnail: data.images?.[0]?.url,
        tracks,
        source: 'spotify'
    };
}

async function getAlbum(albumId, config) {
    log.info('SPOTIFY', `Getting album: ${albumId}`);

    const data = await spotifyApi(`/albums/${albumId}`, config);

    const tracks = (data.tracks?.items || []).map(track => ({
        id: track.id,
        title: track.name,
        author: track.artists.map(a => a.name).join(', '),
        album: data.name,
        duration: Math.floor(track.duration_ms / 1000),
        thumbnail: data.images?.[0]?.url,
        uri: track.external_urls.spotify,
        streamUrl: `/spotify/stream/${track.id}`,
        source: 'spotify'
    }));

    log.info('SPOTIFY', `Album loaded: ${data.name} (${tracks.length} tracks)`);

    return {
        id: albumId,
        title: data.name,
        author: data.artists.map(a => a.name).join(', '),
        thumbnail: data.images?.[0]?.url,
        tracks,
        source: 'spotify'
    };
}

async function getRecommendations(trackId, limit, config) {
    log.info('SPOTIFY', `Getting recommendations for: ${trackId} (limit: ${limit})`);

    const data = await spotifyApi(`/recommendations?seed_tracks=${trackId}&limit=${limit}`, config);

    const tracks = (data.tracks || []).map(track => ({
        id: track.id,
        title: track.name,
        author: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        thumbnail: track.album.images?.[0]?.url,
        uri: track.external_urls.spotify,
        streamUrl: `/spotify/stream/${track.id}`,
        source: 'spotify',
        isAutoplay: true
    }));

    log.info('SPOTIFY', `Found ${tracks.length} recommendations`);
    return { tracks, source: 'spotify' };
}

module.exports = { search, getInfo, stream, resolveToYouTube, getPlaylist, getAlbum, getRecommendations };
