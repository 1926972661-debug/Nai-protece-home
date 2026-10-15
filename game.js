const canvas = wx.createCanvas();
const context = canvas.getContext('2d');
const system = wx.getSystemInfoSync();
const background = wx.createImage();
const characterSprite = wx.createImage();
const stickSprite = wx.createImage();
const speedCloudSprite = wx.createImage();
const enemySprite = wx.createImage();
const grenadeSprite = wx.createImage();
const bossSprite = wx.createImage();
const rabbitSprite = wx.createImage();
const apeSprite = wx.createImage();
const stalkerSprite = wx.createImage();
const bruteSprite = wx.createImage();
const runnerSprite = wx.createImage();
const eliteSprite = wx.createImage();
const daxiaSprite = wx.createImage();
const xiaoxianSprite = wx.createImage();
// 奶小仙的武器伞：所有攻击形态（掷出/飞行/旋转/回程/伞爆）共用这一张。
// 素材由用户提供（原图白底，已用"从图像边缘向内的连通域"法去背，见 README 素材规格一节）。
const umbrellaSprite = wx.createImage();

let screen = 'menu';
let width = system.screenWidth;
let height = system.screenHeight;
let pixelRatio = system.pixelRatio || 1;
let backgroundReady = false;
let characterReady = false;
let stickReady = false;
let speedCloudReady = false;
let enemyReady = false;
let grenadeReady = false;
let bossReady = false;
let rabbitReady = false;
let apeReady = false;
let stalkerReady = false;
let bruteReady = false;
let runnerReady = false;
let eliteReady = false;
let daxiaReady = false;
let xiaoxianReady = false;
let umbrellaReady = false;
let game = null;
let skillCodexCharacter = 'supreme';
let upgradeDetailIndex = 0;
let joystickTouchId = null;
let joystickOrigin = null;
let loopRunning = false;
let lastFrameTime = 0;
// 存档存储 key：**刻意不带版本号**，且此后不要再改这个字符串 —— 改了就等于把所有老玩家的进度硬重置。
// 版本信息放在**存档数据内部**的 version 字段（见 PROFILE_SCHEMA_VERSION 与 normalizeProfile）。
// 字符串里的 `-v1` 是项目第一版留下的历史后缀，不代表 schema 版本，仅为兼容已发布的键名而保留。
const profileStorageKey = 'yard-cleaner-profile-v1';
const characters = [
  { id: 'supreme', name: '至尊奶', style: '旋转棍', description: '环绕近战' },
  { id: 'rabbit', name: '瘦嘟嘟', style: '追踪枪', description: '自动追踪射击' },
  { id: 'daxia', name: '奶大侠', style: '月牙刀光', description: '穿透渐衰' },
  { id: 'xiaoxian', name: '奶小仙', style: '掷伞', description: '持续压制' },
];
const characterCodices = {
  supreme: '棍法专精 · 环绕棍环绕自身持续输出',
  rabbit: '枪械专精 · 追踪子弹自动锁定敌人',
  daxia: '刀法专精 · 刀光穿透后不消失，越打越衰',
  xiaoxian: '御伞专精 · 伞离手时靠反刺玉衣自保',
};
// Sprite box per character: width/height in CSS px plus how far the sprite is lifted so the
// feet sit on the player's collision point.
const characterRender = {
  supreme: { width: 88, height: 76, lift: 29 },
  rabbit: { width: 112, height: 126, lift: 48 },
  daxia: { width: 77, height: 132, lift: 52 },
  xiaoxian: { width: 95, height: 132, lift: 52 },
};
const appearances = [
  { id: 'base', name: '小院新手', price: 0 },
  { id: 'flower', name: '春日花冠', price: 35 },
  { id: 'leaf', name: '金叶发箍', price: 75 },
];
const gardenProjects = [
  { id: 'flower', name: '花圃', description: '每 3 级多掉 1 粒种子', short: '种子+', buff: (level) => 1 + Math.floor(level / 3) },
  { id: 'tree', name: '果树', description: '开局生命上限 +8/级', short: '生命+', buff: (level) => level * 8 },
  { id: 'pond', name: '池塘', description: '基础攻击力 +1/级', short: '攻击+', buff: (level) => level },
  { id: 'fence', name: '木栅栏', description: '每次碰撞减伤 +0.3/级', short: '减伤+', buff: (level) => level * 0.3 },
  { id: 'windmill', name: '小风车', description: '移动速度 +3/级', short: '速度+', buff: (level) => level * 3 },
  { id: 'campfire', name: '营火堆', description: '棍子转速 +0.12/级', short: '转速+', buff: (level) => level * 0.12 },
  { id: 'lantern', name: '萤火灯', description: '稀有植物出现更频繁', short: '寻宝+', buff: (level) => level },
  { id: 'path', name: '石板路', description: '至尊奶冲刺 / 瘦嘟嘟手雷冷却 -0.12/级', short: '冷却-', buff: (level) => level * 0.12 },
];
const plantSets = {
  blue: { name: '蓝露拾荒套', count: 3, bonus: '攻击力 +3' },
  purple: { name: '紫晶猎手套', count: 4, bonus: '攻击 +3' },
  gold: { name: '金曜丰收套', count: 5, bonus: '生命 +40、移速 +10、攻击速度提升' },
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
// ---------------------------------------------------------------------------
// 存档 schema 版本与迁移
//
// **位置要求（踩过坑，勿动）**：这一整块必须出现在任何 `loadProfile()` 调用**之前**。
// 下面紧跟着的 `let profile = loadProfile();` 在模块体求值时就执行，而 `const` / `let`
// 有 TDZ —— 若把本块放到它后面，`loadProfile` 会在 `profileDiagnostics` /
// `PROFILE_STORAGE_KEY` / `normalizeProfile` 初始化之前访问它们，
// 启动即抛 `ReferenceError: Cannot access '...' before initialization`。
// **这个错误 `node --check` 与静态断言都查不出来，只有真正执行 game.js 才能发现。**
//
// 版本号必须存在**数据里**，不能存在存储 key 里：
// 存储 key 一改，老档就彻底读不到了（那是硬重置，不是迁移）。
//
//   v1 = 项目最初发布的形态：**根本没有 version 字段**（`-v1` 只是 key 的字符串后缀）。
//   v2 = 引入 version 字段 + 明确的迁移管线（本次改动）。
//
// 下一次改存档结构时：把 PROFILE_SCHEMA_VERSION 加 1，并在 migrateOneVersion() 里
// 补一个 `if (version === 2) { ... 就地升级 ... }` 分支 —— 老玩家会被逐版搬过来，
// 而不是被清档。
// ---------------------------------------------------------------------------
const PROFILE_SCHEMA_VERSION = 2;
// 存储 key 的**唯一事实来源**：loadProfile / saveProfile 都读它。
// 它必须与上面 profileStorageKey 的已发布字符串逐字相同 —— 否则老档读不到。
const PROFILE_STORAGE_KEY = 'yard-cleaner-profile-v1';
// 兜底去重，避免日志刷屏：同一类诊断只记一次。
let profileDiagnostics = [];
function logProfileDiagnostic(message) {
  if (profileDiagnostics.indexOf(message) >= 0) return;
  profileDiagnostics.push(message);
  if (typeof console !== 'undefined' && console.log) console.log('[profile] ' + message);
}

// 数值字段夹取：先归一为有限数，再夹到 [min, max]。
// 类型错（字符串 / null / NaN）一律取 fallback，**绝不因为一个字段坏掉就丢掉整档**。
// ±Infinity 走**夹取**而不是 fallback：它是"极大/极小"而非"不可解析"，
// 夹到 max（通常是 1e12）比归零更符合"越界 → 夹取而非丢弃"的要求，也更不容易误伤玩家进度。
function clampProfileNumber(value, min, max, fallback) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  if (number === Infinity) return max;
  if (number === -Infinity) return min;
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function createDefaultProfile() {
  const garden = {};
  gardenProjects.forEach((item) => { garden[item.id] = 0; });
  const enemyKills = {};
  enemyCatalog.forEach((enemy) => { enemyKills[enemy.id] = 0; });
  return {
    version: PROFILE_SCHEMA_VERSION,
    bestTime: 0,
    bestKills: 0,
    coins: 0,
    seeds: 0,
    character: 'supreme',
    enemyKills,
    enemySeen: [],
    garden,
    plants: [],
    unlockedSkins: ['base'],
    skin: 'base',
  };
}

// 逐版迁移。**只做结构升级，不做归一化**（归一化统一在 normalizeProfile 里做，避免两处口径）。
// 关键纪律：每一步都必须是**幂等**的 —— 迁移一次和迁移两次结果相同。
function migrateOneVersion(saved, version) {
  if (version === 1) {
    // v1 → v2：v1 的字段集与 v2 完全相同，v2 只是补了 version 字段本身。
    // 这里保留成显式分支而不是"什么都不做"，是为了给下一位改结构的人一个可以照抄的位置。
    // 注意：**不能**在这里把缺失字段写回 saved —— 那会让"老档缺字段"被当成"老档有字段"，
    // 丢失 normalizeProfile 的补默认逻辑。
    return saved;
  }
  return saved;
}

/**
 * 把存档推进到当前 schema 版本。
 * - 缺 version（历史 v1 档）→ 视作 PROFILE_SCHEMA_VERSION - 1，逐版迁移上来；
 * - 版本号非法（非有限数）→ 同样按历史档处理；
 * - **无法识别的未来版本号**（玩家装过更新版本又回退）→ 不重置、不猜测，
 *   保留其全部已知字段（由 normalizeProfile 夹取到合法范围），把 version 抬到当前版本，
 *   并记一条诊断。
 */
function migrateProfileChain(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  const rawVersion = Number(saved.version);
  let version = Number.isFinite(rawVersion) ? Math.floor(rawVersion) : PROFILE_SCHEMA_VERSION - 1;
  if (version < 1) version = PROFILE_SCHEMA_VERSION - 1;
  if (version > PROFILE_SCHEMA_VERSION) {
    logProfileDiagnostic('存档版本 v' + version + ' 高于当前 v' + PROFILE_SCHEMA_VERSION
      + '（可能是回退了游戏版本）；保留已知进度并夹取到合法范围，不重置整档。');
    return saved;
  }
  let migrated = saved;
  while (version < PROFILE_SCHEMA_VERSION) {
    migrated = migrateOneVersion(migrated, version);
    version += 1;
  }
  return migrated;
}

/**
 * 读档归一化的**唯一实现**：白名单 + 数值夹取 + 缺字段补默认。
 * 纯函数：不读 wx、不写 profile、不就地修改入参。
 */
function normalizeProfile(saved) {
  const fallback = createDefaultProfile();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    logProfileDiagnostic('存档不是对象（收到 ' + (saved === null ? 'null' : typeof saved) + '）；已回退为默认档。');
    return fallback;
  }
  const migrated = migrateProfileChain(saved);
  const unlockedSkins = Array.isArray(migrated.unlockedSkins)
    ? migrated.unlockedSkins.filter((id) => appearances.some((item) => item.id === id))
    : fallback.unlockedSkins.slice();
  if (!unlockedSkins.includes('base')) unlockedSkins.push('base');
  const garden = {};
  gardenProjects.forEach((item) => {
    // 已有的等级保留并夹到 [0,10]；缺的装饰项补 0 级（新增装饰项不会重置老档）。
    garden[item.id] = clampProfileNumber(migrated.garden && migrated.garden[item.id], 0, 10, 0);
  });
  const plants = [];
  if (Array.isArray(migrated.plants)) {
    migrated.plants.forEach((id) => {
      if (plantCatalog.some((plant) => plant.id === id) && plants.indexOf(id) < 0) plants.push(id);
    });
  }
  const enemyKills = {};
  enemyCatalog.forEach((enemy) => {
    enemyKills[enemy.id] = clampProfileNumber(migrated.enemyKills && migrated.enemyKills[enemy.id], 0, Number.MAX_SAFE_INTEGER, 0);
  });
  const enemySeen = [];
  if (Array.isArray(migrated.enemySeen)) {
    migrated.enemySeen.forEach((id) => {
      if (enemyCatalog.some((enemy) => enemy.id === id) && enemySeen.indexOf(id) < 0) enemySeen.push(id);
    });
  }
  return {
    version: PROFILE_SCHEMA_VERSION,
    bestTime: clampProfileNumber(migrated.bestTime, 0, Number.MAX_SAFE_INTEGER, 0),
    bestKills: clampProfileNumber(migrated.bestKills, 0, 10e6, 0),
    // 上限 1e12：既挡住 1e300 / Infinity 这类被手改出来的天文数字，又远高于任何正常玩法收益。
    coins: clampProfileNumber(migrated.coins, 0, 1e12, 0),
    seeds: clampProfileNumber(migrated.seeds, 0, 1e12, 0),
    character: characters.some((item) => item.id === migrated.character) ? migrated.character : fallback.character,
    enemyKills,
    enemySeen,
    garden,
    plants,
    unlockedSkins,
    skin: unlockedSkins.includes(migrated.skin) ? migrated.skin : 'base',
  };
}

// 语义化别名：本函数只做"归一化"，命名上的"sanitize"是它对外表达的角色。
function sanitizeProfile(saved) {
  return normalizeProfile(saved);
}

let profile = loadProfile();
const audioPlayers = {};
const soundLastPlayed = {};
const stickWidth = 76;
const stickHeight = 10;
const gameWorldZoom = 0.82;

// Every tunable opening number lives here instead of being scattered through startGame().
const balance = {
  worldScreens: 8,
  worldMinWidth: 2400,
  worldMinHeight: 3600,
  waveDuration: 25,
  finalWave: 8,
  waveGoalBase: 4,
  bossSpawnTime: 150,
  maxEnemiesOnScreen: 24,
  eventEnemyReserve: 2,
  startingMaxHealth: 100,
  startingBaseAttack: 2,
  startingMoveSpeed: 175,
  startingOrbitRadius: 60,
  startingOrbitSpeed: 2.8,
  startingStickHalfLength: 35,
  startingAttackRange: 480,
  startingCritChance: 0.05,
  startingCritMultiplier: 1.5,
  startingKnockback: 1,
  startingFireInterval: 0.60,
  startingProjectileSpeed: 430,
  startingProjectileTurnRate: 5,
  startingGrenadeRadius: 104,
  grenadeFlightDuration: 0.68,
  grenadeNormalRatio: 0.3,
  grenadeBossRatio: 0.1,
  grenadeCooldown: 10,
  // ---- 反哺（瘦嘟嘟的新的金色技能）-----------------------------------------------------
  // 每次击杀固定 +0.5% 最终伤害，**与等级无关**（所以是常量，不随成长曲线放大），
  // 上限 +200%；并且每次击杀回复 1 点生命。
  // 这个加成是**独立乘区、算在所有加成的最后**：见 applyAttackDamage 里
  // `baseDamage × 暴击 × 连杀 × (1 + rabbitFeedBonus)` 的最后一乘。
  rabbitFeedPerKill: 0.005,
  rabbitFeedCap: 2,
  rabbitFeedHealPerKill: 1,
  // Boss: base health doubled. At 302 it folded to a single evolved burst before the fight
  // even read as a fight.
  bossBaseHealth: 604,
  // Grenade impact
  grenadeStunTime: 1.4,
  grenadeBossStunScale: 0.35,
  grenadeExplosionLife: 0.55,
  grenadeScorchLife: 3.4,
  dashCooldown: 4.5,
  dashDuration: 0.22,
  dashSpeedFactor: 4.2,
  contactDamageCooldown: 0.65,
  plantSpawnFirst: 10,
  eventFirstAt: 35,
  eventIntervalMin: 58,
  eventIntervalSpread: 20,
  spawnIntervalStart: 1.05,
  spawnIntervalStep: 0.16,
  spawnIntervalMin: 0.42,
  // Enemies stop at contact range instead of walking into the player's centre:
  // the orbiting sticks cover a radial band, so a pile-up at r = 0 was unhittable.
  enemyStandoff: true,
  enemySeparation: 26,
  // Monster health used to grow additively (+2/+4/+7) while player damage grows
  // multiplicatively (crit, extra sticks/bullets, and the gold/red global stat multiplier,
  // so late-game monsters melted. Health now compounds too.
  //
  // Gold x4 and red x7 are deliberate step changes: picking a strong skill instantly makes
  // the horde much tankier, so it survives long enough to be visibly mown down instead of
  // evaporating on contact. Because those two now carry almost all of the compounding, the
  // small rarities were flattened to a near-flat slope (1.0 / 1.04 / 1.06) to keep the total
  // curve in a playable band. Measured over a fixed 30-upgrade path the effective monster HP
  // grows x447 (was x198), against player damage growth of x217 (supreme) / x924 (rabbit).
  enemyHealthMultiplier: { white: 1.0, blue: 1.04, purple: 1.06, gold: 4.0, red: 10.0 },
  enemyHealthFlat: { white: 2, blue: 4, purple: 7, gold: 12, red: 24 },
  // The x4 / x7 step lands the instant the skill is picked, while the player's compensating
  // power arrives over the following level-ups. Left fully uncapped, a run that draws several
  // golds very early can outrun the character and stall into an unkillable wall (measured:
  // 4 golds = x256 health at level 18 -> 0.73 kills/s and no way back). This clamp keeps the
  // literal x4 / x7 behaviour for the first three golds (4x / 16x / 64x) and only bites on
  // unusually lucky runs; past it, further gold/red picks keep paying out as a BIGGER HORDE
  // (surgePerGold / surgePerRed) rather than as monsters that take forever to chew through.
  // Set to Infinity to restore the raw uncapped x4 / x7 behaviour.
  enemyHealthMultiplierCap: 128,
  // Every gold/red pick also swells the horde: a bigger on-screen ceiling plus an immediate
  // burst around the player, so the reward for a strong pick is more things to cut down.
  surgePerGold: 5,
  surgePerRed: 10,
  surgeBurstPerGold: 5,
  surgeBurstPerRed: 12,
  surgeSpawnRate: 0.1,
  maxEnemiesHardCap: 56,
  // Weight used to climb ~2.1 per level while knockback climbed 1, so the push
  // ratio converged below its activation threshold and knockback silently died.
  enemyWeightStep: { white: 0.5, blue: 1.0, purple: 1.5, gold: 2.0, red: 3.0 },
  waveHealthCompound: 0.14,
  // Knockback redesign. The old numbers made the push physically real but visually absent:
  // maxDistance sat only ~50 px beyond the standoff ring, so even a fully invested build moved
  // enemies about 25 px - roughly one body width - and at 520 px/s that push was over in two
  // frames. The push is now much longer and slower so it actually reads on screen.
  knockbackMaxDistance: 140,
  knockbackPushSpeed: 320,
  slamDamageRatio: 0.8,
  slamKnockbackRatio: 2.5,
  slamMaxHealthRatio: 0.15,
  slamSelfRatio: 0.25,
  slamImpactRadius: 62,
  // Feel / juice
  // Bullet readability. A tracking bullet that loses its target used to be deleted on the
  // spot (life = 0), which read as the shot blinking out of existence. It now coasts on its
  // last heading and fades out instead.
  bulletLifetime: 1.2,
  bulletFadeTime: 0.3,
  // Bullets used to re-target anything within attackRange + 80 (up to 800 px, wider than the
  // screen), so they streaked across the whole view chasing something off-camera. Bounding the
  // seek range keeps them near the fight, which is what actually removes the "flying
  // everywhere" look; they now fade out where they were fired instead of crossing the map.
  bulletSeekRange: 420,
  // ---- 瘦嘟嘟技能数值 ×1.3（按用户要求"全部技能数值提升到 1.3 倍"）----------------------
  // 下面这几个常量是她的金卡/红卡**写在派生公式里**的数值，不在卡面文字里直接出现，
  // 但同属"技能数值"，所以一并乘了 1.3。注释里保留原值，方便核对与回退：
  //   bulletBlastRadius   62   → 80.6   （重炮弹头的爆破半径）
  //   bulletBlastRatio    0.4  → 0.52   （爆破伤害倍率 40% → 52%）
  //   chainVolleyBullets  6    → 8      （精准连射的齐射发数，7.8 取整）
  //   chainVolleyRefund   0.25 → 0.325  （齐射返还的冷却）
  //   radialBaseCount     4    → 5.2    （赤焰弹幕：子弹数 = 基础 + 弹数×系数 + 机制×系数）
  //   radialPerProjectile 1.0  → 1.3
  //   radialPerMechanic   2    → 2.6
  // **没有乘的**（并说明理由）：上限类（gunCaps 的 8/22/56/26、暴击率 0.75、手雷百分比上限
  // 0.45/0.15、反哺 200%）、下限类（射速 0.30、手雷冷却 5 秒）、频率类（chainVolleyEvery=3、
  // radialFireInterval、radialRingFull）。理由：上限/下限不是"数值的增加"，而改频率会改变
  // 卡的身份（"每 3 轮"变"每 2 轮"是重做而不是加强）。
  bulletBlastRadius: 80.6,
  bulletBlastRatio: 0.52,
  chainVolleyEvery: 3,
  chainVolleyBullets: 8,
  chainVolleyRefund: 0.325,
  radialPerMechanic: 2.6,
  radialSpeedRatio: 0.9,
  radialFireInterval: 2.2,
  // 弹幕圈: every bullet-count upgrade thickens the ring, including after the projectile cap is
  // reached. Once the ring reaches radialRingFull bullets the arcs close into a solid circle.
  radialRingBonus: 0,
  radialRingMax: 26,
  radialRingFull: 14,
  radialRingArcMin: 0.22,
  radialRingRadius: 26,
  radialBaseCount: 5.2,
  radialPerProjectile: 1.3,
  radialBulletLife: 0.95,
  // Fewer bullets on screen means each one has to carry more weight, otherwise the readability
  // fix just makes the gun weak. Throughput (rounds per second) drops by roughly half, so the
  // per-shot damage is scaled to compensate and the gun keeps its damage-per-second.
  rabbitBulletDamageScale: 1.8,
  // A bigger horde must not linearly accelerate levelling, or the player's stats compound
  // faster than any monster curve can follow. Each kill is worth proportionally less XP as
  // the surge raises the ceiling; the exponent keeps this a gentle nudge rather than a
  // second punishment on top of the harder crowd.
  surgeXpDamping: true,
  surgeXpDampingExponent: 0.6,
  // The global "everything gets stronger" multiplier on gold/red picks. Lowered for gold
  // because gold is by far the most common of the two, so it drove most of the compounding.
  //
  // ⚠️ KNOWN ASYMMETRY (deliberately documented, NOT yet decided): this product is *unbounded*,
  // while the enemy side is clamped at `enemyHealthMultiplierCap` (128). The two cross, so the
  // enemy cap is eventually defeated by player growth. Measured by the headless simulator
  // (greedy picks + a fully-upgraded save, seed 4, 400s): level 138, 16,202 kills,
  // health/maxHealth 246,271 / 274,408 (60 golds -> 1.1^60 ~= 304x), swordWaves peak 394,
  // 1.75 ms/frame vs the usual 0.28-0.6 ms. Not a simulator artifact (purity violations 0).
  // Under `random` only ~9 golds are taken so it never shows; `greedy` eats every gold and it does.
  // Open questions (D1/D2 territory - do not "fix" by guessing numbers):
  //   1. does the player-side product need a cap of the same order as the enemy one?
  //   2. does `game.swordWaves` need an array cap (README documents only an opacity soft cap)?
  // Until decided, treat 16,202 kills / Lv.138 as an UPPER BOUND reference - neither a bug to
  // rediscover nor a baseline to quote.
  rarityStatMultiplier: { gold: 1.1, red: 3.0 },
  comboWindow: 1.7,
  comboDamagePerStack: 0.02,
  comboDamageCap: 0.5,
  comboMovePerStack: 0.008,
  comboMoveCap: 0.2,
  // Juice
  scarLife: 6,
  maxScars: 90,
  coinPopLife: 0.55,
  // Kill streaks that pay out with an actual event instead of just a bigger number.
  comboMilestones: [10, 25, 50, 100, 200, 350, 500],
  // An evolution clears the screen: the one moment the player should feel untouchable.
  evolutionBurstRatio: 3.2,
  evolutionInvuln: 1.2,
  bossExecutionTime: 1.5,
  bossExecutionTimeScale: 0.3,
  bossPhaseTwoAt: 0.5,
  bossPhaseTwoSpeed: 1.35,
  bossPhaseTwoMinions: 3,
  // Rubber band: if the player is clearing far faster than the spawner can fill, push more in;
  // if the field is permanently full, ease off. Keeps the fight in the busy band.
  pressureMin: 0.75,
  pressureMax: 1.6,
  pressureLowFill: 0.35,
  pressureHighFill: 0.92,
  pressureResponse: 0.35,
  surgeWarningLife: 2.4,
  resultRollTime: 1.1,
  hitStopDuration: 0.03,
  hitStopCooldown: 0.6,
  shakeDecay: 1,

  // ---- 奶大侠 (sword) ------------------------------------------------------------------
  // Deliberately slower than 瘦嘟嘟's 0.60 s gun: each swing is a heavier, wider, lingering
  // crescent. Lower rate, higher per-hit damage, and the wave keeps working after the hit.
  daxiaFireInterval: 0.88,
  daxiaFireIntervalMin: 0.40,
  daxiaDamageMultiplier: 3.4,
  daxiaWaveSpeed: 135,
  daxiaWaveHalfWidth: 86,
  daxiaWaveThickness: 22,
  daxiaWaveLife: 4,
  // ---- 刀光的「视觉」参数（只影响绘制，绝不影响命中判定）--------------------------------
  // 性能背景：后期刀光会叠到约 400 道，而绘制成本 ≈ 道数 × 填充面积，
  // 面积又 ∝ 弧长 × 刀锋厚度，所以下面每一项都直接省钱。
  //
  // ⚠️ 注意 daxiaWaveThickness（上方 22）**同时参与命中判定**：
  //    `reach = halfWidth + daxiaWaveThickness`、`Math.abs(along) > daxiaWaveThickness + enemy.radius`。
  //    所以「刀锋变细」**绝不能改它**，必须用下面这个独立的视觉系数。
  daxiaWaveBladeScale: 0.4,             // 刀锋视觉厚度系数（1 = 原样；0.4 = 细 60%）
  // 进入「无极剑阵」/「寂」形态后，刀光厚度**再乘**这个系数（需求：降为现在的 30%）。
  // ⚠️ 新月的径向厚度 = half×(1−innerRatio) + thick×1.9，是**两项之和**；
  //    只缩 thick 会撞上 half×0.07 的地板（默认 86×0.07 ≈ 6px）而缩不下去，
  //    所以两项必须一起缩 —— 见 crescentBladeGeometry()。
  daxiaWaveFormBladeScale: 0.3,
  daxiaWaveArcHalfSpan: Math.PI / 2.2,  // 弧的角半跨度（原 π/2.6 ≈ 69.2° → 现 ≈ 81.8°，弧度更大）
  // ⚠️ 这一项**改命中**、不是纯视觉：溅射刀光的 angle 决定它的命中带朝向，
  //    改抖动幅度 = 改它扫到哪些敌人。故保持原值 0.9，不要为了观感调它。
  daxiaWaveSplashAngleJitter: 0.9,
  // 纯视觉：绘制时把溅射的角度**朝母刀光方向收拢**，让一排溅射看起来同向（"成排"而不是"炸开"）。
  // 0.67 → 视觉偏差 ±0.45×0.67 ≈ ±0.30 rad（±17°），而命中的 angle 一字不动。
  // 关键：它从已有数据派生，**不额外调用 Math.random()** —— 否则会错开整条随机序列、改变下游一切。
  daxiaWaveSplashVisualAngleScale: 0.67,
  // ---- 无极剑阵 / 寂：奶大侠的攻击形态进阶 ------------------------------------------------
  // 一次普通攻击的刀光数达到 12 →「无极剑阵」：全部刀光以 360° 全方位向外打出；
  // 达到 24 → 合成一道环形超级刀光「寂」，由内向外扩张；
  // 此后再抽到「多一道刀光」的技能，不再加刀光，改为给「寂」+20% 伤害。
  //
  // 设计要点（为什么这样定）：
  //   · 寂的伤害 = 单道刀光伤害 × 合成时的刀光数 —— 保证"合成"不是降级；
  //   · 寂的**环带厚度**取 swordHalfWidth，所以「宽刃 / 横扫千军」天然联动（刀光变宽 → 寂变厚）；
  //   · 寂的**扩张速度**取 swordWaveSpeed，所以「破空劲 / 刀锋所指」天然联动；
  //   · 衰减仍走 swordWaveDamageAt，所以「刀气纵横 / 余劲不散」照旧生效。
  daxiaFormationWaveThreshold: 6,    // 无极剑阵门槛（刀光数 ≥ 此值 → 360° 全方位）
  daxiaJiWaveThreshold: 12,          // 「寂」门槛（刀光数 ≥ 此值 → 合成环形超级刀光）
  daxiaJiDamageStep: 0.2,            // 寂解锁后，每「1 道刀光」折算为 +20% 寂伤害（加算）
  daxiaSanDaoAttackSpeed: 0.5,       // 「三刀流」的攻速提升比例（+50% → 出刀间隔 ÷ 1.5）
  // 寂的伤害 = 单道刀光伤害 × 刀光数 × 本系数 × swordJiScale。
  // 默认 1 = 「合成」不损失任何总伤害（只是把并排/环形的一圈刀光收拢成一道环），
  // 若实测太强，把这个值调到 0.5~0.7 即可整体下调寂的威力。
  daxiaJiDamageRatio: 1,
  daxiaJiExpandSpeed: 1,             // 寂的扩张速度 = swordWaveSpeed × 本系数
  daxiaJiMaxRadius: 900,             // 寂扩张到此半径后开始淡出
  daxiaJiBandScale: 1,               // 寂的环带厚度 = swordHalfWidth × 本系数
  // ---- 渲染窗口与特效上限（数组本身一道不动，伤害照算）----------------------------------
  swordWaveRenderCap: 36,               // 每帧最多绘制多少道「溅射」刀光（主刀光始终全画）
  swordWaveStrokeCap: 8,                // 只给最新这么多道刀光画描边，其余只做填充
  deathPopCap: 24,                      // 击杀爆炸环上限（此前完全没有上限，实测峰值 65）
  killSoundCooldown: 90,                // 击杀音效节流毫秒（原 55 ≈ 18 次/秒 → 现 ≈ 11 次/秒）
  daxiaWaveFadeTime: 0.7,
  // 刀光的消失与衰减：**以「首次命中敌人」为锚点**，不再以出刀时刻为锚点。
  //   未命中任何敌人 → 活满 daxiaWaveLife（4 秒）后消失，期间保持满伤害
  //   命中之后       → 再活 daxiaHitLife（2 秒），期间按下面两档递减，然后消失
  // 首击仍然吃满伤害（swordWaveDamageAt 在 hasHit 为 false 时直接返回满伤害），
  // 只有"命中之后再撞上的敌人"才走这两档。
  // 余劲不散（swordFalloffBonus）同时推迟两档、并按同量延长命中后的寿命，
  // 所以"衰减更晚、刀光更耐打"这条语义仍然成立。
  daxiaHitLife: 2,              // 命中敌人后最多再存在 2 秒
  daxiaHitFalloffEarly: 0.5,    // 命中后 0 ~ 0.5 秒：早期倍率
  daxiaHitFalloffLate: 2,       // 0.5 ~ 2 秒：后期倍率；2 秒即消失（与 daxiaHitLife 同步）
  daxiaFalloffEarlyRatio: 0.5,
  daxiaFalloffLateRatio: 0.25,
  wuxianCooldown: 15,
  wuxianDamageRatio: 5,

  // ---- 奶小仙 (umbrella) ---------------------------------------------------------------
  // She has no attack at all while the umbrella is away, so every number here has to carry
  // the kit on its own: this multiplier is what the spec's "100% on the path / 50% per second
  // spinning / 120% per umbrella on 伞回" are percentages OF.
  umbrellaDamageMultiplier: 5.0,
  umbrellaSpeed: 430,
  umbrellaReturnSpeed: 540,
  umbrellaRadius: 34,
  umbrellaSpinRatio: 0.5,
  // The lock-on rule ("spins until the primary target dies") is kept, but a spinning canopy
  // physically clips whatever is touching it. Without this she is completely idle for as long
  // as it takes to grind down one late-game monster - measured ~18 s per kill - which drops her
  // clear rate far below every other character.
  umbrellaSpinSplashInterval: 0.3,
  umbrellaSpinSplashRatio: 0.5,
  umbrellaSpinSplashRadius: 1.7,
  // After 3 s locked on, the spin compounds: each further second deals 130% of the previous
  // second's rate, and at 8 s the umbrella is wrenched back automatically.
  umbrellaRampDelay: 3,
  umbrellaRampStep: 1.3,
  umbrellaMaxSpin: 8,
  // Coming home heals her for half of everything the umbrella did to its primary target.
  umbrellaReturnHealRatio: 0.5,
  // 伞·引 (gold): the thrown umbrella becomes a gravity well. How hard it pulls is the same
  // knockback-vs-weight curve the shove uses, so light enemies are sucked in and heavy ones
  // only lean toward it.
  umbrellaAttractRadius: 240,
  umbrellaAttractSpeed: 150,
  // Red skill 万伞归一: several umbrellas airborne at once. The first keeps full damage and each
  // further one steps down, and no two umbrellas may lock onto the same enemy.
  umbrellaSwarmFactors: [1, 0.5, 0.25],
  // Its drawback: 反刺玉衣 becomes permanent, at a fraction of its strength.
  swarmRobeReductionScale: 0.3,
  swarmRobeReflectScale: 0.75,
  // 红技能的出现概率是一条独立曲线，不参与权重抽取。
  // 之前红色只是"权重池里的一档"，而进化与整 5/10 级保底会先把 4 张卡位占掉：
  // 实测瘦嘟嘟拿了精准连射（解锁 2 条进化）后红色出现率从 6.4% 掉到 1.7%，
  // 两条以上进化同时可出时甚至降到 0。现在红色改为独立掷骰，卡位再也挤不掉它。
  redBaseChance: 0.06,
  redBonusStartLevel: 10,
  redBonusEvery: 5,
  redBonusPerStep: 0.02,
  redChanceCap: 0.45,
  // 反刺蓄力: reflected damage charges an automatic thorn burst, so being swarmed while the
  // umbrella is away is productive instead of dead time.
  thornChargeMax: 240,
  thornBurstRadius: 270,
  thornBurstRatio: 2.8,
  // 血月斩 (daxia red): a crescent that hits spawns small splashes at each victim.
  bloodMoonSplashRatio: 0.7,
  bloodMoonSplashWidth: 0.45,
  daxiaComboDelay: 0.14,
  // Rarity pacing: gold and red are meant to be late-run payoffs. Before level 10 they are
  // heavily damped, and red is outright impossible before level 5.
  redMinLevel: 5,
  rarityRampLevels: 10,
  earlyRarityFactor: 0.2,
  // ---- 通用规则：拿到红色技能之后的升级代价（对所有角色生效）----------------------------
  // 红色技能是全项目最强的一档（也是各角色的"出口"：血月斩 / 万伞归一 / 赤焰弹幕…），
  // 所以**拿到之后**升级代价提高，二选一都作用在同一条曲线上：
  //   ① 升级所需经验**整体翻倍**                        → redExperienceMultiplier
  //   ② 每级的**固定增量**从 experiencePerLevel 提到 redExperienceStep
  // 公式：
  //   拿到红技能前   experienceBase + 等级 × experiencePerLevel     = 4 + 2L
  //   拿到红技能后  (experienceBase + 等级 × redExperienceStep) × redExperienceMultiplier
  //                                                              = (4 + 4L) × 2 = 8 + 8L
  // 数值对照（等级 1 / 10 / 30 / 50）：
  //   前： 6 /  24 /  64 / 104
  //   后：16 /  88 / 248 / 408      → 约 2.7 ~ 3.9 倍，等级越高越吃紧
  // 取值理由：redExperienceStep = 4 是原增量 2 的两倍，所以这条规则可以一句话概括为
  // "拿到红技能后，升级曲线整体翻倍、每级增量也翻倍"。嫌重/嫌轻只改这两个数即可。
  experienceBase: 4,
  experiencePerLevel: 2,
  redExperienceMultiplier: 2,
  redExperienceStep: 4,
  // 刀势（momentum / giant crescent）机制已按需求**整体删除**：
  // 原来"命中积攒刀势、攒满下一刀变成巨型刀光"这条线连同 momentumMax / momentumPerHit /
  // momentumDecay / momentumLockout / momentumWidthScale / momentumDamageScale 一并移除，
  // 相关的 swordMomentum / swordMomentumReady / momentumLockout / swordComboGiant 状态与
  // HUD 上的刀势条也已删除。因此 fireSwordWave() 不再接受 giant 参数，刀光只有一种规格。
  // 残心 (长夜刀 evolution): the crescent turns around and cuts the same lane again.
  swordReturnRange: 540,
  // 伞阵 (gold): damaging curtains between her and each umbrella, and between umbrellas.
  curtainWidth: 26,
  curtainTickInterval: 0.35,
  curtainDamageRatio: 0.45,
  curtainMaxLength: 620,
  // Proposal 2: keep the horde coming during the boss fight so it stays a mow-down rather
  // than becoming a duel.
  bossPhaseSpawnBoost: 1.7,
  bossPhaseCapacityBonus: 8,
  // Proposal 4: endless mode after the boss falls.
  endlessMode: true,
  endlessBossInterval: 48,
  endlessCapacityRamp: 2,
  // Proposal 6: fade older crescents once there are a lot of them on screen.
  waveVisualSoftCap: 10,
  // Lowered 0.3 -> 0.14. The floor is already reached by the 23rd crescent and 血月斩 can stack
  // ~165 at once, so a 0.3 floor accumulated into a washed-out fog over the middle of a horde.
  // The visual fade is the *only* safe place to throttle: capping the splash objects themselves
  // would cut real damage, because a splash does hit enemies (isSplash only stops re-splashing).
  waveVisualMinAlpha: 0.14,
  umbrellaThrowDelay: 0.35,
  umbrellaMaxRange: 620,
  sanhuiCooldown: 12,
  umbrellaReturnRatio: 1.2,
  umbrellaBurstCount: 12,
  umbrellaBurstRadius: 215,
  umbrellaBurstTime: 0.42,
  umbrellaBurstHitRadius: 38,
  // 反刺玉衣 only exists while the umbrella is away: that is the whole trade.
  thornRobeDamageScale: 0.5,
  thornRobeReflectRatio: 1.5,
  thornRobeMoveScale: 2,
  umbrellaHealBonus: 0,
};
const bossSpawnTime = balance.bossSpawnTime;
const skillRarity = {
  white: { label: '白色', color: '#8a8d7b', weight: 38, points: 1, speedBonus: 2, weightBonus: 1 },
  blue: { label: '蓝色', color: '#3498d5', weight: 30, points: 2, speedBonus: 3, weightBonus: 2 },
  purple: { label: '紫色', color: '#9760c8', weight: 20, points: 3, speedBonus: 5, weightBonus: 3 },
  gold: { label: '金色', color: '#c58a13', weight: 10, points: 5, speedBonus: 8, weightBonus: 4 },
  red: { label: '红色', color: '#d84b52', weight: 2, points: 8, speedBonus: 12, weightBonus: 6 },
};
const enemyBaseWeights = { basic: 3, runner: 3, stalker: 4, brute: 5, elite: 6, ape: 7, boss: 10 };
const enemyStatCaps = { radius: 36, speed: 140 };
const elementalDamageColors = { physical: '#fff6d0', lightning: '#b879ff', fire: '#ff6258', reflect: '#ff9a5c' };
const characterStatCaps = { moveSpeed: 260, attackRange: 720, grenadeRadius: 220, orbitRadius: 140, stickLength: 80, orbitSpeed: 8, attackSpeedMultiplier: 3, fireInterval: 0.30 };
// The gun's own ceilings. Raising the fire-interval floor and capping projectile speed keeps
// the late-game screen readable: the old 0.18 s floor allowed ~44 bullets/s, and uncapped
// 追踪芯片 pushed speed past 1200, so mid-flight bullets covered the whole screen.
// Slower bullets also stay airborne longer, so each source gets its own hard live count -
// that is what actually bounds how busy the screen can get.
const gunCaps = { projectileSpeed: 640, maxTrackingBullets: 22, maxRadialBullets: 56, maxRingBullets: 26 };

// Generic stat raiser for upgrades that bottom out against a hard cap. Returns false when the
// stat was already at the cap, so the upgrade can pay out something else instead of being
// silently wasted on a late pick.
function addCapped(key, amount, cap) {
  const next = Math.min(cap, game[key] + amount);
  if (next <= game[key] + 1e-9) return false;
  game[key] = next;
  return true;
}

// Rarity budget for flat attack. These are the numbers that were inverted: the WHITE 奋勇强攻
// used to give +4, out-hitting a BLUE card worth +1 and a GOLD card worth +3, so the rarer card
// was strictly worse. Flat attack now follows a strict ladder - white +2 / blue +3 / red +12 -
// while gold's two primary-attack cards deliberately sit at +7 and +8, and the higher rarities
// carry extra secondary effects so they still feel like an upgrade. Skills whose PRIMARY effect
// is another stat (旋转速度、棍击距离、暴击率…) fall back to a small flat-attack bonus only
// once that stat is capped (see `addCapped`); those fallbacks are deliberately NOT part of the
// ladder, so do not read them as rarity inversions.
const upgrades = [
  { title: '棍子数量 +1', description: '多一根棍子环绕攻击', rarity: 'purple', apply: () => { game.orbitStickCount += 1; } },
  { title: '强力棍子', description: '基础攻击之外额外 +3', rarity: 'blue', apply: () => { game.bonusAttack += 3; } },
  { title: '快速旋转', description: '环绕旋转速度提高；旋转已到上限时改为攻击力 +1', rarity: 'blue', apply: () => { if (!addCapped('orbitSpeed', 0.45, characterStatCaps.orbitSpeed)) game.bonusAttack += 1; } },
  { title: '扩大轨道', description: '棍子环绕范围扩大；范围已到上限时改为旋转速度 +0.3', rarity: 'blue', apply: () => { if (!addCapped('orbitRadius', 12, characterStatCaps.orbitRadius)) game.orbitSpeed = Math.min(characterStatCaps.orbitSpeed, game.orbitSpeed + 0.3); } },
  { title: '轻便鞋子', description: '移动速度提高；已到上限时改为生命上限 +12', rarity: 'white', apply: () => { if (!addCapped('moveSpeed', 24, characterStatCaps.moveSpeed)) { game.maxHealth += 12; game.health += 12; } } },
  { title: '奋勇强攻', description: '基础攻击力 +2', rarity: 'white', apply: () => { game.bonusAttack += 2; } },
  { title: '急救包', description: '恢复生命并增加上限', rarity: 'white', apply: () => { game.maxHealth += 20; game.health = Math.min(game.maxHealth, game.health + 35); } },
  { title: '坚韧外衣', description: '每次碰撞少受 2 点伤害', rarity: 'white', apply: () => { game.damageReduction += 2; } },
  { title: '长棍术', description: '环绕棍子的攻击距离增加；已到上限时改为攻击力 +1', rarity: 'blue', apply: () => { if (!addCapped('stickHitHalfLength', 10, characterStatCaps.stickLength)) game.bonusAttack += 1; } },
  { title: '疾风步', description: '冲刺冷却缩短 0.8 秒；已到下限时改为冲刺伤害 +3', rarity: 'white', apply: () => { const next = Math.max(1.6, game.dashCooldownMax - 0.8); if (next < game.dashCooldownMax - 1e-9) { game.dashCooldownMax = next; } else { game.dashBonusDamage += 3; } } },
  { title: '棍云冲撞', description: '冲刺伤害提高，棍子越多伤害越高', rarity: 'purple', apply: () => { game.dashBonusDamage += 3; } },
  { title: '震劲棍法', description: '棍子攻击击退 +2', rarity: 'blue', apply: () => { game.knockback += 2; } },
  { title: '裂地棍劲', description: '所有攻击击退 +4', rarity: 'purple', apply: () => { game.knockback += 4; } },
  { title: '千钧扫荡', description: '所有攻击击退 +7，棍击范围 +8', rarity: 'gold', apply: () => { game.knockback += 7; game.stickHitHalfLength = Math.min(characterStatCaps.stickLength, game.stickHitHalfLength + 8); } },
  { title: '棍势会心', description: '暴击率 +8%；暴击率已满时改为攻击力 +2', rarity: 'blue', apply: () => { if (!addCapped('critChance', 0.08, 0.75)) game.bonusAttack += 2; } },
  { title: '破阵重击', description: '暴击率 +10%，暴击伤害倍率 +0.5', rarity: 'gold', apply: () => { game.critChance = Math.min(0.75, game.critChance + 0.10); game.critMultiplier += 0.5; } },
  { title: '金棍阵', description: '环绕棍子数量 +2', rarity: 'gold', apply: () => { game.orbitStickCount += 2; } },
  { title: '金刚护体', description: '生命上限 +30，碰撞减伤 +3', rarity: 'blue', apply: () => { game.maxHealth += 30; game.health = Math.min(game.maxHealth, game.health + 30); game.damageReduction += 3; } },
  { title: '金钟震荡', description: '最大生命 +40，所有攻击击退 +6', rarity: 'gold', apply: () => { game.maxHealth += 40; game.health = Math.min(game.maxHealth, game.health + 40); game.knockback += 6; } },
  { title: '破军扫棍', description: '攻击力 +7，棍击范围 +24', rarity: 'gold', apply: () => { game.bonusAttack += 7; game.stickHitHalfLength = Math.min(characterStatCaps.stickLength, game.stickHitHalfLength + 24); } },
  { title: '黄金棍阵', description: '环绕棍子 +1，旋转速度 +0.7', rarity: 'gold', apply: () => { game.orbitStickCount += 1; game.orbitSpeed = Math.min(characterStatCaps.orbitSpeed, game.orbitSpeed + 0.7); } },
  { title: '赤霄雷暴棍', description: '雷电棍进化，棍子 +5，旋转速度 +70%，击退 +12', rarity: 'red', apply: () => { game.weaponEvolution = 'lightning'; game.orbitStickCount += 5; game.orbitSpeed *= 1.7; game.knockback += 12; } },
];
// ---- 瘦嘟嘟技能池（2025 按用户要求：全部技能数值 ×1.3）-----------------------------------
// 规则与例外，写在这里以免下一个人以为是笔误：
//   · 连续型数值（伤害/速度/生命/百分比/击退/半径/冷却缩减）一律 ×1.3，保留小数。
//   · **计数型**数值（穿透 +1、弹数 +1、暴击穿透 +2、弹幕圈 +1）改为 Math.ceil(v×1.3)：
//     分数穿透在代码里等价于 floor（每次命中减 1），写 1.3 等于没加强，所以向上取整。
//     这与 scaleCharacterStats() 里对 projectileCount / projectilePierce / orbitStickCount
//     已有的 Math.ceil 处理是同一套口径。
//   · **上限/下限/频率不乘**：上限类（暴击率 0.75、手雷百分比 0.45/0.15、gunCaps 各值）、
//     下限类（射速 0.30、手雷冷却 5 秒）、频率类（chainVolleyEvery=3）。理由：上限与下限
//     不是"数值的增加"；改频率是重做卡的身份（"每 3 轮"→"每 2 轮"），不是加强。
//   · 藏在派生公式里的金/红卡数值（爆破半径与倍率、齐射发数与返还、赤焰弹幕弹数公式）
//     在 balance 里一并乘了，原值写在那边的注释里。
//   · **共享白卡**（轻便鞋子 / 奋勇强攻 / 急救包 / 坚韧外衣）**没有乘** —— 它们是四个角色
//     共用的，乘了会连带加强另外三个角色，超出"加强瘦嘟嘟"的范围。
const rabbitUpgrades = [
  { title: '高压弹头', description: '子弹伤害 +6.5', rarity: 'blue', apply: () => { game.bulletDamage += 6.5; } },
  { title: '快速装填', description: '射击间隔缩短 15.6%；已到射速上限时改为子弹伤害 +2.6', rarity: 'purple', apply: () => { const next = Math.max(characterStatCaps.fireInterval, game.fireInterval * 0.844); if (next < game.fireInterval - 1e-9) { game.fireInterval = next; } else { game.bulletDamage += 2.6; } } },
  { title: '轮流装填', brief: '32.5% 概率额外发射 1 枚，最多叠 4 次', description: '每轮射击有 32.5% 概率额外发射 1 枚追踪子弹，最多叠 4 次；叠满后改为子弹伤害 +3.9', rarity: 'white', apply: () => { const next = Math.min(1, (game.alternateShotChance || 0) + 0.325); if (next > (game.alternateShotChance || 0) + 1e-9) { game.alternateShotChance = next; } else { game.bulletDamage += 3.9; } } },
  { title: '双发点射', description: '每轮额外发射 2 枚追踪子弹；弹数已满时改为子弹伤害 +3.9、弹幕圈再补 2 发', rarity: 'purple', apply: () => { if (!addCapped('projectileCount', 2, 8)) { game.bulletDamage += 3.9; game.radialRingBonus += 2; } } },
  { title: '穿透弹头', description: '每枚子弹可多命中 2 个敌人（红弹幕同样继承）', rarity: 'purple', apply: () => { game.projectilePierce += 2; } },
  { title: '追踪芯片', description: '子弹飞行速度 +130、转向追踪 +1.56；速度已到上限时改为子弹伤害 +3.9', rarity: 'blue', apply: () => { const raised = addCapped('projectileSpeed', 130, gunCaps.projectileSpeed); game.projectileTurnRate += 1.56; if (!raised) game.bulletDamage += 3.9; } },
  { title: '粽叶快投', description: '手雷冷却缩短 1.3 秒（最低 5 秒）；已到下限时改为手雷范围 +18.2', rarity: 'white', apply: () => { const next = Math.max(5, game.grenadeCooldownMax - 1.3); if (next < game.grenadeCooldownMax - 1e-9) { game.grenadeCooldownMax = next; } else { game.grenadeRadius = Math.min(characterStatCaps.grenadeRadius, game.grenadeRadius + 18.2); } } },
  { title: '扩散粽叶', description: '手雷爆炸范围 +41.6；已到上限时改为子弹伤害 +2.6', rarity: 'blue', apply: () => { if (!addCapped('grenadeRadius', 41.6, characterStatCaps.grenadeRadius)) game.bulletDamage += 2.6; } },
  { title: '爆芯糯米', brief: '手雷按生命百分比的伤害提升（有上限）', description: '普通怪手雷伤害 +6.5%（上限 45%），首领伤害 +2.6%（上限 15%）；双双封顶后改为子弹伤害 +3.9', rarity: 'purple', apply: () => { const before = game.grenadeDamageRatio + game.grenadeBossDamageRatio; game.grenadeDamageRatio = Math.min(0.45, game.grenadeDamageRatio + 0.065); game.grenadeBossDamageRatio = Math.min(0.15, game.grenadeBossDamageRatio + 0.026); if (Math.abs(game.grenadeDamageRatio + game.grenadeBossDamageRatio - before) < 1e-9) game.bulletDamage += 3.9; } },
  { title: '急救补给', description: '生命上限 +26 并立刻回复 45.5 点', rarity: 'white', apply: () => { game.maxHealth += 26; game.health = Math.min(game.maxHealth, game.health + 45.5); } },
  { title: '轻装行动', description: '移动速度 +31.2；已到上限时改为生命上限 +15.6', rarity: 'white', apply: () => { if (!addCapped('moveSpeed', 31.2, characterStatCaps.moveSpeed)) { game.maxHealth += 15.6; game.health += 15.6; } } },
  { title: '加大弹匣', description: '子弹伤害 +3.9，射击间隔缩短 0.078 秒（已到射速上限时再 +2.6 伤害）', rarity: 'blue', apply: () => { game.bulletDamage += 3.9; const next = Math.max(characterStatCaps.fireInterval, game.fireInterval - 0.078); if (next < game.fireInterval - 1e-9) { game.fireInterval = next; } else { game.bulletDamage += 2.6; } } },
  { title: '冲击弹头', description: '子弹击退 +3.9', rarity: 'blue', apply: () => { game.knockback += 3.9; } },
  { title: '震荡弹', description: '子弹击退 +6.5，穿透 +2', rarity: 'purple', apply: () => { game.knockback += 6.5; game.projectilePierce += 2; } },
  { title: '弱点瞄准', description: '暴击率 +11.7%；暴击率已满时改为子弹伤害 +3.9', rarity: 'blue', apply: () => { if (!addCapped('critChance', 0.117, 0.75)) game.bulletDamage += 3.9; } },

  // ---- gold: each one adds a mechanic that the red barrage explicitly reads -------------
  {
    title: '精准连射',
    brief: '子弹伤害 +10.4、弹数 +2（弹数已满则弹幕圈 +2）、射速提升；每 3 轮追加环形齐射',
    description: '子弹伤害 +10.4、弹数 +2（弹数已满则弹幕圈再补 2 发）、射击间隔 -0.156；机制「弹链」——每 3 轮射击追加一次 8 发环形齐射，若已解锁赤焰弹幕，则该齐射为弹幕返还 0.325 秒冷却',
    rarity: 'gold',
    apply: () => {
      game.bulletDamage += 10.4;
      // Past the projectile cap the pick still thickens the barrage ring, so a bullet-count
      // upgrade never becomes a dead pick once 弹数 is maxed.
      if (game.projectileCount >= 8) game.radialRingBonus += 2;
      game.projectileCount = Math.min(8, game.projectileCount + 2);
      game.fireInterval = Math.max(characterStatCaps.fireInterval, game.fireInterval - 0.156);
      game.chainVolley = true;
      game.rabbitMechanics += 1;
    },
  },
  {
    title: '重炮弹头',
    brief: '击退 +9.1、子弹伤害 +7.8；子弹每次命中都会小范围爆破',
    description: '子弹击退 +9.1、子弹伤害 +7.8；机制「冲击爆破」——子弹每次命中都会炸开半径 80.6 的爆破（52% 伤害并击退），赤焰弹幕的子弹同样会爆破',
    rarity: 'gold',
    apply: () => {
      game.knockback += 9.1;
      game.bulletDamage += 7.8;
      game.bulletBlast = true;
      game.rabbitMechanics += 1;
    },
  },
  {
    title: '穿甲暴击弹',
    brief: '暴击 +13%、暴伤 +0.65；暴击的子弹额外穿透 +3',
    description: '暴击率 +13%、暴击伤害倍率 +0.65；机制「穿甲」——暴击的子弹额外穿透 +3，赤焰弹幕的子弹全额继承穿透数',
    rarity: 'gold',
    apply: () => {
      game.critChance = Math.min(0.75, game.critChance + 0.13);
      game.critMultiplier += 0.65;
      game.critPierceBonus += 3;
      game.rabbitMechanics += 1;
    },
  },
  {
    title: '反哺',
    brief: '每次击杀永久 +0.5% 最终伤害（上限 +200%），并回复 1 点生命',
    description: '每次击杀都会为自己累积 **+0.5% 最终伤害**（**与等级无关**，升多少级都是 0.5%），上限 **+200%**；同时每次击杀回复 1 点生命。这个加成是**独立乘区、算在所有加成的最后** —— 暴击与连杀倍率都结算完之后才乘上去，所以它不会被任何其它加成重复放大',
    rarity: 'gold',
    apply: () => { game.rabbitFeed = true; },
  },

  { title: '赤焰弹幕', brief: '解锁 360° 赤焰弹幕，继承全部弹药强化', description: '解锁 360° 赤焰弹幕：子弹数 = 5.2 + 弹数×1.3 + 每项弹药机制 2.6 发，伤害/暴击/穿透/爆破全部继承主武器；发射间隔随射速缩短，子弹速度随弹速提升', rarity: 'red', apply: () => { game.radialShotCount = 1; game.radialFireTimer = 0.35; } },
];

// Whites every character can roll apart from their own kit.
const sharedWhiteTitles = ['轻便鞋子', '奋勇强攻', '急救包', '坚韧外衣'];

// ---------------------------------------------------------------------------------------
// 奶大侠 — sword pool. Flat attack follows the same ladder as everyone else
// (white +2 / blue +3~4 / gold +5~7); the flavour is in how the crescent wave behaves.
// ---------------------------------------------------------------------------------------
const daxiaUpgrades = [
  { title: '磨刀石', description: '刀光伤害 +4', rarity: 'blue', apply: () => { game.swordDamage += 4; } },
  { title: '凌厉剑气', description: '攻击力 +2', rarity: 'white', apply: () => { game.bonusAttack += 2; } },
  { title: '破军斩', brief: '攻击 +8、刀光 +8；50% 概率触发双连击', description: '攻击力 +8，刀光伤害 +8；并且每次出刀有 50% 概率触发双连击（连击同样吃满全部加成）', rarity: 'gold', apply: () => { game.bonusAttack += 8; game.swordDamage += 8; game.swordDoubleChance = Math.min(1, game.swordDoubleChance + 0.5); } },
  { title: '快刀式', description: '出刀间隔缩短 12%；已到上限时改为刀光伤害 +3', rarity: 'purple', apply: () => { const next = Math.max(balance.daxiaFireIntervalMin, game.swordFireInterval * 0.88); if (next < game.swordFireInterval - 1e-9) { game.swordFireInterval = next; } else { game.swordDamage += 3; } } },
  { title: '宽刃', description: '月牙刀光横向范围 +20；「寂」的环带厚度同样 +20（环更厚，一圈扫到更多敌人）', rarity: 'blue', apply: () => { game.swordHalfWidth += 20; } },
  { title: '破空劲', description: '刀光推进速度 +40；「寂」的向外扩张速度同样提升', rarity: 'blue', apply: () => { game.swordWaveSpeed += 40; } },
  { title: '余劲不散', description: '刀光衰减推迟 1 秒（2/4 秒 → 3/5 秒）', rarity: 'purple', apply: () => { game.swordFalloffBonus += 1; } },
  { title: '双锋', brief: '每次出刀多两道刀光', description: '每次出刀多两道刀光。合成「寂」之后，本卡不再加刀光，改为让「寂」的伤害 +40%', rarity: 'purple', apply: () => { gainSwordWaves(2); } },
  { title: '三刀流', brief: '刀光数 +3、攻速 +50%', description: '刀光数 +3，出刀间隔缩短为原来的 1/1.5（即攻速 +50%；同样受 0.40 秒下限约束，已到下限时改为刀光伤害 +6）。合成「寂」之后，刀光数部分改为让「寂」的伤害 +60%', rarity: 'gold', apply: () => { gainSwordWaves(3); const next = Math.max(balance.daxiaFireIntervalMin, game.swordFireInterval / (1 + balance.daxiaSanDaoAttackSpeed)); if (next < game.swordFireInterval - 1e-9) { game.swordFireInterval = next; } else { game.swordDamage += 6; } } },
  { title: '剑阵引导', brief: '刀光数 +4', description: '刀光数 +4。刀光数达到 6 即转为「无极剑阵」（360° 全方位出刀），达到 12 合成环形超级刀光「寂」——本卡是走向这两种新形态最快的途径。合成「寂」之后，本卡改为让「寂」的伤害 +80%', rarity: 'gold', apply: () => { gainSwordWaves(4); } },
  { title: '刀气纵横', brief: '刀光穿透不再衰减，刀光伤害 +6', description: '刀光穿透不再衰减（取消首次命中后的 50%/25% 衰减）', rarity: 'gold', apply: () => { game.swordNoFalloff = true; game.swordDamage += 6; } },
  { title: '横扫千军', brief: '刀光横向范围 +70、推进速度 +60', description: '刀光横向范围 +70，刀光推进速度 +60；「寂」的环带厚度与扩张速度同步提升', rarity: 'gold', apply: () => { game.swordHalfWidth = Math.min(240, game.swordHalfWidth + 70); game.swordWaveSpeed += 60; } },
  { title: '无极剑意', brief: '无极闪伤害 +250%', description: '无极闪伤害 +250%（基础为攻击力的 500%）', rarity: 'gold', apply: () => { game.wuxianDamageBonus += 2.5; } },
  { title: '心法·疾', description: '无极闪冷却 -3 秒', rarity: 'purple', apply: () => { game.wuxianCooldownMax = Math.max(6, game.wuxianCooldownMax - 3); } },
  { title: '护体真气', description: '生命上限 +30，碰撞减伤 +3', rarity: 'blue', apply: () => { game.maxHealth += 30; game.health = Math.min(game.maxHealth, game.health + 30); game.damageReduction += 3; } },
  { title: '剑气凝神', description: '暴击率 +8%；已满时改为刀光伤害 +3', rarity: 'blue', apply: () => { if (!addCapped('critChance', 0.08, 0.75)) game.swordDamage += 3; } },
  { title: '刀锋所指', description: '暴击率 +10%，暴击伤害倍率 +0.5', rarity: 'gold', apply: () => { game.critChance = Math.min(0.75, game.critChance + 0.10); game.critMultiplier += 0.5; } },
  { title: '余波震荡', description: '刀光击退 +4', rarity: 'purple', apply: () => { game.knockback += 4; } },
  { title: '疾风步', description: '冲刺冷却缩短 0.8 秒（大侠的冲刺）', rarity: 'white', apply: () => { game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - 0.8); } },
  { title: '血月斩', brief: '攻击 +12、刀光 +12、横向 +50；命中处炸出小血月', description: '攻击力 +12、刀光伤害 +12、刀光横向 +50；并且刀光每命中一个敌人，都会在该处炸出一道小型血月（威力为当前刀光的 70%，不会再扩散）', rarity: 'red', apply: () => { game.bonusAttack += 12; game.swordDamage += 12; game.swordHalfWidth = Math.min(260, game.swordHalfWidth + 50); game.swordBloodMoon = true; } },
];

// ---------------------------------------------------------------------------------------
// 奶小仙 — umbrella pool. Her numbers are all about the umbrella being out: while it is away
// she is fast, tanky and reflective, so duration and return speed are real upgrades.
// ---------------------------------------------------------------------------------------
const xiaoxianUpgrades = [
  { title: '伞骨加固', description: '伞的伤害 +4', rarity: 'blue', apply: () => { game.umbrellaDamage += 4; } },
  { title: '轻抚诀', description: '攻击力 +2', rarity: 'white', apply: () => { game.bonusAttack += 2; } },
  { title: '金缕伞', description: '攻击力 +7，伞的伤害 +4', rarity: 'gold', apply: () => { game.bonusAttack += 7; game.umbrellaDamage += 4; } },
  { title: '回旋加速', description: '伞的飞行与回收速度 +90', rarity: 'blue', apply: () => { game.umbrellaSpeed += 90; } },
  { title: '细针密雨', description: '伞旋转伤害每秒 +8%（基础 50%/秒）', rarity: 'purple', apply: () => { game.umbrellaSpinRatio += 0.08; } },
  { title: '伞面扩张', description: '伞的判定范围 +10', rarity: 'blue', apply: () => { game.umbrellaRadius += 10; } },
  { title: '疾风投掷', brief: '伞回手后更快可以再次投出', description: '伞回到手中后更快可以再次投出', rarity: 'white', apply: () => { game.umbrellaThrowDelay = Math.max(0.12, game.umbrellaThrowDelay - 0.08); } },
  { title: '玉衣淬炼', brief: '反刺玉衣减伤 +8%', description: '反刺玉衣减伤 +8%（基础减免 50%）', rarity: 'purple', apply: () => { game.thornDamageScale = Math.max(0.15, game.thornDamageScale - 0.08); } },
  { title: '荆棘倒刺', brief: '玉衣反弹伤害 +60%', description: '玉衣反弹伤害 +60%（基础 150%）', rarity: 'purple', apply: () => { game.thornReflectRatio += 0.6; } },
  { title: '护心镜', description: '生命上限 +30，碰撞减伤 +3', rarity: 'blue', apply: () => { game.maxHealth += 30; game.health = Math.min(game.maxHealth, game.health + 30); game.damageReduction += 3; } },
  { title: '伞影重重', description: '伞回每把伞的伤害提升 60%', rarity: 'gold', apply: () => { game.umbrellaReturnBonus += 0.6; } },
  { title: '千机伞', description: '伞回额外多 8 把伞', rarity: 'gold', apply: () => { game.umbrellaBurstCount += 8; } },
  { title: '伞·引', brief: '伞离手时成为引力中心，吸引周围的怪', description: '伞离手时成为引力中心：重量低于自身击退值的怪物会被强力吸引，更重的也会被牵引', rarity: 'gold', apply: () => { game.umbrellaAttract = true; } },
  { title: '伞阵', brief: '自身与伞之间、伞与伞之间形成伤害帘幕', description: '自身与每把伞之间、以及伞与伞之间形成伤害帘幕，敌人穿过时持续受伤（只有一把伞时就是一条伞线）', rarity: 'gold', apply: () => { game.umbrellaCurtain = true; } },
  { title: '归鞘回春', brief: '伞收回时的治疗量 +100%', description: '伞收回时的治疗量 +100%（基础为对主要目标伤害的 50%）', rarity: 'gold', apply: () => { game.umbrellaHealBonus += 1; } },
  { title: '缠丝劲', brief: '伞的旋转基础伤害 +15%', description: '伞的旋转伤害基础值 +15%（作用在递增曲线之前）', rarity: 'gold', apply: () => { game.umbrellaSpinRatio += 0.15; } },
  { title: '伞心诀', description: '伞回冷却 -4 秒', rarity: 'purple', apply: () => { game.sanhuiCooldownMax = Math.max(5, game.sanhuiCooldownMax - 4); } },
  { title: '锋锐伞尖', description: '暴击率 +8%；已满时改为伞的伤害 +3', rarity: 'blue', apply: () => { if (!addCapped('critChance', 0.08, 0.75)) game.umbrellaDamage += 3; } },
  { title: '天罗伞', description: '暴击率 +10%，暴击伤害倍率 +0.5', rarity: 'gold', apply: () => { game.critChance = Math.min(0.75, game.critChance + 0.10); game.critMultiplier += 0.5; } },
  { title: '踏云步', description: '冲刺冷却缩短 0.8 秒（小仙的冲刺）', rarity: 'white', apply: () => { game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - 0.8); } },
  {
    title: '万伞归一',
    description: '伞未回手时也能继续投掷，场上最多同时存在 3 把伞；第一把伤害不变，之后每把依次为 50% / 25%，且不会锁定同一目标。**伞不再被回收** —— 杀掉当前目标后会自动寻找场上**绝对血量最高**的敌人继续攻击（不再固定 8 秒收伞，伤害递增封顶在原来 8 秒时的倍率；换目标时「归鞘回血」照常结算）。反刺玉衣转为永久生效，但减伤降为当前的 30%、反伤降为当前的 75%',
    rarity: 'red',
    apply: () => {
      game.umbrellaSwarm = true;
      game.thornPermanent = true;
      // The robe never turns off now, so it is dialled down instead. Scaling the *reduction*
      // (not the damage-taken factor) is what "降到当前的 30%" means.
      game.thornDamageScale = 1 - (1 - game.thornDamageScale) * balance.swarmRobeReductionScale;
      game.thornReflectRatio *= balance.swarmRobeReflectScale;
      syncUmbrellaCount();
    },
  },
];

function loadProfile() {
  try {
    // 读 → 迁移 + 归一化（normalizeProfile 是纯函数，见"存档 schema 版本与迁移"一节）。
    return normalizeProfile(wx.getStorageSync(PROFILE_STORAGE_KEY));
  } catch (error) {
    // 本地存储不可用 / 读档抛出：回退默认档，保证这一局仍然可玩。
    logProfileDiagnostic('读取本地存档失败（' + (error && error.message ? error.message : error) + '）；已回退为默认档。');
    return createDefaultProfile();
  }
}

function saveProfile() {
  try {
    // 写盘时补上当前 schema 版本：老档一旦被任何一次写盘覆盖，就自动升到当前版本。
    wx.setStorageSync(PROFILE_STORAGE_KEY, Object.assign({}, profile, { version: PROFILE_SCHEMA_VERSION }));
  } catch (error) {
    // Keep the current run playable when local storage is unavailable.
  }
}

function getPlantBonuses(owned = profile.plants) {
  const bonuses = { maxHealth: 0, attack: 0, moveSpeed: 0, orbitSpeed: 0, dashCooldown: 0 };
  const setCounts = { blue: 0, purple: 0, gold: 0 };
  for (const id of owned) {
    const plant = plantCatalog.find((item) => item.id === id);
    if (!plant) continue;
    if (plant.set) setCounts[plant.set] += 1;
    if (plant.rarity === 'blue') bonuses.attack += 1;
    else if (plant.rarity === 'purple') bonuses.moveSpeed += 5;
    else if (plant.rarity === 'gold') { bonuses.maxHealth += 8; bonuses.orbitSpeed += 0.12; }
    else if (plant.rarity === 'red') { bonuses.attack += 5; bonuses.maxHealth += 40; }
  }
  if (setCounts.blue >= plantSets.blue.count) bonuses.attack += 3;
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
  game.moveSpeed = Math.min(characterStatCaps.moveSpeed, game.moveSpeed + after.moveSpeed - before.moveSpeed);
  const orbitSpeedGain = after.orbitSpeed - before.orbitSpeed;
  if (game.character === 'rabbit') game.grenadeCooldownMax = Math.max(5, game.grenadeCooldownMax - (after.dashCooldown - before.dashCooldown));
  else if (game.character === 'daxia') game.swordWaveSpeed += orbitSpeedGain * 12;
  else if (game.character === 'xiaoxian') game.umbrellaSpinRatio += orbitSpeedGain * 0.04;
  else game.orbitSpeed = Math.min(characterStatCaps.orbitSpeed, game.orbitSpeed + orbitSpeedGain);
  game.dashCooldownMax = Math.max(1.6, game.dashCooldownMax - (after.dashCooldown - before.dashCooldown));
  game.dashCooldown = Math.min(game.dashCooldown, game.dashCooldownMax);
}

function plantSetCount(setId, owned = profile.plants) {
  return owned.filter((id) => { const plant = plantCatalog.find((item) => item.id === id); return plant && plant.set === setId; }).length;
}

function playSound(name, cooldown = 100, comboPitch = 0) {
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
    // Rising pitch as the kill streak climbs: the cheapest way to make a mow-down
    // loop audibly accelerate as the player gets going.
    audio.playbackRate = comboPitch > 0 ? Math.min(1.9, 1 + comboPitch * 0.025) : 1;
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
  const centerX = game.camera.x + width / 2;
  const centerY = game.camera.y + height / 2;
  return enemy.x + radius >= centerX - width / (2 * gameWorldZoom) && enemy.x - radius <= centerX + width / (2 * gameWorldZoom)
    && enemy.y + radius >= centerY - height / (2 * gameWorldZoom) && enemy.y - radius <= centerY + height / (2 * gameWorldZoom);
}

/**
 * 屏幕内是否至少有一个活着的可见敌人。
 *
 * 通用攻击规则：**除至尊奶以外**的三个角色（瘦嘟嘟 / 奶大侠 / 奶小仙），
 * 屏幕里没有敌人时**不会发动攻击**。至尊奶不受这条约束 —— 她的环绕棍是持续生效的，
 * 根本没有"发动"这个动作。
 * 另外这条只管**自动攻击**；主动技能（无极闪 / 粽子手雷 / 伞回）是玩家自己的操作，
 * 不该被拦住。
 */
function hasVisibleEnemy() {
  for (const enemy of game.enemies) {
    if (enemy.health > 0 && isEnemyVisible(enemy)) return true;
  }
  return false;
}

function getEnemyBuffTotals() {
  return game.enemyBuffs;
}

function getEnemyBuffStep(rarity) {
  const speed = { white: 2, blue: 3, purple: 5, gold: 8, red: 12 }[rarity];
  const damage = { white: 1, blue: 2, purple: 3, gold: 5, red: 8 }[rarity];
  return {
    speed,
    damage,
    health: balance.enemyHealthFlat[rarity],
    healthMultiplier: balance.enemyHealthMultiplier[rarity],
    weight: balance.enemyWeightStep[rarity],
    radius: rarity === 'gold' ? 2 : rarity === 'red' ? 4 : 0,
  };
}

function enemyBuffDescription(rarity) {
  const next = getEnemyBuffStep(rarity);
  const healthPart = `血量 ×${next.healthMultiplier.toFixed(2)} +${next.health}`;
  return `怪物强化：移速 +${next.speed}/秒 · 伤害 +${next.damage} · ${healthPart} · 重量 +${next.weight}`;
}

// Monster health compounds, but the product is clamped: see enemyHealthMultiplierCap.
function nextHealthProduct(current, multiplier) {
  return Math.min(balance.enemyHealthMultiplierCap, current * multiplier);
}

function applyEnemyBuffToEnemy(enemy, rarity) {
  const buff = getEnemyBuffStep(rarity);
  enemy.speed = Math.min(enemyStatCaps.speed, enemy.speed + buff.speed);
  enemy.damage += buff.damage;
  enemy.radius = Math.min(enemyStatCaps.radius, enemy.radius + (buff.radius || 0));
  enemy.weight += buff.weight;
  if (buff.healthMultiplier && buff.healthMultiplier !== 1) {
    const previous = enemy.healthBuffProduct || 1;
    const product = nextHealthProduct(previous, buff.healthMultiplier);
    const applied = product / previous;
    enemy.healthBuffProduct = product;
    enemy.maxHealth *= applied;
    enemy.health *= applied;
  }
  if (buff.health) {
    enemy.maxHealth += buff.health;
    enemy.health += buff.health;
  }
}

function applyEnemyBuff(rarity) {
  const buff = getEnemyBuffStep(rarity);
  game.enemyBuffHistory.push(rarity);
  game.enemyBuffs.speed += buff.speed;
  game.enemyBuffs.damage += buff.damage;
  game.enemyBuffs.healthMultiplier = nextHealthProduct(game.enemyBuffs.healthMultiplier, buff.healthMultiplier || 1);
  game.enemyBuffs.health += buff.health || 0;
  game.enemyBuffs.weight += buff.weight;
  for (const enemy of game.enemies) applyEnemyBuffToEnemy(enemy, rarity);
  if (rarity === 'gold') {
    game.goldPicks += 1;
    triggerMonsterSurge(balance.surgeBurstPerGold, '金色');
  } else if (rarity === 'red') {
    game.redPicks += 1;
    triggerMonsterSurge(balance.surgeBurstPerRed, '红色');
  }
}

function applyCurrentEnemyBuff(enemy) {
  enemy.damage = enemy.damage || (enemy.boss ? 18 : 12);
  enemy.weight = enemy.weight === undefined ? (enemyBaseWeights[enemy.type] || 0) : enemy.weight;
  for (const rarity of game.enemyBuffHistory) applyEnemyBuffToEnemy(enemy, rarity);
  enemy.health = enemy.maxHealth;
  return enemy;
}

// Knockback is a smooth, always-on force: strength = knockback / (knockback + weight).
// The old version gated on knockback/weight >= 0.5, but weight climbs about twice as fast
// as knockback does, so that ratio converged to ~0.476 and the whole stat silently stopped
// working. The new curve never returns zero, so light enemies fly and heavy ones resist.
// A pushed enemy that collides with another enemy deals slam damage to both.
function knockbackEnemy(enemy, directionX, directionY) {
  const power = Math.max(0, game.knockback);
  if (!power) return;
  const weight = Math.max(1, enemy.weight || 1);
  const length = Math.sqrt(directionX * directionX + directionY * directionY);
  if (!length) return;
  const strength = power / (power + weight);
  const maxDistance = balance.knockbackMaxDistance;
  const currentDistance = distanceBetween(enemy, game.player);
  if (currentDistance >= maxDistance) return;
  const distance = Math.min(maxDistance, currentDistance + (maxDistance - currentDistance) * strength);
  enemy.knockbackTargetX = game.player.x + directionX / length * distance;
  enemy.knockbackTargetY = game.player.y + directionY / length * distance;
  enemy.slamPower = strength;
  enemy.slamDone = false;
  enemy.stagger = Math.max(enemy.stagger || 0, 0.16 + strength * 0.16);
  // Trail points so the shove is visible as motion, not as a teleport between two frames.
  enemy.pushTrail = [{ x: enemy.x, y: enemy.y }];
}

// Called while an enemy is being knocked back: bowling into a neighbour hurts both.
// Slam damage scales with the knockback stat, so a knockback build converts the shove into
// real damage instead of just repositioning things. Capped by a share of the victim's max
// health so it can never one-shot.
function resolveSlamDamage(enemy) {
  if (!enemy.slamPower || enemy.slamDone) return;
  for (const other of game.enemies) {
    if (other === enemy || other.health <= 0) continue;
    if (distanceBetween(enemy, other) > enemy.radius + other.radius) continue;
    enemy.slamDone = true;
    const base = game.baseAttack + game.bonusAttack;
    const raw = (base * balance.slamDamageRatio + game.knockback * balance.slamKnockbackRatio) * enemy.slamPower;
    const slam = Math.max(1, Math.round(Math.min(raw, other.maxHealth * balance.slamMaxHealthRatio)));
    applyAttackDamage(other, slam, 'physical');
    applyAttackDamage(enemy, Math.max(1, Math.round(slam * balance.slamSelfRatio)), 'physical');
    other.stagger = Math.max(other.stagger || 0, 0.2);
    // Impact ring so the collision reads as a hit rather than as two sprites touching.
    game.deathPops.push({ x: other.x, y: other.y, radius: balance.slamImpactRadius * 0.5, life: 0.22, maxLife: 0.22, color: '#bfe6ff' });
    burstParticles(other.x, other.y, '#9fd7ff', 7);
    addShake(4, 0.1);
    playSound('hit', 200);
    if (enemy.health <= 0) return;
  }
}

function applyAttackDamage(enemy, baseDamage, element = 'physical', allowCritical = true, allowCombo = true) {
  const critical = allowCritical && Math.random() < game.critChance;
  const comboScale = allowCombo ? comboDamageMultiplier() : 1;
  // 反哺（瘦嘟嘟金卡）是**独立乘区，算在所有加成的最后** —— 排在暴击与连杀倍率之后，
  // 所以它乘的是已经结算完的伤害，不会被任何其它加成重复放大。
  const feedScale = game.rabbitFeed ? 1 + game.rabbitFeedBonus : 1;
  const damage = Math.max(1, Math.round(baseDamage * (critical ? game.critMultiplier : 1) * comboScale * feedScale));
  enemy.health -= damage;
  enemy.hitFlash = 0.16;
  // Exposed so bullet mechanics (穿甲) can react to whether this particular hit crit.
  enemy.lastHitCritical = critical;
  game.damageNumbers.push({
    x: enemy.x + (Math.random() - 0.5) * 12,
    y: enemy.y - 18,
    value: damage,
    critical,
    color: elementalDamageColors[element] || elementalDamageColors.physical,
    life: 0.65,
  });
  // Readability guard: every hit pushes one of these (21 call sites, and a slam pushes two at
  // once), so in a dense horde the floating numbers alone were a hundred-plus text draws per
  // frame - each one a stroke *and* a fill. Everything else the player can spray has a ceiling
  // (particles 140, coin popups 40); this did not. 60 is roughly one screen's worth, which is
  // as many individual numbers as the player can actually read while mowing.
  if (game.damageNumbers.length > 60) game.damageNumbers.splice(0, game.damageNumbers.length - 60);
  if (critical) {
    // A single brief freeze on a big hit; the cooldown stops it from stacking into lag.
    if (game.hitStop <= 0 && game.hitStopCooldown <= 0) {
      game.hitStop = balance.hitStopDuration;
      game.hitStopCooldown = balance.hitStopCooldown;
    }
    addShake(4, 0.12);
  }
  return damage;
}

// Chaining kills is the core loop of a mow-down game, so the streak pays out:
// more damage and more speed while it is alive, which feeds the next kill.
function comboDamageMultiplier() {
  return 1 + Math.min(balance.comboDamageCap, game.combo * balance.comboDamagePerStack);
}

function comboMoveMultiplier() {
  return 1 + Math.min(balance.comboMoveCap, game.combo * balance.comboMovePerStack);
}

function effectiveMoveSpeed() {
  let speed = game.moveSpeed * comboMoveMultiplier();
  // 反刺玉衣 doubles her speed while the umbrella is away.
  const robe = thornRobePower();
  if (robe > 0) speed *= 1 + (balance.thornRobeMoveScale - 1) * robe;
  return Math.min(speed, characterStatCaps.moveSpeed * balance.thornRobeMoveScale);
}

function registerKill() {
  game.combo += 1;
  game.comboTimer = balance.comboWindow;
  if (game.combo > game.bestCombo) game.bestCombo = game.combo;
  game.comboFlash = 0.18;
  checkComboMilestone();
  // 反哺（瘦嘟嘟金卡）：每次击杀固定 +0.5% 最终伤害（**与等级无关**，所以不随成长放大）
  // 并回复 1 点生命。加成的乘法在 applyAttackDamage 的最后一乘里生效。
  if (game.rabbitFeed) {
    game.rabbitFeedBonus = Math.min(balance.rabbitFeedCap, game.rabbitFeedBonus + balance.rabbitFeedPerKill);
    if (game.health < game.maxHealth) {
      game.health = Math.min(game.maxHealth, game.health + balance.rabbitFeedHealPerKill);
    }
  }
}

function addShake(power, time) {
  if (!game) return;
  game.shakePower = Math.max(game.shakePower, power);
  game.shakeTime = Math.max(game.shakeTime, time);
  game.shakeDuration = Math.max(game.shakeDuration, time);
}

function shakeOffset() {
  if (!game || game.shakeTime <= 0 || game.shakeDuration <= 0) return { x: 0, y: 0 };
  const falloff = game.shakeTime / game.shakeDuration;
  const power = game.shakePower * falloff;
  return { x: (Math.random() - 0.5) * 2 * power, y: (Math.random() - 0.5) * 2 * power };
}

function enemyDeathColor(type) {
  if (type === 'boss') return '#c98ad6';
  if (type === 'runner') return '#e0a06a';
  if (type === 'brute') return '#b08a6a';
  if (type === 'elite') return '#d47a8c';
  if (type === 'ape') return '#c08a5a';
  if (type === 'stalker') return '#8f7ac0';
  return '#e0a878';
}

// Shoves the surrounding horde outward - used for the level-up blast so that
// every upgrade lands as a visible "get off me" moment.
function clearSpaceAroundPlayer(radius, push) {
  if (!game) return;
  const px = game.player.x;
  const py = game.player.y;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0) continue;
    const dx = enemy.x - px;
    const dy = enemy.y - py;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (distance > radius) continue;
    enemy.knockbackTargetX = px + dx / distance * (distance + push);
    enemy.knockbackTargetY = py + dy / distance * (distance + push);
    enemy.slamPower = 0.9;
    enemy.slamDone = false;
    enemy.stagger = Math.max(enemy.stagger || 0, 0.4);
  }
}

function levelUpBlast() {
  clearSpaceAroundPlayer(280, 150);
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: 280, life: 0.45, maxLife: 0.45 });
  addShake(13, 0.4);
  game.flash = 0.34;
  game.comboTimer = Math.max(game.comboTimer, balance.comboWindow);
}

// ---- T1.1 ground scars: the field keeps a record of what you cleared ----------------
function addScar(x, y, radius) {
  game.scars.push({ x, y, radius, life: balance.scarLife, maxLife: balance.scarLife, angle: Math.random() * Math.PI });
  if (game.scars.length > balance.maxScars) game.scars.splice(0, game.scars.length - balance.maxScars);
}

// ---- T1.4 pickups that fly into the HUD counter -------------------------------------
function addCoinPop(x, y, seeds) {
  if (game.coinPops.length > 40) return;
  game.coinPops.push({ x, y, seeds, life: balance.coinPopLife, maxLife: balance.coinPopLife, wobble: Math.random() * Math.PI * 2 });
}

function updateCoinPops(delta) {
  for (const pop of game.coinPops) {
    pop.life -= delta;
    pop.wobble += delta * 9;
    const t = 1 - Math.max(0, pop.life) / pop.maxLife;
    const eased = t * t;
    // fly toward the seed counter in the HUD, with a little arc on the way
    pop.x += (game.player.x - pop.x) * eased * 0.35;
    pop.y += (game.player.y - 40 - pop.y) * eased * 0.35 + Math.sin(pop.wobble) * 0.6;
  }
  game.coinPops = game.coinPops.filter((pop) => pop.life > 0);
}

// ---- T1.3 combo milestones ----------------------------------------------------------
// The streak stops being a number and becomes an event: a visible payoff every few dozen
// kills gives the player something to chase inside a single run.
function checkComboMilestone() {
  const next = balance.comboMilestones.find((m) => m === game.combo);
  if (!next) return;
  game.comboMilestone = next;
  game.plantNotice = { text: `×${next} 连杀！`, life: 1.8 };
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: 220, life: 0.4, maxLife: 0.4 });
  clearSpaceAroundPlayer(200, 90);
  addShake(10, 0.35);
  game.flash = Math.max(game.flash, 0.22);
  burstParticles(game.player.x, game.player.y, '#ffd76b', 18);
  playSound('levelup', 260, next * 0.1);
}

// ---- T2.6 an evolution is the run's high point, so it clears the screen ---------------
function evolutionBurst() {
  const damage = (game.baseAttack + game.bonusAttack + game.bulletDamage) * balance.evolutionBurstRatio;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) continue;
    applyAttackDamage(enemy, damage, 'lightning');
  }
  clearSpaceAroundPlayer(520, 320);
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: 520, life: 0.7, maxLife: 0.7 });
  game.invulnTimer = balance.evolutionInvuln;
  game.flash = 0.6;
  addShake(20, 0.6);
}

// ---- T2.5 boss execution: the kill gets its own beat ---------------------------------
function beginBossExecution(enemy) {
  enemy.executed = true;
  enemy.health = 1;
  // `dying` is ticked with the *scaled* delta inside updateGame, while slowMo below is ticked
  // with the real delta in gameLoop. They must start from the same real duration expressed in
  // scaled seconds, or the boss keeps flashing at 1 hp for about a second after the world has
  // already sped back up (measured: ~2.55s instead of the documented 1.5s).
  enemy.dying = balance.bossExecutionTime * balance.bossExecutionTimeScale;
  game.bossExecution = { enemy, timer: balance.bossExecutionTime };
  game.slowMo = Math.max(game.slowMo, balance.bossExecutionTime);
  game.plantNotice = { text: '处决！', life: balance.bossExecutionTime };
  addShake(16, balance.bossExecutionTime);
}

// ---- T3.9 rubber band: keep the fight in the busy band, whatever the build does ------
function updatePressure(delta) {
  const capacity = Math.max(1, enemyCapacity(false));
  const fill = game.enemies.length / capacity;
  const target = fill < balance.pressureLowFill ? balance.pressureMax
    : fill > balance.pressureHighFill ? balance.pressureMin : 1;
  game.pressure += (target - game.pressure) * Math.min(1, delta * balance.pressureResponse);
}

/**
 * 升到「下一级」需要多少经验。
 *
 * 通用规则（对所有角色生效）：**拿到红色技能之后**，升级曲线整体翻倍，且每级的固定增量
 * 从 experiencePerLevel 提高到 redExperienceStep。取值与数值对照见 balance 里的说明。
 * 纯函数、不消耗随机数 → 可以直接断言。
 */
function experienceNeededFor(level) {
  if (!game.redSkillTaken) {
    return balance.experienceBase + level * balance.experiencePerLevel;
  }
  return (balance.experienceBase + level * balance.redExperienceStep) * balance.redExperienceMultiplier;
}

function gainExperience(value) {
  // A bigger horde must not linearly accelerate levelling: each kill is worth proportionally
  // less as the surge raises the ceiling, so XP per second stays roughly flat and the player's
  // stats stop compounding faster than any monster curve can follow.
  const scale = balance.surgeXpDamping
    ? Math.pow(balance.maxEnemiesOnScreen / enemyCapacity(false), balance.surgeXpDampingExponent)
    : 1;
  game.experience += value * scale;
  if (screen !== 'game' || game.experience < game.experienceNeeded) return false;
  game.experience -= game.experienceNeeded;
  game.level += 1;
  game.baseAttack += 1;
  game.knockback += 1;
  game.experienceNeeded = experienceNeededFor(game.level);
  game.upgradeChoices = chooseUpgrades();
  screen = 'upgrade';
  playSound('levelup', 450);
  return true;
}

// Only enemies the player can actually see are worth throwing at - a grenade lobbed at an
// off-screen enemy just looks like it vanished. The margin keeps the landing circle inside
// the screen even for big bosses.
function isOnScreen(entity, margin) {
  const pad = margin === undefined ? 0 : margin;
  return entity.x >= game.camera.x - pad && entity.x <= game.camera.x + width + pad
    && entity.y >= game.camera.y - pad && entity.y <= game.camera.y + height + pad;
}

// ---------------------------------------------------------------------------------------
// 瘦嘟嘟's ammunition web. 赤焰弹幕 re-reads the *current* gun stats every time it fires, so
// every later upgrade keeps feeding it (fire rate, bullet speed, damage, crit, pierce, blast).
// Each gold mechanic also adds bullets to it directly, which is what stops the kit feeling
// like unrelated parts.
// ---------------------------------------------------------------------------------------
function radialFireInterval() {
  const base = Math.max(1e-6, balance.startingFireInterval);
  return Math.max(0.55, balance.radialFireInterval * (game.fireInterval / base));
}

function radialShotCount() {
  const wanted = Math.round(balance.radialBaseCount
    + game.projectileCount * balance.radialPerProjectile
    + game.rabbitMechanics * balance.radialPerMechanic
    + (game.radialRingBonus || 0));
  return Math.max(balance.radialBaseCount, Math.min(gunCaps.maxRingBullets, wanted));
}

// How "closed" the ring currently is. The visual arcs between shots grow with this, so the
// player literally watches the barrage fill in to a full circle as they stack bullet upgrades.
function radialRingFullness(bulletCount) {
  const count = bulletCount === undefined ? radialShotCount() : bulletCount;
  return Math.min(1, count / balance.radialRingFull);
}

function fireRadialBarrage(player, damageScale, forcedCount) {
  const scale = damageScale === undefined ? 1 : damageScale;
  const room = gunCaps.maxRadialBullets - game.radialBullets.length;
  if (room <= 0) return 0;
  const wanted = forcedCount === undefined ? radialShotCount() : forcedCount;
  const count = Math.max(1, Math.min(wanted, room));
  const damage = (game.baseAttack + game.bonusAttack + game.bulletDamage) * balance.rabbitBulletDamageScale * scale;
  const speed = Math.max(140, game.projectileSpeed * balance.radialSpeedRatio);
  const phase = game.elapsed * 0.25;
  // Every shot spans an equal slice of the circle, so the ring is always evenly spread no
  // matter how many bullets it has.
  const step = Math.PI * 2 / count;
  for (let index = 0; index < count; index += 1) {
    const angle = phase + step * index;
    game.radialBullets.push({
      x: player.x + Math.cos(angle) * balance.radialRingRadius,
      y: player.y + Math.sin(angle) * balance.radialRingRadius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      radius: 5,
      life: balance.radialBulletLife,
      piercesLeft: game.projectilePierce,
      hitEnemies: [],
      angle,
      step,
    });
  }
  return count;
}

// 冲击爆破 (重炮弹头): shared by normal and radial bullets so the mechanic reads as one thing.
function bulletImpactBlast(x, y, damage, source) {
  if (!game.bulletBlast) return;
  const blast = damage * balance.bulletBlastRatio;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || enemy === source) continue;
    if (Math.hypot(enemy.x - x, enemy.y - y) > balance.bulletBlastRadius + enemy.radius) continue;
    applyAttackDamage(enemy, blast);
    knockbackEnemy(enemy, enemy.x - x, enemy.y - y);
  }
  game.shockwaves.push({ x, y, radius: balance.bulletBlastRadius, life: 0.22, maxLife: 0.22 });
}

// Pick the best target this bullet is allowed to have. Enemies already claimed by another
// bullet in the same pass are skipped unless there is nothing else to shoot at, so a volley
// spreads over the horde instead of stacking on one enemy.
function chooseBulletTarget(bullet, claimed) {
  let best = null;
  let fallback = null;
  const consider = (current, enemy, distance) => (!current
    || enemy.health < current.enemy.health
    || (enemy.health === current.enemy.health && distance < current.distance))
    ? { enemy, distance } : current;
  for (const enemy of game.enemies) {
    if (!isEnemyVisible(enemy) || bullet.hitEnemies.includes(enemy)) continue;
    const distance = distanceBetween(enemy, bullet);
    if (distance >= balance.bulletSeekRange) continue;
    fallback = consider(fallback, enemy, distance);
    if (claimed.has(enemy)) continue;
    best = consider(best, enemy, distance);
  }
  return (best || fallback) ? (best || fallback).enemy : null;
}

function throwGrenade() {
  if (game.character !== 'rabbit' || game.grenadeCooldown > 0) return false;
  const target = game.enemies.reduce((best, enemy) => {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) return best;
    if (!isOnScreen(enemy, -24)) return best;
    const ratio = enemy.health / Math.max(1, enemy.maxHealth);
    const distance = distanceBetween(enemy, game.player);
    return !best || ratio > best.ratio || (ratio === best.ratio && distance < best.distance)
      ? { enemy, ratio, distance } : best;
  }, null);
  if (!target) return false;
  game.grenades.push({
    fromX: game.player.x, fromY: game.player.y,
    x: target.enemy.x, y: target.enemy.y,
    elapsed: 0, duration: game.grenadeFlightDuration,
  });
  game.grenadeCooldown = game.grenadeCooldownMax;
  return true;
}

function updateGrenades(delta) {
  for (let index = game.grenades.length - 1; index >= 0; index -= 1) {
    const grenade = game.grenades[index];
    grenade.elapsed += delta;
    if (grenade.elapsed < grenade.duration) continue;
    const stunTime = balance.grenadeStunTime;
    for (const enemy of game.enemies) {
      if (enemy.health <= 0 || !isEnemyVisible(enemy) || distanceBetween(enemy, grenade) > game.grenadeRadius + enemy.radius) continue;
      const ratio = enemy.boss ? game.grenadeBossDamageRatio : game.grenadeDamageRatio;
      applyAttackDamage(enemy, Math.max(1, enemy.health * ratio), 'fire', false);
      knockbackEnemy(enemy, enemy.x - grenade.x || 1, enemy.y - grenade.y);
      // Area stun: everything caught in the blast stops acting. The boss only gets a
      // fraction of it so the fight still has teeth.
      const applied = enemy.boss ? stunTime * balance.grenadeBossStunScale : stunTime;
      enemy.stun = Math.max(enemy.stun || 0, applied);
      enemy.stunFlash = 0.3;
      burstParticles(enemy.x, enemy.y, elementalDamageColors.fire, 12);
    }
    game.grenadeExplosions.push({ x: grenade.x, y: grenade.y, life: balance.grenadeExplosionLife, maxLife: balance.grenadeExplosionLife, radius: game.grenadeRadius });
    // A scorch mark outlives the fireball, so the blast leaves a mark on the field.
    game.scars.push({ x: grenade.x, y: grenade.y, radius: game.grenadeRadius * 0.42, life: balance.grenadeScorchLife, maxLife: balance.grenadeScorchLife, angle: Math.random() * Math.PI, scorch: true });
    for (let i = 0; i < 14; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      game.particles.push({ x: grenade.x, y: grenade.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.34 + Math.random() * 0.26, color: i % 3 === 0 ? '#ffd98a' : '#ff7a33' });
    }
    addShake(16, 0.42);
    game.flash = Math.max(game.flash, 0.3);
    game.grenades.splice(index, 1);
    playSound('hit', 180);
  }
}

// ---------------------------------------------------------------------------------------
// 奶大侠 — 月牙刀光
// A crescent is fired toward the nearest enemy. Unlike a bullet it does NOT die on impact:
// it keeps drifting forward, hitting everything it crosses. The first victim takes full
// damage, the rest take 50% until the wave is 2 s old, then 25% until 4 s, after which it
// only fades away.
// ---------------------------------------------------------------------------------------
function pickAttackTarget(avoid) {
  const player = game.player;
  return game.enemies.reduce((best, enemy) => {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) return best;
    if (avoid && avoid.includes(enemy)) return best;
    const distance = distanceBetween(enemy, player);
    if (distance > game.attackRange) return best;
    return !best || distance < best.distance ? { enemy, distance } : best;
  }, null);
}

/**
 * 取最多 count 个**互不相同**的敌人，按「最近优先」排序。
 * 可见性 / 射程规则与 pickAttackTarget 完全一致，只是不再只取一个。
 * 纯确定性、不消耗随机数 → 不会错开随机序列。
 */
function pickAttackTargets(count) {
  const player = game.player;
  const candidates = [];
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) continue;
    const distance = distanceBetween(enemy, player);
    if (distance > game.attackRange) continue;
    candidates.push({ enemy, distance });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const take = Math.min(Math.max(1, count), candidates.length);
  const picked = [];
  for (let index = 0; index < take; index += 1) picked.push(candidates[index].enemy);
  return picked;
}

/**
 * 取**绝对血量最高**的敌人（比的是当前生命值本身，不是百分比、也不是距离）。
 *
 * 用途：奶小仙的红色技能「万伞归一」—— 伞杀掉一个之后不回手，而是自动去找
 * 场上血量最厚的那只继续磨。所以判据必须是"绝对血量"：百分比会在小怪身上
 * 误选出血量只有几十点的目标，而伞的价值恰恰在于磨厚血目标。
 *
 * 只考虑**可见**敌人（与全局索敌规则一致），且不消耗随机数。
 */
function pickHighestHealthEnemy(avoid) {
  let best = null;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) continue;
    if (avoid && avoid.includes(enemy)) continue;
    if (!best || enemy.health > best.health) best = enemy;
  }
  return best;
}

/**
 * 排一次普通攻击的「每道刀光打哪」。
 *
 * 需求背景：原来是**所有刀光都朝同一个目标**打（只是横向错开），于是密集小怪里会出现
 * "三道刀光追着一个小怪打"、其余敌人没人管。现在改成**每道刀光各索一个不同的敌人**。
 *
 * 分配规则：
 *   1. 刀光数 ≤ 敌人数 → 每道刀光各拿一个不同的敌人（一轮发完，这是主要情形）；
 *   2. 刀光数 > 敌人数 → 轮流分配；同一个目标分到多道时，用 offset 横向错开并居中，
 *      避免多道刀光完全重叠（此时 offset 与旧行为的语义一致）。
 * 一个敌人都没有时返回空数组，由调用方决定这次不出刀。
 */
function planSwordVolley(count) {
  const targets = pickAttackTargets(count);
  if (!targets.length) return [];
  const player = game.player;
  const assign = [];
  for (let index = 0; index < count; index += 1) assign.push(targets[index % targets.length]);
  const totalPerTarget = new Map();
  for (const target of assign) totalPerTarget.set(target, (totalPerTarget.get(target) || 0) + 1);
  const seatOf = new Map();
  const spacing = balance.daxiaWaveHalfWidth * 0.55;
  const plan = [];
  for (const target of assign) {
    const seat = seatOf.get(target) || 0;
    seatOf.set(target, seat + 1);
    const n = totalPerTarget.get(target);
    plan.push({
      angle: Math.atan2(target.y - player.y, target.x - player.x),
      offset: n > 1 ? (seat - (n - 1) / 2) * spacing : 0,
    });
  }
  return plan;
}

/**
 * 新月的「刀锋几何」——绘制与测试共用的唯一实现。
 *
 * 刀锋的径向厚度是**两项之和**：
 *   ① 内弧与外弧的半径差：half × (1 − innerRatio)，默认 innerRatio = 0.93 → half × 0.07
 *   ② 内弧圆心沿行进方向的后移量：thick × 1.9
 * 所以要把厚度整体缩到 k 倍，**两项必须一起缩**：
 *   innerRatio = 1 − 0.07k，后移量 = thick × 1.9 × k
 * 只缩 thick 会撞上第 ① 项那个地板（默认 half = 86 → 6px 缩不下去），得不到 30%。
 *
 * 纯计算、不读 game、不消耗随机数 → 可以直接断言。
 * 注意：这里算的都是**绘制**参数；命中判定用的是 game.swordHalfWidth 与
 * balance.daxiaWaveThickness（后者同时驱动 reach / along），本函数一个都不碰。
 *
 * @param k 厚度系数：1 = 不变；daxiaWaveFormBladeScale = 无极剑阵/寂 下的额外变细。
 */
function crescentBladeGeometry(k) {
  const baseGap = 1 - 0.93;   // 内弧半径比带来的径向间隙（相对 half）
  const thick = balance.daxiaWaveThickness * balance.daxiaWaveBladeScale;
  return {
    innerRatio: 1 - baseGap * k,
    offset: thick * 1.9 * k,
    strokeWidth: Math.max(0.8, 2 * k),
  };
}

/**
 * 当前形态下刀锋的额外厚度系数。
 * 进入「无极剑阵」/「寂」后按需求再降到 daxiaWaveFormBladeScale 倍，其余形态为 1。
 */
function currentBladeScale() {
  const mode = swordWaveMode();
  return (mode === 'formation' || mode === 'ji') ? balance.daxiaWaveFormBladeScale : 1;
}

function swordWaveDamageAt(wave) {
  if (game.swordNoFalloff) return wave.damage;
  // 还没碰到过任何敌人 → 一直满伤害（刀光到 daxiaWaveLife 才消失）
  if (!wave.hasHit) return wave.damage;
  const evolved = game.weaponEvolution === 'threefold';
  const earlyRatio = evolved ? 0.7 : balance.daxiaFalloffEarlyRatio;
  const lateRatio = evolved ? 0.4 : balance.daxiaFalloffLateRatio;
  // 以**首次命中敌人**为锚点计时（不是出刀时刻）：命中后的这 2 秒里伤害递减，然后刀光消失。
  const hitAge = wave.hitAge === undefined ? 0 : wave.hitAge;
  const sinceHit = wave.age - hitAge;
  const early = balance.daxiaHitFalloffEarly + game.swordFalloffBonus;
  const late = balance.daxiaHitFalloffLate + game.swordFalloffBonus;
  if (sinceHit < early) return wave.damage * earlyRatio;
  if (sinceHit < late) return wave.damage * lateRatio;
  return 0;
}

// 奶大侠的攻击形态：由「一次普通攻击的刀光数」决定。
//   normal    朝目标方向的并排刀光（原有行为）
//   formation 「无极剑阵」—— 刀光数 ≥ daxiaFormationWaveThreshold，全部刀光 360° 全方位向外
//   ji        「寂」—— 刀光数 ≥ daxiaJiWaveThreshold，全部刀光合成一道环形超级刀光
function swordWaveMode() {
  const count = Math.max(1, game.swordWaveCount);
  if (count >= balance.daxiaJiWaveThreshold) return 'ji';
  if (count >= balance.daxiaFormationWaveThreshold) return 'formation';
  return 'normal';
}

/**
 * 所有「多一道刀光」类技能的唯一入口。
 * - 未合成「寂」：正常增加刀光数（推向 6 道的无极剑阵 / 12 道的寂）；
 * - 已合成「寂」：刀光数不再增加，按"本该加几道"折算成寂的伤害。
 *   waves 道 → waves × daxiaJiDamageStep 的寂伤害加成（+20% / 道）。
 * 这样每张卡的数值只写一处，不必各自复制判断逻辑。
 */
function gainSwordWaves(waves) {
  if (swordWaveMode() === 'ji') {
    game.swordJiScale += balance.daxiaJiDamageStep * waves;
  } else {
    game.swordWaveCount += waves;
  }
}

/**
 * 打出一刀。
 * @param primaryAngle 主轴方向：无极剑阵以它为基准做 360° 等分；「寂」/兜底路径直接用它。
 * @param plan         可选的索敌计划（planSwordVolley 的产物，长度 = 刀光数）。
 *                     常规形态下**每道刀光按计划各索一个不同的敌人**；
 *                     不传时（如破军斩的追击刀光）退回"全部同向、横向并排"的原行为。
 *
 * 刀势（giant / 巨型刀光）机制已整体删除，所以这里不再有 giant 参数，
 * 刀光只有一种规格，也不再有 momentumDamageScale / momentumWidthScale 的缩放。
 */
function fireSwordWave(primaryAngle, plan) {
  const player = game.player;
  const damage = (game.baseAttack + game.bonusAttack + game.swordDamage) * balance.daxiaDamageMultiplier;
  const count = Math.max(1, game.swordWaveCount);
  const life = balance.daxiaWaveLife * (game.weaponEvolution === 'longnight' ? 2 : 1);
  const halfWidth = game.swordHalfWidth;
  const mode = swordWaveMode();

  if (mode === 'ji') {
    // 「寂」：把这一刀的全部刀光合成一道**环形**超级刀光，由内向外扩张。
    // 伤害 = 单道伤害 × 刀光数 × 比例 × 寂倍率 —— 所以"合成"不损失总伤害，
    // 而环形判定能同时覆盖四面八方，实际收益高于原来的一圈并排刀光。
    game.swordWaves.push({
      x: player.x, y: player.y,
      angle: primaryAngle,
      offset: 0,
      age: 0,
      life,
      fade: 1,
      damage: damage * count * balance.daxiaJiDamageRatio * (game.swordJiScale || 1),
      hasHit: false,
      hitEnemies: [],
      halfWidth,
      travelled: 0,
      returned: false,
      // 环形刀光特有字段
      radial: true,
      radius: 0,
      // 环带厚度取 halfWidth → 「宽刃 / 横扫千军」直接让寂变厚（技能联动）
      band: halfWidth * balance.daxiaJiBandScale,
    });
    return;
  }

  const radialVolley = mode === 'formation';
  for (let index = 0; index < count; index += 1) {
    let angle = primaryAngle;
    let offset = 0;
    if (radialVolley) {
      // 无极剑阵：以主轴为基准 360° 等分，每道刀光朝一个方向打出去（不并排、不用 offset）。
      angle = primaryAngle + (index * Math.PI * 2) / count;
    } else if (plan && plan[index]) {
      // 常规形态：每道刀光各索一个不同的敌人（由 planSwordVolley 排好）。
      angle = plan[index].angle;
      offset = plan[index].offset;
    } else if (count > 1) {
      // 兜底（无索敌计划时）：沿用"全部同向、横向并排展开"的原行为。
      offset = (index - (count - 1) / 2) * balance.daxiaWaveHalfWidth * 0.55;
    }
    game.swordWaves.push({
      x: player.x, y: player.y,
      angle,
      offset,
      age: 0,
      life,
      fade: 1,
      damage,
      hasHit: false,
      hitEnemies: [],
      halfWidth,
      travelled: 0,
      returned: false,
    });
  }
}

function updateSwordWaves(delta) {
  for (let index = game.swordWaves.length - 1; index >= 0; index -= 1) {
    const wave = game.swordWaves[index];
    wave.age += delta;
    const speed = game.swordWaveSpeed;
    const travel = speed * delta;
    if (wave.radial) {
      // 「寂」：原地向外扩张，不做 x/y 位移，也不适用残心折返（那是方向性刀光的机制）。
      wave.radius += travel * balance.daxiaJiExpandSpeed;
      if (wave.radius >= balance.daxiaJiMaxRadius) {
        wave.fade = Math.max(0, wave.fade - delta / balance.daxiaWaveFadeTime);
      }
    } else {
      wave.x += Math.cos(wave.angle) * travel;
      wave.y += Math.sin(wave.angle) * travel;
      wave.travelled += travel;
      // 残心 (长夜刀): having reached the end of its lane the crescent turns around and cuts the
      // same enemies a second time. Its age and hit list reset, so the return trip is a full
      // damage pass rather than a spent one.
      if (game.swordReturn && !wave.returned && wave.travelled >= balance.swordReturnRange) {
        wave.returned = true;
        wave.angle += Math.PI;
        wave.age = 0;
        wave.fade = 1;
        wave.hasHit = false;
        // 返回时也是"重新出发"：命中锚点一并清空，否则返程会沿用去程的命中时刻、
        // 一出发就被判定成"早已过期"。
        wave.hitAge = undefined;
        wave.hitEnemies = [];
        wave.travelled = 0;
        burstParticles(wave.x, wave.y, '#dff0ff', 6);
      }
    }
    // 消失时机（以首次命中为锚点）：
    //   没碰到过敌人 → 活满 daxiaWaveLife（4 秒）
    //   碰到过敌人   → 首次命中后再活 daxiaHitLife（2 秒，余劲不散每级 +1 秒）
    const expireAt = wave.hasHit && wave.hitAge !== undefined
      ? wave.hitAge + balance.daxiaHitLife + game.swordFalloffBonus
      : wave.life;
    if (wave.age >= expireAt) wave.fade -= delta / balance.daxiaWaveFadeTime;
    if (wave.fade <= 0) { game.swordWaves.splice(index, 1); continue; }
    const damage = swordWaveDamageAt(wave);
    if (damage <= 0) continue;
    // The crescent is a band lying across the direction of travel.
    const cos = Math.cos(wave.angle);
    const sin = Math.sin(wave.angle);
    const centerX = wave.x - sin * wave.offset;
    const centerY = wave.y + cos * wave.offset;
    const halfWidth = wave.halfWidth === undefined ? game.swordHalfWidth : wave.halfWidth;
    if (wave.radial) {
      // 「寂」的环带判定：|敌人到圆心的距离 − 当前半径| ≤ 环带厚度 + 敌人半径。
      // 与方向性刀光的"带"判定不同，它是一整圈同时结算；每只敌人只被这一道环命中一次
      // （靠 hitEnemies 去重），所以它吃到的是"环扫过它那一刻"的伤害档位。
      for (const enemy of game.enemies) {
        if (enemy.health <= 0 || wave.hitEnemies.includes(enemy)) continue;
        const gap = Math.abs(distanceBetween(enemy, wave) - wave.radius);
        if (gap > wave.band + enemy.radius) continue;
        wave.hitEnemies.push(enemy);
        wave.hasHit = true;
        // 记下"首次命中"的时刻：刀光从这里起算 2 秒递减后消失（未命中则活满 4 秒）
        if (wave.hitAge === undefined) wave.hitAge = wave.age;
        const dealt = applyAttackDamage(enemy, damage);
        // 击退方向：由圆心向外（与环的扩张方向一致）
        knockbackEnemy(enemy, enemy.x - wave.x, enemy.y - wave.y);
        game.damageNumbers[game.damageNumbers.length - 1].color = wave.isSplash ? '#ff9a9a' : '#ffffff';
        burstParticles(enemy.x, enemy.y, wave.isSplash ? '#b3202e' : '#ffffff', 5);
        playSound('hit', 90, game.combo);
        if (dealt > 0) game.swordTrail.push({ x: enemy.x, y: enemy.y, life: 0.25 });
        // 血月斩：环形刀光命中的每一处同样炸出小血月（与方向性刀光规则一致）
        if (game.swordBloodMoon && !wave.isSplash) {
          game.swordWaves.push({
            x: enemy.x, y: enemy.y,
            angle: wave.angle + (Math.random() - 0.5) * balance.daxiaWaveSplashAngleJitter,
            parentAngle: wave.angle,
            offset: 0,
            age: 0,
            life: 1.1,
            fade: 1,
            damage: wave.damage * balance.bloodMoonSplashRatio,
            hasHit: false,
            hitEnemies: [],
            isSplash: true,
            halfWidth: game.swordHalfWidth * balance.bloodMoonSplashWidth,
          });
        }
      }
      continue;
    }
    const reach = halfWidth + balance.daxiaWaveThickness;
    for (const enemy of game.enemies) {
      if (enemy.health <= 0 || wave.hitEnemies.includes(enemy)) continue;
      const dx = enemy.x - centerX;
      const dy = enemy.y - centerY;
      if (dx * dx + dy * dy > (reach + enemy.radius) * (reach + enemy.radius)) continue;
      const along = dx * cos + dy * sin;
      if (Math.abs(along) > balance.daxiaWaveThickness + enemy.radius) continue;
      const across = -dx * sin + dy * cos;
      if (Math.abs(across) > halfWidth + enemy.radius) continue;
      wave.hitEnemies.push(enemy);
      wave.hasHit = true;
      // 记下"首次命中"的时刻：刀光从这里起算 2 秒递减后消失（未命中则活满 4 秒）
      if (wave.hitAge === undefined) wave.hitAge = wave.age;
      const dealt = applyAttackDamage(enemy, damage);
      knockbackEnemy(enemy, cos, sin);
      game.damageNumbers[game.damageNumbers.length - 1].color = wave.isSplash ? '#ff9a9a' : '#bfe6ff';
      burstParticles(enemy.x, enemy.y, wave.isSplash ? '#b3202e' : '#cfe9ff', 5);
      playSound('hit', 90, game.combo);
      if (dealt > 0) game.swordTrail.push({ x: enemy.x, y: enemy.y, life: 0.25 });
      // 血月斩 (red): every victim spawns a smaller crescent of its own, so a wide wave that
      // catches a crowd rolls through it instead of stopping at the first rank.
      if (game.swordBloodMoon && !wave.isSplash) {
        game.swordWaves.push({
          x: enemy.x, y: enemy.y,
          angle: wave.angle + (Math.random() - 0.5) * balance.daxiaWaveSplashAngleJitter,
          // 母刀光的方向：仅供**绘制**时把视觉角度朝它收拢（纯视觉，见 daxiaWaveSplashVisualAngleScale）。
          // 存下来不会多消耗随机数，所以不改变任何已有行为。
          parentAngle: wave.angle,
          offset: 0,
          age: 0,
          life: 1.1,
          fade: 1,
          // Use the parent wave's *base* damage, not this frame's `damage`: that value is
          // recomputed every frame and has already fallen off once the parent has hit anything,
          // so a splash born on a later frame used to deal a quarter of an early one.
          damage: wave.damage * balance.bloodMoonSplashRatio,
          // Must stay false. With true, swordWaveDamageAt() applies the "not the first victim"
          // falloff immediately, so the documented 70% splash really dealt 35%.
          hasHit: false,
          hitEnemies: [],
          isSplash: true,
          halfWidth: game.swordHalfWidth * balance.bloodMoonSplashWidth,
        });
      }
    }
  }
}

function updateDaxiaAttack(delta) {
  const player = game.player;
  game.swordFireTimer -= delta;
  // 索敌：排出「每道刀光各打一个不同敌人」的计划（刀光数 ≤ 敌人数时就是一人一刀）。
  // 无极剑阵 / 寂 两种形态不吃这个计划（前者固定 360° 等分、后者是一道环），
  // 但仍然需要一个主轴方向 —— 用计划里第一道刀光的目标方向即可。
  const mode = swordWaveMode();
  const plan = planSwordVolley(Math.max(1, game.swordWaveCount));
  if (plan.length && game.swordFireTimer <= 0 && !game.victoryPending) {
    const angle = plan[0].angle;
    if (Math.abs(Math.cos(angle)) > 0.05) game.facing = Math.cos(angle) < 0 ? -1 : 1;
    fireSwordWave(angle, plan);
    game.swordFireTimer = game.swordFireInterval;
    burstParticles(player.x + Math.cos(angle) * 30, player.y + Math.sin(angle) * 30, '#dff0ff', 4);
    playSound('pickup', 150, game.combo);
    // 破军斩: half of all swings turn into a two-hit combo. The follow-up is a real wave, so
    // every damage bonus the player has stacked applies to it too.
    if (game.swordDoubleChance > 0 && Math.random() < game.swordDoubleChance) {
      game.swordComboTimer = balance.daxiaComboDelay;
      game.swordComboAngle = angle;
    }
  }
  if (game.swordComboTimer > 0) {
    game.swordComboTimer -= delta;
    if (game.swordComboTimer <= 0) {
      // 通用攻击规则：屏幕内没有敌人时不发动。追击刀光也是"发动一次攻击"，所以同样受约束
      // （旧行为会对着空气补一刀）。
      if (hasVisibleEnemy()) {
        const followAngle = (game.swordComboAngle === undefined ? 0 : game.swordComboAngle) + (Math.random() - 0.5) * 0.3;
        // 追击刀光重新索敌一次，同样一人一刀（而不是全部追同一个目标）。
        fireSwordWave(followAngle, mode === 'normal' ? planSwordVolley(Math.max(1, game.swordWaveCount)) : null);
        const player2 = game.player;
        burstParticles(player2.x + Math.cos(followAngle) * 30, player2.y + Math.sin(followAngle) * 30, '#ffffff', 5);
        playSound('pickup', 120, game.combo);
      }
    }
  }
  updateSwordWaves(delta);
  for (const mark of game.swordTrail) mark.life -= delta;
  if (game.swordTrail.length > 60) game.swordTrail.splice(0, game.swordTrail.length - 60);
  game.swordTrail = game.swordTrail.filter((mark) => mark.life > 0);
}

// 无极闪: one ring of blade light in every direction. 500% of attack power, 15 s cooldown.
function castWuxianFlash() {
  if (game.character !== 'daxia' || game.wuxianCooldown > 0) return false;
  const damage = (game.baseAttack + game.bonusAttack + game.swordDamage)
    * (balance.wuxianDamageRatio + game.wuxianDamageBonus);
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) continue;
    applyAttackDamage(enemy, damage);
    burstParticles(enemy.x, enemy.y, '#dff0ff', 6);
  }
  game.wuxianRays = [];
  for (let i = 0; i < 16; i += 1) game.wuxianRays.push({ angle: i * Math.PI * 2 / 16, t: 0 });
  game.wuxianCooldown = game.wuxianCooldownMax;
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: 560, life: 0.6, maxLife: 0.6 });
  game.flash = 0.6;
  addShake(20, 0.55);
  playSound('levelup', 300, 40);
  return true;
}

function updateWuxianRays(delta) {
  for (const ray of game.wuxianRays) ray.t += delta;
  game.wuxianRays = game.wuxianRays.filter((ray) => ray.t < 0.6);
}

// ---------------------------------------------------------------------------------------
// 奶小仙 — 掷伞
// The umbrella is thrown at an enemy, cuts everything on the way for 100%, then sits on the
// primary target spinning for 50% of attack power per second until that target dies, and
// finally flies home. While it is away she cannot attack at all - that is the cost that
// buys her the 反刺玉衣 (50% damage taken, +100% move speed, 150% damage reflected).
// ---------------------------------------------------------------------------------------
function hasUmbrella() {
  return game.umbrellas.some((u) => u.state === 'held');
}

function makeUmbrella(x, y, damageFactor) {
  return {
    state: 'held', x, y, angle: 0, spin: 0,
    target: null, hitEnemies: [], spinAccum: 0, throwTimer: 0,
    spinTime: 0, primaryDamage: 0, damageFactor: damageFactor === undefined ? 1 : damageFactor,
  };
}

// How many umbrellas she is allowed to have in the air, and what each one is worth.
function umbrellaDamageFactor(index) {
  if (!game.umbrellaSwarm) return 1;
  return balance.umbrellaSwarmFactors[index] || balance.umbrellaSwarmFactors[balance.umbrellaSwarmFactors.length - 1];
}

function syncUmbrellaCount() {
  const wanted = game.umbrellaSwarm ? balance.umbrellaSwarmFactors.length : 1;
  while (game.umbrellas.length > wanted) game.umbrellas.pop();
  while (game.umbrellas.length < wanted) {
    game.umbrellas.push(makeUmbrella(game.player.x, game.player.y, umbrellaDamageFactor(game.umbrellas.length)));
  }
}

// Enemies already claimed by another umbrella; no two umbrellas may grind the same target.
// A flying umbrella has already committed to its target, so it reserves it too - otherwise
// every umbrella thrown in the same instant picks the same enemy.
function lockedEnemies(except) {
  const locked = [];
  for (const u of game.umbrellas) {
    if (u === except || u.state === 'held') continue;
    if (u.target && u.target.health > 0) locked.push(u.target);
  }
  return locked;
}

function throwUmbrella() {
  const umbrella = game.umbrellas.find((u) => u.state === 'held' && u.throwTimer <= 0);
  if (!umbrella) return false;
  const avoid = lockedEnemies(umbrella);
  const target = pickAttackTarget(avoid);
  if (!target) return false;
  const player = game.player;
  const angle = Math.atan2(target.enemy.y - player.y, target.enemy.x - player.x);
  if (Math.abs(Math.cos(angle)) > 0.05) game.facing = Math.cos(angle) < 0 ? -1 : 1;
  umbrella.state = 'flying';
  umbrella.x = player.x;
  umbrella.y = player.y;
  umbrella.angle = angle;
  umbrella.target = target.enemy;
  umbrella.hitEnemies = [];
  umbrella.spinAccum = 0;
  umbrella.spinTime = 0;
  umbrella.primaryDamage = 0;
  playSound('pickup', 200, 0);
  return true;
}

function umbrellaAttackDamage() {
  return (game.baseAttack + game.bonusAttack + game.umbrellaDamage) * balance.umbrellaDamageMultiplier;
}

function updateUmbrellas(delta) {
  syncUmbrellaCount();
  // Any umbrella sitting in her hand gets thrown as soon as there is a free target; with the
  // swarm red skill that means several can be airborne at once.
  if (!game.victoryPending) throwUmbrella();
  for (const umbrella of game.umbrellas) updateOneUmbrella(umbrella, delta);
  updateUmbrellaCurtain(delta);
  game.umbrellaRecalledFlash = Math.max(0, game.umbrellaRecalledFlash - delta);
}

// 伞阵 (gold): the tether from her hand to each deployed umbrella, and the lines between
// umbrellas, become damaging curtains. It works with a single umbrella (the tether alone) and
// turns into a web once 万伞归一 puts more of them in the air.
function umbrellaCurtainSegments() {
  const player = game.player;
  const deployed = game.umbrellas.filter((u) => u.state !== 'held');
  const segments = [];
  for (const u of deployed) {
    if (Math.hypot(u.x - player.x, u.y - player.y) <= balance.curtainMaxLength) {
      segments.push({ a: player, b: u });
    }
  }
  for (let i = 0; i < deployed.length; i += 1) {
    for (let j = i + 1; j < deployed.length; j += 1) {
      const a = deployed[i], b = deployed[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= balance.curtainMaxLength) segments.push({ a, b });
    }
  }
  return segments;
}

function updateUmbrellaCurtain(delta) {
  if (!game.umbrellaCurtain) return;
  game.curtainTimer -= delta;
  if (game.curtainTimer > 0) return;
  game.curtainTimer = balance.curtainTickInterval;
  const segments = umbrellaCurtainSegments();
  if (!segments.length) return;
  const damage = umbrellaAttackDamage() * balance.curtainDamageRatio;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0) continue;
    for (const seg of segments) {
      if (distanceToSegment(enemy, seg.a, seg.b) > balance.curtainWidth + enemy.radius) continue;
      applyAttackDamage(enemy, damage);
      burstParticles(enemy.x, enemy.y, '#cfeade', 3);
      break;
    }
  }
}

// 伞舞: tapping a deployed umbrella calls that one home early, damaging whatever it crosses on
// the way back. This is the active decision she gets during the window where she cannot attack.
function umbrellaAtPoint(x, y) {
  if (game.character !== 'xiaoxian') return null;
  let best = null;
  let bestDistance = 52;
  for (const umbrella of game.umbrellas) {
    if (umbrella.state !== 'flying' && umbrella.state !== 'spinning') continue;
    const gap = Math.hypot(umbrella.x - x, umbrella.y - y);
    if (gap < bestDistance) { bestDistance = gap; best = umbrella; }
  }
  return best;
}

function recallUmbrella(umbrella) {
  if (!umbrella || umbrella.state === 'returning' || umbrella.state === 'held') return false;
  umbrella.state = 'returning';
  umbrella.hitEnemies = [];
  umbrella.target = null;
  umbrella.spinTime = 0;
  game.umbrellaRecalledFlash = 0.35;
  burstParticles(umbrella.x, umbrella.y, '#bfe3d8', 8);
  playSound('pickup', 180, 10);
  return true;
}

/**
 * 归鞘回血：按"这一程对主要目标造成的伤害"结算回血，并清空累计。
 *
 * 正常情况在**伞回到手中的瞬间**调用；但红色技能「万伞归一」让伞不再回手
 * （见 updateOneUmbrella 的自旋分支），所以那一侧改成**每次换目标的瞬间**调用 ——
 * 否则这个机制会随着伞永不回手而永久失效，那是静默的行为倒退。
 */
function settleUmbrellaReturnHeal(umbrella) {
  const heal = Math.round(umbrella.primaryDamage * balance.umbrellaReturnHealRatio * (1 + game.umbrellaHealBonus));
  if (heal > 0 && game.health < game.maxHealth) {
    const player = game.player;
    const before = game.health;
    game.health = Math.min(game.maxHealth, game.health + heal);
    game.healPops.push({ x: player.x, y: player.y - 20, life: 0.9, maxLife: 0.9, value: Math.round(game.health - before) });
    burstParticles(player.x, player.y - 12, '#a8f0c0', 10);
  }
  umbrella.primaryDamage = 0;
}

function updateOneUmbrella(umbrella, delta) {
  const player = game.player;
  umbrella.spin += delta * (umbrella.state === 'spinning' ? 16 : 10);
  umbrella.throwTimer = Math.max(0, umbrella.throwTimer - delta);

  if (umbrella.state === 'held') {
    umbrella.x = player.x;
    umbrella.y = player.y;
    return;
  }

  if (umbrella.state === 'flying' || umbrella.state === 'returning') {
    const returning = umbrella.state === 'returning';
    const speed = returning ? balance.umbrellaReturnSpeed : game.umbrellaSpeed;
    const goalX = returning ? player.x : (umbrella.target && umbrella.target.health > 0 ? umbrella.target.x : player.x);
    const goalY = returning ? player.y : (umbrella.target && umbrella.target.health > 0 ? umbrella.target.y : player.y);
    const dx = goalX - umbrella.x;
    const dy = goalY - umbrella.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 1) umbrella.angle = Math.atan2(dy, dx);
    const travel = speed * delta;
    if (distance <= travel) {
      umbrella.x = goalX;
      umbrella.y = goalY;
      if (returning) {
        umbrella.state = 'held';
        umbrella.target = null;
        umbrella.throwTimer = game.umbrellaThrowDelay;
        // 归鞘回血: half of everything this throw did to its main target.
        settleUmbrellaReturnHeal(umbrella);
        umbrella.spinTime = 0;
      } else {
        umbrella.state = 'spinning';
        umbrella.spinAccum = 0;
        umbrella.spinTime = 0;
      }
    } else {
      umbrella.x += dx / distance * travel;
      umbrella.y += dy / distance * travel;
    }
    // Cuts everything it passes through for full damage, once per enemy per leg.
    const damage = umbrellaAttackDamage() * umbrella.damageFactor;
    for (const enemy of game.enemies) {
      if (enemy.health <= 0 || umbrella.hitEnemies.includes(enemy)) continue;
      if (distanceBetween(enemy, umbrella) > game.umbrellaRadius + enemy.radius) continue;
      umbrella.hitEnemies.push(enemy);
      const dealt = applyAttackDamage(enemy, damage);
      if (enemy === umbrella.target) umbrella.primaryDamage += damage;
      knockbackEnemy(enemy, enemy.x - umbrella.x || 1, enemy.y - umbrella.y);
      burstParticles(enemy.x, enemy.y, '#ffe7a8', 6);
      playSound('hit', 90, game.combo);
      if (dealt <= 0) continue;
    }
    return;
  }

  // spinning: pinned to the primary target. Base 50% of attack power per second, compounding
  // by 1.3x for every second past the third, and yanked home at the 8 second mark.
  //
  // 红色技能「万伞归一」(game.umbrellaSwarm) 会改掉上面后半句：伞**不再被回收**，
  // 杀掉当前目标后自动去找场上**绝对血量最高**的敌人继续磨（见下）。
  const swarm = game.umbrellaSwarm === true;
  const target = umbrella.target;
  if (!target || target.health <= 0 || !game.enemies.includes(target)) {
    if (swarm) {
      // 先在不与其他伞重复锁定的敌人里挑最厚的；敌人不够时放宽（否则伞会空转回手）。
      let next = pickHighestHealthEnemy(lockedEnemies(umbrella));
      if (!next) next = pickHighestHealthEnemy(null);
      if (next) {
        // 换目标：命中表、累积伤害、自旋计时全部重置。
        // spinTime 必须归零 —— 伤害递增是每秒 ×1.3 的指数，跨目标累计会无限膨胀。
        umbrella.target = next;
        umbrella.hitEnemies = [];
        umbrella.spinAccum = 0;
        umbrella.spinTime = 0;
        umbrella.x = next.x;
        umbrella.y = next.y;
        // 归鞘回血原本在"回手瞬间"结算，但伞已经不再回手了 —— 改在这里结算，
        // 否则「归鞘回血」会随着永不回手而彻底失效（静默的行为倒退）。
        settleUmbrellaReturnHeal(umbrella);
        burstParticles(next.x, next.y, '#bfe3d8', 8);
        return;
      }
    }
    umbrella.state = 'returning';
    umbrella.hitEnemies = [];
    return;
  }
  umbrella.spinTime += delta;
  if (swarm) {
    // 不回收：把 spinTime **封顶在 umbrellaMaxSpin**。伤害递增是指数的，不封顶会无限膨胀；
    // 封顶后最大倍率与旧版在 8 秒时达到的值完全一致（1.3^(8-3) ≈ 4.8 倍），
    // 所以这条改动只是"取消收回"，没有顺带把伤害放大。
    umbrella.spinTime = Math.min(umbrella.spinTime, balance.umbrellaMaxSpin);
  } else if (umbrella.spinTime >= balance.umbrellaMaxSpin) {
    umbrella.state = 'returning';
    umbrella.hitEnemies = [];
    burstParticles(umbrella.x, umbrella.y, '#bfe3d8', 8);
    return;
  }
  umbrella.x = target.x;
  umbrella.y = target.y;
  const rampStep = Math.max(0, Math.floor(umbrella.spinTime) - (balance.umbrellaRampDelay - 1));
  const spinRatio = game.umbrellaSpinRatio * Math.pow(balance.umbrellaRampStep, rampStep);
  umbrella.spinAccum += umbrellaAttackDamage() * umbrella.damageFactor * spinRatio * delta;
  if (umbrella.spinAccum >= 1) {
    const chunk = Math.floor(umbrella.spinAccum);
    umbrella.spinAccum -= chunk;
    applyAttackDamage(target, chunk);
    umbrella.primaryDamage += chunk;
    burstParticles(target.x, target.y, '#ffe7a8', 3);
  }
  // A spinning canopy clips whatever is touching it, so she is never fully idle in a crowd.
  umbrella.aoeTimer = (umbrella.aoeTimer || 0) + delta;
  if (umbrella.aoeTimer >= balance.umbrellaSpinSplashInterval) {
    umbrella.aoeTimer = 0;
    const evolved = game.weaponEvolution === 'myriad';
    const ratio = balance.umbrellaSpinSplashRatio * (evolved ? 1.8 : 1);
    const reach = game.umbrellaRadius * balance.umbrellaSpinSplashRadius * (evolved ? 1.5 : 1);
    const splash = umbrellaAttackDamage() * umbrella.damageFactor * ratio;
    for (const enemy of game.enemies) {
      if (enemy === target || enemy.health <= 0) continue;
      if (distanceBetween(enemy, umbrella) > reach) continue;
      applyAttackDamage(enemy, splash);
      burstParticles(enemy.x, enemy.y, '#ffe7a8', 3);
    }
  }
  // 伞·引 (gold): the planted umbrella drags the crowd toward it. The pull strength is the
  // same knockback-vs-weight curve the shove uses, so anything lighter than her knockback
  // value is sucked in hard and heavier enemies only lean toward it.
  if (game.umbrellaAttract) {
    const power = Math.max(1, game.knockback);
    for (const enemy of game.enemies) {
      if (enemy.health <= 0 || enemy.boss || enemy.stun > 0) continue;
      const ax = umbrella.x - enemy.x;
      const ay = umbrella.y - enemy.y;
      const gap = Math.sqrt(ax * ax + ay * ay);
      if (gap <= 1 || gap > balance.umbrellaAttractRadius) continue;
      const weight = Math.max(0.5, enemy.weight || 1);
      const pull = power / (power + weight);
      if (pull < 0.08) continue;
      const speed = balance.umbrellaAttractSpeed * pull;
      enemy.x += ax / gap * speed * delta;
      enemy.y += ay / gap * speed * delta;
      enemy.facing = ax < -0.05 ? -1 : ax > 0.05 ? 1 : enemy.facing;
    }
  }
}
function castUmbrellaReturn() {
  if (game.character !== 'xiaoxian' || game.sanhuiCooldown > 0) return false;
  // Every umbrella comes home at once, wherever it is.
  for (const umbrella of game.umbrellas) {
    umbrella.state = 'held';
    umbrella.x = game.player.x;
    umbrella.y = game.player.y;
    umbrella.target = null;
    umbrella.hitEnemies = [];
    umbrella.spinTime = 0;
    umbrella.throwTimer = game.umbrellaThrowDelay;
  }
  game.umbrellaBurst = [];
  const count = game.umbrellaBurstCount;
  for (let i = 0; i < count; i += 1) {
    game.umbrellaBurst.push({ angle: i * Math.PI * 2 / count, t: 0, hitEnemies: [] });
  }
  game.sanhuiCooldown = game.sanhuiCooldownMax;
  addShake(12, 0.35);
  game.flash = Math.max(game.flash, 0.28);
  playSound('pickup', 250, 20);
  return true;
}

function updateUmbrellaBurst(delta) {
  if (!game.umbrellaBurst.length) return;
  const damage = umbrellaAttackDamage() * (balance.umbrellaReturnRatio + game.umbrellaReturnBonus);
  const player = game.player;
  for (const blade of game.umbrellaBurst) {
    blade.t += delta;
    const progress = Math.min(1, blade.t / balance.umbrellaBurstTime);
    // out and straight back in
    const reach = Math.sin(progress * Math.PI) * balance.umbrellaBurstRadius;
    const x = player.x + Math.cos(blade.angle) * reach;
    const y = player.y + Math.sin(blade.angle) * reach;
    blade.x = x;
    blade.y = y;
    for (const enemy of game.enemies) {
      if (enemy.health <= 0 || blade.hitEnemies.includes(enemy)) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) > balance.umbrellaBurstHitRadius + enemy.radius) continue;
      blade.hitEnemies.push(enemy);
      applyAttackDamage(enemy, damage);
      knockbackEnemy(enemy, enemy.x - player.x, enemy.y - player.y);
      burstParticles(enemy.x, enemy.y, '#ffe7a8', 5);
    }
  }
  game.umbrellaBurst = game.umbrellaBurst.filter((blade) => blade.t < balance.umbrellaBurstTime);
}

// Every point of damage the player takes goes through here, so 反刺玉衣 only has to be
// implemented once.
// How strongly 反刺玉衣 is currently on: full while the umbrella is away, 60% with the
// 玉衣天成 evolution, permanently on (at reduced strength) with the 万伞归一 red skill.
function thornRobePower() {
  if (game.character !== 'xiaoxian') return 0;
  if (game.thornPermanent) return 1;
  if (!hasUmbrella()) return 1;
  return game.weaponEvolution === 'jadeproof' ? 0.6 : 0;
}

// 反刺蓄力: every point of damage the robe turns away charges a thorn burst, so the window
// where she has no umbrella is spent building a counter-attack rather than just running.
function updateThornCharge(delta) {
  if (game.thornCharge < balance.thornChargeMax) return;
  game.thornCharge = 0;
  const damage = (game.baseAttack + game.bonusAttack + game.umbrellaDamage) * balance.thornBurstRatio;
  for (const enemy of game.enemies) {
    if (enemy.health <= 0 || !isEnemyVisible(enemy)) continue;
    if (distanceBetween(enemy, game.player) > balance.thornBurstRadius) continue;
    applyAttackDamage(enemy, damage);
    knockbackEnemy(enemy, enemy.x - game.player.x, enemy.y - game.player.y);
    burstParticles(enemy.x, enemy.y, '#ffb08a', 6);
  }
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: balance.thornBurstRadius, life: 0.45, maxLife: 0.45 });
  game.invulnTimer = Math.max(game.invulnTimer, 0.4);
  game.flash = Math.max(game.flash, 0.25);
  addShake(13, 0.35);
  playSound('levelup', 260, 20);
  game.plantNotice = { text: '反刺爆发！', life: 1.4 };
}

function damagePlayer(amount, source) {
  let damage = Math.max(1, amount - game.damageReduction);
  const robe = thornRobePower();
  if (robe > 0) {
    damage = Math.max(1, Math.round(damage * (1 - (1 - game.thornDamageScale) * robe)));
    if (source && source.health > 0) {
      const reflected = Math.max(1, Math.round(damage * game.thornReflectRatio * robe));
      applyAttackDamage(source, reflected, 'reflect');
      game.robeFlash = 0.3;
      source.reflectFlash = 0.32;
      game.thornCharge = Math.min(balance.thornChargeMax, game.thornCharge + reflected);
    }
  }
  game.health -= damage;
  return damage;
}

function scaleCharacterStats(factor) {
  const multiply = ['maxHealth', 'health', 'baseAttack', 'bonusAttack', 'bulletDamage', 'projectileSpeed', 'projectileTurnRate', 'critMultiplier', 'knockback', 'dashBonusDamage', 'swordDamage', 'umbrellaDamage'];
  multiply.forEach((key) => { if (typeof game[key] === 'number') game[key] *= factor; });
  ['projectileCount', 'projectilePierce', 'orbitStickCount'].forEach((key) => { if (typeof game[key] === 'number') game[key] = Math.ceil(game[key] * factor); });
  game.critChance = Math.min(1, game.critChance * factor);
  // NOTE: damageReduction is deliberately NOT scaled here. It is a *flat subtractive* stat
  // (damagePlayer does `Math.max(1, amount - damageReduction)`), every skill that grants it does
  // so additively (+2 / +3), and enemy damage only runs 12-19. Multiplying it by the gold/red
  // factor compounded to the point of immunity: ~12 flat reduction x 1.1^11 is 28+, which alone
  // floors every contact hit at 1. Multiplicative stats belong in the list above; this one does
  // not. (Removing this line is the whole fix - see D1 04/patches P1.)
  game.dashCooldownMax = Math.max(0.05, game.dashCooldownMax / factor);
  game.dashCooldown = Math.max(0, game.dashCooldown / factor);
  game.characterPowerMultiplier *= factor;
}

function applyRarityFlatBonuses(rarity) {
  const gold = rarity === 'gold';
  const amount = gold ? 1 : 2;
  game.moveSpeed = Math.min(characterStatCaps.moveSpeed, game.moveSpeed + amount * 10);
  if (game.character === 'rabbit') {
    game.attackRange = Math.min(characterStatCaps.attackRange, game.attackRange + amount * 40);
    game.grenadeRadius = Math.min(characterStatCaps.grenadeRadius, game.grenadeRadius + amount * 12);
    game.fireInterval = Math.max(characterStatCaps.fireInterval, game.fireInterval - amount * 0.06);
    game.grenadeCooldownMax = Math.max(5, game.grenadeCooldownMax - amount * 0.3);
  } else if (game.character === 'daxia') {
    game.attackRange = Math.min(characterStatCaps.attackRange, game.attackRange + amount * 40);
    game.swordWaveSpeed += amount * 10;
    game.swordHalfWidth = Math.min(200, game.swordHalfWidth + amount * 4);
    game.swordFireInterval = Math.max(balance.daxiaFireIntervalMin, game.swordFireInterval - amount * 0.03);
  } else if (game.character === 'xiaoxian') {
    game.attackRange = Math.min(characterStatCaps.attackRange, game.attackRange + amount * 40);
    game.umbrellaSpeed += amount * 20;
    game.umbrellaRadius += amount * 3;
    game.umbrellaSpinRatio += amount * 0.02;
    game.sanhuiCooldownMax = Math.max(5, game.sanhuiCooldownMax - amount * 0.3);
  } else {
    game.orbitRadius = Math.min(characterStatCaps.orbitRadius, game.orbitRadius + amount * 12);
    game.stickHitHalfLength = Math.min(characterStatCaps.stickLength, game.stickHitHalfLength + amount * 4);
    game.attackSpeedMultiplier = Math.min(characterStatCaps.attackSpeedMultiplier, game.attackSpeedMultiplier + amount * 0.15);
    game.orbitSpeed = Math.min(characterStatCaps.orbitSpeed, game.orbitSpeed + amount * 0.4);
  }
}

background.onload = () => {
  backgroundReady = true;
  draw();
};
background.src = 'assets/field-storybook.jpg';

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

grenadeSprite.onload = () => { grenadeReady = true; draw(); };
grenadeSprite.src = 'assets/zongzi-grenade.png';

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

daxiaSprite.onload = () => { daxiaReady = true; draw(); };
daxiaSprite.src = 'assets/daxia-hero.png';

xiaoxianSprite.onload = () => { xiaoxianReady = true; draw(); };
xiaoxianSprite.src = 'assets/xiaoxian-fairy.png';

umbrellaSprite.onload = () => { umbrellaReady = true; draw(); };
umbrellaSprite.src = 'assets/xiaoxian-umbrella.png';

// The two new heroes are handled by a sprite without a 180-degree baked-in body, so they use
// the same horizontal-mirroring helper as everyone else.
function getCharacterSprite(id) {
  if (id === 'rabbit') return rabbitSprite;
  if (id === 'daxia') return daxiaSprite;
  if (id === 'xiaoxian') return xiaoxianSprite;
  return characterSprite;
}

function isCharacterSpriteReady(id) {
  if (id === 'rabbit') return rabbitReady;
  if (id === 'daxia') return daxiaReady;
  if (id === 'xiaoxian') return xiaoxianReady;
  return characterReady;
}

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

// Interactive rectangles are pure functions of the screen size, so drawing and touch
// handling read the same numbers. They used to be written into module-level variables by
// the draw functions, which made every hit test depend on a previous draw having run.
function insideRect(rect, touch) {
  return touch.clientX >= rect.x && touch.clientX <= rect.x + rect.width
    && touch.clientY >= rect.y && touch.clientY <= rect.y + rect.height;
}

function menuLayout() {
  const buttonWidth = Math.min(240, width - 48);
  // Clamp so the stack still fits: the last button ends at buttonY + 222 + 38, so at 0.57h the
  // bottom edge (0.57h + 260) runs past the screen once h < ~605 - on a 568pt screen it hung
  // 15.8px off the bottom while the touch rect stayed complete, i.e. visible-cut but clickable.
  const buttonY = Math.min(height * 0.57, height - 272);
  return {
    start: { x: (width - buttonWidth) / 2, y: buttonY, width: buttonWidth, height: 60 },
    wardrobe: { x: width / 2 - 90, y: buttonY + 76, width: 180, height: 42 },
    garden: { x: width / 2 - 90, y: buttonY + 126, width: 180, height: 42 },
    enemyCodex: { x: width / 2 - 90, y: buttonY + 176, width: 180, height: 38 },
    skillCodex: { x: width / 2 - 90, y: buttonY + 222, width: 180, height: 38 },
  };
}

function characterCardBounds(index) {
  // Four characters now, so the row of two became a 2x2 grid.
  const cardWidth = (width - 52) / 2;
  return {
    x: 18 + (index % 2) * (cardWidth + 16),
    y: height * 0.325 + Math.floor(index / 2) * 68,
    width: cardWidth,
    height: 62,
  };
}

function wardrobePanel() { return { x: 20, y: height * 0.14, width: width - 40, height: height * 0.70 }; }
function gardenPanel() { return { x: 18, y: height * 0.12, width: width - 36, height: height * 0.76 }; }
function codexPanel() { return { x: 16, y: height * 0.07, width: width - 32, height: height * 0.86 }; }
function enemyCodexPanel() { return { x: 16, y: height * 0.055, width: width - 32, height: height * 0.89 }; }
function backButtonBounds(panel) { return { x: panel.x + 12, y: panel.y + 11, width: 56, height: 32 }; }
function plantCodexButtonBounds() {
  const panel = gardenPanel();
  return { x: width / 2 - 82, y: panel.y + panel.height - 52, width: 164, height: 36 };
}
function pauseButtonBounds() { return { x: 12, y: 108, width: 64, height: 30 }; }
function pauseMenuBounds() {
  return {
    resume: { x: width * 0.18, y: height * 0.44, width: width * 0.64, height: 52 },
    settle: { x: width * 0.18, y: height * 0.55, width: width * 0.64, height: 52 },
  };
}
function resultButtonBounds() { return { x: 48, y: height * 0.64, width: width - 96, height: 52 }; }

// ---- skill codex layout ----------------------------------------------------------------
function skillCodexPanel() { return { x: 14, y: height * 0.04, width: width - 28, height: height * 0.92 }; }
function skillCodexTabBounds(index) {
  const panel = skillCodexPanel();
  const gap = 6;
  const tabWidth = (panel.width - 24 - gap * 3) / 4;
  return { x: panel.x + 12 + index * (tabWidth + gap), y: panel.y + 52, width: tabWidth, height: 32, id: characters[index].id };
}
function skillCodexRowBounds(index) {
  const panel = skillCodexPanel();
  const top = panel.y + 124;
  const available = panel.y + panel.height - 34 - top;
  const perColumn = Math.ceil(24 / 2);
  const rowHeight = Math.min(50, available / perColumn);
  const columnWidth = (panel.width - 34) / 2;
  return {
    x: panel.x + 14 + (index % 2) * (columnWidth + 6),
    y: top + Math.floor(index / 2) * rowHeight,
    width: columnWidth,
    height: rowHeight - 4,
  };
}
// Chinese text has no spaces, so wrapping is done by character budget - no measureText needed.
function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines, fontSize) {
  const perLine = Math.max(1, Math.floor(maxWidth / fontSize));
  const lines = [];
  for (let i = 0; i < text.length && lines.length < maxLines; i += perLine) lines.push(text.slice(i, i + perLine));
  if (lines.length === maxLines && text.length > perLine * maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + '…';
  }
  lines.forEach((line, i) => context.fillText(line, x, y + i * lineHeight));
  return lines.length;
}
function drawBackButton(panel) {
  const rect = backButtonBounds(panel);
  context.fillStyle = '#315e37';
  roundedRect(rect.x, rect.y, rect.width, rect.height, 10);
  context.fillStyle = '#fff7d9';
  context.textAlign = 'center';
  context.font = 'bold 14px sans-serif';
  context.fillText('返回', rect.x + rect.width / 2, rect.y + 21);
}

function drawMenu() {
  const layout = menuLayout();
  const buttonX = layout.start.x;
  const buttonY = layout.start.y;
  const buttonWidth = layout.start.width;
  const buttonHeight = layout.start.height;

  context.fillStyle = '#b9df8b';
  context.fillRect(width / 2 - width / (2 * gameWorldZoom), height / 2 - height / (2 * gameWorldZoom), width / gameWorldZoom, height / gameWorldZoom);
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
  context.strokeText('小院清理队', width / 2, height * 0.185);
  context.fillText('小院清理队', width / 2, height * 0.185);

  context.fillStyle = '#477a3c';
  context.font = '16px sans-serif';
  context.fillText('春日到了，来整理你的小院吧', width / 2, height * 0.228);
  context.font = '14px sans-serif';
  context.fillText(`最高 ${profile.bestTime} 秒 · 最多清理 ${profile.bestKills} 只 · ${profile.coins} 金币`, width / 2, height * 0.268);

  context.font = 'bold 12px sans-serif'; context.fillStyle = '#315e37';
  context.fillText('选择出战角色', width / 2, height * 0.305);
  characters.forEach((character, index) => {
    const card = characterCardBounds(index);
    context.fillStyle = profile.character === character.id ? '#fff0ba' : 'rgba(255, 250, 226, 0.94)';
    roundedRect(card.x, card.y, card.width, card.height, 12);
    if (profile.character === character.id) { context.strokeStyle = '#c58e37'; context.lineWidth = 2; context.stroke(); }
    context.textAlign = 'left'; context.fillStyle = '#315e37'; context.font = 'bold 14px sans-serif';
    context.fillText(character.name, card.x + 10, card.y + 23);
    context.font = '10px sans-serif'; context.fillStyle = '#71805c';
    context.fillText(`${character.style} · ${character.description}`, card.x + 10, card.y + 41);
    context.font = '9px sans-serif';
    context.fillText(profile.character === character.id ? '已选择' : '点击选择', card.x + 10, card.y + 54);
    const preview = getCharacterSprite(character.id);
    const previewReady = isCharacterSpriteReady(character.id);
    if (previewReady) {
      const boxHeight = card.height - 12;
      const boxWidth = boxHeight * preview.width / preview.height;
      context.drawImage(preview, card.x + card.width - boxWidth - 6, card.y + 6, boxWidth, boxHeight);
    }
  });
  context.textAlign = 'center';

  context.fillStyle = '#315e37';
  roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 16);
  context.fillStyle = '#fff7d9';
  context.font = 'bold 20px sans-serif';
  context.fillText('开始清理', width / 2, buttonY + 38);
  context.fillStyle = '#315e37';
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(layout.wardrobe.x, layout.wardrobe.y, layout.wardrobe.width, layout.wardrobe.height, 14);
  context.fillStyle = '#315e37';
  context.font = 'bold 16px sans-serif';
  context.fillText('装扮小院队员', width / 2, layout.wardrobe.y + 28);
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(layout.garden.x, layout.garden.y, layout.garden.width, layout.garden.height, 14);
  context.fillStyle = '#315e37';
  context.font = 'bold 16px sans-serif';
  context.fillText(`打理小院 · 种子 ${profile.seeds}`, width / 2, layout.garden.y + 28);
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(layout.enemyCodex.x, layout.enemyCodex.y, layout.enemyCodex.width, layout.enemyCodex.height, 14);
  context.fillStyle = '#315e37';
  context.fillText('敌人图鉴 · 波次挑战', width / 2, layout.enemyCodex.y + 25);
  context.fillStyle = 'rgba(255, 250, 226, 0.94)';
  roundedRect(layout.skillCodex.x, layout.skillCodex.y, layout.skillCodex.width, layout.skillCodex.height, 14);
  context.fillStyle = '#315e37';
  context.fillText('技能图鉴 · 四角色全技能', width / 2, layout.skillCodex.y + 25);
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
  const panel = gardenPanel();
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
  const codex = plantCodexButtonBounds();
  context.fillStyle = '#e8d7a9'; roundedRect(codex.x, codex.y, codex.width, codex.height, 11);
  context.fillStyle = '#315e37'; context.font = 'bold 14px sans-serif'; context.textAlign = 'center';
  context.fillText(`植物图鉴 ${profile.plants.filter((id) => id !== 'red-hidden').length}/12`, width / 2, codex.y + 23);
  drawBackButton(panel);
  context.fillStyle = '#71805c'; context.font = '11px sans-serif'; context.fillText('装饰等级和效果会同步到战斗地图', width / 2, panel.y + panel.height - 10);
}

function drawSkillCodex() {
  drawMenu();
  context.fillStyle = 'rgba(24, 47, 29, 0.8)';
  context.fillRect(0, 0, width, height);
  const panel = skillCodexPanel();
  context.fillStyle = '#fff7d9';
  roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center';
  context.fillStyle = '#315e37';
  context.font = 'bold 21px sans-serif';
  context.fillText('技能图鉴', width / 2, panel.y + 30);
  context.font = '10px sans-serif';
  context.fillStyle = '#71805c';
  context.fillText('切换角色查看其全部可获得技能与进化路线', width / 2, panel.y + 45);

  // character tabs
  characters.forEach((character, index) => {
    const tab = skillCodexTabBounds(index);
    const active = skillCodexCharacter === character.id;
    context.fillStyle = active ? '#477a3c' : '#edf3df';
    roundedRect(tab.x, tab.y, tab.width, tab.height, 9);
    context.fillStyle = active ? '#fff7d9' : '#315e37';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.fillText(character.name, tab.x + tab.width / 2, tab.y + 21);
  });

  // active skill + summary
  const activeInfo = {
    supreme: '主动：冲刺（冲撞伤害，冷却 4.5 秒）',
    rabbit: '主动：粽子手雷（按生命百分比范围伤害 + 范围眩晕）',
    daxia: `主动：无极闪（CD ${balance.wuxianCooldown} 秒，攻击力 500% 全屏刀光）`,
    xiaoxian: `主动：伞回（CD ${balance.sanhuiCooldown} 秒，12 把伞各 120% 攻击力）`,
  };
  context.textAlign = 'left';
  context.fillStyle = '#b37c2e';
  context.font = 'bold 10px sans-serif';
  context.fillText(activeInfo[skillCodexCharacter], panel.x + 14, panel.y + 100);
  context.textAlign = 'left';
  context.fillStyle = '#71805c';
  context.font = '9px sans-serif';
  context.fillText(characterCodices[skillCodexCharacter], panel.x + 14, panel.y + 114);

  // skills, then evolutions
  const skills = skillsForCharacter(skillCodexCharacter).slice();
  const evolutions = (evolutionTable[skillCodexCharacter] || []).map((e) => ({ title: e.title, description: e.description, rarity: 'gold' }));
  const all = skills.concat(evolutions);
  all.forEach((skill, index) => {
    const row = skillCodexRowBounds(index);
    const rarity = skillRarity[skill.rarity];
    context.fillStyle = skill.evolution ? '#fff2cd' : '#f2f6ea';
    roundedRect(row.x, row.y, row.width, row.height, 8);
    context.fillStyle = rarity.color;
    context.fillRect(row.x, row.y + 3, 3, row.height - 6);
    context.textAlign = 'left';
    context.fillStyle = rarity.color;
    context.font = 'bold 10px sans-serif';
    context.fillText(`${skill.evolution ? '★进化' : rarity.label} · ${skill.title}`, row.x + 9, row.y + 15, row.width - 14);
    context.fillStyle = '#6b7956';
    context.font = '8px sans-serif';
    drawWrappedText(skill.description, row.x + 9, row.y + 27, row.width - 16, 10, 2, 8);
  });

  context.fillStyle = '#71805c';
  context.font = '9px sans-serif';
  context.textAlign = 'center';
  context.fillText(`共 ${all.length} 项（含 ${evolutions.length} 条进化）`, width / 2, panel.y + panel.height - 26);
  drawBackButton(panel);
}

function drawEnemyCodex() {
  drawMenu(); context.fillStyle = 'rgba(24, 47, 29, 0.78)'; context.fillRect(0, 0, width, height);
  const panel = enemyCodexPanel();
  context.fillStyle = '#fff7d9'; roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center'; context.fillStyle = '#315e37'; context.font = 'bold 22px sans-serif'; context.fillText('敌人图鉴', width / 2, panel.y + 34);
  context.font = '11px sans-serif'; context.fillStyle = '#71805c'; context.fillText(`每 ${balance.waveDuration} 秒进入新波次，完成击杀目标可获得种子`, width / 2, panel.y + 55);
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
  drawBackButton(panel);
  context.fillStyle = '#71805c'; context.font = '10px sans-serif'; context.fillText(`首领约 ${(balance.bossSpawnTime / 60).toFixed(1)} 分钟后准时登场 · 精英怪从后期波次出现`, width / 2, panel.y + panel.height - 12);
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

// The "attack speed" plant bonus lands on whatever each kit actually uses.
function plantSpeedLabel(perUnit) {
  if (profile.character === 'rabbit') return `射击间隔 -${(perUnit * 0.16).toFixed(3)}秒`;
  if (profile.character === 'daxia') return `刀光速度 +${Math.round(perUnit * 12)}`;
  if (profile.character === 'xiaoxian') return `伞旋转伤害 +${(perUnit * 0.04).toFixed(3)}`;
  return `棍子转速 +${perUnit}`;
}

function plantBonusLabel(plant) {
  if (plant.rarity === 'blue') return '永久攻击 +1';
  if (plant.rarity === 'purple') return '永久移动速度 +5';
  if (plant.rarity === 'gold') return `永久生命 +8、${plantSpeedLabel(0.12)}`;
  return '隐藏加成：攻击 +5、生命 +40';
}

function plantSetBonusLabel(setId) {
  if (setId === 'gold') return `生命 +40、移速 +10、${plantSpeedLabel(0.6)}`;
  return plantSets[setId].bonus;
}

function drawCodex() {
  drawMenu(); context.fillStyle = 'rgba(24, 47, 29, 0.78)'; context.fillRect(0, 0, width, height);
  const panel = codexPanel();
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
  drawBackButton(panel);
  context.fillStyle = '#71805c'; context.font = '10px sans-serif';
  context.fillText(`套装加成：蓝 ${plantSetBonusLabel('blue')} · 紫 ${plantSetBonusLabel('purple')} · 金 ${plantSetBonusLabel('gold')}`, width / 2, panel.y + panel.height - 12, panel.width - 24);
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
  const panel = wardrobePanel();
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
  drawBackButton(panel);
}

function gardenBuff(id) {
  return gardenProjects.find((item) => item.id === id).buff(profile.garden[id]);
}

function startGame() {
  const worldWidth = Math.max(width * balance.worldScreens, balance.worldMinWidth);
  const worldHeight = Math.max(height * balance.worldScreens, balance.worldMinHeight);
  const player = { x: worldWidth / 2, y: worldHeight / 2, radius: 15 };
  const plantBonuses = getPlantBonuses();
  const startingHealth = balance.startingMaxHealth + gardenBuff('tree') + plantBonuses.maxHealth;
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
    plants: [],
    bullets: [],
    radialBullets: [],
    fireTimer: 0.35,
    radialShotCount: 0,
    radialFireTimer: 0,
    radialFireInterval: balance.radialFireInterval,
    radialBulletSpeed: 340,
    radialRingBonus: 0,
    // 瘦嘟嘟's ammunition web
    bulletBlast: false,
    critPierceBonus: 0,
    rabbitMechanics: 0,
    chainVolley: false,
    chainVolleyCounter: 0,
    chainVolleyFired: 0,
    grenades: [],
    grenadeExplosions: [],
    grenadeCooldown: 0,
    grenadeCooldownMax: Math.max(5, balance.grenadeCooldown - gardenBuff('path') - plantBonuses.dashCooldown),
    grenadeDamageRatio: balance.grenadeNormalRatio,
    grenadeBossDamageRatio: balance.grenadeBossRatio,
    grenadeRadius: balance.startingGrenadeRadius,
    grenadeFlightDuration: balance.grenadeFlightDuration,
    bulletDamage: 0,
    projectileCount: 1,
    // 反哺：解锁标记 + 已累积的最终伤害加成（0.005/击杀，封顶 2.0 = +200%）
    rabbitFeed: false,
    rabbitFeedBonus: 0,
    alternateShotChance: 0,
    projectilePierce: 0,
    projectileSpeed: balance.startingProjectileSpeed,
    projectileTurnRate: balance.startingProjectileTurnRate,
    attackRange: balance.startingAttackRange,
    attackSpeedMultiplier: 1,
    characterPowerMultiplier: 1,
    critChance: balance.startingCritChance,
    critMultiplier: balance.startingCritMultiplier,
    fireInterval: Math.max(characterStatCaps.fireInterval, balance.startingFireInterval - (profile.character === 'rabbit' ? plantBonuses.orbitSpeed * 0.16 : 0)),
    plantSpawnTimer: balance.plantSpawnFirst,
    plantNotice: null,
    victoryPending: false,
    victoryTimer: 0,
    damageNumbers: [],
    particles: [],
    health: startingHealth,
    maxHealth: startingHealth,
    seedsEarned: 0,
    level: 1,
    experience: 0,
    // 第一级刻意留成 5（而不是公式在 L=1 给出的 6），保持开局手感不变；
    // 之后每次升级都由 experienceNeededFor() 重算。
    experienceNeeded: 5,
    // 通用规则：是否已拿到过红色技能 → 决定升级曲线走哪一套（见 experienceNeededFor）
    redSkillTaken: false,
    kills: 0,
    elapsed: 0,
    wave: 1,
    waveKills: 0,
    waveGoal: balance.waveGoalBase + 1,
    waveNotice: 2.4,
    bossSpawned: false,
    resultWon: false,
    endless: false,
    endlessStart: 0,
    nextBossAt: 0,
    bossActive: false,
    baseAttack: balance.startingBaseAttack + plantBonuses.attack + gardenBuff('pond'),
    bonusAttack: 0,
    knockback: balance.startingKnockback,
    damageReduction: gardenBuff('fence'),
    stickHitHalfLength: balance.startingStickHalfLength,
    orbitStickCount: 1,
    orbitRadius: balance.startingOrbitRadius,
    orbitSpeed: balance.startingOrbitSpeed + gardenBuff('campfire') + (profile.character === 'rabbit' ? 0 : plantBonuses.orbitSpeed),
    moveSpeed: balance.startingMoveSpeed + gardenBuff('windmill') + plantBonuses.moveSpeed,
    spawnTimer: 0,
    damageCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashCooldownMax: Math.max(1.6, balance.dashCooldown - gardenBuff('path') - plantBonuses.dashCooldown),
    dashX: 0,
    dashY: 0,
    dashBonusDamage: 0,
    upgradeChoices: [],
    pendingUpgrade: null,
    goldPicks: 0,
    redPicks: 0,
    combo: 0,
    comboTimer: 0,
    comboFlash: 0,
    bestCombo: 0,
    hitStop: 0,
    hitStopCooldown: 0,
    shakeTime: 0,
    shakeDuration: 0,
    shakePower: 0,
    flash: 0,
    deathPops: [],
    shockwaves: [],
    scars: [],
    coinPops: [],
    surgeWarnings: [],
    pressure: 1,
    slowMo: 0,
    invulnTimer: 0,
    bossExecution: null,
    comboMilestone: 0,
    resultTimer: 0,
    rolls: { kills: 0, coins: 0, seeds: 0 },
    // 奶大侠: lingering crescent waves plus the 无极闪 screen clear.
    swordWaves: [],
    swordFireTimer: 0.3,
    swordDamage: 0,
    swordFireInterval: balance.daxiaFireInterval,
    swordWaveSpeed: balance.daxiaWaveSpeed,
    swordHalfWidth: balance.daxiaWaveHalfWidth,
    swordWaveCount: 1,
    // 无极剑阵 / 寂：寂解锁后，「+1 刀光」的技能改为给这里加成（每级 +daxiaJiDamageStep）。
    swordJiScale: 1,
    swordFalloffBonus: 0,
    swordBloodMoon: false,
    swordNoFalloff: false,
    swordDoubleChance: 0,
    swordComboTimer: 0,
    swordComboAngle: 0,
    // 残心 (长夜刀): the crescent turns round and cuts the same lane again.
    // （刀势相关的 swordMomentum / swordMomentumReady 已随该机制一并删除）
    swordReturn: false,
    wuxianCooldown: 0,
    wuxianCooldownMax: balance.wuxianCooldown,
    wuxianDamageBonus: 0,
    wuxianRays: [],
    swordTrail: [],
    // 奶小仙: one umbrella that has to physically come back before she can act again.
    umbrellaDamage: 0,
    umbrellaSpeed: balance.umbrellaSpeed,
    umbrellaRadius: balance.umbrellaRadius,
    umbrellaSpinRatio: balance.umbrellaSpinRatio,
    umbrellaThrowDelay: balance.umbrellaThrowDelay,
    umbrellas: [makeUmbrella(player.x, player.y, 1)],
    umbrellaSwarm: false,
    umbrellaCurtain: false,
    curtainTimer: 0,
    umbrellaRecalledFlash: 0,
    thornPermanent: false,
    thornCharge: 0,
    umbrellaAttract: false,
    healPops: [],
    umbrellaBurst: [],
    umbrellaReturnBonus: 0,
    umbrellaBurstCount: balance.umbrellaBurstCount,
    umbrellaHealBonus: 0,
    sanhuiCooldown: 0,
    sanhuiCooldownMax: balance.sanhuiCooldown,
    thornDamageScale: balance.thornRobeDamageScale,
    thornReflectRatio: balance.thornRobeReflectRatio,
    thornAoE: false,
    robeFlash: 0,
    enemyBuffs: { speed: 0, damage: 0, health: 0, weight: 0, healthMultiplier: 1 },
    enemyBuffHistory: [],
    redSkillOffered: false,
    weaponEvolution: null,
    event: null,
    nextEventAt: balance.eventFirstAt + Math.random() * 12,
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
    if (drop.bossHidden && game.victoryPending) { finishGame(true); return true; }  }
  return false;
}

function updateCamera() {
  game.camera.x = Math.max(0, Math.min(game.worldWidth - width, game.player.x - width / 2));
  game.camera.y = Math.max(0, Math.min(game.worldHeight - height, game.player.y - height / 2));
}

function gameLoop(timestamp) {
  let delta = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = timestamp;
  if (screen === 'result') {
    // Keep animating so the result screen can roll its numbers up.
    if (game) game.resultTimer += delta;
    draw();
    requestAnimationFrame(gameLoop);
    return;
  }
  if (screen === 'game') {
    // Brief freeze frame on a big hit. The cooldown in applyAttackDamage keeps it from
    // stacking into permanent slow motion during heavy mowing.
    if (game && game.hitStop > 0) {
      game.hitStop = Math.max(0, game.hitStop - delta);
      delta *= 0.25;
    }
    // Boss execution: the world drops into slow motion for the kill.
    if (game && game.slowMo > 0) {
      game.slowMo = Math.max(0, game.slowMo - delta);
      delta *= balance.bossExecutionTimeScale;
    }
    updateGame(delta);
  }
  draw();

  if (screen === 'game' || screen === 'upgrade' || screen === 'upgradeDetail' || screen === 'upgradeConfirm' || screen === 'paused' || screen === 'result') requestAnimationFrame(gameLoop);
  else loopRunning = false;
}

// One place decides how crowded the field may get. The ambient spawner fills up to the
// current ceiling; scripted events and the boss may use the small reserve on top. Every
// gold/red pick raises the ceiling, so a strong build is rewarded with a bigger crowd to
// cut through, and the hard cap keeps low-end devices at frame rate.
function surgeCapacityBonus() {
  if (!game) return 0;
  let bonus = game.goldPicks * balance.surgePerGold + game.redPicks * balance.surgePerRed;
  // While a boss is alive the field is allowed to be busier, so the fight keeps its horde.
  if (game.bossActive) bonus += balance.bossPhaseCapacityBonus;
  // Endless mode keeps widening the field as the run drags on.
  if (game.endless) bonus += Math.floor((game.elapsed - (game.endlessStart || game.elapsed)) / 30) * balance.endlessCapacityRamp;
  return bonus;
}

function enemyCapacity(includeReserve) {
  const base = Math.min(balance.maxEnemiesHardCap, balance.maxEnemiesOnScreen + surgeCapacityBonus());
  if (!includeReserve) return base;
  return Math.min(balance.maxEnemiesHardCap + balance.eventEnemyReserve, base + balance.eventEnemyReserve);
}

function spawnEnemyAtEdge() {
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
    basic: { radius: 12, health: 12, speed: 44, experience: 1, damage: 12, weight: enemyBaseWeights.basic },
    runner: { radius: 10, health: 9, speed: 74, experience: 1, damage: 11, weight: enemyBaseWeights.runner },
    brute: { radius: 16, health: 26, speed: 33, experience: 2, damage: 15, weight: enemyBaseWeights.brute },
    elite: { radius: 19, health: 44, speed: 47, experience: 3, damage: 16, weight: enemyBaseWeights.elite },
    ape: { radius: 22, health: 60, speed: 32, experience: 4, damage: 19, weight: enemyBaseWeights.ape },
    stalker: { radius: 14, health: 22, speed: 90, experience: 2, damage: 14, weight: enemyBaseWeights.stalker },
  }[type];
  const healthScale = Math.pow(1 + balance.waveHealthCompound, wave - 1);
  const maxHealth = Math.round(stats.health * healthScale);
  game.enemies.push(applyCurrentEnemyBuff({ x, y, ...stats, type, health: maxHealth, maxHealth, speed: stats.speed + Math.random() * 8, facing: 1 }));
  trackEnemySeen(type);
  return true;
}

// The reward for a strong pick: an instant crowd around the player, not just a higher cap.
function spawnSurge(count) {
  let spawned = 0;
  const directions = [];
  for (let index = 0; index < count; index += 1) {
    if (game.enemies.length >= enemyCapacity(true)) break;
    const before = game.enemies.length;
    spawnEnemyAtEdge();
    if (game.enemies.length > before) {
      const fresh = game.enemies[game.enemies.length - 1];
      directions.push(Math.atan2(fresh.y - game.player.y, fresh.x - game.player.x));
      spawned += 1;
    }
  }
  // Edge arrows pointing at where the wave is closing in from, so the surge has an approach
  // the player can read before it lands.
  if (directions.length) {
    const step = Math.max(1, Math.floor(directions.length / 4));
    for (let i = 0; i < directions.length; i += step) {
      game.surgeWarnings.push({ angle: directions[i], life: balance.surgeWarningLife, maxLife: balance.surgeWarningLife });
    }
  }
  return spawned;
}

function triggerMonsterSurge(count, label) {
  const spawned = spawnSurge(count);
  if (spawned > 0) {
    game.plantNotice = { text: `${label}技能 · 怪物潮来袭！同屏上限 ${enemyCapacity(false)}`, life: 2.8 };
  }
  addShake(8, 0.3);
}

function spawnBoss() {
  const side = Math.floor(Math.random() * 4);
  let x = game.camera.x + width / 2;
  let y = game.camera.y + height / 2;
  if (side === 0) y = game.camera.y - 30;
  if (side === 1) x = game.camera.x + width + 30;
  if (side === 2) y = game.camera.y + height + 30;
  if (side === 3) x = game.camera.x - 30;
  x = Math.max(32, Math.min(game.worldWidth - 32, x));
  y = Math.max(90, Math.min(game.worldHeight - 32, y));
  game.enemies.push(applyCurrentEnemyBuff({ x, y, type: 'boss', radius: 30, health: balance.bossBaseHealth, maxHealth: balance.bossBaseHealth, speed: 32, boss: true, experience: 0, facing: 1, specialTimer: 2.2, dashTimer: 0 }));
  trackEnemySeen('boss');
}

function startEndless() {
  game.endless = true;
  game.endlessStart = game.elapsed;
  game.bossSpawned = true;
  game.nextBossAt = game.elapsed + balance.endlessBossInterval;
  game.plantNotice = { text: '首领已击退 · 无尽模式开始，撑到倒下为止', life: 4.5 };
  game.flash = 0.55;
  addShake(18, 0.6);
  game.shockwaves.push({ x: game.player.x, y: game.player.y, radius: 620, life: 0.8, maxLife: 0.8 });
  playSound('levelup', 400, 60);
}

function spawnEnemy() {
  // In endless mode a fresh boss arrives on its own timer, so the pressure never goes away.
  if (game.endless && game.nextBossAt && game.elapsed >= game.nextBossAt && !game.bossActive) {
    game.nextBossAt = game.elapsed + balance.endlessBossInterval;
    if (game.enemies.length < enemyCapacity(true)) spawnBoss();
    return;
  }
  if (game.elapsed >= bossSpawnTime && !game.bossSpawned) {
    // The boss must arrive on schedule. It used to just wait for a free slot, and because the
    // rubber band keeps the field near its ceiling that wait could last indefinitely - measured
    // runs where the boss never appeared at all in 15 minutes because the field was full on
    // 100% of frames. Making room guarantees the appointment.
    if (game.enemies.length >= enemyCapacity(true)) {
      let furthestIndex = -1;
      let furthestDistance = -1;
      for (let index = 0; index < game.enemies.length; index += 1) {
        const other = game.enemies[index];
        if (other.boss) continue;
        const gap = distanceBetween(other, game.player);
        if (gap > furthestDistance) { furthestDistance = gap; furthestIndex = index; }
      }
      if (furthestIndex < 0) return;
      game.enemies.splice(furthestIndex, 1);
    }
    game.bossSpawned = true;
    spawnBoss();
    return;
  }
  // Deliberately `false`: the ambient spawner stops at the BASE cap and leaves the
  // balance.eventEnemyReserve slots free, otherwise a random event or the boss could find the
  // field already full and never appear (that exact failure is documented above). Surge and
  // event paths pass `true` on purpose - this is a design difference, not a drifted 口径.
  if (game.enemies.length >= enemyCapacity(false)) return;
  spawnEnemyAtEdge();
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
      if (game.enemies.length >= enemyCapacity(true)) break;
      const type = index === 0 ? 'ape' : 'stalker';
      const stats = type === 'ape'
        ? { radius: 22, health: 60, speed: 32, experience: 4, damage: 19 }
        : { radius: 14, health: 22, speed: 90, experience: 2, damage: 14 };
      const enemy = applyCurrentEnemyBuff({ ...stats, x: event.x + (index ? 44 : -44), y: event.y, type, health: stats.health, maxHealth: stats.health, facing: 1, eventSerial: event.serial });
      game.enemies.push(enemy); trackEnemySeen(type);
    }
    event.goal = Math.max(1, game.enemies.filter((enemy) => enemy.eventSerial === event.serial).length);
    game.plantNotice = { text: '随机事件：精英怪突袭，击败 ' + event.goal + ' 名敌人', life: 3.5 };
  }
  game.event = event;
  game.nextEventAt = game.elapsed + balance.eventIntervalMin + Math.random() * balance.eventIntervalSpread;
}

function applyRandomEventReward() {
  const rewards = [
    { label: '基础生命 +15', apply: () => { game.maxHealth += 15; game.health = Math.min(game.maxHealth, game.health + 15); } },
    { label: '攻击力 +1', apply: () => { game.baseAttack += 1; } },
    { label: game.character === 'rabbit' ? '攻击距离 +60' : game.character === 'daxia' ? '刀光横向范围 +24' : game.character === 'xiaoxian' ? '伞的判定范围 +14' : '棍击距离 +12', apply: () => { if (game.character === 'rabbit') game.attackRange = Math.min(characterStatCaps.attackRange, game.attackRange + 60); else if (game.character === 'daxia') game.swordHalfWidth = Math.min(200, game.swordHalfWidth + 24); else if (game.character === 'xiaoxian') game.umbrellaRadius += 14; else game.stickHitHalfLength = Math.min(characterStatCaps.stickLength, game.stickHitHalfLength + 12); } },
    { label: game.character === 'rabbit' ? '手雷冷却 -1 秒' : game.character === 'daxia' ? '无极闪冷却 -2 秒' : game.character === 'xiaoxian' ? '伞回冷却 -2 秒' : '棍击速度 +15%', apply: () => { if (game.character === 'rabbit') game.grenadeCooldownMax = Math.max(5, game.grenadeCooldownMax - 1); else if (game.character === 'daxia') game.wuxianCooldownMax = Math.max(6, game.wuxianCooldownMax - 2); else if (game.character === 'xiaoxian') game.sanhuiCooldownMax = Math.max(5, game.sanhuiCooldownMax - 2); else game.attackSpeedMultiplier = Math.min(characterStatCaps.attackSpeedMultiplier, game.attackSpeedMultiplier + 0.15); } },
    { label: game.character === 'rabbit' ? '子弹转向速度 +1.5' : game.character === 'daxia' ? '刀光推进速度 +30' : game.character === 'xiaoxian' ? '伞旋转伤害 +0.06' : '棍子旋转速度 +0.3', apply: () => { if (game.character === 'rabbit') game.projectileTurnRate += 1.5; else if (game.character === 'daxia') game.swordWaveSpeed += 30; else if (game.character === 'xiaoxian') game.umbrellaSpinRatio += 0.06; else game.orbitSpeed += 0.3; } },
    { label: '移动速度 +12', apply: () => { game.moveSpeed = Math.min(characterStatCaps.moveSpeed, game.moveSpeed + 12); } },
    { label: '击退效果 +2', apply: () => { game.knockback += 2; } },
  ];
  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  reward.apply();
  return reward.label;
}

function finishRandomEvent(success) {
  if (!game.event) return;
  const bonus = success ? applyRandomEventReward() : null;
  game.plantNotice = { text: success ? `事件完成！种子 +6 · 额外强化：${bonus}` : '事件结束，未完成目标', life: 3.5 };
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

// Enemies close to this radius and stop there: close enough to keep hurting the player,
// far enough out that the orbiting sticks can still reach them.
function enemyStopRange(enemy) {
  if (!balance.enemyStandoff) return game.player.radius + enemy.radius;
  return game.player.radius + enemy.radius * 0.75;
}

function separateEnemies() {
  const enemies = game.enemies;
  if (balance.enemySeparation <= 0 || enemies.length < 2) return;
  for (let i = 0; i < enemies.length; i += 1) {
    const a = enemies[i];
    if (a.health <= 0) continue;
    for (let j = i + 1; j < enemies.length; j += 1) {
      const b = enemies[j];
      if (b.health <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDistance = a.radius + b.radius;
      const squared = dx * dx + dy * dy;
      if (squared >= minDistance * minDistance || squared < 0.0001) continue;
      const distance = Math.sqrt(squared);
      const overlap = Math.min(balance.enemySeparation * 0.05 + (minDistance - distance) * 0.5, 3);
      const nx = dx / distance;
      const ny = dy / distance;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
    }
  }
}

function updateGame(delta) {
  game.moveSpeed = Math.min(characterStatCaps.moveSpeed, game.moveSpeed);
  game.attackRange = Math.min(characterStatCaps.attackRange, game.attackRange);
  game.grenadeRadius = Math.min(characterStatCaps.grenadeRadius, game.grenadeRadius);
  game.orbitRadius = Math.min(characterStatCaps.orbitRadius, game.orbitRadius);
  game.stickHitHalfLength = Math.min(characterStatCaps.stickLength, game.stickHitHalfLength);
  game.orbitSpeed = Math.min(characterStatCaps.orbitSpeed, game.orbitSpeed);
  game.attackSpeedMultiplier = Math.min(characterStatCaps.attackSpeedMultiplier, game.attackSpeedMultiplier);
  game.fireInterval = Math.max(characterStatCaps.fireInterval, game.fireInterval);
  game.projectileSpeed = Math.min(gunCaps.projectileSpeed, game.projectileSpeed);
  game.elapsed += delta;
  game.bossActive = game.enemies.some((enemy) => enemy.boss && enemy.health > 0);
  if (game.experience >= game.experienceNeeded && gainExperience(0)) return;
  const nextWave = game.endless
    ? Math.floor(game.elapsed / balance.waveDuration) + 1
    : Math.min(balance.finalWave, Math.floor(game.elapsed / balance.waveDuration) + 1);
  if (nextWave !== game.wave) {
    if (game.wave < balance.finalWave || game.endless) {
      const complete = game.waveKills >= game.waveGoal;
      if (complete) game.seedsEarned += 2;
      game.plantNotice = { text: complete ? `第 ${game.wave} 波挑战完成 · 种子 +2` : `第 ${game.wave} 波挑战未完成`, life: 3 };
    }
    game.waveKills = 0;
    game.waveGoal = (nextWave < balance.finalWave || game.endless) ? balance.waveGoalBase + nextWave : 0;
    game.waveNotice = 2.4;
  }
  game.wave = nextWave;
  game.waveNotice = Math.max(0, game.waveNotice - delta);
  game.spawnTimer -= delta;
  game.damageCooldown -= delta;
  game.dashCooldown = Math.max(0, game.dashCooldown - delta);
  game.grenadeCooldown = Math.max(0, game.grenadeCooldown - delta);
  game.lightningCooldown = Math.max(0, game.lightningCooldown - delta);
  game.wuxianCooldown = Math.max(0, game.wuxianCooldown - delta);
  game.sanhuiCooldown = Math.max(0, game.sanhuiCooldown - delta);
  game.robeFlash = Math.max(0, game.robeFlash - delta);
  game.hitStopCooldown = Math.max(0, game.hitStopCooldown - delta);
  game.invulnTimer = Math.max(0, game.invulnTimer - delta);
  game.comboFlash = Math.max(0, game.comboFlash - delta);
  game.flash = Math.max(0, game.flash - delta);
  game.shakeTime = Math.max(0, game.shakeTime - delta);
  if (game.shakeTime <= 0) game.shakePower = 0;
  if (game.combo > 0) {
    game.comboTimer -= delta;
    if (game.comboTimer <= 0) { game.combo = 0; game.comboTimer = 0; game.comboMilestone = 0; }
  }
  for (const scar of game.scars) scar.life -= delta;
  game.scars = game.scars.filter((scar) => scar.life > 0);
  for (const warning of game.surgeWarnings) warning.life -= delta;
  game.surgeWarnings = game.surgeWarnings.filter((warning) => warning.life > 0);
  updateCoinPops(delta);
  updatePressure(delta);
  for (const pop of game.deathPops) pop.life -= delta;
  game.deathPops = game.deathPops.filter((pop) => pop.life > 0);
  for (const pop of game.healPops) pop.life -= delta;
  game.healPops = game.healPops.filter((pop) => pop.life > 0);
  for (const wave of game.shockwaves) wave.life -= delta;
  game.shockwaves = game.shockwaves.filter((wave) => wave.life > 0);
  game.grenadeExplosions.forEach((explosion) => { explosion.life -= delta; });
  game.grenadeExplosions = game.grenadeExplosions.filter((explosion) => explosion.life > 0);
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
  const moveSpeed = effectiveMoveSpeed();
  if (game.input.x < -0.05) game.facing = -1;
  else if (game.input.x > 0.05) game.facing = 1;
  if (game.dashTimer > 0) {
    player.x += game.dashX * moveSpeed * balance.dashSpeedFactor * delta;
    player.y += game.dashY * moveSpeed * balance.dashSpeedFactor * delta;
    game.dashTimer = Math.max(0, game.dashTimer - delta);
  } else {
    player.x += game.input.x * moveSpeed * delta;
    player.y += game.input.y * moveSpeed * delta;
  }
  player.x = Math.max(player.radius, Math.min(game.worldWidth - player.radius, player.x));
  player.y = Math.max(72 + player.radius, Math.min(game.worldHeight - player.radius, player.y));
  updateCamera();

  if (!game.victoryPending && game.spawnTimer <= 0) {
    spawnEnemy();
    // The spawner speeds up with the surge so a raised ceiling actually fills, and the
    // rubber band trims it up or down to keep the field in the busy band.
    const baseInterval = Math.max(balance.spawnIntervalMin, balance.spawnIntervalStart - (game.wave - 1) * balance.spawnIntervalStep);
    const bossBoost = game.bossActive ? balance.bossPhaseSpawnBoost : 1;
    game.spawnTimer = baseInterval / ((1 + surgeCapacityBonus() * balance.surgeSpawnRate) * game.pressure * bossBoost);
  }

  if (game.character === 'rabbit') {
    game.fireTimer -= delta;
    let chainVolleyDue = false;
    const target = game.enemies.reduce((best, enemy) => {
      if (!isEnemyVisible(enemy)) return best;
      const distance = distanceBetween(enemy, player);
      if (distance > game.attackRange) return best;
      return !best || enemy.health < best.enemy.health || (enemy.health === best.enemy.health && distance < best.distance)
        ? { enemy, distance } : best;
    }, null);
    if (target && game.fireTimer <= 0 && !game.victoryPending && game.bullets.length < gunCaps.maxTrackingBullets) {
      // Clamp the volley, not just the gate: otherwise a burst (including the 轮流装填
      // bonus shot) can overshoot the cap by a whole volley's worth of bullets.
      const room = gunCaps.maxTrackingBullets - game.bullets.length;
      let count = Math.min(8, game.projectileCount, room);
      if (game.alternateShotChance > 0 && Math.random() < game.alternateShotChance) count += 1;
      count = Math.max(0, Math.min(count, room));
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
          trajectory: 'track', damage: (game.baseAttack + game.bonusAttack + game.bulletDamage) * balance.rabbitBulletDamageScale,
          speed: game.projectileSpeed, piercesLeft: game.projectilePierce,
          explosive: game.weaponEvolution === 'explosion', hitEnemies: [],
        });
      }
      game.fireTimer = game.fireInterval;
      burstParticles(player.x + Math.cos(aimAngle) * 25, player.y + Math.sin(aimAngle) * 25, '#ffd65b', 2);
      // 弹链: count volleys and flag every Nth one.
      if (game.chainVolley) {
        game.chainVolleyCounter = (game.chainVolleyCounter || 0) + 1;
        chainVolleyDue = game.chainVolleyCounter % balance.chainVolleyEvery === 0;
      }
    }
    // Target assignment pass. Every bullet used to pick the lowest-HP enemy independently, so
    // a whole volley converged on one victim while the rest of the horde walked in untouched.
    // Bullets now claim targets in order, so a volley fans out across the crowd - and only
    // fall back to doubling up once every reachable enemy is already claimed.
    const claimed = new Set();
    for (const bullet of game.bullets) {
      if (bullet.fade !== undefined) { bullet.seekTarget = null; continue; }
      bullet.seekTarget = chooseBulletTarget(bullet, claimed);
      if (bullet.seekTarget) claimed.add(bullet.seekTarget);
    }
    for (const bullet of game.bullets) {
      bullet.previous = { x: bullet.x, y: bullet.y };
      if (bullet.fade !== undefined) {
        // Lost its target: coast on the last heading and fade, instead of blinking out.
        bullet.fade -= delta;
      } else {
        const nextTarget = bullet.seekTarget ? { enemy: bullet.seekTarget } : null;
        if (!nextTarget) {
          bullet.fade = balance.bulletFadeTime;
        } else {
          const dx = nextTarget.enemy.x - bullet.x;
          const dy = nextTarget.enemy.y - bullet.y;
          const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const turn = Math.min(1, delta * game.projectileTurnRate);
          bullet.vx += (dx / length * bullet.speed - bullet.vx) * turn;
          bullet.vy += (dy / length * bullet.speed - bullet.vy) * turn;
        }
        bullet.life = (bullet.life === undefined ? balance.bulletLifetime : bullet.life - delta);
      }
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      if (bullet.x < -80 || bullet.y < -80 || bullet.x > game.worldWidth + 80 || bullet.y > game.worldHeight + 80) bullet.fade = 0;
    }
    game.bullets = game.bullets.filter((bullet) => bullet.life > 0 && (bullet.fade === undefined || bullet.fade > 0));

    if (game.radialShotCount > 0) {
      game.radialFireTimer -= delta;
      // The radial barrage was the single biggest source of screen clutter (measured 45
      // projectiles alive at once), so it fires fewer shots, less often, and stops adding
      // while its own live count is already at the cap.
      // 通用攻击规则：屏幕内没有敌人时不发动（否则会对着空气刷一整圈弹幕）。
      if (game.radialFireTimer <= 0 && !game.victoryPending && game.radialBullets.length < gunCaps.maxRadialBullets
        && hasVisibleEnemy()) {
        fireRadialBarrage(player, 1);
        game.radialFireTimer = radialFireInterval();
      }
    }
    // 弹链 (精准连射): every few volleys the gun also spits a ring, and if the red barrage is
    // unlocked that ring pays part of its cooldown back - the two skills feed each other.
    // 同样受"屏幕内没有敌人不发动"约束。
    if (game.chainVolley && chainVolleyDue && hasVisibleEnemy()) {
      chainVolleyDue = false;
      game.chainVolleyCounter = 0;
      game.chainVolleyFired = (game.chainVolleyFired || 0) + 1;
      fireRadialBarrage(player, 0.62, balance.chainVolleyBullets);
      if (game.radialShotCount > 0) game.radialFireTimer -= balance.chainVolleyRefund;
      burstParticles(player.x, player.y, '#ffd65b', 8);
    }
    for (const bullet of game.radialBullets) {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;
    }
    game.radialBullets = game.radialBullets.filter((bullet) => bullet.life > 0
      && bullet.x > 0 && bullet.x < game.worldWidth && bullet.y > 0 && bullet.y < game.worldHeight);
  }

  if (game.character === 'daxia') updateDaxiaAttack(delta);
  if (game.character === 'xiaoxian') {
    updateUmbrellas(delta);
    updateUmbrellaBurst(delta);
    updateThornCharge(delta);
  }
  updateWuxianRays(delta);

  for (const enemy of game.enemies) {
    if (enemy.health <= 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    enemy.stagger = Math.max(0, (enemy.stagger || 0) - delta);
    enemy.stun = Math.max(0, (enemy.stun || 0) - delta);
    enemy.stunFlash = Math.max(0, (enemy.stunFlash || 0) - delta);
    const stopRange = enemyStopRange(enemy);
    if (Number.isFinite(enemy.knockbackTargetX) && Number.isFinite(enemy.knockbackTargetY)) {
      const pushX = enemy.knockbackTargetX - enemy.x;
      const pushY = enemy.knockbackTargetY - enemy.y;
      const pushDistance = Math.sqrt(pushX * pushX + pushY * pushY);
      if (pushDistance <= balance.knockbackPushSpeed * delta) {
        enemy.x = enemy.knockbackTargetX;
        enemy.y = enemy.knockbackTargetY;
        enemy.knockbackTargetX = null;
        enemy.knockbackTargetY = null;
        enemy.slamPower = 0;
        enemy.pushTrail = null;
      } else if (pushDistance > 0) {
        enemy.x += pushX / pushDistance * balance.knockbackPushSpeed * delta;
        enemy.y += pushY / pushDistance * balance.knockbackPushSpeed * delta;
      }
      enemy.facing = pushX < -0.05 ? -1 : pushX > 0.05 ? 1 : enemy.facing;
      // Record the path so the shove draws as a streak behind the enemy.
      if (enemy.pushTrail) {
        enemy.pushTrail.push({ x: enemy.x, y: enemy.y });
        if (enemy.pushTrail.length > 6) enemy.pushTrail.shift();
      }
      resolveSlamDamage(enemy);
    } else if (enemy.stun > 0) {
      // Stunned by a grenade blast: frozen in place, no approach, no dash.
      if (Math.abs(dx) > 0.05) enemy.facing = dx < 0 ? -1 : 1;
    } else {
      if (enemy.boss && enemy.dashTimer > 0 && Math.abs(enemy.dashX) > 0.05) enemy.facing = enemy.dashX < 0 ? -1 : 1;
      else if (Math.abs(dx) > 0.05) enemy.facing = dx < 0 ? -1 : 1;
      if (enemy.boss) {
        // Phase two: at half health the boss speeds up and calls in help, so the fight has
        // a beat to remember instead of being one long health bar.
        if (!enemy.phaseTwo && enemy.maxHealth > 0 && enemy.health <= enemy.maxHealth * balance.bossPhaseTwoAt) {
          enemy.phaseTwo = true;
          enemy.speed *= balance.bossPhaseTwoSpeed;
          enemy.specialTimer = 0.4;
          game.plantNotice = { text: '首领狂暴！召唤援军', life: 2.6 };
          game.shockwaves.push({ x: enemy.x, y: enemy.y, radius: 200, life: 0.5, maxLife: 0.5 });
          addShake(14, 0.5);
          game.flash = Math.max(game.flash, 0.25);
          for (let i = 0; i < balance.bossPhaseTwoMinions; i += 1) {
            if (game.enemies.length >= enemyCapacity(true)) break;
            spawnEnemyAtEdge();
          }
        }
        enemy.specialTimer -= delta;
        if (enemy.dashTimer > 0) {
          enemy.x += enemy.dashX * 145 * delta;
          enemy.y += enemy.dashY * 145 * delta;
          enemy.dashTimer -= delta;
        } else if (enemy.specialTimer <= 0 && distance > 0) {
          enemy.dashX = dx / distance;
          enemy.dashY = dy / distance;
          enemy.dashTimer = 0.55;
          enemy.specialTimer = enemy.phaseTwo ? 2.2 : 3.2;
        } else if (distance > stopRange && enemy.stagger <= 0) {
          enemy.x += dx / distance * enemy.speed * delta;
          enemy.y += dy / distance * enemy.speed * delta;
        }
      } else if (distance > stopRange && enemy.stagger <= 0) {
        enemy.x += dx / distance * enemy.speed * delta;
        enemy.y += dy / distance * enemy.speed * delta;
      }
    }
    // Hard guarantee that nothing parks inside the sticks' blind centre.
    if (balance.enemyStandoff) {
      const offsetX = enemy.x - player.x;
      const offsetY = enemy.y - player.y;
      const offsetDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const held = enemyStopRange(enemy);
      if (offsetDistance < held) {
        const angle = offsetDistance > 0.01 ? Math.atan2(offsetY, offsetX) : enemy.x * 0.017 + enemy.y * 0.031;
        enemy.x = player.x + Math.cos(angle) * held;
        enemy.y = player.y + Math.sin(angle) * held;
      }
    }
    enemy.x = Math.max(enemy.radius, Math.min(game.worldWidth - enemy.radius, enemy.x));
    enemy.y = Math.max(enemy.radius, Math.min(game.worldHeight - enemy.radius, enemy.y));
    distance = distanceBetween(enemy, player);
    if (distance < player.radius + enemy.radius && game.damageCooldown <= 0 && game.dashTimer <= 0 && game.invulnTimer <= 0 && enemy.stun <= 0) {
      damagePlayer(enemy.damage || (enemy.boss ? 18 : 12), enemy);
      game.damageCooldown = balance.contactDamageCooldown;
      burstParticles(player.x, player.y - 10, '#f17a62', 7);
      playSound('hurt', 500);
    }
  }
  separateEnemies();

  updateGrenades(delta);

  const sticks = game.character === 'supreme' ? getOrbitSticks() : [];
  for (let enemyIndex = game.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = game.enemies[enemyIndex];
    if (enemy.executed) {
      // The boss is being executed: frozen at 1 hp, flashing, until the beat finishes.
      enemy.dying -= delta;
      enemy.hitFlash = 0.16;
      if (enemy.dying > 0) { enemy.health = 1; continue; }
      enemy.health = 0;
    }
    enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - delta);
    enemy.dashHitCooldown = Math.max(0, (enemy.dashHitCooldown || 0) - delta);
    if (game.dashTimer > 0 && enemy.dashHitCooldown <= 0 && distanceBetween(enemy, player) < enemy.radius + player.radius + 12) {
      const dashDamage = game.baseAttack + game.bonusAttack + 3 + game.orbitStickCount + game.dashBonusDamage;
      applyAttackDamage(enemy, dashDamage);
      knockbackEnemy(enemy, game.dashX, game.dashY);
      enemy.dashHitCooldown = 0.35;
      enemy.hitFlash = 0.16;
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
        const bulletDamage = applyAttackDamage(enemy, bullet.damage, bullet.explosive ? 'fire' : game.weaponEvolution === 'chain' ? 'lightning' : 'physical');
        hitDamage += bulletDamage;
        knockbackEnemy(enemy, bullet.vx, bullet.vy);
        bullet.hitEnemies.push(enemy);
        // 冲击爆破 (重炮弹头) applies to every hit, not just the last one, so a piercing bullet
        // leaves a trail of blasts through the crowd.
        bulletImpactBlast(bullet.x, bullet.y, bullet.damage, enemy);
        if (bullet.explosive) {
          for (const nearby of game.enemies) {
            if (nearby === enemy || !isEnemyVisible(nearby) || distanceBetween(nearby, enemy) > 76) continue;
            const splashDamage = Math.max(1, Math.floor(bullet.damage * 0.65));
            applyAttackDamage(nearby, splashDamage, 'fire');
            knockbackEnemy(nearby, nearby.x - enemy.x, nearby.y - enemy.y);
          }
          burstParticles(enemy.x, enemy.y, elementalDamageColors.fire, 14);
          bullet.piercesLeft = 0;
        } else if (game.weaponEvolution === 'chain') {
          burstParticles(enemy.x, enemy.y, '#71e5ff', 8);
        }
        burstParticles(bullet.x, bullet.y, '#ffe16b', 4);
        // 穿甲 (穿甲暴击弹): a critical bullet punches through extra enemies.
        const extraPierce = enemy.lastHitCritical ? game.critPierceBonus : 0;
        if (bullet.piercesLeft + extraPierce > 0) bullet.piercesLeft = bullet.piercesLeft - 1 + extraPierce;
        else game.bullets.splice(bulletIndex, 1);
        if (enemy.health <= 0) break;
      }
      for (const bullet of game.radialBullets) {
        if (bullet.life <= 0 || !isEnemyVisible(enemy) || distanceBetween(bullet, enemy) > enemy.radius + bullet.radius) continue;
        // 穿甲 (穿甲暴击弹): a critical hit punches through extra enemies. The barrage inherits
        // the main gun's pierce, so this applies to it too.
        if (bullet.hitEnemies && bullet.hitEnemies.includes(enemy)) continue;
        const radialDamage = applyAttackDamage(enemy, bullet.damage);
        hitDamage += radialDamage;
        knockbackEnemy(enemy, bullet.vx, bullet.vy);
        // 冲击爆破 is shared with the main gun, so both bullet types explode identically.
        bulletImpactBlast(bullet.x, bullet.y, bullet.damage, enemy);
        if (bullet.hitEnemies) bullet.hitEnemies.push(enemy);
        // 穿甲 (穿甲暴击弹): exactly the same formula as the main gun's branch below, so a crit
        // from the barrage also pierces further - which the comment above already promised.
        const radialExtraPierce = enemy.lastHitCritical ? game.critPierceBonus : 0;
        if (bullet.piercesLeft + radialExtraPierce > 0) bullet.piercesLeft = bullet.piercesLeft - 1 + radialExtraPierce;
        else bullet.life = 0;
      }
      game.radialBullets = game.radialBullets.filter((bullet) => bullet.life > 0);
    }
    for (let stickIndex = 0; stickIndex < sticks.length; stickIndex += 1) {
      enemy.orbitCooldowns[stickIndex] = Math.max(0, (enemy.orbitCooldowns[stickIndex] || 0) - delta);
      if (enemy.orbitCooldowns[stickIndex] <= 0 && distanceToStick(enemy, sticks[stickIndex]) < enemy.radius + stickHeight / 2 + 4) {
        const damage = game.baseAttack + game.bonusAttack;
        const stickDamage = applyAttackDamage(enemy, damage);
        hitDamage += stickDamage;
        knockbackEnemy(enemy, enemy.x - game.player.x, enemy.y - game.player.y);
        enemy.orbitCooldowns[stickIndex] = 0.22 / game.attackSpeedMultiplier;
        if (game.weaponEvolution === 'lightning' && game.lightningCooldown <= 0) {
          game.lightningCooldown = 0.7;
          for (const nearby of game.enemies) {
            if (nearby === enemy || distanceBetween(nearby, enemy) > 92) continue;
            const lightningDamage = 3 + game.bonusAttack;
            applyAttackDamage(nearby, lightningDamage, 'lightning');
            knockbackEnemy(nearby, nearby.x - enemy.x, nearby.y - enemy.y);
          }
          burstParticles(enemy.x, enemy.y, elementalDamageColors.lightning, 10);
        }
        if (enemy.health <= 0) break;
      }
    }
    if (hitDamage > 0) {
      enemy.hitFlash = 0.16;
      burstParticles(enemy.x, enemy.y, '#ffd66b', 3);
      playSound('hit', 180);
    }
    if (enemy.health <= 0) {
      // A boss gets an execution beat instead of dying mid-frame.
      if (enemy.boss && !enemy.executed) {
        beginBossExecution(enemy);
        continue;
      }
      game.enemies.splice(enemyIndex, 1);
      game.kills += 1;
      registerKill();
      addScar(enemy.x, enemy.y, enemy.radius);
      addCoinPop(enemy.x, enemy.y, gardenProjects.find((item) => item.id === 'flower').buff(profile.garden.flower));
      game.deathPops.push({ x: enemy.x, y: enemy.y, radius: enemy.radius, life: 0.32, maxLife: 0.32, color: enemyDeathColor(enemy.type) });
      // A组性能优化：这是唯一没有上限的特效数组（实测峰值 65 个环）。纯视觉，与数值无关。
      if (game.deathPops.length > balance.deathPopCap) game.deathPops.splice(0, game.deathPops.length - balance.deathPopCap);
      addShake(Math.min(5, 1 + game.combo * 0.07), 0.09);
      playSound('hit', balance.killSoundCooldown, game.combo);
      if (!enemy.boss) game.waveKills += 1;
      game.enemyKills[enemy.type] = (game.enemyKills[enemy.type] || 0) + 1;
      if (enemy.eventSerial && game.event && enemy.eventSerial === game.event.serial) game.event.kills += 1;
      if (enemy.boss) {
        burstParticles(enemy.x, enemy.y, '#f5d26e', 20);
        addShake(22, 0.7);
        game.flash = 0.3;
        game.enemies.length = 0;
        if (Math.random() < 0.3 && spawnPlantDrop(enemy.x, enemy.y, 'red-hidden', true)) {
          game.victoryPending = true;
          game.victoryTimer = 12;
          game.plantNotice = { text: '隐藏植物出现！查看小地图高亮', life: 4 };
        } else if (game.endless || balance.endlessMode) startEndless();
        else finishGame(true);
        return;
      }
      burstParticles(enemy.x, enemy.y, '#f0b96b', 8);
      game.seedsEarned += gardenProjects.find((item) => item.id === 'flower').buff(profile.garden.flower);
      if (gainExperience(enemy.experience || 0)) return;
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

// Evolutions used to sit in the random candidate pool, which measured out at roughly a
// 6% chance per level-up: a headline mechanic most runs would never show. They are now
// guaranteed to be offered as soon as their requirement is met.
// Evolutions live in a static table so the upgrade picker and the skill codex read the same
// list; the `ready` predicate is what the picker uses to decide if it is offered yet.
const evolutionTable = {
  supreme: [
    { title: '武器进化：雷电棍', description: '棍子命中时向附近敌人释放闪电', ready: (g) => g.orbitStickCount >= 2 || g.level >= 5, apply: () => { game.weaponEvolution = 'lightning'; } },
  ],
  rabbit: [
    { title: '武器进化：散射弹', description: '子弹改为扇形齐射，攻击范围更广', ready: (g) => g.projectileCount >= 2, apply: () => { game.weaponEvolution = 'scatter'; game.projectileCount = Math.max(3, game.projectileCount); } },
    { title: '武器进化：爆裂弹', description: '命中后爆炸，对周围敌人造成伤害', ready: (g) => g.bulletDamage >= 2, apply: () => { game.weaponEvolution = 'explosion'; game.bulletDamage += 2; } },
    { title: '武器进化：连锁弹', description: '子弹穿透并跳向其他敌人', ready: (g) => g.projectilePierce >= 1, apply: () => { game.weaponEvolution = 'chain'; game.projectilePierce = Math.max(2, game.projectilePierce); } },
  ],
  daxia: [
    { title: '武器进化：三途刀', description: '每次出刀三道刀光齐发，穿透衰减放宽为 70% / 40%；并直接 +2 刀光数（更快走向无极剑阵 / 寂）', ready: (g) => g.swordWaveCount >= 2, apply: () => { game.weaponEvolution = 'threefold'; game.swordWaveCount += 2; } },
    { title: '武器进化：长夜刀', description: '刀光抵达尽头后原路折返，把同一条路线再割一遍（返程按满伤害结算）。注意：折返只作用于方向性刀光，「寂」的环形刀光不折返', ready: (g) => g.swordDamage >= 4, apply: () => { game.weaponEvolution = 'longnight'; game.swordReturn = true; game.swordFalloffBonus += 2; } },
  ],
  xiaoxian: [
    { title: '武器进化：万华伞', description: '伞旋转时额外撕扯周围敌人，范围与强度大幅提升', ready: (g) => g.umbrellaSpinRatio >= 0.74, apply: () => { game.weaponEvolution = 'myriad'; } },
    { title: '武器进化：玉衣天成', description: '伞在手中时反刺玉衣仍以 60% 效果生效', ready: (g) => g.thornReflectRatio >= 2.7, apply: () => { game.weaponEvolution = 'jadeproof'; } },
  ],
};

function eligibleEvolutions() {
  if (game.weaponEvolution) return [];
  return (evolutionTable[game.character] || [])
    .filter((entry) => entry.ready(game))
    .map((entry) => ({ title: entry.title, description: entry.description, rarity: 'gold', evolution: true, apply: entry.apply }));
}

// The full skill list a character can be offered, used by the codex.
function skillsForCharacter(id) {
  if (id === 'rabbit') return rabbitUpgrades.concat(upgrades.filter((u) => sharedWhiteTitles.includes(u.title)));
  if (id === 'daxia') return daxiaUpgrades.concat(upgrades.filter((u) => sharedWhiteTitles.includes(u.title)));
  if (id === 'xiaoxian') return xiaoxianUpgrades.concat(upgrades.filter((u) => sharedWhiteTitles.includes(u.title)));
  return upgrades;
}

// Draw weight for a rarity at the current level. Gold is a late-run payoff and ramps in over
// the first ten levels. Red is no longer drawn by weight at all - it has its own roll below.
function rarityWeight(rarity) {
  const base = skillRarity[rarity].weight;
  if (rarity !== 'gold' && rarity !== 'red') return base;
  if (rarity === 'red' && game.level < balance.redMinLevel) return 0;
  const ramp = Math.min(1, Math.max(0, (game.level - 1) / balance.rarityRampLevels));
  return base * (balance.earlyRarityFactor + (1 - balance.earlyRarityFactor) * ramp);
}

// Probability that a red card shows up in this level-up.
//   * impossible before level 5
//   * base chance ramps in over the first ten levels
//   * from level 10 on, every five levels adds a flat 2 percentage points
function redAppearanceChance() {
  if (game.redSkillOffered) return 0;
  if (game.level < balance.redMinLevel) return 0;
  const ramp = Math.min(1, Math.max(0, (game.level - 1) / balance.rarityRampLevels));
  const base = balance.redBaseChance * (balance.earlyRarityFactor + (1 - balance.earlyRarityFactor) * ramp);
  const steps = game.level >= balance.redBonusStartLevel
    ? Math.floor((game.level - balance.redBonusStartLevel) / balance.redBonusEvery) + 1
    : 0;
  return Math.min(balance.redChanceCap, base + steps * balance.redBonusPerStep);
}

function chooseUpgrades() {
  const options = (game.character === 'rabbit'
    ? rabbitUpgrades.concat(upgrades.filter((upgrade) => sharedWhiteTitles.includes(upgrade.title)))
    : game.character === 'daxia'
      ? daxiaUpgrades.concat(upgrades.filter((upgrade) => sharedWhiteTitles.includes(upgrade.title)))
      : game.character === 'xiaoxian'
        ? xiaoxianUpgrades.concat(upgrades.filter((upgrade) => sharedWhiteTitles.includes(upgrade.title)))
        : upgrades).slice();

  const chosen = [];
  // Red is rolled first, on its own curve, so evolutions and milestone guarantees can never
  // crowd it out of the four cards.
  const redPool = (game.redSkillOffered || game.level < balance.redMinLevel)
    ? [] : options.filter((upgrade) => upgrade.rarity === 'red');
  if (redPool.length && Math.random() < redAppearanceChance()) {
    chosen.push(redPool[Math.floor(Math.random() * redPool.length)]);
  }
  // Everything else draws from a pool with the reds removed, so red has exactly one chance.
  let pool = options.filter((upgrade) => upgrade.rarity !== 'red');

  const takeRandom = (rarity) => {
    if (chosen.length >= 4) return false;
    const candidates = pool.filter((upgrade) => !rarity || upgrade.rarity === rarity);
    if (!candidates.length) return false;
    const upgrade = candidates[Math.floor(Math.random() * candidates.length)];
    chosen.push(upgrade);
    pool.splice(pool.indexOf(upgrade), 1);
    return true;
  };
  // Reserve a slot for the level 5/10 guarantee *before* evolutions fill the row: a red roll plus
  // three evolutions used to consume all four cards, so takeRandom() below hit its
  // `chosen.length >= 4` guard and silently returned false - the guarantee simply never appeared.
  const guaranteedRarity = game.level % 10 === 0 ? 'gold' : game.level % 5 === 0 ? 'purple' : null;
  const evolutionSlots = guaranteedRarity ? 3 : 4;
  for (const evolution of eligibleEvolutions()) {
    if (chosen.length >= evolutionSlots) break;
    chosen.push(evolution);
  }
  if (guaranteedRarity) takeRandom(guaranteedRarity);

  while (chosen.length < 4 && pool.length) {
    const availableRarities = [...new Set(pool.map((upgrade) => upgrade.rarity))];
    const totalWeight = availableRarities.reduce((sum, rarity) => sum + rarityWeight(rarity), 0);
    if (totalWeight <= 0) break;
    let roll = Math.random() * totalWeight;
    let rarity = availableRarities[availableRarities.length - 1];
    for (const candidate of availableRarities) {
      roll -= rarityWeight(candidate);
      if (roll < 0) { rarity = candidate; break; }
    }
    if (!takeRandom(rarity)) break;
  }
  return chosen;
}

function drawGameBackground() {
  const tileSize = 150;
  const centerX = game.camera.x + width / 2;
  const centerY = game.camera.y + height / 2;
  const firstColumn = Math.floor((centerX - width / (2 * gameWorldZoom)) / tileSize);
  const lastColumn = Math.ceil((centerX + width / (2 * gameWorldZoom)) / tileSize);
  const firstRow = Math.floor((centerY - height / (2 * gameWorldZoom)) / tileSize);
  const lastRow = Math.ceil((centerY + height / (2 * gameWorldZoom)) / tileSize);
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
  const marginX = width * (1 / gameWorldZoom - 1) / 2;
  const marginY = height * (1 / gameWorldZoom - 1) / 2;
  if (x < -marginX - size * 3 || x > width + marginX + size * 3 || y < -marginY - size * 3 || y > height + marginY + size * 3) return;

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
  const shake = shakeOffset();
  context.save();
  context.translate(width / 2 + shake.x, height / 2 + shake.y);
  context.scale(gameWorldZoom, gameWorldZoom);
  context.translate(-width / 2, -height / 2);
  drawGameBackground();

  for (const landmark of game.landmarks) drawLandmark(landmark);

  // Ground scars: a visible record of everywhere the horde has already been cut down.
  for (const scar of game.scars) {
    const x = scar.x - game.camera.x;
    const y = scar.y - game.camera.y;
    if (x < -40 || y < -40 || x > width + 40 || y > height + 40) continue;
    const alpha = Math.max(0, scar.life / scar.maxLife) * (scar.scorch ? 0.5 : 0.38);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = scar.scorch ? '#3f2c1c' : '#5c7f43';
    context.beginPath();
    context.ellipse(x, y, scar.radius * 1.35, scar.radius * 0.85, scar.angle, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

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

  for (const drop of game.plants) {
    const plant = plantCatalog.find((item) => item.id === drop.id);
    const plantX = drop.x - game.camera.x; const plantY = drop.y - game.camera.y + Math.sin(drop.phase) * 3;
    context.strokeStyle = plantColors[plant.rarity]; context.lineWidth = 2; context.beginPath();
    context.arc(plantX, plantY, 15 + (Math.sin(drop.phase * 1.7) + 1) * 2, 0, Math.PI * 2); context.stroke();
    drawPlantIcon(plant, plantX, plantY, 12, (Math.sin(drop.phase) + 1) * 0.5);
  }

  // Health bars are collected here and drawn after the enemy loop (see below), so that every
  // bar lands on top of every sprite. Drawn inline, a nearer enemy's bar covered the body of the
  // one behind it - precisely the readout the player needs when 58 of them share a screen.
  const enemyHealthBars = [];
  for (const enemy of game.enemies) {
    const enemyX = enemy.x - game.camera.x;
    const enemyY = enemy.y - game.camera.y + (enemy.boss ? 0 : Math.sin(game.elapsed * 8 + enemy.x * 0.01) * 1.5);
    // Knockback streak: shows the enemy being physically shoved, which was previously
    // invisible because the whole push lasted about two frames.
    if (enemy.pushTrail && enemy.pushTrail.length > 1) {
      context.save();
      context.strokeStyle = 'rgba(190, 232, 255, 0.55)';
      context.lineCap = 'round';
      for (let i = 1; i < enemy.pushTrail.length; i += 1) {
        const a = enemy.pushTrail[i - 1];
        const b = enemy.pushTrail[i];
        context.globalAlpha = (i / enemy.pushTrail.length) * 0.5;
        context.lineWidth = enemy.radius * 1.5 * (i / enemy.pushTrail.length);
        context.beginPath();
        context.moveTo(a.x - game.camera.x, a.y - game.camera.y);
        context.lineTo(b.x - game.camera.x, b.y - game.camera.y);
        context.stroke();
      }
      context.restore();
    }
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
    // Stunned by a grenade: orbiting dots read instantly as "this one is out of action".
    if (enemy.stun > 0) {
      const orbitY = enemyY - enemy.radius - 14;
      const spin = game.elapsed * 6;
      const count = 3;
      context.save();
      context.globalAlpha = Math.min(1, enemy.stun / 0.4) * 0.95;
      for (let i = 0; i < count; i += 1) {
        const a = spin + i * Math.PI * 2 / count;
        context.fillStyle = i % 2 ? '#ffe98a' : '#ffc44d';
        context.beginPath();
        context.arc(enemyX + Math.cos(a) * (enemy.radius * 0.7 + 5), orbitY + Math.sin(a) * 4, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = 'rgba(255, 236, 160, 0.75)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.ellipse(enemyX, orbitY, enemy.radius * 0.7 + 5, 5, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    if (enemy.health < enemy.maxHealth) {
      const spriteHeight = enemy.boss ? 140 : enemy.radius * (enemy.type === 'runner' ? 2.8 : 3.05);
      const hasSprite = enemy.boss ? bossReady : spriteReady;
      const barY = enemyY - (hasSprite ? spriteHeight * 0.82 : enemy.radius) - 9;
      const barWidth = enemy.boss ? 84 : Math.max(30, enemy.radius * 2);
      // Geometry is copied verbatim from the inline version; only the *moment* of drawing moved.
      enemyHealthBars.push([enemyX - barWidth / 2, barY, barWidth, enemy.boss ? 6 : 4, enemy.health, enemy.maxHealth]);
    }
  }

  // Information layer over art layer: all bars above all sprites (same idea as the HUD, which
  // draws after the world).
  for (const bar of enemyHealthBars) drawBar(bar[0], bar[1], bar[2], bar[3], bar[4], bar[5], '#d7564e');

  for (const grenade of game.grenades) {
    const progress = Math.min(1, grenade.elapsed / grenade.duration);
    const x = grenade.fromX + (grenade.x - grenade.fromX) * progress - game.camera.x;
    const y = grenade.fromY + (grenade.y - grenade.fromY) * progress - game.camera.y - Math.sin(progress * Math.PI) * 76;
    const size = 11 + progress * 35;
    if (grenadeReady) context.drawImage(grenadeSprite, x - size / 2, y - size / 2, size, size);
    else { context.fillStyle = '#e9bd43'; context.beginPath(); context.arc(x, y, size / 2, 0, Math.PI * 2); context.fill(); }
  }
  for (const explosion of game.grenadeExplosions) {
    const progress = Math.min(1, 1 - explosion.life / explosion.maxLife);
    const x = explosion.x - game.camera.x;
    const y = explosion.y - game.camera.y;
    const r = explosion.radius;
    const fade = Math.max(0, 1 - progress);
    context.save();
    // 1. smoke shell that keeps expanding after the fire is gone
    context.globalAlpha = fade * 0.4;
    context.fillStyle = '#4a3527';
    context.beginPath(); context.arc(x, y, r * (0.45 + progress * 0.8), 0, Math.PI * 2); context.fill();
    // 2. fireball
    context.globalAlpha = Math.max(0, 1 - progress * 1.5) * 0.85;
    context.fillStyle = '#ff7a2a';
    context.beginPath(); context.arc(x, y, r * (0.25 + progress * 0.75), 0, Math.PI * 2); context.fill();
    // 3. white-hot core, fastest to appear and fastest to vanish
    context.globalAlpha = Math.max(0, 1 - progress * 2.4);
    context.fillStyle = '#fff3c4';
    context.beginPath(); context.arc(x, y, r * (0.16 + progress * 0.5), 0, Math.PI * 2); context.fill();
    // 4. shockwave ring pushed out to the true blast radius
    context.globalAlpha = fade;
    context.strokeStyle = '#ffce6b';
    context.lineWidth = 6 * fade + 1.5;
    context.beginPath(); context.arc(x, y, r * progress, 0, Math.PI * 2); context.stroke();
    // 5. crisp edge marking exactly where the stun reached
    context.globalAlpha = fade * 0.7;
    context.strokeStyle = 'rgba(255, 246, 214, 0.9)';
    context.lineWidth = 1.5;
    context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.stroke();
    context.restore();
  }

  // Pickups that fly toward the HUD counter, so every kill visibly pays in.
  for (const pop of game.coinPops) {
    const alpha = Math.max(0, pop.life / pop.maxLife);
    const x = pop.x - game.camera.x;
    const y = pop.y - game.camera.y;
    context.save();
    context.globalAlpha = 0.35 + alpha * 0.65;
    context.fillStyle = '#f7d97a';
    context.beginPath(); context.arc(x, y, 2.4 + alpha * 1.6, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  // Edge arrows warning where a surge is closing in from.
  for (const warning of game.surgeWarnings) {
    const alpha = Math.max(0, warning.life / warning.maxLife) * 0.85;
    const dist = Math.min(width, height) * 0.42;
    const cx = width / 2 + Math.cos(warning.angle) * dist;
    const cy = height / 2 + Math.sin(warning.angle) * dist;
    context.save();
    context.globalAlpha = alpha;
    context.translate(cx, cy);
    context.rotate(warning.angle);
    context.fillStyle = '#ff5f4a';
    context.beginPath();
    context.moveTo(16, 0);
    context.lineTo(-8, -10);
    context.lineTo(-8, 10);
    context.closePath();
    context.fill();
    context.restore();
  }

  // Green healing numbers when the umbrella comes home.
  for (const pop of game.healPops) {
    const progress = 1 - pop.life / pop.maxLife;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.textAlign = 'center';
    context.font = 'bold 15px sans-serif';
    context.lineWidth = 3;
    context.strokeStyle = '#1f3b23';
    const label = `+${pop.value}`;
    context.strokeText(label, pop.x - game.camera.x, pop.y - game.camera.y - progress * 26);
    context.fillStyle = '#8ef0a8';
    context.fillText(label, pop.x - game.camera.x, pop.y - game.camera.y - progress * 26);
    context.restore();
  }

  // Enemies no longer just vanish: each kill pops a ring in its own colour.
  for (const pop of game.deathPops) {
    const progress = 1 - pop.life / pop.maxLife;
    const x = pop.x - game.camera.x;
    const y = pop.y - game.camera.y;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress) * 0.85;
    context.strokeStyle = pop.color;
    context.lineWidth = 3 * (1 - progress) + 1;
    context.beginPath();
    context.arc(x, y, pop.radius * (0.6 + progress * 1.7), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  // Level-up shockwave rings.
  for (const wave of game.shockwaves) {
    const progress = 1 - wave.life / wave.maxLife;
    const x = wave.x - game.camera.x;
    const y = wave.y - game.camera.y;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress) * 0.9;
    context.strokeStyle = '#fff0a8';
    context.lineWidth = 7 * (1 - progress) + 1.5;
    context.beginPath();
    context.arc(x, y, wave.radius * progress, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  for (const number of game.damageNumbers) {
    const alpha = Math.max(0, number.life / 0.65);
    context.save();
    context.globalAlpha = alpha;
    context.textAlign = 'center';
    context.font = number.critical ? 'bold 20px sans-serif' : 'bold 14px sans-serif';
    context.lineWidth = 3;
    context.strokeStyle = '#563a2f';
    const label = `-${number.value}${number.critical ? '!!!' : ''}`;
    context.strokeText(label, number.x - game.camera.x, number.y - game.camera.y);
    context.fillStyle = number.color || elementalDamageColors.physical;
    context.fillText(label, number.x - game.camera.x, number.y - game.camera.y);
    context.restore();
  }

  for (const bullet of game.bullets) {
    const x = bullet.x - game.camera.x;
    const y = bullet.y - game.camera.y;
    // Fading shots shrink and dim, so a lost lock reads as "the shot flew on" rather than
    // as a sprite popping out of existence.
    const alpha = bullet.fade === undefined ? 1 : Math.max(0, bullet.fade / balance.bulletFadeTime);
    const size = 4.2 * (0.45 + alpha * 0.55);
    context.save();
    context.globalAlpha = 0.3 + alpha * 0.7;
    // A short streak reads as fast and directional; a fat dot just reads as noise.
    if (bullet.previous && alpha > 0.5) {
      context.strokeStyle = 'rgba(255, 116, 16, 0.9)';
      context.lineWidth = size * 1.05;
      context.beginPath();
      context.moveTo(bullet.previous.x - game.camera.x, bullet.previous.y - game.camera.y);
      context.lineTo(x, y);
      context.stroke();
    }
    // Deep gold body with a dark rim: the darker, saturated palette is what gives the shot
    // weight against the pale grass, where the old near-white pellet just washed out.
    context.fillStyle = '#ffb01f';
    context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(96, 40, 0, 0.55)';
    context.lineWidth = 1.2;
    context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#fff0b8';
    context.beginPath(); context.arc(x - size * 0.28, y - size * 0.28, size * 0.34, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  // 赤焰弹幕 ring. Each shot draws a slice of the circle centred on its own bearing; the slice
  // widens as the ring fills up, so the barrage visibly closes into a solid 弹幕圈 around him
  // instead of reading as a handful of scattered dots.
  const ringCount = game.radialBullets.length;
  const ringFullness = radialRingFullness(ringCount);
  for (const bullet of game.radialBullets) {
    // Radial shots dim as they expire, so the ring reads as a wave passing through.
    const alpha = Math.max(0, Math.min(1, bullet.life / balance.radialBulletLife));
    context.save();
    context.globalAlpha = 0.3 + alpha * 0.7;
    // The connecting arc: a dash when the ring is sparse, a nearly unbroken band when full.
    const step = bullet.step || (Math.PI * 2 / Math.max(1, ringCount));
    const arcSpan = step * (balance.radialRingArcMin + (1 - balance.radialRingArcMin) * ringFullness);
    const bearing = Math.atan2(bullet.y - game.player.y, bullet.x - game.player.x);
    const orbit = Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y);
    context.strokeStyle = `rgba(255, 150, 40, ${0.28 + ringFullness * 0.45})`;
    context.lineWidth = 5 + ringFullness * 4;
    context.lineCap = 'round';
    context.beginPath();
    context.arc(game.player.x - game.camera.x, game.player.y - game.camera.y, orbit, bearing - arcSpan / 2, bearing + arcSpan / 2);
    context.stroke();
    const x = bullet.x - game.camera.x;
    const y = bullet.y - game.camera.y;
    context.fillStyle = '#d92f14';
    context.beginPath(); context.arc(x, y, bullet.radius * 0.9, 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(96, 24, 0, 0.55)';
    context.lineWidth = 1.2;
    context.beginPath(); context.arc(x, y, bullet.radius * 0.9, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#ffb03a';
    context.beginPath(); context.arc(x, y, bullet.radius * 0.42, 0, Math.PI * 2); context.fill();
    context.restore();
  }
  // Birth flash: a bright circle at the muzzle radius the instant a volley leaves, which makes
  // "the ring fired" unmistakable even when the shots themselves are already far away.
  if (ringCount > 0 && game.radialFireTimer > radialFireInterval() - 0.18) {
    context.save();
    context.globalAlpha = 0.5 * (1 - (radialFireInterval() - game.radialFireTimer) / 0.18);
    context.strokeStyle = '#ffd48a';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(game.player.x - game.camera.x, game.player.y - game.camera.y, balance.radialRingRadius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
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
    // A ghost of the same stick a moment earlier reads as motion even when the frame rate
    // cannot show it - the "my weapon got stronger" cue that pure numbers never give.
    context.save();
    context.globalAlpha = 0.28;
    context.translate(stick.x - game.camera.x, stick.y - game.camera.y);
    context.rotate(stick.angle - game.orbitSpeed * 0.055);
    if (stickReady) context.drawImage(stickSprite, -stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
    context.restore();
    if (game.weaponEvolution === 'lightning') {
      context.save();
      context.globalAlpha = 0.32;
      context.strokeStyle = '#b879ff';
      context.lineWidth = stickHeight * 0.9;
      context.beginPath();
      context.moveTo(stick.x - game.camera.x, stick.y - game.camera.y);
      context.lineTo(game.player.x - game.camera.x, game.player.y - game.camera.y);
      context.stroke();
      context.restore();
    }
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
    context.arc(playerX, playerY, 34 + (balance.dashDuration - game.dashTimer) * 38, 0, Math.PI * 2); context.stroke();
  }
  if (isMoving && speedCloudReady) {
    context.save();
    context.translate(playerX, playerY + 9 + stepBob);
    context.scale(game.facing, 1);
    context.globalAlpha = 0.96;
    context.drawImage(speedCloudSprite, -52, -27, 104, 55);
    context.restore();
  }
  const activeSprite = getCharacterSprite(game.character);
  const activeSpriteReady = isCharacterSpriteReady(game.character);
  const render = characterRender[game.character] || characterRender.supreme;
  if (activeSpriteReady) {
    drawFacingSprite(activeSprite, playerX, playerY - render.lift + stepBob, render.width, render.height, game.facing, game.damageCooldown > 0 && game.dashTimer <= 0 ? 0.7 : 1);
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

  // ---- 奶大侠: lingering crescent waves ------------------------------------------------
  // With 三途刀 / 血月斩 a lot of crescents can be alive at once, so past a soft cap the older
  // ones fade out; the newest slash always stays fully readable.
  //
  // A组性能优化（渲染窗口）：`game.swordWaves` **一道都不动** —— 伤害、命中判定、
  // 血月斩的溅射数量全部照旧，这里只决定「本帧画多少道」。
  //   主刀光：始终全画（三途刀一次 3 道，出刀间隔 ≥0.4s、寿命 4s → 上限 ≤30 道）
  //   溅射刀光：数量最多（每命中 1 只敌人 +1 道），只画最新的 swordWaveRenderCap 道
  // 实测极端局里数组峰值 394 道，绝大多数是溅射，所以裁在这里收益最大。
  let splashTotal = 0;
  for (const wave of game.swordWaves) if (wave.isSplash) splashTotal += 1;
  const splashSkip = Math.max(0, splashTotal - balance.swordWaveRenderCap);
  const drawnCount = (game.swordWaves.length - splashTotal) + Math.min(splashTotal, balance.swordWaveRenderCap);
  // waveDim 改为按「本帧实际要画的道数」算：否则窗口收窄后，剩下的少数刀光会一起被当成
  // "有 400 道"而压到最低透明度，白画了。
  const waveDim = drawnCount > balance.waveVisualSoftCap
    ? Math.max(balance.waveVisualMinAlpha, 1 - (drawnCount - balance.waveVisualSoftCap) * 0.055)
    : 1;
  const strokeFrom = game.swordWaves.length - balance.swordWaveStrokeCap;
  // 无极剑阵 / 寂 形态下刀光再细一档（需求：降为现在的 30%）。
  // 按"当前形态"取，所以进入这两种形态后**屏幕上所有刀光**（含旧的与溅射）都会一起变细。
  const bladeK = currentBladeScale();
  let splashSeen = 0;
  for (let waveIndex = 0; waveIndex < game.swordWaves.length; waveIndex += 1) {
    const wave = game.swordWaves[waveIndex];
    if (wave.isSplash) {
      splashSeen += 1;
      // 最旧的那些溅射不绘制（但仍在 updateSwordWaves 里正常结算伤害）
      if (splashSeen <= splashSkip) continue;
    }
    const recency = 0.55 + 0.45 * (waveIndex / Math.max(1, game.swordWaves.length - 1));
    // 纯视觉：溅射的**绘制**角度朝母刀光方向收拢，让一排溅射同向（"成排"而非"炸开"）。
    // 命中的 wave.angle 一字不动，且这里不消耗随机数 → 玩法与随机序列完全不变。
    const drawAngle = wave.isSplash && wave.parentAngle !== undefined
      ? wave.parentAngle + (wave.angle - wave.parentAngle) * balance.daxiaWaveSplashVisualAngleScale
      : wave.angle;
    const cos = Math.cos(drawAngle);
    const sin = Math.sin(drawAngle);
    const x = wave.x - sin * wave.offset - game.camera.x;
    const y = wave.y + cos * wave.offset - game.camera.y;
    const half = wave.halfWidth === undefined ? game.swordHalfWidth : wave.halfWidth;
    // 刀锋视觉几何：**不能用 balance.daxiaWaveThickness**，它同时参与命中判定（reach / along）。
    // 这里全部是绘制参数 → 刀锋变细，而命中带宽度一行不变。
    const blade = crescentBladeGeometry(bladeK);
    // 弧的角半跨度（原为写死的 Math.PI / 2.6）：调大 → 弧度更大、扫得更开。
    const span = balance.daxiaWaveArcHalfSpan;
    // damage tier drives how bright the crescent still is, so the falloff is readable
    // 与 swordWaveDamageAt 用同一个锚点（首次命中后的时间），否则"看起来亮"和"实际打得疼"会脱节。
    const sinceHitTier = wave.age - (wave.hitAge === undefined ? 0 : wave.hitAge);
    const tier = game.swordNoFalloff ? 1 : (!wave.hasHit ? 1 : sinceHitTier < balance.daxiaHitFalloffEarly + game.swordFalloffBonus ? 0.62 : sinceHitTier < balance.daxiaHitFalloffLate + game.swordFalloffBonus ? 0.34 : 0.12);
    if (wave.radial) {
      // 「寂」：一道由内向外扩张的环形超级刀光。两道描边即可读出环的体积 ——
      // 外层柔光（宽而淡）+ 内层亮边（窄而亮），比画一圈新月省得多。
      const ringAlpha = Math.max(0, wave.fade) * (0.4 + tier * 0.6) * recency;
      context.save();
      context.translate(wave.x - game.camera.x, wave.y - game.camera.y);
      context.globalAlpha = ringAlpha * 0.32;
      context.strokeStyle = '#bfe9ff';
      // 只缩**绘制**线宽；wave.band 本身是命中判定的环带厚度，一行不能动。
      context.lineWidth = Math.max(1, wave.band * 0.9 * bladeK);
      context.beginPath(); context.arc(0, 0, wave.radius, 0, Math.PI * 2); context.stroke();
      context.globalAlpha = ringAlpha;
      context.strokeStyle = '#ffffff';
      context.lineWidth = Math.max(0.8, wave.band * 0.22 * bladeK);
      context.beginPath(); context.arc(0, 0, wave.radius, 0, Math.PI * 2); context.stroke();
      context.restore();
      continue;
    }
    context.save();
    context.globalAlpha = Math.max(0, wave.fade) * (0.35 + tier * 0.65) * waveDim * recency;
    context.translate(x, y);
    context.rotate(drawAngle);
    // crescent: outer arc forward, inner arc back, offset to make a blade sliver
    context.beginPath();
    context.arc(0, 0, half, -span, span);
    context.arc(-blade.offset, 0, half * blade.innerRatio, span, -span, true);
    context.closePath();
    // 血月斩炸出的小血月用**深红**（tier 越低越暗，与主刀光的亮度语义保持一致）；
    // 主刀光仍是冰蓝。两者同屏时一眼能分出"这是我打的"和"这是炸出来的"。
    if (wave.isSplash) {
      context.fillStyle = tier > 0.5 ? '#b3202e' : tier > 0.25 ? '#8a1521' : '#5a0d15';
    } else {
      context.fillStyle = tier > 0.5 ? '#eaf6ff' : tier > 0.25 ? '#a9d4f5' : '#7c9fbd';
    }
    context.fill();
    // A组：只给最新的若干道画描边，其余只填充 —— 省掉一次 stroke。
    if (waveIndex >= strokeFrom) {
      if (wave.isSplash) context.strokeStyle = 'rgba(214, 60, 74, 0.92)';
      else context.strokeStyle = wave.returned ? 'rgba(160, 240, 255, 0.95)' : 'rgba(120, 190, 255, 0.85)';
      context.lineWidth = blade.strokeWidth;
      context.stroke();
    }
    context.restore();
  }
  for (const mark of game.swordTrail) {
    context.save();
    context.globalAlpha = Math.max(0, mark.life / 0.25) * 0.7;
    context.fillStyle = '#dff0ff';
    context.beginPath(); context.arc(mark.x - game.camera.x, mark.y - game.camera.y, 5, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  // ---- 奶大侠: 无极闪 rays --------------------------------------------------------------
  for (const ray of game.wuxianRays) {
    const progress = Math.min(1, ray.t / 0.6);
    const reach = progress * 620;
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress) * 0.9;
    context.strokeStyle = '#dff0ff';
    context.lineWidth = 7 * (1 - progress) + 2;
    context.beginPath();
    context.moveTo(playerX + Math.cos(ray.angle) * 20, playerY + Math.sin(ray.angle) * 20);
    context.lineTo(playerX + Math.cos(ray.angle) * reach, playerY + Math.sin(ray.angle) * reach);
    context.stroke();
    context.restore();
  }

  // ---- 奶小仙: 伞阵 curtains between her and each umbrella, and between umbrellas ---------
  if (game.character === 'xiaoxian' && game.umbrellaCurtain) {
    context.save();
    context.lineCap = 'round';
    for (const seg of umbrellaCurtainSegments()) {
      context.globalAlpha = 0.16 + game.umbrellaRecalledFlash * 0.5;
      context.strokeStyle = '#9fe6cc';
      context.lineWidth = balance.curtainWidth * 2;
      context.beginPath();
      context.moveTo(seg.a.x - game.camera.x, seg.a.y - game.camera.y);
      context.lineTo(seg.b.x - game.camera.x, seg.b.y - game.camera.y);
      context.stroke();
      context.globalAlpha = 0.5 + game.umbrellaRecalledFlash;
      context.strokeStyle = '#e6fff6';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(seg.a.x - game.camera.x, seg.a.y - game.camera.y);
      context.lineTo(seg.b.x - game.camera.x, seg.b.y - game.camera.y);
      context.stroke();
    }
    context.restore();
  }

  // ---- 奶小仙: every umbrella, wherever it currently is --------------------------------
  if (game.character === 'xiaoxian') {
    for (let index = game.umbrellas.length - 1; index >= 0; index -= 1) {
      const umbrella = game.umbrellas[index];
      const held = umbrella.state === 'held';
      // 收在身上的伞**不画**：她的立绘（xiaoxian-fairy.png）里本来就画着一把撑在手上的伞，
      // 再按 state 画一把"持伞"就是两把重叠。手上剩几把的信息由 HUD 文案（"伞在手中"）
      // 与飞在场上的伞数共同表达，不需要再画一把在腰间。
      if (held) continue;
      const ux = umbrella.x - game.camera.x;
      const uy = umbrella.y - game.camera.y;
      context.save();
      context.translate(ux, uy);
      context.rotate(umbrella.spin);
      context.globalAlpha = 1;
      // 武器伞：用户交来的油纸伞素材（正上方俯视的正圆，裁切时已让伞正好填满画布）。
      //
      // ⚠️ 这里**画成正圆**（不再沿用旧代码的 0.55 压扁），有两个理由：
      //   ① 用户的要求是"替换为图片中的模样"，原图就是正圆；
      //   ② 更重要的是**命中判定本来就是正圆** —— 见 updateOneUmbrella 里的
      //      `distanceBetween(enemy, umbrella) > game.umbrellaRadius + enemy.radius`。
      //      旧代码把伞画成 R × 0.55R 的椭圆，等于一直**少画了近一半的判定范围**，
      //      玩家看到的伞比实际打到的范围小。画成正圆之后视觉与判定终于一致。
      //   旋转沿用 umbrella.spin；伞是旋转对称的，所以转起来没有方向突变。
      const factor = umbrella.damageFactor === undefined ? 1 : umbrella.damageFactor;
      // （收在手上的伞已在上面 continue 跳过，所以这里不再有 held 的 0.62 缩放）
      const visual = 0.72 + factor * 0.28;
      const canopyW = game.umbrellaRadius * visual * 2;
      if (umbrellaReady) {
        if (factor < 0.95) context.globalAlpha *= factor >= 0.7 ? 0.82 : 0.62;
        context.drawImage(umbrellaSprite, -canopyW / 2, -canopyW / 2, canopyW, canopyW);
      } else {
        // 兜底：素材没加载出来时仍画**旧的椭圆代码伞**（所以把这张图删掉就完整回退到旧表现）
        context.fillStyle = factor >= 0.95 ? '#bfe3d8' : factor >= 0.7 ? '#a8d8ca' : '#8ec7b8';
        context.beginPath();
        context.ellipse(0, 0, canopyW / 2, canopyW / 2 * 0.55, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#8fc4b6';
        context.lineWidth = 2;
        context.beginPath(); context.ellipse(0, 0, canopyW / 2, canopyW / 2 * 0.55, 0, 0, Math.PI * 2); context.stroke();
        context.beginPath();
        context.moveTo(0, 0); context.lineTo(0, game.umbrellaRadius * visual * 0.95);
        context.stroke();
      }
      context.restore();
    }
  }
  // 伞爆的碎片同样用武器伞素材（尺寸沿用原来的 0.7 半径，同上画成正圆）。
  for (const blade of game.umbrellaBurst) {
    if (blade.x === undefined) continue;
    const bx = blade.x - game.camera.x;
    const by = blade.y - game.camera.y;
    context.save();
    context.translate(bx, by);
    context.rotate(blade.t * 22);
    if (umbrellaReady) {
      context.globalAlpha = 0.95;
      const bs = game.umbrellaRadius * 0.7 * 2;
      context.drawImage(umbrellaSprite, -bs / 2, -bs / 2, bs, bs);
    } else {
      context.fillStyle = 'rgba(191, 227, 216, 0.95)';
      context.beginPath();
      context.ellipse(0, 0, game.umbrellaRadius * 0.7, game.umbrellaRadius * 0.38, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
  // 反刺玉衣: a thorn aura while it is active, plus a charge ring for the pending burst.
  if (game.character === 'xiaoxian' && thornRobePower() > 0) {
    context.save();
    context.globalAlpha = 0.35 + game.robeFlash * 1.5;
    context.strokeStyle = '#ff9c6e';
    context.lineWidth = 2.5;
    const spikes = 14;
    const spin = game.elapsed * 2.2;
    context.beginPath();
    for (let i = 0; i <= spikes; i += 1) {
      const a = spin + i * Math.PI * 2 / spikes;
      const r = i % 2 === 0 ? 42 : 30;
      const px2 = playerX + Math.cos(a) * r;
      const py2 = playerY + Math.sin(a) * r;
      if (i === 0) context.moveTo(px2, py2); else context.lineTo(px2, py2);
    }
    context.closePath();
    context.stroke();
    // charge arc: fills as reflected damage accumulates, then erupts
    const charge = Math.min(1, game.thornCharge / balance.thornChargeMax);
    if (charge > 0.02) {
      context.globalAlpha = 0.5 + charge * 0.5;
      context.strokeStyle = charge >= 1 ? '#fff0d0' : '#ffcf8a';
      context.lineWidth = 3 + charge * 2;
      context.beginPath();
      context.arc(playerX, playerY, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
      context.stroke();
    }
    context.restore();
  }

  context.restore();

  context.fillStyle = 'rgba(255, 250, 226, 0.92)';
  roundedRect(16, 18, width - 32, 84, 14);
  context.textAlign = 'left';
  context.fillStyle = '#315e37';
  context.font = 'bold 14px sans-serif';
  context.fillText('生命', 28, 42);
  drawBar(66, 31, Math.max(70, width * 0.35), 12, game.health, game.maxHealth, '#d76c54');
  context.textAlign = 'right';
  context.fillText(game.character === 'rabbit'
    ? `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack + game.bulletDamage} · 弹 ${game.projectileCount} · 击退 ${game.knockback}`
    : game.character === 'daxia'
      ? `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack + game.swordDamage} · ${swordWaveMode() === 'ji' ? `寂 ×${game.swordJiScale.toFixed(1)}` : swordWaveMode() === 'formation' ? `无极剑阵 ${game.swordWaveCount}` : `刀 ${game.swordWaveCount}`} · 击退 ${game.knockback}`
      : game.character === 'xiaoxian'
        ? `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack + game.umbrellaDamage} · ${hasUmbrella() ? '伞在手中' : '玉衣生效'} · 击退 ${game.knockback}`
        : `Lv.${game.level} · 攻 ${game.baseAttack + game.bonusAttack} · 棍 ${game.orbitStickCount} · 击退 ${game.knockback}`, width - 28, 42);
  context.textAlign = 'left';
  context.font = 'bold 12px sans-serif';
  context.fillText(game.bossSpawned && !game.endless ? '首领战' : game.endless ? `无尽 ${Math.floor(game.elapsed - (game.endlessStart || 0))} 秒` : `波 ${game.wave} · 击杀 ${game.waveKills}/${game.waveGoal}`, 28, 66);
  // （刀势条已删除：该机制整体移除，HUD 上不再有这条资源槽）
  if (game.character === 'xiaoxian' && game.umbrellas.some((u) => u.state !== 'held')) {
    context.textAlign = 'left';
    context.font = 'bold 9px sans-serif';
    context.fillStyle = '#5f8f7c';
    context.fillText('点击伞可提前收回', 100, 68);
  }
  // 弹幕圈 progress: shows how close the ring is to closing into a full circle.
  if (game.character === 'rabbit' && game.radialShotCount > 0) {
    const shots = radialShotCount();
    const fullness = radialRingFullness(shots);
    context.fillStyle = 'rgba(53, 79, 43, 0.22)';
    roundedRect(100, 60, 118, 8, 4);
    context.fillStyle = fullness >= 1 ? '#ff9b2f' : '#e0743a';
    roundedRect(100, 60, Math.max(2, 118 * fullness), 8, 4);
    context.textAlign = 'left';
    context.font = 'bold 9px sans-serif';
    context.fillStyle = fullness >= 1 ? '#b3511b' : '#71805c';
    context.fillText(fullness >= 1 ? `弹幕圈 · 成型 ${shots} 发` : `弹幕圈 ${shots} 发`, 224, 68);
  }
  context.textAlign = 'right';
  context.font = '12px sans-serif';
  context.fillText(`${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed) % 60).padStart(2, '0')}`, width - 28, 66);
  context.textAlign = 'center';
  context.fillStyle = '#9b7435';
  context.fillText(`种子 +${game.seedsEarned}`, width / 2, 66);
  drawBar(28, 78, width - 56, 8, game.experience, game.experienceNeeded, '#e9b84f');
  const currentEnemyBuff = getEnemyBuffTotals();
  context.textAlign = 'center'; context.fillStyle = '#a45b42'; context.font = '10px sans-serif';
  context.fillText(`怪物强化 速+${currentEnemyBuff.speed} 伤+${currentEnemyBuff.damage} 血+${currentEnemyBuff.health}×${currentEnemyBuff.healthMultiplier} 重+${currentEnemyBuff.weight}`, width / 2, 99);
  const pauseButton = pauseButtonBounds();  context.fillStyle = 'rgba(49, 94, 55, 0.92)'; roundedRect(pauseButton.x, pauseButton.y, pauseButton.width, pauseButton.height, 9);
  context.fillStyle = '#fff7d9'; context.font = 'bold 12px sans-serif'; context.textAlign = 'center'; context.fillText('暂停', pauseButton.x + pauseButton.width / 2, pauseButton.y + 20);

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

  const skillButton = skillButtonBounds();
  const cooldown = activeSkillCooldown();
  const cooldownMax = activeSkillCooldownMax();
  context.fillStyle = cooldown <= 0 ? 'rgba(49, 94, 55, 0.9)' : 'rgba(49, 94, 55, 0.62)';
  context.beginPath(); context.arc(skillButton.x, skillButton.y, skillButton.radius, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#fff7d9'; context.lineWidth = 2; context.beginPath();
  context.arc(skillButton.x, skillButton.y, skillButton.radius - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldown / cooldownMax)); context.stroke();
  if (game.character === 'rabbit' && grenadeReady && cooldown <= 0) {
    context.drawImage(grenadeSprite, skillButton.x - 15, skillButton.y - 15, 30, 30);
  } else {
    context.textAlign = 'center'; context.fillStyle = '#fff7d9'; context.font = 'bold 13px sans-serif';
    context.fillText(cooldown > 0 ? `${cooldown.toFixed(1)}s` : activeSkillLabel(), skillButton.x, skillButton.y + 5);
  }
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
  // Kill-streak readout: the main "you are mowing them down" feedback.
  if (game.combo >= 3) {
    const comboY = height * 0.235;
    const heat = Math.min(1, game.combo / 30);
    const fontSize = Math.round(16 * (1 + Math.min(0.55, game.combo * 0.02) + game.comboFlash * 1.6));
    context.save();
    context.textAlign = 'center';
    context.font = `bold ${fontSize}px sans-serif`;
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(70, 40, 12, 0.85)';
    const label = `×${game.combo} 连杀`;
    context.strokeText(label, width / 2, comboY);
    context.fillStyle = heat > 0.66 ? '#ff9a3c' : heat > 0.33 ? '#ffc44d' : '#fff4b8';
    context.fillText(label, width / 2, comboY);
    const barWidth = 124;
    const ratio = Math.max(0, Math.min(1, game.comboTimer / balance.comboWindow));
    context.fillStyle = 'rgba(31, 57, 35, 0.32)';
    roundedRect(width / 2 - barWidth / 2, comboY + 7, barWidth, 4, 2);
    context.fillStyle = heat > 0.66 ? '#ff9a3c' : '#ffc44d';
    roundedRect(width / 2 - barWidth / 2, comboY + 7, barWidth * ratio, 4, 2);
    context.restore();
  }

  drawMiniMap();

  if (game.flash > 0) {
    context.fillStyle = `rgba(255, 248, 214, ${Math.min(0.45, game.flash)})`;
    context.fillRect(0, 0, width, height);
  }
}

function drawPause() {
  drawGame();
  context.fillStyle = 'rgba(24, 47, 29, 0.72)';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.fillStyle = '#fff7d9';
  context.font = 'bold 28px sans-serif';
  context.fillText('游戏暂停', width / 2, height * 0.34);
  const pauseMenu = pauseMenuBounds();
  [
    { rect: pauseMenu.resume, label: '继续游戏', color: '#477a3c' },
    { rect: pauseMenu.settle, label: '立马结算', color: '#b9654e' },
  ].forEach((button) => {
    context.fillStyle = button.color;
    roundedRect(button.rect.x, button.rect.y, button.rect.width, button.rect.height, 14);
    context.fillStyle = '#fff7d9';
    context.font = 'bold 18px sans-serif';
    context.fillText(button.label, width / 2, button.rect.y + 33);
  });
}

function upgradeCardBounds(index) {
  const cardHeight = 90;
  const gap = 8;
  return { x: 22, y: height * 0.28 + index * (cardHeight + gap), width: width - 44, height: cardHeight };
}

// Skill text comes in two lengths. Cards show the brief form by default; anything with more
// to say gets a 「详细」 chip that opens a dedicated page, so the choice never becomes a wall
// of text but the full wording is always one tap away.
function briefFor(upgrade) {
  if (upgrade.brief) return upgrade.brief;
  const text = upgrade.description;
  if (text.length <= 22) return text;
  const semicolon = text.search(/[；;]/);
  if (semicolon > 0 && semicolon <= 26) return text.slice(0, semicolon);
  const comma = text.search(/[，,]/);
  if (comma > 0 && comma <= 20) return `${text.slice(0, comma)}…`;
  return `${text.slice(0, 20)}…`;
}

function hasDetail(upgrade) {
  return upgrade.description.length > briefFor(upgrade).length + 3;
}

// The 「详细」 chip sits on the brief line, to the right of the text - clear of the title above
// it, of the 选择 label at the bottom, and of the card-select hotspot it sits inside.
function upgradeDetailBounds(index) {
  const card = upgradeCardBounds(index);
  return { x: card.x + card.width - 60, y: card.y + 31, width: 48, height: 17 };
}

function upgradeDetailPanel() {
  return { x: 24, y: height * 0.20, width: width - 48, height: height * 0.46 };
}

function upgradeDetailBackBounds() {
  const panel = upgradeDetailPanel();
  return { x: panel.x + panel.width / 2 - 70, y: panel.y + panel.height - 52, width: 140, height: 40 };
}

function drawUpgrade() {
  drawGame();
  context.fillStyle = 'rgba(24, 47, 29, 0.72)';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.fillStyle = '#fff7d9';
  context.font = 'bold 24px sans-serif';
  context.fillText('升级啦！选择一项', width / 2, height * 0.22);
  context.font = '14px sans-serif';
  context.fillText(`${characters.find((c) => c.id === game.character).name} · ${characterCodices[game.character].split(' · ')[0]} · Lv.${game.level}`, width / 2, height * 0.22 + 25);

  game.upgradeChoices.forEach((upgrade, index) => {
    const card = upgradeCardBounds(index);
    const isEvolution = !!upgrade.evolution;
    context.fillStyle = isEvolution ? '#fff2cd' : '#fff7d9';
    roundedRect(card.x, card.y, card.width, card.height, 14);
    if (isEvolution) {
      context.strokeStyle = '#c58a13';
      context.lineWidth = 2.5;
      context.beginPath();
      if (context.roundRect) context.roundRect(card.x, card.y, card.width, card.height, 14);
      else context.rect(card.x, card.y, card.width, card.height);
      context.stroke();
    }
    context.textAlign = 'left';
    const rarity = skillRarity[upgrade.rarity];
    context.fillStyle = rarity.color;
    context.font = 'bold 15px sans-serif';
    context.fillText(`${isEvolution ? '★ 进化' : rarity.label} · ${upgrade.title}`, card.x + 14, card.y + 23, card.width - 28);
    context.fillStyle = '#6b7956';
    context.font = '11px sans-serif';
    context.fillText(briefFor(upgrade), card.x + 14, card.y + 42, card.width - 92);
    context.fillStyle = '#a45b42';
    context.font = '9px sans-serif';
    context.fillText(enemyBuffDescription(upgrade.rarity), card.x + 14, card.y + 61, card.width - 28);
    if (hasDetail(upgrade)) {
      const chip = upgradeDetailBounds(index);
      context.fillStyle = '#eef2e2';
      roundedRect(chip.x, chip.y, chip.width, chip.height, 10);
      context.fillStyle = '#5f7a4a';
      context.font = 'bold 10px sans-serif';
      context.textAlign = 'center';
      context.fillText('详细 ›', chip.x + chip.width / 2, chip.y + 14);
    }
    context.textAlign = 'right';
    context.fillStyle = '#b37c2e';
    context.font = 'bold 11px sans-serif';
    context.fillText('选择 ›', card.x + card.width - 14, card.y + 82);
  });
}

// The dedicated long-text page, opened from a card's 详细 chip.
function drawUpgradeDetail() {
  drawUpgrade();
  context.fillStyle = 'rgba(20, 35, 22, 0.82)';
  context.fillRect(0, 0, width, height);
  const panel = upgradeDetailPanel();
  const upgrade = game.upgradeChoices[upgradeDetailIndex];
  if (!upgrade) return;
  context.fillStyle = '#fff7d9';
  roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  const rarity = skillRarity[upgrade.rarity];
  context.textAlign = 'center';
  context.fillStyle = rarity.color;
  context.font = 'bold 12px sans-serif';
  context.fillText(upgrade.evolution ? '★ 武器进化' : `${rarity.label}技能`, width / 2, panel.y + 26);
  context.fillStyle = '#315e37';
  context.font = 'bold 20px sans-serif';
  context.fillText(upgrade.title, width / 2, panel.y + 52, panel.width - 32);
  context.fillStyle = '#eef2e2';
  roundedRect(panel.x + 14, panel.y + 68, panel.width - 28, 1, 0);
  context.textAlign = 'left';
  context.fillStyle = '#4c5f3c';
  context.font = '12.5px sans-serif';
  drawWrappedText(upgrade.description, panel.x + 20, panel.y + 96, panel.width - 40, 20, 7, 12.5);
  context.fillStyle = '#a45b42';
  context.font = '10px sans-serif';
  drawWrappedText(enemyBuffDescription(upgrade.rarity), panel.x + 20, panel.y + panel.height - 74, panel.width - 40, 14, 2, 10);
  const back = upgradeDetailBackBounds();
  context.fillStyle = '#477a3c';
  roundedRect(back.x, back.y, back.width, back.height, 12);
  context.textAlign = 'center';
  context.fillStyle = '#fff7d9';
  context.font = 'bold 13px sans-serif';
  context.fillText('返回', back.x + back.width / 2, back.y + 25);
}

function upgradeConfirmBounds() {
  return {
    cancel: { x: width * 0.16, y: height * 0.56, width: width * 0.30, height: 48 },
    confirm: { x: width * 0.54, y: height * 0.56, width: width * 0.30, height: 48 },
  };
}

function drawUpgradeConfirm() {
  drawUpgrade();
  context.fillStyle = 'rgba(20, 35, 22, 0.72)';
  context.fillRect(0, 0, width, height);
  const panel = { x: width * 0.09, y: height * 0.40, width: width * 0.82, height: height * 0.25 };
  context.fillStyle = '#fff7d9';
  roundedRect(panel.x, panel.y, panel.width, panel.height, 18);
  context.textAlign = 'center';
  context.fillStyle = '#315e37';
  context.font = 'bold 19px sans-serif';
  context.fillText(`确认选择（${game.pendingUpgrade.title}）？`, width / 2, panel.y + 37, panel.width - 28);
  context.fillStyle = '#71805c';
  context.font = '12px sans-serif';
  context.fillText(game.pendingUpgrade.description, width / 2, panel.y + 63, panel.width - 28);
  const buttons = upgradeConfirmBounds();
  context.fillStyle = '#a58a63'; roundedRect(buttons.cancel.x, buttons.cancel.y, buttons.cancel.width, buttons.cancel.height, 12);
  context.fillStyle = '#477a3c'; roundedRect(buttons.confirm.x, buttons.confirm.y, buttons.confirm.width, buttons.confirm.height, 12);
  context.fillStyle = '#fff7d9'; context.font = 'bold 15px sans-serif';
  context.fillText('再看看', buttons.cancel.x + buttons.cancel.width / 2, buttons.cancel.y + 30);
  context.fillText('确认选择', buttons.confirm.x + buttons.confirm.width / 2, buttons.confirm.y + 30);
}

// End-of-run grade. Rewards the thing the game is actually about - how big a crowd you were
// cutting through - rather than just survival time.
function runGrade() {
  let score = 0;
  score += game.kills * 0.02;
  score += game.bestCombo * 0.06;
  score += game.level * 1.2;
  score += Math.floor(game.elapsed) * 0.05;
  if (game.resultWon) score += 18;
  if (score >= 60) return { grade: 'S', label: '割草无双', color: '#c58a13' };
  if (score >= 42) return { grade: 'A', label: '小院名将', color: '#9760c8' };
  if (score >= 26) return { grade: 'B', label: '清理熟练', color: '#3498d5' };
  return { grade: 'C', label: '还需努力', color: '#7a9861' };
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
  context.fillStyle = '#c0603a';
  context.font = 'bold 14px sans-serif';
  context.fillText(`最高连杀 ×${game.bestCombo} · 同屏上限 ${enemyCapacity(false)}`, width / 2, height * 0.555);

  // Numbers roll up so the summary lands as a payoff rather than a static table.
  const revealed = Math.min(1, game.resultTimer / balance.resultRollTime);
  const show = (value) => Math.round(value * revealed);
  const grade = runGrade();
  context.fillStyle = grade.color;
  context.font = 'bold 15px sans-serif';
  context.fillText(`${grade.grade} · ${grade.label}   |   本局清理 ${show(game.kills)} 只 · 连杀峰值 ${show(game.bestCombo)}`, width / 2, height * 0.60);
  context.fillStyle = '#71805c';
  context.font = '11px sans-serif';
  context.fillText(`金色技能 ${game.goldPicks} 次 · 红色技能 ${game.redPicks} 次`, width / 2, height * 0.635);

  const resultButton = resultButtonBounds();
  context.fillStyle = '#315e37';
  roundedRect(resultButton.x, resultButton.y, resultButton.width, resultButton.height, 14);
  context.fillStyle = '#fff7d9';
  context.font = 'bold 18px sans-serif';
  context.fillText('再来一局', width / 2, resultButton.y + 33);
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

// Every character has exactly one active skill on the bottom-right button.
function activeSkillCooldown() {
  if (game.character === 'rabbit') return game.grenadeCooldown;
  if (game.character === 'daxia') return game.wuxianCooldown;
  if (game.character === 'xiaoxian') return game.sanhuiCooldown;
  return game.dashCooldown;
}

function activeSkillCooldownMax() {
  if (game.character === 'rabbit') return game.grenadeCooldownMax;
  if (game.character === 'daxia') return game.wuxianCooldownMax;
  if (game.character === 'xiaoxian') return game.sanhuiCooldownMax;
  return game.dashCooldownMax;
}

function activeSkillLabel() {
  if (game.character === 'rabbit') return '手雷';
  if (game.character === 'daxia') return '无极闪';
  if (game.character === 'xiaoxian') return '伞回';
  return '冲刺';
}

function useActiveSkill() {
  if (game.character === 'rabbit') return throwGrenade();
  if (game.character === 'daxia') return castWuxianFlash();
  if (game.character === 'xiaoxian') return castUmbrellaReturn();
  return activateDash();
}

function skillButtonBounds() {
  return { x: width - 58, y: height - 100, radius: 33 };
}

function isSkillButtonHit(touch) {
  const button = skillButtonBounds();
  const dx = touch.clientX - button.x;
  const dy = touch.clientY - button.y;
  return dx * dx + dy * dy <= button.radius * button.radius;
}

function activateDash() {
  if (!game || game.character !== 'supreme' || game.dashCooldown > 0) return;
  let dx = game.input.x;
  let dy = game.input.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.08) { dx = game.facing; dy = 0; }
  else { dx /= length; dy /= length; }
  if (Math.abs(dx) > 0.05) game.facing = dx < 0 ? -1 : 1;
  game.dashX = dx; game.dashY = dy;
  game.dashTimer = balance.dashDuration; game.dashCooldown = game.dashCooldownMax;
  burstParticles(game.player.x, game.player.y, '#8fe6e9', 10);
  playSound('pickup', 180);
}

function handleTouchStart(event) {
  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) return;

  if (screen === 'menu') {
    const layout = menuLayout();
    const selected = characters.findIndex((character, index) => insideRect(characterCardBounds(index), touch));
    if (selected >= 0) { profile.character = characters[selected].id; saveProfile(); draw(); }
    else if (insideRect(layout.start, touch)) startGame();
    else if (insideRect(layout.wardrobe, touch)) { screen = 'wardrobe'; draw(); }
    else if (insideRect(layout.garden, touch)) { screen = 'garden'; draw(); }
    else if (insideRect(layout.enemyCodex, touch)) { screen = 'enemyCodex'; draw(); }
    else if (insideRect(layout.skillCodex, touch)) { screen = 'skillCodex'; draw(); }
    return;
  }

  if (screen === 'skillCodex') {
    if (insideRect(backButtonBounds(skillCodexPanel()), touch)) { screen = 'menu'; draw(); return; }
    for (let index = 0; index < characters.length; index += 1) {
      if (insideRect(skillCodexTabBounds(index), touch)) {
        skillCodexCharacter = characters[index].id;
        break;
      }
    }
    draw();
    return;
  }

  if (screen === 'enemyCodex') {
    if (insideRect(backButtonBounds(enemyCodexPanel()), touch)) screen = 'menu';
    draw(); return;
  }

  if (screen === 'garden') {
    if (insideRect(backButtonBounds(gardenPanel()), touch)) screen = 'menu';
    else if (insideRect(plantCodexButtonBounds(), touch)) screen = 'codex';
    else gardenProjects.forEach((project, index) => {
      const card = gardenCardBounds(index); const level = profile.garden[project.id];
      if (!insideRect(card, touch) || level >= 10) return;
      const cost = 5 + level * 3;
      if (profile.seeds < cost) return;
      profile.seeds -= cost; profile.garden[project.id] += 1; saveProfile();
    });
    draw(); return;
  }

  if (screen === 'codex') {
    if (insideRect(backButtonBounds(codexPanel()), touch)) screen = 'garden';
    draw(); return;
  }

  if (screen === 'wardrobe') {
    if (insideRect(backButtonBounds(wardrobePanel()), touch)) {
      screen = 'menu';
    } else {
      appearances.forEach((appearance, index) => {
        if (!insideRect(appearanceCardBounds(index), touch)) return;
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
    if (insideRect(pauseButtonBounds(), touch)) {
      game.input = { x: 0, y: 0 };
      joystickTouchId = null;
      joystickOrigin = null;
      screen = 'paused';
      draw(); return;
    }
    if (isSkillButtonHit(touch)) {
      useActiveSkill();
      draw();
      return;
    }
    // 伞舞: tapping a deployed umbrella calls that one home early. Checked before the joystick
    // so a tap on the umbrella is never swallowed as a movement input.
    const tapped = umbrellaAtPoint(touch.clientX + game.camera.x, touch.clientY + game.camera.y);
    if (tapped) {
      recallUmbrella(tapped);
      draw();
      return;
    }
    if (joystickTouchId !== null) return;
    joystickTouchId = touch.identifier;
    joystickOrigin = { x: touch.clientX, y: touch.clientY, radius: 48 };
    moveJoystick(touch);
    return;
  }

  if (screen === 'paused') {
    const buttons = pauseMenuBounds();
    if (insideRect(buttons.resume, touch)) {
      screen = 'game';
      lastFrameTime = 0;
      startLoop();
    } else if (insideRect(buttons.settle, touch)) {
      game.earlySettled = true;
      finishGame(false);
    }
    draw();
    return;
  }

  if (screen === 'upgrade') {
    // The 详细 chip is checked first so tapping it never selects the card underneath.
    for (let index = 0; index < game.upgradeChoices.length; index += 1) {
      if (!hasDetail(game.upgradeChoices[index])) continue;
      if (insideRect(upgradeDetailBounds(index), touch)) {
        upgradeDetailIndex = index;
        screen = 'upgradeDetail';
        draw();
        return;
      }
    }
    game.upgradeChoices.forEach((upgrade, index) => {
      if (insideRect(upgradeCardBounds(index), touch)) {
        game.pendingUpgrade = upgrade;
        screen = 'upgradeConfirm';
        draw();
      }
    });
    return;
  }

  if (screen === 'upgradeDetail') {
    if (insideRect(upgradeDetailBackBounds(), touch)) {
      screen = 'upgrade';
      draw();
    }
    return;
  }

  if (screen === 'upgradeConfirm') {
    const buttons = upgradeConfirmBounds();
    if (insideRect(buttons.confirm, touch) && game.pendingUpgrade) {
      const upgrade = game.pendingUpgrade;
      upgrade.apply();
      // A red is spent by *taking* it, not by being shown. Setting this when the card was
      // merely offered meant a red appeared exactly once per run (~1 in 190 offerings) and
      // vanished forever if the player picked anything else - measured as "the red never
      // shows up" even across 50-level runs.
      if (upgrade.rarity === 'red') {
        game.redSkillOffered = true;
        // 通用规则：拿到红色技能后升级代价提高（整体翻倍 + 每级固定增量变大）。
        // 这里同时把**当前这一级**的需求也立刻抬高，而不是等下一次升级才生效 —— 需求是
        // "拿到后直接翻倍"，所以当级就吃满。
        game.redSkillTaken = true;
        game.experienceNeeded = experienceNeededFor(game.level);
      }
      const statFactor = balance.rarityStatMultiplier[upgrade.rarity] || 1;
      if (statFactor > 1) {
        scaleCharacterStats(statFactor);
        applyRarityFlatBonuses(upgrade.rarity);
        game.plantNotice = { text: `${upgrade.rarity === 'gold' ? '金色' : '红色'}技能：其他属性 ×${statFactor}，速度/距离/攻速固定提升`, life: 3 };
      }
      levelUpBlast();
      if (upgrade.evolution) evolutionBurst();
      applyEnemyBuff(upgrade.rarity);
      game.damageCooldown = Math.max(game.damageCooldown, 0.5);
      game.pendingUpgrade = null;
      screen = 'game';
    } else if (insideRect(buttons.cancel, touch)) {
      game.pendingUpgrade = null;
      screen = 'upgrade';
    }
    draw();
    return;
  }

  if (screen === 'result') {
    if (insideRect(resultButtonBounds(), touch)) startGame();
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
  else if (screen === 'upgradeDetail') drawUpgradeDetail();
  else if (screen === 'upgradeConfirm') drawUpgradeConfirm();
  else if (screen === 'result') drawResult();
  else if (screen === 'wardrobe') drawWardrobe();
  else if (screen === 'garden') drawGarden();
  else if (screen === 'codex') drawCodex();
  else if (screen === 'enemyCodex') drawEnemyCodex();
  else if (screen === 'skillCodex') drawSkillCodex();
}

wx.onTouchStart(handleTouchStart);
wx.onTouchMove(handleTouchMove);
wx.onTouchEnd(handleTouchEnd);
if (wx.onTouchCancel) wx.onTouchCancel(handleTouchEnd);
if (wx.onWindowResize) wx.onWindowResize(resize);
resize();
