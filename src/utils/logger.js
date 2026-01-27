const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

const LOG_LEVELS = {
    none: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
};

let currentLevel = LOG_LEVELS.info;
let useColors = true;

function setLevel(level) {
    if (typeof level === 'string') {
        currentLevel = LOG_LEVELS[level.toLowerCase()] ?? LOG_LEVELS.info;
    } else if (typeof level === 'number') {
        currentLevel = level;
    }
}

function setColors(enabled) {
    useColors = enabled;
}

function colorize(color, text) {
    if (!useColors) return text;
    return `${colors[color] || ''}${text}${colors.reset}`;
}

function formatTime() {
    const now = new Date();
    return colorize('gray', `[${now.toTimeString().split(' ')[0]}]`);
}

function formatTag(tag, color) {
    return colorize(color, `[${tag.toUpperCase()}]`);
}

function debug(tag, ...args) {
    if (currentLevel < LOG_LEVELS.debug) return;
    console.log(formatTime(), '🐛', formatTag(tag, 'gray'), colorize('dim', args.join(' ')));
}

function info(tag, ...args) {
    if (currentLevel < LOG_LEVELS.info) return;
    const tagUpper = tag.toUpperCase();
    const color = {
        'MANAGER': 'cyan',
        'PLAYER': 'blue',
        'YOUTUBE': 'red',
        'SPOTIFY': 'green',
        'SOUNDCLOUD': 'yellow',
        'STREAM': 'cyan'
    }[tagUpper] || 'cyan';
    
    const emojiMap = {
        'MANAGER': 'ℹ️ ',
        'YOUTUBE': '🔴 ',
        'SPOTIFY': '🟢 ',
        'SOUNDCLOUD': '🟠 ',
        'PLAYER': '🔹 ',
        'STREAM': '🎵 '
    };
    
    const emoji = emojiMap[tagUpper] || '   ';
    console.log(formatTime(), emoji, formatTag(tag, color), ...args);
}

function success(tag, ...args) {
    if (currentLevel < LOG_LEVELS.info) return;
    console.log(formatTime(), '✅ ', formatTag(tag, 'green'), colorize('green', args.join(' ')));
}

function warn(tag, ...args) {
    if (currentLevel < LOG_LEVELS.warn) return;
    console.warn(formatTime(), '⚠️  ', formatTag(tag, 'yellow'), colorize('yellow', args.join(' ')));
}

function error(tag, ...args) {
    if (currentLevel < LOG_LEVELS.error) return;
    console.error(formatTime(), '❌ ', formatTag(tag, 'red'), colorize('red', args.join(' ')));
}

function stream(source, id, message) {
    if (currentLevel < LOG_LEVELS.debug) return;
    const sourceMap = {
        youtube: { color: 'red', emoji: '🔴 ' },
        spotify: { color: 'green', emoji: '🟢 ' },
        soundcloud: { color: 'yellow', emoji: '🟠 ' }
    };
    const { color, emoji } = sourceMap[source.toLowerCase()] || { color: 'white', emoji: '🎵 ' };

    console.log(
        formatTime(),
        emoji,
        colorize('cyan', '[STREAM]'),
        colorize('dim', `[${id}]`),
        message
    );
}

function banner() {
    if (currentLevel < LOG_LEVELS.info) return;
    const text = `
${colorize('cyan', '╔═══════════════════════════════════════════════╗')}
${colorize('cyan', '║')}${colorize('bold', '              STREAMIFY v1.0.0                 ')}${colorize('cyan', '║')}
${colorize('cyan', '║')}   Audio Streaming Library for Discord Bots   ${colorize('cyan', '║')}
${colorize('cyan', '╚═══════════════════════════════════════════════╝')}`;
    console.log(text);
}

function init(config = {}) {
    if (config.logLevel !== undefined) {
        setLevel(config.logLevel);
    } else if (process.env.LOG_LEVEL) {
        setLevel(process.env.LOG_LEVEL);
    } else if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
        setLevel('debug');
    } else if (config.silent || process.env.SILENT === 'true') {
        setLevel('none');
    }

    if (config.colors !== undefined) {
        setColors(config.colors);
    } else if (process.env.NO_COLOR) {
        setColors(false);
    }
}

module.exports = {
    debug,
    info,
    success,
    warn,
    error,
    stream,
    banner,
    setLevel,
    setColors,
    init,
    LOG_LEVELS
};
