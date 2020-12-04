
import WebSocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import readFile from 'fs';
import tmi from 'tmi.js';
var Client = tmi.Client;
import jsJodaCore from '@js-joda/core'
var Duration = jsJodaCore.Duration;
var Clock = jsJodaCore.Clock;

const settings = JSON.parse(readFile.readFileSync('settings.json'));

const url = `ws://${settings.mm2ocr}/wss`;
console.log(`Connecting to Mario Maker 2 OCR (${url})`);
var socket = new ReconnectingWebSocket(url, [], { WebSocket });

socket.addEventListener('open', () => {
    console.log(`* Connected to Mario Maker 2 OCR`);
});

socket.addEventListener('error', () => {
    console.log(`* Connection error for Mario Maker 2 OCR`);
    console.log(`Connecting to Mario Maker 2 OCR (${url})`);
});

const clock = Clock.systemUTC();

class LevelTimer {
    constructor() {
        this.timer_start = undefined;
        this.duration = Duration.ZERO;
    }

    get time() {
        if (this.isRunning) {
            return this.duration.plus(Duration.between(this.timer_start, clock.instant()));
        } else {
            return this.duration;
        }
    }

    get isRunning() {
        return this.timer_start != undefined;
    }

    start() {
        if (!this.isRunning) {
            this.timer_start = clock.instant();
        }
    }

    stop() {
        this.duration = this.time;
        this.timer_start = undefined;
    }
}

class Attempt {
    constructor() {
        this.death_counter = 0;
        this.cleared = false;
        this.clear_data = undefined;
        this.timer = new LevelTimer();
    }

    get deaths() {
        return this.death_counter;
    }

    get time() {
        return this.timer.time;
    }

    death() {
        this.death_counter++;
    }

    exit() {
        this.timer.stop();
        this.death();
    }

    start() {
        this.timer.start();
    }

    clear(data) {
        this.timer.stop();
        this.cleared = true;
        this.clear_data = data;
    }

    restart() {
        if (!this.timer.isRunning) {
            this.start();
        } else {
            this.death();
        }
    }

}

const format_duration = (duration) => {
    let seconds = duration.seconds();
    var f_minutes = Math.floor(seconds / 60);
    var f_seconds = seconds % 60;
    if (f_minutes < 10) {
        f_minutes = `0${f_minutes}`;
    }
    if (f_seconds < 10) {
        f_seconds = `0${f_seconds}`;
    }
    return `${f_minutes}:${f_seconds}`;
}

const capitalize_first_letter = (text) => {
    if (typeof text !== 'string') {
        return text;
    }
    if (text.length == 0) {
        return '';
    }
    return text.substr(0, 1).toUpperCase() + text.substr(1);
}

class Level {
    constructor(author, code, name) {
        this.code = code;
        this.name = name;
        this.author = author;
        this.attempt = new Attempt();
        this.clears = [];
    }

    get time() {
        return this.attemptTime.plus(this.clears.map(c => c.time).reduce((a, c) => a.plus(c), Duration.ZERO));
    }

    get attemptTime() {
        return this.attempt.time;
    }

    get deaths() {
        return this.attemptDeaths + this.clears.map(c => c.deaths).reduce((a, c) => a + c, 0);
    }

    get attemptDeaths() {
        return this.attempt.deaths;
    }

    get isCleared() {
        return this.clears.length > 0;
    }

    get isEmptyAttempt() {
        return this.attempt.time.isZero() && this.attempt.deaths == 0;
    }

    start() {
        this.attempt.start();
    }

    clear(data) {
        this.attempt.clear(data);
        this.clears.push(this.attempt);
        this.attempt = new Attempt();
    }

    death() {
        this.attempt.death();
    }

    restart() {
        this.attempt.restart();
    }

    exit() {
        this.attempt.exit();
    }

    toTimeDeathString() {
        if (!this.isCleared) {
            return `${format_duration(this.attemptTime)}, ${this.attemptDeaths} deaths`;
        } else if (this.isEmptyAttempt) {
            return `${format_duration(this.time)}, ${this.deaths} deaths`;
        } else {
            return `${format_duration(this.attemptTime)}/${format_duration(this.time)}, ${this.attemptDeaths}/${this.deaths} deaths`;
        }
    }
}

class History {
    constructor() {
        this.history = [];
    }

    headNotCurrent(not_code) {
        return this.history.find(code => code != not_code)
    }

    push(code) {
        if (code != undefined && this.history[0] != code) {
            this.history.unshift(code);
        }
    }
}

class State {
    constructor() {
        this.levels = {};
        this.current_level_code = undefined;
        this.history = new History();
    }

    get currentLevel() {
        return this.levels[this.current_level_code];
    }

    set currentLevel(level) {
        this.levels[this.current_level_code] = level;
    }

    get lastLevel() {
        return this.levels[this.history.headNotCurrent(this.current_level_code)];
    }

    get hasLevel() {
        return this.currentLevel != undefined;
    }

    get hasLastLevel() {
        return this.lastLevel != undefined;
    }

    getLevelByCode(code) {
        return this.levels[code.toUpperCase()];
    }

    pushLevelCode(code) {
        this.history.push(this.current_level_code);
        if (typeof code === 'string') {
            this.current_level_code = code.toUpperCase();
        } else {
            this.current_level_code = code;
        }
    }

    level(level) {
        this.pushLevelCode(level.code);
        if (!this.hasLevel) {
            this.currentLevel = new Level(level.author, level.code, level.name);
        }
        this.currentLevel.start();
    }

    clear(data) {
        if (this.hasLevel) {
            this.currentLevel.clear(data);
        }
    }

    death() {
        if (this.hasLevel) {
            this.currentLevel.death();
        }
    }

    restart() {
        if (this.hasLevel) {
            this.currentLevel.restart();
        }
    }

    exit() {
        if (this.hasLevel) {
            this.currentLevel.exit();
            this.pushLevelCode(undefined);
        }
    }

    get(argument) {
        var level = undefined;
        var message = 'no level';
        if (argument == '' || argument == 'current') {
            if (state.hasLevel) {
                level = state.currentLevel;
                message = 'current level';
            } else if (state.hasLastLevel) {
                level = state.lastLevel;
                message = 'last level';
            } else {
                message = 'no current nor last level';
            }
        } else if (argument == 'last') {
            if (state.hasLastLevel) {
                level = state.lastLevel;
                message = 'last level';
            } else {
                message = 'no last level';
            }
        } else {
            level = state.getLevelByCode(argument);
            if (level == undefined) {
                message = `no data for level '${argument}' found`;
            } else {
                message = undefined;
            }
        }
        message = capitalize_first_letter(message);
        return { message, level };
    }
}

var state = new State();

socket.addEventListener('message', (event) => {
    if (settings.debug_mm2ocr) {
        console.log(`Mario Maker 2 OCR > ${event.data}`);
    }
    var msg = JSON.parse(event.data);
    if (msg.hasOwnProperty('type')) {
        switch (msg.type) {
            case 'clear':
                state.clear(msg.data);
                break;
            case 'death':
                state.death();
                break;
            case 'restart':
                state.restart();
                break;
            case 'exit':
                state.exit();
                break;
        }
    }
    if (msg.hasOwnProperty('level')) {
        state.level(msg.level);
    }
});

const opts = {
    identity: {
        username: settings.name,
        password: settings.token
    },
    connection: {
        reconnect: true,
        secure: true
    },
    channels: [
        settings.channel
    ]
};

const client = new Client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

console.log('Connecting to Twitch');
client.connect();

function onMessageHandler(target, context, msg, self) {
    if (self) { return; } // ignore own messages

    let message = msg.trim();
    var command = message;
    var argument = '';
    let index = message.indexOf(' ');
    if (index != -1) {
        command = message.substr(0, index);
        argument = message.substr(index + 1).trim();
    }
    if (settings.commands.level.some(c => c == command)) {
        argument = state.get(argument);
        let message = argument.message;
        let level = argument.level;
        if (level != undefined) {
            var prefix = '';
            if (message != undefined) {
                prefix = `${message}: `;
            }
            client.say(target, `${prefix}${level.code} (${level.toTimeDeathString()}) ${level.name} by ${level.author}.`);
        } else {
            client.say(target, `${message}.`);
        }
    }

}

function onConnectedHandler(addr, port) {
    console.log(`* Connected to Twitch (${addr}:${port})`);
}
