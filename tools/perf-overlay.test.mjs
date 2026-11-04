// =============================================================================
// 性能自测浮层 + 顶部面板位置 回归测试
//
// 背景：用户看不到帧率（没有 Performance 面板），所以改成游戏自己报——
//   ① 战斗 HUD 浮层（右上角时间区域连点 3 下）：FPS / 帧耗时 / 最差帧 / 实体数
//   ② 结算页一行性能摘要
//   ③ console 每 2 秒一行（真机调试可直接抄）
// 这个测试覆盖：浮层数据来源、取整、开关手势、结算摘要、以及「顶部面板下移」的常量。
//
// 运行：node tools/perf-overlay.test.mjs
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
const context = vm.createContext(sandbox, { name: 'perf-overlay-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, get perf(){ return perf; }, get viewInsets(){ return viewInsets; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, finishGame: finishGame,
  notePerfFrame: notePerfFrame, perfLines: perfLines, perfEntityCount: perfEntityCount,
  perfToggleBounds: perfToggleBounds, pauseButtonBounds: pauseButtonBounds,
  togglePerfOverlay: togglePerfOverlay,
  HUD_TOP_GAP: HUD_TOP_GAP,
}; })()`, context, { filename: 'perf-bridge.js' });
stub.flushImageLoads();

// 判定「界面上没有小数」：`Lv.1` 里的点是等级标记，先摘掉
const looksClean = (text) => !String(text).replace(/Lv\./g, 'Lv').includes('.')
  && !/NaN|undefined|Infinity|null/.test(String(text));

const tap = (rect) => stub.touch.start({
  identifier: 21,
  clientX: rect.x + rect.width / 2,
  clientY: rect.y + rect.height / 2,
});

// ---------------------------------------------------------------------------
console.log('\n【1】顶部面板下移：常量与派生位置一致');
{
  check('HUD_TOP_GAP = 20', bridge.HUD_TOP_GAP === 20, String(bridge.HUD_TOP_GAP));
  bridge.setCharacter('daxia');
  bridge.startGame();
  const pause = bridge.pauseButtonBounds();
  check('暂停键 = safeArea.top + HUD_TOP_GAP + 8（收进面板）',
    pause.y === bridge.viewInsets.top + bridge.HUD_TOP_GAP + 8, `y=${pause.y}`);
  check('无安全区时面板顶 = 20（不再是 8）', bridge.viewInsets.top + bridge.HUD_TOP_GAP === 20);
  const toggle = bridge.perfToggleBounds();
  check('浮层开关落在面板内部（不越界）',
    toggle.y >= bridge.viewInsets.top + bridge.HUD_TOP_GAP
    && toggle.y + toggle.height <= bridge.viewInsets.top + bridge.HUD_TOP_GAP + 58,
    `y=${toggle.y}..${toggle.y + toggle.height}`);
}

// ---------------------------------------------------------------------------
console.log('\n【2】帧率采样：rAF 时间戳喂进去后出整数 fps');
{
  bridge.startGame();
  const perf = bridge.perf;
  // 摆 3 个敌人，实体峰值才有东西可数（本测试不跑 updateGame，不会自己刷怪）
  for (let i = 0; i < 3; i += 1) {
    bridge.game.enemies.push({
      x: 100 + i * 30, y: 200, radius: 12, health: 10, maxHealth: 10, type: 'basic',
      weight: 1, speed: 30, damage: 1, facing: 1, pushTrail: [], stun: 0, hitFlash: 0,
    });
  }
  // 喂 90 帧、每帧 16ms → 约 62fps
  let t = 1000;
  for (let i = 0; i < 90; i += 1) { bridge.notePerfFrame(t); t += 16; }
  check('fps 已算出且为正整数', Number.isInteger(perf.fps) && perf.fps > 50 && perf.fps < 75, `fps=${perf.fps}`);
  check('帧耗时是整数毫秒', Number.isInteger(perf.frameMs), `${perf.frameMs}ms`);
  check('最差帧记录的是整数', Number.isInteger(perf.frameMsMax), `${perf.frameMsMax}ms`);
  check('实体峰值有记录', perf.peakEntities >= 1, String(perf.peakEntities));

  // 卡一下：一帧 200ms，最差帧应该被拉高，但 fps 是 0.5 秒窗口平均，不会被拖成 0
  bridge.notePerfFrame(t); bridge.notePerfFrame(t + 200);
  check('长帧会把最差帧拉高', perf.frameMsMax >= 200, `${perf.frameMsMax}ms`);

  const lines = bridge.perfLines();
  check('浮层两行文字都不含小数点/NaN', lines.length === 2 && lines.every(looksClean), lines.join(' / '));
}

// ---------------------------------------------------------------------------
console.log('\n【3】开关手势：时间区域连点 3 下');
{
  bridge.startGame();
  const perf = bridge.perf;
  check('默认关闭', perf.visible === false);
  const rect = bridge.perfToggleBounds();
  // stub 的 Date.now 由桥外控制；这里用真实时间，三次点击落在 1.5 秒窗口内
  tap(rect); tap(rect);
  check('点 2 下还没开', perf.visible === false);
  tap(rect);
  check('点第 3 下打开浮层', perf.visible === true);
  check('打开后计数归零', perf.taps === 0);
  tap(rect); tap(rect); tap(rect);
  check('再点 3 下关闭', perf.visible === false);

  // 点浮层开关不该顺带触发暂停/技能
  bridge.startGame();
  tap(rect);
  check('点时间区域不会切到暂停屏', bridge.screen === 'game', bridge.screen);
}

// ---------------------------------------------------------------------------
console.log('\n【4】结算页性能摘要');
{
  bridge.startGame();
  const game = bridge.game;
  // 造 120 帧好帧，然后结算
  let t = 5000;
  for (let i = 0; i < 120; i += 1) { bridge.notePerfFrame(t); t += 16; }
  bridge.finishGame(false);
  check('结算屏为 result', bridge.screen === 'result', bridge.screen);
  check('perfRun 已生成', !!game.perfRun, JSON.stringify(game.perfRun || null));
  if (game.perfRun) {
    check('摘要三个数都是整数',
      Number.isInteger(game.perfRun.fps) && Number.isInteger(game.perfRun.worst) && Number.isInteger(game.perfRun.peak),
      JSON.stringify(game.perfRun));
    check('平均 fps 落在合理区间', game.perfRun.fps >= 40 && game.perfRun.fps <= 70, `${game.perfRun.fps}fps`);
  }
  bridge.draw(); // 结算页真的画一遍，确认摘要那一行不抛
  check('结算页画完不抛异常', true);

  // 采样太少时不给摘要：5 帧的局报出 fps 是假数字
  bridge.startGame();
  bridge.notePerfFrame(9000);
  bridge.notePerfFrame(9016);
  bridge.finishGame(false);
  check('采样不足 60 帧时不给摘要', bridge.game.perfRun === null, JSON.stringify(bridge.game.perfRun || null));
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
