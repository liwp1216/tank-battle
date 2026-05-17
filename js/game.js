/**
 * 坦克大战游戏
 * 使用 HTML5 Canvas 实现
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏配置
const TILE_SIZE = 40;
const COLS = 20;
const ROWS = 15;
const CANVAS_WIDTH = COLS * TILE_SIZE;
const CANVAS_HEIGHT = ROWS * TILE_SIZE;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// 方向枚举
const Direction = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// 地图方块类型
const TileType = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    GRASS: 3,
    WATER: 4,
    BASE: 5
};

// 游戏状态
const GameState = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
    WIN: 4
};

// ==================== 地图数据 ====================
// 关卡地图 (0=空地, 1=砖墙, 2=钢墙, 3=草地, 4=水域, 5=基地)
const levels = [
    [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0]
    ]
];

// ==================== 游戏变量 ====================
let gameState = GameState.MENU;
let currentLevel = 0;
let score = 0;
let lives = 3;
let map = [];
let player = null;
let enemies = [];
let bullets = [];
let particles = [];
let enemySpawnTimer = 0;
let enemiesKilled = 0;
let totalEnemiesInLevel = 10;
let maxEnemiesOnScreen = 4;
let keys = {};
let lastShotTime = 0;
const SHOT_COOLDOWN = 300;

// ==================== 工具函数 ====================
function rectIntersect(r1, r2) {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
}

function getTileAt(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return TileType.STEEL;
    return map[row][col];
}

function setTileAt(x, y, type) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        map[row][col] = type;
    }
}

// ==================== 粒子系统 ====================
class Particle {
    constructor(x, y, color, speed, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.95;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createExplosion(x, y, color = '#ff6b6b', count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 4, 30 + Math.random() * 20));
    }
}

// ==================== 子弹类 ====================
class Bullet {
    constructor(x, y, direction, isPlayer) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.isPlayer = isPlayer;
        this.speed = 6;
        this.width = 6;
        this.height = 6;
        this.active = true;
    }

    update() {
        switch (this.direction) {
            case Direction.UP: this.y -= this.speed; break;
            case Direction.DOWN: this.y += this.speed; break;
            case Direction.LEFT: this.x -= this.speed; break;
            case Direction.RIGHT: this.x += this.speed; break;
        }

        // 检查是否出界
        if (this.x < 0 || this.x > CANVAS_WIDTH || this.y < 0 || this.y > CANVAS_HEIGHT) {
            this.active = false;
            return;
        }

        // 检查地图碰撞
        this.checkMapCollision();
    }

    checkMapCollision() {
        const tile = getTileAt(this.x + this.width / 2, this.y + this.height / 2);

        if (tile === TileType.BRICK) {
            this.active = false;
            setTileAt(this.x + this.width / 2, this.y + this.height / 2, TileType.EMPTY);
            createExplosion(this.x, this.y, '#d4a574', 8);
        } else if (tile === TileType.STEEL) {
            this.active = false;
            createExplosion(this.x, this.y, '#888', 5);
        } else if (tile === TileType.BASE) {
            this.active = false;
            setTileAt(this.x + this.width / 2, this.y + this.height / 2, TileType.EMPTY);
            createExplosion(this.x, this.y, '#ff0000', 25);
            if (this.isPlayer) {
                // 玩家打中基地，游戏结束
            } else {
                // 敌人打中基地，游戏结束
                gameOver(false);
            }
        }
    }

    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    draw(ctx) {
        ctx.fillStyle = this.isPlayer ? '#ffeb3b' : '#ff5722';
        ctx.shadowColor = this.isPlayer ? '#ffeb3b' : '#ff5722';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ==================== 坦克基类 ====================
class Tank {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 36;
        this.direction = Direction.UP;
        this.speed = 2;
        this.color = color;
        this.active = true;
        this.moveTimer = 0;
    }

    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    canMove(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;

        // 边界检查
        if (newX < 0 || newX + this.width > CANVAS_WIDTH ||
            newY < 0 || newY + this.height > CANVAS_HEIGHT) {
            return false;
        }

        // 地图碰撞检查
        const corners = [
            { x: newX, y: newY },
            { x: newX + this.width - 1, y: newY },
            { x: newX, y: newY + this.height - 1 },
            { x: newX + this.width - 1, y: newY + this.height - 1 }
        ];

        for (const corner of corners) {
            const tile = getTileAt(corner.x, corner.y);
            if (tile === TileType.BRICK || tile === TileType.STEEL || tile === TileType.WATER) {
                return false;
            }
        }

        return true;
    }

    move(dx, dy) {
        if (this.canMove(dx, dy)) {
            this.x += dx;
            this.y += dy;
            return true;
        }
        return false;
    }

    shoot() {
        const barrelOffset = 20;
        let bx = this.x + this.width / 2 - 3;
        let by = this.y + this.height / 2 - 3;

        switch (this.direction) {
            case Direction.UP: by -= barrelOffset; break;
            case Direction.DOWN: by += barrelOffset; break;
            case Direction.LEFT: bx -= barrelOffset; break;
            case Direction.RIGHT: bx += barrelOffset; break;
        }

        bullets.push(new Bullet(bx, by, this.direction, this instanceof PlayerTank));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // 旋转坦克
        let rotation = 0;
        switch (this.direction) {
            case Direction.UP: rotation = 0; break;
            case Direction.RIGHT: rotation = Math.PI / 2; break;
            case Direction.DOWN: rotation = Math.PI; break;
            case Direction.LEFT: rotation = -Math.PI / 2; break;
        }
        ctx.rotate(rotation);

        // 履带
        ctx.fillStyle = '#555';
        ctx.fillRect(-18, -16, 8, 32);
        ctx.fillRect(10, -16, 8, 32);

        // 履带纹理
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = -14; i < 14; i += 4) {
            ctx.beginPath();
            ctx.moveTo(-18, i);
            ctx.lineTo(-10, i);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(10, i);
            ctx.lineTo(18, i);
            ctx.stroke();
        }

        // 车身
        ctx.fillStyle = this.color;
        ctx.fillRect(-10, -10, 20, 20);

        // 车身边框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -10, 20, 20);

        // 炮塔
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 炮管
        ctx.fillStyle = '#444';
        ctx.fillRect(-3, -22, 6, 16);

        ctx.restore();
    }
}

// ==================== 玩家坦克 ====================
class PlayerTank extends Tank {
    constructor(x, y) {
        super(x, y, '#4caf50');
        this.speed = 2.5;
    }

    update() {
        let dx = 0;
        let dy = 0;

        if (keys['KeyW'] || keys['ArrowUp']) {
            dy = -this.speed;
            this.direction = Direction.UP;
        } else if (keys['KeyS'] || keys['ArrowDown']) {
            dy = this.speed;
            this.direction = Direction.DOWN;
        } else if (keys['KeyA'] || keys['ArrowLeft']) {
            dx = -this.speed;
            this.direction = Direction.LEFT;
        } else if (keys['KeyD'] || keys['ArrowRight']) {
            dx = this.speed;
            this.direction = Direction.RIGHT;
        }

        if (dx !== 0 || dy !== 0) {
            this.move(dx, dy);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        // 玩家标记
        ctx.fillStyle = '#4caf50';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('P', this.x + this.width / 2, this.y - 5);
    }
}

// ==================== 敌方坦克 ====================
class EnemyTank extends Tank {
    constructor(x, y) {
        super(x, y, '#f44336');
        this.speed = 1.5;
        this.aiTimer = 0;
        this.shootTimer = 0;
        this.moveDuration = 0;
        this.isMoving = true;
    }

    update() {
        this.aiTimer++;
        this.shootTimer++;

        // AI: 随机改变方向
        if (this.aiTimer > this.moveDuration || !this.isMoving) {
            this.aiTimer = 0;
            this.direction = Math.floor(Math.random() * 4);
            this.moveDuration = 30 + Math.random() * 90;
            this.isMoving = Math.random() > 0.1;
        }

        // 尝试朝玩家方向移动（简单的追踪）
        if (player && player.active && Math.random() < 0.02) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
            } else {
                this.direction = dy > 0 ? Direction.DOWN : Direction.UP;
            }
        }

        // 移动
        if (this.isMoving) {
            let dx = 0, dy = 0;
            switch (this.direction) {
                case Direction.UP: dy = -this.speed; break;
                case Direction.DOWN: dy = this.speed; break;
                case Direction.LEFT: dx = -this.speed; break;
                case Direction.RIGHT: dx = this.speed; break;
            }

            if (!this.move(dx, dy)) {
                // 撞墙了，改变方向
                this.direction = Math.floor(Math.random() * 4);
                this.aiTimer = 0;
            }
        }

        // 射击
        if (this.shootTimer > 60 + Math.random() * 120) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    draw(ctx) {
        super.draw(ctx);
        // 敌人标记
        ctx.fillStyle = '#f44336';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('E', this.x + this.width / 2, this.y - 5);
    }
}

// ==================== 地图绘制 ====================
function drawMap(ctx) {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;
            const tile = map[row][col];

            switch (tile) {
                case TileType.BRICK:
                    // 砖墙
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#A0522D';
                    // 砖块纹理
                    for (let i = 0; i < 2; i++) {
                        for (let j = 0; j < 2; j++) {
                            ctx.fillRect(x + i * 20 + 1, y + j * 20 + 1, 18, 18);
                        }
                    }
                    ctx.strokeStyle = '#654321';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                    break;

                case TileType.STEEL:
                    // 钢墙
                    ctx.fillStyle = '#708090';
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#9090a0';
                    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                    ctx.strokeStyle = '#505060';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                    // 铆钉效果
                    ctx.fillStyle = '#606070';
                    ctx.beginPath();
                    ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2);
                    ctx.arc(x + 32, y + 8, 2, 0, Math.PI * 2);
                    ctx.arc(x + 8, y + 32, 2, 0, Math.PI * 2);
                    ctx.arc(x + 32, y + 32, 2, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case TileType.GRASS:
                    // 草地
                    ctx.fillStyle = 'rgba(34, 139, 34, 0.5)';
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    break;

                case TileType.WATER:
                    // 水域
                    ctx.fillStyle = '#1E90FF';
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#87CEEB';
                    ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, 3);
                    ctx.fillRect(x + 10, y + 15, TILE_SIZE - 15, 2);
                    ctx.fillRect(x + 3, y + 25, TILE_SIZE - 8, 2);
                    break;

                case TileType.BASE:
                    // 基地
                    ctx.fillStyle = '#FF69B4';
                    ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    ctx.strokeStyle = '#FF1493';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    // 基地标记
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('★', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
                    break;
            }
        }
    }
}

// ==================== 游戏逻辑 ====================
function loadLevel(levelIndex) {
    const levelData = levels[levelIndex % levels.length];
    map = levelData.map(row => [...row]);

    // 重置玩家
    player = new PlayerTank(CANVAS_WIDTH / 2 - 18, CANVAS_HEIGHT - 50);

    // 重置敌人
    enemies = [];
    bullets = [];
    particles = [];
    enemySpawnTimer = 0;
    enemiesKilled = 0;
    totalEnemiesInLevel = 10 + levelIndex * 5;
}

function spawnEnemy() {
    if (enemies.length >= maxEnemiesOnScreen) return;
    if (enemiesKilled + enemies.length >= totalEnemiesInLevel) return;

    const spawnPoints = [
        { x: 40, y: 40 },
        { x: CANVAS_WIDTH / 2 - 18, y: 40 },
        { x: CANVAS_WIDTH - 80, y: 40 }
    ];

    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

    // 检查生成点是否被占用
    const spawnRect = { x: spawn.x, y: spawn.y, width: 36, height: 36 };
    for (const enemy of enemies) {
        if (rectIntersect(spawnRect, enemy.getRect())) return;
    }
    if (player && rectIntersect(spawnRect, player.getRect())) return;

    enemies.push(new EnemyTank(spawn.x, spawn.y));
}

function checkBulletCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet.active) continue;

        // 子弹与坦克碰撞
        if (bullet.isPlayer) {
            // 玩家子弹打敌人
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (enemy.active && rectIntersect(bullet.getRect(), enemy.getRect())) {
                    bullet.active = false;
                    enemy.active = false;
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#f44336', 20);
                    enemies.splice(j, 1);
                    score += 100;
                    enemiesKilled++;
                    updateUI();

                    // 检查是否通关
                    if (enemiesKilled >= totalEnemiesInLevel) {
                        levelComplete();
                    }
                    break;
                }
            }
        } else {
            // 敌人子弹打玩家
            if (player && player.active && rectIntersect(bullet.getRect(), player.getRect())) {
                bullet.active = false;
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#4caf50', 20);
                lives--;
                updateUI();

                if (lives <= 0) {
                    player.active = false;
                    gameOver(false);
                } else {
                    // 复活玩家
                    player.x = CANVAS_WIDTH / 2 - 18;
                    player.y = CANVAS_HEIGHT - 50;
                }
            }
        }
    }
}

function checkTankCollisions() {
    // 玩家与敌人碰撞
    if (player && player.active) {
        for (const enemy of enemies) {
            if (enemy.active && rectIntersect(player.getRect(), enemy.getRect())) {
                // 推开
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    player.x += dx > 0 ? 2 : -2;
                    enemy.x += dx > 0 ? -2 : 2;
                } else {
                    player.y += dy > 0 ? 2 : -2;
                    enemy.y += dy > 0 ? -2 : 2;
                }
            }
        }
    }

    // 敌人之间碰撞
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            if (enemies[i].active && enemies[j].active &&
                rectIntersect(enemies[i].getRect(), enemies[j].getRect())) {
                // 简单推开
                const dx = enemies[i].x - enemies[j].x;
                const dy = enemies[i].y - enemies[j].y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    enemies[i].x += dx > 0 ? 1 : -1;
                    enemies[j].x += dx > 0 ? -1 : 1;
                } else {
                    enemies[i].y += dy > 0 ? 1 : -1;
                    enemies[j].y += dy > 0 ? -1 : 1;
                }
            }
        }
    }
}

function levelComplete() {
    currentLevel++;
    document.getElementById('gameOverText').textContent = '关卡完成！';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
    gameState = GameState.WIN;
}

function gameOver(win) {
    document.getElementById('gameOverText').textContent = win ? '胜利！' : '游戏结束';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
    gameState = GameState.GAME_OVER;
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = currentLevel + 1;
}

// ==================== 游戏循环 ====================
function update() {
    if (gameState !== GameState.PLAYING) return;

    // 更新玩家
    if (player && player.active) {
        player.update();
    }

    // 更新敌人
    for (const enemy of enemies) {
        if (enemy.active) {
            enemy.update();
        }
    }

    // 生成敌人
    enemySpawnTimer++;
    if (enemySpawnTimer > 120) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }

    // 更新子弹
    for (const bullet of bullets) {
        if (bullet.active) {
            bullet.update();
        }
    }

    // 清理不活跃的子弹
    bullets = bullets.filter(b => b.active);

    // 碰撞检测
    checkBulletCollisions();
    checkTankCollisions();

    // 更新粒子
    for (const particle of particles) {
        particle.update();
    }
    particles = particles.filter(p => p.life > 0);
}

function draw() {
    // 清空画布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 绘制网格背景
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * TILE_SIZE);
        ctx.lineTo(CANVAS_WIDTH, i * TILE_SIZE);
        ctx.stroke();
    }

    // 绘制地图
    drawMap(ctx);

    // 绘制玩家
    if (player && player.active) {
        player.draw(ctx);
    }

    // 绘制敌人
    for (const enemy of enemies) {
        if (enemy.active) {
            enemy.draw(ctx);
        }
    }

    // 绘制子弹
    for (const bullet of bullets) {
        if (bullet.active) {
            bullet.draw(ctx);
        }
    }

    // 绘制粒子
    for (const particle of particles) {
        particle.draw(ctx);
    }

    // 绘制敌人剩余数量
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    const remaining = totalEnemiesInLevel - enemiesKilled;
    ctx.fillText(`剩余敌人: ${remaining}`, 10, 20);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ==================== 事件处理 ====================
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (gameState === GameState.PLAYING) {
        if (e.code === 'Space') {
            e.preventDefault();
            const now = Date.now();
            if (now - lastShotTime > SHOT_COOLDOWN) {
                if (player && player.active) {
                    player.shoot();
                    lastShotTime = now;
                }
            }
        }

        if (e.code === 'KeyP') {
            togglePause();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function togglePause() {
    if (gameState === GameState.PLAYING) {
        gameState = GameState.PAUSED;
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (gameState === GameState.PAUSED) {
        gameState = GameState.PLAYING;
        document.getElementById('pauseScreen').classList.add('hidden');
    }
}

function startGame() {
    score = 0;
    lives = 3;
    currentLevel = 0;
    updateUI();
    loadLevel(currentLevel);
    gameState = GameState.PLAYING;
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
}

function restartGame() {
    startGame();
}

// 按钮事件
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);

// 防止空格键滚动页面
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === GameState.PLAYING) {
        e.preventDefault();
    }
});

// ==================== 启动游戏 ====================
updateUI();
gameLoop();
