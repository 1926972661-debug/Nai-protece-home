// =============================================================================
// 至尊奶整体平衡 v3 回归测试（方案见 reports/角色技能/27-至尊奶整体平衡方案.md）
//
// 覆盖：棍阵上限与效率、溢出转攻击、三击下限、破甲叠层与上限、击退抗性、
//       棍意攒放、棍阵共鸣、回旋余劲、输出保底、每 5 级 +1 棍、TTK 目标
//
// 运行：node tools/supreme-balance.test.mjs
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
const context = vm.createContext(sandbox, { name: 'supreme-balance-test' });
vm.runInContext('(function(){ let s = 11; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  get balance(){ return balance; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, updateGame: updateGame,
  effectiveStickCount: effectiveStickCount, addSticks: addSticks,
  addArmorBreak: addArmorBreak, applyAttackDamage: applyAttackDamage,
  knockbackEnemy: knockbackEnemy, activateDash: activateDash, dashDamage: dashDamage,
  chooseUpgrades: chooseUpgrades, gainExperience: gainExperience,
  upgrades: upgrades, evolutionTable: evolutionTable,
  levelUpBlast: levelUpBlast,
  skillRarity: skillRarity,
}; })()`, context, { filename: 'supreme-bridge.js' });
stub.flushImageLoads();

const enemy = (x, y, hp = 500) => ({
  x, y, radius: 12, health: hp, maxHealth: hp, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0,
});

const world = () => {
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.screen = 'game';
  return bridge.game;
};

// ---------------------------------------------------------------------------
console.log('\n【1】棍阵上限：软 5 / 效率 0.6 / 硬 8');
{
  const game = world();
  game.orbitStickCount = 1; game.dashRodBonus = 0;
  check('1 根 = 1.0 有效', bridge.effectiveStickCount() === 1);
  game.orbitStickCount = 5;
  check('5 根 = 5.0 有效（软上限内 100%）', bridge.effectiveStickCount() === 5);
  game.orbitStickCount = 6;
  check('6 根 = 5.6 有效', Math.abs(bridge.effectiveStickCount() - 5.6) < 1e-9, String(bridge.effectiveStickCount()));
  game.orbitStickCount = 7;
  check('7 根 = 6.2 有效', Math.abs(bridge.effectiveStickCount() - 6.2) < 1e-9, String(bridge.effectiveStickCount()));
  game.orbitStickCount = 8;
  check('8 根 = 6.8 有效（硬上限）', Math.abs(bridge.effectiveStickCount() - 6.8) < 1e-9, String(bridge.effectiveStickCount()));
  game.orbitStickCount = 9;
  check('9 根仍按 8 根算', Math.abs(bridge.effectiveStickCount() - 6.8) < 1e-9, String(bridge.effectiveStickCount()));
}

// ---------------------------------------------------------------------------
console.log('\n【2】溢出转攻击：棍子卡永远不会变废卡');
{
  const game = world();
  game.orbitStickCount = 8;
  game.bonusAttack = 0;
  bridge.addSticks(2);
  check('满 8 根后加 2 根 → 攻击 +4', game.bonusAttack === 4 && game.orbitStickCount === 8,
    `棍 ${game.orbitStickCount} / 攻 +${game.bonusAttack}`);
  game.orbitStickCount = 4; game.bonusAttack = 0;
  bridge.addSticks(2);
  check('未满时正常加棍', game.orbitStickCount === 6 && game.bonusAttack === 0,
    `棍 ${game.orbitStickCount} / 攻 +${game.bonusAttack}`);
}

// ---------------------------------------------------------------------------
console.log('\n【3】三击下限：普通怪至少挨 3 下；首领不受限');
{
  const game = world();
  game.baseAttack = 100; game.bonusAttack = 100; game.critChance = 0;
  game.orbitStickCount = 5; game.dashRodBonus = 0;
  game.player.x = game.worldWidth / 2; game.player.y = game.worldHeight / 2;
  const target = enemy(game.player.x + 20, game.player.y, 300);
  game.enemies = [target];
  bridge.updateGame(0.03);
  const firstHitLost = 300 - target.health;
  check('单次棍击 ≤ 34% 最大生命', firstHitLost > 0 && firstHitLost <= 300 * bridge.balance.normalHitHealthCap + 1e-6,
    `失去 ${firstHitLost}（上限 ${300 * 0.34}）`);
  check('至少需要 3 击才死', 300 / firstHitLost > 2.9, `TTK 击数 ${(300 / firstHitLost).toFixed(2)}`);

  const boss = enemy(game.player.x + 20, game.player.y, 300);
  boss.boss = true;
  game.enemies = [boss];
  bridge.updateGame(0.03);
  const bossLost = 300 - boss.health;
  check('首领不受三击下限约束（可超过 34%）', bossLost > 0, `失去 ${bossLost}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】破甲：叠层、上限、受伤加成、衰减');
{
  const game = world();
  const target = enemy(0, 0, 10000);
  game.enemies = [target];
  bridge.addArmorBreak(target, 1);
  check('破甲 1 层', target.armorBreak === 1);
  bridge.addArmorBreak(target, 2);
  check('破甲封顶 3 层', target.armorBreak === 3, String(target.armorBreak));
  const before = target.health;
  game.critChance = 0;
  bridge.applyAttackDamage(target, 100);
  const lost = before - target.health;
  check('3 层破甲 → 受伤 +36%', lost === 136, String(lost));
  target.armorBreakTimer = 0.01;
  bridge.updateGame(0.05);
  check('破甲到期清零', target.armorBreak === 0, String(target.armorBreak));

  const boss = enemy(0, 0, 10000); boss.boss = true;
  bridge.addArmorBreak(boss, 3);
  check('首领破甲上限 2 层', boss.armorBreak === 2, String(boss.armorBreak));
}

// ---------------------------------------------------------------------------
console.log('\n【5】击退抗性上限 0.8（击退不再被完全吃掉）');
{
  const game = world();
  check('抗性上限 = 0.8', bridge.balance.knockbackGuardMax === 0.8);
  const target = enemy(50, 0, 10000);
  game.enemies = [target];
  target.knockbackGuard = 0.8;
  bridge.game.knockback = 10;
  bridge.knockbackEnemy(target, 1, 0);
  check('抗性满时仍会叠破甲', target.armorBreak >= 1, String(target.armorBreak));
}

// ---------------------------------------------------------------------------
console.log('\n【6】棍意：攒层（0.5s 冷却）、上限 3、冲刺消耗并增伤');
{
  const game = world();
  game.rodMeter = 0; game.rodMeterCooldown = 0;
  game.baseAttack = 10; game.bonusAttack = 10; game.orbitStickCount = 4; game.dashRodBonus = 0; game.dashBonusDamage = 0;
  game.player.x = game.worldWidth / 2; game.player.y = game.worldHeight / 2;
  game.enemies = [enemy(game.player.x + 20, game.player.y, 100000)];
  bridge.updateGame(0.03);
  check('棍击攒 1 层棍意', game.rodMeter >= 1, String(game.rodMeter));
  const afterFirst = game.rodMeter;
  bridge.updateGame(0.05);
  check('0.5 秒冷却内不再叠层', game.rodMeter === afterFirst, String(game.rodMeter));
  game.rodMeter = 3;
  const dashBefore = bridge.dashDamage();
  game.dashRodPower = 0;
  const baseDash = bridge.dashDamage();
  game.dashRodPower = 3;
  check('3 层棍意 → 冲刺伤害 +75%', bridge.dashDamage() === Math.round(baseDash * 1.75), `${baseDash} → ${bridge.dashDamage()}`);
  game.dashCooldown = 0;
  bridge.activateDash();
  check('冲刺消耗棍意', game.rodMeter === 0 && game.dashRodPower === 3, `${game.rodMeter} / ${game.dashRodPower}`);
}

// ---------------------------------------------------------------------------
console.log('\n【7】新卡：棍阵共鸣 / 回旋余劲 / 赤霄改动');
{
  const game = world();
  const find = (title) => bridge.upgrades.find((upgrade) => upgrade.title === title);
  check('存在「棍阵共鸣」金卡', Boolean(find('棍阵共鸣')) && find('棍阵共鸣').offense === true);

  game.orbitStickCount = 8;
  const beforeSticks = game.orbitStickCount;
  const beforeAttack = game.bonusAttack;
  find('赤霄雷暴棍').apply();
  check('赤霄：满上限时只转攻击，不超 8 根',
    game.orbitStickCount === beforeSticks && game.bonusAttack === beforeAttack + 6,
    `棍 ${game.orbitStickCount} / 攻 +${game.bonusAttack - beforeAttack}`);
  check('赤霄：雷暴伤害 +30%', Math.abs(game.lightningDamageMult - 1.3) < 1e-9, String(game.lightningDamageMult));
  check('赤霄：破甲每次 2 层', game.armorBreakPerHit === 2, String(game.armorBreakPerHit));

  game.dashSpinBonus = 0;
  find('回旋余劲').apply();
  game.dashCooldown = 0;
  bridge.activateDash();
  check('回旋余劲：冲刺后转速度计时启动', game.dashSpinTimer > 0, String(game.dashSpinTimer));

  game.rodResonance = true;
  game.resonanceHits = 2;
  game.enemies = [enemy(game.player.x + 20, game.player.y, 10000), enemy(game.player.x + 30, game.player.y, 10000)];
  game.baseAttack = 10; game.bonusAttack = 10; game.critChance = 0;
  bridge.updateGame(0.03);
  check('共鸣：第 3 次棍击后计数归零', game.resonanceHits === 0, String(game.resonanceHits));
}

// ---------------------------------------------------------------------------
console.log('\n【8】保底：连续 3 级无输出卡 → 下一级必含输出卡；每 5 级 +1 棍');
{
  const game = world();
  game.offenseDrought = 3;
  game.level = 10;
  let forced = 0;
  for (let i = 0; i < 30; i += 1) {
    game.offenseDrought = 3;
    const choices = bridge.chooseUpgrades();
    if (choices.some((upgrade) => upgrade.offense)) forced += 1;
  }
  check('30 次抽卡全部含输出卡', forced === 30, String(forced));

  game.orbitStickCount = 2;
  game.level = 4;   // 下一级是 5，触发每 5 级 +1 棍
  game.experienceNeeded = 0;
  game.experience = 1000;
  bridge.gainExperience(0);
  check('第 5 级自动 +1 棍', game.orbitStickCount === 3, String(game.orbitStickCount));
}

// ---------------------------------------------------------------------------
console.log('\n【9】目标 TTK：Lv1 与 Lv20 的普通怪至少挨 3 下');
{
  const game = world();
  game.critChance = 0;
  // Lv20 模拟：8 根棍、攻击 60
  game.baseAttack = 60; game.bonusAttack = 0; game.orbitStickCount = 8; game.dashRodBonus = 0;
  game.player.x = game.worldWidth / 2; game.player.y = game.worldHeight / 2;
  const target = enemy(game.player.x + 20, game.player.y, 580);
  game.enemies = [target];
  bridge.updateGame(0.03);
  const lost = 580 - target.health;
  check('Lv20 单次棍击 ≤ 34%（不会一碰就死）', lost <= 580 * 0.34 + 1e-6, `失去 ${lost}`);
  check('Lv20 至少 3 击', 580 / lost >= 2.9, `TTK 击数 ${(580 / lost).toFixed(2)}`);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
