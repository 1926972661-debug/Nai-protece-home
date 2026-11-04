// =============================================================================
// 战斗顶部 HUD 精简回归（方案见 reports/角色技能/49-战斗顶部HUD精简方案.md）
//
// 58px 面板、暂停圆钮收进面板、种子移到暂停、删小地图、怪物强化/伞提示改 toast。
//
// 运行：node tools/hud-layout.test.mjs
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
const context = vm.createContext(sandbox, { name: 'hud-layout-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  get viewInsets(){ return viewInsets; }, get HUD_TOP_GAP(){ return HUD_TOP_GAP; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  pauseButtonBounds: pauseButtonBounds, battleWaveLabel: battleWaveLabel,
  hasMiniMap: function(){ return typeof drawMiniMap !== 'undefined'; },
  hasEdgeIndicators: function(){ return typeof drawEdgeIndicators !== 'undefined'; },
}; })()`, context, { filename: 'hud-layout-bridge.js' });
stub.flushImageLoads();

const world = () => {
  bridge.setCharacter('daxia');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(1_000_000_000);
  bridge.game.spawnTimer = 999;
  return bridge.game;
};

// ---------------------------------------------------------------------------
console.log('\n【1】面板与暂停钮');
{
  const game = world();
  const top = bridge.viewInsets.top + bridge.HUD_TOP_GAP;
  const pause = bridge.pauseButtonBounds();
  check('暂停钮在面板内（58px 高）',
    pause.y >= top && pause.y + pause.height <= top + 58, `y=${pause.y}..${pause.y + pause.height}`);
  check('暂停钮在面板左侧', pause.x <= 28, `x=${pause.x}`);
  check('暂停钮 28×28', pause.width === 28 && pause.height === 28, `${pause.width}×${pause.height}`);
}

// ---------------------------------------------------------------------------
console.log('\n【2】第二行合并波次/击杀/首领');
{
  const game = world();
  game.elapsed = 30;
  game.wave = 3;
  game.waveKills = 7;
  game.waveGoal = 20;
  game.bossSpawned = false;
  const label = bridge.battleWaveLabel();
  check('含波次、击杀、首领倒计时',
    label.includes('波 3') && label.includes('击杀 7/20') && label.includes('首领'), label);
  check('无小数', !label.replace(/Lv\./g, '').includes('.'), label);
}

// ---------------------------------------------------------------------------
console.log('\n【3】小地图已删除，边缘提示存在');
{
  check('drawMiniMap 已删除', bridge.hasMiniMap() === false);
  check('drawEdgeIndicators 存在', bridge.hasEdgeIndicators() === true);
  check('源码不再调用 drawMiniMap', !SOURCE.includes('drawMiniMap()'));
}

// ---------------------------------------------------------------------------
console.log('\n【4】种子从 HUD 移除、暂停界面显示');
{
  check('HUD 不再画种子', !SOURCE.includes("种子 +${fmtInt(game.seedsEarned)}`, width / 2, hudTop"));
  check('暂停界面有种子行', SOURCE.includes('种子 +${fmtInt(game.seedsEarned)} · 第'));
}

// ---------------------------------------------------------------------------
console.log('\n【5】怪物强化 toast：波次变化才出现，2.5s 消失');
{
  const game = world();
  game.elapsed = 0;
  game.wave = 1;
  game.hudToast = null;
  game.elapsed = 31;   // 跨过第 1 波（waveDuration 内）
  bridge.updateGame(0.05);
  check('波次变化触发了 toast', !!game.hudToast, game.hudToast ? game.hudToast.text : 'null');
  if (game.hudToast) check('toast 文案是怪物强化', game.hudToast.text.includes('怪物强化'), game.hudToast.text);
  bridge.updateGame(2.6);
  check('2.5s 后 toast 消失', game.hudToast === null);
}

// ---------------------------------------------------------------------------
console.log('\n【6】绘制：HUD + 边缘提示 + toast 不抛');
{
  const game = world();
  game.plants = [];
  game.hudToast = { text: '怪物强化 速+2', life: 2 };
  bridge.draw();
  check('绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
