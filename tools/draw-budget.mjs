// 绘制调用预算：无头量每帧往 Canvas 上打了多少次调用，并卡上限。
//
// 为什么需要它：真机帧率谁都看不到（用户也看不到），但「每帧多少次绘制调用」在无头环境
// 是确定的、可复现的。它不能替代帧率，但能拦住「某次改动让每帧调用从 800 涨到 3000」这种
// 量级事故 —— 这类事故在真机上就是掉帧，在无头里只是一个数字。
//
// 口径：调用**次数**，不是耗时。drawImage/fill/stroke/fillText 各算 1 次，路径构建
// （moveTo/lineTo/arc…）也算 1 次。所以它只跟「画了多少东西」线性相关，跟机型无关。
//
// 运行：node tools/draw-budget.mjs [--seconds 180] [--character daxia] [--json]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installStub, DEFAULT_SYSTEM } from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const SECONDS = Number(arg('seconds', '180'));
const CHARACTER = arg('character', 'daxia');
const AS_JSON = process.argv.includes('--json');

// 预算（实测后定的，见本文件末尾的「实测记录」注释）：
const MAX_OPS_PER_FRAME = 2900;   // 单帧硬上限（最挤的那一帧）
const P95_OPS_PER_FRAME = 2200;   // 95 分位上限（稳定态）

const SOURCE = readFileSync(join(ROOT, 'game.js'), 'utf8');
const sandbox = {};
const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
const context = vm.createContext(sandbox, { name: 'draw-budget' });
vm.runInContext('(function(){ let s = 11; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  spawnSurge: spawnSurge, perfEntityCount: perfEntityCount,
}; })()`, context, { filename: 'draw-budget-bridge.js' });
stub.flushImageLoads();

if (!bridge.profile.enemySeen) bridge.profile.enemySeen = [];
bridge.setCharacter(CHARACTER);
bridge.startGame();

// 逐方法计数：game.js 的 context 就是这个 stub 的 context 对象，包装属性即可，
// 不需要改 game.js。这样「是谁涨的」能直接看出来。
const perName = {};
const COUNTED = ['drawImage', 'fillText', 'strokeText', 'fillRect', 'fill', 'stroke', 'arc', 'ellipse',
  'rect', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'save', 'restore', 'clip', 'setTransform', 'measureText'];
for (const name of COUNTED) {
  const target = stub.context;
  if (!target || typeof target[name] !== 'function') continue;
  const original = target[name];
  target[name] = function counted() { perName[name] = (perName[name] || 0) + 1; return original.apply(target, arguments); };
}

const dt = 1 / 60;
const totalFrames = Math.round(SECONDS * 60);
const opsPerFrame = [];
const entitiesPerFrame = [];
let previousTotal = stub.counts.contextOps;

for (let frame = 0; frame < totalFrames; frame += 1) {
  // 不死身：让场面真的挤起来，否则测到的是「玩家被围死后空场」的假数据。
  bridge.game.health = bridge.game.maxHealth;
  bridge.game.invulnTimer = 1;
  // 前 20 秒补一点怪，保证 180 秒内会走到容量上限附近
  if (frame > 0 && frame % 600 === 0 && frame < 1200) bridge.spawnSurge(30);
  bridge.updateGame(dt);
  const before = stub.counts.contextOps;
  bridge.draw();
  const after = stub.counts.contextOps;
  opsPerFrame.push(after - before);
  entitiesPerFrame.push(bridge.perfEntityCount());
  previousTotal = after;
}

const sorted = [...opsPerFrame].sort((a, b) => a - b);
const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const average = Math.round(opsPerFrame.reduce((sum, v) => sum + v, 0) / opsPerFrame.length);
const max = sorted[sorted.length - 1];
const maxIndex = opsPerFrame.indexOf(max);
const p95 = pick(0.95);
const p50 = pick(0.5);
const maxEntities = Math.max.apply(null, entitiesPerFrame);

// 顶部调用构成（帮定位「是谁涨的」）
const byName = Object.entries(perName)
  .sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([name, count]) => ({ name, count }));

const failures = [];
if (max > MAX_OPS_PER_FRAME) failures.push(`单帧峰值 ${max} > ${MAX_OPS_PER_FRAME}`);
if (p95 > P95_OPS_PER_FRAME) failures.push(`p95 ${p95} > ${P95_OPS_PER_FRAME}`);

const result = {
  character: CHARACTER,
  seconds: SECONDS,
  frames: totalFrames,
  ops: { average, p50, p95, max, maxFrame: maxIndex + 1 },
  entities: { max: maxEntities, atMaxOpsFrame: entitiesPerFrame[maxIndex] },
  budget: { max: MAX_OPS_PER_FRAME, p95: P95_OPS_PER_FRAME },
  failures,
  topOps: byName,
};

if (AS_JSON) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`绘制调用预算 · ${CHARACTER} · ${SECONDS}s / ${totalFrames} 帧（无头，Canvas 是计数器不是 GPU）`);
  console.log(`  每帧调用  平均 ${average} ｜ p50 ${p50} ｜ p95 ${p95} ｜ 峰值 ${max}（第 ${maxIndex + 1} 帧，实体 ${entitiesPerFrame[maxIndex]}）`);
  console.log(`  实体峰值  ${maxEntities}`);
  console.log(`  预算      单帧 ≤ ${MAX_OPS_PER_FRAME} ｜ p95 ≤ ${P95_OPS_PER_FRAME} → ${failures.length ? 'FAIL' : 'PASS'}`);
  if (failures.length) failures.forEach((line) => console.log(`    ! ${line}`));
  console.log('  调用构成  ' + byName.map((item) => `${item.name} ${item.count}`).join(' ｜ '));
}
process.exit(failures.length ? 1 : 0);

// 实测记录（改预算时必须更新这里）：
//   2026-10-21 daxia 180s：平均 1200 ｜ p50 1135 ｜ p95 1992 ｜ 峰值 2588（实体峰值 230）。
//   预算 = 实测 p95 × 1.10 = 2200，实测峰值 × 1.12 = 2900。再往上就说明某次改动
//   让每帧多画了几百次东西（真机上就是掉帧），这时应该先查是谁涨的（脚本会打印调用构成）。
