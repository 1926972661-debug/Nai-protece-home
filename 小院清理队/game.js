const canvas = wx.createCanvas();
const context = canvas.getContext('2d');
const system = wx.getSystemInfoSync();
const background = wx.createImage();
const characterSprite = wx.createImage();
const stickSprite = wx.createImage();
const speedCloudSprite = wx.createImage();
const enemySprite = wx.createImage();
const dropSprite = wx.createImage();
const bossSprite = wx.createImage();
const rabbitSprite = wx.createImage();
const apeSprite = wx.createImage();
const stalkerSprite = wx.createImage();
const bruteSprite = wx.createImage();
const runnerSprite = wx.createImage();
const eliteSprite = wx.createImage();

let screen = 'menu';
let width = system.screenWidth;
let height = system.screenHeight;
let pixelRatio = system.pixelRatio || 1;
let backgroundReady = false;
let characterReady = false;
let stickReady = false;
let speedCloudReady = false;
let enemyReady = false;
let dropReady = false;
let bossReady = false;
let rabbitReady = false;
let apeReady = false;
let stalkerReady = false;
let bruteReady = false;
let runnerReady = false;
let eliteReady = false;
let menuButton = null;
let wardrobeButton = null;
let gardenButton = null;
let enemyCodexButton = null;
let settleButton = null;
let codexButton = null;
let characterButtons = [];
let game = null;
let joystickTouchId = null;
let joystickOrigin = null;
let loopRunning = false;
let lastFrameTime = 0;
const profileStorageKey = 'yard-cleaner-profile-v1';
const characters = [
  { id: 'supreme', name: '至尊奶', style: '旋转棍', description: '环绕近战' },
  { id: 'rabbit', name: '瘦嘟嘟', style: '追踪枪', description: '自动追踪射击' },
];
const appearances = [
  { id: 'base', name: '小院新手', price: 0 },
  { id: 'flower', name: '春日花冠', price: 35 },
  { id: 'leaf', name: '金叶发箍', price: 75 },
];
const gardenProjects = [
  { id: 'flower', name: '花圃', description: '每 3 级多掉 1 粒种子', short: '种子+', buff: (level) => 1 + Math.floor(level / 3) },
  { id: 'tree', name: '果树', description: '开局生命上限 +8/级', short: '生命+', buff: (level) => level * 8 },
  { id: 'pond', name: '池塘', description: '经验吸取范围 +10/级', short: '吸取+', buff: (level) => level * 10 },
  { id: 'fence', name: '木栅栏', description: '每次碰撞减伤 +0.3/级', short: '减伤+', buff: (level) => level * 0.3 },
  { id: 'windmill', name: '小风车', description: '移动速度 +3/级', short: '速度+', buff: (level) => level * 3 },
  { id: 'campfire', name: '营火堆', description: '棍子转速 +0.12/级', short: '转速+', buff: (level) => level * 0.12 },
  { id: 'lantern', name: '萤火灯', description: '稀有植物出现更频繁', short: '寻宝+', buff: (level) => level },
  { id: 'path', name: '石板路', description: '冲刺冷却 -0.12/级', short: '冲刺-', buff: (level) => level * 0.12 },
];
const plantSets = {
  blue: { name: '蓝露拾荒套', count: 3, bonus: '经验吸取范围 +24' },
  purple: { name: '紫晶猎手套', count: 4, bonus: '攻击 +3' },
  gold: { name: '金曜丰收套', count: 5, bonus: '生命 +40、移速 +10、转速 +0.6' },
};
const plantCatalog = [
  { id: 'blue-lotus', name: '蓝露莲', rarity: 'blue', set: 'blue' },
  { id: 'blue-fern', name: '月光蕨', rarity: 'blue', set: 'blue' },
  { id: 'blue-bell', name: '晨露铃', rarity: 'blue', set: 'blue' },
  { id: 'purple-crystal', name: '紫晶苔', rarity: 'purple', set: 'purple' },
  { id: 'purple-orchid', name: '星羽兰', rarity: 'purple', set: 'purple' },
  { id: 'purple-vine', name: '幽香藤', rarity: 'purple', set: 'purple' },
  { id: 'purple-butterfly', name: '梦蝶蕊', rarity: 'purple', set: 'purple' },
  { id: 'gold-sunflower', name: '金曜花', rarity: 'gold', set: 'gold' },
  { id: 'gold-sunfruit', name: '日轮果', rarity: 'gold', set: 'gold' },
  { id: 'gold-amber-orchid', name: '琥珀兰', rarity: 'gold', set: 'gold' },
  { id: 'gold-harvest', name: '丰年穗', rarity: 'gold', set: 'gold' },
  { id: 'gold-crown-mushroom', name: '皇冠菇', rarity: 'gold', set: 'gold' },
  { id: 'red-hidden', name: '绯焰灵芝', rarity: 'red', set: null, hidden: true },
];
const plantColors = { blue: '#46b7e8', purple: '#ae75e8', gold: '#f2bd43', red: '#f04c59' };
const enemyCatalog = [
  { id: 'basic', name: '草团怪', description: '基础敌人，数量最多' },
  { id: 'runner', name: '疾跑怪', description: '生命较低，移动很快' },
  { id: 'brute', name: '壮壮怪', description: '身形更大，耐打且伤害高' },
  { id: 'elite', name: '精英怪', description: '高生命，后期波次出现' },
  { id: 'ape', name: '丛林猿', description: '强力近身冲撞，击败奖励更多' },
  { id: 'stalker', name: '夜行客', description: '快速追击，接触伤害较高' },
  { id: 'boss', name: '王座首领', description: '定时登场，会冲锋攻击' },
];
let profile = loadProfile();
const audioPlayers = {};
const soundLastPlayed = {};
const stickWidth = 76;
const stickHeight = 10;
const bossSpawnTime = 150;
const skillRarity = {
  white: { label: '白色', color: '#8a8d7b', weight: 35, points: 1 },
  blue: { label: '蓝色', color: '#3498d5', weight: 25, points: 2 },
  purple: { label: '紫色', color: '#9760c8', weight: 20, points: 3 },
  gold: { label: '金色', color: '#c58a13', weight: 15, points: 5 },
  red: { label: '红色', color: '#d84b52', weight: 5, points: 8 },
};

const upgrades = [
  { title: '棍子数量 +1', description: '多一根棍子环绕攻击', rarity: 'purple', apply: () => { game.orbitStickCount += 1; } },
  { title: '强力棍子', description: '基础攻击之外额外 +1', rarity: 'blue', apply: () => { game.bonusAttack += 1; } },
  { title: '快速旋转', description: '环绕旋转速度提高', rarity: 'blue', apply: () => { game.orbitSpeed += 0.45; } },
  { title: '扩大轨道', description: '棍子环绕范围扩大', rarity: 'blue', apply: () => { game.orbitRadius += 12; } },
  { title: '轻便鞋子', description: '移动速度提高', rarity: 'white', apply: () => { game.moveSpeed += 24; } },
  { title: '收集袋', description: '经验吸取范围扩大', rarity: 'white', apply: () => { game.pickupRange += 24; } },
  { title: '急救包', description: '恢复生命并增加上限', rarity: 'white', apply: () => { game.maxHealth += 20; game.health = Math.min(game.maxHealth, game.health + 35); } },
  { title: '坚韧外衣', description: '每次碰撞少受 2 点伤害', rarity: 'white', apply: () => { game.damageReduction += 2; } },
  { title: '长棍术', description: '环绕棍子的攻击距离增加', rarity: 'blue', apply: () => { game.stickHitHalfLength += 10; } },
  { title: '疾风步', description: '冲刺冷却缩短 0.8 秒', rarity: 'white', apply: () => { game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - 0.8); } },
  { title: '棍云冲撞', description: '冲刺伤害提高，棍子越多伤害越高', rarity: 'purple', apply: () => { game.dashBonusDamage += 3; } },
  { title: '金刚护体', description: '生命上限 +80，碰撞减伤 +6', rarity: 'gold', apply: () => { game.maxHealth += 80; game.health = Math.min(game.maxHealth, game.health + 80); game.damageReduction += 6; } },
  { title: '赤霄雷暴棍', description: '雷电棍进化，棍子 +2，旋转速度 +35%', rarity: 'red', apply: () => { game.weaponEvolution = 'lightning'; game.orbitStickCount += 2; game.orbitSpeed *= 1.35; } },
];
const rabbitUpgrades = [
  { title: '高压弹头', description: '子弹伤害 +2', rarity: 'blue', apply: () => { game.bulletDamage += 2; } },
  { title: '快速装填', description: '射击间隔缩短 0.12 秒', rarity: 'purple', apply: () => { game.fireInterval = Math.max(0.18, game.fireInterval - 0.12); } },
  { title: '双发点射', description: '每轮额外发射 1 枚追踪子弹', rarity: 'purple', apply: () => { game.projectileCount += 1; } },
  { title: '穿透弹头', description: '每枚子弹可多命中 1 个敌人', rarity: 'purple', apply: () => { game.projectilePierce += 1; } },
  { title: '追踪芯片', description: '子弹飞行速度 +100', rarity: 'blue', apply: () => { game.projectileSpeed += 100; } },
  { title: '战术翻滚', description: '冲刺冷却缩短 0.8 秒', rarity: 'white', apply: () => { game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - 0.8); } },
  { title: '急救补给', description: '恢复生命并增加上限', rarity: 'white', apply: () => { game.maxHealth += 20; game.health = Math.min(game.maxHealth, game.health + 35); } },
  { title: '轻装行动', description: '移动速度提高', rarity: 'white', apply: () => { game.moveSpeed += 24; } },
  { title: '加大弹匣', description: '子弹伤害 +1，射击间隔缩短 0.04 秒', rarity: 'blue', apply: () => { game.bulletDamage += 1; game.fireInterval = Math.max(0.18, game.fireInterval - 0.04); } },
  { title: '精准连射', description: '子弹伤害 +5，弹数 +1，射速提升', rarity: 'gold', apply: () => { game.bulletDamage += 5; game.projectileCount += 1; game.fireInterval = Math.max(0.18, game.fireInterval - 0.12); } },
  { title: '赤焰追踪弹', description: '爆裂进化，伤害 +8，弹数 +2', rarity: 'red', apply: () => { game.weaponEvolution = 'explosion'; game.bulletDamage += 8; game.projectileCount += 2; } },
];

function loadProfile() {
  try {
    const saved = wx.getStorageSync(profileStorageKey);
    if (!saved || typeof saved !== 'object') throw new Error('No saved profile');
    const unlockedSkins = Array.isArray(saved.unlockedSkins) ? saved.unlockedSkins.filter((id) => appearances.some((item) => item.id === id)) : ['base'];
    if (!unlockedSkins.includes('base')) unlockedSkins.push('base');
    const garden = {};
    gardenProjects.forEach((item) => { garden[item.id] = Math.max(0, Math.min(10, Number(saved.garden && saved.garden[item.id]) || 0)); });
    const plants = Array.isArray(saved.plants) ? saved.plants.filter((id) => plantCatalog.some((plant) => plant.id === id)) : [];
    const enemyKills = {};
    enemyCatalog.forEach((enemy) => { enemyKills[enemy.id] = Math.max(0, Number(saved.enemyKills && saved.enemyKills[enemy.id]) || 0); });
    const enemySeen = Array.isArray(saved.enemySeen) ? saved.enemySeen.filter((id) => enemyCatalog.some((enemy) => enemy.id === id)) : [];
    return {
      bestTime: Number(saved.bestTime) || 0,
      bestKills: Number(saved.bestKills) || 0,
      coins: Number(saved.coins) || 0,
      seeds: Number(saved.seeds) || 0,
      character: characters.some((item) => item.id === saved.character) ? saved.character : 'supreme',
      enemyKills,
      enemySeen,
      garden,
      plants,
      unlockedSkins,
      skin: unlockedSkins.includes(saved.skin) ? saved.skin : 'base',
    };
  } catch (error) {
    const garden = {};
    gardenProjects.forEach((item) => { garden[item.id] = 0; });
    return { bestTime: 0, bestKills: 0, coins: 0, seeds: 0, garden, plants: [], character: 'supreme', enemyKills: { basic: 0, runner: 0, brute: 0, elite: 0, ape: 0, stalker: 0, boss: 0 }, enemySeen: [], unlockedSkins: ['base'], skin: 'base' };
  }
}

function saveProfile() {
  try {
    wx.setStorageSync(profileStorageKey, profile);
  } catch (error) {
    // Keep the current run playable when local storage is unavailable.
  }
}

function getPlantBonuses(owned = profile.plants) {
  const bonuses = { maxHealth: 0, attack: 0, moveSpeed: 0, pickupRange: 0, orbitSpeed: 0, dashCooldown: 0 };
  const setCounts = { blue: 0, purple: 0, gold: 0 };
  for (const id of owned) {
    const plant = plantCatalog.find((item) => item.id === id);
    if (!plant) continue;
    if (plant.set) setCounts[plant.set] += 1;
    if (plant.rarity === 'blue') bonuses.pickupRange += 8;
    else if (plant.rarity === 'purple') bonuses.moveSpeed += 5;
    else if (plant.rarity === 'gold') { bonuses.maxHealth += 8; bonuses.orbitSpeed += 0.12; }
    else if (plant.rarity === 'red') { bonuses.attack += 5; bonuses.maxHealth += 40; bonuses.pickupRange += 20; }
  }
  if (setCounts.blue >= plantSets.blue.count) bonuses.pickupRange += 24;
  if (setCounts.purple >= plantSets.purple.count) bonuses.attack += 3;
  if (setCounts.gold >= plantSets.gold.count) { bonuses.maxHealth += 40; bonuses.moveSpeed += 10; bonuses.orbitSpeed += 0.6; }
  return bonuses;
}

function applyPlantBonusChange(before, after) {
  if (!game) return;
  const maxHealthGain = after.maxHealth - before.maxHealth;
  game.maxHealth += maxHealthGain;
  game.health = Math.min(game.maxHealth, game.health + maxHealthGain);
  game.baseAttack += after.attack - before.attack;
  game.moveSpeed += after.moveSpeed - before.moveSpeed;
  game.pickupRange += after.pickupRange - before.pickupRange;
  game.orbitSpeed += after.orbitSpeed - before.orbitSpeed;
  game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - (after.dashCooldown - before.dashCooldown));
  game.dashCooldown = Math.min(game.dashCooldown, game.dashCooldownMax);
}

function plantSetCount(setId, owned = profile.plants) {
  return owned.filter((id) => { const plant = plantCatalog.find((item) => item.id === id); return plant && plant.set === setId; }).length;
}

function playSound(name, cooldown = 100) {
  if (typeof wx.createInnerAudioContext !== 'function') return;
  const now = Date.now();
  if (now - (soundLastPlayed[name] || 0) < cooldown) return;
  soundLastPlayed[name] = now;
  try {
    let audio = audioPlayers[name];
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = `assets/sfx-${name}.wav`;
      audio.volume = name === 'hit' ? 0.22 : 0.36;
      audioPlayers[name] = audio;
    }
    audio.stop();
    audio.play();
  } catch (error) {
    // Audio is optional; unsupported devices still get visual feedback.
  }
}

function burstParticles(x, y, color, count = 5) {
  if (!game) return;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 24 + Math.random() * 72;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.28 + Math.random() * 0.18, color });
  }
  if (game.particles.length > 140) game.particles.splice(0, game.particles.length - 140);
}

function finishGame(won) {
  if (screen === 'result') return;
  game.resultWon = won;
  game.coinsEarned = Math.floor(game.kills / 2) + (won ? 25 : 0);
  game.seedsEarned += won ? 8 : 0;
  profile.coins += game.coinsEarned;
  profile.seeds += game.seedsEarned;
  profile.bestTime = Math.max(profile.bestTime, Math.floor(game.elapsed));
  profile.bestKills = Math.max(profile.bestKills, game.kills);
  for (const id of game.seenEnemies) if (!profile.enemySeen.includes(id)) profile.enemySeen.push(id);
  for (const id of Object.keys(game.enemyKills)) profile.enemyKills[id] = (profile.enemyKills[id] || 0) + game.enemyKills[id];
  saveProfile();
  screen = 'result';
  playSound(won ? 'levelup' : 'hurt', 500);
}

function isEnemyVisible(enemy) {
  const radius = enemy.radius || 0;
  return enemy.x + radius >= game.camera.x && enemy.x - radius <= game.camera.x + width
    && enemy.y + radius >= game.camera.y && enemy.y - radius <= game.camera.y + height;
}

function getEnemyBuffMultipliers(points = game.enemyBuffPoints) {
  return {
    speed: 1 + points * 0.012,
    damage: 1 + points * 0.016,
    health: 1 + points * 0.024,
  };
}

function enemyBuffDescription(rarity) {
  const previous = getEnemyBuffMultipliers();
  const next = getEnemyBuffMultipliers(game.enemyBuffPoints + skillRarity[rarity].points);
  const percent = (key) => Math.round((next[key] / previous[key] - 1) * 100);
  return `怪物强化：移速 +${percent('speed')}% · 伤害 +${percent('damage')}% · 生命 +${percent('health')}%`;
}

function applyEnemyBuff(rarity) {
  const previous = getEnemyBuffMultipliers();
  game.enemyBuffPoints += skillRarity[rarity].points;
  const next = getEnemyBuffMultipliers();
  const speedRatio = next.speed / previous.speed;
  const damageRatio = next.damage / previous.damage;
  const healthRatio = next.health / previous.health;
  for (const enemy of game.enemies) {
    enemy.speed *= speedRatio;
    enemy.damage = Math.max(1, Math.round((enemy.damage || (enemy.boss ? 16 : 10)) * damageRatio));
    enemy.maxHealth = Math.round(enemy.maxHealth * healthRatio);
    enemy.health = Math.min(enemy.maxHealth, Math.round(enemy.health * healthRatio));
  }
}

function applyCurrentEnemyBuff(enemy) {
  const buff = getEnemyBuffMultipliers();
  enemy.maxHealth = Math.round(enemy.maxHealth * buff.health);
  enemy.health = enemy.maxHealth;
  enemy.speed *= buff.speed;
  enemy.damage = Math.max(1, Math.round((enemy.damage || (enemy.boss ? 16 : 10)) * buff.damage));
  return enemy;
}

background.onload = () => {
  backgroundReady = true;
  draw();
};
background.src = 'assets/field-storybook.png';

characterSprite.onload = () => {
  characterReady = true;
  draw();
};
characterSprite.src = 'assets/yellow-gardener.png';

stickSprite.onload = () => {
  stickReady = true;
  draw();
};
stickSprite.src = 'assets/blue-orbiting-stick.png';

speedCloudSprite.onload = () => {
  speedCloudReady = true;
  draw();
};
speedCloudSprite.src = 'assets/speed-cloud.png';

enemySprite.onload = () => {
  enemyReady = true;
  draw();
};
enemySprite.src = 'assets/enemy-yellow.png';

dropSprite.onload = () => { dropReady = true; draw(); };
dropSprite.src = 'assets/zongzi-drop.png';

bossSprite.onload = () => { bossReady = true; draw(); };
bossSprite.src = 'assets/boss-king.png';

rabbitSprite.onload = () => { rabbitReady = true; draw(); };
rabbitSprite.src = 'assets/slim-dudu.png';

apeSprite.onload = () => { apeReady = true; draw(); };
apeSprite.src = 'assets/ape-enemy.png';

stalkerSprite.onload = () => { stalkerReady = true; draw(); };
stalkerSprite.src = 'assets/stalker-enemy.png';

bruteSprite.onload = () => { bruteReady = true; draw(); };
bruteSprite.src = 'assets/brute-enemy.png';

runnerSprite.onload = () => { runnerReady = true; draw(); };
runnerSprite.src = 'assets/runner-enemy.png';

eliteSprite.onload = () => { eliteReady = true; draw(); };
eliteSprite.src = 'assets/elite-enemy.png';

function getEnemySprite(type) {
  if (type === 'boss') return bossSprite;
  if (type === 'ape') return apeSprite;
  if (type === 'stalker') return stalkerSprite;
  if (type === 'brute') return bruteSprite;
  if (type === 'runner') return runnerSprite;
  if (type === 'elite') return eliteSprite;
  return enemySprite;
}

function isEnemySpriteReady(type) {
  if (type === 'boss') return bossReady;
  if (type === 'ape') return apeReady;
  if (type === 'stalker') return stalkerReady;
  if (type === 'brute') return bruteReady;
  if (type === 'runner') return runnerReady;
  if (type === 'elite') return eliteReady;
  return enemyReady;
}

function drawImageContain(sprite, x, y, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / sprite.width, boxHeight / sprite.height);
  const drawWidth = sprite.width * scale;
  const drawHeight = sprite.height * scale;
  context.drawImage(sprite, x + (boxWidth - drawWidth) / 2, y + (boxHeight - drawHeight) / 2, drawWidth, drawHeight);
}

// All character sprites use this helper: horizontal movement sets facing; vertical movement keeps it.
function drawFacingSprite(sprite, x, y, spriteWidth, spriteHeight, facing, alpha = 1) {
  context.save();
  context.translate(x, y);
  context.scale(facing < 0 ? -1 : 1, 1);
  context.globalAlpha = alpha;
  context.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
  context.restore();
}

function resize() {
  const info = wx.getSystemInfoSync();
  width = info.screenWidth;
  height = info.screenHeight;
  pixelRatio = info.pixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  draw();
}

function roundedRect(x, y, rectWidth, rectHeight, radius) {
  context.beginPath();
  if (context.roundRect) context.roundRect(x, y, rectWidth, rectHeight, radius);
  else context.rect(x, y, rectWidth, rectHeight);
  context.fill();
}

function drawMenu() {
  const buttonWidth = Math.min(240, width - 48);
  const buttonHeight = 60;
  const buttonX = (width - buttonWidth) / 2;
  const buttonY = height * 0.57;
  menuButton = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
  wardrobeButton = { x: width / 2 - 90, y: buttonY + 78, width: 180, height: 44 };
  gardenButton = { x: width / 2 - 90, y: buttonY + 132, width: 180, height: 44 };
  enemyCodexButton = { x: width / 2 - 90, y: buttonY + 184, width: 180, height: 40 };
  characterButtons = characters.map((character, index) => ({
    x: 20 + index * (width / 2 - 24), y: height * 0.405, width: width / 2 - 28, height: 62, id: character.id,
  }));

  context.fillStyle = '#b9df8b';
  context.fillRect(0, 0, width, height);
  if (backgroundReady) {
    const scale = Math.max(width / background.width, height / background.height);
    const drawWidth = background.width * scale;
    const drawHeight = background.height * scale;
    context.drawImage(background, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  context.fillStyle = 'rgba(255, 250, 226, 0.12)';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#274d2e';
  context.textAlign = 'center';
  context.font = 'bold 34px sans-serif';
  context.lineWidth = 5;
  context.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  context.strokeText('小院清理队', width / 2, height * 0.25);
  context.fillText('小院清理队', width / 2, height * 0.25);

  context.fillStyle = '#477a3c';
  context.font = '16px sans-serif';
  context.fillText('春日到了，来整理你的小院吧', width / 2, height * 0.30);
  context.font = '14px sans-serif';
  context.fillText(`最高 ${profile.bestTime} 秒 · 最多清理 ${profile.bestKills} 只 · ${profile.coins} 金币`, width / 2, height * 0.35);

  context.font = 'bold 12px sans-serif'; context.fillStyle = '#315e37';
  context.fillText('选择出战角色', width / 2, height * 0.39);
  characterButtons.forEach((card, index) => {
    const character = characters[index];
    context.fillStyle = profile.character === character.id ? '#fff0ba' : 'rgba(255, 250, 226, 0.94)';
    roundedRect(card.x, card.y, card.width, card.height, 12);
    if (profile.character === character.id) { context.strokeStyle = '#c58e37'; context.lineWidth = 2; context.stroke(); }
    context.textAlign = 'left'; context.fillStyle = '#315e37'; context.font = 'bold 14px sans-serif';
    context.fillText(character.name, card.x + 10, card.y + 23);
    context.font = '10px sans-serif'; context.fillStyle = '#71805c';
    context.fillText(`${character.style} · ${character.description}`, card.x + 10, card.y + 41);
    context.font = '9px sans-serif';
    context.fillText(profile.character === character.id ? '已选择' : '点击选择', card.x + 10, card.y + 54);
    const preview = character.id === 'rabbit' ? rabbitSprite : characterSprite;
    const previewReady = character.id === 'rabbit' ? rabbitReady : characterReady;
    if (previewReady) context.drawImage(preview, card.x + card.width - 38, card.y + 8, 30, 46);
  });
  context.textAlign = 'center';

  context.fillStyle = '#315e37';
  roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 16);
  context.fillStyle = '#fff7d9';
  context.font = 'bold 20px sans-serif';
  context.fillText('开始清理', width / 2, buttonY + 38);
  context.fillStyle = '#315e37';
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(wardrobeButton.x, wardrobeButton.y, wardrobeButton.width, wardrobeButton.height, 14);
  context.fillStyle = '#315e37';
  context.font = 'bold 16px sans-serif';
  context.fillText('装扮小院队员', width / 2, wardrobeButton.y + 28);
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(gardenButton.x, gardenButton.y, gardenButton.width, gardenButton.height, 14);
  context.fillStyle = '#315e37';
  context.font = 'bold 16px sans-serif';
  context.fillText(`打理小院 · 种子 ${profile.seeds}`, width / 2, gardenButton.y + 28);
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(enemyCodexButton.x, enemyCodexButton.y, enemyCodexButton.width, enemyCodexButton.height, 14);
  context.fillStyle = '#315e37';
  context.fillText('敌人图鉴 · 波次挑战', width / 2, enemyCodexButton.y + 26);
}

function gardenCardBounds(index) {
  const cardHeight = Math.min(100, height * 0.12);
  const cardWidth = (width - 66) / 2;
  return { x: 28 + (index % 2) * (cardWidth + 10), y: height * 0.235 + Math.floor(index / 2) * (cardHeight + 9), width: cardWidth, height: cardHeight };
}

function drawGardenPlot(project, level, x, y) {
  drawGardenDecorationIcon(project.id, level, x, y, 0.7);
}

function drawGardenDecorationIcon(id, level, x, y, scale = 1) {
  const stage = Math.max(1, level);
  context.save(); context.translate(x, y); context.scale(scale, scale);
  context.fillStyle = 'rgba(53, 79, 43, 0.22)'; context.beginPath(); context.ellipse(0, 13, 21, 7, 0, 0, Math.PI * 2); context.fill();
  if (id === 'flower') {
    for (let i = 0; i < Math.min(5, 1 + Math.floor(stage / 2)); i += 1) {
      const fx = (i - 2) * 9; context.strokeStyle = '#47844d'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(fx, 12); context.lineTo(fx, -4 - i % 2 * 4); context.stroke();
      context.fillStyle = i % 2 ? '#f5c85d' : '#f4a6a0'; context.beginPath(); context.arc(fx, -7 - i % 2 * 4, 4 + stage * 0.12, 0, Math.PI * 2); context.fill();
    }
  } else if (id === 'tree') {
    context.fillStyle = '#805334'; context.fillRect(-3, -9 - stage, 6, 22);
    context.fillStyle = '#5c9a50'; context.beginPath(); context.arc(0, -17 - stage, 11 + stage * 0.55, 0, Math.PI * 2); context.arc(-9, -10, 8, 0, Math.PI * 2); context.arc(9, -10, 8, 0, Math.PI * 2); context.fill();
  } else if (id === 'pond') {
    context.fillStyle = '#5caeb0'; context.beginPath(); context.ellipse(0, 5, 23 + stage * 0.8, 11 + stage * 0.25, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#d9f3d4'; context.beginPath(); context.ellipse(-3, 2, 12, 3, 0, 0, Math.PI * 2); context.stroke();
  } else if (id === 'fence') {
    context.fillStyle = '#a77a48'; context.fillRect(-19, -12, 5, 25); context.fillRect(-2, -15, 5, 28); context.fillRect(15, -12, 5, 25); context.fillRect(-20, -8, 41, 4); context.fillRect(-20, 3, 41, 4);
  } else if (id === 'windmill') {
    context.strokeStyle = '#8b6743'; context.lineWidth = 4; context.beginPath(); context.moveTo(0, 13); context.lineTo(0, -15); context.stroke();
    context.strokeStyle = '#e7e2ca'; context.lineWidth = 3; context.beginPath(); context.moveTo(0, -14); context.lineTo(-11, -25); context.moveTo(0, -14); context.lineTo(12, -20); context.moveTo(0, -14); context.lineTo(2, 0); context.stroke();
  } else if (id === 'campfire') {
    context.fillStyle = '#805334'; context.fillRect(-16, 5, 32, 4); context.save(); context.translate(0, 0); context.fillStyle = '#f07845'; context.beginPath(); context.moveTo(0, -20 - stage * 0.3); context.quadraticCurveTo(14, -5, 0, 7); context.quadraticCurveTo(-13, -4, 0, -20); context.fill(); context.fillStyle = '#ffd45a'; context.beginPath(); context.moveTo(0, -12); context.quadraticCurveTo(7, -2, 0, 5); context.quadraticCurveTo(-7, -3, 0, -12); context.fill(); context.restore();
  } else if (id === 'lantern') {
    context.strokeStyle = '#805334'; context.lineWidth = 3; context.beginPath(); context.moveTo(-10, 13); context.lineTo(-10, -16); context.lineTo(10, -16); context.lineTo(10, 13); context.stroke();
    context.fillStyle = '#ffd96f'; context.beginPath(); context.arc(0, -4, 7 + stage * 0.25, 0, Math.PI * 2); context.fill();
  } else {
    context.fillStyle = '#a9a390';
    for (let i = 0; i < 5; i += 1) { context.beginPath(); context.ellipse((i - 2) * 8, (i % 2) * 5, 6, 4, 0, 0, Math.PI * 2); context.fill(); }
  }
  context.restore();
}

function drawGarden() {
  drawMenu(); context.fillStyle = 'rgba(24, 47, 29, 0.76)'; context.fillRect(0, 0, width, height);
  const panel = { x: 18, y: height * 0.12, width: width - 36, height: height * 0.76 };
  context.fillStyle = '#fff7d9'; roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center'; context.fillStyle = '#315e37'; context.font = 'bold 24px sans-serif'; context.fillText('我的小院', width / 2, panel.y + 38);
  context.font = '14px sans-serif'; context.fillText(`种子 ${profile.seeds} · 8 种装饰，最高 10 级`, width / 2, panel.y + 62);
  gardenProjects.forEach((project, index) => {
    const card = gardenCardBounds(index); const level = profile.garden[project.id];
    context.fillStyle = '#edf3df'; roundedRect(card.x, card.y, card.width, card.height, 13); drawGardenPlot(project, level, card.x + 27, card.y + card.height * 0.65);
    context.textAlign = 'left'; context.fillStyle = '#315e37'; context.font = 'bold 13px sans-serif'; context.fillText(project.name, card.x + 49, card.y + 24);
    context.font = '10px sans-serif'; context.fillStyle = '#71805c'; context.fillText(`${project.short} ${project.buff(level)}`, card.x + 49, card.y + 43);
    context.font = '11px sans-serif'; context.fillText(`等级 ${level}/10`, card.x + 49, card.y + 63);
    const cost = 5 + level * 3; context.textAlign = 'right'; context.fillStyle = level >= 10 ? '#7a9861' : (profile.seeds >= cost ? '#b37c2e' : '#9b8470');
    context.font = 'bold 10px sans-serif'; context.fillText(level >= 10 ? '已满级' : `升 ${cost} 粒`, card.x + card.width - 7, card.y + 44);
  });
  codexButton = { x: width / 2 - 82, y: panel.y + panel.height - 52, width: 164, height: 36 };
  context.fillStyle = '#e8d7a9'; roundedRect(codexButton.x, codexButton.y, codexButton.width, codexButton.height, 11);
  context.fillStyle = '#315e37'; context.font = 'bold 14px sans-serif'; context.textAlign = 'center';
  context.fillText(`植物图鉴 ${profile.plants.filter((id) => id !== 'red-hidden').length}/12`, width / 2, codexButton.y + 23);
  context.fillStyle = '#315e37'; roundedRect(panel.x + 12, panel.y + 10, 56, 32, 10); context.fillStyle = '#fff7d9';
  context.font = 'bold 14px sans-serif'; context.textAlign = 'center'; context.fillText('返回', panel.x + 40, panel.y + 31);
  context.fillStyle = '#71805c'; context.font = '11px sans-serif'; context.fillText('装饰等级和效果会同步到战斗地图', width / 2, panel.y + panel.height - 10);
}

function drawEnemyCodex() {
  drawMenu(); context.fillStyle = 'rgba(24, 47, 29, 0.78)'; context.fillRect(0, 0, width, height);
  const panel = { x: 16, y: height * 0.055, width: width - 32, height: height * 0.89 };
  context.fillStyle = '#fff7d9'; roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center'; context.fillStyle = '#315e37'; context.font = 'bold 22px sans-serif'; context.fillText('敌人图鉴', width / 2, panel.y + 34);
  context.font = '11px sans-serif'; context.fillStyle = '#71805c'; context.fillText('每 30 秒进入新波次，完成击杀目标可获得种子', width / 2, panel.y + 55);
  const cardHeight = Math.min(112, height * 0.132); const cardWidth = (width - 60) / 2;
  enemyCatalog.forEach((enemy, index) => {
    const x = 24 + (index % 2) * (cardWidth + 10); const y = panel.y + 68 + Math.floor(index / 2) * (cardHeight + 7);
    const seen = profile.enemySeen.includes(enemy.id); const kills = profile.enemyKills[enemy.id] || 0;
    context.fillStyle = seen ? '#edf3df' : '#f2eee1'; roundedRect(x, y, cardWidth, cardHeight, 10);
    const sprite = getEnemySprite(enemy.id);
    if (seen && isEnemySpriteReady(enemy.id)) drawImageContain(sprite, x + 8, y + 8, 48, cardHeight - 16);
    else {
      context.fillStyle = seen ? '#9b7459' : '#c5bfaf'; context.beginPath(); context.arc(x + 32, y + cardHeight / 2, 17, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#fff'; context.font = 'bold 14px sans-serif'; context.fillText(seen ? '✓' : '?', x + 32, y + cardHeight / 2 + 5);
    }
    context.textAlign = 'left'; context.fillStyle = '#315e37'; context.font = 'bold 12px sans-serif';
    context.fillText(seen ? enemy.name : '未发现敌人', x + 62, y + 26);
    context.fillStyle = '#71805c'; context.font = '9px sans-serif';
    context.fillText(seen ? enemy.description : '推进波次后遭遇', x + 62, y + 45);
    context.fillText(`击败 ${kills} 次`, x + 62, y + 63);
  });
  context.fillStyle = '#315e37'; roundedRect(panel.x + 12, panel.y + 10, 56, 32, 10);
  context.fillStyle = '#fff7d9'; context.textAlign = 'center'; context.font = 'bold 14px sans-serif'; context.fillText('返回', panel.x + 40, panel.y + 31);
  context.fillStyle = '#71805c'; context.font = '10px sans-serif'; context.fillText('首领在第 6 波限时登场 · 精英怪从后期波次出现', width / 2, panel.y + panel.height - 12);
}

function drawPlantIcon(plant, x, y, size, pulse = 0) {
  const color = plantColors[plant.rarity];
  context.save(); context.globalAlpha = 0.25 + pulse * 0.25; context.fillStyle = color;
  context.beginPath(); context.arc(x, y, size * (0.72 + pulse * 0.16), 0, Math.PI * 2); context.fill(); context.globalAlpha = 1;
  context.strokeStyle = '#4b8b4a'; context.lineWidth = Math.max(1, size * 0.12);
  context.beginPath(); context.moveTo(x, y + size * 0.68); context.lineTo(x, y + size * 0.12); context.stroke();
  context.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const angle = i * Math.PI * 2 / 5; context.beginPath();
    context.arc(x + Math.cos(angle) * size * 0.36, y - size * 0.15 + Math.sin(angle) * size * 0.36, size * 0.25, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = '#fff2a4'; context.beginPath(); context.arc(x, y - size * 0.15, size * 0.2, 0, Math.PI * 2); context.fill(); context.restore();
}

function codexCardBounds(index) {
  const cardHeight = Math.min(66, height * 0.079); const cardWidth = (width - 66) / 2;
  return { x: 28 + (index % 2) * (cardWidth + 10), y: height * 0.235 + Math.floor(index / 2) * (cardHeight + 6), width: cardWidth, height: cardHeight };
}

function plantBonusLabel(plant) {
  if (plant.rarity === 'blue') return '永久吸取范围 +8';
  if (plant.rarity === 'purple') return '永久移动速度 +5';
  if (plant.rarity === 'gold') return '永久生命 +8、转速 +0.12';
  return '隐藏加成：攻击 +5、生命 +40、吸取 +20';
}

function drawCodex() {
  drawMenu(); context.fillStyle = 'rgba(24, 47, 29, 0.78)'; context.fillRect(0, 0, width, height);
  const panel = { x: 16, y: height * 0.07, width: width - 32, height: height * 0.86 };
  context.fillStyle = '#fff7d9'; roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center'; context.fillStyle = '#315e37'; context.font = 'bold 22px sans-serif'; context.fillText('稀有植物图鉴', width / 2, panel.y + 35);
  const blue = plantSetCount('blue'); const purple = plantSetCount('purple'); const gold = plantSetCount('gold');
  context.font = '11px sans-serif'; context.fillText(`蓝套 ${blue}/3 · 紫套 ${purple}/4 · 金套 ${gold}/5（集齐激活套装加成）`, width / 2, height * 0.205);
  plantCatalog.forEach((plant, index) => {
    const card = codexCardBounds(index); const found = profile.plants.includes(plant.id);
    context.fillStyle = found ? '#edf3df' : '#f4f0e4'; roundedRect(card.x, card.y, card.width, card.height, 10);
    if (found || !plant.hidden) drawPlantIcon(plant, card.x + 23, card.y + 26, 13);
    else { context.fillStyle = '#c2bcae'; context.beginPath(); context.arc(card.x + 23, card.y + 26, 12, 0, Math.PI * 2); context.fill(); context.fillStyle = '#fff'; context.font = 'bold 13px sans-serif'; context.textAlign = 'center'; context.fillText('?', card.x + 23, card.y + 31); }
    context.textAlign = 'left'; context.fillStyle = '#315e37'; context.font = 'bold 11px sans-serif';
    context.fillText(plant.hidden && !found ? '隐藏植物' : plant.name, card.x + 42, card.y + 24);
    context.fillStyle = found ? '#71805c' : '#a29b8d'; context.font = '9px sans-serif';
    context.fillText(found ? plantBonusLabel(plant) : (plant.hidden ? '首领有 30% 概率掉落' : '地图中随机出现'), card.x + 42, card.y + 43);
    if (plant.set && found && plantSetCount(plant.set) >= plantSets[plant.set].count) {
      context.textAlign = 'right'; context.fillStyle = plantColors[plant.rarity]; context.font = 'bold 9px sans-serif'; context.fillText('套装已激活', card.x + card.width - 5, card.y + 14);
    }
  });
  context.fillStyle = '#315e37'; roundedRect(panel.x + 12, panel.y + 10, 56, 32, 10);
  context.fillStyle = '#fff7d9'; context.font = 'bold 14px sans-serif'; context.textAlign = 'center'; context.fillText('返回', panel.x + 40, panel.y + 31);
  context.fillStyle = '#71805c'; context.font = '10px sans-serif';
  context.fillText(`套装加成：${plantSets.blue.bonus} · ${plantSets.purple.bonus} · ${plantSets.gold.bonus}`, width / 2, panel.y + panel.height - 12);
}

function drawAppearanceAccessory(id) {
  if (id === 'flower') {
    context.strokeStyle = '#4c8a4d';
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(0, -59, 13, Math.PI * 1.12, Math.PI * 1.88);
    context.stroke();
    for (const x of [-9, 0, 9]) {
      context.fillStyle = '#fff3d1';
      context.beginPath();
      context.arc(x, -67 + Math.abs(x) * 0.18, 4.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e7b94f';
      context.beginPath();
      context.arc(x, -67 + Math.abs(x) * 0.18, 1.7, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === 'leaf') {
    context.fillStyle = '#64a857';
    context.beginPath();
    context.moveTo(-15, -61);
    context.quadraticCurveTo(-12, -75, -5, -66);
    context.quadraticCurveTo(0, -78, 5, -66);
    context.quadraticCurveTo(12, -75, 15, -61);
    context.quadraticCurveTo(0, -55, -15, -61);
    context.fill();
    context.strokeStyle = '#f2d474';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-11, -61);
    context.lineTo(11, -61);
    context.stroke();
  }
}

function appearanceCardBounds(index) {
  const cardHeight = 82;
  const gap = 10;
  return { x: 30, y: height * 0.30 + index * (cardHeight + gap), width: width - 60, height: cardHeight };
}

function drawWardrobe() {
  drawMenu();
  context.fillStyle = 'rgba(24, 47, 29, 0.72)';
  context.fillRect(0, 0, width, height);
  const panel = { x: 20, y: height * 0.14, width: width - 40, height: height * 0.70 };
  context.fillStyle = '#fff7d9';
  roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center';
  context.fillStyle = '#315e37';
  context.font = 'bold 24px sans-serif';
  context.fillText('队员装扮', width / 2, panel.y + 36);
  context.font = '14px sans-serif';
  context.fillText(`金币 ${profile.coins} · 解锁后可随时更换`, width / 2, panel.y + 60);

  appearances.forEach((appearance, index) => {
    const card = appearanceCardBounds(index);
    context.fillStyle = '#edf3df';
    roundedRect(card.x, card.y, card.width, card.height, 12);
    if (characterReady) {
      context.save();
      context.translate(card.x + 39, card.y + 61);
      context.scale(0.48, 0.48);
      context.drawImage(characterSprite, -44, -67, 88, 76);
      drawAppearanceAccessory(appearance.id);
      context.restore();
    }
    context.textAlign = 'left';
    context.fillStyle = '#315e37';
    context.font = 'bold 16px sans-serif';
    context.fillText(appearance.name, card.x + 72, card.y + 32);
    context.font = '13px sans-serif';
    context.fillStyle = '#71805c';
    context.fillText(appearance.price ? `解锁价格 ${appearance.price} 金币` : '初始外观', card.x + 72, card.y + 56);
    const isUnlocked = profile.unlockedSkins.includes(appearance.id);
    const label = isUnlocked ? (profile.skin === appearance.id ? '已装备' : '使用')
      : profile.coins >= appearance.price ? '解锁' : `差 ${appearance.price - profile.coins} 金币`;
    context.textAlign = 'right';
    context.fillStyle = isUnlocked && profile.skin === appearance.id ? '#7a9861' : '#b37c2e';
    context.font = 'bold 13px sans-serif';
    context.fillText(label, card.x + card.width - 12, card.y + 46);
  });

  context.textAlign = 'center';
  context.fillStyle = '#477a3c';
  context.font = '15px sans-serif';
  context.fillText('点击左上角返回', width / 2, panel.y + panel.height - 18);
  context.fillStyle = '#315e37';
  roundedRect(panel.x + 12, panel.y + 12, 56, 32, 10);
  context.fillStyle = '#fff7d9';
  context.font = 'bold 14px sans-serif';
  context.fillText('返回', panel.x + 40, panel.y + 33);
}

function startGame() {
  const worldWidth = Math.max(width * 4, 1600);
  const worldHeight = Math.max(height * 4, 2400);
  const player = { x: worldWidth / 2, y: worldHeight / 2, radius: 15 };
  const plantBonuses = getPlantBonuses();
  game = {
    player,
    worldWidth,
    worldHeight,
    camera: { x: player.x - width / 2, y: player.y - height / 2 },
    landmarks: createLandmarks(worldWidth, worldHeight),
    gardenDecorations: createGardenDecorations(player),
    input: { x: 0, y: 0 },
    character: profile.character,
    earlySettled: false,
    facing: 1,
    enemies: [],
    seenEnemies: [],
    enemyKills: {},
    orbs: [],
    plants: [],
    bullets: [],
    fireTimer: 0.35,
    bulletDamage: 0,
    projectileCount: 1,
    projectilePierce: 0,
    projectileSpeed: 430,
    fireInterval: 0.72,
    plantSpawnTimer: 10,
    plantNotice: null,
    victoryPending: false,
    victoryTimer: 0,
    damageNumbers: [],
    particles: [],
    health: 100 + profile.garden.tree * 8 + plantBonuses.maxHealth,
    maxHealth: 100 + profile.garden.tree * 8 + plantBonuses.maxHealth,
    seedsEarned: 0,
    level: 1,
    experience: 0,
    experienceNeeded: 5,
    kills: 0,
    elapsed: 0,
    wave: 1,
    waveKills: 0,
    waveGoal: 5,
    waveNotice: 2.4,
    bossSpawned: false,
    resultWon: false,
    baseAttack: 2 + plantBonuses.attack,
    bonusAttack: 0,
    damageReduction: gardenProjects.find((item) => item.id === 'fence').buff(profile.garden.fence),
    stickHitHalfLength: 35,
    orbitStickCount: 1,
    orbitRadius: 60,
    orbitSpeed: 2.8 + gardenProjects.find((item) => item.id === 'campfire').buff(profile.garden.campfire) + plantBonuses.orbitSpeed,
    moveSpeed: 175 + gardenProjects.find((item) => item.id === 'windmill').buff(profile.garden.windmill) + plantBonuses.moveSpeed,
    pickupRange: 38 + gardenProjects.find((item) => item.id === 'pond').buff(profile.garden.pond) + plantBonuses.pickupRange,
    spawnTimer: 0,
    damageCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashCooldownMax: Math.max(1.6, 4.5 - gardenProjects.find((item) => item.id === 'path').buff(profile.garden.path) - plantBonuses.dashCooldown),
    dashX: 0,
    dashY: 0,
    dashBonusDamage: 0,
    upgradeChoices: [],
    enemyBuffPoints: 0,
    weaponEvolution: null,
    event: null,
    nextEventAt: 35 + Math.random() * 12,
    eventSerial: 0,
    lightningCooldown: 0,
  };
  joystickTouchId = null;
  joystickOrigin = null;
  screen = 'game';
  draw();
  startLoop();
}

function startLoop() {
  if (loopRunning) return;
  loopRunning = true;
  lastFrameTime = 0;
  requestAnimationFrame(gameLoop);
}

function createLandmarks(worldWidth, worldHeight) {
  const landmarks = [];
  const columns = 5;
  const rows = 7;
  const types = ['pond', 'flowers', 'rocks', 'bush', 'stump', 'path'];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellWidth = (worldWidth - 220) / columns;
      const cellHeight = (worldHeight - 220) / rows;
      landmarks.push({
        x: 110 + column * cellWidth + Math.random() * cellWidth * 0.55,
        y: 110 + row * cellHeight + Math.random() * cellHeight * 0.55,
        size: 20 + Math.random() * 16,
        type: types[Math.floor(Math.random() * types.length)],
      });
    }
  }
  return landmarks;
}

function createGardenDecorations(player) {
  return gardenProjects.map((project, index) => {
    const angle = index * Math.PI * 2 / gardenProjects.length - Math.PI / 2;
    return { id: project.id, x: player.x + Math.cos(angle) * 170, y: player.y + Math.sin(angle) * 170, level: profile.garden[project.id] };
  });
}

function spawnPlantDrop(x, y, plantId, bossHidden = false) {
  const plant = plantCatalog.find((item) => item.id === plantId);
  if (!plant || game.plants.length >= 5) return false;
  game.plants.push({ id: plant.id, x, y, phase: Math.random() * Math.PI * 2, bossHidden });
  return true;
}

function spawnRandomPlant() {
  if (game.plants.length >= 4) return;
  const available = plantCatalog.filter((plant) => !plant.hidden && !profile.plants.includes(plant.id));
  const pool = available.length ? available : plantCatalog.filter((plant) => !plant.hidden);
  const rarityRoll = Math.random();
  const rarity = rarityRoll < 0.68 ? 'blue' : rarityRoll < 0.94 ? 'purple' : 'gold';
  const choices = pool.filter((plant) => plant.rarity === rarity);
  const plant = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length ? choices.length : pool.length))];
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.min(width, height) * (0.48 + Math.random() * 0.48);
  const x = Math.max(32, Math.min(game.worldWidth - 32, game.player.x + Math.cos(angle) * distance));
  const y = Math.max(90, Math.min(game.worldHeight - 32, game.player.y + Math.sin(angle) * distance));
  spawnPlantDrop(x, y, plant.id);
}

function updatePlantDrops(delta) {
  if (!game.victoryPending) {
    game.plantSpawnTimer -= delta;
    if (game.plantSpawnTimer <= 0) {
      spawnRandomPlant();
      game.plantSpawnTimer = Math.max(9, 22 + Math.random() * 12 - profile.garden.lantern * 1.1);
    }
  }
  if (game.plantNotice) {
    game.plantNotice.life -= delta;
    if (game.plantNotice.life <= 0) game.plantNotice = null;
  }
  for (let index = game.plants.length - 1; index >= 0; index -= 1) {
    const drop = game.plants[index];
    drop.phase += delta * 3;
    if (distanceBetween(drop, game.player) >= game.player.radius + 24) continue;
    game.plants.splice(index, 1);
    const plant = plantCatalog.find((item) => item.id === drop.id);
    if (!plant) continue;
    if (profile.plants.includes(plant.id)) {
      game.seedsEarned += 3;
      game.plantNotice = { text: `重复植物 · 种子 +3`, life: 2.2 };
    } else {
      const previous = getPlantBonuses();
      const setWasComplete = plant.set && plantSetCount(plant.set) >= plantSets[plant.set].count;
      profile.plants.push(plant.id);
      applyPlantBonusChange(previous, getPlantBonuses());
      saveProfile();
      const setNowComplete = plant.set && plantSetCount(plant.set) >= plantSets[plant.set].count;
      game.plantNotice = { text: setNowComplete && !setWasComplete ? `${plantSets[plant.set].name}激活！` : `发现 ${plant.name} · ${plantBonusLabel(plant)}`, life: 3 };
      burstParticles(drop.x, drop.y, plantColors[plant.rarity], 14);
      playSound('levelup', 300);
    }
    if (drop.bossHidden && game.victoryPending) { finishGame(true); return true; }
  }
  return false;
}

function updateCamera() {
  game.camera.x = Math.max(0, Math.min(game.worldWidth - width, game.player.x - width / 2));
  game.camera.y = Math.max(0, Math.min(game.worldHeight - height, game.player.y - height / 2));
}

function gameLoop(timestamp) {
  const delta = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = timestamp;
  if (screen === 'game') updateGame(delta);
  draw();

  if (screen === 'game' || screen === 'upgrade' || screen === 'paused') requestAnimationFrame(gameLoop);
  else loopRunning = false;
}

function spawnEnemy() {
  if (game.elapsed >= bossSpawnTime && !game.bossSpawned) {
    game.bossSpawned = true;
    const side = Math.floor(Math.random() * 4);
    let x = game.camera.x + width / 2;
    let y = game.camera.y + height / 2;
    if (side === 0) y = game.camera.y - 30;
    if (side === 1) x = game.camera.x + width + 30;
    if (side === 2) y = game.camera.y + height + 30;
    if (side === 3) x = game.camera.x - 30;
    x = Math.max(32, Math.min(game.worldWidth - 32, x));
    y = Math.max(90, Math.min(game.worldHeight - 32, y));
    game.enemies.push(applyCurrentEnemyBuff({ x, y, type: 'boss', radius: 30, health: 300, maxHealth: 300, speed: 30, boss: true, experience: 0, facing: 1, specialTimer: 2.2, dashTimer: 0 }));
    trackEnemySeen('boss');
    return;
  }
  if (game.enemies.length >= 24) return;
  const side = Math.floor(Math.random() * 4);
  const margin = 24;
  let x = game.camera.x + Math.random() * width;
  let y = game.camera.y + Math.random() * height;
  if (side === 0) y = game.camera.y - margin;
  if (side === 1) x = game.camera.x + width + margin;
  if (side === 2) y = game.camera.y + height + margin;
  if (side === 3) x = game.camera.x - margin;
  x = Math.max(20, Math.min(game.worldWidth - 20, x));
  y = Math.max(20, Math.min(game.worldHeight - 20, y));
  const wave = game.wave;
  const roll = Math.random();
  const type = wave >= 4 && roll < 0.12 ? 'ape'
    : wave >= 3 && roll < 0.28 ? 'stalker'
      : wave >= 5 && roll < 0.45 ? 'elite'
        : wave >= 3 && roll < 0.62 ? 'brute'
          : wave >= 2 && roll < 0.78 ? 'runner' : 'basic';
  const stats = {
    basic: { radius: 12, health: 10, speed: 42, experience: 1, damage: 10 },
    runner: { radius: 10, health: 7, speed: 72, experience: 1, damage: 9 },
    brute: { radius: 16, health: 24, speed: 31, experience: 2, damage: 13 },
    elite: { radius: 19, health: 42, speed: 45, experience: 3, damage: 14 },
    ape: { radius: 22, health: 58, speed: 30, experience: 4, damage: 17 },
    stalker: { radius: 14, health: 20, speed: 88, experience: 2, damage: 12 },
  }[type];
  const healthScale = 1 + (wave - 1) * 0.16;
  const maxHealth = Math.round(stats.health * healthScale);
  game.enemies.push(applyCurrentEnemyBuff({ x, y, ...stats, type, health: maxHealth, maxHealth, speed: stats.speed + Math.random() * 8, facing: 1 }));
  trackEnemySeen(type);
}

function trackEnemySeen(type) {
  if (!enemyCatalog.some((enemy) => enemy.id === type)) return;
  if (!game.seenEnemies.includes(type)) game.seenEnemies.push(type);
}

function startRandomEvent() {
  game.eventSerial += 1;
  const angle = Math.random() * Math.PI * 2;
  const distance = 210 + Math.random() * 100;
  const event = { x: Math.max(70, Math.min(game.worldWidth - 70, game.player.x + Math.cos(angle) * distance)), y: Math.max(100, Math.min(game.worldHeight - 70, game.player.y + Math.sin(angle) * distance)), timer: 30, progress: 0, kills: 0, items: [], serial: game.eventSerial };
  const choice = Math.floor(Math.random() * 3);
  if (choice === 0) {
    event.type = 'garden'; event.timer = 28; event.goal = 10;
    game.plantNotice = { text: '随机事件：守护花圃，靠近地图标记', life: 3.5 };
  } else if (choice === 1) {
    event.type = 'harvest'; event.timer = 30; event.goal = 4;
    for (let index = 0; index < event.goal; index += 1) {
      const itemAngle = index * Math.PI / 2 + Math.random() * 0.5;
      event.items.push({ x: event.x + Math.cos(itemAngle) * 62, y: event.y + Math.sin(itemAngle) * 62 });
    }
    game.plantNotice = { text: '随机事件：限时采集 4 株小花', life: 3.5 };
  } else {
    event.type = 'ambush'; event.timer = 35; event.goal = 2;
    for (let index = 0; index < event.goal; index += 1) {
      const type = index === 0 ? 'ape' : 'stalker';
      const stats = type === 'ape'
        ? { radius: 22, health: 58, speed: 30, experience: 4, damage: 17 }
        : { radius: 14, health: 20, speed: 88, experience: 2, damage: 12 };
      const enemy = applyCurrentEnemyBuff({ ...stats, x: event.x + (index ? 44 : -44), y: event.y, type, health: stats.health, maxHealth: stats.health, facing: 1, eventSerial: event.serial });
      game.enemies.push(enemy); trackEnemySeen(type);
    }
    game.plantNotice = { text: '随机事件：精英怪突袭，击败两名敌人', life: 3.5 };
  }
  game.event = event;
  game.nextEventAt = game.elapsed + 58 + Math.random() * 20;
}

function finishRandomEvent(success) {
  if (!game.event) return;
  game.plantNotice = { text: success ? '事件完成！种子 +6' : '事件结束，未完成目标', life: 3 };
  if (success) game.seedsEarned += 6;
  game.event = null;
}

function updateRandomEvent(delta) {
  if (!game.event) {
    if (!game.victoryPending && game.elapsed >= game.nextEventAt) startRandomEvent();
    return;
  }
  const event = game.event;
  event.timer -= delta;
  if (event.type === 'garden' && distanceBetween(game.player, event) < 78) event.progress += delta;
  if (event.type === 'harvest') {
    for (let index = event.items.length - 1; index >= 0; index -= 1) {
      if (distanceBetween(game.player, event.items[index]) < game.player.radius + 18) event.items.splice(index, 1);
    }
    event.progress = event.goal - event.items.length;
  }
  if (event.type === 'ambush') event.progress = event.kills;
  if (event.progress >= event.goal) finishRandomEvent(true);
  else if (event.timer <= 0) finishRandomEvent(false);
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function updateGame(delta) {
  game.elapsed += delta;
  const nextWave = Math.min(6, Math.floor(game.elapsed / 30) + 1);
  if (nextWave !== game.wave) {
    if (game.wave < 6) {
      const complete = game.waveKills >= game.waveGoal;
      if (complete) game.seedsEarned += 2;
      game.plantNotice = { text: complete ? `第 ${game.wave} 波挑战完成 · 种子 +2` : `第 ${game.wave} 波挑战未完成`, life: 3 };
    }
    game.waveKills = 0;
    game.waveGoal = nextWave < 6 ? 4 + nextWave : 0;
    game.waveNotice = 2.4;
  }
  game.wave = nextWave;
  game.waveNotice = Math.max(0, game.waveNotice - delta);
  game.spawnTimer -= delta;
  game.damageCooldown -= delta;
  game.dashCooldown = Math.max(0, game.dashCooldown - delta);
  game.lightningCooldown = Math.max(0, game.lightningCooldown - delta);
  for (const number of game.damageNumbers) {
    number.life -= delta;
    number.y -= 28 * delta;
  }

  game.damageNumbers = game.damageNumbers.filter((number) => number.life > 0);
  for (const particle of game.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);

  const player = game.player;
  if (game.input.x < -0.05) game.facing = -1;
  else if (game.input.x > 0.05) game.facing = 1;
  if (game.dashTimer > 0) {
    player.x += game.dashX * game.moveSpeed * 4.2 * delta;
    player.y += game.dashY * game.moveSpeed * 4.2 * delta;
    game.dashTimer = Math.max(0, game.dashTimer - delta);
  } else {
    player.x += game.input.x * game.moveSpeed * delta;
    player.y += game.input.y * game.moveSpeed * delta;
  }
  player.x = Math.max(player.radius, Math.min(game.worldWidth - player.radius, player.x));
  player.y = Math.max(72 + player.radius, Math.min(game.worldHeight - player.radius, player.y));
  updateCamera();

  if (!game.victoryPending && game.spawnTimer <= 0) {
    spawnEnemy();
    game.spawnTimer = Math.max(0.58, 1.05 - (game.wave - 1) * 0.12);
  }

  if (game.character === 'rabbit') {
    game.fireTimer -= delta;
    const target = game.enemies.reduce((nearest, enemy) => {
      if (!isEnemyVisible(enemy)) return nearest;
      const distance = distanceBetween(enemy, player);
      return distance <= 480 && (!nearest || distance < nearest.distance) ? { enemy, distance } : nearest;
    }, null);
    if (target && game.fireTimer <= 0 && !game.victoryPending) {
      const count = Math.min(8, game.projectileCount);
      const aimAngle = Math.atan2(target.enemy.y - player.y, target.enemy.x - player.x);
      const scatter = game.weaponEvolution === 'scatter';
      for (let index = 0; index < count; index += 1) {
        const offset = (index - (count - 1) / 2) * 7;
        const spreadAngle = scatter ? (index - (count - 1) / 2) * 0.18 : 0;
        const angle = aimAngle + spreadAngle;
        const perpendicularX = -Math.sin(aimAngle) * offset;
        const perpendicularY = Math.cos(aimAngle) * offset;
        game.bullets.push({
          x: player.x + Math.cos(aimAngle) * 24 + perpendicularX,
          y: player.y + Math.sin(aimAngle) * 24 + perpendicularY,
          vx: Math.cos(angle) * game.projectileSpeed,
          vy: Math.sin(angle) * game.projectileSpeed,
          trajectory: 'track', damage: game.baseAttack + game.bonusAttack + game.bulletDamage,
          speed: game.projectileSpeed, piercesLeft: game.projectilePierce,
          explosive: game.weaponEvolution === 'explosion', hitEnemies: [],
        });
      }
      game.fireTimer = game.fireInterval;
      burstParticles(player.x + Math.cos(aimAngle) * 25, player.y + Math.sin(aimAngle) * 25, '#ffd65b', 2);
    }
    for (const bullet of game.bullets) {
      const nextTarget = game.enemies.reduce((nearest, enemy) => {
        if (!isEnemyVisible(enemy) || bullet.hitEnemies.includes(enemy)) return nearest;
        const distance = distanceBetween(enemy, bullet);
        return distance < 560 && (!nearest || distance < nearest.distance) ? { enemy, distance } : nearest;
      }, null);
      if (!nextTarget) { bullet.life = 0; continue; }
      const dx = nextTarget.enemy.x - bullet.x;
      const dy = nextTarget.enemy.y - bullet.y;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const turn = Math.min(1, delta * 5);
      bullet.vx += (dx / length * bullet.speed - bullet.vx) * turn;
      bullet.vy += (dy / length * bullet.speed - bullet.vy) * turn;
      bullet.previous = { x: bullet.x, y: bullet.y };
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life = (bullet.life === undefined ? 2.8 : bullet.life - delta);
    }
    game.bullets = game.bullets.filter((bullet) => bullet.life > 0);
  }

  for (const enemy of game.enemies) {
    if (enemy.health <= 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (enemy.boss && enemy.dashTimer > 0 && Math.abs(enemy.dashX) > 0.05) enemy.facing = enemy.dashX < 0 ? -1 : 1;
    else if (Math.abs(dx) > 0.05) enemy.facing = dx < 0 ? -1 : 1;
    if (enemy.boss) {
      enemy.specialTimer -= delta;
      if (enemy.dashTimer > 0) {
        enemy.x += enemy.dashX * 145 * delta;
        enemy.y += enemy.dashY * 145 * delta;
        enemy.dashTimer -= delta;
      } else if (enemy.specialTimer <= 0 && distance > 0) {
        enemy.dashX = dx / distance;
        enemy.dashY = dy / distance;
        enemy.dashTimer = 0.55;
        enemy.specialTimer = 3.2;
      } else if (distance > 0) {
        enemy.x += dx / distance * enemy.speed * delta;
        enemy.y += dy / distance * enemy.speed * delta;
      }
    } else if (distance > 0) {
      enemy.x += dx / distance * enemy.speed * delta;
      enemy.y += dy / distance * enemy.speed * delta;
    }
    enemy.x = Math.max(enemy.radius, Math.min(game.worldWidth - enemy.radius, enemy.x));
    enemy.y = Math.max(enemy.radius, Math.min(game.worldHeight - enemy.radius, enemy.y));
    if (distance < player.radius + enemy.radius && game.damageCooldown <= 0 && game.dashTimer <= 0) {
      game.health -= Math.max(1, (enemy.damage || (enemy.boss ? 16 : 10)) - game.damageReduction);
      game.damageCooldown = 0.65;
      burstParticles(player.x, player.y - 10, '#f17a62', 7);
      playSound('hurt', 500);
    }
  }

  const sticks = game.character === 'supreme' ? getOrbitSticks() : [];
  for (let enemyIndex = game.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = game.enemies[enemyIndex];
    enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - delta);
    enemy.dashHitCooldown = Math.max(0, (enemy.dashHitCooldown || 0) - delta);
    if (game.dashTimer > 0 && enemy.dashHitCooldown <= 0 && distanceBetween(enemy, player) < enemy.radius + player.radius + 12) {
      const dashDamage = game.baseAttack + game.bonusAttack + 3 + game.orbitStickCount + game.dashBonusDamage;
      enemy.health -= dashDamage;
      enemy.dashHitCooldown = 0.35;
      enemy.hitFlash = 0.16;
      game.damageNumbers.push({ x: enemy.x, y: enemy.y - 18, value: dashDamage, life: 0.65 });
      burstParticles(enemy.x, enemy.y, '#8fe6e9', 7);
      playSound('hit', 120);
    }
    if (!enemy.orbitCooldowns) enemy.orbitCooldowns = [];
    let hitDamage = 0;
    if (game.character === 'rabbit') {
      for (let bulletIndex = game.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
        const bullet = game.bullets[bulletIndex];
        const bulletDistance = bullet.previous ? distanceToSegment(enemy, bullet.previous, bullet) : distanceBetween(bullet, enemy);
        if (!isEnemyVisible(enemy) || bullet.hitEnemies.includes(enemy) || bulletDistance > enemy.radius + 7) continue;
        enemy.health -= bullet.damage;
        hitDamage += bullet.damage;
        bullet.hitEnemies.push(enemy);
        if (bullet.explosive) {
          for (const nearby of game.enemies) {
            if (nearby === enemy || !isEnemyVisible(nearby) || distanceBetween(nearby, enemy) > 76) continue;
            const splashDamage = Math.max(1, Math.floor(bullet.damage * 0.65));
            nearby.health -= splashDamage;
            nearby.hitFlash = 0.16;
            game.damageNumbers.push({ x: nearby.x, y: nearby.y - 18, value: splashDamage, life: 0.65 });
          }
          burstParticles(enemy.x, enemy.y, '#ff984c', 14);
          bullet.piercesLeft = 0;
        } else if (game.weaponEvolution === 'chain') {
          burstParticles(enemy.x, enemy.y, '#71e5ff', 8);
        }
        burstParticles(bullet.x, bullet.y, '#ffe16b', 4);
        if (bullet.piercesLeft > 0) bullet.piercesLeft -= 1;
        else game.bullets.splice(bulletIndex, 1);
        if (enemy.health <= 0) break;
      }
    }
    for (let stickIndex = 0; stickIndex < sticks.length; stickIndex += 1) {
      enemy.orbitCooldowns[stickIndex] = Math.max(0, (enemy.orbitCooldowns[stickIndex] || 0) - delta);
      if (enemy.orbitCooldowns[stickIndex] <= 0 && distanceToStick(enemy, sticks[stickIndex]) < enemy.radius + stickHeight / 2 + 4) {
        const damage = game.baseAttack + game.bonusAttack;
        enemy.health -= damage;
        hitDamage += damage;
        enemy.orbitCooldowns[stickIndex] = 0.22;
        if (game.weaponEvolution === 'lightning' && game.lightningCooldown <= 0) {
          game.lightningCooldown = 0.7;
          for (const nearby of game.enemies) {
            if (nearby === enemy || distanceBetween(nearby, enemy) > 92) continue;
            const lightningDamage = 3 + game.bonusAttack;
            nearby.health -= lightningDamage;
            nearby.hitFlash = 0.16;
            game.damageNumbers.push({ x: nearby.x, y: nearby.y - 18, value: lightningDamage, life: 0.65 });
          }
          burstParticles(enemy.x, enemy.y, '#73e8ff', 10);
        }
        if (enemy.health <= 0) break;
      }
    }
    if (hitDamage > 0) {
      enemy.hitFlash = 0.16;
      game.damageNumbers.push({ x: enemy.x, y: enemy.y - 18, value: hitDamage, life: 0.65 });
      burstParticles(enemy.x, enemy.y, '#ffd66b', 3);
      playSound('hit', 180);
    }
    if (enemy.health <= 0) {
      game.enemies.splice(enemyIndex, 1);
      game.kills += 1;
      if (!enemy.boss) game.waveKills += 1;
      game.enemyKills[enemy.type] = (game.enemyKills[enemy.type] || 0) + 1;
      if (enemy.eventSerial && game.event && enemy.eventSerial === game.event.serial) game.event.kills += 1;
      if (enemy.boss) {
        burstParticles(enemy.x, enemy.y, '#f5d26e', 20);
        game.enemies.length = 0;
        if (Math.random() < 0.3 && spawnPlantDrop(enemy.x, enemy.y, 'red-hidden', true)) {
          game.victoryPending = true;
          game.victoryTimer = 12;
          game.plantNotice = { text: '隐藏植物出现！查看小地图高亮', life: 4 };
        } else finishGame(true);
        return;
      }
      burstParticles(enemy.x, enemy.y, '#f0b96b', 8);
      game.orbs.push({ x: enemy.x, y: enemy.y, value: enemy.experience, seeds: gardenProjects.find((item) => item.id === 'flower').buff(profile.garden.flower) });
    }
  }

  for (let index = game.orbs.length - 1; index >= 0; index -= 1) {
    const orb = game.orbs[index];
    const distance = distanceBetween(orb, player);
    if (distance < game.pickupRange + 64 && distance > 0) {
      orb.x += (player.x - orb.x) / distance * 150 * delta;
      orb.y += (player.y - orb.y) / distance * 150 * delta;
    }
    if (distance < game.pickupRange) {
      game.orbs.splice(index, 1);
      game.experience += orb.value;
      game.seedsEarned += orb.seeds || 0;
      burstParticles(orb.x, orb.y, '#ffe27a', 5);
      playSound('pickup', 120);
      if (game.experience >= game.experienceNeeded) {
        game.experience -= game.experienceNeeded;
        game.level += 1;
        game.baseAttack += 1;
        game.experienceNeeded = 4 + game.level * 2;
        game.upgradeChoices = chooseUpgrades();
        screen = 'upgrade';
        playSound('levelup', 450);
        break;
      }
    }
  }

  updateRandomEvent(delta);
  if (updatePlantDrops(delta)) return;
  if (game.victoryPending) {
    game.victoryTimer -= delta;
    if (game.victoryTimer <= 0) finishGame(true);
    return;
  }

  if (game.health <= 0) {
    game.health = 0;
    finishGame(false);
  }
}

function getOrbitSticks() {
  const sticks = [];
  for (let index = 0; index < game.orbitStickCount; index += 1) {
    const angle = game.elapsed * game.orbitSpeed + index * Math.PI * 2 / game.orbitStickCount;
    sticks.push({
      x: game.player.x + Math.cos(angle) * game.orbitRadius,
      y: game.player.y + Math.sin(angle) * game.orbitRadius,
      angle,
    });
  }
  return sticks;
}

function distanceToStick(point, stick) {
  const directionX = Math.cos(stick.angle) * game.stickHitHalfLength;
  const directionY = Math.sin(stick.angle) * game.stickHitHalfLength;
  const startX = stick.x - directionX;
  const startY = stick.y - directionY;
  const segmentX = directionX * 2;
  const segmentY = directionY * 2;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = Math.max(0, Math.min(1, ((point.x - startX) * segmentX + (point.y - startY) * segmentY) / segmentLengthSquared));
  const closestPoint = { x: startX + segmentX * projection, y: startY + segmentY * projection };
  return distanceBetween(point, closestPoint);
}

function distanceToSegment(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (!segmentLengthSquared) return distanceBetween(point, start);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared));
  return distanceBetween(point, { x: start.x + segmentX * projection, y: start.y + segmentY * projection });
}

function chooseUpgrades() {
  const options = (game.character === 'rabbit'
    ? rabbitUpgrades.concat(upgrades.filter((upgrade) => ['轻便鞋子', '收集袋', '急救包', '坚韧外衣', '疾风步'].includes(upgrade.title)))
    : upgrades).slice();
  if (!game.weaponEvolution && game.character === 'rabbit') {
    if (game.projectileCount >= 2) options.push({ title: '武器进化：散射弹', description: '子弹改为扇形齐射，攻击范围更广', rarity: 'gold', apply: () => { game.weaponEvolution = 'scatter'; game.projectileCount = Math.max(3, game.projectileCount); } });
    if (game.bulletDamage >= 2) options.push({ title: '武器进化：爆裂弹', description: '命中后爆炸，对周围敌人造成伤害', rarity: 'gold', apply: () => { game.weaponEvolution = 'explosion'; game.bulletDamage += 2; } });
    if (game.projectilePierce >= 1) options.push({ title: '武器进化：连锁弹', description: '子弹穿透并跳向其他敌人', rarity: 'gold', apply: () => { game.weaponEvolution = 'chain'; game.projectilePierce = Math.max(2, game.projectilePierce); } });
  } else if (!game.weaponEvolution && game.character === 'supreme' && (game.orbitStickCount >= 2 || game.level >= 5)) {
    options.push({ title: '武器进化：雷电棍', description: '棍子命中时向附近敌人释放闪电', rarity: 'gold', apply: () => { game.weaponEvolution = 'lightning'; } });
  }

  const chosen = [];
  const takeRandom = (rarity) => {
    const candidates = options.filter((upgrade) => !rarity || upgrade.rarity === rarity);
    if (!candidates.length) return false;
    const upgrade = candidates[Math.floor(Math.random() * candidates.length)];
    chosen.push(upgrade);
    options.splice(options.indexOf(upgrade), 1);
    return true;
  };
  const guaranteedRarity = game.level % 10 === 0 ? 'gold' : game.level % 5 === 0 ? 'purple' : null;
  if (guaranteedRarity) takeRandom(guaranteedRarity);

  while (chosen.length < 3 && options.length) {
    const availableRarities = [...new Set(options.map((upgrade) => upgrade.rarity))];
    const totalWeight = availableRarities.reduce((sum, rarity) => sum + skillRarity[rarity].weight, 0);
    let roll = Math.random() * totalWeight;
    let rarity = availableRarities[availableRarities.length - 1];
    for (const candidate of availableRarities) {
      roll -= skillRarity[candidate].weight;
      if (roll < 0) { rarity = candidate; break; }
    }
    takeRandom(rarity);
  }
  return chosen;
}

function drawGameBackground() {
  const tileSize = 150;
  const firstColumn = Math.floor(game.camera.x / tileSize);
  const lastColumn = Math.ceil((game.camera.x + width) / tileSize);
  const firstRow = Math.floor(game.camera.y / tileSize);
  const lastRow = Math.ceil((game.camera.y + height) / tileSize);
  context.fillStyle = '#a8cf79';
  context.fillRect(0, 0, width, height);
  const shades = ['#a8cf79', '#a3ca73', '#afd27e', '#9fc66f'];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const shadeIndex = Math.abs((row * 7 + column * 13) % shades.length);
      const tileX = column * tileSize - game.camera.x;
      const tileY = row * tileSize - game.camera.y;
      context.fillStyle = shades[shadeIndex];
      context.fillRect(tileX, tileY, tileSize, tileSize);
      context.fillStyle = 'rgba(245, 255, 206, 0.28)';
      context.fillRect(tileX + 24, tileY + 35, 3, 10);
      context.fillRect(tileX + 102, tileY + 112, 3, 9);
      context.fillStyle = 'rgba(61, 116, 53, 0.2)';
      context.fillRect(tileX + 70, tileY + 55, 3, 12);
      context.fillRect(tileX + 126, tileY + 24, 3, 8);
    }
  }
}

function drawLandmark(landmark) {
  const x = landmark.x - game.camera.x;
  const y = landmark.y - game.camera.y;
  const size = landmark.size;
  if (x < -size * 3 || x > width + size * 3 || y < -size * 3 || y > height + size * 3) return;

  if (landmark.type === 'pond') {
    context.beginPath();
    context.fillStyle = '#5caeb0';
    context.ellipse(x, y, size * 1.7, size, -0.18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(234, 255, 225, 0.75)';
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(x - size * 0.2, y - size * 0.1, size * 0.9, size * 0.35, -0.18, 0, Math.PI * 2);
    context.stroke();
  } else if (landmark.type === 'flowers') {
    for (let index = 0; index < 7; index += 1) {
      const angle = index * Math.PI * 2 / 7;
      const flowerX = x + Math.cos(angle) * size;
      const flowerY = y + Math.sin(angle) * size * 0.65;
      context.fillStyle = index % 2 ? '#f5e7a2' : '#f2b0a0';
      context.beginPath();
      context.arc(flowerX, flowerY, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e7b94f';
      context.beginPath();
      context.arc(flowerX, flowerY, 2, 0, Math.PI * 2);
      context.fill();
    }
  } else if (landmark.type === 'rocks') {
    context.fillStyle = '#7c8b79';
    context.beginPath();
    context.ellipse(x - size * 0.45, y + 3, size * 0.7, size * 0.48, -0.2, 0, Math.PI * 2);
    context.ellipse(x + size * 0.35, y - 3, size * 0.55, size * 0.38, 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(242, 248, 218, 0.42)';
    context.fillRect(x - size * 0.55, y - 5, size * 0.45, 3);
  } else if (landmark.type === 'bush') {
    context.fillStyle = '#548b4c';
    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.arc(x + (index - 1.5) * size * 0.48, y + (index % 2) * 5, size * 0.58, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#8dbf62';
    context.beginPath();
    context.arc(x - size * 0.45, y - size * 0.15, size * 0.22, 0, Math.PI * 2);
    context.arc(x + size * 0.38, y - size * 0.18, size * 0.2, 0, Math.PI * 2);
    context.fill();
  } else if (landmark.type === 'stump') {
    context.fillStyle = '#8d6743';
    context.beginPath();
    context.ellipse(x, y + 4, size * 0.7, size * 0.52, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d2ad76';
    context.beginPath();
    context.ellipse(x, y, size * 0.62, size * 0.4, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#9a774c';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(x, y, size * 0.34, size * 0.2, 0, 0, Math.PI * 2);
    context.stroke();
  } else {
    context.fillStyle = '#c3b28a';
    for (let index = 0; index < 4; index += 1) {
      context.fillRect(x + (index % 2) * size * 0.65, y + Math.floor(index / 2) * size * 0.55, size * 0.48, size * 0.36);
    }
  }
}

function drawBar(x, y, barWidth, barHeight, value, maxValue, color) {
  context.fillStyle = 'rgba(31, 57, 35, 0.28)';
  roundedRect(x, y, barWidth, barHeight, barHeight / 2);
  const fillWidth = barWidth * Math.max(0, Math.min(1, value / maxValue));
  if (fillWidth > 0) {
    context.fillStyle = color;
    roundedRect(x, y, fillWidth, barHeight, barHeight / 2);
  }
}

function drawMiniMap() {
  const miniHeight = Math.min(150, height * 0.22);
  const ratio = game.worldWidth / game.worldHeight;
  const miniWidth = Math.min(120, miniHeight * ratio);
  const x = width - miniWidth - 12; const y = 112;
  context.fillStyle = 'rgba(37, 62, 39, 0.84)'; context.beginPath();
  if (context.roundRect) context.roundRect(x, y, miniWidth, miniHeight, 9); else context.rect(x, y, miniWidth, miniHeight);
  context.fill(); context.save(); context.beginPath();
  if (context.roundRect) context.roundRect(x + 3, y + 3, miniWidth - 6, miniHeight - 6, 7); else context.rect(x + 3, y + 3, miniWidth - 6, miniHeight - 6);
  context.clip(); context.fillStyle = '#87ae66'; context.fillRect(x + 3, y + 3, miniWidth - 6, miniHeight - 6);
  const px = (worldX, worldY) => ({ x: x + 3 + worldX / game.worldWidth * (miniWidth - 6), y: y + 3 + worldY / game.worldHeight * (miniHeight - 6) });
  for (const decoration of game.gardenDecorations) {
    const p = px(decoration.x, decoration.y); context.fillStyle = '#d5c083'; context.fillRect(p.x - 1.4, p.y - 1.4, 3, 3);
  }
  if (game.event) {
    const p = px(game.event.x, game.event.y); context.fillStyle = '#ff6d58'; context.beginPath(); context.arc(p.x, p.y, 4, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#fff0a8'; context.lineWidth = 1.5; context.beginPath(); context.arc(p.x, p.y, 7 + Math.sin(game.elapsed * 6) * 2, 0, Math.PI * 2); context.stroke();
    for (const item of game.event.items) { const point = px(item.x, item.y); context.fillStyle = '#ffe26d'; context.fillRect(point.x - 1.5, point.y - 1.5, 3, 3); }
  }
  for (const drop of game.plants) {
    const p = px(drop.x, drop.y); const plant = plantCatalog.find((item) => item.id === drop.id);
    const pulse = 2.5 + (Math.sin(game.elapsed * 5 + drop.phase) + 1) * 2.5;
    context.strokeStyle = plantColors[plant.rarity]; context.lineWidth = 1.5; context.beginPath(); context.arc(p.x, p.y, pulse, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#fff8ce'; context.beginPath(); context.arc(p.x, p.y, 2.1, 0, Math.PI * 2); context.fill();
  }
  const player = px(game.player.x, game.player.y); context.fillStyle = '#fff'; context.beginPath(); context.arc(player.x, player.y, 3.2, 0, Math.PI * 2); context.fill();
  context.restore(); context.strokeStyle = '#fff2c8'; context.lineWidth = 1.5; context.beginPath();
  if (context.roundRect) context.roundRect(x, y, miniWidth, miniHeight, 9); else context.rect(x, y, miniWidth, miniHeight);
  context.stroke(); context.textAlign = 'center'; context.fillStyle = '#fff7d9'; context.font = 'bold 10px sans-serif';
  context.fillText(`地图 · 宝物 ${game.plants.length}`, x + miniWidth / 2, y + miniHeight - 5);
}

function drawGame() {
  drawGameBackground();

  for (const landmark of game.landmarks) drawLandmark(landmark);
  for (const decoration of game.gardenDecorations) {
    const x = decoration.x - game.camera.x; const y = decoration.y - game.camera.y;
    if (x > -40 && x < width + 40 && y > -40 && y < height + 40) drawGardenDecorationIcon(decoration.id, decoration.level, x, y, 0.85);
  }

  if (game.event) {
    const eventX = game.event.x - game.camera.x; const eventY = game.event.y - game.camera.y;
    context.strokeStyle = 'rgba(255, 237, 125, 0.8)'; context.lineWidth = 3; context.beginPath(); context.arc(eventX, eventY, 78, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#fff2ad'; context.beginPath(); context.arc(eventX, eventY, 7, 0, Math.PI * 2); context.fill();
    for (const item of game.event.items) { context.fillStyle = '#ffda54'; context.beginPath(); context.arc(item.x - game.camera.x, item.y - game.camera.y, 7, 0, Math.PI * 2); context.fill(); }
  }

  for (const orb of game.orbs) {
    const orbX = orb.x - game.camera.x;
    const orbY = orb.y - game.camera.y;
    if (dropReady) {
      context.fillStyle = 'rgba(255, 230, 143, 0.78)'; context.beginPath(); context.arc(orbX, orbY, 21, 0, Math.PI * 2); context.fill();
      context.drawImage(dropSprite, orbX - 19, orbY - 19, 38, 38);
      context.strokeStyle = '#e9b84f'; context.lineWidth = 2; context.beginPath(); context.arc(orbX, orbY, 20, 0, Math.PI * 2); context.stroke();
    } else { context.beginPath(); context.fillStyle = '#ffd45a'; context.arc(orbX, orbY, 11, 0, Math.PI * 2); context.fill(); }
  }

  for (const drop of game.plants) {
    const plant = plantCatalog.find((item) => item.id === drop.id);
    const plantX = drop.x - game.camera.x; const plantY = drop.y - game.camera.y + Math.sin(drop.phase) * 3;
    context.strokeStyle = plantColors[plant.rarity]; context.lineWidth = 2; context.beginPath();
    context.arc(plantX, plantY, 15 + (Math.sin(drop.phase * 1.7) + 1) * 2, 0, Math.PI * 2); context.stroke();
    drawPlantIcon(plant, plantX, plantY, 12, (Math.sin(drop.phase) + 1) * 0.5);
  }

  for (const enemy of game.enemies) {
    const enemyX = enemy.x - game.camera.x;
    const enemyY = enemy.y - game.camera.y + (enemy.boss ? 0 : Math.sin(game.elapsed * 8 + enemy.x * 0.01) * 1.5);
    const enemySpriteForType = getEnemySprite(enemy.type);
    const spriteReady = isEnemySpriteReady(enemy.type);
    if (!spriteReady) {
      context.beginPath();
      context.fillStyle = enemy.hitFlash > 0 ? '#fff0a6'
        : enemy.boss ? '#764b82'
          : enemy.type === 'runner' ? '#c77742'
            : enemy.type === 'brute' ? '#735843'
              : enemy.type === 'elite' ? '#9d4655' : '#a45b42';
      context.arc(enemyX, enemyY, enemy.radius, 0, Math.PI * 2);
      context.fill();
    }
    if (enemy.boss && !bossReady) {
      context.strokeStyle = '#ffd66b';
      context.lineWidth = 4;
      context.stroke();
      context.fillStyle = '#f4d071';
      context.beginPath();
      context.moveTo(enemyX - 22, enemyY - 19);
      context.lineTo(enemyX - 17, enemyY - 35);
      context.lineTo(enemyX - 7, enemyY - 22);
      context.moveTo(enemyX + 22, enemyY - 19);
      context.lineTo(enemyX + 17, enemyY - 35);
      context.lineTo(enemyX + 7, enemyY - 22);
      context.fill();
      context.fillStyle = '#fff4d2';
      context.fillRect(enemyX - 12, enemyY - 5, 7, 8);
      context.fillRect(enemyX + 5, enemyY - 5, 7, 8);
      context.fillStyle = '#563a2f';
      context.fillRect(enemyX - 10, enemyY - 3, 3, 5);
      context.fillRect(enemyX + 7, enemyY - 3, 3, 5);
    } else if (enemy.boss) {
      drawFacingSprite(bossSprite, enemyX, enemyY - 2, 110, 140, enemy.facing || 1, enemy.hitFlash > 0 ? 0.72 : 1);
    } else if (spriteReady) {
      const spriteHeight = enemy.radius * (enemy.type === 'runner' ? 2.8 : 3.05);
      const spriteWidth = spriteHeight * enemySpriteForType.width / enemySpriteForType.height;
      drawFacingSprite(enemySpriteForType, enemyX, enemyY - spriteHeight * 0.32, spriteWidth, spriteHeight, enemy.facing || 1, enemy.hitFlash > 0 ? 0.72 : 1);
    } else {
      context.fillStyle = '#fff4d2';
      context.fillRect(enemyX - 5, enemyY - 3, 3, 3);
      context.fillRect(enemyX + 2, enemyY - 3, 3, 3);
    }
    if (enemy.boss) {
      context.textAlign = 'center';
      context.fillStyle = '#fff4d2';
      context.font = 'bold 11px sans-serif';
      context.fillText('首领', enemyX, enemyY - (bossReady ? 88 : enemy.radius + 15));
    }
    if (enemy.health < enemy.maxHealth) {
      const spriteHeight = enemy.boss ? 140 : enemy.radius * (enemy.type === 'runner' ? 2.8 : 3.05);
      const hasSprite = enemy.boss ? bossReady : spriteReady;
      const barY = enemyY - (hasSprite ? spriteHeight * 0.82 : enemy.radius) - 9;
      const barWidth = enemy.boss ? 84 : Math.max(30, enemy.radius * 2);
      drawBar(enemyX - barWidth / 2, barY, barWidth, enemy.boss ? 6 : 4, enemy.health, enemy.maxHealth, '#d7564e');
    }
  }

  for (const number of game.damageNumbers) {
    const alpha = Math.max(0, number.life / 0.65);
    context.save();
    context.globalAlpha = alpha;
    context.textAlign = 'center';
    context.font = 'bold 14px sans-serif';
    context.lineWidth = 3;
    context.strokeStyle = '#563a2f';
    context.strokeText(`-${number.value}`, number.x - game.camera.x, number.y - game.camera.y);
    context.fillStyle = '#fff6d0';
    context.fillText(`-${number.value}`, number.x - game.camera.x, number.y - game.camera.y);
    context.restore();
  }

  for (const bullet of game.bullets) {
    const x = bullet.x - game.camera.x;
    const y = bullet.y - game.camera.y;
    context.fillStyle = '#fff4a8';
    context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(255, 157, 52, 0.85)'; context.lineWidth = 2;
    context.beginPath(); context.arc(x, y, 7, 0, Math.PI * 2); context.stroke();
  }

  for (const particle of game.particles) {
    context.save();
    context.globalAlpha = Math.max(0, particle.life / 0.46);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x - game.camera.x, particle.y - game.camera.y, 2.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (const stick of (game.character === 'supreme' ? getOrbitSticks() : [])) {
    context.save();
    context.translate(stick.x - game.camera.x, stick.y - game.camera.y);
    context.rotate(stick.angle);
    if (stickReady) context.drawImage(stickSprite, -stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
    else {
      context.fillStyle = '#57bde5';
      roundedRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight, stickHeight / 2);
    }
    context.restore();
  }

  const playerX = game.player.x - game.camera.x;
  const playerY = game.player.y - game.camera.y;
  const isMoving = Math.abs(game.input.x) + Math.abs(game.input.y) > 0.08;
  const stepBob = isMoving ? Math.sin(game.elapsed * 16) * 2 : 0;
  if (game.dashTimer > 0) {
    context.strokeStyle = 'rgba(143, 230, 233, 0.85)'; context.lineWidth = 3; context.beginPath();
    context.arc(playerX, playerY, 34 + (0.22 - game.dashTimer) * 38, 0, Math.PI * 2); context.stroke();
  }
  if (isMoving && speedCloudReady) {
    context.save();
    context.translate(playerX, playerY + 9 + stepBob);
    context.scale(game.facing, 1);
    context.globalAlpha = 0.96;
    context.drawImage(speedCloudSprite, -52, -27, 104, 55);
    context.restore();
  }
  const activeSprite = game.character === 'rabbit' ? rabbitSprite : characterSprite;
  const activeSpriteReady = game.character === 'rabbit' ? rabbitReady : characterReady;
  if (activeSpriteReady) {
    const spriteWidth = game.character === 'rabbit' ? 112 : 88;
    const spriteHeight = game.character === 'rabbit' ? 126 : 76;
    drawFacingSprite(activeSprite, playerX, playerY - (game.character === 'rabbit' ? 48 : 29) + stepBob, spriteWidth, spriteHeight, game.facing, game.damageCooldown > 0 && game.dashTimer <= 0 ? 0.7 : 1);
    if (game.character === 'supreme') {
      context.save(); context.translate(playerX, playerY + stepBob); context.scale(game.facing, 1);
      drawAppearanceAccessory(profile.skin);
      context.restore();
    }
  } else {
    context.beginPath();
    context.fillStyle = '#f2d34b';
    context.arc(playerX, playerY, game.player.radius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = 'rgba(255, 250, 226, 0.92)';
  roundedRect(16, 18, width - 32, 84, 14);
  context.textAlign = 'left';
  context.fillStyle = '#315e37';
  context.font = 'bold 14px sans-serif';
  context.fillText('生命', 28, 42);
  drawBar(66, 31, Math.max(70, width * 0.35), 12, game.health, game.maxHealth, '#d76c54');
  context.textAlign = 'right';
  context.fillText(game.character === 'rabbit'
    ? `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack + game.bulletDamage} · 弹 ${game.projectileCount}`
    : `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack} · 棍 ${game.orbitStickCount}`, width - 28, 42);
  context.textAlign = 'left';
  context.font = 'bold 12px sans-serif';
  context.fillText(game.wave === 6 ? '首领战' : `波 ${game.wave} · 击杀 ${game.waveKills}/${game.waveGoal}`, 28, 66);
  context.textAlign = 'right';
  context.font = '12px sans-serif';
  context.fillText(`${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed) % 60).padStart(2, '0')}`, width - 28, 66);
  context.textAlign = 'center';
  context.fillStyle = '#9b7435';
  context.fillText(`种子 +${game.seedsEarned}`, width / 2, 66);
  drawBar(28, 78, width - 56, 8, game.experience, game.experienceNeeded, '#e9b84f');
  const currentEnemyBuff = getEnemyBuffMultipliers();
  context.textAlign = 'center'; context.fillStyle = '#a45b42'; context.font = '10px sans-serif';
  context.fillText(`怪物强化 速+${Math.round((currentEnemyBuff.speed - 1) * 100)}% · 伤+${Math.round((currentEnemyBuff.damage - 1) * 100)}% · 血+${Math.round((currentEnemyBuff.health - 1) * 100)}%`, width / 2, 99);
  settleButton = { x: 12, y: 108, width: 64, height: 30 };
  context.fillStyle = 'rgba(49, 94, 55, 0.92)'; roundedRect(settleButton.x, settleButton.y, settleButton.width, settleButton.height, 9);
  context.fillStyle = '#fff7d9'; context.font = 'bold 12px sans-serif'; context.textAlign = 'center'; context.fillText('暂停', settleButton.x + settleButton.width / 2, settleButton.y + 20);

  const boss = game.enemies.find((enemy) => enemy.boss);
  if (!boss && game.waveNotice > 0) {
    context.textAlign = 'center';
    context.fillStyle = 'rgba(49, 94, 55, 0.88)';
    roundedRect(width / 2 - 88, 112, 176, 38, 12);
    context.fillStyle = '#fff7d9';
    context.font = 'bold 16px sans-serif';
    context.fillText(`第 ${game.wave} 波`, width / 2, 137);
  }

  if (joystickTouchId !== null && joystickOrigin) {
    const joystick = joystickOrigin;
    context.beginPath();
    context.fillStyle = 'rgba(255, 250, 226, 0.38)';
    context.arc(joystick.x, joystick.y, joystick.radius, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = 'rgba(49, 94, 55, 0.48)';
    context.arc(joystick.x + game.input.x * joystick.radius * 0.55, joystick.y + game.input.y * joystick.radius * 0.55, joystick.radius * 0.42, 0, Math.PI * 2);
    context.fill();
  }

  const dashButton = dashButtonBounds();
  context.fillStyle = game.dashCooldown <= 0 ? 'rgba(49, 94, 55, 0.9)' : 'rgba(49, 94, 55, 0.62)';
  context.beginPath(); context.arc(dashButton.x, dashButton.y, dashButton.radius, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#fff7d9'; context.lineWidth = 2; context.beginPath();
  context.arc(dashButton.x, dashButton.y, dashButton.radius - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - game.dashCooldown / game.dashCooldownMax)); context.stroke();
  context.textAlign = 'center'; context.fillStyle = '#fff7d9'; context.font = 'bold 13px sans-serif';
  context.fillText(game.dashCooldown <= 0 ? '冲刺' : `${game.dashCooldown.toFixed(1)}s`, dashButton.x, dashButton.y + 5);
  if (game.plantNotice) {
    context.fillStyle = 'rgba(255, 250, 226, 0.93)'; roundedRect(width / 2 - Math.min(170, width * 0.43), height * 0.42, Math.min(340, width * 0.86), 40, 12);
    context.fillStyle = '#315e37'; context.font = 'bold 13px sans-serif'; context.textAlign = 'center';
    context.fillText(game.plantNotice.text, width / 2, height * 0.42 + 25);
  }
  if (game.event) {
    const title = game.event.type === 'garden' ? '守护花圃' : game.event.type === 'harvest' ? '限时采集' : '精英怪突袭';
    const progress = game.event.type === 'garden' ? `${Math.floor(game.event.progress)}/${game.event.goal} 秒` : `${game.event.progress}/${game.event.goal}`;
    context.fillStyle = 'rgba(49, 94, 55, 0.9)'; roundedRect(width / 2 - 106, height * 0.31, 212, 36, 11);
    context.fillStyle = '#fff7d9'; context.font = 'bold 12px sans-serif'; context.textAlign = 'center';
    context.fillText(`${title} ${progress} · ${Math.ceil(game.event.timer)}s`, width / 2, height * 0.31 + 23);
  }
  drawMiniMap();
}

function drawPause() {
  drawGame();
  context.fillStyle = 'rgba(24, 47, 29, 0.72)';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.fillStyle = '#fff7d9';
  context.font = 'bold 28px sans-serif';
  context.fillText('游戏暂停', width / 2, height * 0.34);
  [
    { y: height * 0.44, label: '继续游戏', color: '#477a3c' },
    { y: height * 0.55, label: '立马结算', color: '#b9654e' },
  ].forEach((button) => {
    context.fillStyle = button.color;
    roundedRect(width * 0.18, button.y, width * 0.64, 52, 14);
    context.fillStyle = '#fff7d9';
    context.font = 'bold 18px sans-serif';
    context.fillText(button.label, width / 2, button.y + 33);
  });
}

function upgradeCardBounds(index) {
  const cardHeight = 104;
  const gap = 8;
  return { x: 22, y: height * 0.30 + index * (cardHeight + gap), width: width - 44, height: cardHeight };
}

function drawUpgrade() {
  drawGame();
  context.fillStyle = 'rgba(24, 47, 29, 0.72)';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.fillStyle = '#fff7d9';
  context.font = 'bold 26px sans-serif';
  context.fillText('升级啦！选择一项', width / 2, height * 0.22);
  context.font = '15px sans-serif';
  context.fillText(`${game.character === 'rabbit' ? '瘦嘟嘟 · 枪械专精' : '至尊奶 · 棍法专精'} · Lv.${game.level}`, width / 2, height * 0.22 + 28);

  game.upgradeChoices.forEach((upgrade, index) => {
    const card = upgradeCardBounds(index);
    context.fillStyle = '#fff7d9';
    roundedRect(card.x, card.y, card.width, card.height, 14);
    context.textAlign = 'left';
    const rarity = skillRarity[upgrade.rarity];
    context.fillStyle = rarity.color;
    context.font = 'bold 17px sans-serif';
    context.fillText(`${rarity.label} · ${upgrade.title}`, card.x + 18, card.y + 29, card.width - 36);
    context.fillStyle = '#6b7956';
    context.font = '13px sans-serif';
    context.fillText(upgrade.description, card.x + 18, card.y + 52, card.width - 36);
    context.fillStyle = '#a45b42';
    context.font = '10px sans-serif';
    context.fillText(enemyBuffDescription(upgrade.rarity), card.x + 18, card.y + 76, card.width - 36);
    context.textAlign = 'right';
    context.fillStyle = '#b37c2e';
    context.font = 'bold 12px sans-serif';
    context.fillText('选择 ›', card.x + card.width - 16, card.y + 96);
  });
}

function drawResult() {
  drawGameBackground();
  context.fillStyle = 'rgba(255, 250, 226, 0.92)';
  roundedRect(24, height * 0.20, width - 48, height * 0.60, 20);
  context.textAlign = 'center';
  context.fillStyle = '#315e37';
  context.font = 'bold 30px sans-serif';
  context.fillText(game.resultWon ? '首领击退！' : (game.earlySettled ? '提前结算' : '本局结束'), width / 2, height * 0.31);
  context.font = '17px sans-serif';
  context.fillText(game.resultWon ? `成功清理 ${game.kills} 只捣蛋虫` : `清理 ${game.kills} 只捣蛋虫`, width / 2, height * 0.39);
  context.fillText(`坚持 ${Math.floor(game.elapsed)} 秒 · 到达 Lv.${game.level}`, width / 2, height * 0.45);
  context.fillStyle = '#b37c2e';
  context.font = 'bold 16px sans-serif';
  context.fillText(`金币 +${game.coinsEarned}（${profile.coins}） · 种子 +${game.seedsEarned}（${profile.seeds}）`, width / 2, height * 0.51);
  context.fillStyle = '#477a3c';
  context.font = '14px sans-serif';
  context.fillText(`最佳纪录：${profile.bestTime} 秒 · 最多清理 ${profile.bestKills} 只`, width / 2, height * 0.57);

  context.fillStyle = '#315e37';
  roundedRect(48, height * 0.64, width - 96, 52, 14);
  context.fillStyle = '#fff7d9';
  context.font = 'bold 18px sans-serif';
  context.fillText('再来一局', width / 2, height * 0.64 + 33);
  context.fillStyle = '#477a3c';
  context.font = '15px sans-serif';
  context.fillText('点击其他位置返回首页', width / 2, height * 0.72);
}

function moveJoystick(touch) {
  const joystick = joystickOrigin;
  let dx = touch.clientX - joystick.x;
  let dy = touch.clientY - joystick.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > joystick.radius) {
    dx *= joystick.radius / distance;
    dy *= joystick.radius / distance;
  }
  const limitedDistance = Math.min(distance, joystick.radius);
  const strength = limitedDistance / joystick.radius;
  game.input.x = distance ? dx / (Math.sqrt(dx * dx + dy * dy) || 1) * strength : 0;
  game.input.y = distance ? dy / (Math.sqrt(dx * dx + dy * dy) || 1) * strength : 0;
}

function dashButtonBounds() {
  return { x: width - 58, y: height - 100, radius: 33 };
}

function activateDash() {
  if (!game || game.dashCooldown > 0) return;
  let dx = game.input.x;
  let dy = game.input.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.08) { dx = game.facing; dy = 0; }
  else { dx /= length; dy /= length; }
  if (Math.abs(dx) > 0.05) game.facing = dx < 0 ? -1 : 1;
  game.dashX = dx; game.dashY = dy;
  game.dashTimer = 0.22; game.dashCooldown = game.dashCooldownMax;
  burstParticles(game.player.x, game.player.y, '#8fe6e9', 10);
  playSound('pickup', 180);
}

function isDashButtonHit(touch) {
  const button = dashButtonBounds();
  const dx = touch.clientX - button.x; const dy = touch.clientY - button.y;
  return dx * dx + dy * dy <= button.radius * button.radius;
}

function handleTouchStart(event) {
  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) return;

  if (screen === 'menu') {
    const selectedCharacter = characterButtons.find((card) => touch.clientX >= card.x && touch.clientX <= card.x + card.width && touch.clientY >= card.y && touch.clientY <= card.y + card.height);
    if (selectedCharacter) { profile.character = selectedCharacter.id; saveProfile(); draw(); }
    else if (menuButton && touch.clientX >= menuButton.x && touch.clientX <= menuButton.x + menuButton.width && touch.clientY >= menuButton.y && touch.clientY <= menuButton.y + menuButton.height) startGame();
    else if (wardrobeButton && touch.clientX >= wardrobeButton.x && touch.clientX <= wardrobeButton.x + wardrobeButton.width && touch.clientY >= wardrobeButton.y && touch.clientY <= wardrobeButton.y + wardrobeButton.height) {
      screen = 'wardrobe';
      draw();
    } else if (gardenButton && touch.clientX >= gardenButton.x && touch.clientX <= gardenButton.x + gardenButton.width && touch.clientY >= gardenButton.y && touch.clientY <= gardenButton.y + gardenButton.height) {
      screen = 'garden'; draw();
    }
    else if (enemyCodexButton && touch.clientX >= enemyCodexButton.x && touch.clientX <= enemyCodexButton.x + enemyCodexButton.width && touch.clientY >= enemyCodexButton.y && touch.clientY <= enemyCodexButton.y + enemyCodexButton.height) {
      screen = 'enemyCodex'; draw();
    }
    return;
  }

  if (screen === 'enemyCodex') {
    if (touch.clientX < 100 && touch.clientY < height * 0.19) screen = 'menu';
    draw(); return;
  }

  if (screen === 'garden') {
    if (touch.clientX < 100 && touch.clientY < height * 0.24) screen = 'menu';
    else if (codexButton && touch.clientX >= codexButton.x && touch.clientX <= codexButton.x + codexButton.width && touch.clientY >= codexButton.y && touch.clientY <= codexButton.y + codexButton.height) screen = 'codex';
    else gardenProjects.forEach((project, index) => {
      const card = gardenCardBounds(index); const level = profile.garden[project.id];
      if (touch.clientX < card.x || touch.clientX > card.x + card.width || touch.clientY < card.y || touch.clientY > card.y + card.height || level >= 10) return;
      const cost = 5 + level * 3;
      if (profile.seeds < cost) return;
      profile.seeds -= cost; profile.garden[project.id] += 1; saveProfile();
    });
    draw(); return;
  }

  if (screen === 'codex') {
    if (touch.clientX < 100 && touch.clientY < height * 0.2) screen = 'garden';
    draw(); return;
  }

  if (screen === 'wardrobe') {
    if (touch.clientX < 100 && touch.clientY < height * 0.22) {
      screen = 'menu';
    } else {
      appearances.forEach((appearance, index) => {
        const card = appearanceCardBounds(index);
        if (touch.clientX < card.x || touch.clientX > card.x + card.width || touch.clientY < card.y || touch.clientY > card.y + card.height) return;
        if (profile.unlockedSkins.includes(appearance.id)) profile.skin = appearance.id;
        else if (profile.coins >= appearance.price) {
          profile.coins -= appearance.price;
          profile.unlockedSkins.push(appearance.id);
          profile.skin = appearance.id;
        }
        saveProfile();
      });
    }
    draw();
    return;
  }

  if (screen === 'game') {
    if (settleButton && touch.clientX >= settleButton.x && touch.clientX <= settleButton.x + settleButton.width && touch.clientY >= settleButton.y && touch.clientY <= settleButton.y + settleButton.height) {
      game.input = { x: 0, y: 0 };
      joystickTouchId = null;
      joystickOrigin = null;
      screen = 'paused';
      draw(); return;
    }
    if (isDashButtonHit(touch)) { activateDash(); return; }
    if (joystickTouchId !== null) return;
    joystickTouchId = touch.identifier;
    joystickOrigin = { x: touch.clientX, y: touch.clientY, radius: 48 };
    moveJoystick(touch);
    return;
  }

  if (screen === 'paused') {
    if (touch.clientX >= width * 0.18 && touch.clientX <= width * 0.82 && touch.clientY >= height * 0.44 && touch.clientY <= height * 0.44 + 52) {
      screen = 'game';
      lastFrameTime = 0;
      startLoop();
    } else if (touch.clientX >= width * 0.18 && touch.clientX <= width * 0.82 && touch.clientY >= height * 0.55 && touch.clientY <= height * 0.55 + 52) {
      game.earlySettled = true;
      finishGame(false);
    }
    draw();
    return;
  }

  if (screen === 'upgrade') {
    game.upgradeChoices.forEach((upgrade, index) => {
      const card = upgradeCardBounds(index);
      if (touch.clientX >= card.x && touch.clientX <= card.x + card.width && touch.clientY >= card.y && touch.clientY <= card.y + card.height) {
        upgrade.apply();
        applyEnemyBuff(upgrade.rarity);
        screen = 'game';
      }
    });
    return;
  }

  if (screen === 'result') {
    if (touch.clientY >= height * 0.64 && touch.clientY <= height * 0.64 + 52) startGame();
    else {
      screen = 'menu';
      draw();
    }
  }
}

function handleTouchMove(event) {
  if (screen !== 'game' || joystickTouchId === null) return;
  const touches = event.touches || [];
  const touch = Array.from(touches).find((item) => item.identifier === joystickTouchId);
  if (touch) moveJoystick(touch);
}

function handleTouchEnd(event) {
  if (joystickTouchId === null) return;
  const changedTouches = event.changedTouches || [];
  const ended = Array.from(changedTouches).some((touch) => touch.identifier === joystickTouchId);
  if (ended || changedTouches.length === 0) {
    joystickTouchId = null;
    joystickOrigin = null;
    if (game) game.input = { x: 0, y: 0 };
  }
}

function draw() {
  if (screen === 'menu') drawMenu();
  else if (screen === 'game') drawGame();
  else if (screen === 'paused') drawPause();
  else if (screen === 'upgrade') drawUpgrade();
  else if (screen === 'result') drawResult();
  else if (screen === 'wardrobe') drawWardrobe();
  else if (screen === 'garden') drawGarden();
  else if (screen === 'codex') drawCodex();
  else if (screen === 'enemyCodex') drawEnemyCodex();
}

wx.onTouchStart(handleTouchStart);
wx.onTouchMove(handleTouchMove);
wx.onTouchEnd(handleTouchEnd);
if (wx.onTouchCancel) wx.onTouchCancel(handleTouchEnd);
if (wx.onWindowResize) wx.onWindowResize(resize);
resize();
