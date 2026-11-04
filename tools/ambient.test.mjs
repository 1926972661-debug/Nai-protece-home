// =============================================================================
// 时段氛围 + 氛围粒子 回归测试
//
// 背景：D8 技术美术方案 v1 的两个落地项
//   ① 时段叠色：一张背景 + 四层色氛围（清晨/正午/黄昏/夜晚），0 新增场景字节
//   ② 氛围粒子：用户提供的花瓣/落叶/萤火/金尘四张贴图，按当前时段每帧少量生成
// 两者都是纯视觉，但会碰「绘制调用预算」「素材双向引用」「裸色值棘轮」三处闸门，所以要有测试。
//
// 运行：node tools/ambient.test.mjs
// =============================================================================
import { readFileSync, statSync } from 'node:fs';
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
const context = vm.createContext(sandbox, { name: 'ambient-test' });
vm.runInContext('(function(){ let s = 7; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get balance(){ return balance; }, get profile(){ return profile; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  timePhaseIndex: timePhaseIndex, timePhase: timePhase, TIME_PHASES: TIME_PHASES,
  spawnAmbient: spawnAmbient, updateAmbient: updateAmbient, drawAmbient: drawAmbient,
  drawTimeTint: drawTimeTint, currentTint: currentTint, lerpRgb: lerpRgb,
}; })()`, context, { filename: 'ambient-bridge.js' });
stub.flushImageLoads();

// ---------------------------------------------------------------------------
console.log('\n【1】时段分界：60 / 120 / 180 秒');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  const at = (seconds) => { game.elapsed = seconds; return bridge.timePhaseIndex(); };
  check('0 秒 = 清晨(0)', at(0) === 0, String(bridge.timePhaseIndex()));
  check('59.9 秒仍是清晨', at(59.9) === 0);
  check('60 秒进入正午(1)', at(60) === 1);
  check('120 秒进入黄昏(2)', at(120) === 2);
  check('180 秒进入夜晚(3)', at(180) === 3);
  check('400 秒仍在夜晚', at(400) === 3);
  check('分界常量就是 balance.timePhaseSeconds',
    JSON.stringify(Array.from(bridge.balance.timePhaseSeconds)) === '[60,120,180]',
    JSON.stringify(Array.from(bridge.balance.timePhaseSeconds)));
}

// ---------------------------------------------------------------------------
console.log('\n【2】每个时段的粒子种类与叠色强度');
{
  const kinds = bridge.TIME_PHASES.map((phase) => phase.particle);
  check('四时段粒子 = 花瓣/金尘/落叶/萤火',
    JSON.stringify(kinds) === JSON.stringify(['petal', 'dust', 'leaf', 'firefly']), kinds.join(','));
  const alphas = bridge.TIME_PHASES.map((phase) => phase.alpha);
  check('叠色强度都 ≤ 0.25（写实背景要克制，见 07-写实背景方案）',
    alphas.every((a) => a > 0 && a <= 0.25), alphas.join(' / '));
  check('夜晚最重、正午最轻', alphas[3] === Math.max(...alphas) && alphas[1] === Math.min(...alphas),
    alphas.join(' / '));
  check('只有清晨/黄昏/夜晚有第二层色',
    bridge.TIME_PHASES.filter((phase) => phase.extra).length === 3);
}

// ---------------------------------------------------------------------------
console.log('\n【3】粒子数量有上限，且会过期回收');
{
  bridge.startGame();
  const game = bridge.game;
  game.elapsed = 200;   // 夜晚，生成速率最低
  for (let i = 0; i < 500; i += 1) bridge.spawnAmbient('petal');
  check('连续生成被 ambientCap 截住', game.ambient.length <= bridge.balance.ambientCap,
    `${game.ambient.length} ≤ ${bridge.balance.ambientCap}`);
  check('上限值合理（≤ 40，绘制预算友好）', bridge.balance.ambientCap <= 40, String(bridge.balance.ambientCap));

  // 清空后用 update 跑 30 秒：粒子应被不断生成与回收，数量不越界
  game.ambient = [];
  game.ambientTimer = 0;
  for (let i = 0; i < 30 * 60; i += 1) bridge.updateAmbient(1 / 60);
  check('跑 30 秒后数量仍在上限内', game.ambient.length <= bridge.balance.ambientCap,
    String(game.ambient.length));
  check('确实生成了粒子（不是空转）', game.ambient.length > 0, String(game.ambient.length));
  const anyOutOfView = game.ambient.some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y));
  check('粒子坐标没有 NaN', !anyOutOfView);
}

// ---------------------------------------------------------------------------
console.log('\n【4】绘制与主循环：时段色、粒子都不抛异常');
{
  bridge.setCharacter('xiaoxian');
  bridge.startGame();
  bridge.game.elapsed = 61;
  for (let i = 0; i < 120; i += 1) bridge.updateGame(1 / 60);
  bridge.draw();
  check('drawGame（含时段叠色 + 粒子）不抛', true);
  bridge.drawTimeTint();
  check('单独画时段叠色不抛', true);
  bridge.drawAmbient();
  check('单独画粒子不抛', true);
}

// ---------------------------------------------------------------------------
console.log('\n【4.5】时段切换是渐变，不是到点突跳');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;
  check('过渡时长 = 5 秒', bridge.balance.timeTransitionSeconds === 5,
    String(bridge.balance.timeTransitionSeconds));
  const at = (seconds) => { game.elapsed = seconds; return bridge.currentTint(); };
  const morning = at(0);
  const noon = at(65);
  check('0 秒就是清晨原色', Math.abs(morning.alpha - bridge.TIME_PHASES[0].alpha) < 1e-9);
  check('65 秒（过渡结束）就是正午原色', Math.abs(noon.alpha - bridge.TIME_PHASES[1].alpha) < 1e-9);
  const mid = at(62.5);
  check('62.5 秒处于两者之间（渐变生效）',
    mid.alpha > Math.min(morning.alpha, noon.alpha) && mid.alpha < Math.max(morning.alpha, noon.alpha),
    mid.alpha.toFixed(3));
  check('颜色也是插值（不是某一端原色）',
    JSON.stringify(mid.tint) !== JSON.stringify(morning.tint) && JSON.stringify(mid.tint) !== JSON.stringify(noon.tint),
    mid.tint.join(','));
  // 整局扫一遍：alpha 必须在相邻时段之间单调过渡，不能出现负数/NaN
  let bad = null;
  for (let t = 0; t <= 240; t += 0.25) {
    const tint = at(t);
    if (!Number.isFinite(tint.alpha) || tint.alpha < 0 || tint.alpha > 0.3) { bad = { t, tint }; break; }
    if (!Array.isArray(tint.tint) || tint.tint.length !== 3) { bad = { t, tint }; break; }
  }
  check('0~240 秒扫描：alpha 与颜色都合法（0 ≤ α ≤ 0.3）', !bad,
    bad ? JSON.stringify({ t: bad.t, alpha: bad.tint.alpha }) : 'ok');
  // 插值函数本身
  check('lerpRgb 端点值正确',
    JSON.stringify(bridge.lerpRgb([0, 0, 0], [100, 200, 50], 0)) === '[0,0,0]'
    && JSON.stringify(bridge.lerpRgb([0, 0, 0], [100, 200, 50], 1)) === '[100,200,50]');
  check('lerpRgb 中点取整', JSON.stringify(bridge.lerpRgb([0, 0, 0], [101, 201, 51], 0.5)) === '[51,101,26]',
    JSON.stringify(bridge.lerpRgb([0, 0, 0], [101, 201, 51], 0.5)));
}

console.log('\n【4.6】叠色按相机位置铺满（修复「没铺满屏幕」）');
{
  bridge.startGame();
  const game = bridge.game;
  game.camera.x = 640;
  game.camera.y = 900;
  // 记录 fillRect 的调用参数
  const calls = [];
  const ctx = stub.context;
  const original = ctx.fillRect;
  ctx.fillRect = function patched(x, y, w, h) { calls.push([x, y, w, h]); return original.apply(this, arguments); };
  bridge.drawTimeTint();
  ctx.fillRect = original;
  check('至少画了一层叠色', calls.length >= 1, String(calls.length));
  const [x, y, w, h] = calls[0];
  check('铺色矩形以相机为基准（不是屏幕 0,0）', x < 0 || y < 0, `x=${x} y=${y}`);
  check('铺色矩形覆盖整个可视区', w >= 375 && h >= 667, `${w}×${h}`);
  check('矩形把屏幕四角都包住',
    x <= 0 && y <= 0 && x + w >= 375 && y + h >= 667, `[${x},${y},${w},${h}]`);
}

console.log('\n【5】素材：四张粒子贴图存在、尺寸与字节合规');
{
  const sizes = { petal: 96, leaf: 128, firefly: 96, dust: 96 };
  for (const [kind, size] of Object.entries(sizes)) {
    const file = join(ROOT, 'assets', `fx-${kind}.png`);
    const bytes = statSync(file).size;
    check(`fx-${kind}.png ≤ 12 KB`, bytes <= 12 * 1024, `${bytes} B`);
    // 用 PNG 头读尺寸（避开再引依赖）
    const header = readFileSync(file).subarray(16, 24);
    const width = header.readUInt32BE(0);
    const height = header.readUInt32BE(4);
    check(`fx-${kind}.png 尺寸 ${size}×${size}`, width === size && height === size, `${width}×${height}`);
  }
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
