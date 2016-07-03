import {Component} from 'angular2/core'

interface Game {
    pid: string
    gid: string
    board: number[]
    turn: number
    status: number
}

interface Move {
    pid: string
    gid: string
    i: number
}

@Component({
    selector: 'app',
    templateUrl: 'templates/app',
    styleUrls: ['styles/app.css'],
    host: {
        class: 'app' 
    },
})
export class AppComponent {
    GAME_WAITING: number = 0
    GAME_ACTIVE: number = 1
    GAME_DONE: number = 2
    P1_TURN: number = 0
    P2_DISK: number = -1
    NO_DISK: number = 0
    
    socket = null
    game: Game = null
    
    constructor() {
        this.socket = io()
        this.socket.on('hello', () => {
            if(this.game) {
                this.socket.emit('hello', this.game)                
            } else {
                this.socket.emit('hello')
            }            
        })
        this.socket.on('joined', (game: Game) => {
            this.game = game
        })
        this.socket.on('update', (game: Game) => {
            if(this.game) {
                this.game.board = game.board
                this.game.turn = game.turn
                this.game.status = game.status         
            }           
        })
    }
    
    move(i: number) {
        if(this.socket && this.game) {
            const m : Move = {
                pid: this.game.pid,
                gid: this.game.gid,
                i: i
            }
            this.socket.emit('move', m)
        }
    }
}