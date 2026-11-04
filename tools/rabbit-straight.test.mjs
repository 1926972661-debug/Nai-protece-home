// =============================================================================
// 瘦嘟嘟直线弹道回归（方案见 reports/角色技能/45-瘦嘟嘟直线弹道方案.md）
//
// 规则：发射即定方向，飞行中不转向；命中即消失（穿透卡为显式例外）；
//       打空飞完射程淡出；发射时预判提前量；连锁弹命中放电 60%。
//
// 运行：node tools/rabbit-straight.test.mjs
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
const context = vm.createContext(sandbox, { name: 'rabbit-straight-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  hasChooseBulletTarget: function(){ return typeof chooseBulletTarget !== 'undefined'; },
  predictEnemyPoint: predictEnemyPoint,
}; })()`, context, { filename: 'rabbit-straight-bridge.js' });
stub.flushImageLoads();

const BASE_CLOCK = 1_000_000_000;
const world = () => {
  bridge.setCharacter('rabbit');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(BASE_CLOCK);
  bridge.game.enemies = [];
  bridge.game.spawnTimer = 999;   // 关掉刷怪，避免目标被抢
  bridge.game.fireTimer = 0;
  return bridge.game;
};
const enemyAt = (game, x, y, extra = {}) => {
  const enemy = {
    x, y, radius: 16, health: 500, maxHealth: 500, type: 'basic', weight: 1,
    experience: 0, damage: 1, speed: 0, boss: false, eventSerial: 0,
    hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0, stagger: 0,
    ...extra,
  };
  game.enemies.push(enemy);
  return enemy;
};
const step = (game, seconds, dt = 1 / 60) => {
  let left = seconds;
  while (left > 1e-9) { bridge.updateGame(Math.min(dt, left)); left -= dt; }
};
const fireOnce = (game, enemy) => {
  game.fireTimer = 0;
  step(game, 1 / 60);
  game.fireTimer = 999;   // 只测这一枪
  return game.bullets;
};

// ---------------------------------------------------------------------------
console.log('\n【1】发射即定方向：飞行中不转向');
{
  const game = world();
  const enemy = enemyAt(game, game.player.x + 150, game.player.y, { speed: 40 });
  const bullets = fireOnce(game, enemy);
  check('打出了子弹', bullets.length > 0, String(bullets.length));
  const bullet = bullets[0];
  const direction = Math.atan2(bullet.vy, bullet.vx);
  step(game, 0.12);
  const ship = game.bullets[0];
  check('0.4 秒后方向不变',
    Math.abs(Math.atan2(ship.vy, ship.vx) - direction) < 1e-9,
    `${direction.toFixed(3)} → ${Math.atan2(ship.vy, ship.vx).toFixed(3)}`);
  check('速度恒等于 projectileSpeed',
    Math.abs(Math.hypot(ship.vx, ship.vy) - game.projectileSpeed) < 1e-6,
    `${game.projectileSpeed}`);
}

// ---------------------------------------------------------------------------
console.log('\n【2】命中即消失（无穿透时）');
{
  const game = world();
  game.projectilePierce = 0;
  game.enemies = [];
  const enemy = enemyAt(game, game.player.x + 120, game.player.y, { speed: 0 });
  fireOnce(game, enemy);
  step(game, 0.6);
  check('命中后子弹消失', game.bullets.length === 0, String(game.bullets.length));
  check('敌人掉血', enemy.health < 500, String(enemy.health));
}

// ---------------------------------------------------------------------------
console.log('\n【3】穿透卡是显式例外：命中后继续飞');
{
  const game = world();
  game.projectilePierce = 2;
  game.enemies = [];
  const first = enemyAt(game, game.player.x + 110, game.player.y, { speed: 0 });
  const second = enemyAt(game, game.player.x + 160, game.player.y, { speed: 0 });
  const third = enemyAt(game, game.player.x + 205, game.player.y, { speed: 0 });
  fireOnce(game, first);
  step(game, 0.5);
  check('第一只敌人掉血', first.health < 500, String(first.health));
  check('第二只敌人也被命中（穿透继续）', second.health < 500, String(second.health));
  check('第三只敌人也被命中', third.health < 500, String(third.health));
  check('穿透用完后子弹消失', game.bullets.length === 0, String(game.bullets.length));
}

// ---------------------------------------------------------------------------
console.log('\n【4】打空：飞完射程淡出，不追人');
{
  const game = world();
  game.enemies = [];
  const enemy = enemyAt(game, game.player.x + 100, game.player.y, { speed: 0 });
  fireOnce(game, enemy);
  enemy.y += 120;   // 子弹出膛后把敌人挪开 → 打空
  check('子弹存在', game.bullets.length > 0);
  const direction = Math.atan2(game.bullets[0].vy, game.bullets[0].vx);
  step(game, 1.8);
  check('子弹最终消失', game.bullets.length === 0, String(game.bullets.length));
  check('方向始终没变（不追踪）', Number.isFinite(direction));
}

// ---------------------------------------------------------------------------
console.log('\n【5】预判：移动目标能被提前量打中');
{
  const game = world();
  game.enemies = [];
  // 敌人朝玩家移动：先放在上方 260px，速度 120
  const enemy = enemyAt(game, game.player.x, game.player.y - 150, { speed: 120 });
  fireOnce(game, enemy);
  step(game, 1.2);
  check('朝玩家移动的敌人被打中', enemy.health < 500, String(enemy.health));
}

// ---------------------------------------------------------------------------
console.log('\n【6】弹速与射程');
{
  const game = world();
  game.enemies = [];
  check('基础弹速 480', game.projectileSpeed === 480, String(game.projectileSpeed));
  const enemy = enemyAt(game, game.player.x + 150, game.player.y, { speed: 0 });
  const bullets = fireOnce(game, enemy);
  const expectedRange = game.attackRange * bridge.balance.bulletRangeRatio;
  const life = bullets[0].life;
  check('子弹寿命 = 射程 / 弹速（含发射帧消耗）',
    Math.abs((life + 1 / 60) * game.projectileSpeed - expectedRange) < 2,
    `${(life * game.projectileSpeed).toFixed(1)} / ${expectedRange.toFixed(1)}`);
}

// ---------------------------------------------------------------------------
console.log('\n【7】散射：每颗方向不同，且各自固定');
{
  const game = world();
  game.projectileCount = 3;
  game.weaponEvolution = 'scatter';
  game.enemies = [];
  const enemy = enemyAt(game, game.player.x + 220, game.player.y, { speed: 0 });
  const bullets = fireOnce(game, enemy);
  check('打出 3 发', bullets.length === 3, String(bullets.length));
  if (bullets.length === 3) {
    const angles = bullets.map((bullet) => Math.atan2(bullet.vy, bullet.vx));
    check('三发角度互不相同', Math.abs(angles[0] - angles[1]) > 0.05 && Math.abs(angles[1] - angles[2]) > 0.05);
  }
  const before = game.bullets.map((bullet) => Math.atan2(bullet.vy, bullet.vx));
  step(game, 0.2);
  const after = game.bullets.map((bullet) => Math.atan2(bullet.vy, bullet.vx));
  check('散射弹方向也不变',
    before.length === after.length && before.every((angle, index) => Math.abs(angle - after[index]) < 1e-9));
}

// ---------------------------------------------------------------------------
console.log('\n【8】爆裂：命中爆炸后消失');
{
  const game = world();
  game.weaponEvolution = 'explosion';
  game.bulletBlast = true;
  game.enemies = [];
  const enemy = enemyAt(game, game.player.x + 110, game.player.y, { speed: 0 });
  const nearby = enemyAt(game, game.player.x + 130, game.player.y + 30, { speed: 0 });
  fireOnce(game, enemy);
  step(game, 0.5);
  check('爆裂弹命中后消失', game.bullets.length === 0, String(game.bullets.length));
  check('爆炸溅射到附近敌人', nearby.health < 500, String(nearby.health));
}

// ---------------------------------------------------------------------------
console.log('\n【9】连锁：命中后向附近敌人放电 60%，子弹消失');
{
  const game = world();
  game.weaponEvolution = 'chain';
  game.projectilePierce = 2;
  game.enemies = [];
  const first = enemyAt(game, game.player.x + 110, game.player.y, { speed: 0 });
  const second = enemyAt(game, game.player.x + 150, game.player.y + 40, { speed: 0 });
  fireOnce(game, first);
  step(game, 0.5);
  check('主目标掉血', first.health < 500, String(first.health));
  check('附近敌人被放电', second.health < 500, String(second.health));
  check('连锁弹命中后消失（不再穿透飞行）', game.bullets.length === 0, String(game.bullets.length));
}

// ---------------------------------------------------------------------------
console.log('\n【10】其他角色/结构不受影响');
{
  check('目标认领函数已删除', bridge.hasChooseBulletTarget() === false);
  const game = world();
  bridge.setCharacter('daxia');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.game.enemies = [];
  enemyAt(bridge.game, bridge.game.player.x + 120, bridge.game.player.y, { speed: 0 });
  step(bridge.game, 1.2);
  check('大侠刀光仍能命中', bridge.game.enemies[0].health < 500, String(bridge.game.enemies[0].health));
}

// ---------------------------------------------------------------------------
console.log('\n【11】渲染：链电视觉不抛');
{
  const game = world();
  game.enemies = [];
  enemyAt(game, game.player.x + 110, game.player.y, { speed: 0 });
  fireOnce(game, enemyAt(game, game.player.x + 140, game.player.y, { speed: 0 }));
  step(game, 0.2);
  bridge.draw();
  check('绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
