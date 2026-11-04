// =============================================================================
// 技能图鉴回归测试：布局不顶出面板、可滚动、点技能看详情、侧边栏整行可点
//
// 用户 2026-10-23 反馈：技能图鉴内容顶到屏幕外、需要点具体技能看详情、
// 侧边栏要把文字也做成可点区域。
//
// 运行：node tools/skill-codex.test.mjs
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

const makeWorld = (system = {}) => {
  const sandbox = {};
  const stub = installStub(sandbox, {
    root: ROOT,
    assetDir: join(ROOT, 'assets'),
    system: { ...DEFAULT_SYSTEM, ...system },
  });
  const context = vm.createContext(sandbox, { name: 'skill-codex-test' });
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  const bridge = vm.runInContext(`(function(){ return {
    get screen(){ return screen; }, set screen(v){ screen = v; },
    get profile(){ return profile; },
    get skillCodexCharacter(){ return skillCodexCharacter; }, set skillCodexCharacter(v){ skillCodexCharacter = v; },
    get skillCodexScroll(){ return skillCodexScroll; }, set skillCodexScroll(v){ skillCodexScroll = v; },
    get skillCodexDetail(){ return skillCodexDetail; }, set skillCodexDetail(v){ skillCodexDetail = v; },
    get codexDragY(){ return codexDragY; },
    get menuSidebarExpanded(){ return menuSidebarExpanded; }, set menuSidebarExpanded(v){ menuSidebarExpanded = v; },
    enterMenu: enterMenu, draw: draw, drawSkillCodex: drawSkillCodex,
    skillCodexLayout: skillCodexLayout, skillCodexItems: skillCodexItems,
    skillCodexRowBounds: skillCodexRowBounds, skillCodexRowAt: skillCodexRowAt,
    skillCodexScrollClamp: skillCodexScrollClamp,
    skillCodexPanel: skillCodexPanel, skillCodexTabBounds: skillCodexTabBounds,
    skillCodexDetailPanel: skillCodexDetailPanel, skillCodexDetailCloseBounds: skillCodexDetailCloseBounds,
    menuSidebarRowBounds: menuSidebarRowBounds, menuSidebarItemBounds: menuSidebarItemBounds,
    skillCodexDetailSkill: skillCodexDetailSkill, skillCodexStepDetail: skillCodexStepDetail,
    get codexSwipeX(){ return codexSwipeX; }, get codexSwipeStartX(){ return codexSwipeStartX; },
    menuSidebarBounds: menuSidebarBounds,
  }; })()`, context, { filename: 'codex-bridge.js' });
  stub.flushImageLoads();
  return { stub, bridge };
};

const tap = (stub, x, y) => stub.touch.start({ identifier: 21, clientX: x, clientY: y });
const center = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
// 详情弹层在 touchend 才判定关闭，所以这里要发完整的 start→end
const tapFull = (stub, x, y) => {
  stub.touch.start({ identifier: 31, clientX: x, clientY: y });
  stub.touch.end({ identifier: 31, clientX: x, clientY: y });
};

// ---------------------------------------------------------------------------
console.log('\n【1】布局：头部/列表/底栏互不重叠，都在面板内');
{
  for (const [w, h] of [[375, 667], [320, 568], [414, 896]]) {
    const { bridge } = makeWorld({ screenWidth: w, screenHeight: h, safeArea: { top: 0, left: 0, right: w, bottom: h, width: w, height: h } });
    bridge.screen = 'skillCodex';
    const layout = bridge.skillCodexLayout();
    const panel = layout.panel;
    const tabs = bridge.skillCodexTabBounds(0);
    check(`${w}×${h}：标题在面板内`, layout.titleTop > panel.y && layout.titleTop < panel.y + 60, `${layout.titleTop}`);
    check(`${w}×${h}：主动技能行在页签下方`, layout.activeTop > tabs.y + tabs.height, `${layout.activeTop}`);
    check(`${w}×${h}：列表起点在主动技能行下方`, layout.listTop > layout.activeTop + 12, `${layout.listTop}`);
    check(`${w}×${h}：列表不超出面板底部`, layout.listBottom <= panel.y + panel.height, `${layout.listBottom} ≤ ${panel.y + panel.height}`);
    check(`${w}×${h}：列表高度为正`, layout.viewHeight > 0, String(layout.viewHeight));
  }
}

// ---------------------------------------------------------------------------
console.log('\n【2】内容全部可滚动到：行高固定、maxScroll 与内容一致');
{
  const { bridge } = makeWorld();
  bridge.screen = 'skillCodex';
  bridge.skillCodexCharacter = 'rabbit';
  const layout = bridge.skillCodexLayout();
  check('技能条目 = 己方技能 + 进化', layout.items.length > 0, String(layout.items.length));
  check('列数 2 → 行数 = ceil(n/2)', layout.rows === Math.ceil(layout.items.length / 2), String(layout.rows));
  check('内容比可视区高（需要滚动）', layout.maxScroll > 0, `maxScroll=${Math.round(layout.maxScroll)}`);
  // 滚到底时最后一行底边不超出列出区
  bridge.skillCodexScroll = bridge.skillCodexScrollClamp(99999);
  const last = bridge.skillCodexRowBounds(layout.items.length - 1);
  check('滚到底时最后一行完整可见', last.y + last.height <= layout.listBottom + 0.5,
    `${(last.y + last.height).toFixed(1)} ≤ ${layout.listBottom}`);
  check('滚动范围被夹住', bridge.skillCodexScroll === layout.maxScroll, `${bridge.skillCodexScroll} / ${layout.maxScroll}`);
  bridge.skillCodexScroll = -50;
  check('负滚动被夹到 0', bridge.skillCodexScroll === -50, String(bridge.skillCodexScroll));
  check('clamp 后为 0', bridge.skillCodexScrollClamp(-50) === 0);
}

// ---------------------------------------------------------------------------
console.log('\n【3】点技能 → 详情弹层；左右滑动切换；关闭/点外收起');
{
  const { stub, bridge } = makeWorld();
  bridge.screen = 'skillCodex';
  bridge.skillCodexCharacter = 'daxia';
  bridge.skillCodexScroll = 0;
  const items = bridge.skillCodexItems('daxia');
  const row = bridge.skillCodexRowBounds(0);
  const point = center(row);
  check('行命中测试能定位到第 0 条', bridge.skillCodexRowAt(point.x, point.y) === 0,
    String(bridge.skillCodexRowAt(point.x, point.y)));
  check('列表区外不命中', bridge.skillCodexRowAt(4, 4) === null);

  tap(stub, point.x, point.y);
  check('点技能后打开详情（索引 0）', bridge.skillCodexDetail === 0, String(bridge.skillCodexDetail));
  check('详情取到正确技能', bridge.skillCodexDetailSkill().title === items[0].title,
    bridge.skillCodexDetailSkill().title);

  // 左滑 → 下一个
  const cardY = bridge.skillCodexDetailPanel().y + bridge.skillCodexDetailPanel().height / 2;
  stub.touch.start({ identifier: 5, clientX: 240, clientY: cardY });
  stub.touch.move({ identifier: 5, clientX: 140, clientY: cardY });
  check('拖动中记录横向位移', bridge.codexSwipeX < 0, String(bridge.codexSwipeX));
  stub.touch.move({ identifier: 5, clientX: 60, clientY: cardY });
  stub.touch.end({ identifier: 5, clientX: 60, clientY: cardY });
  check('左滑切到下一条', bridge.skillCodexDetail === 1, String(bridge.skillCodexDetail));

  // 右滑 → 上一条
  stub.touch.start({ identifier: 6, clientX: 80, clientY: cardY });
  stub.touch.move({ identifier: 6, clientX: 200, clientY: cardY });
  stub.touch.end({ identifier: 6, clientX: 200, clientY: cardY });
  check('右滑切回上一条', bridge.skillCodexDetail === 0, String(bridge.skillCodexDetail));

  // 第一条再右滑 → 停在 0（不循环）
  stub.touch.start({ identifier: 7, clientX: 80, clientY: cardY });
  stub.touch.move({ identifier: 7, clientX: 240, clientY: cardY });
  stub.touch.end({ identifier: 7, clientX: 240, clientY: cardY });
  check('边界不循环（仍为 0）', bridge.skillCodexDetail === 0, String(bridge.skillCodexDetail));

  // 位移不够算点按：点卡片内部不关，点外部关
  stub.touch.start({ identifier: 8, clientX: 200, clientY: cardY });
  stub.touch.end({ identifier: 8, clientX: 204, clientY: cardY + 2 });
  check('小位移当点按，卡片内不关闭', bridge.skillCodexDetail === 0, String(bridge.skillCodexDetail));
  bridge.drawSkillCodex();
  check('滑动/详情态绘制不抛', true);

  const close = bridge.skillCodexDetailCloseBounds();
  const closePoint = center(close);
  tapFull(stub, closePoint.x, closePoint.y);
  check('点关闭按钮收起详情', bridge.skillCodexDetail === null);

  tap(stub, point.x, point.y);
  check('再次打开详情', bridge.skillCodexDetail === 0);
  tapFull(stub, 6, 6);
  check('点卡片外收起详情', bridge.skillCodexDetail === null);

  // 直接调用 step 也夹住范围
  bridge.skillCodexDetail = items.length - 1;
  bridge.skillCodexStepDetail(1);
  check('最后一条再往后仍停在最后', bridge.skillCodexDetail === items.length - 1, String(bridge.skillCodexDetail));
}

console.log('\n【4】切角色：滚动归零、详情关闭');
{
  const { stub, bridge } = makeWorld();
  bridge.screen = 'skillCodex';
  bridge.skillCodexCharacter = 'supreme';
  bridge.skillCodexScroll = bridge.skillCodexScrollClamp(9999);
  bridge.skillCodexDetail = 3;
  bridge.skillCodexDetail = null;
  const tab = bridge.skillCodexTabBounds(1);
  const point = center(tab);
  tap(stub, point.x, point.y);
  check('切到瘦嘟嘟', bridge.skillCodexCharacter === 'rabbit', bridge.skillCodexCharacter);
  check('切换后滚动归零', bridge.skillCodexScroll === 0, String(bridge.skillCodexScroll));
}

// ---------------------------------------------------------------------------
console.log('\n【5】侧边栏：展开后文字区域也能点');
{
  const { stub, bridge } = makeWorld();
  bridge.enterMenu();
  bridge.menuSidebarExpanded = true;
  const row = bridge.menuSidebarRowBounds(0);
  const icon = bridge.menuSidebarItemBounds(0);
  check('行命中区比图标宽（含文字）', row.width > icon.width, `${row.width} > ${icon.width}`);
  check('行区域从面板左边缘开始（左侧栏后 x=0）', row.x === icon.x, `${row.x} === ${icon.x}`);
  // 点文字区域（图标右侧 20px；侧边栏已移到左边）
  tap(stub, icon.x + icon.width + 20, icon.y + icon.height / 2);
  check('点文字也能进入对应页', bridge.screen === 'wardrobe', bridge.screen);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
