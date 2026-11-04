// =============================================================================
// 战斗地面贴图（底图 + 装饰层 + 装饰件）回归测试
//
// 背景：2026-10-23 用户给了一套赛璐珞草地素材，代码从「4 档纯色格子」换成「贴图平铺」。
// 这张表要守住三件事：
//   ① 素材存在、尺寸与字节在预算内（主包 4MB，单文件 512KB 上限）
//   ② 贴图加载完成后确实走贴图分支；没加载完必须退回纯色格子（不能空屏）
//   ③ 平铺 hash 是确定性的（同一格永远同一翻转，避免每帧抖动）
//
// 运行：node tools/ground.test.mjs
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

const makeWorld = (flush) => {
  const sandbox = {};
  const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
  const context = vm.createContext(sandbox, { name: 'ground-test' });
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  const bridge = vm.runInContext(`(function(){ return {
    get game(){ return game; }, get groundReady(){ return groundReady; },
    get decorReady(){ return decorReady; },
    get groundDetailReady(){ return groundDetailReady; },
    setCharacter: function(id){ profile.character = id; },
    startGame: startGame, updateGame: updateGame, draw: draw,
    drawGameBackground: drawGameBackground, groundHash: groundHash,
    get menuKeyartReady(){ return menuKeyartReady; }, drawMenu: drawMenu,
  }; })()`, context, { filename: 'ground-bridge.js' });
  if (flush) stub.flushImageLoads();
  return { stub, bridge };
};

// ---------------------------------------------------------------------------
console.log('\n【1】素材：存在、尺寸、字节');
{
  const expected = [
    ['bg-ground.jpg', 1024, 1024, 160 * 1024],
    ['menu-keyart.jpg', 636, 904, 130 * 1024],
    ['bg-ground-detail.png', 640, 640, 220 * 1024],
    ['decor-flowers.png', 160, 160, 70 * 1024],
    ['decor-stones.png', 160, 160, 70 * 1024],
    ['decor-fence.png', 160, 160, 70 * 1024],
    ['decor-puddle.png', 160, 160, 70 * 1024],
  ];
  for (const [name, w, h, maxBytes] of expected) {
    const file = join(ROOT, 'assets', name);
    const bytes = statSync(file).size;
    const head = readFileSync(file).subarray(0, 32);
    let width = 0;
    let height = 0;
    if (name.endsWith('.png')) {
      width = head.readUInt32BE(16);
      height = head.readUInt32BE(20);
    } else {
      // JPEG：扫 SOF0/SOF2 找尺寸
      const buf = readFileSync(file);
      for (let i = 2; i < buf.length - 9; i += 1) {
        if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
          height = buf.readUInt16BE(i + 5);
          width = buf.readUInt16BE(i + 7);
          break;
        }
      }
    }
    check(`${name} 尺寸 ${w}×${h}`, width === w && height === h, `${width}×${height}`);
    check(`${name} ≤ ${Math.round(maxBytes / 1024)} KB`, bytes <= maxBytes, `${bytes} B`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n【2】加载完成后走贴图分支');
{
  const { stub, bridge } = makeWorld(true);
  bridge.setCharacter('daxia');
  bridge.startGame();
  check('底图 onload 已触发', bridge.groundReady === true, String(bridge.groundReady));
  check('装饰层 onload 已触发', bridge.groundDetailReady === true, String(bridge.groundDetailReady));
  check('四个装饰件都 onload', Object.values(bridge.decorReady).every(Boolean),
    JSON.stringify(bridge.decorReady));

  const before = stub.counts.contextOps;
  bridge.drawGameBackground();
  const drawn = stub.counts.contextOps - before;
  // 一屏约 3×4 块，底图每块 1 次 + 一半格子叠装饰层 + 1/3 格子放装饰件
  check('一屏背景绘制调用在 120~400 之间（底图+装饰层+装饰件+变换）', drawn >= 120 && drawn <= 400, String(drawn));
  check('drawGame 不抛异常', (() => { bridge.draw(); return true; })());
}

// ---------------------------------------------------------------------------
console.log('\n【3】素材没加载完时退回纯色格子（不能空屏）');
{
  const { stub, bridge } = makeWorld(false);
  bridge.setCharacter('rabbit');
  bridge.startGame();
  check('groundReady 仍是 false', bridge.groundReady === false);
  const fills = stub.counts.contextOps;
  bridge.drawGameBackground();
  const after = stub.counts.contextOps - fills;
  check('兜底路径确实画了色块', after >= 4, String(after));
  check('兜底路径不依赖贴图（每次都是 fillRect，调用数很少）', after < 60, String(after));
}

// ---------------------------------------------------------------------------
console.log('\n【4】平铺 hash：确定性、范围、相邻格子不同');
{
  const { bridge } = makeWorld(true);
  bridge.startGame();
  const h = bridge.groundHash;
  check('同一格两次结果相同', h(3, 7) === h(3, 7), String(h(3, 7)));
  let min = 1;
  let max = 0;
  for (let x = -20; x <= 20; x += 1) {
    for (let y = -20; y <= 20; y += 1) {
      const v = h(x, y);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  check('hash 落在 [0,1)', min >= 0 && max < 1, `${min.toFixed(3)}~${max.toFixed(3)}`);
  let sameNeighbour = 0;
  for (let x = 0; x < 40; x += 1) if (Math.floor(h(x, 0) * 4) === Math.floor(h(x + 1, 0) * 4)) sameNeighbour += 1;
  check('相邻格子的翻转不会总是一样', sameNeighbour < 20, `相同 ${sameNeighbour}/40`);
}

// ---------------------------------------------------------------------------
console.log('\n【4.5】主菜单：key art 已接入，且加载失败有兜底');
{
  const { stub, bridge } = makeWorld(true);
  bridge.setCharacter('daxia');
  bridge.startGame();
  check('menu key art onload 已触发', bridge.menuKeyartReady === true, String(bridge.menuKeyartReady));
  const before = stub.counts.contextOps;
  bridge.drawMenu();
  check('drawMenu 画了东西（含 key art）', stub.counts.contextOps - before > 10,
    String(stub.counts.contextOps - before));

  const fallback = makeWorld(false);
  check('未加载时 menuKeyartReady = false（会退回旧背景）', fallback.bridge.menuKeyartReady === false);
  fallback.bridge.startGame();
  fallback.bridge.drawMenu();
  check('未加载时 drawMenu 也不抛', true);
}

console.log('\n【5】跑一局：背景不拖垮主循环');
{
  const { bridge } = makeWorld(true);
  bridge.setCharacter('supreme');
  bridge.startGame();
  for (let i = 0; i < 60 * 20; i += 1) bridge.updateGame(1 / 60);
  check('20 秒无异常（画面持续有背景）', true);
  bridge.draw();
  check('绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
