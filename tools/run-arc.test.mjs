// =============================================================================
// 一局的「弧线」：首领倒计时 + 结算页进度行
//
// 背景：这游戏的一局终点是 bossSpawnTime（150 秒）的首领战，但改之前玩家完全看不见
// 「还有多久」；结算页也只说「坚持 N 秒」。本轮补两处：
//   ① 战斗 HUD：暂停键右边常驻「首领 60 秒」/「首领已登场」/「首领战中」
//   ② 结算页：`第 5 波 · 差 42 秒见到首领` / `首领未击退 · 第 7 波` / `首领已击退 · 第 8 波`
//
// 运行：node tools/run-arc.test.mjs
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
const context = vm.createContext(sandbox, { name: 'run-arc-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, get balance(){ return balance; },
  get viewInsets(){ return viewInsets; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, finishGame: finishGame,
  bossCountdownLabel: bossCountdownLabel, battleWaveLabel: battleWaveLabel,
  pauseButtonBounds: pauseButtonBounds, runArcLabel: runArcLabel,
  bossSpawnTime: bossSpawnTime,
}; })()`, context, { filename: 'run-arc-bridge.js' });
stub.flushImageLoads();

const noDecimal = (text) => !String(text).replace(/Lv\./g, '').includes('.');

// ---------------------------------------------------------------------------
console.log('\n【1】首领倒计时：150 秒 → 整数秒，向上取整');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  check('终点就是 balance.bossSpawnTime（150 秒）', bridge.bossSpawnTime === 150, String(bridge.bossSpawnTime));
  game.elapsed = 0;
  check('开局显示「首领 150 秒」', bridge.bossCountdownLabel() === '首领 150 秒', bridge.bossCountdownLabel());
  game.elapsed = 90;
  check('第 90 秒显示「首领 60 秒」', bridge.bossCountdownLabel() === '首领 60 秒', bridge.bossCountdownLabel());
  game.elapsed = 149.2;
  check('剩 0.8 秒向上取整为 1（不显示 0）', bridge.bossCountdownLabel() === '首领 1 秒', bridge.bossCountdownLabel());
  game.elapsed = 149.99;
  check('绝不出现小数', noDecimal(bridge.bossCountdownLabel()), bridge.bossCountdownLabel());
  game.elapsed = 160;
  check('超过终点但首领未登场也不显示负数', bridge.bossCountdownLabel() === '首领 0 秒', bridge.bossCountdownLabel());
  game.bossSpawned = true;
  game.bossActive = true;
  check('首领登场后变成「首领战中」', bridge.bossCountdownLabel() === '首领战中', bridge.bossCountdownLabel());
  game.bossActive = false;
  check('首领已倒下但没结算时是「首领已登场」', bridge.bossCountdownLabel() === '首领已登场', bridge.bossCountdownLabel());
}

// ---------------------------------------------------------------------------
console.log('\n【2】倒计时已合并进 HUD 第二行（不再有独立浮块）');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  game.elapsed = 30;
  game.wave = 3;
  game.waveKills = 7;
  game.waveGoal = 20;
  game.bossSpawned = false;
  const label = bridge.battleWaveLabel();
  check('第二行同时含波次/击杀/首领倒计时',
    label.includes('波 3') && label.includes('击杀 7/20') && label.includes('首领'), label);
  const pause = bridge.pauseButtonBounds();
  check('暂停钮收进面板（58px 内）',
    pause.y >= bridge.viewInsets.top + 20 && pause.y + pause.height <= bridge.viewInsets.top + 20 + 58,
    `y=${pause.y}..${pause.y + pause.height}`);
  check('小地图函数已删除', typeof bridge.drawMiniMap === 'undefined');
}

console.log('\n【3】结算页的进度行：三种结局三句话');
{
  bridge.setCharacter('rabbit');
  bridge.startGame();
  const game = bridge.game;
  game.elapsed = 108;
  game.wave = 5;
  game.bossSpawned = false;
  game.resultWon = false;
  let label = bridge.runArcLabel();
  check('死在首领前：说明还差多少秒', label === '第 5 波 · 差 42 秒见到首领', label);
  check('进度行无小数点', noDecimal(label), label);

  game.bossSpawned = true;
  label = bridge.runArcLabel();
  check('见到首领但没击退', label === '首领未击退 · 第 5 波', label);

  game.resultWon = true;
  label = bridge.runArcLabel();
  check('击退首领', label === '首领已击退 · 第 5 波', label);

  // 边界：正好在 150 秒死，应该写「差 0 秒见到首领」（ceil(0)=0）
  game.resultWon = false;
  game.bossSpawned = false;
  game.elapsed = 150;
  label = bridge.runArcLabel();
  check('正好到终点时写「差 0 秒」而不是负数', label.includes('差 0 秒'), label);
}

// ---------------------------------------------------------------------------
console.log('\n【4】绘制：战斗 HUD 与结算页都能画完');
{
  bridge.setCharacter('xiaoxian');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.draw();
  check('战斗 HUD（含倒计时）绘制不抛异常', true);
  bridge.finishGame(false);
  check('结算屏为 result', bridge.screen === 'result');
  bridge.draw();
  check('结算页（含进度行）绘制不抛异常', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
