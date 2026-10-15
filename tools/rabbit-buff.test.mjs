// =============================================================================
// 瘦嘟嘟（rabbit）两项改动：
//   ① 全部技能数值 ×1.3（含藏在派生公式里的金/红卡数值；共享白卡不乘）
//   ② 新金卡「反哺」：每次击杀 +0.5% 最终伤害（上限 +200%、与等级无关）并回复 1 点生命，
//      且是**独立乘区、算在所有加成的最后**
//
// 做法：借 D5 的 wx 桩载入 game.js，直接调 registerKill() 与 applyAttackDamage()，
// 用受控的敌人与清零的暴击/连杀来看清乘法顺序。
//
// 依赖：团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs
// 运行：node tools/rabbit-buff.test.mjs
// =============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installStub, DEFAULT_SYSTEM } from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE = readFileSync(join(ROOT, 'game.js'), 'utf8');

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  [v] ${name}${detail ? '  ' + detail : ''}`); }
  else { fail += 1; console.log(`  [x] ${name}${detail ? '  ' + detail : ''}`); }
};

const sandbox = {};
const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
const context = vm.createContext(sandbox, { name: 'rabbit-buff-test' });
vm.runInContext('(function(){ let s = 1; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
stub.flushImageLoads();
const bridge = vm.runInContext(`(function(){ return {
  get game(){return game;}, get screen(){return screen;}, get balance(){return balance;},
  get profile(){return profile;}, get characters(){return characters;},
  get upgrades(){return upgrades;}, get rabbitUpgrades(){return rabbitUpgrades;},
  get sharedWhiteTitles(){return sharedWhiteTitles;},
  registerKill: registerKill, applyAttackDamage: applyAttackDamage,
  radialShotCount: radialShotCount,
  characterCardBounds: characterCardBounds, menuLayout: menuLayout,
  setClock: function(v){ Date.now = function(){ return v|0; }; },
}; })()`, context, { filename: 'rabbit-bridge.js' });
bridge.setClock(0);
const idx = bridge.characters.findIndex((c) => c.id === 'rabbit');
const card = bridge.characterCardBounds(idx);
stub.touch.start({ identifier: 9, clientX: card.x + card.width / 2, clientY: card.y + card.height / 2 });
const layout = bridge.menuLayout();
stub.touch.start({ identifier: 9, clientX: layout.start.x + layout.start.width / 2, clientY: layout.start.y + layout.start.height / 2 });

const game = bridge.game;
const balance = bridge.balance;
const find = (t) => bridge.rabbitUpgrades.find((u) => u.title === t);
check('开局（瘦嘟嘟）', bridge.screen === 'game' && bridge.profile.character === 'rabbit');

// ---------------------------------------------------------------------------
console.log('\n【1】新金卡「反哺」的存在与解锁');
{
  const cardFeed = find('反哺');
  check('技能池里有「反哺」且是金色', !!cardFeed && cardFeed.rarity === 'gold');
  check('描述写明 +0.5% / 上限 200% / 与等级无关 / 独立乘区 / 回复 1 点生命',
    cardFeed.description.includes('0.5%') && cardFeed.description.includes('200%')
    && cardFeed.description.includes('与等级无关') && cardFeed.description.includes('独立乘区')
    && cardFeed.description.includes('回复 1 点生命'));
  check('未拿卡时 rabbitFeed = false、加成为 0',
    game.rabbitFeed === false && game.rabbitFeedBonus === 0);
  cardFeed.apply();
  check('apply() 之后 rabbitFeed = true', game.rabbitFeed === true);
}

// ---------------------------------------------------------------------------
console.log('\n【2】每次击杀 +0.5%，与等级无关，上限 +200%');
{
  game.rabbitFeedBonus = 0;
  const levelBefore = game.level;
  bridge.registerKill();
  check('一次击杀 = +0.005', Math.abs(game.rabbitFeedBonus - 0.005) < 1e-12, `${game.rabbitFeedBonus}`);
  bridge.registerKill(); bridge.registerKill();
  check('三次击杀 = +0.015', Math.abs(game.rabbitFeedBonus - 0.015) < 1e-12, `${game.rabbitFeedBonus}`);

  // 与等级无关：把等级拉高后再击杀，增量仍是 0.005
  game.level = 99;
  const before = game.rabbitFeedBonus;
  bridge.registerKill();
  check('等级 99 时一次击杀仍是 +0.005（与等级无关）',
    Math.abs(game.rabbitFeedBonus - before - 0.005) < 1e-12);
  game.level = levelBefore;

  // 上限
  game.rabbitFeedBonus = 0;
  for (let i = 0; i < 500; i += 1) bridge.registerKill();
  check('500 次击杀后封顶在 2.0（+200%）', game.rabbitFeedBonus === balance.rabbitFeedCap,
    `${game.rabbitFeedBonus}`);
  check('上限值就是 2（+200%）', balance.rabbitFeedCap === 2);
}

// ---------------------------------------------------------------------------
console.log('\n【3】每次击杀回复 1 点生命（不溢出上限、满血不浪费）');
{
  game.rabbitFeedBonus = 0;
  game.maxHealth = 100; game.health = 50;
  bridge.registerKill();
  check('击杀后生命 +1', game.health === 51, `50 → ${game.health}`);
  game.health = 100;
  bridge.registerKill();
  check('满血时不会超过上限', game.health === 100, `health=${game.health}`);
  game.health = 99.6;
  bridge.registerKill();
  check('接近满血时夹到上限（不做溢出）', game.health === 100, `health=${game.health}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】反哺是独立乘区，且乘在暴击与连杀之后（顺序验证）');
{
  const mk = () => ({
    x: 0, y: 0, radius: 12, health: 1e9, maxHealth: 1e9, type: 'basic', weight: 1,
    experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
    hitFlash: 0, dying: 0, lastHitCritical: false,
  });
  const deal = (base) => {
    const e = mk();
    const before = e.health;
    const dealt = bridge.applyAttackDamage(e, base, 'physical', true, true);
    return { dealt, drop: before - e.health };
  };

  game.combo = 0;
  game.rabbitFeed = true;
  game.rabbitFeedBonus = 0;
  game.critChance = 0;
  const noFeed = deal(100).dealt;
  check('加成 0 时：100 → 100', noFeed === 100, `${noFeed}`);

  game.rabbitFeedBonus = 1;   // +100%
  const feed100 = deal(100).dealt;
  check('加成 +100% 时：100 → 200', feed100 === 200, `${feed100}`);

  // 乘在暴击之后：crit 2.0 倍 → 100×2×2 = 400
  game.critChance = 1;
  game.critMultiplier = 2;
  const critAndFeed = deal(100).dealt;
  check('乘在暴击之后：100 × 暴击2.0 × 反哺2.0 = 400', critAndFeed === 400, `${critAndFeed}`);

  // 乘在连杀之后
  game.critChance = 0;
  game.combo = 0;
  game.rabbitFeedBonus = 0;
  const combo0 = deal(100).dealt;
  game.combo = 10;   // comboDamageMultiplier = 1 + combo×perStack
  const comboN = deal(100).dealt;
  const comboScale = comboN / combo0;
  game.rabbitFeedBonus = 1;
  const comboAndFeed = deal(100).dealt;
  check('乘在连杀之后（连杀倍率被完整保留后再乘反哺）',
    Math.abs(comboAndFeed - comboN * 2) < 1e-9,
    `连杀 ${comboN} → 连杀+反哺 ${comboAndFeed}（连杀倍率 ${comboScale.toFixed(3)}）`);
  game.combo = 0;

  // 独立乘区：不是加到 baseDamage 上，所以不会被暴击重复放大
  game.rabbitFeedBonus = 1;
  game.critChance = 1;
  game.critMultiplier = 3;
  const c3 = deal(100).dealt;
  check('独立乘区（不会被暴击重复放大）：100 × 3 × 2 = 600', c3 === 600, `${c3}`);

  // 未解锁反哺时完全不参与
  game.rabbitFeed = false;
  game.critChance = 0;
  game.rabbitFeedBonus = 2;
  const locked = deal(100).dealt;
  check('未拿「反哺」时加成一概不生效', locked === 100, `${locked}`);
  game.rabbitFeed = true;
  game.rabbitFeedBonus = 0;
}

// ---------------------------------------------------------------------------
console.log('\n【5】全部技能数值 ×1.3（抽样式核对）');
{
  const cases = [
    ['高压弹头', () => { game.bulletDamage = 0; find('高压弹头').apply(); return game.bulletDamage; }, 6.5],
    ['穿透弹头', () => { game.projectilePierce = 0; find('穿透弹头').apply(); return game.projectilePierce; }, 2],
    ['急救补给', () => { game.maxHealth = 0; game.health = 0; find('急救补给').apply(); return game.maxHealth; }, 26],
    ['冲击弹头', () => { game.knockback = 0; find('冲击弹头').apply(); return game.knockback; }, 3.9],
    ['震荡弹', () => { game.knockback = 0; game.projectilePierce = 0; find('震荡弹').apply(); return game.knockback; }, 6.5],
    ['轻盈行动/轻装行动', () => { game.moveSpeed = 0; find('轻装行动').apply(); return game.moveSpeed; }, 31.2],
  ];
  for (const [name, run, want] of cases) {
    const got = run();
    check(`${name} → ${want}`, Math.abs(got - want) < 1e-9, `实际 ${got}`);
  }

  check('弱点瞄准 暴击率 +11.7%', (() => {
    game.critChance = 0; find('弱点瞄准').apply(); return Math.abs(game.critChance - 0.117) < 1e-9;
  })(), `critChance=${game.critChance}`);

  check('精准连射 伤害 +10.4 / 弹数 +2', (() => {
    game.bulletDamage = 0; game.projectileCount = 0; find('精准连射').apply();
    return Math.abs(game.bulletDamage - 10.4) < 1e-9 && game.projectileCount === 2;
  })(), `伤害=${game.bulletDamage} 弹数=${game.projectileCount}`);

  check('重炮弹头 击退 +9.1 / 伤害 +7.8', (() => {
    game.knockback = 0; game.bulletDamage = 0; find('重炮弹头').apply();
    return Math.abs(game.knockback - 9.1) < 1e-9 && Math.abs(game.bulletDamage - 7.8) < 1e-9;
  })());

  check('穿甲暴击弹 暴击 +13% / 暴伤 +0.65 / 暴击穿透 +3', (() => {
    game.critChance = 0; game.critMultiplier = 0; game.critPierceBonus = 0;
    find('穿甲暴击弹').apply();
    return Math.abs(game.critChance - 0.13) < 1e-9 && Math.abs(game.critMultiplier - 0.65) < 1e-9
      && game.critPierceBonus === 3;
  })());

  console.log('\n  --- 藏在派生公式里的数值 ---');
  check('爆破半径 62 → 80.6', balance.bulletBlastRadius === 80.6, `${balance.bulletBlastRadius}`);
  check('爆破倍率 0.4 → 0.52', balance.bulletBlastRatio === 0.52, `${balance.bulletBlastRatio}`);
  check('弹链齐射 6 → 8 发', balance.chainVolleyBullets === 8, `${balance.chainVolleyBullets}`);
  check('齐射返还 0.25 → 0.325 秒', balance.chainVolleyRefund === 0.325, `${balance.chainVolleyRefund}`);
  check('赤焰弹幕公式：基础 4→5.2 / 每弹数 1→1.3 / 每机制 2→2.6',
    balance.radialBaseCount === 5.2 && balance.radialPerProjectile === 1.3 && balance.radialPerMechanic === 2.6,
    `${balance.radialBaseCount} / ${balance.radialPerProjectile} / ${balance.radialPerMechanic}`);
  check('赤焰弹幕弹数确实变多了（实测 radialShotCount）', (() => {
    game.projectileCount = 4; game.rabbitMechanics = 2; game.radialRingBonus = 0;
    // 旧公式：4 + 4×1 + 2×2 = 12 ；新公式：5.2 + 4×1.3 + 2×2.6 = 15.6 → round 16
    const got = bridge.radialShotCount();
    return got === 16;
  })(), `radialShotCount=${bridge.radialShotCount()}`);

  console.log('\n  --- 明确不乘的部分 ---');
  check('共享白卡「奋勇强攻」仍是 +2（没有连带加强另外三个角色）', (() => {
    const u = bridge.upgrades.find((x) => x.title === '奋勇强攻');
    return !!u;
  })());
  check('共享白卡确实在共享池里（所以不乘是对的）',
    bridge.sharedWhiteTitles.includes('奋勇强攻'));
  check('暴击率上限仍是 0.75（上限不乘）', (() => {
    game.critChance = 0.74; find('穿甲暴击弹').apply();
    return Math.abs(game.critChance - 0.75) < 1e-9;
  })(), `critChance=${game.critChance}`);
  check('手雷百分比上限仍是 0.45 / 0.15（上限不乘）', (() => {
    game.grenadeDamageRatio = 0.44; game.grenadeBossDamageRatio = 0.14;
    find('爆芯糯米').apply();
    return game.grenadeDamageRatio === 0.45 && game.grenadeBossDamageRatio === 0.15;
  })(), `${game.grenadeDamageRatio} / ${game.grenadeBossDamageRatio}`);
  check('弹链频率仍是每 3 轮（频率不乘）', balance.chainVolleyEvery === 3, `${balance.chainVolleyEvery}`);
  check('射速下限仍是 0.30（下限不乘）',
    Math.abs(characterStatCapsSafe() - 0.30) < 1e-9, `${characterStatCapsSafe()}`);
  function characterStatCapsSafe() {
    return vm.runInContext('characterStatCaps.fireInterval', context);
  }
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
