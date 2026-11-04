// =============================================================================
// 主菜单改版回归测试：点角色选择 + 图标侧边栏 + 小屏抽屉
//
// 用户 2026-10-23 要求：
//   1) UI 全部上移到 key art 的天空区（下 70% 留给点角色）
//   2) 删掉四张角色卡，改成点背景图里的角色：选中出悬浮光晕，再出机制卡 + 确定/取消
//   3) 四个入口改成图标侧边栏，点一下展开完整名称
//   4) 屏幕放不下的 UI 用抽屉收纳（小屏：高度 < 620 或宽度 < 340）
//
// 运行：node tools/menu-select.test.mjs
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
  const context = vm.createContext(sandbox, { name: 'menu-select-test' });
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  const bridge = vm.runInContext(`(function(){ return {
    get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
    get profile(){ return profile; },
    get menuPick(){ return menuPick; }, set menuPick(v){ menuPick = v; },
    get menuSidebarExpanded(){ return menuSidebarExpanded; },
    get menuDrawerOpen(){ return menuDrawerOpen; },
    setCharacter: function(id){ profile.character = id; },
    enterMenu: enterMenu, draw: draw, startGame: startGame,
    menuLayout: menuLayout, menuHitCircles: menuHitCircles, menuHitScreen: menuHitScreen,
    menuPickAt: menuPickAt, menuConfirmBounds: menuConfirmBounds, menuMechanicCard: menuMechanicCard,
    menuSidebarItemBounds: menuSidebarItemBounds, menuSidebarItems: menuSidebarItems,
    menuSidebarIconRect: menuSidebarIconRect, menuSidebarRowBounds: menuSidebarRowBounds,
    menuPortalCircle: menuPortalCircle, menuPortalScreen: menuPortalScreen, menuPortalHit: menuPortalHit,
    portalFlashAlpha: portalFlashAlpha, portalFlashRadius: portalFlashRadius,
    portalFlashTotal: portalFlashTotal,
    get portalTransitionAt(){ return portalTransitionAt; }, get portalGuideAt(){ return portalGuideAt; },
    portalUIFadeMs: portalUIFadeMs, portalChargeMs: portalChargeMs, portalBurstMs: portalBurstMs,
    portalSwitchMs: portalSwitchMs, portalFlashTotal: portalFlashTotal,
    portalChargeIntensity: portalChargeIntensity, portalBurstProgress: portalBurstProgress,
    setClock: function (v) { Date.now = function () { return v | 0; }; },
    menuCompact: menuCompact, menuDrawerItemBounds: menuDrawerItemBounds, menuDrawerBounds: menuDrawerBounds,
    characterMechanics: characterMechanics,
  }; })()`, context, { filename: 'menu-bridge.js' });
  stub.flushImageLoads();
  return { stub, bridge, context };
};

const tap = (stub, x, y) => stub.touch.start({ identifier: 41, clientX: x, clientY: y });

// ---------------------------------------------------------------------------
console.log('\n【1】热区：四个角色都能点中，重叠区归前排');
{
  const { bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.enterMenu();
  const circles = bridge.menuHitCircles();
  check('热区数量 = 4', circles.length === 4, String(circles.length));
  for (const circle of circles) {
    const box = bridge.menuHitScreen(circle);
    check(`点 ${circle.id} 命中自己`, bridge.menuPickAt(box.x, box.y) === circle.id);
  }
  // 至尊奶与瘦嘟嘟的圈有重叠（蓝棍穿过），重叠处应按优先级归 至尊奶
  const supreme = bridge.menuHitScreen(circles.find((item) => item.id === 'supreme'));
  check('重叠区归至尊奶（优先级 0）', bridge.menuPickAt(supreme.x, supreme.y) === 'supreme');
  check('空白处不命中任何角色', bridge.menuPickAt(10, 10) === null);
}

// ---------------------------------------------------------------------------
console.log('\n【2】默认预选上次出战角色');
{
  const { bridge } = makeWorld();
  bridge.setCharacter('xiaoxian');
  bridge.enterMenu();
  check('进入菜单预选了上次角色', bridge.menuPick && bridge.menuPick.id === 'xiaoxian',
    JSON.stringify(bridge.menuPick));
  check('预选处于「已确认」态（不弹机制卡）', bridge.menuPick.confirmed === true);
}

// ---------------------------------------------------------------------------
console.log('\n【3】点角色 → 出机制卡；确定写入 profile.character；取消回退');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.enterMenu();
  const rabbit = bridge.menuHitScreen(bridge.menuHitCircles().find((item) => item.id === 'rabbit'));
  tap(stub, rabbit.x, rabbit.y);
  check('点瘦嘟嘟 → 选中且未确认', bridge.menuPick.id === 'rabbit' && bridge.menuPick.confirmed === false,
    JSON.stringify(bridge.menuPick));
  check('机制卡有 3 行文案', (bridge.characterMechanics.rabbit || []).length === 3);
  const buttons = bridge.menuConfirmBounds();
  check('确认按钮在机制卡内',
    buttons.confirm.y > bridge.menuMechanicCard().y
    && buttons.confirm.y + buttons.confirm.height <= bridge.menuMechanicCard().y + bridge.menuMechanicCard().height);
  tap(stub, buttons.cancel.x + 10, buttons.cancel.y + 10);
  check('点「再看看」回退到上次角色', bridge.menuPick.id === 'daxia' && bridge.menuPick.confirmed === true,
    JSON.stringify(bridge.menuPick));

  // 再选一次并确定
  tap(stub, rabbit.x, rabbit.y);
  const confirmButtons = bridge.menuConfirmBounds();
  tap(stub, confirmButtons.confirm.x + 10, confirmButtons.confirm.y + 10);
  check('确定后 profile.character 变成瘦嘟嘟', bridge.profile.character === 'rabbit', bridge.profile.character);
  check('确定后处于已确认态（不开打）', bridge.menuPick.confirmed === true && bridge.screen === 'menu',
    `${bridge.screen} / ${bridge.menuPick.confirmed}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】点空白：取消选择，回到上次角色高亮');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('supreme');
  bridge.enterMenu();
  const daxia = bridge.menuHitScreen(bridge.menuHitCircles().find((item) => item.id === 'daxia'));
  tap(stub, daxia.x, daxia.y);
  check('先选中奶大侠', bridge.menuPick.id === 'daxia');
  tap(stub, 8, height0(bridge) - 40);
  check('点空白回退', bridge.menuPick.id === 'supreme' && bridge.menuPick.confirmed === true,
    JSON.stringify(bridge.menuPick));
}

// ---------------------------------------------------------------------------
console.log('\n【5】图标侧边栏：点图标展开名称，再点条目进入对应屏');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.enterMenu();
  const first = bridge.menuSidebarItemBounds(0);
  tap(stub, first.x + first.width / 2, first.y + first.height / 2);
  check('第一次点图标只展开侧边栏', bridge.menuSidebarExpanded === true && bridge.screen === 'menu',
    `${bridge.menuSidebarExpanded} / ${bridge.screen}`);
  tap(stub, first.x + first.width / 2, first.y + first.height / 2);
  check('第二次点进入「装扮」屏', bridge.screen === 'wardrobe', bridge.screen);

  bridge.enterMenu();
  const items = bridge.menuSidebarItems();
  check('侧边栏有 4 个入口', items.length === 4, items.map((item) => item.label).join('/'));
  check('侧边栏在左侧（x 从 0 开始）', bridge.menuSidebarItemBounds(0).x === 0,
    String(bridge.menuSidebarItemBounds(0).x));
  check('图标比上一版小（36 ≤ 44×0.85）', bridge.menuSidebarIconRect(0).width <= 38,
    String(bridge.menuSidebarIconRect(0).width));
  check('展开行向右延伸且不铺满整屏', bridge.menuSidebarRowBounds(0).width < 375 / 2,
    String(bridge.menuSidebarRowBounds(0).width));
}

// ---------------------------------------------------------------------------
console.log('\n【6】小屏（320×568）：UI 收进抽屉');
{
  const { stub, bridge } = makeWorld({ screenWidth: 320, screenHeight: 568, safeArea: { top: 0, left: 0, right: 320, bottom: 568, width: 320, height: 568 } });
  bridge.setCharacter('rabbit');
  bridge.enterMenu();
  check('小屏进入 compact 模式', bridge.menuCompact() === true);
  const drawer = bridge.menuLayout().drawerButton;
  tap(stub, drawer.x + drawer.width / 2, drawer.y + drawer.height / 2);
  check('点 ≡ 打开抽屉', bridge.menuDrawerOpen === true);
  const item = bridge.menuDrawerItemBounds(1);
  tap(stub, item.x + 10, item.y + 10);
  check('点抽屉条目进入对应屏', bridge.screen === 'wardrobe' || bridge.screen === 'garden'
    || bridge.screen === 'enemyCodex' || bridge.screen === 'skillCodex' || bridge.screen === 'stats',
  bridge.screen);
}

// ---------------------------------------------------------------------------
console.log('\n【7】触控尺寸与绘制：三种屏宽都不小于 44px，三态绘制不抛');
{
  for (const [w, h] of [[320, 568], [375, 667], [414, 896]]) {
    const { bridge } = makeWorld({ screenWidth: w, screenHeight: h, safeArea: { top: 0, left: 0, right: w, bottom: h, width: w, height: h } });
    bridge.setCharacter('daxia');
    bridge.enterMenu();
    const sizes = bridge.menuHitCircles().map((circle) => bridge.menuHitScreen(circle).r * 2);
    check(`${w}×${h}：角色热区直径 ≥ 44px`, sizes.every((size) => size >= 44),
      sizes.map((size) => Math.round(size)).join('/'));

    const portal = bridge.menuPortalScreen();
    check(`${w}×${h}：传送门在屏内且直径 ≥ 44px`,
      portal.x > 0 && portal.x < w && portal.r * 2 >= 44,
      `x=${Math.round(portal.x)} d=${Math.round(portal.r * 2)}`);
  }

  const { bridge } = makeWorld();
  bridge.enterMenu();
  bridge.draw();
  check('默认态绘制不抛', true);
  bridge.menuPick = { id: 'supreme', since: 0, confirmed: false };
  bridge.draw();
  check('机制卡态绘制不抛', true);
  bridge.menuPick = { id: 'supreme', since: 0, confirmed: true };
  bridge.draw();
  check('确认态绘制不抛', true);
}

console.log('\n【8】传送门开始：2 秒过场（期间仍在主界面，只留主背景）');
{
  const { stub, bridge } = makeWorld();
  bridge.setCharacter('daxia');
  bridge.enterMenu();
  const portal = bridge.menuPortalScreen();
  const baseClock = 1_000_000_000;   // 用一个能塞进 int32 的假时钟（bridge.setClock 用了 | 0）
  bridge.setClock(baseClock);
  bridge.enterMenu();   // 用固定时钟重进一次，过场起点可预期

  check('传送门中心命中自己', bridge.menuPortalHit(portal.x, portal.y) === true);
  check('传送门圈外不命中', bridge.menuPortalHit(portal.x + portal.r + 10, portal.y) === false);
  check('传送门直径 ≥ 44（三屏宽另测）', portal.r * 2 >= 44, String(Math.round(portal.r * 2)));
  check('首次进菜单亮引导', bridge.portalGuideAt > 0, String(bridge.portalGuideAt));

  // 点传送门：不立刻开打，先进入过场
  tap(stub, portal.x, portal.y);
  check('点传送门后仍在主界面', bridge.screen === 'menu', bridge.screen);
  check('进入 2 秒过场', bridge.portalTransitionAt === baseClock, String(bridge.portalTransitionAt));
  check('引导标记写档并关闭', bridge.profile.portalGuideDone === true && bridge.portalGuideAt === 0);

  // 0.9 秒内仍只画主背景（draw 不切屏）
  bridge.setClock(baseClock + 1000);
  bridge.draw();
  check('1.0 秒时仍在主界面（白光未铺满）', bridge.screen === 'menu', bridge.screen);

  // 白光曲线：蓄力段全透明 → 铺满段渐白 → 全白 → 褪出
  check('过场总时长 2 秒', bridge.portalFlashTotal === 2000, String(bridge.portalFlashTotal));
  check('切战斗时刻 1.5 秒', bridge.portalSwitchMs === 1500, String(bridge.portalSwitchMs));
  check('起点透明', bridge.portalFlashAlpha(0) === 0);
  check('蓄力段不白（0.6 秒）', bridge.portalFlashAlpha(600) === 0, String(bridge.portalFlashAlpha(600)));
  check('蓄力强度到 1（0.9 秒）', bridge.portalChargeIntensity(900) === 1, String(bridge.portalChargeIntensity(900)));
  check('铺满段渐白（1.2 秒）', bridge.portalFlashAlpha(1200) > 0 && bridge.portalFlashAlpha(1200) < 1,
    String(bridge.portalFlashAlpha(1200)));
  check('白屏瞬间全白（1.5 秒）', bridge.portalFlashAlpha(1500) === 1, String(bridge.portalFlashAlpha(1500)));
  check('褪出中（1.9 秒）', bridge.portalFlashAlpha(1900) < 0.4, String(bridge.portalFlashAlpha(1900)));
  check('2 秒后完全透明', bridge.portalFlashAlpha(2000) === 0);
  check('半径铺满屏幕', bridge.portalFlashRadius(1500, portal.r) > 667,
    String(Math.round(bridge.portalFlashRadius(1500, portal.r))));

  // 过场必须自己驱动帧（之前 bug：menu 不跑循环 → 卡在只有背景的那一帧）
  check('过场启动了渲染循环', stub.raf.scheduled > 0 && typeof stub.raf.pending === 'function', String(stub.raf.scheduled));

  // 过场期间输入被吞掉：点空白不应清掉选择
  const beforePick = JSON.stringify(bridge.menuPick);
  tap(stub, 4, 640);
  check('过场中输入被忽略', JSON.stringify(bridge.menuPick) === beforePick && bridge.screen === 'menu',
    JSON.stringify(bridge.menuPick));

  // 用假时钟推一帧真实循环：1.6 秒那一帧应切战斗
  bridge.setClock(baseClock + 1600);
  if (typeof stub.raf.pending === 'function') stub.raf.pending(1600);
  check('推帧后切到战斗', bridge.screen === 'game', bridge.screen);
  check('过场结束后过场标记清掉', bridge.portalTransitionAt === -1, String(bridge.portalTransitionAt));

  // 角色优先：点角色不会触发过场
  const { stub: stub2, bridge: bridge2 } = makeWorld();
  bridge2.setCharacter('supreme');
  bridge2.enterMenu();
  const daxia = bridge2.menuHitScreen(bridge2.menuHitCircles().find((item) => item.id === 'daxia'));
  tap(stub2, daxia.x, daxia.y);
  check('点角色优先于传送门（不会误开打）',
    bridge2.screen === 'menu' && bridge2.menuPick.id === 'daxia' && bridge2.portalTransitionAt === -1,
    bridge2.screen + ' / ' + bridge2.menuPick.id);
}

console.log('\n【9】侧边栏上移到战绩行下方');
{
  const { stub, bridge } = makeWorld();
  bridge.enterMenu();
  const top = bridge.menuSidebarItemBounds(0).y;
  const statsY = 667 * 0.085 + 44;   // 标题 + 副标题 + 战绩
  check('侧边栏起点在战绩行下方', top > statsY, top + ' > ' + statsY);
  check('侧边栏不压到角色区（< 0.32h）', top < 667 * 0.32, String(top));
  check('四个图标仍可点（首个命中）', bridge.menuSidebarItemBounds(0).width >= 40);
}

function height0() { return 667; }

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
