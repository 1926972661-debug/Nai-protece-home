// =============================================================================
// 冲刺充能系统回归测试（方案见 reports/角色技能/43-冲刺充能机制v2-上限成长.md）
//
// 2 格基础充能；每格 4.5s 回复；红卡 +1 上限；棍子 ≥6 +1 上限（上限 4）；
// 升上限补 1 格；有充能随时放；取消不扣；瞄准松手才扣。
//
// 运行：node tools/dash-charge.test.mjs
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
const context = vm.createContext(sandbox, { name: 'dash-charge-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  activateDash: activateDash, grantChargeSlot: grantChargeSlot, skillReady: skillReady,
  useActiveSkill: useActiveSkill,
  skillButtonBounds: skillButtonBounds,
  get skillTouchId(){ return skillTouchId; },
}; })()`, context, { filename: 'dash-charge-bridge.js' });
stub.flushImageLoads();

const BASE_CLOCK = 1_000_000_000;
const world = (character = 'supreme') => {
  bridge.setCharacter(character);
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(BASE_CLOCK);
  return bridge.game;
};
const advance = (game, seconds, step = 0.05) => {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    bridge.updateGame(dt);
    left -= dt;
  }
};

// ---------------------------------------------------------------------------
console.log('\n【1】开局 2/2，施放扣 1，4.5 秒回满');
{
  const game = world();
  check('基础上限 2', game.dashChargeMax === 2, String(game.dashChargeMax));
  check('开局满充能 2/2', game.dashCharges === 2, `${game.dashCharges}/${game.dashChargeMax}`);
  bridge.activateDash();
  check('施放后 1/2', game.dashCharges === 1, `${game.dashCharges}/${game.dashChargeMax}`);
  advance(game, 4.4);
  check('4.4 秒还没回满', game.dashCharges === 1, `${game.dashCharges}/${game.dashChargeMax}`);
  advance(game, 0.2);
  check('4.6 秒回满 2/2', game.dashCharges === 2, `${game.dashCharges}/${game.dashChargeMax}`);
}

// ---------------------------------------------------------------------------
console.log('\n【2】满格不累积；0 格不能放/不能瞄准');
{
  const game = world();
  advance(game, 5);
  check('满格时回复计时为 0（不浪费）', game.dashChargeTimer === 0, String(game.dashChargeTimer));
  game.dashCharges = 0;
  check('0 格时 skillReady=false', bridge.skillReady() === false);
  bridge.activateDash();
  check('0 格时施放无效', game.dashCharges === 0 && game.dashTimer <= 0, String(game.dashCharges));
}

// ---------------------------------------------------------------------------
console.log('\n【3】回复中施放不重置计时');
{
  const game = world();
  game.dashCharges = 1;
  advance(game, 3);
  const progress = game.dashChargeTimer;
  bridge.activateDash();
  check('施放后计时保留', Math.abs(game.dashChargeTimer - progress) < 0.2,
    `${progress.toFixed(2)} → ${game.dashChargeTimer.toFixed(2)}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】红卡：上限 +1，补 1 格，只生效一次');
{
  const game = world();
  game.dashCharges = 1;
  bridge.grantChargeSlot('red');
  check('红卡后上限 3', game.dashChargeMax === 3, String(game.dashChargeMax));
  check('补 1 格（1 → 2）', game.dashCharges === 2, String(game.dashCharges));
  bridge.grantChargeSlot('red');
  check('重复红卡不再加', game.dashChargeMax === 3, String(game.dashChargeMax));
}

// ---------------------------------------------------------------------------
console.log('\n【5】棍子 ≥6：再 +1，上限 4；7/8 根不再触发');
{
  const game = world();
  game.orbitStickCount = 6;
  advance(game, 0.1);
  check('6 根 → 上限 3', game.dashChargeMax === 3, String(game.dashChargeMax));
  bridge.grantChargeSlot('red');
  check('红卡叠加 → 上限 4', game.dashChargeMax === 4, String(game.dashChargeMax));
  game.orbitStickCount = 8;
  advance(game, 0.1);
  check('8 根仍 4 格', game.dashChargeMax === 4, String(game.dashChargeMax));
  bridge.grantChargeSlot('sticks');
  check('上限不超过 4', game.dashChargeMax === 4, String(game.dashChargeMax));
}

// ---------------------------------------------------------------------------
console.log('\n【6】充能时间：疾风步缩短，下限 1.6s');
{
  const game = world();
  const before = game.dashRecharge;
  const card = vm.runInContext('upgrades.find((u) => u.title === \'疾风步\')', context);
  card.apply();
  check('疾风步后充能时间变短', game.dashRecharge < before, `${before} → ${game.dashRecharge}`);
  for (let i = 0; i < 10; i += 1) card.apply();
  check('充能时间不低于 1.6s', Math.abs(game.dashRecharge - 1.6) < 1e-6, String(game.dashRecharge));
}

// ---------------------------------------------------------------------------
console.log('\n【7】其他角色仍是冷却制，不受影响');
{
  const game = world('rabbit');
  check('瘦嘟嘟没有充能字段变化', game.dashCharges === 2 && game.dashChargeMax === 2);
  game.grenadeCooldown = 5;
  check('手雷冷却仍在', bridge.skillReady() === false && game.grenadeCooldown === 5);
}

// ---------------------------------------------------------------------------
console.log('\n【8】HUD 绘制：0/2 与 4/4 都不抛');
{
  const game = world();
  game.dashCharges = 0;
  bridge.draw();
  game.dashChargeMax = 4;
  game.dashCharges = 4;
  bridge.draw();
  check('充能 0 与 4 格绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
