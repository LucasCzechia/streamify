import { EventEmitter } from 'events';
import { Client, GuildMember } from 'discord.js';

declare module 'streamify-audio' {
    // ========================================================================
    // Common Types
    // ========================================================================

    export interface Track {
        id: string;
        title: string;
        author: string;
        duration: number;
        thumbnail?: string;
        uri: string;
        streamUrl: string;
        source: 'youtube' | 'spotify' | 'soundcloud';
        album?: string;
        isAutoplay?: boolean;
        requestedBy?: any;
        _resolvedId?: string;
    }

    export interface SearchResult {
        loadType: 'search' | 'track' | 'empty' | 'error';
        tracks: Track[];
        source: string;
        searchTime?: number;
    }

    export interface PlaylistResult {
        loadType: 'playlist' | 'error';
        playlist?: {
            id: string;
            title: string;
            author: string;
            thumbnail?: string;
            source: string;
        };
        tracks: Track[];
        error?: string;
    }

    export interface Filters {
        bass?: number;
        treble?: number;
        speed?: number;
        pitch?: number;
        volume?: number;
        equalizer?: number[];
        preset?: string;
        tremolo?: { frequency?: number; depth?: number };
        vibrato?: { frequency?: number; depth?: number };
        rotation?: { speed?: number };
        lowpass?: number;
        highpass?: number;
        bandpass?: { frequency?: number; width?: number };
        bandreject?: { frequency?: number; width?: number };
        lowshelf?: { frequency?: number; gain?: number };
        highshelf?: { frequency?: number; gain?: number };
        peaking?: { frequency?: number; gain?: number; q?: number };
        karaoke?: boolean;
        mono?: boolean;
        surround?: boolean;
        flanger?: boolean;
        phaser?: boolean;
        chorus?: boolean;
        compressor?: boolean;
        normalizer?: boolean;
        nightcore?: boolean;
        vaporwave?: boolean;
        bassboost?: boolean;
        '8d'?: boolean;
        start?: number;
    }

    // ========================================================================
    // HTTP Server Mode
    // ========================================================================

    export interface ProviderConfig {
        enabled?: boolean;
    }

    export interface ProvidersConfig {
        youtube?: ProviderConfig;
        spotify?: ProviderConfig;
        soundcloud?: ProviderConfig;
    }

    export interface StreamifyOptions {
        port?: number;
        host?: string;
        cookiesPath?: string;
        cookies?: string;
        ytdlpPath?: string;
        ffmpegPath?: string;
        providers?: ProvidersConfig;
        spotify?: {
            clientId: string;
            clientSecret: string;
        };
        audio?: {
            bitrate?: string;
            format?: 'opus' | 'mp3' | 'aac';
        };
        logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
        silent?: boolean;
        colors?: boolean;
    }

    export interface ActiveStream {
        id: string;
        source: string;
        trackId: string;
        position: number;
        filters: Filters;
        startTime: number;
        duration: number;
    }

    export interface SourceMethods {
        search(query: string, limit?: number): Promise<SearchResult>;
        getInfo?(id: string): Promise<Track>;
        getStreamUrl(id: string, filters?: Filters): string;
        getStream(id: string, filters?: Filters): Promise<ReadableStream>;
    }

    export default class Streamify extends EventEmitter {
        constructor(options?: StreamifyOptions);

        readonly running: boolean;
        readonly config: StreamifyOptions;

        start(): Promise<this>;
        stop(): Promise<void>;
        getBaseUrl(): string;

        detectSource(input: string): { source: string | null; id: string | null; isUrl: boolean };
        resolve(input: string, limit?: number): Promise<SearchResult>;
        search(source: string, query: string, limit?: number): Promise<SearchResult>;
        getInfo(source: string, id: string): Promise<Track>;
        getStreamUrl(source: string, id: string, filters?: Filters): string;
        getStream(source: string, id: string, filters?: Filters): Promise<ReadableStream>;

        getActiveStreams(): Promise<{ streams: ActiveStream[] }>;
        getStreamInfo(streamId: string): Promise<ActiveStream | null>;
        getPosition(streamId: string): Promise<number | null>;
        applyFilters(source: string, trackId: string, currentStreamId: string, newFilters: Filters): Promise<{
            url: string;
            position: number;
            filters: Filters;
        }>;

        youtube: SourceMethods;
        spotify: SourceMethods;
        soundcloud: Omit<SourceMethods, 'getInfo'>;

        on(event: 'streamStart', listener: (data: { id: string; source: string; trackId: string; filters: Filters }) => void): this;
        on(event: 'streamEnd', listener: (data: { id: string; source: string; trackId: string; duration: number }) => void): this;
        on(event: 'streamError', listener: (data: { id: string; source: string; trackId: string; error: Error }) => void): this;

        static Manager: typeof Manager;
        static Player: typeof Player;
        static Queue: typeof Queue;
        static getEffectPresetsInfo(): EffectPresetInfo[];
        static EFFECT_PRESETS: Record<string, { filters: Filters; description: string }>;
    }

    // ========================================================================
    // Discord Player Mode
    // ========================================================================

    export interface ManagerOptions {
        ytdlpPath?: string;
        ffmpegPath?: string;
        cookiesPath?: string;
        providers?: ProvidersConfig;
        spotify?: {
            clientId: string;
            clientSecret: string;
        };
        audio?: {
            bitrate?: string;
            format?: 'opus' | 'mp3' | 'aac';
        };
        defaultVolume?: number;
        maxPreviousTracks?: number;
        sponsorblock?: {
            enabled?: boolean;
            categories?: string[];
        };
        autoLeave?: {
            enabled?: boolean;
            emptyDelay?: number;
            inactivityTimeout?: number;
        };
        autoPause?: {
            enabled?: boolean;
            minUsers?: number;
        };
        autoplay?: {
            enabled?: boolean;
            maxTracks?: number;
        };
    }

    export interface ManagerStats {
        players: number;
        playingPlayers: number;
        memory: {
            heapUsed: number;
            heapTotal: number;
            rss: number;
        };
    }

    export class Manager extends EventEmitter {
        constructor(client: Client, options?: ManagerOptions);

        players: Map<string, Player>;
        config: any;
        autoLeave: { enabled: boolean; emptyDelay: number; inactivityTimeout: number };
        autoPause: { enabled: boolean; minUsers: number };
        autoplay: { enabled: boolean; maxTracks: number };

        create(guildId: string, voiceChannelId: string, textChannelId?: string): Promise<Player>;
        get(guildId: string): Player | undefined;
        destroy(guildId: string): void;
        destroyAll(): void;

        search(query: string, options?: { source?: string; limit?: number }): Promise<SearchResult>;
        resolve(input: string): Promise<SearchResult>;
        loadPlaylist(url: string): Promise<PlaylistResult>;
        getRelated(track: Track, limit?: number): Promise<{ tracks: Track[]; source: string }>;
        getStats(): ManagerStats;

        on(event: 'playerCreate', listener: (player: Player) => void): this;
        on(event: 'playerDestroy', listener: (player: Player) => void): this;
    }

    export interface PlayOptions {
        startPosition?: number;
        seek?: number;
        volume?: number;
        filters?: Filters;
        replace?: boolean;
    }

    export interface EffectPreset {
        name: string;
        intensity?: number;
    }

    export interface EffectPresetInfo {
        name: string;
        description: string;
        filters: string[];
    }

    export interface SetEffectPresetsOptions {
        replace?: boolean;
    }

    export class Player extends EventEmitter {
        constructor(manager: Manager, options: any);

        manager: Manager;
        guildId: string;
        voiceChannelId: string;
        textChannelId: string;
        queue: Queue;

        readonly connected: boolean;
        readonly playing: boolean;
        readonly paused: boolean;
        readonly position: number;
        volume: number;
        readonly filters: Filters;

        autoplay: { enabled: boolean; maxTracks: number };
        autoPause: { enabled: boolean; minUsers: number };
        autoLeave: { enabled: boolean; emptyDelay: number; inactivityTimeout: number };

        connect(): Promise<void>;
        disconnect(): boolean;
        destroy(): void;

        play(track: Track, options?: PlayOptions): Promise<void>;
        pause(destroyStream?: boolean): boolean;
        resume(): Promise<boolean>;
        skip(): Promise<Track | null>;
        previous(): Promise<Track | null>;
        stop(): boolean;
        seek(positionMs: number): Promise<boolean>;

        setVolume(volume: number): number;
        setLoop(mode: 'off' | 'track' | 'queue'): string;
        setAutoplay(enabled: boolean): boolean;
        setAutoPause(enabled: boolean): boolean;

        setFilter(name: string, value: any): Promise<boolean>;
        clearFilters(): Promise<boolean>;
        setEQ(bands: number[]): Promise<boolean>;
        setPreset(name: string): Promise<boolean>;
        clearEQ(): Promise<boolean>;
        getPresets(): string[];

        setEffectPresets(presets: (string | EffectPreset)[], options?: SetEffectPresetsOptions): Promise<boolean>;
        getActiveEffectPresets(): EffectPreset[];
        clearEffectPresets(): Promise<boolean>;
        getEffectPresets(): string[];

        toJSON(): any;

        on(event: 'trackStart', listener: (track: Track) => void): this;
        on(event: 'trackEnd', listener: (track: Track, reason: 'finished' | 'skipped' | 'stopped') => void): this;
        on(event: 'trackError', listener: (track: Track, error: Error) => void): this;
        on(event: 'queueEnd', listener: () => void): this;
        on(event: 'userJoin', listener: (member: GuildMember, count: number) => void): this;
        on(event: 'userLeave', listener: (member: GuildMember, count: number) => void): this;
        on(event: 'channelEmpty', listener: () => void): this;
        on(event: 'channelMove', listener: (channelId: string) => void): this;
        on(event: 'autoPause', listener: (userCount: number) => void): this;
        on(event: 'autoResume', listener: (userCount: number) => void): this;
        on(event: 'autoplayStart', listener: (lastTrack: Track) => void): this;
        on(event: 'autoplayAdd', listener: (tracks: Track[]) => void): this;
        on(event: 'destroy', listener: () => void): this;
    }

    export class Queue {
        constructor(options?: { maxPreviousTracks?: number });

        current: Track | null;
        tracks: Track[];
        previous: Track[];
        repeatMode: 'off' | 'track' | 'queue';

        readonly size: number;
        readonly isEmpty: boolean;
        readonly totalDuration: number;

        add(track: Track, position?: number): void;
        addMany(tracks: Track[]): void;
        remove(index: number): Track | null;
        clear(): void;
        shuffle(): void;
        move(from: number, to: number): boolean;

        shift(): Track | null;
        setCurrent(track: Track | null): void;
        setRepeatMode(mode: 'off' | 'track' | 'queue'): string;

        toJSON(): any;
    }

    // ========================================================================
    // Filter Presets
    // ========================================================================

    export const PRESETS: {
        flat: number[];
        rock: number[];
        pop: number[];
        jazz: number[];
        classical: number[];
        electronic: number[];
        hiphop: number[];
        acoustic: number[];
        rnb: number[];
        latin: number[];
        loudness: number[];
        piano: number[];
        vocal: number[];
        bass_heavy: number[];
        treble_heavy: number[];
    };

    export const EQ_BANDS: number[];
}
