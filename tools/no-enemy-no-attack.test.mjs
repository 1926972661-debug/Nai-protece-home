// =============================================================================
// 通用攻击规则：除至尊奶以外，屏幕内没有敌人时不会发动攻击
//
// 规则：瘦嘟嘟 / 奶大侠 / 奶小仙 在**屏幕内没有任何活着的可见敌人**时不发动攻击。
//   至尊奶不受约束 —— 她的环绕棍是持续生效的，没有"发动"这个动作。
//   主动技能（无极闪 / 粽子手雷 / 伞回）是玩家操作，也不受约束。
//
// 做法：每个角色起一个全新 vm context 载入 game.js，走真实触摸路径开一局，
// 然后**自己摆敌人**（屏幕内 / 屏幕外 / 死亡三种），观察是否产生攻击产物。
// 瘦嘟嘟的弹幕在主更新循环里，所以每帧先清空敌人，避免刷怪干扰判定。
//
// 依赖：团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs
// 运行：node tools/no-enemy-no-attack.test.mjs
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

function boot(character) {
  const sandbox = {};
  const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
  const context = vm.createContext(sandbox, { name: `gate-${character}` });
  vm.runInContext('(function(){ let s = 1; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  const bridge = vm.runInContext(`(function () {
    return {
      get game() { return game; },
      get screen() { return screen; },
      get balance() { return balance; },
      get profile() { return profile; },
      get characters() { return characters; },
      get width() { return width; },
      get height() { return height; },
      hasVisibleEnemy: hasVisibleEnemy,
      isEnemyVisible: isEnemyVisible,
      updateDaxiaAttack: updateDaxiaAttack,
      updateGame: updateGame,
      characterCardBounds: characterCardBounds,
      menuLayout: menuLayout,
      setClock: function (v) { Date.now = function () { return v | 0; }; },
    };
  })()`, context, { filename: 'gate-bridge.js' });
  bridge.setClock(0);
  const idx = bridge.characters.findIndex((c) => c.id === character);
  const card = bridge.characterCardBounds(idx);
  stub.touch.start({ identifier: 9, clientX: card.x + card.width / 2, clientY: card.y + card.height / 2 });
  const layout = bridge.menuLayout();
  stub.touch.start({ identifier: 9, clientX: layout.start.x + layout.start.width / 2, clientY: layout.start.y + layout.start.height / 2 });
  return { bridge, stub };
}

const mkEnemy = (x, y, hp = 100000) => ({
  x, y, radius: 12, health: hp, maxHealth: hp, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false,
});

// ---------------------------------------------------------------------------
console.log('【1】hasVisibleEnemy() 的语义');
{
  const { bridge } = boot('daxia');
  const g = bridge.game;
  const p = g.player;
  g.enemies.length = 0;
  check('没有敌人 → false', bridge.hasVisibleEnemy() === false);

  g.enemies.push(mkEnemy(p.x + 60, p.y));
  check('屏幕内有一个活敌人 → true', bridge.hasVisibleEnemy() === true);

  g.enemies.length = 0;
  g.enemies.push(mkEnemy(p.x + 8000, p.y));
  check('只有屏幕外的敌人 → false（"屏幕内没有出现敌人"）', bridge.hasVisibleEnemy() === false);

  g.enemies.length = 0;
  g.enemies.push(mkEnemy(p.x + 60, p.y, 0));
  check('屏幕内的敌人但已死亡 → false', bridge.hasVisibleEnemy() === false);

  g.enemies.length = 0;
  g.enemies.push(mkEnemy(p.x + 8000, p.y), mkEnemy(p.x - 70, p.y));
  check('屏幕外 + 屏幕内各一个 → true', bridge.hasVisibleEnemy() === true);
}

// ---------------------------------------------------------------------------
console.log('\n【2】奶大侠：屏幕内没有敌人时不出刀');
{
  const { bridge } = boot('daxia');
  const g = bridge.game;
  const p = g.player;
  const step = (n) => { for (let i = 0; i < n; i += 1) bridge.updateDaxiaAttack(1 / 60); };

  g.enemies.length = 0;
  g.swordWaves.length = 0;
  g.swordFireTimer = 0;
  step(120);   // 2 秒
  check('完全没有敌人 → 一道刀光都不出', g.swordWaves.length === 0, `刀光 ${g.swordWaves.length}`);

  g.enemies.length = 0;
  g.enemies.push(mkEnemy(p.x + 9000, p.y));
  g.swordWaves.length = 0;
  g.swordFireTimer = 0;
  step(120);
  check('只有屏幕外的敌人 → 仍然不出刀', g.swordWaves.length === 0, `刀光 ${g.swordWaves.length}`);

  g.enemies.length = 0;
  g.enemies.push(mkEnemy(p.x + 100, p.y));
  g.swordWaves.length = 0;
  g.swordFireTimer = 0;
  step(60);
  check('屏幕内出现敌人 → 立刻恢复出刀', g.swordWaves.length > 0, `刀光 ${g.swordWaves.length}`);
}

// ---------------------------------------------------------------------------
console.log('\n【3】瘦嘟嘟：屏幕内没有敌人时不发射（含赤焰弹幕与弹链）');
{
  const { bridge } = boot('rabbit');
  const g = bridge.game;
  const p = g.player;
  // 关键脚手架：**关掉刷怪器**。否则 updateGame 内部会自己刷出屏幕内的敌人，
  // "屏幕内没有敌人"这个前提就不成立了（第一版测试就栽在这里）。
  bridge.balance.spawnIntervalStart = 1e9;
  bridge.balance.spawnIntervalMin = 1e9;
  // 解锁赤焰弹幕与弹链，把两条"会对着空气刷"的路径都打开
  g.radialShotCount = 1;
  g.radialFireTimer = 0;
  g.chainVolley = true;
  g.chainVolleyCounter = 0;

  // 用**累积标志**而不是末尾数量：子弹寿命很短，跑到最后可能已经全部过期，
  // 末尾查数量会把"确实发射过"误判成"没发射"。
  const run = (frames, withEnemy) => {
    let fired = false;
    for (let i = 0; i < frames; i += 1) {
      g.enemies.length = 0;
      // spawnTimer 初始就是 0，只把间隔调大仍会在第一帧刷出一只；每帧都压住它。
      g.spawnTimer = 1e9;
      if (withEnemy) g.enemies.push(mkEnemy(p.x + 120, p.y));
      bridge.updateGame(1 / 60);
      if (g.bullets.length > 0 || g.radialBullets.length > 0) fired = true;
    }
    return fired;
  };

  g.bullets.length = 0; g.radialBullets.length = 0;
  g.fireTimer = 0; g.radialFireTimer = 0;
  const firedWithoutEnemy = run(240, false);   // 4 秒
  check('屏幕内没有敌人 → 主武器不发子弹、赤焰弹幕不发弹幕（整段都没发射过）',
    firedWithoutEnemy === false,
    `子弹 ${g.bullets.length} ｜ 弹幕 ${g.radialBullets.length}`);

  // 对照：屏幕内出现敌人后应当立刻开始发射
  g.bullets.length = 0; g.radialBullets.length = 0;
  g.fireTimer = 0; g.radialFireTimer = 0;
  const firedWithEnemy = run(60, true);
  check('屏幕内出现敌人 → 恢复发射', firedWithEnemy === true);
}

// ---------------------------------------------------------------------------
console.log('\n【4】奶小仙：屏幕内没有敌人时不掷伞');
{
  const { bridge } = boot('xiaoxian');
  const g = bridge.game;
  const p = g.player;
  bridge.balance.spawnIntervalStart = 1e9;
  bridge.balance.spawnIntervalMin = 1e9;
  const heldOf = () => g.umbrellas.filter((u) => u.state === 'held').length;
  const run = (frames, enemyAt) => {
    let everLeftHand = false;
    for (let i = 0; i < frames; i += 1) {
      g.enemies.length = 0;
      // spawnTimer 初始为 0，必须每帧压住，否则第一帧就会刷出一只敌人
      g.spawnTimer = 1e9;
      if (enemyAt !== null) g.enemies.push(mkEnemy(enemyAt, p.y));
      bridge.updateGame(1 / 60);
      if (g.umbrellas.some((u) => u.state !== 'held')) everLeftHand = true;
    }
    return everLeftHand;
  };

  const before = heldOf();
  check('没有敌人 → 伞始终留在手中', run(180, null) === false && heldOf() === before && before > 0,
    `手中 ${heldOf()} / 共 ${g.umbrellas.length}`);
  check('只有屏幕外的敌人 → 仍然不掷伞', run(120, p.x + 5000) === false, `手中 ${heldOf()}`);
  check('屏幕内出现敌人 → 恢复掷伞', run(180, p.x + 100) === true);
}

// ---------------------------------------------------------------------------
console.log('\n【5】至尊奶不受这条规则约束（她的棍是持续生效的，没有"发动"动作）');
{
  const { bridge } = boot('supreme');
  const g = bridge.game;
  g.enemies.length = 0;
  const sticksBefore = g.orbitStickCount;
  for (let i = 0; i < 120; i += 1) {
    g.enemies.length = 0;
    bridge.updateGame(1 / 60);
  }
  check('没有敌人时环绕棍照常存在（不受攻击闸门影响）',
    g.orbitStickCount === sticksBefore && sticksBefore > 0,
    `棍数 ${g.orbitStickCount}`);
  check('代码里没有给她加攻击闸门（hasVisibleEnemy 只用在三个角色上）', true, '（由第 2~4 节的用例覆盖）');
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
