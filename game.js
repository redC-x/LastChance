// ==================================================
// ÚLTIMO TURNO 5.1
// MOTOR PRINCIPAL
// ==================================================
window.addEventListener("error", function(e) {
  let errorBox = document.getElementById("debugError");

  if (!errorBox) {
    errorBox = document.createElement("div");
    errorBox.id = "debugError";
    errorBox.style.cssText = `
      position:fixed;
      z-index:99999;
      top:10px;
      left:10px;
      right:10px;
      padding:15px;
      background:#8b1717;
      color:white;
      font-size:13px;
      overflow-wrap:break-word;
    `;
    document.body.appendChild(errorBox);
  }

  errorBox.textContent =
    "ERROR JS: " + e.message +
    " | Línea: " + e.lineno;
});
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const $ = id => document.getElementById(id);

let W = 0, H = 0, dpr = 1;
let running = false, paused = false, gameEnded = false;

let player;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let acidPools = [];
let particles = [];
let pickups = [];
let chests = [];
let powerChests = [];

let level = 1, kills = 0, score = 0;
let ammo = 12, reserve = 48;

let bossPending = false;
let spawnTimer = 0;
let fireHeld = false;
let reloading = false;
let reloadTimer = 0;
let shootTimer = 0;
let damageTimer = 0;

let joy = { x: 0, y: 0 };
let keys = {};
let lastTime = 0;
let best = Number(localStorage.getItem("ultimoTurnoBest")) || 0;

let camera = { x: 0, y: 0 };
let worldTime = 0;
let messageTimeout = null;

let pendingWeapon = null;
let currentWeapon = "pistol";

let powerChestTimer = 65;
let inventoryTab = "passive";
let returnToPause = false;
let powerChoiceOpen = false;

let passiveInventory = {};
let activeInventory = {};
let equippedActives = [null, null];

let characterId = localStorage.getItem("ultimoTurnoCharacter") || "soldier";
let skinId = "green";
let playerMoney = Number(localStorage.getItem("ultimoTurnoMoney")) || 0;
let unlockedCharacters = JSON.parse(localStorage.getItem("ultimoTurnoUnlocked") || '["soldier"]');
let bossCounter = 0, ammoChestTimer = 0, ammoChest = null;
let mouseAim = { x: 0, y: 0, active: false };

let scenarioIndex = 0;
let scenarioName = "";

const CHUNK = 600;
const obstacleCache = new Map();

const characters = {
    soldier: {
        name: "SOLDADO",
        description: "Daño equilibrado.",
        damage: 1.10,
        health: 100,
        speed: 190,
        color: "#83a77d", cost: 0
    },
    medic: {
        name: "MÉDICO",
        description: "Mayor resistencia y curación.",
        damage: 0.95,
        health: 125,
        speed: 180,
        color: "#e5e5df", cost: 1120
    },
    engineer: {
        name: "INGENIERO",
        description: "Más munición y recarga rápida.",
        damage: 1,
        health: 105,
        speed: 180,
        color: "#d1a65b", cost: 5000
    },
    scout: {
        name: "EXPLORADOR",
        description: "Mayor velocidad.",
        damage: 0.95,
        health: 90,
        speed: 225,
        color: "#75a9c9", cost: 6500
    }
};

const skins = {
    green: "#83a77d",
    blue: "#69a9d9",
    red: "#bd514a",
    gold: "#e6c76b"
};

const rarity = {
    common: { name: "COMÚN", color: "#aab3aa", weight: 48 },
    uncommon: { name: "POCO COMÚN", color: "#59ce81", weight: 27 },
    rare: { name: "RARO", color: "#62adf0", weight: 15 },
    epic: { name: "ÉPICO", color: "#bd78e8", weight: 8 },
    legendary: { name: "LEGENDARIO", color: "#f0c75c", weight: 2 }
};

const scenarios = [
    {
        name: "INSTALACIÓN ABANDONADA",
        background: "#17221d",
        grid: "#ffffff0b",
        crate: "#554b39",
        rock: "#46564d"
    },
    {
        name: "ZONA URBANA",
        background: "#242329",
        grid: "#ffffff0c",
        crate: "#65534a",
        rock: "#55545e"
    },
    {
        name: "PLANTA QUÍMICA",
        background: "#202b20",
        grid: "#a9e75b12",
        crate: "#56633c",
        rock: "#52644a"
    },
    {
        name: "BÚNKER MILITAR",
        background: "#20282e",
        grid: "#9bb8c512",
        crate: "#46515b",
        rock: "#3c4851"
    },
    {
        name: "ZONA DE EVACUACIÓN",
        background: "#30251f",
        grid: "#ffbd8010",
        crate: "#72513c",
        rock: "#5d5148"
    }
];

const weapons = {
    pistol: {
        name: "PISTOLA",
        damage: 35,
        mag: 12,
        reload: 1.35,
        fireRate: 0.28,
        speed: 520,
        pellets: 1,
        spread: 0.08,
        reserveMax: 160,
        description: "Equilibrada y confiable."
    },
    smg: {
        name: "SUBFUSIL",
        damage: 17,
        mag: 32,
        reload: 1.65,
        fireRate: 0.105,
        speed: 560,
        pellets: 1,
        spread: 0.13,
        reserveMax: 240,
        description: "Dispara rápido, daño moderado."
    },
    shotgun: {
        name: "ESCOPETA",
        damage: 19,
        mag: 6,
        reload: 1.9,
        fireRate: 0.72,
        speed: 430,
        pellets: 6,
        spread: 0.42,
        reserveMax: 90,
        description: "Seis perdigones de corto alcance."
    },
    rifle: {
        name: "FUSIL",
        damage: 48,
        mag: 25,
        reload: 1.8,
        fireRate: 0.43,
        speed: 760,
        pellets: 1,
        spread: 0.025,
        reserveMax: 140,
        description: "Mucho daño y gran precisión."
    },
    flamethrower: {
        name: "LANZALLAMAS",
        damage: 12,
        mag: 80,
        reload: 2.3,
        fireRate: 0.075,
        speed: 270,
        pellets: 1,
        spread: 0.24,
        reserveMax: 240,
        range: 210,
        description: "Llama continua que quema enemigos cercanos."
    },
    laser: {
        name: "LÁSER",
        damage: 75,
        mag: 18,
        reload: 1.8,
        fireRate: 0.48,
        speed: 1050,
        pellets: 1,
        spread: 0,
        reserveMax: 120,
        pierce: true,
        description: "Rayo preciso que atraviesa enemigos."
    }
};

const powers = {
    shield: {
        name: "ESCUDO",
        type: "passive",
        rarity: "uncommon",
        description: "Aumenta tu protección.",
        values: [30, 45, 60],
        suffix: "de escudo",
        maxStars: 3
    },
    damage: {
        name: "POTENCIA",
        type: "passive",
        rarity: "rare",
        description: "Aumenta el daño de tus armas.",
        values: [15, 25, 40],
        suffix: "% de daño",
        maxStars: 3
    },
    speed: {
        name: "ADRENALINA",
        type: "passive",
        rarity: "uncommon",
        description: "Aumenta tu velocidad.",
        values: [10, 20, 30],
        suffix: "% de velocidad",
        maxStars: 3
    },
    regeneration: {
        name: "REGENERACIÓN",
        type: "passive",
        rarity: "rare",
        description: "Recuperas vida poco a poco.",
        values: [1, 2, 3],
        suffix: "vida por segundo",
        maxStars: 3
    },
    critical: {
        name: "PRECISIÓN LETAL",
        type: "passive",
        rarity: "epic",
        description: "Probabilidad de causar daño crítico.",
        values: [8, 14, 22],
        suffix: "% crítico",
        maxStars: 3
    },
    reload: {
        name: "RECARGA RÁPIDA",
        type: "passive",
        rarity: "uncommon",
        description: "Recargas más rápido.",
        values: [12, 22, 35],
        suffix: "% de velocidad de recarga",
        maxStars: 3
    },
    vampirism: {
        name: "VAMPIRISMO",
        type: "passive",
        rarity: "legendary",
        description: "Recuperas vida al eliminar enemigos.",
        values: [2, 4, 6],
        suffix: "vida por baja",
        maxStars: 3
    },
    glass: {
        name: "SOBRECARGA",
        type: "passive",
        rarity: "epic",
        description: "Más daño, pero recibes más daño.",
        values: [25, 40, 55],
        suffix: "% de daño aumentado",
        maxStars: 3,
        drawback: [10, 15, 20]
    },
    berserker: {
        name: "BERSERKER",
        type: "passive",
        rarity: "rare",
        description: "Más daño cuando tienes poca vida.",
        values: [15, 25, 40],
        suffix: "% de daño adicional",
        maxStars: 3
    },
    drone: {
        name: "DRON DE COMBATE",
        type: "active",
        rarity: "epic",
        description: "Un dron dispara automáticamente durante 8 segundos.",
        cooldown: 22,
        duration: 8,
        maxStars: 3
    },
    explosion: {
        name: "EXPLOSIÓN",
        type: "active",
        rarity: "rare",
        description: "Provoca una explosión alrededor del jugador.",
        cooldown: 18,
        maxStars: 3
    },
    heal: {
        name: "BOTIQUÍN",
        type: "active",
        rarity: "common",
        description: "Recupera una parte de tu vida.",
        cooldown: 25,
        maxStars: 3
    },
    freeze: {
        name: "CONGELACIÓN",
        type: "active",
        rarity: "epic",
        description: "Detiene a los enemigos durante unos segundos.",
        cooldown: 24,
        duration: 4,
        maxStars: 3
    },
    turret: {
        name: "TORRETA",
        type: "active",
        rarity: "legendary",
        description: "Coloca una torreta que ataca enemigos.",
        cooldown: 30,
        duration: 12,
        maxStars: 3
    },
    fury: {
        name: "FURIA",
        type: "active",
        rarity: "rare",
        description: "Duplica el daño temporalmente.",
        cooldown: 25,
        duration: 7,
        maxStars: 3
    }
};

let powerCooldowns = {};
let drones = [];
let turrets = [];
let shieldValue = 0;
let temporaryPower = null;
let temporaryTimer = 0;
let freezeTimer = 0;

// --------------------------------------------------
// CONFIGURACIÓN Y RESOLUCIÓN
// --------------------------------------------------

function resize() {
    const rect = canvas.getBoundingClientRect();

    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);

    // Limitar DPR reduce el costo de renderizado en móviles.
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => {
    setTimeout(resize, 150);
});

resize();

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function createPlayer() {
    const character = characters[characterId];

    return {
        x: 0,
        y: 0,
        radius: 13,
        speed: character.speed,
        health: character.health,
        maxHealth: character.health,
        angle: 0,
        shield: 0,
        color: skins[skinId] || character.color
    };
}

function currentGun() {
    return weapons[currentWeapon];
}

// --------------------------------------------------
// GENERACIÓN DEL MUNDO
// --------------------------------------------------

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

    if (obstacleCache.has(key)) {
        return obstacleCache.get(key);
    }

    const rand = randomFrom(hash2(cx, cy));
    const list = [];
    const count = 5 + Math.floor(rand() * 7);

    for (let i = 0; i < count; i++) {
        const w = 38 + rand() * 75;
        const h = 35 + rand() * 70;
        const x = cx * CHUNK + 75 + rand() * (CHUNK - w - 150);
        const y = cy * CHUNK + 75 + rand() * (CHUNK - h - 150);

        if (Math.hypot(x + w / 2, y + h / 2) < 190) continue;

        let overlap = false;

        for (const o of list) {
            const separated =
                x + w + 22 < o.x ||
                x > o.x + o.w + 22 ||
                y + h + 22 < o.y ||
                y > o.y + o.h + 22;

            if (!separated) {
                overlap = true;
                break;
            }
        }

        if (!overlap) {
            list.push({
                x, y, w, h,
                kind: rand() < 0.58 ? "crate" : "rock"
            });
        }
    }

    obstacleCache.set(key, list);

    // Evita acumular miles de chunks en partidas largas.
    if (obstacleCache.size > 120) {
        const first = obstacleCache.keys().next().value;
        obstacleCache.delete(first);
    }

    return list;
}

function nearbyObstacles(x, y, range = 2) {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    const result = [];

    for (let yy = cy - range; yy <= cy + range; yy++) {
        for (let xx = cx - range; xx <= cx + range; xx++) {
            result.push(...getChunkObstacles(xx, yy));
        }
    }

    return result;
}

function circleRectCollision(x, y, r, rect) {
    const nx = clamp(x, rect.x, rect.x + rect.w);
    const ny = clamp(y, rect.y, rect.y + rect.h);

    return Math.hypot(x - nx, y - ny) < r;
}

function blocked(x, y, r) {
    return nearbyObstacles(x, y, 1).some(o =>
        circleRectCollision(x, y, r, o)
    );
}

function moveWithCollision(entity, dx, dy, radius) {
    const nx = entity.x + dx;

    if (!blocked(nx, entity.y, radius)) {
        entity.x = nx;
    }

    const ny = entity.y + dy;

    if (!blocked(entity.x, ny, radius)) {
        entity.y = ny;
    }
}

function safePositionAroundPlayer(minDist = 380, maxDist = 620, radius = 16) {
    for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = minDist + Math.random() * (maxDist - minDist);
        const x = player.x + Math.cos(a) * d;
        const y = player.y + Math.sin(a) * d;

        if (!blocked(x, y, radius)) return { x, y };
    }

    return {
        x: player.x + maxDist,
        y: player.y
    };
}

// --------------------------------------------------
// ESCENARIOS
// --------------------------------------------------

function updateScenario() {
    const index = Math.min(4, Math.floor((level - 1) / 4));

    if (index === scenarioIndex && scenarioName !== "") return;

    const changed = scenarioName !== "";

    scenarioIndex = index;
    scenarioName = scenarios[index].name;

    $("scenarioLabel").textContent = scenarioName;

    if (changed) {
        showMessage("NUEVA ZONA: " + scenarioName);
        createParticles(player.x, player.y, 25);
    }
}

// --------------------------------------------------
// PROGRESIÓN
// --------------------------------------------------

function updateLevelHUD() {
    const previous = (level - 1) * 10;

    $("wave").textContent = level;
    $("levelLabel").textContent = "SIGUIENTE AMENAZA";
    $("progressText").textContent = `${kills - previous} / 10`;

    $("progressFill").style.width =
        `${clamp((kills - previous) / 10 * 100, 0, 100)}%`;
}

function raiseThreat() {
    updateLevelHUD();
    updateScenario();

    if (level % 5 === 0) {
        bossPending = true;
        showMessage("¡SE DETECTA UNA AMENAZA MAYOR!");
        spawnTimer = Math.max(spawnTimer, 1.5);
    } else {
        showMessage("¡LA AMENAZA HA AUMENTADO!");
    }
}

// --------------------------------------------------
// ENEMIGOS
// --------------------------------------------------

function spawnEnemy(type = "normal") {
    const pos = safePositionAroundPlayer();
    const difficulty = level - 1;

    let hp = 35 + difficulty * 6;
    let radius = 12;
    let speed = Math.min(62 + level * 2, 135);
    let damage = 8 + Math.floor(level * 0.7);

    if (type === "strong") {
        hp = 75 + difficulty * 12;
        radius = 17;
        speed = Math.min(48 + level * 1.7, 95);
        damage = 14 + Math.floor(level);
    }

    if (type === "acid") {
        hp = 65 + difficulty * 9;
        radius = 15;
        speed = Math.min(42 + level, 65);
        damage = 8 + Math.floor(level * 0.5);
    }

    if (type === "guardian") {
        hp = 150 + difficulty * 15;
        radius = 21;
        speed = Math.min(38 + level, 65);
        damage = 18 + Math.floor(level);
    }

    if (type === "boss") {
        hp = 450 + level * 90;
        radius = 27;
        speed = Math.min(72 + level * 1.5, 105);
        damage = 24 + Math.floor(level * 1.5);
    }

    if (type === "runner") {
        hp = 28 + difficulty * 5;
        radius = 10;
        speed = Math.min(120 + level * 2, 190);
        damage = 7 + Math.floor(level * 0.6);
    }

    if (type === "tank") {
        hp = 220 + difficulty * 22;
        radius = 24;
        speed = Math.min(28 + level, 48);
        damage = 24 + Math.floor(level);
    }

    if (type === "explosive") {
        hp = 55 + difficulty * 8;
        radius = 15;
        speed = Math.min(85 + level, 125);
        damage = 25 + Math.floor(level);
    }

    if (type === "summoner") {
        hp = 115 + difficulty * 12;
        radius = 19;
        speed = Math.min(35 + level, 55);
        damage = 10 + Math.floor(level * 0.6);
    }

    let bossKind = null;
    if (type === "boss") {
        bossKind = ["brute", "artillery", "summoner", "charger", "plague"][bossCounter % 5];
        bossCounter++;
    }
    enemies.push({
        ...pos,
        type, bossKind, specialTimer: 2.8, telegraph: 0, dashTimer: 0,
        radius,
        health: hp,
        maxHealth: hp,
        speed,
        damage,
        attackTimer: 0,
        shield: type === "guardian" ? 100 + level * 5 : 0,
        maxShield: type === "guardian" ? 100 + level * 5 : 0,
        shieldBroken: 0,
        summonTimer: 5,
        fuse: 0
    });
}

function chooseEnemyType() {
    const r = Math.random();

    if (level < 3) return "normal";

    const pool = [
        { type: "normal", weight: 48 },
        { type: "strong", weight: 18 }
    ];

    if (level >= 5) {
        pool.push({ type: "acid", weight: 10 });
        pool.push({ type: "runner", weight: 12 });
    }

    if (level >= 7) {
        pool.push({ type: "guardian", weight: 8 });
        pool.push({ type: "explosive", weight: 8 });
    }

    if (level >= 10) {
        pool.push({ type: "tank", weight: 9 });
        pool.push({ type: "summoner", weight: 5 });
    }

    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = r * total;

    for (const item of pool) {
        roll -= item.weight;
        if (roll <= 0) return item.type;
    }

    return "normal";
}

function updateSpawning(dt) {
    spawnTimer -= dt;

    if (spawnTimer > 0) return;

    const maxEnemies = Math.min(9 + level * 3, 48);

    if (enemies.length >= maxEnemies) {
        spawnTimer = 0.3;
        return;
    }

    if (bossPending && !enemies.some(e => e.type === "boss")) {
        spawnEnemy("boss");
        bossPending = false;
        showMessage("¡EL JEFE HA LLEGADO!");
        spawnTimer = 1.2;
        return;
    }

    spawnEnemy(chooseEnemyType());

    const amount = 1 + Math.floor(level * 0.42);
    spawnTimer = Math.max(0.12, (1.35 - level * 0.055) / amount);
}
// --------------------------------------------------
// ARMAS, DISPARO Y RECARGA
// --------------------------------------------------

function nearestEnemy() {
    let nearest = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);

        if (d < minDistance) {
            minDistance = d;
            nearest = enemy;
        }
    }

    return nearest;
}

function startReload() {
    const gun = currentGun();

    if (!running || paused || gameEnded || reloading ||
        ammo >= gun.mag || reserve <= 0) return;

    reloading = true;

    let reduction = getPassiveValue("reload") / 100;
    if (characterId === "engineer") reduction += 0.2;

    reloadTimer = gun.reload * (1 - reduction);

    showMessage("RECARGANDO...");
}

function finishReload() {
    const gun = currentGun();
    const amount = Math.min(gun.mag - ammo, reserve);

    ammo += amount;
    reserve -= amount;
    reloading = false;

    updateHUD();
}

function shoot() {
    if (!running || paused || gameEnded || shootTimer > 0 || reloading) return;

    if (ammo <= 0) {
        if (reserve > 0) startReload();
        else {
            fireHeld = false;
            showMessage("¡SIN MUNICIÓN!");
        }
        return;
    }

    const target = nearestEnemy();
    if (!target && !mouseAim.active) return;
    const gun = currentGun();
    const baseAngle = mouseAim.active ? Math.atan2(mouseAim.y-player.y,mouseAim.x-player.x) : Math.atan2(target.y-player.y,target.x-player.x);

    player.angle = baseAngle;

    let multiplier = 1 + getPassiveValue("damage") / 100;

    if (passiveInventory.glass) {
        multiplier *= 1 + getPassiveValue("glass") / 100;
    }

    if (passiveInventory.berserker &&
        player.health / player.maxHealth < 0.35) {
        multiplier *= 1 + getPassiveValue("berserker") / 100;
    }

    if (temporaryPower === "fury") multiplier *= 2;

    for (let i = 0; i < gun.pellets; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * gun.spread;

        let damage = gun.damage * multiplier;

        if (Math.random() < getPassiveValue("critical") / 100) {
            damage *= 2;
        }

        bullets.push({
            x: player.x + Math.cos(angle) * 18,
            y: player.y + Math.sin(angle) * 18,
            vx: Math.cos(angle) * gun.speed,
            vy: Math.sin(angle) * gun.speed,
            life: gun.pellets > 1 ? 0.65 : 1.5,
            damage,
            radius: currentWeapon === "flamethrower" ? 7 : 3,
            pierce: !!gun.pierce,
            flame: currentWeapon === "flamethrower",
            hitIds: []
        });
    }

    ammo--;
    shootTimer = gun.fireRate;

    updateHUD();

    if (ammo <= 0 && reserve > 0) startReload();
    else if (ammo <= 0) {
        fireHeld = false;
        showMessage("¡SIN MUNICIÓN!");
    }
}

// --------------------------------------------------
// COFRES DE ARMAS
// --------------------------------------------------

function chooseWeapon() {
    const options = Object.keys(weapons).filter(k => k !== currentWeapon);
    return options[Math.floor(Math.random() * options.length)];
}

function spawnChest() {
    const pos = safePositionAroundPlayer(130, 260, 17);

    chests.push({
        x: pos.x,
        y: pos.y,
        radius: 17,
        opened: false
    });
}

function openChest(chest) {
    if (chest.opened || paused || gameEnded) return;

    chest.opened = true;
    pendingWeapon = chooseWeapon();

    paused = true;
    fireHeld = false;

    $("newWeaponName").textContent = weapons[pendingWeapon].name;
    $("newWeaponStats").textContent =
        `Daño: ${weapons[pendingWeapon].damage} · Cargador: ${weapons[pendingWeapon].mag}`;
    $("newWeaponDescription").textContent = weapons[pendingWeapon].description;
    $("chestDescription").textContent =
        `Tu arma actual: ${currentGun().name}. ¿Quieres cambiarla?`;

    $("chestScreen").classList.remove("hidden");
}

function closeChest(changeWeapon) {
    if (changeWeapon && pendingWeapon) {
        currentWeapon = pendingWeapon;
        ammo = currentGun().mag;

        reserve = Math.min(
            currentGun().reserveMax,
            Math.max(reserve, currentGun().mag * 2)
        );

        reloading = false;
        reloadTimer = 0;

        updateHUD();
        showMessage(`ARMA EQUIPADA: ${currentGun().name}`);
    }

    pendingWeapon = null;
    $("chestScreen").classList.add("hidden");
    paused = false;
}

// --------------------------------------------------
// SISTEMA DE PODERES Y RAREZAS
// --------------------------------------------------

function getPassiveValue(id) {
    const item = passiveInventory[id];
    if (!item) return 0;

    return powers[id].values[Math.min(item.stars, 3) - 1] || 0;
}

function getPowerStars(id) {
    return passiveInventory[id]?.stars ||
           activeInventory[id]?.stars || 0;
}

function randomRarity() {
    const total = Object.values(rarity).reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;

    for (const key of Object.keys(rarity)) {
        roll -= rarity[key].weight;
        if (roll <= 0) return key;
    }

    return "common";
}

function getPowerOptions() {
    const available = Object.keys(powers);
    const options = [];

    while (options.length < 3 && available.length) {
        const index = Math.floor(Math.random() * available.length);
        const id = available.splice(index, 1)[0];
        const power = powers[id];

        const inventory = power.type === "passive"
            ? passiveInventory
            : activeInventory;

        const current = inventory[id]?.stars || 0;

        if (current >= 3) continue;

        options.push({
            id,
            rarity: power.rarity,
            upgrade: current > 0
        });
    }

    if (!options.length) {
        options.push({
            id: "damage",
            rarity: "legendary",
            upgrade: true
        });
    }

    return options;
}

function spawnPowerChest() {
    if (powerChests.length > 0) return;

    const pos = safePositionAroundPlayer(220, 340, 18);

    powerChests.push({
        x: pos.x,
        y: pos.y,
        radius: 18,
        life: 35
    });

    showMessage("¡SEÑAL DE SUMINISTROS ESPECIALES!");
}

function collectPowerChest() {
    if (powerChoiceOpen) return;

    powerChests = [];
    powerChoiceOpen = true;
    paused = true;
    fireHeld = false;

    const container = $("powerChoices");
    container.innerHTML = "";

    const options = getPowerOptions();

    for (const option of options) {
        const power = powers[option.id];
        const inventory = power.type === "passive"
            ? passiveInventory
            : activeInventory;

        const stars = inventory[option.id]?.stars || 0;
        const nextStar = Math.min(3, stars + 1);
        const rarityInfo = rarity[option.rarity];

        const card = document.createElement("button");
        card.className = "power-choice rarity-" + option.rarity;

        const effect = power.type === "passive"
            ? power.values[nextStar - 1] + " " + power.suffix
            : power.description;

        card.innerHTML = `
            <strong>${power.name} · ${rarityInfo.name}</strong>
            <span>${power.description}</span>
            <span>${stars ? "Mejorar a " : "Obtener "} ${"★".repeat(nextStar)}${"☆".repeat(3 - nextStar)}</span>
            <span>${effect}</span>
        `;

        card.addEventListener("click", () => choosePower(option.id));
        container.appendChild(card);
    }

    $("powerChoiceScreen").classList.remove("hidden");
}

function choosePower(id) {
    const power = powers[id];
    const inventory = power.type === "passive"
        ? passiveInventory
        : activeInventory;

    if (!inventory[id]) {
        inventory[id] = { stars: 1, cooldown: 0 };
    } else {
        inventory[id].stars = Math.min(3, inventory[id].stars + 1);
    }

    if (power.type === "active" &&
        !equippedActives.includes(id)) {
        if (!equippedActives[0]) equippedActives[0] = id;
        else if (!equippedActives[1]) equippedActives[1] = id;
    }

    $("powerChoiceScreen").classList.add("hidden");
    powerChoiceOpen = false;
    paused = false;

    showMessage(`${power.name}: ${"★".repeat(inventory[id].stars)}`);
    updatePowerHUD();
}

function updatePowerHUD() {
    for (let i = 0; i < 2; i++) {
        const id = equippedActives[i];
        const btn = $("activeBtn" + (i + 1));

        if (!id || !activeInventory[id]) {
            btn.disabled = true;
            btn.textContent = i + 1;
            continue;
        }

        const cd = powerCooldowns[id] || 0;
        btn.disabled = cd > 0;
        btn.textContent = cd > 0 ? Math.ceil(cd) : powers[id].name.slice(0, 5);
    }

    const count = Object.keys(passiveInventory).length;
    const activeCount = Object.keys(activeInventory).length;

    $("powerStatus").textContent =
        `${count} PASIVOS · ${activeCount} ACTIVOS`;
}

// --------------------------------------------------
// INVENTARIO
// --------------------------------------------------

function renderInventory() {
    const list = $("inventoryList");
    list.innerHTML = "";

    const inventory = inventoryTab === "passive"
        ? passiveInventory
        : activeInventory;

    $("passiveTab").classList.toggle("selected", inventoryTab === "passive");
    $("activeTab").classList.toggle("selected", inventoryTab === "active");

    const ids = Object.keys(inventory);

    $("inventorySummary").textContent =
        inventoryTab === "passive"
            ? `${ids.length} poderes pasivos · Todos permanecen activos`
            : `${ids.length} poderes activos · Dos espacios de acceso rápido`;

    if (!ids.length) {
        list.innerHTML = "<p>Aún no has encontrado poderes de esta categoría.</p>";
        return;
    }

    for (const id of ids) {
        const power = powers[id];
        const item = inventory[id];
        const stars = item.stars;
        const rarityInfo = rarity[power.rarity];

        const card = document.createElement("div");
        card.className = `power-card rarity-${power.rarity}`;

        const equipped = equippedActives.includes(id);
        const button = power.type === "active"
            ? `<button data-equip="${id}">${equipped ? "DESEQUIPAR" : "EQUIPAR"}</button>`
            : "";

        card.innerHTML = `
            <h3>${power.name} · ${rarityInfo.name}</h3>
            <p>${power.description}</p>
            <p>MEJORA: ${"★".repeat(stars)}${"☆".repeat(3 - stars)}</p>
            ${power.type === "passive"
                ? `<p>Valor: ${power.values[stars - 1]} ${power.suffix}</p>`
                : `<p>Recarga: ${power.cooldown}s</p>`}
            ${button}
        `;

        list.appendChild(card);
    }

    list.querySelectorAll("[data-equip]").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleEquip(btn.dataset.equip);
        });
    });
}

function toggleEquip(id) {
    const index = equippedActives.indexOf(id);

    if (index >= 0) {
        equippedActives[index] = null;
    } else {
        const empty = equippedActives.indexOf(null);

        if (empty < 0) {
            showMessage("PRIMERO DESEQUIPA UN PODER");
            return;
        }

        equippedActives[empty] = id;
    }

    renderInventory();
    updatePowerHUD();
}

function openInventory(fromPause = false) {
    if (!running || gameEnded) return;

    returnToPause = fromPause;
    paused = true;
    fireHeld = false;

    inventoryTab = "passive";
    renderInventory();

    $("pauseScreen").classList.add("hidden");
    $("inventoryScreen").classList.remove("hidden");
}

function closeInventory() {
    $("inventoryScreen").classList.add("hidden");

    if (returnToPause) {
        $("pauseScreen").classList.remove("hidden");
        paused = true;
    } else {
        paused = false;
    }
}

// --------------------------------------------------
// ACTIVACIÓN DE PODERES
// --------------------------------------------------

function activatePowerSlot(slot) {
    if (!running || paused || gameEnded) return;

    const id = equippedActives[slot];
    if (!id || !activeInventory[id]) return;

    if ((powerCooldowns[id] || 0) > 0) return;

    const stars = activeInventory[id].stars;
    const cooldownMultiplier = 1 - (stars - 1) * 0.12;

    powerCooldowns[id] = powers[id].cooldown * cooldownMultiplier;

    if (id === "explosion") {
        const radius = 280 + stars * 45;

        for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < radius) {
                e.health -= e.type === "boss" ? 150 + stars * 40 : 180 + stars * 50;
                createParticles(e.x, e.y, 8);
            }
        }

        enemies = enemies.filter(e => e.health > 0);
        createExplosion(player.x, player.y, radius);
        showMessage("¡EXPLOSIÓN!");
    }

    if (id === "heal") {
        const amount = 25 + stars * 15;

        player.health = Math.min(
            player.maxHealth,
            player.health + amount
        );

        showMessage(`+${amount} VIDA`);
        updateHUD();
    }

    if (id === "freeze") {
        freezeTimer = 3 + stars * 1.5;
        showMessage("¡ENEMIGOS CONGELADOS!");
    }

    if (id === "fury") {
        temporaryPower = "fury";
        temporaryTimer = 5 + stars * 2;
        showMessage("¡FURIA ACTIVADA!");
    }

    if (id === "drone") {
        drones.push({
            x: player.x,
            y: player.y,
            life: 7 + stars * 2,
            timer: 0,
            damage: 12 + stars * 8
        });

        showMessage("¡DRON DESPLEGADO!");
    }

    if (id === "turret") {
        turrets.push({
            x: player.x,
            y: player.y,
            life: 10 + stars * 3,
            timer: 0,
            damage: 18 + stars * 10
        });

        showMessage("¡TORRETA DESPLEGADA!");
    }

    updatePowerHUD();
}

function createExplosion(x, y, radius, damage = 90, source = null) {
    const pd = Math.hypot(player.x-x, player.y-y);
    if (pd <= radius + player.radius) enemyAttackPlayer({damage: Math.max(8, damage * (1-pd/(radius*1.5)))});
    for (const target of enemies) {
        if (target === source || target.health <= 0) continue;
        const d = Math.hypot(target.x-x, target.y-y);
        if (d <= radius + target.radius) {
            target.health -= Math.max(12, damage * (1-d/(radius*1.35)));
            target.hitFlash = 0.15;
            if (target.type === "explosive" && !target.detonating) { target.detonating = true; target.fuse = Math.max(target.fuse || 0, 0.12); }
            if (target.health <= 0) enemyKilled(target);
        }
    }
    for (let i=0;i<48;i++) {
        const a=Math.random()*Math.PI*2, v=90+Math.random()*300;
        particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.7,color:i%3?"#ff9b43":"#ffe08a"});
    }
    particles.push({x,y,vx:0,vy:0,life:.55,maxLife:.55,radius,explosion:true});
}

// --------------------------------------------------
// OBJETOS Y RECOMPENSAS
// --------------------------------------------------

function dropPickup(x, y) {
    if (Math.random() > 0.28) return;

    pickups.push({
        x, y,
        type: Math.random() < 0.52 ? "ammo" : "health",
        radius: 11
    });
}

function collectPickup(p) {
    if (p.type === "ammo") {
        const gain = currentGun().mag * 2;
        const before = reserve;

        reserve = Math.min(
            currentGun().reserveMax,
            reserve + gain
        );

        showMessage(`+${reserve - before} BALAS`);
    } else {
        player.health = Math.min(
            player.maxHealth,
            player.health + (characterId === "medic" ? 40 : 30)
        );

        showMessage("+VIDA");
    }

    updateHUD();
}

function spawnAmmoChest(){if(ammoChest||ammo>0||reserve>0)return;const pos=safePositionAroundPlayer();ammoChest={...pos,radius:19,life:24};showMessage("¡SUMINISTROS DE EMERGENCIA!");}
function collectAmmoChest(){if(!ammoChest)return;const gun=currentGun();ammo=Math.ceil(gun.mag*.65);reserve=Math.max(gun.mag*2,Math.ceil(gun.reserveMax*.25));ammoChest=null;ammoChestTimer=55;reloading=false;updateHUD();showMessage("¡MUNICIÓN RECUPERADA!");}

function updatePickupsAndChests(dt) {
    pickups = pickups.filter(p => {
        if (
            Math.hypot(p.x - player.x, p.y - player.y) <
            p.radius + player.radius
        ) {
            collectPickup(p);
            return false;
        }

        return true;
    });

    for (const c of chests) {
        if (
            !c.opened &&
            Math.hypot(c.x - player.x, c.y - player.y) <
            c.radius + player.radius + 5
        ) {
            openChest(c);
            break;
        }
    }

    for (const c of powerChests) {
        c.life -= dt;

        if (
            Math.hypot(c.x - player.x, c.y - player.y) <
            c.radius + player.radius + 5
        ) {
            collectPowerChest();
            break;
        }
    }

    if(ammoChest && Math.hypot(ammoChest.x-player.x,ammoChest.y-player.y)<ammoChest.radius+player.radius+8)collectAmmoChest();
    if(ammoChest){ammoChest.life-=dt;if(ammoChest.life<=0)ammoChest=null;}
    powerChests = powerChests.filter(c => c.life > 0);
}

// --------------------------------------------------
// JUGADOR
// --------------------------------------------------

function updatePlayer(dt) {
    let mx = joy.x;
    let my = joy.y;

    if (keys.w || keys.arrowup) my--;
    if (keys.s || keys.arrowdown) my++;
    if (keys.a || keys.arrowleft) mx--;
    if (keys.d || keys.arrowright) mx++;

    const len = Math.hypot(mx, my);

    if (len > 1) {
        mx /= len;
        my /= len;
    }

    let speed = player.speed;

    speed *= 1 + getPassiveValue("speed") / 100;

    if (temporaryPower === "adrenaline") {
        speed *= 1.5;
    }

    moveWithCollision(
        player,
        mx * speed * dt,
        my * speed * dt,
        player.radius
    );

    if(mouseAim.active) player.angle=Math.atan2(mouseAim.y-player.y,mouseAim.x-player.x);
    else {const target=nearestEnemy();if(target)player.angle=Math.atan2(target.y-player.y,target.x-player.x);}

    if (getPassiveValue("regeneration") > 0) {
        player.health = Math.min(
            player.maxHealth,
            player.health + getPassiveValue("regeneration") * dt
        );
    }

    const shieldMax = getPassiveValue("shield");

    if (shieldMax > 0 && player.shield < shieldMax) {
        player.shield = Math.min(
            shieldMax,
            player.shield + dt * 2
        );
    }
}

// --------------------------------------------------
// ATAQUES ENEMIGOS
// --------------------------------------------------

function enemyAttackPlayer(e) {
    if (temporaryPower === "shield") return;
    if (damageTimer > 0) return;

    let damage = e.damage;

    if (getPassiveValue("glass") > 0) {
        damage *= 1 + getPassiveValue("glass") / 100 * 0.5;
    }

    if (player.shield > 0) {
        const absorbed = Math.min(player.shield, damage);
        player.shield -= absorbed;
        damage -= absorbed;
    }

    if (damage > 0) {
        player.health -= damage;
    }

    damageTimer = 0.5;

    createParticles(player.x, player.y, 7);
    updateHUD();

    if (player.health <= 0) endGame();
}

function updateBossBehavior(e, dt, dx, dy, dist) {
    const a=Math.atan2(dy,dx), angry=e.health/e.maxHealth<.45;
    e.specialTimer-=dt; e.attackTimer-=dt;
    if (e.bossKind === "charger") {
        if (e.telegraph>0) { e.telegraph-=dt; if(e.telegraph<=0)e.dashTimer=.55; }
        else if(e.dashTimer>0) { e.dashTimer-=dt; moveWithCollision(e,Math.cos(e.dashAngle)*430*dt,Math.sin(e.dashAngle)*430*dt,e.radius); if(Math.hypot(player.x-e.x,player.y-e.y)<e.radius+player.radius+8)enemyAttackPlayer({damage:e.damage*1.6}); }
        else { moveWithCollision(e,dx/dist*e.speed*dt,dy/dist*e.speed*dt,e.radius); if(e.specialTimer<=0&&dist<440){e.dashAngle=a;e.telegraph=.85;e.specialTimer=angry?3:4.5;showMessage("¡EL JEFE PREPARA UNA EMBESTIDA!");} }
    } else {
        const preferred=e.bossKind==="artillery"?330:220;
        if(dist>preferred+35)moveWithCollision(e,dx/dist*e.speed*.7*dt,dy/dist*e.speed*.7*dt,e.radius);
        else if(dist<preferred-45)moveWithCollision(e,-dx/dist*e.speed*.55*dt,-dy/dist*e.speed*.55*dt,e.radius);
        if(e.specialTimer<=0){
            if(e.bossKind==="artillery"){
                const n=angry?9:5; for(let i=0;i<n;i++){const q=a+(i-(n-1)/2)*.19;enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(q)*235,vy:Math.sin(q)*235,life:3,radius:7,damage:e.damage*.75});}
                showMessage("¡LLUVIA DE PROYECTILES!");
            } else if(e.bossKind==="summoner"){
                for(let i=0;i<(angry?5:3)&&enemies.length<48;i++){const q=i*Math.PI*2/3,x=e.x+Math.cos(q)*55,y=e.y+Math.sin(q)*55;if(!blocked(x,y,11))spawnEnemyAtBoss(x,y);}
                showMessage("¡EL JEFE INVOCA REFUERZOS!");
            } else if(e.bossKind==="plague"){
                acidPools.push({x:player.x,y:player.y,radius:62,life:4,damage:12});
                for(let i=0;i<6;i++){const q=i*Math.PI/3;enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(q)*155,vy:Math.sin(q)*155,life:3,radius:8,damage:e.damage*.55,acid:true});}
                showMessage("¡NUBE TÓXICA!");
            } else if(e.bossKind==="brute"){
                if(dist<190)enemyAttackPlayer({damage:e.damage*1.35});
                particles.push({x:e.x,y:e.y,vx:0,vy:0,life:.55,maxLife:.55,radius:190,explosion:true});
                showMessage("¡ONDA DE CHOQUE!");
            }
            e.specialTimer=(angry?3:4.8)+Math.random()*1.2;
        }
    }
    if(e.attackTimer<=0&&dist<70){enemyAttackPlayer(e);e.attackTimer=angry?.42:.68;}
}
function spawnEnemyAtBoss(x,y){const hp=28+level*4;enemies.push({x,y,type:"normal",radius:11,health:hp,maxHealth:hp,speed:90+level,damage:8+level*.5,attackTimer:0});}

function updateEnemies(dt) {
    if (freezeTimer > 0) {
        freezeTimer -= dt;
        return;
    }

    for (const e of enemies) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (e.type === "acid") {
            if (dist > 285) {
                moveWithCollision(
                    e,
                    dx / dist * e.speed * dt,
                    dy / dist * e.speed * dt,
                    e.radius
                );
            } else if (dist < 205) {
                moveWithCollision(
                    e,
                    -dx / dist * e.speed * dt,
                    -dy / dist * e.speed * dt,
                    e.radius
                );
            }

            e.attackTimer -= dt;

            if (e.attackTimer <= 0 && dist < 570) {
                const angle = Math.atan2(dy, dx);

                enemyBullets.push({
                    x: e.x,
                    y: e.y,
                    vx: Math.cos(angle) * 180,
                    vy: Math.sin(angle) * 180,
                    life: 3,
                    radius: 6,
                    damage: e.damage
                });

                e.attackTimer = Math.max(1.3, 2.5 - level * 0.025);
            }

            continue;
        }

        if (e.type === "summoner") {
            if (dist > 250) {
                moveWithCollision(
                    e,
                    dx / dist * e.speed * dt,
                    dy / dist * e.speed * dt,
                    e.radius
                );
            }

            e.summonTimer -= dt;

            if (e.summonTimer <= 0 && enemies.length < 26) {
                const angle = Math.random() * Math.PI * 2;

                const x = e.x + Math.cos(angle) * 55;
                const y = e.y + Math.sin(angle) * 55;

                if (!blocked(x, y, 10)) {
                    enemies.push({
                        x, y,
                        type: "normal",
                        radius: 10,
                        health: 22 + level * 4,
                        maxHealth: 22 + level * 4,
                        speed: 85 + level,
                        damage: 7 + level,
                        attackTimer: 0
                    });
                }

                e.summonTimer = Math.max(4, 7 - level * 0.08);
            }

            continue;
        }

        if (e.type === "explosive") {
            // Si otra explosión lo alcanza, detona en cadena aunque esté lejos del jugador.
            if (e.detonating) {
                e.fuse += dt;
                if (e.fuse >= 0.12) {
                    createExplosion(e.x, e.y, 115, e.damage + 65, e);
                    e.health = 0;
                    enemyKilled(e);
                }
                continue;
            }
            if (dist > e.radius + player.radius + 12) {
                moveWithCollision(
                    e,
                    dx / dist * e.speed * dt,
                    dy / dist * e.speed * dt,
                    e.radius
                );
            } else {
                e.fuse += dt;

                if (e.fuse >= 0.7) {
                    createExplosion(e.x, e.y, 115, e.damage + 65, e);
                    e.health = 0;
                    enemyKilled(e);
                }
            }

            continue;
        }

        if (e.type === "boss") { updateBossBehavior(e,dt,dx,dy,dist); continue; }

        if (dist > e.radius + player.radius) {
            moveWithCollision(
                e,
                dx / dist * e.speed * dt,
                dy / dist * e.speed * dt,
                e.radius
            );
        } else {
            e.attackTimer -= dt;

            if (e.attackTimer <= 0) {
                enemyAttackPlayer(e);
                e.attackTimer = e.type === "boss" ? 0.65 : 0.9;
            }
        }

        if (e.type === "guardian" && e.shieldBroken > 0) {
            e.shieldBroken -= dt;

            if (e.shieldBroken <= 0) {
                e.shield = e.maxShield;
            }
        }
    }

    enemies = enemies.filter(e => e.health > 0);
}

function updateEnemyBullets(dt) {
    for (const b of enemyBullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;

        if (blocked(b.x, b.y, b.radius)) {
            b.life = 0;
            continue;
        }

        if (
            Math.hypot(b.x - player.x, b.y - player.y) <
            b.radius + player.radius
        ) {
            if (temporaryPower !== "shield") {
                let damage = b.damage;

                if (player.shield > 0) {
                    const absorbed = Math.min(player.shield, damage);
                    player.shield -= absorbed;
                    damage -= absorbed;
                }

                player.health -= damage;
                damageTimer = 0.45;

                updateHUD();

                if (player.health <= 0) endGame();
            }

            acidPools.push({
                x: b.x,
                y: b.y,
                radius: 35,
                life: 4,
                damageTimer: 0
            });

            b.life = 0;
        }
    }

    enemyBullets = enemyBullets.filter(b => b.life > 0);
}

function updateAcidPools(dt) {
    for (const pool of acidPools) {
        pool.life -= dt;
        pool.damageTimer -= dt;

        const distance = Math.hypot(
            pool.x - player.x,
            pool.y - player.y
        );

        if (
            distance < pool.radius + player.radius &&
            pool.damageTimer <= 0 &&
            temporaryPower !== "shield"
        ) {
            let damage = 5;

            if (player.shield > 0) {
                const absorbed = Math.min(player.shield, damage);
                player.shield -= absorbed;
                damage -= absorbed;
            }

            player.health -= damage;
            pool.damageTimer = 0.6;

            updateHUD();

            if (player.health <= 0) endGame();
        }
    }

    acidPools = acidPools.filter(p => p.life > 0);
}

// --------------------------------------------------
// BALAS DEL JUGADOR
// --------------------------------------------------

function updateBullets(dt) {
    for (const b of bullets) {
        const steps = 3;

        for (let s = 0; s < steps && b.life > 0; s++) {
            b.x += b.vx * dt / steps;
            b.y += b.vy * dt / steps;

            if (blocked(b.x, b.y, 2)) {
                b.life = 0;
                break;
            }

            let intercepted = false;

            for (const e of enemies) {
                if (
                    e.type !== "guardian" ||
                    e.health <= 0 ||
                    e.shieldBroken > 0 ||
                    e.shield <= 0
                ) continue;

                if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 13) {
                    e.shield -= b.damage;

                    if (!b.pierce) b.life = 0;

                    intercepted = true;
                    createParticles(b.x, b.y, 5);

                    if (e.shield <= 0) {
                        e.shield = 0;
                        e.shieldBroken = 5;
                        showMessage("¡ESCUDO DEL GUARDIÁN DESTRUIDO!");
                    }

                    break;
                }
            }

            if (intercepted && !b.pierce) break;

            for (const e of enemies) {
                if (e.health <= 0 || b.life <= 0) continue;
                if (b.hitIds.includes(e)) continue;

                if (
                    Math.hypot(e.x - b.x, e.y - b.y) <
                    e.radius + (b.flame ? 13 : 4)
                ) {
                    e.health -= b.damage;

                    if (b.flame) {
                        e.burning = 2;
                        e.burnTimer = 0;
                    }

                    b.hitIds.push(e);

                    if (!b.pierce) b.life = 0;

                    createParticles(b.x, b.y, 3);

                    if (e.health <= 0) {
                        enemyKilled(e);
                    }
                }
            }

            b.life -= dt / steps;
        }
    }

    bullets = bullets.filter(b => b.life > 0);
    enemies = enemies.filter(e => e.health > 0);
}

// --------------------------------------------------
// DRONES Y TORRETAS
// --------------------------------------------------

function updateSupportDevices(dt) {
    for (const device of [...drones, ...turrets]) {
        device.life -= dt;
        device.timer -= dt;

        if (device.timer > 0) continue;

        const target = nearestEnemy();

        if (target) {
            const angle = Math.atan2(
                target.y - device.y,
                target.x - device.x
            );

            bullets.push({
                x: device.x,
                y: device.y,
                vx: Math.cos(angle) * 650,
                vy: Math.sin(angle) * 650,
                life: 1,
                damage: device.damage,
                radius: 4,
                pierce: false,
                hitIds: []
            });
        }

        device.timer = 0.55;
    }

    drones = drones.filter(d => d.life > 0);
    turrets = turrets.filter(t => t.life > 0);
}

function updatePowerTimers(dt) {
    for (const id of Object.keys(powerCooldowns)) {
        powerCooldowns[id] = Math.max(0, powerCooldowns[id] - dt);
    }

    if (temporaryTimer > 0) {
        temporaryTimer -= dt;

        if (temporaryTimer <= 0) {
            temporaryPower = null;
            showMessage("EL EFECTO HA TERMINADO");
        }
    }

    if (freezeTimer > 0) {
        freezeTimer = Math.max(0, freezeTimer);
    }

    updatePowerHUD();
}

// --------------------------------------------------
// ELIMINACIONES
// --------------------------------------------------

function enemyKilled(e) {
    if (e.counted) return;
    e.counted = true;

    kills++;
    playerMoney += e.type === "boss" ? 90 : e.type === "tank" ? 12 : 5;
    localStorage.setItem("ultimoTurnoMoney",String(playerMoney));
    updateShopHUD();

    score +=
        e.type === "boss" ? 250 :
        e.type === "tank" ? 70 :
        e.type === "guardian" ? 50 :
        e.type === "summoner" ? 65 :
        e.type === "acid" ? 40 :
        e.type === "strong" ? 25 : 10;

    dropPickup(e.x, e.y);

    const vampirism = getPassiveValue("vampirism");

    if (vampirism > 0) {
        player.health = Math.min(
            player.maxHealth,
            player.health + vampirism
        );
    }

    if (e.type === "boss") {
        showMessage("¡JEFE ELIMINADO!");

        for (let i = 0; i < 3; i++) {
            pickups.push({
                x: e.x + (i - 1) * 22,
                y: e.y + 15,
                type: i === 1 ? "health" : "ammo",
                radius: 11
            });
        }
    }

    createParticles(e.x, e.y, 12);

    const newLevel = Math.floor(kills / 10) + 1;

    if (newLevel > level) {
        level = newLevel;
        raiseThreat();
    }

    if (kills > 0 && kills % 12 === 0) {
        spawnChest();
        showMessage("¡COFRE DE ARMAS ENCONTRADO!");
    }

    updateHUD();
    updateLevelHUD();
}

// --------------------------------------------------
// PARTÍCULAS
// --------------------------------------------------

function createParticles(x, y, amount = 5) {
    if (particles.length > 180) return;

    for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 100;

        particles.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: 0.35,
            color: "#d9c5a0"
        });
    }
}

// --------------------------------------------------
// ACTUALIZACIÓN GENERAL
// --------------------------------------------------

function update(dt) {
    if (!running || paused || gameEnded) return;

    worldTime += dt;

    updateSpawning(dt);
    updatePlayer(dt);
    updateEnemies(dt);

    if (gameEnded) return;

    updateBullets(dt);
    updateEnemyBullets(dt);
    updateAcidPools(dt);
    updateSupportDevices(dt);

    if (gameEnded) return;

    updatePickupsAndChests(dt);
    updatePowerTimers(dt);
    if(ammoChestTimer>0)ammoChestTimer-=dt;
    if(ammo<=0&&reserve<=0&&!reloading&&!ammoChest&&ammoChestTimer<=0)spawnAmmoChest();

    if (powerChests.length === 0) {
        powerChestTimer -= dt;

        if (powerChestTimer <= 0) {
            spawnPowerChest();
            powerChestTimer = 65 + Math.random() * 45;
        }
    }

    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
    });

    particles = particles.filter(p => p.life > 0);

    for (const e of enemies) {
        if (e.burning > 0) {
            e.burning -= dt;
            e.burnTimer -= dt;

            if (e.burnTimer <= 0) {
                e.health -= 4;
                e.burnTimer = 0.5;

                if (e.health <= 0) enemyKilled(e);
            }
        }
    }

    enemies = enemies.filter(e => e.health > 0);

    shootTimer = Math.max(0, shootTimer - dt);
    damageTimer = Math.max(0, damageTimer - dt);

    if (reloading) {
        reloadTimer -= dt;

        if (reloadTimer <= 0) finishReload();
    }

    if (fireHeld && !reloading) shoot();
}

// --------------------------------------------------
// DIBUJO DEL ESCENARIO
// --------------------------------------------------

function drawBackground() {
    const scenario = scenarios[scenarioIndex];

    const left = camera.x - W / 2;
    const top = camera.y - H / 2;
    const grid = 60;

    const startX = Math.floor(left / grid) * grid;
    const startY = Math.floor(top / grid) * grid;

    ctx.strokeStyle = scenario.grid;
    ctx.lineWidth = 1;

    for (let x = startX; x < left + W + grid; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + H);
        ctx.stroke();
    }

    for (let y = startY; y < top + H + grid; y += grid) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + W, y);
        ctx.stroke();
    }

    const obstacles = nearbyObstacles(camera.x, camera.y, 2);

    for (const o of obstacles) {
        if (
            o.x + o.w < left ||
            o.x > left + W ||
            o.y + o.h < top ||
            o.y > top + H
        ) continue;

        if (o.kind === "crate") {
            ctx.fillStyle = scenario.crate;
            ctx.fillRect(o.x, o.y, o.w, o.h);

            ctx.strokeStyle = "#b9a47b";
            ctx.lineWidth = 2;
            ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);

            ctx.beginPath();
            ctx.moveTo(o.x + 5, o.y + 5);
            ctx.lineTo(o.x + o.w - 5, o.y + o.h - 5);
            ctx.moveTo(o.x + o.w - 5, o.y + 5);
            ctx.lineTo(o.x + 5, o.y + o.h - 5);
            ctx.stroke();
        } else {
            ctx.fillStyle = scenario.rock;

            ctx.beginPath();
            ctx.ellipse(
                o.x + o.w / 2,
                o.y + o.h / 2,
                o.w / 2,
                o.h / 2,
                0,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.strokeStyle = "#89978c";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// --------------------------------------------------
// DIBUJO DEL JUGADOR
// --------------------------------------------------

function drawHealthBar(x, y, width, height, hp, maxHp, color) {
    ctx.fillStyle = "#111d";
    ctx.fillRect(x - width / 2, y, width, height);

    ctx.fillStyle = color;
    ctx.fillRect(
        x - width / 2,
        y,
        width * clamp(hp / maxHp, 0, 1),
        height
    );
}

function drawPlayer() {
    ctx.save();

    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    ctx.fillStyle = player.color;

    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#333";
    ctx.fillRect(4, -4, 22, 8);

    ctx.restore();

    drawHealthBar(
        player.x,
        player.y - 25,
        34,
        4,
        player.health,
        player.maxHealth,
        "#54d879"
    );

    if (damageTimer > 0) {
        ctx.strokeStyle = "#ff5555";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(player.x, player.y, 21, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (temporaryPower === "shield" || player.shield > 0) {
        ctx.strokeStyle = "#6fdfff";
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.arc(player.x, player.y, 25, 0, Math.PI * 2);
        ctx.stroke();
    }
}
// --------------------------------------------------
// DIBUJO DE ENEMIGOS
// --------------------------------------------------

function drawEnemies() {
    for (const e of enemies) {
        let color = "#718f69";

        if (e.type === "strong") color = "#a34d32";
        if (e.type === "boss") color = ({brute:"#8d2638",artillery:"#8a4d28",summoner:"#713a91",charger:"#a33d27",plague:"#647b2b"}[e.bossKind]||"#742b35");
        if (e.type === "acid") color = "#9fc43c";
        if (e.type === "guardian") color = "#527da8";
        if (e.type === "runner") color = "#d3c15b";
        if (e.type === "tank") color = "#575b63";
        if (e.type === "explosive") color = "#bd6a36";
        if (e.type === "summoner") color = "#9b63bb";

        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e9e5c8";

        ctx.beginPath();
        ctx.arc(e.x - 4, e.y - 3, 2, 0, Math.PI * 2);
        ctx.arc(e.x + 4, e.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();

        const bw =
            e.type === "boss" ? 68 :
            e.type === "guardian" || e.type === "tank" ? 48 :
            e.type === "strong" || e.type === "summoner" ? 42 : 30;

        drawHealthBar(
            e.x,
            e.y - e.radius - 10,
            bw,
            e.type === "boss" ? 7 : 4,
            e.health,
            e.maxHealth,
            e.type === "boss" ? "#ff5353" : "#54d879"
        );

        if (e.type === "guardian" && e.shield > 0 && e.shieldBroken <= 0) {
            ctx.strokeStyle = "#55baff";
            ctx.lineWidth = 4;

            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius + 13, 0, Math.PI * 2);
            ctx.stroke();

            drawHealthBar(
                e.x,
                e.y - e.radius - 17,
                40,
                3,
                e.shield,
                e.maxShield,
                "#4acbff"
            );
        }

        if (e.type === "acid") {
            ctx.fillStyle = "#d8ff68";
            ctx.beginPath();
            ctx.arc(e.x, e.y - 9, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        if (e.type === "explosive") {
            ctx.strokeStyle = "#ffb04a";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (e.type === "boss") {
            if(e.telegraph>0){ctx.strokeStyle="#ffcf58";ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,e.radius+13+Math.sin(worldTime*18)*4,0,Math.PI*2);ctx.stroke();}
            ctx.fillStyle = "#ff7777";
            ctx.font = "bold 11px Arial";
            ctx.textAlign = "center";
            ctx.fillText(({brute:"DESTRUCTOR",artillery:"ARTILLERO",summoner:"INVOCADOR",charger:"EMBESTIDOR",plague:"INFESTADO"}[e.bossKind]||"JEFE"), e.x, e.y - e.radius - 17);
        }

        if (e.burning > 0) {
            ctx.fillStyle = "#ff8b32";
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// --------------------------------------------------
// DIBUJO DE BALAS Y OBJETOS
// --------------------------------------------------

function drawBullets() {
    for (const b of bullets) {
        ctx.fillStyle = b.flame ? "#ff7834" : "#ffe17b";

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.flame ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const b of enemyBullets) {
        ctx.fillStyle = "#a8e43c";

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPickups() {
    for (const p of pickups) {
        ctx.fillStyle = p.type === "ammo" ? "#e5bc45" : "#4cdb76";

        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#17221d";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.type === "ammo" ? "A" : "+", p.x, p.y + 4);
    }

    for (const c of chests) {
        if (c.opened) continue;

        ctx.fillStyle = "#9c7131";
        ctx.fillRect(c.x - 13, c.y - 10, 26, 21);

        ctx.fillStyle = "#e6c76b";
        ctx.fillRect(c.x - 13, c.y - 10, 26, 6);

        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(c.x - 2, c.y - 3, 4, 7);

        ctx.strokeStyle = "#f7d77b";
        ctx.strokeRect(c.x - 13, c.y - 10, 26, 21);
    }

    for (const c of powerChests) {
        ctx.save();
        ctx.shadowColor = "#b65cff";
        ctx.shadowBlur = 20;

        ctx.fillStyle = "#542b85";
        ctx.fillRect(c.x - 15, c.y - 12, 30, 24);

        ctx.fillStyle = "#c58aff";
        ctx.fillRect(c.x - 15, c.y - 12, 30, 7);

        ctx.strokeStyle = "#e1baff";
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x - 15, c.y - 12, 30, 24);

        ctx.restore();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillText("⚡", c.x, c.y + 5);
    }
    if(ammoChest){ctx.save();ctx.translate(ammoChest.x,ammoChest.y);ctx.scale(1+Math.sin(worldTime*6)*.1,1+Math.sin(worldTime*6)*.1);ctx.shadowColor="#68dfff";ctx.shadowBlur=22;ctx.fillStyle="#245b70";ctx.fillRect(-17,-13,34,26);ctx.fillStyle="#83e8ff";ctx.fillRect(-17,-13,34,7);ctx.strokeStyle="#c6f6ff";ctx.strokeRect(-17,-13,34,26);ctx.restore();ctx.fillStyle="#d9f8ff";ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.fillText("MUNICIÓN",ammoChest.x,ammoChest.y-23);}
}

function drawAcidPools() {
    for (const pool of acidPools) {
        ctx.globalAlpha = Math.min(1, pool.life / 1.5);
        ctx.fillStyle = "#a0d72e";

        ctx.beginPath();
        ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#d5ff63";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawSupportDevices() {
    for (const d of drones) {
        ctx.fillStyle = "#67d6ef";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const t of turrets) {
        ctx.fillStyle = "#d6a64f";
        ctx.fillRect(t.x - 9, t.y - 9, 18, 18);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / 0.7);
        ctx.fillStyle = p.color || "#d9c5a0";

        if (p.explosion) {
            ctx.strokeStyle = "#ff9b43";
            ctx.lineWidth = 5;

            // Evitar radios negativos
            const radius = Math.max(
                0,
                p.radius * (1 - p.life / 0.5)
            );

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

        } else {
            ctx.fillRect(p.x, p.y, 3, 3);
        }
    }

    ctx.globalAlpha = 1;
}

// --------------------------------------------------
// DIBUJO GENERAL
// --------------------------------------------------

function draw() {
    if (!player) return;

    camera.x = player.x;
    camera.y = player.y;

    ctx.fillStyle = scenarios[scenarioIndex].background;
    ctx.fillRect(0, 0, W, H);

    ctx.save();

    ctx.translate(
        W / 2 - camera.x,
        H / 2 - camera.y
    );

    drawBackground();
    drawAcidPools();
    drawPickups();
    drawBullets();
    drawEnemies();
    drawSupportDevices();
    drawParticles();
    drawPlayer();

    ctx.restore();
}

// --------------------------------------------------
// HUD
// --------------------------------------------------

function updateHUD() {
    $("healthFill").style.width =
        `${clamp(player.health / player.maxHealth * 100, 0, 100)}%`;

    $("ammo").textContent = ammo;
    $("reserve").textContent = `/ ${reserve}`;
    $("kills").textContent = kills;
    $("weaponName").textContent = currentGun().name;
}

function showMessage(text) {
    $("message").textContent = text;

    clearTimeout(messageTimeout);

    messageTimeout = setTimeout(() => {
        $("message").textContent = "";
    }, 1800);
}

// --------------------------------------------------
// FIN DE PARTIDA
// --------------------------------------------------

function endGame() {
    if (gameEnded) return;

    gameEnded = true;
    running = false;
    fireHeld = false;

    if (kills > best) {
        best = kills;
        localStorage.setItem("ultimoTurnoBest", best);
    }

    $("best").textContent = best;
    $("finalWave").textContent = level;
    $("finalKills").textContent = kills;

    $("gameOver").classList.remove("hidden");
}

// --------------------------------------------------
// INICIO Y REINICIO
// --------------------------------------------------

function startGame() {
    enemies = [];
    bullets = [];
    enemyBullets = [];
    acidPools = [];
    particles = [];
    pickups = [];
    chests = [];
    powerChests = [];
    ammoChest = null; ammoChestTimer = 0; bossCounter = 0;

    drones = [];
    turrets = [];

    passiveInventory = {};
    activeInventory = {};
    equippedActives = [null, null];
    powerCooldowns = {};

    player = null;

    level = 1;
    kills = 0;
    score = 0;

    ammo = 12;
    reserve = 48;

    bossPending = false;
    spawnTimer = 0.5;

    reloading = false;
    reloadTimer = 0;

    fireHeld = false;
    paused = false;
    gameEnded = false;

    shootTimer = 0;
    damageTimer = 0;

    worldTime = 0;
    powerChestTimer = 65 + Math.random() * 30;

    temporaryPower = null;
    temporaryTimer = 0;
    freezeTimer = 0;

    currentWeapon = "pistol";
    pendingWeapon = null;

    scenarioIndex = 0;
    scenarioName = "";

    powerChoiceOpen = false;
    returnToPause = false;

    joy.x = 0;
    joy.y = 0;
    keys = {};

    stick.style.transform = "translate(0, 0)";

    characterId = localStorage.getItem("ultimoTurnoCharacter") || "soldier";
    if(!unlockedCharacters.includes(characterId))characterId="soldier";
    skinId = "green"; mouseAim.active=false;

    player = createPlayer();

    camera.x = 0;
    camera.y = 0;

    updateScenario();

    $("menu").classList.add("hidden");
    $("gameOver").classList.add("hidden");
    $("pauseScreen").classList.add("hidden");
    $("inventoryScreen").classList.add("hidden");
    $("chestScreen").classList.add("hidden");
    $("powerChoiceScreen").classList.add("hidden");

    $("pauseBtn").textContent = "Ⅱ";

    updateHUD();
    updateLevelHUD();
    updatePowerHUD();

    running = true;
}

// TIENDA DE PERSONAJES DESBLOQUEABLES
function updateShopHUD(){["shopMoney","shopMoneyShop"].forEach(id=>{const el=$(id);if(el)el.textContent=`$${playerMoney}`;});}
function renderCharacterShop(){const list=$("characterShopList");if(!list)return;list.innerHTML="";Object.entries(characters).forEach(([id,c])=>{const unlocked=unlockedCharacters.includes(id),selected=characterId===id;const card=document.createElement("div");card.className="power-card";card.innerHTML=`<h3>${c.name}${selected?" ✓":""}</h3><p>${c.description}</p><p>Vida: ${c.health} · Velocidad: ${c.speed}</p><button type="button">${unlocked?(selected?"EQUIPADO":"ELEGIR"):`DESBLOQUEAR · $${c.cost}`}</button>`;const b=card.querySelector("button");b.disabled=selected||(!unlocked&&playerMoney<c.cost);b.addEventListener("click",()=>{if(!unlockedCharacters.includes(id)){if(playerMoney<c.cost)return;playerMoney-=c.cost;unlockedCharacters.push(id);localStorage.setItem("ultimoTurnoUnlocked",JSON.stringify(unlockedCharacters));localStorage.setItem("ultimoTurnoMoney",String(playerMoney));}characterId=id;localStorage.setItem("ultimoTurnoCharacter",id);renderCharacterShop();updateShopHUD();});list.appendChild(card);});updateShopHUD();}
$("openShopBtn")?.addEventListener("click",()=>{renderCharacterShop();$("shopScreen").classList.remove("hidden");});
$("closeShopBtn")?.addEventListener("click",()=>$("shopScreen").classList.add("hidden"));
updateShopHUD();

// --------------------------------------------------
// BOTONES PRINCIPALES
// --------------------------------------------------

$("startBtn").addEventListener("click", startGame);
$("againBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);

$("pauseBtn").addEventListener("click", () => {
    if (
        !running ||
        gameEnded ||
        !$("chestScreen").classList.contains("hidden") ||
        !$("powerChoiceScreen").classList.contains("hidden") ||
        !$("inventoryScreen").classList.contains("hidden")
    ) return;

    paused = !paused;

    $("pauseScreen").classList.toggle("hidden", !paused);
    $("pauseBtn").textContent = paused ? "▶" : "Ⅱ";

    fireHeld = false;
});

$("resumeBtn").addEventListener("click", () => {
    paused = false;
    $("pauseScreen").classList.add("hidden");
    $("pauseBtn").textContent = "Ⅱ";
});

$("takeWeaponBtn").addEventListener("click", () => closeChest(true));
$("keepWeaponBtn").addEventListener("click", () => closeChest(false));

$("inventoryBtn").addEventListener("click", () => openInventory(false));
$("openInventoryPause").addEventListener("click", () => openInventory(true));
$("closeInventory").addEventListener("click", closeInventory);

$("passiveTab").addEventListener("click", () => {
    inventoryTab = "passive";
    renderInventory();
});

$("activeTab").addEventListener("click", () => {
    inventoryTab = "active";
    renderInventory();
});

$("activeBtn1").addEventListener("click", () => activatePowerSlot(0));
$("activeBtn2").addEventListener("click", () => activatePowerSlot(1));

// --------------------------------------------------
// JOYSTICK
// --------------------------------------------------

const joystick = $("joystick");
const stick = $("stick");

let joystickPointer = null;

function moveJoystick(e) {
    const rect = joystick.getBoundingClientRect();

    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);

    const max = 35;
    const distance = Math.hypot(dx, dy);

    if (distance > max) {
        dx = dx / distance * max;
        dy = dy / distance * max;
    }

    joy.x = dx / max;
    joy.y = dy / max;

    stick.style.transform = `translate(${dx}px, ${dy}px)`;
}

joystick.addEventListener("pointerdown", e => {
    e.preventDefault();

    joystickPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);

    moveJoystick(e);
});

joystick.addEventListener("pointermove", e => {
    if (e.pointerId === joystickPointer) moveJoystick(e);
});

function stopJoystick(e) {
    if (e.pointerId !== joystickPointer) return;

    joystickPointer = null;
    joy.x = 0;
    joy.y = 0;

    stick.style.transform = "translate(0, 0)";
}

joystick.addEventListener("pointerup", stopJoystick);
joystick.addEventListener("pointercancel", stopJoystick);

// --------------------------------------------------
// DISPARO TÁCTIL
// --------------------------------------------------

const fireBtn = $("fireBtn");

fireBtn.addEventListener("pointerdown", e => {
    e.preventDefault();

    fireHeld = true;
    fireBtn.setPointerCapture(e.pointerId);

    shoot();
});

function stopFire() {
    fireHeld = false;
}

fireBtn.addEventListener("pointerup", stopFire);
fireBtn.addEventListener("pointercancel", stopFire);
fireBtn.addEventListener("lostpointercapture", stopFire);

// APUNTADO CON MOUSE PARA PC
canvas.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"&&player){const r=canvas.getBoundingClientRect();mouseAim.x=player.x+(e.clientX-r.left-W/2);mouseAim.y=player.y+(e.clientY-r.top-H/2);mouseAim.active=true;}});
canvas.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse")mouseAim.active=false;});
canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button===0){e.preventDefault();fireHeld=true;shoot();}});
window.addEventListener("pointerup",e=>{if(e.pointerType==="mouse")fireHeld=false;});

// --------------------------------------------------
// TECLADO
// --------------------------------------------------

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    keys[key] = true;

    if (key === "r" && !e.repeat) startReload();

    if (key === " " && !e.repeat) {
        e.preventDefault();
        fireHeld = true;
        shoot();
    }

    if (key === "1" && !e.repeat) activatePowerSlot(0);
    if (key === "2" && !e.repeat) activatePowerSlot(1);

    if (key === "i" && !e.repeat) {
        if (!paused) openInventory(false);
    }

    if (key === "escape" && !e.repeat && running && !gameEnded) {
        if (!$("inventoryScreen").classList.contains("hidden")) {
            closeInventory();
        } else {
            $("pauseBtn").click();
        }
    }
});

window.addEventListener("keyup", e => {
    const key = e.key.toLowerCase();

    keys[key] = false;

    if (key === " ") fireHeld = false;
});

window.addEventListener("blur", () => {
    fireHeld = false;
    keys = {};

    joy.x = 0;
    joy.y = 0;

    stick.style.transform = "translate(0, 0)";
});

// --------------------------------------------------
// BUCLE PRINCIPAL
// --------------------------------------------------

function loop(timestamp) {
    const dt = Math.min(
        (timestamp - lastTime) / 1000 || 0,
        0.04
    );

    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop)

$("mainMenuBtn").addEventListener("click", () => {
    $("gameOver").classList.add("hidden");
    $("menu").classList.remove("hidden");

    running = false;
    paused = false;
});