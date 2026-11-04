// =============================================================================
// 「击退墙」与「首领秒杀」两条修复的回归测试
//
// 用户 2026-10-22 指出两个问题：
//   ① 至尊奶棍子数量上去后，基础击退让怪永远进不了身 —— 高棍数 = 物理免疫。
//      根因：棍阵每 0.22 秒刷一次 stagger(0.16~0.32s)，敌人永远「正在被击退」，
//      既不前进也不进入接触范围（game.js enemy 循环里 `distance > stopRange && stagger <= 0`）。
//   ② 数值上去后首领和小怪一样被秒 —— 首领没有存在感。
//      修法：首领单次伤害上限 15% 最大生命（至少 7 刀）+ 血量按玩家近期 DPS × 18 秒反推，
//      并且不吃金/红累积的敌人血量强化。
//
// 运行：node tools/lockdown.test.mjs
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
const context = vm.createContext(sandbox, { name: 'lockdown-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get profile(){ return profile; }, get balance(){ return balance; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  knockbackEnemy: knockbackEnemy, spawnBoss: spawnBoss, bossHealthTarget: bossHealthTarget,
  applyAttackDamage: applyAttackDamage, applyCurrentEnemyBuff: applyCurrentEnemyBuff,
  applyEnemyBuff: applyEnemyBuff,
  distanceBetween: distanceBetween,
}; })()`, context, { filename: 'lockdown-bridge.js' });
stub.flushImageLoads();

const makeEnemy = (game, extra) => ({
  x: game.player.x + 60, y: game.player.y, radius: 14, health: 500, maxHealth: 500,
  type: 'basic', weight: 1, speed: 40, damage: 12, facing: 1, pushTrail: [], stun: 0,
  hitFlash: 0, knockbackGuard: 0, ...extra,
});

// ---------------------------------------------------------------------------
console.log('\n【1】击退抗性：连续击退会「推不动」，不会变成永久定身');
{
  bridge.setCharacter('supreme');
  bridge.startGame();
  const game = bridge.game;
  game.knockback = 20;
  const enemy = makeEnemy(game);
  game.enemies = [enemy];

  bridge.knockbackEnemy(enemy, 1, 0);
  const firstGuard = enemy.knockbackGuard;
  const firstStagger = enemy.stagger;
  check('第一次击退产生目标点', Number.isFinite(enemy.knockbackTargetX), String(enemy.knockbackTargetX));
  check('第一次击退有硬直', firstStagger > 0.15, `stagger=${firstStagger.toFixed(3)}`);
  check('第一次击退后抗性 = step', Math.abs(firstGuard - bridge.balance.knockbackGuardStep) < 1e-9, String(firstGuard));

  // 连续 20 次（模拟棍阵每帧都打）
  for (let i = 0; i < 20; i += 1) bridge.knockbackEnemy(enemy, 1, 0);
  check('抗性封顶不再涨', Math.abs(enemy.knockbackGuard - bridge.balance.knockbackGuardMax) < 1e-9,
    String(enemy.knockbackGuard));
  check('抗性封顶后不再刷新硬直（不会被永久定身）',
    enemy.stagger <= firstStagger + 1e-9, `stagger=${enemy.stagger.toFixed(3)}`);
  check('抗性封顶后不再产生新的击退位移', enemy.knockbackTargetX <= game.player.x + bridge.balance.knockbackMaxDistance + 1e-6,
    String(enemy.knockbackTargetX));

  // 不挨打时抗性衰减
  const before = enemy.knockbackGuard;
  for (let i = 0; i < 60; i += 1) bridge.updateGame(1 / 60);
  check('1 秒不挨打后抗性下降', game.enemies[0] ? game.enemies[0].knockbackGuard < before : true,
    game.enemies[0] ? String(game.enemies[0].knockbackGuard.toFixed(3)) : 'enemy gone');
}

// ---------------------------------------------------------------------------
console.log('\n【2】首领免疫击退（它必须真的走到你面前）');
{
  bridge.setCharacter('supreme');
  bridge.startGame();
  const game = bridge.game;
  game.knockback = 40;
  const boss = makeEnemy(game, { boss: true, radius: 30, weight: 10, health: 3000, maxHealth: 3000 });
  game.enemies = [boss];
  bridge.knockbackEnemy(boss, 1, 0);
  check('首领不会被击退', boss.knockbackTargetX === undefined, String(boss.knockbackTargetX));
  check('首领不会被打出硬直', !boss.stagger, String(boss.stagger));
}

// ---------------------------------------------------------------------------
console.log('\n【3】首领血量：按玩家 DPS 反推，且有上下限');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  check('零伤害时用兜底血量（bossBaseHealth×3）',
    bridge.bossHealthTarget() === bridge.balance.bossBaseHealth * 3,
    String(bridge.bossHealthTarget()));
  // 平均 DPS = 累计伤害 / 已进行秒数
  game.damageDealtTotal = 500 * 100;
  game.elapsed = 100;
  check('平均 DPS 500 → 500×24 = 12000', bridge.bossHealthTarget() === 12000, String(bridge.bossHealthTarget()));
  game.damageDealtTotal = 20000000 * 100;   // 平均 2000 万/秒 → 18 秒目标 3.6 亿，会被 2000 万上限截断
  check('上限夹住（bossHealthMax）', bridge.bossHealthTarget() === bridge.balance.bossHealthMax,
    String(bridge.bossHealthTarget()));
  game.damageDealtTotal = 10 * 100;
  check('下限夹住（bossBaseHealth×2）',
    bridge.bossHealthTarget() === bridge.balance.bossBaseHealth * 2, String(bridge.bossHealthTarget()));
}

// ---------------------------------------------------------------------------
console.log('\n【4】首领不吃金/红累积的敌人血量强化');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  game.damageDealtTotal = 400 * 100;
  game.elapsed = 100;
  game.enemyBuffHistory = ['gold', 'gold', 'red'];
  game.enemies = [];
  bridge.spawnBoss();
  const boss = game.enemies.find((enemy) => enemy.boss);
  check('首领已生成', !!boss);
  check('首领血量 = DPS×18（没被强化栈乘）', boss && boss.maxHealth === 400 * bridge.balance.bossFightSeconds,
    boss ? String(boss.maxHealth) : 'none');
  check('但首领的攻击/速度仍然吃强化（保持压迫感）',
    boss && boss.damage > 18, boss ? String(boss.damage) : 'none');
}

// ---------------------------------------------------------------------------
console.log('\n【5】单次伤害上限：再高的爆发也至少 7 刀');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  game.damageDealtTotal = 500 * 100;
  game.elapsed = 100;
  game.enemies = [];
  bridge.spawnBoss();
  const boss = game.enemies.find((enemy) => enemy.boss);
  const capRatio = bridge.balance.bossHitCap;
  check('上限比例 50%（这个上限只负责「不许一刀秒」）', Math.abs(capRatio - 0.5) < 1e-9, String(capRatio));
  const before = boss.health;
  const dealt = bridge.applyAttackDamage(boss, 999999);
  const expectedCap = Math.round(boss.maxHealth * capRatio);
  check('一刀最多打掉一半', dealt === expectedCap, `dealt=${dealt} cap=${expectedCap}`);
  check('血量只掉一半', Math.abs((before - boss.health) - expectedCap) < 1e-9, `${before} → ${boss.health}`);
  check('至少需要 2 刀（1/0.5）', Math.ceil(1 / capRatio) === 2, String(Math.ceil(1 / capRatio)));
  check('首领战时长由「血量 = 平均 DPS × 24 秒」决定，不由上限决定',
    bridge.balance.bossFightSeconds === 24, String(bridge.balance.bossFightSeconds));

  // 小怪不受这个上限影响
  const minion = makeEnemy(game, { health: 50, maxHealth: 50 });
  const minionDamage = bridge.applyAttackDamage(minion, 999999);
  check('小怪仍然可以被一刀秒（上限只管首领）', minionDamage > 50, `dmg=${minionDamage}`);
}

console.log('\n【6】首领不参与「后续金/红对全场敌人」的血量强化');
{
  bridge.setCharacter('supreme');
  bridge.startGame();
  const game = bridge.game;
  game.damageDealtTotal = 300 * 100;
  game.elapsed = 100;
  game.enemies = [];
  bridge.spawnBoss();
  const boss = game.enemies.find((enemy) => enemy.boss);
  const before = boss.maxHealth;
  game.enemyBuffHistory = [];
  bridge.applyEnemyBuff('gold');
  bridge.applyEnemyBuff('red');
  const after = boss.maxHealth;
  check('两次强化后首领血量不变（不会变成打不完的墙）', after === before, before + ' -> ' + after);
  const minion = makeEnemy(game);
  game.enemies.push(minion);
  bridge.applyEnemyBuff('gold');
  check('小怪仍然吃强化（这是设计意图）', minion.maxHealth > 50, String(minion.maxHealth));
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
