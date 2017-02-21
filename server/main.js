'use strict'

const http = require('http')
const fs = require('mz/fs')
const path = require('path')
const koa = require('koa')
const jade = require('jade')
const io = require('socket.io')
const cio = require('socket.io-client')
const uuid = require('node-uuid')
const co = require('co')
const _ = require('lodash')
const pmongo = require('promised-mongo')
const process = require('process')

const ZERO = 0
const ONE = 1
const DEFAULT_PORT = 8080
const PORT = process.env.PORT || DEFAULT_PORT
const APP_NAME = 'Reversi'

const MONGO_URI = process.env.MONGODB_URI

const db = pmongo(MONGO_URI, ['games'])

const app = koa()
const GAMES = {}

const NODE_MODULES_DIR = 'node_modules/'
const STATIC_FILES = [
    '/es6-shim/es6-shim.min.js',
    '/systemjs/dist/system-polyfills.js',
    '/angular2/es6/dev/src/testing/shims_for_IE.js',
    '/angular2/bundles/angular2-polyfills.js',
    '/systemjs/dist/system.src.js',
    '/rxjs/bundles/Rx.js',
    '/angular2/bundles/angular2.dev.js',
]
app.use(function*(next) {
    if (STATIC_FILES.includes(this.path)) {
        const p = path.join(NODE_MODULES_DIR, this.path)
        this.body = yield fs.readFile(p, 'utf8')
    } else {
        yield next
    }
})

const CLIENT_DIR = 'client/'
const ALLOWED_EXT = ['.js', '.css', '.map']
app.use(function*(next) {
    const ext = path.extname(this.path)
    if (ALLOWED_EXT.includes(ext)) {
        this.body = yield fs.readFile(path.join(CLIENT_DIR, this.path), 'utf8')
        if (ext === '.css') {
            this.type = 'text/css'
        }
    } else {
        yield next
    }
})
const JADE_DEFAULT_LOCALS = {
    pageTitle: APP_NAME,
}
const JADE_EXT = '.jade'
const INDEX_PATH = '/index'
app.use(function*() {
    let p = ''
    if (this.path === '/' || this.path === INDEX_PATH) {
        p = path.join(CLIENT_DIR, INDEX_PATH) + JADE_EXT
    } else {
        p = path.join(CLIENT_DIR, this.path) + JADE_EXT
    }
    this.body = jade.renderFile(p, JADE_DEFAULT_LOCALS)
})

const server = http.createServer(app.callback())
const socket = io(server)

const SERVER_SOCKETS = {}
const BOARD_SIZE = 8
const NO_DISK = 0
const GAME_WAITING = 0
const GAME_ACTIVE = 1
const GAME_DONE = 2
const P1 = 0
const P2 = 1
const P1_DISK = 1
const P2_DISK = -1
const DISKS = [P1_DISK, P2_DISK]
const SID_GID = {}
socket.on('connection', (s) => {
    s.emit('hello')
    s.on('hello', co.wrap(function*(g) {
        let pid = s.id
        let gid = null
        if (g) {
            pid = g.pid
            gid = g.gid
        }
        const game = yield findGame(pid, gid, s.handshake.headers.referer)
        if (!game) {
            return
        }
        s.join(game.gid)
        yield saveGame(game)
        SID_GID[s.id] = game.gid
        sendJoined(s, pid, game)
        sendUpdate(game)
    }))
    s.on('move', co.wrap(function*(move) {
        let game = yield findGame(move.pid, move.gid)
        if (game && game.status === GAME_ACTIVE) {
            game = makeMove(move.pid, game, move.i)
            yield saveGame(game)
            sendUpdate(game)
        }
    }))
    s.on('sendUpdate', (game) => {
        console.log('in sendUpdate')
        const gameView = _.pick(game, ['board', 'turn', 'status'])
        socket.to(game.gid).emit('update', gameView)
    })
    s.on('disconnect', co.wrap(function*() {
        yield deleteGame(SID_GID[s.id])
    }))
})

function sendJoined(s, pid, game) {
    const gameView = _.pick(game, ['gid', 'board', 'turn', 'status'])
    gameView.pid = pid
    gameView.pIndex = game.players.indexOf(pid)
    s.emit('joined', gameView)
}

function sendUpdate(game) {
    game.playerServers.forEach(host => {
        if (!SERVER_SOCKETS[host]) {
            console.log('connecting to', host)
            SERVER_SOCKETS[host] = cio.connect(host, {
                'force new connection': true,
            })
        }
        console.log('sending update', host)
        SERVER_SOCKETS[host].emit('sendUpdate', game)
    })
}

function makeMove(pid, game, move) {
    console.log('pid', pid)
    console.log('players', game.players)
    console.log('player index', game.players.indexOf(pid))
    console.log('turn', game.turn)
    const pIndex = game.players.indexOf(pid)
    if (pIndex === game.turn) {
        return checkAndMove(game, move)
    }
    return game
}

const U = -8
const UR = -7
const R = 1
const DR = 9
const D = 8
const DL = 7
const L = -1
const UL = -9
const DIRS = [U, UR, R, DR, D, DL, L, UL]
const SIDX = 0

function checkAndMove(game, move) {
    if (!game.board || game.board[move] !== NO_DISK) {
        return game
    }
    const otherDisk = DISKS[(game.turn + ONE) % DISKS.length]
    const dirs = DIRS.filter(d => {
        const steps = walk(d, move)
        console.log(d, steps)
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            if (i === ZERO) {
                if (game.board[step] !== NO_DISK) {
                    return false
                }
            } else if (i === ONE) {
                if (game.board[step] !== otherDisk) {
                    return false
                }
            } else if (game.board[step] === NO_DISK) {
                return false
            } else if (game.board[step] === DISKS[game.turn]) {
                return true
            }
        }
        return false
    })
    if (dirs.length > ZERO) {
        dirs.forEach(d => {
            const steps = walk(d, move)
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i]
                if (i > ZERO && game.board[step] === DISKS[game.turn]) {
                    break
                }
                game.board[step] = DISKS[game.turn]
            }
        })
        const count = Math.abs(game.board.reduce((prev, curr) => prev + curr))
        if (count === BOARD_SIZE * BOARD_SIZE) {
            game.status = GAME_DONE
        } else {
            game.turn = ++game.turn % DISKS.length
        }
    }
    return game
}

function walk(d, move) {
    return _.range(SIDX, BOARD_SIZE)
        .map(i => move + i * d)
        .filter(i => {
            const r = Math.floor(i / BOARD_SIZE)
            const c = i % BOARD_SIZE
            if (d === R || d === L) {
                if (r !== Math.floor(move / BOARD_SIZE)) {
                    return false
                }
            }
            return r >= ZERO && r < BOARD_SIZE &&
                c >= ZERO && c < BOARD_SIZE
        })
}

const MUR = 28
const MDR = 36
const MDL = 35
const MUL = 27

function newGame(pid, ps) {
    const game = {
        gid: uuid.v4(),
        board: Array(BOARD_SIZE * BOARD_SIZE).fill(NO_DISK),
        players: [],
        playerServers: [],
    }
    game.board[MUR] = P1_DISK
    game.board[MDL] = P1_DISK
    game.board[MUL] = P2_DISK
    game.board[MDR] = P2_DISK
    game.players[P1] = pid
    game.playerServers[P1] = ps
    game.status = GAME_WAITING
    game.turn = 0
    return game
}

function findGame(pid, gid, ps) {
    return db.games.findOne({
        $or: [{
            gid: gid, // eslint-disable-line new-cap
            status: GAME_ACTIVE,
        }, {
            status: GAME_WAITING,
        }, ],
    })
    /*
    let g = null
    if (GAMES[gid] && GAMES[gid].status === GAME_ACTIVE) {
        g = GAMES[gid]
    } else {
        let waiting_gid = Object.keys(GAMES).find((key => GAMES[key].status === GAME_WAITING))
        if (waiting_gid) {
            g = GAMES[waiting_gid]
        }
    }
    return Promise.resolve(g).then(game => {
        if (game) {
            if (game.status === GAME_ACTIVE) {
                console.log('found active games')
                return game
            }
            console.log('found waiting games')
            game.players[P2] = pid
            game.playerServers[P2] = ps
            game.status = GAME_ACTIVE
            return game
        }
        console.log('making new game')
        return newGame(pid, ps)
    }).catch(err => {
        console.log('err', err)
        return null
    })
    */
}

function saveGame(game) {
    if (!game) {
        return null
    }
    return db.games.update({
            gid: game.gid,
        },
        game, {
            upsert: true,
        }).then((res) => {
        console.log('saved game', res)
        return game
    }).catch(err => {
        console.log('err', err)
        return null
    })
    
    /*
    GAMES[game.gid] = game
    return Promise.resolve(game)
    */
}

function deleteGame(gid) {
    if (!gid) {
        return
    }
    db.games.remove({
        gid: gid, // eslint-disable-line new-cap 
    }, ONE).then((res) => {
        console.log('deleted game', gid, res)
    }).catch(err => {
        console.log('err', err)
    })
    // delete GAMES[gid]
}

server.listen(PORT)
console.log('listening on port', PORT)
