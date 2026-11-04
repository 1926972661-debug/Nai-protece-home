// =============================================================================
// 冲刺瞄准 v3 回归测试（新机制：箭头长度 = 冲刺距离）
//
// 规格：长按 180ms 进入 0.1x（无上限）；拖动 1:1 决定距离；三档吸附 40/70/100%；
//   锁定目标 28px / 40px 滞回，箭头长度吸附目标距离；
//   取消：回拖 ≤20px 或拖出 1.5×上限；取消不消耗冷却。
//
// 运行：node tools/dash-aim.test.mjs
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
const context = vm.createContext(sandbox, { name: 'dash-aim-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  get viewInsets(){ return viewInsets; },
  get skillTouchId(){ return skillTouchId; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, updateGame: updateGame,
  resolveDashDirection: resolveDashDirection, aimCrosshair: aimCrosshair,
  aimDashScreenDistance: aimDashScreenDistance, aimDragVector: aimDragVector,
  aimArrowGeometry: aimArrowGeometry, updateAimTarget: updateAimTarget,
  enemyVisualCenter: enemyVisualCenter, enemyLockRadius: enemyLockRadius,
  worldToScreen: worldToScreen, gameWorldZoom: gameWorldZoom,
  skillButtonBounds: skillButtonBounds,
}; })()`, context, { filename: 'dash-aim-bridge.js' });
stub.flushImageLoads();

const BASE_CLOCK = 1_000_000_000;
const world = () => {
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(BASE_CLOCK);
  return bridge.game;
};
const skill = () => bridge.skillButtonBounds();
const holdSkill = () => { const b = skill(); stub.touch.start({ identifier: 61, clientX: b.x, clientY: b.y }); };
const moveSkill = (dx, dy) => { const b = skill(); stub.touch.move({ identifier: 61, clientX: b.x + dx, clientY: b.y + dy }); };
const releaseSkill = (dx, dy) => { const b = skill(); stub.touch.end({ identifier: 61, clientX: b.x + dx, clientY: b.y + dy }); };
const enterAim = () => {
  holdSkill();
  bridge.setClock(BASE_CLOCK + 200);
  bridge.updateGame(0.01);
};
const makeEnemy = (x, y) => ({
  x, y, radius: 12, health: 1000, maxHealth: 1000, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0,
});
// 屏幕坐标 → 世界坐标（worldToScreen 的逆运算；shake 为 0 时成立）
const worldFromScreen = (game, sx, sy) => ({
  x: (sx - bridge.width / 2) / bridge.gameWorldZoom + bridge.width / 2 + game.camera.x,
  y: (sy - bridge.height / 2) / bridge.gameWorldZoom + bridge.height / 2 + game.camera.y,
});
// 把敌人放到「视觉中心 = 屏幕上某点」
const placeEnemyAtScreen = (game, sx, sy) => {
  const spriteHeight = 12 * 3.05 * bridge.gameWorldZoom;
  const world = worldFromScreen(game, sx, sy + spriteHeight * 0.32);
  const enemy = makeEnemy(world.x, world.y);
  game.enemies.push(enemy);
  game.elapsed = -(enemy.x * 0.01) / 8;   // bob 归零
  return enemy;
};

// ---------------------------------------------------------------------------
console.log('\n【1】快速点击：<180ms 直接冲刺（满距），不进时缓');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  holdSkill();
  bridge.setClock(BASE_CLOCK + 100);
  releaseSkill(0, 0);
  check('未进入瞄准', game.aimActive === false);
  check('冲刺已触发（扣 1 格）', game.dashCharges === game.dashChargeMax - 1, `${game.dashCharges}/${game.dashChargeMax}`);
  check('默认冲满距（时长 0.26s）', Math.abs(game.dashTimer - bridge.balance.dashDuration) < 1e-6, String(game.dashTimer));
}

// ---------------------------------------------------------------------------
console.log('\n【2】长按 200ms：进入 0.1x，且没有时长上限');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  check('进入瞄准', game.aimActive === true);
  const before = game.elapsed;
  bridge.updateGame(0.1);
  check('世界 delta ×0.1', Math.abs((game.elapsed - before) - 0.01) < 1e-6, (game.elapsed - before).toFixed(4));
  bridge.setClock(BASE_CLOCK + 30200);
  for (let i = 0; i < 5; i += 1) bridge.updateGame(0.016);
  check('30 秒后仍在瞄准（无上限）', game.aimActive === true);
}

// ---------------------------------------------------------------------------
console.log('\n【3】箭头：拖动 1:1 决定冲刺距离');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  moveSkill(0, -100);
  bridge.updateAimTarget();
  const arrow = bridge.aimArrowGeometry();
  check('拖 100px → 箭头/冲刺 100px', Math.abs(arrow.dashDistance - 100) < 0.5, String(arrow.dashDistance));
  const playerScreen = bridge.worldToScreen(game.player.x, game.player.y);
  check('箭头尖端距角色 = 100px',
    Math.abs(Math.hypot(arrow.endX - playerScreen.x, arrow.endY - playerScreen.y) - 100) < 0.5);
  check('起点偏移 18px（不压角色）',
    Math.abs(Math.hypot(arrow.startX - playerScreen.x, arrow.startY - playerScreen.y) - 18) < 1e-6,
    String(Math.hypot(arrow.startX - playerScreen.x, arrow.startY - playerScreen.y)));
}

// ---------------------------------------------------------------------------
console.log('\n【4】三档吸附：40% / 70% / 100%');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  const max = game.moveSpeed * bridge.balance.dashSpeedFactor * bridge.balance.dashDuration * bridge.gameWorldZoom;
  moveSkill(0, -Math.round(max * 0.4));
  const tier40 = bridge.aimArrowGeometry().dashDistance;
  check('拖到 40% 附近 → 吸附 40%', Math.abs(tier40 - max * 0.4) < 1, `${tier40.toFixed(1)} vs ${(max * 0.4).toFixed(1)}`);
  moveSkill(0, -Math.round(max * 0.7));
  const tier70 = bridge.aimArrowGeometry().dashDistance;
  check('拖到 70% 附近 → 吸附 70%', Math.abs(tier70 - max * 0.7) < 1, `${tier70.toFixed(1)}`);
  moveSkill(0, -Math.round(max * 1.1));
  const tier100 = bridge.aimArrowGeometry().dashDistance;
  check('拖过上限 → 夹到 100%', Math.abs(tier100 - max) < 1, `${tier100.toFixed(1)} vs ${max.toFixed(1)}`);
}

// ---------------------------------------------------------------------------
console.log('\n【5】锁定：28px 进入、40px 滞回、箭头吸附目标距离');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  moveSkill(0, -100);
  const cross = bridge.aimCrosshair();
  const target = placeEnemyAtScreen(game, cross.x, cross.y);
  bridge.updateAimTarget();
  check('准星覆盖敌人 → 锁定', game.aimTarget === target);
  const locked = bridge.aimArrowGeometry();
  const playerScreen = bridge.worldToScreen(game.player.x, game.player.y);
  const targetCenter = bridge.enemyVisualCenter(target);
  check('锁定后箭头长度 = 目标距离（吸附）',
    Math.abs(locked.dashDistance - Math.hypot(targetCenter.x - playerScreen.x, targetCenter.y - playerScreen.y)) < 1,
    locked.dashDistance.toFixed(1));

  moveSkill(0, -130);
  bridge.updateAimTarget();
  check('准星移开 30px 仍保持锁定（滞回）', game.aimTarget === target);
  moveSkill(60, -170);
  bridge.updateAimTarget();
  check('移开 40px 以上解锁', game.aimTarget === null);
}

// ---------------------------------------------------------------------------
console.log('\n【6】取消：回拖 20px / 超距 1.5 倍，都不消耗冷却');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  moveSkill(8, 0);
  releaseSkill(8, 0);
  check('回拖 20px 内松手 = 取消', game.aimActive === false && game.dashCharges === game.dashChargeMax, `${game.dashCharges}/${game.dashChargeMax}`);

  const game2 = world();
  game2.dashCharges = game2.dashChargeMax;
  game2.enemies = [];
  enterAim();
  const max = game2.moveSpeed * bridge.balance.dashSpeedFactor * bridge.balance.dashDuration * bridge.gameWorldZoom;
  moveSkill(0, -Math.round(max * 1.8));
  bridge.updateAimTarget();
  check('拖出 1.5×上限 → 超距状态', game2.aimOverdrag === true);
  releaseSkill(0, -Math.round(max * 1.8));
  check('超距松手 = 取消，不消耗充能', game2.aimActive === false && game2.dashCharges === game2.dashChargeMax, `${game2.dashCharges}/${game2.dashChargeMax}`);
}

// ---------------------------------------------------------------------------
console.log('\n【9】自适应增益：开放方向 1:1，受限方向按可用行程补足');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  const max = game.moveSpeed * bridge.balance.dashSpeedFactor * bridge.balance.dashDuration * bridge.gameWorldZoom;

  // 向上：空间充足 → need = max，拖 100 = 100（完全跟手）
  moveSkill(0, -100);
  const open = bridge.aimArrowGeometry().dashDistance;
  check('开放方向保持 1:1（拖 100 → 100）', Math.abs(open - 100) < 0.5, open.toFixed(1));

  // 向下：技能键到屏幕底只有约 112px → 拖到边缘也能满距
  const button = bridge.skillButtonBounds();
  const roomDown = bridge.height - bridge.viewInsets.bottom - button.y;
  moveSkill(0, roomDown);
  const restricted = bridge.aimArrowGeometry().dashDistance;
  check('受限方向拖到边缘 = 满距', Math.abs(restricted - max) < 1, `${restricted.toFixed(1)} / ${max.toFixed(1)}`);
  check('受限方向需要的手指行程 < 满距（补了增益）', roomDown * 0.92 < max, (roomDown * 0.92).toFixed(1));

  // 向右下 30°：也能满距（这正是用户报的方向）
  const roomRight = bridge.width - button.x;
  const diagonal = Math.min(roomRight / 0.5, roomDown / 0.866);
  moveSkill(0.5 * diagonal, 0.866 * diagonal);
  const diagonalLength = bridge.aimArrowGeometry().dashDistance;
  check('右下拖到边缘 = 满距', Math.abs(diagonalLength - max) < 1, `${diagonalLength.toFixed(1)} / ${max.toFixed(1)}`);
}

console.log('\n【8】技能键位置：向左上移动后右下行程变长');
{
  const button = bridge.skillButtonBounds();
  check('按键中心在屏幕内',
    button.x < bridge.width && button.y < bridge.height && button.x - 33 > 0 && button.y - 33 > 0,
    `${button.x.toFixed(0)},${button.y.toFixed(0)}`);
  const roomRight = bridge.width - button.x;
  const roomBottom = bridge.height - bridge.viewInsets.bottom - button.y;
  const diagonalRoom = Math.min(roomRight / 0.5, roomBottom / 0.866);
  check('右下方向手指行程 ≥ 120px（原来约 115）', diagonalRoom >= 120, diagonalRoom.toFixed(1));
  check('按键仍在右下角区域（但更靠左）',
    button.x > bridge.width * 0.5 && button.y > bridge.height * 0.55,
    `${(button.x / bridge.width).toFixed(2)},${(button.y / bridge.height).toFixed(2)}`);
}
console.log('\n【7】瞄准期间玩家同样 0.1x + 绘制不抛');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.enemies = [];
  enterAim();
  moveSkill(0, -100);
  bridge.updateAimTarget();
  game.input = { x: 1, y: 0 };
  const beforeX = game.player.x;
  bridge.updateGame(0.1);
  const expected = game.moveSpeed * 0.1 * 0.1;
  check('玩家移动 ×0.1', Math.abs((game.player.x - beforeX) - expected) < 1.5,
    `${(game.player.x - beforeX).toFixed(2)} vs ${expected.toFixed(2)}`);
  game.aimOverdrag = true;
  bridge.draw();
  check('瞄准态绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
