/**
 * Landfill game
 * 
 * 遊び方
 * 1.マスをタップすると１段階埋め立てられます
 * 2.上下左右につながっている同じ高さのマスは同時に埋め立てられます
 * 3.全体が平地になるとゲームクリアです
 * 4.タップ回数が少ないほどスコアが高くなります
 * 5.定期的に隕石が落ちてきて土地が壊れるので急いで埋め立ててください
 * 
 * enchant.js-builds-0.7.0 : https://github.com/wise9/enchant.js
 * 
 * 画像なし2Dランドマップのテスト。
 * 
 * 2013/05/25 netnoid@gmail.com
 */

enchant();

window.onload = function() {
    var MAP_X = 9;
    var MAP_Y = 9;
    var MAP_Z = 6; // 変更不可

    var SCREEN_WIDTH = 320;
    var SCREEN_HEIGHT = 320;
    var CELL_SIZE_Z = 3;
    var TOP_MARGIN = CELL_SIZE_Z * MAP_Z;
    var SIDE_MARGIN = 6;
    var CELL_SIZE_X = ((SCREEN_WIDTH - SIDE_MARGIN * 2) / MAP_X) | 0;
    var CELL_SIZE_Y = ((SCREEN_HEIGHT - TOP_MARGIN) / MAP_Y) | 0;

    var Palette = function() {
        this.top = 'rgb(0,0,0)';
        this.side = 'rgb(0,0,0)';
        this.shadow = 'rgb(0,0,0)';

        var clamp = function(c) {
            if (c < 0) { return 0; }
            if (c > 255) { return 255; }
            return c;
        };

        var getComponent = function(cellZ) {
            if (cellZ <= 0) {
                return 0;
            }
            return 80 + (cellZ - 1) * 30; // 80, 110, 140, 170, 200
        }

        this.paintAsGround = function(cell) {
            var c = getComponent(cell.z);
            var pattern = ((cell.x + cell.y) % 2 * c * 0.02) | 0;
            this.paintRGB(0, c + pattern, 0);
        };

        this.paintAsCrater = function(cell) {
            var c = getComponent(cell.z);
            this.paintRGB((c * 0.6) | 0, (c * 0.5) | 0, 0);
        };

        this.paintRGB = function(r, g, b) {
            this.top = 'rgb(' + r + ',' + g + ',' + b + ')';
            this.side = 'rgb(120,100,0)';
            this.shadow = 'rgb(' + clamp(r - 15) + ',' + clamp(g - 15) + ',' + clamp(b - 15) + ')';
        };
    };

    var Cell = function(cellX, cellY, cellZ) {
        this.x = cellX;
        this.y = cellY;
        this.z = cellZ;
        this.height = 0;
        this.waterLevel = 0.0;
        this.waterFade = 0.0; // [0.0, 1.0]
        this.palette = new Palette();

        this.changeZ = function(cellZ) {
            var up = (cellZ >= this.z);
            this.z = cellZ;
            this.height = cellZ * CELL_SIZE_Z;
            if (up) {
                this.palette.paintAsGround(this);
            } else {
                this.palette.paintAsCrater(this);
            }
        };

        this.update = function(counter) {
            var middleZ = ((MAP_Z - 1) * CELL_SIZE_Z / 2);
            this.waterLevel = middleZ + middleZ * Math.sin((counter + this.x * 4) * 0.025);
            var relativeHeight = this.waterLevel - this.height;
            if (relativeHeight > 0) {
                this.waterFade += 0.2;
                if (this.waterFade >= 1.0) {
                    this.waterFade = 1.0;
                }
            } else {
                this.waterFade -= 0.2;
                if (this.waterFade <= 0.01) { // 小さい数は指数表記になりrgba()に渡す時にエラー
                    this.waterFade = 0.0;
                }
            }
        };

        this.changeZ(this.z);
    };
    var _map = null;

    var Meteor = function(cell) {
        this.cell = cell;
        this.positionZ = SCREEN_HEIGHT;

        this.update = function() {
            if (this.isFallen()) {
                return;
            }

            var speed = SCREEN_HEIGHT / 100;
            this.positionZ -= speed;
            if (this.positionZ <= this.cell.height) {
                this.colide();
            }
        };

        this.colide = function() {
            var cellZ = this.cell.z - 2;
            if (cellZ < 1) {
                cellZ = 1;
            }
            this.cell.changeZ(cellZ);
            this.positionZ = this.cell.height;
        };

        this.isFallen = function() {
            return (this.positionZ <= this.cell.height);
        };
    };
    var _meteor = null;

    var _context = null;
    var _loopCounter = 0;
    var _score = 100;
    var _scoreLabel = null;


    var _game = new Game(SCREEN_WIDTH, SCREEN_HEIGHT);
    _game.fps = 30;
    _game.onload = function() {
        _game.rootScene.backgroundColor = 'rgb(00,25,155)';

        _map = createMap();

        var sprite = new Sprite(SCREEN_WIDTH, SCREEN_HEIGHT);
        sprite.image = new Surface(SCREEN_WIDTH, SCREEN_HEIGHT);
        _game.rootScene.addChild(sprite);
        sprite.addEventListener(enchant.Event.TOUCH_START, onTouch);

        _scoreLabel = createScoreLabel();
        _game.rootScene.addChild(_scoreLabel);

        _context = sprite.image.context;
    };
    _game.start();

    var createMap = function() {
        var map = new Array();
        for (var i = 0; i < MAP_X + 2; ++i) {
            map[i] = new Array();
            for (var j = 0; j < MAP_Y + 2; ++j) {
                var cellZ = 0;
                if (0 < i && i <= MAP_X && 0 < j && j <= MAP_Y) {
                    cellZ = 1 + (Math.random() * (MAP_Z - 1)) | 0;
                }
                map[i][j] = new Cell(i, j, cellZ);
            }
        }
        return map;
    };

    var createScoreLabel = function() {
        var label = new Label("100");
        label.moveTo(2, 2);
        label.color = 'rgb(255,255,255)';
        label.touchEnabled = false;
        return label;
    };

    _game.rootScene.onenterframe = function() {
        _loopCounter++;

        updateMap();
        updateMeteor();
        drawBackGround();
        drawMap();
    };

    var updateMap = function() {
        for (var j = 1; j <= MAP_Y; ++j) {
            for (var i = 1; i <= MAP_X; ++i) {
                _map[i][j].update(_loopCounter);
            }
        }
    };

    var drawBackGround = function() {
        _context.fillStyle = 'rgb(0,0,255)';
        _context.fillRect(0, 0, SCREEN_WIDTH, TOP_MARGIN);
    };

    var drawMap = function() {
        for (var j = 1; j <= MAP_Y; ++j) {
            for (var i = 1; i <= MAP_X; ++i) {
                var cell = _map[i][j];
                var px = (i - 1) * CELL_SIZE_X + SIDE_MARGIN;
                var py = (j - 1) * CELL_SIZE_Y + TOP_MARGIN;
                var pz = cell.height;

                // top
                _context.fillStyle = cell.palette.top;
                _context.fillRect(px, py - pz, CELL_SIZE_X, CELL_SIZE_Y);

                // side
                _context.fillStyle = cell.palette.side;
                _context.fillRect(px, py - pz + CELL_SIZE_Y, CELL_SIZE_X, pz);

                // shadow
                var leftRelativeHeight = (_map[i - 1][j].height - pz) | 0;
                if (leftRelativeHeight < 0) {
                    leftRelativeHeight = 1;
                }
                _context.fillStyle = cell.palette.shadow;
                _context.fillRect(px, py - pz, leftRelativeHeight, CELL_SIZE_Y);

                // water
                if (cell.waterFade > 0) {
                    var waterRelativeHeight = (cell.waterLevel - pz) | 0;
                    if (waterRelativeHeight < 0) {
                        waterRelativeHeight = 0;
                    }

                    _context.fillStyle = 'rgba(0,0,255,' + (0.4 * cell.waterFade) + ')';
                    _context.fillRect(px, py - pz - waterRelativeHeight, CELL_SIZE_X, CELL_SIZE_Y);

                    var backRelativeHeight = _map[i][j - 1].height - pz;
                    if (waterRelativeHeight < backRelativeHeight) {
                        _context.fillStyle = 'rgb(100,100,200)';
                        _context.fillRect(px, py - pz - waterRelativeHeight, CELL_SIZE_X, 1);
                    }
                }

                if (_meteor != null && _meteor.cell.x == i && _meteor.cell.y == j) {
                    var mpx = px + CELL_SIZE_X / 2;
                    var mpy = py + CELL_SIZE_Y / 2;
                    var mpz = (pz > cell.waterLevel) ? pz : cell.waterLevel;
                    var alpha = 0.5 - 0.5 * _meteor.positionZ / SCREEN_HEIGHT;
                    var radius = CELL_SIZE_X * alpha;

                    _context.beginPath();
                    _context.fillStyle = 'rgba(0,0,0,' + alpha + ')';
                    _context.arc(mpx, mpy - mpz, radius, 0, Math.PI * 2, true);
                    _context.fill();
                }
            }
        }
    };

    var onTouch = function(e) {
        var cellX = ((e.x + CELL_SIZE_X - SIDE_MARGIN) / CELL_SIZE_X) | 0;
        var cellY = ((e.y + CELL_SIZE_Y - TOP_MARGIN) / CELL_SIZE_Y) | 0;
        if (cellX < 1 || MAP_X < cellX || cellY < 1 || MAP_Y < cellY) {
            return;
        }

        // 上下に重なった立体視の分を補正
        var offsetZ = (e.y - TOP_MARGIN) - ((cellY - 1) * CELL_SIZE_Y);
        if (offsetZ > CELL_SIZE_Y - _map[cellX][cellY + 1].height) {
            cellY++;
        }

        landfill(cellX, cellY, _map[cellX][cellY].z, 1);

        _score--;
        if (_score < 0) { _score = 0; }
        _scoreLabel.text = _score;

        checkGameover();
    };

    // セル(cellX, cellY, cellZ)と上下左右につながっている同じ高さのセルをすべてstep段階上昇させる（塗り絵）
    var landfill = function(cellX, cellY, cellZ, step) {
        var cell = _map[cellX][cellY];
        if (cell.z != cellZ || cell.z + step < 1 || cell.z + step >= MAP_Z) {
            return;
        }

        cell.changeZ(cell.z + step);
        if (cell.waterLevel <= cell.height) {
            cell.waterFade = 0.0;
        }

        landfill(cellX - 1, cellY, cellZ, step);
        landfill(cellX + 1, cellY, cellZ, step);
        landfill(cellX, cellY - 1, cellZ, step);
        landfill(cellX, cellY + 1, cellZ, step);
    };

    var checkGameover = function() {
        var cellZ = _map[1][1].z;
        for (var j = 1; j <= MAP_Y; ++j) {
            for (var i = 1; i <= MAP_X; ++i) {
                if (_map[i][j].z != cellZ) {
                    return;
                }
            }
        }
        _game.rootScene.onenterframe();
        _game.end(_score, 'SCORE:' + _score);
    };


    var createMeteor = function() {
        var target = findBreakableCell(_map);
        if (target == null) {
            return null;
        }
        return new Meteor(target);
    };

    var updateMeteor = function() {
        if (_meteor == null) {
            var INTERVAL = 120;
            if (_loopCounter % INTERVAL == INTERVAL - 1) {
                _meteor = createMeteor();
            }
            return;
        }
        _meteor.update();
        if (_meteor.isFallen()) {
            _meteor = null;
        }
    };

    // 同じ高さのセルが2つ以上隣接しているセルをランダムに見つける。
    // 無作為に隕石を落とすと、隕石による削りが有効になるため、落下地点は限定する必要がある。
    var findBreakableCell = function(map) {
        var found = [];
        for (var j = 1; j <= MAP_Y; ++j) {
            for (var i = 1; i <= MAP_X; ++i) {
                var cellZ = map[i][j].z;
                if (cellZ < 2) {
                    continue;
                }

                var same = 0;
                if (map[i - 1][j].z == cellZ) { same++; }
                if (map[i + 1][j].z == cellZ) { same++; }
                if (map[i][j - 1].z == cellZ) { same++; }
                if (map[i][j + 1].z == cellZ) { same++; }
                if (same < 2) {
                    continue;
                }

                found[found.length] = map[i][j];
            }
        }

        if (found.length == 0) {
            return null;
        }
        return found[(Math.random() * found.length) | 0];
    };
};
