System.register(['angular2/core'], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
    var __metadata = (this && this.__metadata) || function (k, v) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
    };
    var core_1;
    var AppComponent;
    return {
        setters:[
            function (core_1_1) {
                core_1 = core_1_1;
            }],
        execute: function() {
            AppComponent = (function () {
                function AppComponent() {
                    var _this = this;
                    this.GAME_WAITING = 0;
                    this.GAME_ACTIVE = 1;
                    this.GAME_DONE = 2;
                    this.P1_TURN = 0;
                    this.P2_DISK = -1;
                    this.NO_DISK = 0;
                    this.socket = null;
                    this.game = null;
                    this.socket = io();
                    this.socket.on('hello', function () {
                        if (_this.game) {
                            _this.socket.emit('hello', _this.game);
                        }
                        else {
                            _this.socket.emit('hello');
                        }
                    });
                    this.socket.on('joined', function (game) {
                        _this.game = game;
                    });
                    this.socket.on('update', function (game) {
                        if (_this.game) {
                            _this.game.board = game.board;
                            _this.game.turn = game.turn;
                            _this.game.status = game.status;
                        }
                    });
                }
                AppComponent.prototype.move = function (i) {
                    if (this.socket && this.game) {
                        var m = {
                            pid: this.game.pid,
                            gid: this.game.gid,
                            i: i
                        };
                        this.socket.emit('move', m);
                    }
                };
                AppComponent = __decorate([
                    core_1.Component({
                        selector: 'app',
                        templateUrl: 'templates/app',
                        styleUrls: ['styles/app.css'],
                        host: {
                            class: 'app'
                        },
                    }), 
                    __metadata('design:paramtypes', [])
                ], AppComponent);
                return AppComponent;
            }());
            exports_1("AppComponent", AppComponent);
        }
    }
});
//# sourceMappingURL=app.component.js.map