const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    player: {
        gold: 500,
        hp: 100,
        maxHp: 100,
        xp: 0,
        age: 1,
        goldPerSecond: 2,
        baseX: 50
    },
    enemy: {
        gold: 500,
        hp: 100,
        maxHp: 100,
        age: 1,
        goldPerSecond: 2,
        baseX: canvas.width - 50
    },
    units: [],
    projectiles: [],
    particles: [],
    running: true,
    lastGoldTime: Date.now(),
    lastEnemySpawnTime: Date.now()
};

// Unit definitions
const unitTypes = {
    clubman: {
        name: 'Clubman',
        cost: 50,
        hp: 50,
        maxHp: 50,
        damage: 10,
        speed: 1.5,
        range: 30,
        attackSpeed: 1000,
        color: '#8B4513',
        size: 20,
        xpReward: 10
    },
    swordsman: {
        name: 'Swordsman',
        cost: 100,
        hp: 80,
        maxHp: 80,
        damage: 20,
        speed: 1.8,
        range: 35,
        attackSpeed: 900,
        color: '#4169E1',
        size: 22,
        xpReward: 20
    },
    archer: {
        name: 'Archer',
        cost: 150,
        hp: 40,
        maxHp: 40,
        damage: 15,
        speed: 1.2,
        range: 200,
        attackSpeed: 1200,
        color: '#228B22',
        size: 18,
        isRanged: true,
        xpReward: 30
    },
    knight: {
        name: 'Knight',
        cost: 250,
        hp: 150,
        maxHp: 150,
        damage: 35,
        speed: 2,
        range: 40,
        attackSpeed: 800,
        color: '#FFD700',
        size: 25,
        xpReward: 50
    }
};

class Unit {
    constructor(type, isPlayer, x) {
        const template = unitTypes[type];
        Object.assign(this, JSON.parse(JSON.stringify(template)));
        this.isPlayer = isPlayer;
        this.x = x;
        this.y = canvas.height - 120;
        this.target = null;
        this.lastAttackTime = 0;
        this.id = Math.random();
    }

    update(deltaTime) {
        // Find nearest enemy
        this.findTarget();

        if (this.target) {
            const distance = Math.abs(this.target.x - this.x);

            if (distance <= this.range) {
                // Attack
                const now = Date.now();
                if (now - this.lastAttackTime >= this.attackSpeed) {
                    this.attack();
                    this.lastAttackTime = now;
                }
            } else {
                // Move towards target
                this.x += this.speed * (this.isPlayer ? 1 : -1);
            }
        } else {
            // Move towards enemy base
            this.x += this.speed * (this.isPlayer ? 1 : -1);

            // Attack enemy base if in range
            const enemyBase = this.isPlayer ? game.enemy : game.player;
            const baseX = this.isPlayer ? game.enemy.baseX : game.player.baseX;

            if (Math.abs(this.x - baseX) <= this.range) {
                const now = Date.now();
                if (now - this.lastAttackTime >= this.attackSpeed) {
                    enemyBase.hp -= this.damage;
                    this.lastAttackTime = now;
                    createParticles(baseX, canvas.height - 80, '#FF0000');

                    if (enemyBase.hp <= 0) {
                        endGame(this.isPlayer);
                    }
                }
            }
        }
    }

    findTarget() {
        this.target = null;
        let minDistance = Infinity;

        for (const unit of game.units) {
            if (unit.isPlayer !== this.isPlayer && unit.hp > 0) {
                const distance = Math.abs(unit.x - this.x);
                if (distance < minDistance) {
                    minDistance = distance;
                    this.target = unit;
                }
            }
        }
    }

    attack() {
        if (!this.target || this.target.hp <= 0) return;

        if (this.isRanged) {
            // Create projectile
            game.projectiles.push({
                x: this.x,
                y: this.y + 5,
                targetX: this.target.x,
                targetY: this.target.y + 5,
                damage: this.damage,
                speed: 5,
                owner: this,
                target: this.target
            });
        } else {
            // Melee attack
            this.target.hp -= this.damage;
            createParticles(this.target.x, this.target.y, '#FF6B6B');

            if (this.target.hp <= 0) {
                this.onKill(this.target);
            }
        }
    }

    onKill(target) {
        if (this.isPlayer) {
            game.player.gold += Math.floor(target.cost * 0.5);
            game.player.xp += target.xpReward;
        }
    }

    draw() {
        // Draw unit body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y, this.size, this.size);

        // Draw HP bar
        const hpBarWidth = this.size;
        const hpBarHeight = 4;
        const hpPercent = this.hp / this.maxHp;

        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - hpBarWidth/2, this.y - 8, hpBarWidth, hpBarHeight);
        ctx.fillStyle = hpPercent > 0.5 ? '#0F0' : hpPercent > 0.25 ? '#FF0' : '#F00';
        ctx.fillRect(this.x - hpBarWidth/2, this.y - 8, hpBarWidth * hpPercent, hpBarHeight);

        // Draw team indicator
        ctx.fillStyle = this.isPlayer ? '#00FF00' : '#FF0000';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 12, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function spawnUnit(type, isPlayer) {
    const side = isPlayer ? game.player : game.enemy;

    if (side.gold >= unitTypes[type].cost) {
        side.gold -= unitTypes[type].cost;
        const x = isPlayer ? game.player.baseX + 60 : game.enemy.baseX - 60;
        game.units.push(new Unit(type, isPlayer, x));
        return true;
    }
    return false;
}

function updateProjectiles() {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const proj = game.projectiles[i];

        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < proj.speed) {
            // Hit target
            if (proj.target && proj.target.hp > 0) {
                proj.target.hp -= proj.damage;
                createParticles(proj.target.x, proj.target.y, '#FF6B6B');

                if (proj.target.hp <= 0) {
                    proj.owner.onKill(proj.target);
                }
            }
            game.projectiles.splice(i, 1);
        } else {
            proj.x += (dx / distance) * proj.speed;
            proj.y += (dy / distance) * proj.speed;
        }
    }
}

function drawProjectiles() {
    ctx.fillStyle = '#FFD700';
    for (const proj of game.projectiles) {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 30,
            color
        });
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) {
            game.particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (const p of game.particles) {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
}

function drawBases() {
    // Player base
    ctx.fillStyle = '#2E8B57';
    ctx.fillRect(game.player.baseX - 30, canvas.height - 100, 60, 80);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(game.player.baseX - 25, canvas.height - 120, 50, 20);

    // Enemy base
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(game.enemy.baseX - 30, canvas.height - 100, 60, 80);
    ctx.fillStyle = '#4B0000';
    ctx.fillRect(game.enemy.baseX - 25, canvas.height - 120, 50, 20);

    // Ground
    ctx.fillStyle = '#654321';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
}

function enemyAI() {
    const now = Date.now();

    if (now - game.lastEnemySpawnTime >= 3000) {
        const enemyTypes = ['clubman', 'swordsman', 'archer', 'knight'];
        const weights = [0.4, 0.3, 0.2, 0.1];

        let random = Math.random();
        let selectedType = 'clubman';

        for (let i = 0; i < enemyTypes.length; i++) {
            if (random < weights[i]) {
                selectedType = enemyTypes[i];
                break;
            }
            random -= weights[i];
        }

        if (spawnUnit(selectedType, false)) {
            game.lastEnemySpawnTime = now;
        }
    }
}

function updateGold() {
    const now = Date.now();
    const deltaTime = (now - game.lastGoldTime) / 1000;

    if (deltaTime >= 1) {
        game.player.gold += game.player.goldPerSecond;
        game.enemy.gold += game.enemy.goldPerSecond;
        game.lastGoldTime = now;
    }
}

function updateUI() {
    document.getElementById('playerGold').textContent = Math.floor(game.player.gold);
    document.getElementById('playerHP').textContent = Math.floor(game.player.hp);
    document.getElementById('playerXP').textContent = Math.floor(game.player.xp);
    document.getElementById('playerAge').textContent = game.player.age;
    document.getElementById('enemyGold').textContent = Math.floor(game.enemy.gold);
    document.getElementById('enemyHP').textContent = Math.floor(game.enemy.hp);

    // Update button states
    document.querySelectorAll('.unit-button').forEach(button => {
        const unitType = button.id.replace('spawn', '').toLowerCase();
        const cost = unitTypes[unitType].cost;
        button.disabled = game.player.gold < cost || !game.running;
    });
}

function endGame(playerWon) {
    game.running = false;
    const gameOverDiv = document.getElementById('gameOver');
    const gameOverText = document.getElementById('gameOverText');
    const gameOverMessage = document.getElementById('gameOverMessage');

    gameOverDiv.style.display = 'block';

    if (playerWon) {
        gameOverText.textContent = 'VICTORY!';
        gameOverText.style.color = '#00FF00';
        gameOverMessage.textContent = 'You have conquered the enemy base!';
    } else {
        gameOverText.textContent = 'DEFEAT!';
        gameOverText.style.color = '#FF0000';
        gameOverMessage.textContent = 'Your base has been destroyed!';
    }
}

function restartGame() {
    game.player = {
        gold: 500,
        hp: 100,
        maxHp: 100,
        xp: 0,
        age: 1,
        goldPerSecond: 2,
        baseX: 50
    };
    game.enemy = {
        gold: 500,
        hp: 100,
        maxHp: 100,
        age: 1,
        goldPerSecond: 2,
        baseX: canvas.width - 50
    };
    game.units = [];
    game.projectiles = [];
    game.particles = [];
    game.running = true;
    game.lastGoldTime = Date.now();
    game.lastEnemySpawnTime = Date.now();

    document.getElementById('gameOver').style.display = 'none';
}

function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87ceeb');
    gradient.addColorStop(0.7, '#f0e68c');
    gradient.addColorStop(1, '#8b7355');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (game.running) {
        // Update
        updateGold();
        enemyAI();

        // Update units
        for (let i = game.units.length - 1; i >= 0; i--) {
            const unit = game.units[i];
            unit.update();

            if (unit.hp <= 0) {
                game.units.splice(i, 1);
            }
        }

        updateProjectiles();
        updateParticles();
    }

    // Draw
    drawBases();

    for (const unit of game.units) {
        unit.draw();
    }

    drawProjectiles();
    drawParticles();

    updateUI();

    requestAnimationFrame(gameLoop);
}

// Event listeners
document.getElementById('spawnClubman').addEventListener('click', () => spawnUnit('clubman', true));
document.getElementById('spawnSwordsman').addEventListener('click', () => spawnUnit('swordsman', true));
document.getElementById('spawnArcher').addEventListener('click', () => spawnUnit('archer', true));
document.getElementById('spawnKnight').addEventListener('click', () => spawnUnit('knight', true));
document.getElementById('restartButton').addEventListener('click', restartGame);

// Start game
gameLoop();
