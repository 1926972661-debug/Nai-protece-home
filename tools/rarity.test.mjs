// =============================================================================
// 稀有度成长：金/红技能只放大输出，生存走平坦加血
//
// 背景（reports/节奏诊断-第1轮.md §六）：`scaleCharacterStats()` 原来把 maxHealth 与 health
// 一起乘 factor（金 ×1.1 / 红 ×3.0）。12 局 balanced 仿真里，有红的局末血量 1324~1773、
// 没红的 418~648 —— 抽到红就不再会死，难度曲线消失。本轮改成：
//   伤害走单一乘区：金 ×1.12 / 红 ×2.6（balance.rarityDamageFactor），多次吃乘区；生命走平坦 +20/+60
//   生存属性 +平坦（金 +20 / 红 +60，并同额回血）
//
// 运行：node tools/rarity.test.mjs
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
const context = vm.createContext(sandbox, { name: 'rarity-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get profile(){ return profile; }, get balance(){ return balance; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, scaleCharacterStats: scaleCharacterStats,
  applyRarityFlatBonuses: applyRarityFlatBonuses, applyAttackDamage: applyAttackDamage,
}; })()`, context, { filename: 'rarity-bridge.js' });
stub.flushImageLoads();

// ---------------------------------------------------------------------------
console.log('\n【1】红技能：输出 ×3，生存只加平额');
{
  bridge.setCharacter('rabbit');
  bridge.startGame();
  const game = bridge.game;
  game.health = game.maxHealth;
  const before = {
    maxHealth: game.maxHealth,
    health: game.health,
    baseAttack: game.baseAttack,
    bulletDamage: game.bulletDamage,
    critMultiplier: game.critMultiplier,
  };
  const factor = bridge.balance.rarityStatMultiplier.red;
  check('红色 factor 仍是 3.0', factor === 3, String(factor));

  // 伤害探针：关掉暴击/连杀/反哺，只剩 rarityDamageBonus 这一个乘区
  game.critChance = 0;
  game.combo = 0;
  game.rabbitFeed = false;
  const probe = () => {
    const dummy = { x: 0, y: 0, radius: 10, health: 1e9, maxHealth: 1e9, type: 'basic', boss: false, pushTrail: [] };
    return bridge.applyAttackDamage(dummy, 100);
  };
  const baseDamage = probe();
  check('未吃稀有度时伤害 = 100', baseDamage === 100, String(baseDamage));

  bridge.scaleCharacterStats(factor, 'red');
  check('maxHealth 没被乘（还等于原值）', Math.abs(game.maxHealth - before.maxHealth) < 1e-9,
    `${before.maxHealth} → ${game.maxHealth}`);
  check('health 没被乘', Math.abs(game.health - before.health) < 1e-9, `${before.health} → ${game.health}`);
  check('攻击力没被乘（伤害加成不落在属性上）', Math.abs(game.baseAttack - before.baseAttack) < 1e-9,
    `${before.baseAttack} → ${game.baseAttack}`);
  check('伤害乘区 = ×2.5', Math.abs(game.rarityDamageMultiplier - 2.6) < 1e-9, String(game.rarityDamageMultiplier));
  check('实际伤害 ×2.6', probe() === Math.round(baseDamage * 2.6), `${baseDamage} → ${probe()}`);

  bridge.applyRarityFlatBonuses('red');
  check('红再加 flat 60 点生命上限', Math.abs(game.maxHealth - (before.maxHealth + 60)) < 1e-9,
    `${before.maxHealth} → ${game.maxHealth}`);
  check('回血也被 60 封顶在最大生命内', game.health <= game.maxHealth + 1e-9, `${game.health}/${game.maxHealth}`);
}

// ---------------------------------------------------------------------------
console.log('\n【2】金技能：输出 ×1.1，生存 +20');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  game.health = game.maxHealth;
  game.swordDamage = 10;   // 给个非零值，否则 0×1.1=0 的断言等于没测
  const before = { maxHealth: game.maxHealth, attack: game.baseAttack, swordDamage: game.swordDamage };
  const factor = bridge.balance.rarityStatMultiplier.gold;
  check('金色 factor 1.1', Math.abs(factor - 1.1) < 1e-9, String(factor));
  game.critChance = 0;
  game.combo = 0;
  const probeGold = () => {
    const dummy = { x: 0, y: 0, radius: 10, health: 1e9, maxHealth: 1e9, type: 'basic', boss: false, pushTrail: [] };
    return bridge.applyAttackDamage(dummy, 100);
  };
  const goldBase = probeGold();
  bridge.scaleCharacterStats(factor, 'gold');
  check('金也不乘 maxHealth', Math.abs(game.maxHealth - before.maxHealth) < 1e-9, `${game.maxHealth}`);
  check('金色伤害乘区 ×1.12', Math.abs(game.rarityDamageMultiplier - 1.12) < 1e-9, String(game.rarityDamageMultiplier));
  check('金实际伤害 ×1.12', probeGold() === Math.round(goldBase * 1.12), `${goldBase} → ${probeGold()}`);
  bridge.applyRarityFlatBonuses('gold');
  check('金加 20 点生命上限', Math.abs(game.maxHealth - (before.maxHealth + 20)) < 1e-9,
    `${before.maxHealth} → ${game.maxHealth}`);
}

// ---------------------------------------------------------------------------
console.log('\n【3】连续吃红：生命线性增长，不是复利');
{
  bridge.setCharacter('xiaoxian');
  bridge.startGame();
  const game = bridge.game;
  const base = game.maxHealth;
  const factor = bridge.balance.rarityStatMultiplier.red;
  for (let i = 0; i < 3; i += 1) {
    bridge.scaleCharacterStats(factor, 'red');
    bridge.applyRarityFlatBonuses('red');
  }
  check('吃 3 次红后生命上限 = base + 180（线性）', Math.abs(game.maxHealth - (base + 180)) < 1e-9,
    `${base} → ${game.maxHealth}`);
  check('不是复利（base×27 会大得多）', game.maxHealth < base * 27, `${game.maxHealth} << ${base * 27}`);
  game.critChance = 0;
  game.combo = 0;
  const probe3 = () => {
    const dummy = { x: 0, y: 0, radius: 10, health: 1e9, maxHealth: 1e9, type: 'basic', boss: false, pushTrail: [] };
    return bridge.applyAttackDamage(dummy, 100);
  };
  check('伤害乘区 3 次红 = 17.576（乘法回来了，但低于原来的 ×27）',
    Math.abs(game.rarityDamageMultiplier - Math.pow(2.6, 3)) < 1e-9, String(game.rarityDamageMultiplier));
  check('实际伤害 = 100 × 2.6³ 取整', probe3() === Math.round(100 * Math.pow(2.6, 3)), `dmg=${probe3()}`);
}

console.log('\n【4】敌人血量倍率：不能吃光玩家乘区（中后期打不动的直接原因）');
{
  const b = bridge.balance;
  check('金卡敌人血量 ×2.4（原 ×4.0）', b.enemyHealthMultiplier.gold === 2.4,
    String(b.enemyHealthMultiplier.gold));
  check('红卡敌人血量 ×5.0（原 ×10.0）', b.enemyHealthMultiplier.red === 5,
    String(b.enemyHealthMultiplier.red));
  check('敌人血量上限 ×28（原 ×128）', b.enemyHealthMultiplierCap === 28,
    String(b.enemyHealthMultiplierCap));
  // 18 张金卡的玩家乘区 vs 5 张金卡就封顶的敌人倍率
  const player = Math.pow(b.rarityDamageFactor.gold, 18) * b.rarityDamageFactor.red;
  check('18 金 + 1 红的玩家乘区 ≈ 20 倍', player > 17 && player < 23, player.toFixed(2));
  // 同一量级即可：玩家乘区还会叠等级(+1/级)、攻速、连杀 1.5，实测 8/8 局能在 152~175 秒打完
  check('玩家乘区与敌人血量上限同量级（≥ 0.6 倍）', player >= b.enemyHealthMultiplierCap * 0.6,
    player.toFixed(2) + ' vs ' + b.enemyHealthMultiplierCap);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
