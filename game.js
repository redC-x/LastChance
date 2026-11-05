const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);

let W, H, dpr = 1;
let running = false, paused = false, gameEnded = false;
let player;
let enemies = [], bullets = [], particles = [], pickups = [], chests = [];
let level = 1, kills = 0, score = 0;
let ammo = 12, reserve = 48;
let enemiesRemaining = 0, bossPending = false;
let spawnTimer = 0, spawnInterval = 1;
let fireHeld = false, reloading = false, reloadTimer = 0;
let shootTimer = 0, damageTimer = 0;
let joy = { x: 0, y: 0 }, keys = {};
let lastTime = 0, best = Number(localStorage.getItem("ultimoTurnoBest")) || 0;
let camera = { x: 0, y: 0 };
let worldTime = 0, chestKills = 0, pendingWeapon = null;
let messageTimeout;
$("best").textContent = best;

const CHUNK = 600;
const obstacleCache = new Map();

const weapons = {
    pistol: { name: "PISTOLA", damage: 35, mag: 12, reload: 1.35, fireRate: 0.28, speed: 520, pellets: 1, spread: 0.08, reserveMax: 160, description: "Equilibrada y confiable." },
    smg: { name: "SUBFUSIL", damage: 17, mag: 32, reload: 1.65, fireRate: 0.105, speed: 560, pellets: 1, spread: 0.13, reserveMax: 240, description: "Dispara rápido, daño moderado." },
    shotgun: { name: "ESCOPETA", damage: 19, mag: 6, reload: 1.9, fireRate: 0.72, speed: 430, pellets: 6, spread: 0.42, reserveMax: 90, description: "Seis perdigones de corto alcance." },
    rifle: { name: "FUSIL", damage: 48, mag: 10, reload: 1.8, fireRate: 0.43, speed: 760, pellets: 1, spread: 0.025, reserveMax: 140, description: "Mucho daño y gran precisión." }
};
let currentWeapon = "pistol";

function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function createPlayer() {
    return { x: 0, y: 0, radius: 13, speed: 190, health: 100, maxHealth: 100, angle: 0 };
}
function currentGun() { return weapons[currentWeapon]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Semilla determinista: cada zona genera siempre los mismos obstáculos.
function hash2(x, y) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
}
function randomFrom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function getChunkObstacles(cx, cy) {
    const key = `${cx},${cy}`;
    if (obstacleCache.has(key)) return obstacleCache.get(key);
    const rand = randomFrom(hash2(cx, cy));
    const list = [];
    const count = 5 + Math.floor(rand() * 7);
    for (let i = 0; i < count; i++) {
        const w = 38 + rand() * 75, h = 35 + rand() * 70;
        const x = cx * CHUNK + 25 + rand() * (CHUNK - w - 50);
        const y = cy * CHUNK + 25 + rand() * (CHUNK - h - 50);
        // Mantener despejada la zona inicial alrededor del origen.
        if (Math.hypot(x + w / 2, y + h / 2) < 190) continue;
        const kind = rand() < 0.58 ? "crate" : "rock";
        list.push({ x, y, w, h, kind });
    }
    obstacleCache.set(key, list);
    return list;
}
function nearbyObstacles(x, y, range = 2) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const result = [];
    for (let yy = cy - range; yy <= cy + range; yy++)
        for (let xx = cx - range; xx <= cx + range; xx++)
            result.push(...getChunkObstacles(xx, yy));
    return result;
}
function circleRectCollision(x, y, r, rect) {
    const nx = clamp(x, rect.x, rect.x + rect.w);
    const ny = clamp(y, rect.y, rect.y + rect.h);
    return Math.hypot(x - nx, y - ny) < r;
}
function blocked(x, y, r) {
    return nearbyObstacles(x, y, 1).some(o => circleRectCollision(x, y, r, o));
}
function moveWithCollision(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (!blocked(nx, entity.y, radius)) entity.x = nx;
    const ny = entity.y + dy;
    if (!blocked(entity.x, ny, radius)) entity.y = ny;
}
function safePositionAroundPlayer(minDist = 380, maxDist = 620, radius = 16) {
    for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = minDist + Math.random() * (maxDist - minDist);
        const x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
        if (!blocked(x, y, radius)) return { x, y };
    }
    return { x: player.x + maxDist, y: player.y };
}

// PROGRESIÓN POR BAJAS
function updateLevelHUD() {
    const next = level * 10;
    const previous = (level - 1) * 10;
    $("wave").textContent = level;
    $("levelLabel").textContent = "SIGUIENTE AMENAZA";
    $("progressText").textContent = `${kills - previous} / 10`;
    $("progressFill").style.width = `${clamp((kills - previous) / 10 * 100, 0, 100)}%`;
}
function raiseThreat() {
    level = Math.floor(kills / 10) + 1;
    updateLevelHUD();
    if (level % 5 === 0 && kills % 10 === 0) {
        bossPending = true;
        showMessage("¡SE DETECTA UNA AMENAZA MAYOR!");
        spawnTimer = Math.max(spawnTimer, 1.5);
    } else {
        showMessage("¡LA AMENAZA HA AUMENTADO!");
    }
}
function spawnEnemy(type = "normal") {
    const pos = safePositionAroundPlayer();
    const difficulty = level - 1;
    let enemy;
    if (type === "boss") {
        const hp = 450 + level * 90;
        enemy = { ...pos, type, radius: 27, health: hp, maxHealth: hp,
            speed: Math.min(72 + level * 1.5, 105), damage: 24 + Math.floor(level * 1.5), attackTimer: 0 };
    } else if (type === "strong") {
        const hp = 75 + difficulty * 12;
        enemy = { ...pos, type, radius: 17, health: hp, maxHealth: hp,
            speed: Math.min(48 + level * 1.7, 95), damage: 14 + Math.floor(level), attackTimer: 0 };
    } else {
        const hp = 35 + difficulty * 6;
        enemy = { ...pos, type, radius: 12, health: hp, maxHealth: hp,
            speed: Math.min(62 + level * 2, 135), damage: 8 + Math.floor(level * 0.7), attackTimer: 0 };
    }
    enemies.push(enemy);
}
function updateSpawning(dt) {
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    const maxEnemies = Math.min(7 + level * 2, 28);
    if (enemies.length >= maxEnemies) { spawnTimer = 0.3; return; }
    if (bossPending && !enemies.some(e => e.type === "boss")) {
        spawnEnemy("boss"); bossPending = false; showMessage("¡EL JEFE HA LLEGADO!"); spawnTimer = 1.2; return;
    }
    const strongChance = Math.min(0.12 + level * 0.035, 0.58);
    spawnEnemy(Math.random() < strongChance ? "strong" : "normal");
    const amount = 1 + Math.floor(level * 0.35);
    spawnTimer = Math.max(0.25, (1.35 - level * 0.045) / amount);
}

function nearestEnemy() {
    let nearest = null, minDistance = Infinity;
    for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (d < minDistance) { minDistance = d; nearest = enemy; }
    }
    return nearest;
}
function shoot() {
    if (!running || paused || gameEnded || reloading || shootTimer > 0) return;
    if (ammo <= 0) { fireHeld = false; showMessage("¡SIN MUNICIÓN!"); return; }
    const target = nearestEnemy();
    if (!target) return;
    const gun = currentGun();
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    player.angle = baseAngle;
    for (let i = 0; i < gun.pellets; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * gun.spread;
        bullets.push({
            x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18,
            vx: Math.cos(angle) * gun.speed, vy: Math.sin(angle) * gun.speed,
            life: gun.id === "shotgun" ? 0.65 : 1.5, damage: gun.damage, radius: 3
        });
    }
    ammo--;
    shootTimer = gun.fireRate;
    updateHUD();
}
function reload() {
    const gun = currentGun();
    if (!running || paused || reloading || ammo >= gun.mag || reserve <= 0) return;
    reloading = true; reloadTimer = gun.reload; fireHeld = false;
    showMessage("RECARGANDO...");
}
function finishReload() {
    const gun = currentGun();
    const amount = Math.min(gun.mag - ammo, reserve);
    ammo += amount; reserve -= amount; reloading = false;
    updateHUD(); showMessage("CARGADOR LISTO");
}

function dropPickup(x, y) {
    if (Math.random() > 0.28) return;
    pickups.push({ x, y, type: Math.random() < 0.52 ? "ammo" : "health", radius: 11 });
}
function collectPickup(p) {
    if (p.type === "ammo") {
        const gain = currentGun().mag * 2;
        const before = reserve;
        reserve = Math.min(currentGun().reserveMax, reserve + gain);
        showMessage(`+${reserve - before} BALAS DE RESERVA`);
    } else {
        player.health = Math.min(player.maxHealth, player.health + 30);
        showMessage("+30 VIDA");
    }
    updateHUD();
}
function spawnChest(x = player.x, y = player.y) {
    let pos = safePositionAroundPlayer(130, 260, 17);
    if (x !== player.x || y !== player.y) pos = { x, y };
    if (blocked(pos.x, pos.y, 16)) pos = safePositionAroundPlayer(130, 260, 17);
    chests.push({ x: pos.x, y: pos.y, radius: 17, opened: false });
}
function openChest(chest) {
    if (chest.opened || paused || gameEnded) return;
    chest.opened = true;
    pendingWeapon = chooseWeapon();
    paused = true; fireHeld = false;
    $("newWeaponName").textContent = weapons[pendingWeapon].name;
    $("newWeaponStats").textContent =
        `Daño: ${weapons[pendingWeapon].damage} · Cargador: ${weapons[pendingWeapon].mag} · Cadencia: ${weapons[pendingWeapon].fireRate}s`;
    $("newWeaponDescription").textContent = weapons[pendingWeapon].description;
    $("chestDescription").textContent = `Tu arma actual: ${currentGun().name}. ¿Quieres cambiarla?`;
    $("chestScreen").classList.remove("hidden");
}
function chooseWeapon() {
    const options = Object.keys(weapons).filter(k => k !== currentWeapon);
    return options[Math.floor(Math.random() * options.length)];
}
function closeChest(changeWeapon) {
    if (changeWeapon && pendingWeapon) {
        currentWeapon = pendingWeapon;
        ammo = currentGun().mag;
        reserve = Math.min(currentGun().reserveMax, Math.max(reserve, currentGun().mag * 2));
        reloading = false;
        updateHUD();
        showMessage(`ARMA EQUIPADA: ${currentGun().name}`);
    }
    pendingWeapon = null;
    $("chestScreen").classList.add("hidden");
    paused = false;
}

function createParticles(x, y, amount = 5) {
    for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 100;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 });
    }
}
function updatePlayer(dt) {
    let mx = joy.x, my = joy.y;
    if (keys.w || keys.arrowup) my--;
    if (keys.s || keys.arrowdown) my++;
    if (keys.a || keys.arrowleft) mx--;
    if (keys.d || keys.arrowright) mx++;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    moveWithCollision(player, mx * player.speed * dt, my * player.speed * dt, player.radius);
    const target = nearestEnemy();
    if (target) player.angle = Math.atan2(target.y - player.y, target.x - player.x);
}
function updateEnemies(dt) {
    for (const e of enemies) {
        const dx = player.x - e.x, dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > e.radius + player.radius) {
            moveWithCollision(e, dx / dist * e.speed * dt, dy / dist * e.speed * dt, e.radius);
        } else {
            e.attackTimer -= dt;
            if (e.attackTimer <= 0 && damageTimer <= 0) {
                player.health -= e.damage;
                e.attackTimer = e.type === "boss" ? 0.65 : 0.9;
                damageTimer = 0.5;
                createParticles(player.x, player.y, 7);
                updateHUD();
                if (player.health <= 0) { endGame(); return; }
            }
        }
    }
}
function updateBullets(dt) {
    for (const b of bullets) {
        const steps = 3;
        for (let s = 0; s < steps && b.life > 0; s++) {
            b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
            if (blocked(b.x, b.y, 2)) { b.life = 0; break; }
            for (const e of enemies) {
                if (e.health <= 0 || b.life <= 0) continue;
                if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 4) {
                    e.health -= b.damage; b.life = 0;
                    createParticles(b.x, b.y, 3);
                    if (e.health <= 0) enemyKilled(e);
                    break;
                }
            }
            b.life -= dt / steps;
        }
    }
    bullets = bullets.filter(b => b.life > 0);
    enemies = enemies.filter(e => e.health > 0);
}
function enemyKilled(e) {
    kills++;
    score += e.type === "boss" ? 250 : e.type === "strong" ? 25 : 10;
    dropPickup(e.x, e.y);
    if (e.type === "boss") {
        showMessage("¡JEFE ELIMINADO!");
        for (let i = 0; i < 3; i++) pickups.push({ x: e.x + (i - 1) * 22, y: e.y + 15, type: i === 1 ? "health" : "ammo", radius: 11 });
    }
    createParticles(e.x, e.y, 12);
    const oldLevel = level;
    const newLevel = Math.floor(kills / 10) + 1;
    if (newLevel > oldLevel) { level = newLevel; raiseThreat(); }
    if (kills > 0 && kills % 12 === 0) {
        spawnChest();
        showMessage("¡UN COFRE HA APARECIDO!");
    }
    updateHUD(); updateLevelHUD();
}
function updatePickupsAndChests() {
    pickups = pickups.filter(p => {
        if (Math.hypot(p.x - player.x, p.y - player.y) < p.radius + player.radius) {
            collectPickup(p); return false;
        }
        return true;
    });
    for (const c of chests) {
        if (!c.opened && Math.hypot(c.x - player.x, c.y - player.y) < c.radius + player.radius + 5) {
            openChest(c); break;
        }
    }
}
function update(dt) {
    if (!running || paused || gameEnded) return;
    worldTime += dt;
    updateSpawning(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    if (gameEnded) return;
    updateBullets(dt);
    updatePickupsAndChests();
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
    shootTimer = Math.max(0, shootTimer - dt);
    damageTimer = Math.max(0, damageTimer - dt);
    if (reloading) { reloadTimer -= dt; if (reloadTimer <= 0) finishReload(); }
    if (fireHeld) shoot();
}

// DIBUJO DEL MUNDO: todo se dibuja relativo a la cámara.
function drawBackground() {
    const left = camera.x - W / 2, top = camera.y - H / 2;
    const grid = 60;
    const startX = Math.floor(left / grid) * grid;
    const startY = Math.floor(top / grid) * grid;
    ctx.strokeStyle = "#ffffff0b"; ctx.lineWidth = 1;
    for (let x = startX; x < left + W + grid; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + H); ctx.stroke();
    }
    for (let y = startY; y < top + H + grid; y += grid) {
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + W, y); ctx.stroke();
    }
    const obstacles = nearbyObstacles(camera.x, camera.y, 2);
    for (const o of obstacles) {
        if (o.kind === "crate") {
            ctx.fillStyle = "#554b39"; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = "#9b8258"; ctx.lineWidth = 3; ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
            ctx.beginPath(); ctx.moveTo(o.x + 5, o.y + 5); ctx.lineTo(o.x + o.w - 5, o.y + o.h - 5);
            ctx.moveTo(o.x + o.w - 5, o.y + 5); ctx.lineTo(o.x + 5, o.y + o.h - 5); ctx.stroke();
        } else {
            ctx.fillStyle = "#46564d"; ctx.beginPath();
            ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#78877b"; ctx.lineWidth = 2; ctx.stroke();
        }
    }
}
function drawPlayer() {
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
    ctx.fillStyle = "#d0d8c7"; ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#333"; ctx.fillRect(4, -4, 22, 8); ctx.restore();
    drawHealthBar(player.x, player.y - 25, 34, 4, player.health, player.maxHealth, "#54d879");
    if (damageTimer > 0) { ctx.strokeStyle = "#ff5555"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, 21, 0, Math.PI * 2); ctx.stroke(); }
}
function drawHealthBar(x, y, width, height, hp, maxHp, color) {
    ctx.fillStyle = "#111d"; ctx.fillRect(x - width / 2, y, width, height);
    ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * clamp(hp / maxHp, 0, 1), height);
}
function drawEnemies() {
    for (const e of enemies) {
        ctx.fillStyle = e.type === "boss" ? "#742b35" : e.type === "strong" ? "#a34d32" : "#718f69";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e9e5c8"; ctx.beginPath();
        ctx.arc(e.x - 4, e.y - 3, 2, 0, Math.PI * 2); ctx.arc(e.x + 4, e.y - 3, 2, 0, Math.PI * 2); ctx.fill();
        const bw = e.type === "boss" ? 68 : e.type === "strong" ? 42 : 30;
        drawHealthBar(e.x, e.y - e.radius - 10, bw, e.type === "boss" ? 7 : 4, e.health, e.maxHealth, e.type === "boss" ? "#ff5353" : "#54d879");
        if (e.type === "boss") { ctx.fillStyle = "#ff7777"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.fillText("JEFE", e.x, e.y - e.radius - 17); }
    }
}
function drawBullets() {
    for (const b of bullets) { ctx.fillStyle = "#ffe17b"; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
}
function drawPickups() {
    for (const p of pickups) {
        ctx.fillStyle = p.type === "ammo" ? "#e5bc45" : "#4cdb76";
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#17221d"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
        ctx.fillText(p.type === "ammo" ? "A" : "+", p.x, p.y + 4);
    }
    for (const c of chests) {
        if (c.opened) continue;
        ctx.fillStyle = "#9c7131"; ctx.fillRect(c.x - 13, c.y - 10, 26, 21);
        ctx.fillStyle = "#e6c76b"; ctx.fillRect(c.x - 13, c.y - 10, 26, 6);
        ctx.fillStyle = "#3a2a18"; ctx.fillRect(c.x - 2, c.y - 3, 4, 7);
        ctx.strokeStyle = "#f7d77b"; ctx.strokeRect(c.x - 13, c.y - 10, 26, 21);
    }
}
function drawParticles() {
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / 0.35); ctx.fillStyle = "#d9c5a0"; ctx.fillRect(p.x, p.y, 3, 3); }
    ctx.globalAlpha = 1;
}
function draw() {
    if (!player) return;
    camera.x = player.x; camera.y = player.y;
    ctx.fillStyle = "#17221d";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 - camera.x, H / 2 - camera.y);
    drawBackground(); drawPickups(); drawBullets(); drawEnemies(); drawParticles(); drawPlayer();
    ctx.restore();
}
function updateHUD() {
    $("healthFill").style.width = `${clamp(player.health, 0, 100)}%`;
    $("ammo").textContent = ammo;
    $("reserve").textContent = `/ ${reserve}`;
    $("kills").textContent = kills;
    $("weaponName").textContent = currentGun().name;
}
function showMessage(text) {
    $("message").textContent = text;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => $("message").textContent = "", 1800);
}
function endGame() {
    if (gameEnded) return;
    gameEnded = true; running = false; fireHeld = false;
    if (kills > best) { best = kills; localStorage.setItem("ultimoTurnoBest", best); }
    $("best").textContent = best;
    $("finalWave").textContent = level;
    $("finalKills").textContent = kills;
    $("gameOver").classList.remove("hidden");
}
function startGame() {
    enemies = []; bullets = []; particles = []; pickups = []; chests = [];
    level = 1; kills = 0; score = 0; ammo = 12; reserve = 48;
    enemiesRemaining = 0; bossPending = false; spawnTimer = 0.5;
    reloading = false; fireHeld = false; paused = false; gameEnded = false;
    shootTimer = 0; damageTimer = 0; reloadTimer = 0; chestKills = 0;
    currentWeapon = "pistol"; pendingWeapon = null;
    joy.x = 0; joy.y = 0; keys = {};
    stick.style.transform = "translate(0, 0)";
    player = createPlayer(); camera.x = 0; camera.y = 0;
    $("menu").classList.add("hidden"); $("gameOver").classList.add("hidden");
    $("pauseScreen").classList.add("hidden"); $("chestScreen").classList.add("hidden");
    $("pauseBtn").textContent = "Ⅱ";
    updateHUD(); updateLevelHUD(); running = true;
}
$("startBtn").addEventListener("click", startGame);
$("againBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);
$("pauseBtn").addEventListener("click", () => {
    if (!running || gameEnded || $("chestScreen").classList.contains("hidden") === false) return;
    paused = !paused;
    $("pauseScreen").classList.toggle("hidden", !paused);
    $("pauseBtn").textContent = paused ? "▶" : "Ⅱ";
    fireHeld = false;
});
$("resumeBtn").addEventListener("click", () => {
    paused = false; $("pauseScreen").classList.add("hidden"); $("pauseBtn").textContent = "Ⅱ";
});
$("takeWeaponBtn").addEventListener("click", () => closeChest(true));
$("keepWeaponBtn").addEventListener("click", () => closeChest(false));

const joystick = $("joystick"), stick = $("stick");
let joystickPointer = null;
function moveJoystick(e) {
    const rect = joystick.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const max = 35, distance = Math.hypot(dx, dy);
    if (distance > max) { dx = dx / distance * max; dy = dy / distance * max; }
    joy.x = dx / max; joy.y = dy / max;
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
}
joystick.addEventListener("pointerdown", e => { e.preventDefault(); joystickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); moveJoystick(e); });
joystick.addEventListener("pointermove", e => { if (e.pointerId === joystickPointer) moveJoystick(e); });
function stopJoystick(e) {
    if (e.pointerId !== joystickPointer) return;
    joystickPointer = null; joy.x = 0; joy.y = 0; stick.style.transform = "translate(0, 0)";
}
joystick.addEventListener("pointerup", stopJoystick);
joystick.addEventListener("pointercancel", stopJoystick);

const fireBtn = $("fireBtn");
fireBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); fireHeld = true; fireBtn.setPointerCapture(e.pointerId); shoot();
});
function stopFire() { fireHeld = false; }
fireBtn.addEventListener("pointerup", stopFire);
fireBtn.addEventListener("pointercancel", stopFire);
fireBtn.addEventListener("lostpointercapture", stopFire);
$("reloadBtn").addEventListener("click", reload);

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase(); keys[key] = true;
    if (key === "r") reload();
    if (key === " " && !e.repeat) { e.preventDefault(); fireHeld = true; shoot(); }
});
window.addEventListener("keyup", e => {
    const key = e.key.toLowerCase(); keys[key] = false;
    if (key === " ") fireHeld = false;
});
window.addEventListener("blur", () => {
    fireHeld = false; keys = {}; joy.x = 0; joy.y = 0;
    stick.style.transform = "translate(0, 0)";
});

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.04);
    lastTime = timestamp;
    update(dt); draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);