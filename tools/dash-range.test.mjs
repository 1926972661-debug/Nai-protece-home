// =============================================================================
// 冲刺距离机制回归：箭头多长就冲多远（含边界/时长/伤害不变）
//
// 运行：node tools/dash-range.test.mjs
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
const context = vm.createContext(sandbox, { name: 'dash-range-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  skillButtonBounds: skillButtonBounds,
  aimArrowGeometry: aimArrowGeometry, aimDashScreenDistance: aimDashScreenDistance,
  dashMaxScreenDistance: dashMaxScreenDistance, dashReachableScreen: dashReachableScreen,
  worldToScreen: worldToScreen, gameWorldZoom: gameWorldZoom,
  enemyVisualCenter: enemyVisualCenter,
}; })()`, context, { filename: 'dash-range-bridge.js' });
stub.flushImageLoads();

const BASE_CLOCK = 1_000_000_000;
const world = () => {
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(BASE_CLOCK);
  bridge.game.critChance = 0;
  bridge.game.enemies = [];
  return bridge.game;
};
const skill = () => bridge.skillButtonBounds();
const aimAt = (dx, dy) => {
  const b = skill();
  stub.touch.start({ identifier: 71, clientX: b.x, clientY: b.y });
  stub.touch.move({ identifier: 71, clientX: b.x + dx, clientY: b.y + dy });
  bridge.setClock(BASE_CLOCK + 200);
  bridge.updateGame(0.01);
};
const releaseAt = (dx, dy) => {
  const b = skill();
  stub.touch.end({ identifier: 71, clientX: b.x + dx, clientY: b.y + dy });
};
const runDash = (game) => {
  const zoom = bridge.gameWorldZoom;
  const start = { x: game.player.x, y: game.player.y };
  for (let i = 0; i < 60 && game.dashTimer > 0; i += 1) bridge.updateGame(0.016);
  return Math.hypot(game.player.x - start.x, game.player.y - start.y) * zoom;
};
const playerScreen = (game) => bridge.worldToScreen(game.player.x, game.player.y);

// ---------------------------------------------------------------------------
console.log('\n【1】拖 100px → 箭头 100px → 实际冲 100px');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  aimAt(0, -100);
  const arrow = bridge.aimArrowGeometry();
  check('箭头长度 100px', Math.abs(arrow.dashDistance - 100) < 0.5, String(arrow.dashDistance));
  releaseAt(0, -100);
  check('冲刺已开始', game.dashTimer > 0, String(game.dashTimer));
  const moved = runDash(game);
  check('实际位移 ≈ 100px（±2）', Math.abs(moved - 100) < 2, moved.toFixed(2));
}

// ---------------------------------------------------------------------------
console.log('\n【2】拖过上限 → 夹到满距');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  aimAt(0, -200);   // 超过上限但不到 1.5×，不触发超距取消
  const max = game.moveSpeed * bridge.balance.dashSpeedFactor * bridge.balance.dashDuration * bridge.gameWorldZoom;
  check('箭头 = 满距', Math.abs(bridge.aimArrowGeometry().dashDistance - max) < 1, String(max.toFixed(1)));
  releaseAt(0, -200);
  const moved = runDash(game);
  check('实际位移 ≈ 满距', Math.abs(moved - max) < 2, moved.toFixed(2));
}

// ---------------------------------------------------------------------------
console.log('\n【3】墙边：箭头与冲刺一起缩短');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.player.x = game.worldWidth - 40;
  game.player.y = game.worldHeight / 2;
  aimAt(100, 0);
  const arrow = bridge.aimArrowGeometry();
  check('贴右墙向右拖：箭头 < 100px', arrow.dashDistance < 100, arrow.dashDistance.toFixed(1));
  releaseAt(100, 0);
  const moved = runDash(game);
  check('实际位移与箭头一致（±2）', Math.abs(moved - arrow.dashDistance) < 2, `${moved.toFixed(2)} vs ${arrow.dashDistance.toFixed(1)}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】持续时间随时长缩放（短冲更短）');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  aimAt(0, -40);
  releaseAt(0, -40);
  const shortTimer = game.dashTimer;
  check('短冲时长 < 0.26s', shortTimer < bridge.balance.dashDuration, shortTimer.toFixed(3));
  check('无敌 = 时长 + 0.08', Math.abs(game.dashInvulnTimer - (shortTimer + bridge.balance.dashInvulnExtra)) < 1e-6,
    game.dashInvulnTimer.toFixed(3));
}

// ---------------------------------------------------------------------------
console.log('\n【5】短冲伤害不变（与满冲同伤害）');
{
  const hitDamage = (dragPixels) => {
    const game = world();
    game.dashCharges = game.dashChargeMax;
    game.baseAttack = 20; game.bonusAttack = 0; game.orbitStickCount = 0; game.critChance = 0;
    const target = {
      x: game.player.x, y: game.player.y - 30, radius: 12, health: 1e9, maxHealth: 1e9,
      type: 'basic', weight: 1, experience: 0, damage: 1, speed: 0, boss: false, eventSerial: 0,
      hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0,
    };
    game.enemies = [target];
    aimAt(0, -dragPixels);
    releaseAt(0, -dragPixels);
    const before = target.health;
    for (let i = 0; i < 30 && game.dashTimer > 0; i += 1) bridge.updateGame(0.016);
    return before - target.health;
  };
  const short = hitDamage(40);
  const full = hitDamage(200);
  check('短冲与满冲命中伤害相同', short > 0 && short === full, `${short} vs ${full}`);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
