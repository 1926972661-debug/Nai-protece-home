// =============================================================================
// 首领击退后的选择弹窗：结算 or 继续挑战
//
// 背景：`balance.endlessMode` 默认开着，原来击杀首领直接进无尽，「我赢了」那一刻不存在。
// 现在首领倒下后先停下弹窗：
//   - 结算：按胜利结算（finishGame(true)）
//   - 继续挑战：进无尽模式继续刷
// 隐藏植物那条分支优先（30% 掉率时仍走原有 victoryPending 流程）。
//
// 运行：node tools/boss-choice.test.mjs
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

const makeWorld = () => {
  const sandbox = {};
  const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
  const context = vm.createContext(sandbox, { name: 'boss-choice-test' });
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  // 隐藏植物那条分支是 30% 随机：固定成 0.9（必不掉）才能稳定测弹窗
  vm.runInContext('Math.random = function(){ return 0.9; };', context);
  const bridge = vm.runInContext(`(function(){ return {
    get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
    get profile(){ return profile; },
    setCharacter: function(id){ profile.character = id; },
    startGame: startGame,
  get loopRunning(){ return loopRunning; }, updateGame: updateGame, draw: draw,
    spawnBoss: spawnBoss, applyAttackDamage: applyAttackDamage,
    bossChoiceBounds: bossChoiceBounds, openBossChoice: openBossChoice,
    finishGame: finishGame,
  }; })()`, context, { filename: 'boss-choice-bridge.js' });
  stub.flushImageLoads();
  return { stub, bridge };
};

const tap = (stub, rect) => stub.touch.start({
  identifier: 51,
  clientX: rect.x + rect.width / 2,
  clientY: rect.y + rect.height / 2,
});

// 打死首领并让主循环处理掉这条击杀
const killBoss = (bridge) => {
  const game = bridge.game;
  game.enemies = [];
  bridge.spawnBoss();
  const boss = game.enemies.find((enemy) => enemy.boss);
  boss.health = 1;
  bridge.applyAttackDamage(boss, 1e9);
  for (let i = 0; i < 120 && bridge.screen === 'game'; i += 1) bridge.updateGame(1 / 60);
  return boss;
};

// ---------------------------------------------------------------------------
console.log('\n【1】击杀首领后停在选择弹窗，不自动结算也不自动进无尽');
{
  const { bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.startGame();
  killBoss(bridge);
  check('屏幕切到 bossChoice', bridge.screen === 'bossChoice', bridge.screen);
  check('还没有结算（resultWon 仍是 false，且屏不是 result）',
    bridge.game.resultWon === false && bridge.screen !== 'result', String(bridge.game.resultWon));
  check('还没进无尽', !bridge.game.endless, String(bridge.game.endless));
  bridge.draw();
  check('弹窗能画出来不抛异常', true);
}

// ---------------------------------------------------------------------------
console.log('\n【2】点「结算」：按胜利结算，进结算屏并写奖励');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('rabbit');
  bridge.startGame();
  killBoss(bridge);
  const coinsBefore = bridge.profile.coins;
  const buttons = bridge.bossChoiceBounds();
  tap(stub, buttons.settle);
  check('进入结算屏', bridge.screen === 'result', bridge.screen);
  check('结算标记为胜利', bridge.game.resultWon === true, String(bridge.game.resultWon));
  check('金币奖励已入账（含通关 +25）', bridge.profile.coins > coinsBefore, `${coinsBefore} → ${bridge.profile.coins}`);
  bridge.draw();
  check('结算屏绘制不抛异常', true);
}

// ---------------------------------------------------------------------------
console.log('\n【3】点「继续挑战」：进无尽模式，屏幕回到战斗');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('xiaoxian');
  bridge.startGame();
  killBoss(bridge);
  const buttons = bridge.bossChoiceBounds();
  tap(stub, buttons.endless);
  check('回到战斗屏', bridge.screen === 'game', bridge.screen);
  check('已进入无尽模式', bridge.game.endless === true, String(bridge.game.endless));
  check('无尽首领计时已排上', bridge.game.nextBossAt > bridge.game.elapsed,
    `${bridge.game.nextBossAt} > ${bridge.game.elapsed}`);
  check('弹窗数据已清空', bridge.game.bossChoice === null, String(bridge.game.bossChoice));
  bridge.updateGame(1 / 60);
  check('继续后主循环能跑', true);
}

// ---------------------------------------------------------------------------
console.log('\n【4】无尽模式里后续首领不再弹窗（不然每几分钟打断一次）');
{
  const { bridge } = makeWorld();
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.game.endless = true;
  bridge.game.enemies = [];
  bridge.spawnBoss();
  const boss = bridge.game.enemies.find((enemy) => enemy.boss);
  boss.health = 1;
  bridge.applyAttackDamage(boss, 1e9);
  for (let i = 0; i < 60; i += 1) bridge.updateGame(1 / 60);
  check('无尽里击杀首领不弹窗', bridge.screen === 'game', bridge.screen);
}

// ---------------------------------------------------------------------------
console.log('\n【5】按钮布局：两个按钮在面板内、不重叠、不出屏');
{
  const { bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.startGame();
  const buttons = bridge.bossChoiceBounds();
  check('两个按钮不重叠', buttons.settle.x + buttons.settle.width <= buttons.endless.x,
    `${buttons.settle.x + buttons.settle.width} ≤ ${buttons.endless.x}`);
  check('都在屏幕内', buttons.settle.x >= 0 && buttons.endless.x + buttons.endless.width <= 375,
    `${buttons.endless.x + buttons.endless.width}`);
  check('都在下半部（手指够得到）', buttons.settle.y > 300, String(buttons.settle.y));
}


console.log('\n【5】首领击退后选「继续作战」：渲染循环必须重启（否则画面卡住）');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.openBossChoice();
  bridge.screen = 'bossChoice';

  let frames = 0;
  const pump = (count) => {
    for (let i = 0; i < count; i += 1) {
      if (typeof stub.raf.pending !== 'function') return;
      frames += 1;
      const callback = stub.raf.pending;
      stub.raf.pending = null;
      callback(frames * 16);
    }
  };
  pump(2);
  check('bossChoice 是静态屏，循环已停', bridge.loopRunning === false, String(bridge.loopRunning));
  tap(stub, bridge.bossChoiceBounds().endless);
  check('选继续作战后回到战斗', bridge.screen === 'game', bridge.screen);
  check('循环已重启', bridge.loopRunning === true, String(bridge.loopRunning));
  pump(2);
  check('继续作战后帧在推进', stub.raf.scheduled > 0);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
