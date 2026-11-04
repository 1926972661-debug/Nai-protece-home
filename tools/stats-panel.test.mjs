// =============================================================================
// 角色面板 + 数字取整 回归测试
//
// 覆盖三件事：
//   ① 数字格式化：界面上的数不带小数点，NaN/undefined 一律显示 0
//   ② 角色面板的数据模型：四个角色都能产出完整属性行，且每行都通过「无小数点」检查
//   ③ 屏幕流转与布局：升级屏 → 角色面板 → 返回；面板与升级卡不重叠；属性行不溢出面板
//
// 做法与 umbrella-swarm.test.mjs 一致：借 D5 的 wx 桩把 game.js 载进 vm。
// 运行：node tools/stats-panel.test.mjs
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
const context = vm.createContext(sandbox, { name: 'stats-panel-test' });
vm.runInContext('(function(){ let s = 7; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });

const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(value){ screen = value; },
  get profile(){ return profile; }, get characters(){ return characters; },
  get viewInsets(){ return viewInsets; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, chooseUpgrades: chooseUpgrades,
  statRows: statRows, equipmentSlots: equipmentSlots, compactStatLine: compactStatLine,
  statsPanel: statsPanel, statsOpenBounds: statsOpenBounds, statsRowBounds: statsRowBounds,
  statsSlotBounds: statsSlotBounds, backButtonBounds: backButtonBounds,
  upgradeCardBounds: upgradeCardBounds, upgradeConfirmBounds: upgradeConfirmBounds,
  get statsReturnScreen(){ return statsReturnScreen; },
  fmtInt: fmtInt, fmtCeil: fmtCeil, fmtPercent: fmtPercent,
  levelUpBlast: levelUpBlast,
  get loopRunning(){ return loopRunning; },
  get gameLoop(){ return gameLoop; },
  resumeLoop: resumeLoop,
}; })()`, context, { filename: 'stats-bridge.js' });
stub.flushImageLoads();

// 判定「界面上没有小数」的唯一标准：字符串里不出现小数点，也不出现 NaN/undefined/Infinity。
// 允许的形态：纯整数、整数百分比、整数分数（12/30）、×2、每秒50%、已成型、不衰减、生效。
// `Lv.1` 里的点是等级标记的一部分，不是小数点，先摘掉再判。
function looksClean(text) {
  const value = String(text).replace(/Lv\./g, 'Lv');
  if (value.includes('.')) return false;
  return !/NaN|undefined|Infinity|null/.test(value);
}
const tap = (rect) => stub.touch.start({
  identifier: 11,
  clientX: rect.x + rect.width / 2,
  clientY: rect.y + rect.height / 2,
});

// ---------------------------------------------------------------------------
console.log('\n【1】数字格式化：不带小数点、异常值兜底');
{
  const { fmtInt, fmtCeil, fmtPercent } = bridge;
  check('fmtInt(1.6) = "2"', fmtInt(1.6) === '2', fmtInt(1.6));
  check('fmtInt(-0.4) = "0"（不出 -0）', fmtInt(-0.4) === '0', fmtInt(-0.4));
  check('fmtInt(12.5) = "13"', fmtInt(12.5) === '13', fmtInt(12.5));
  check('fmtCeil(0.2) = "1"（倒计时不会显示 0）', fmtCeil(0.2) === '1', fmtCeil(0.2));
  check('fmtCeil(2.01) = "3"', fmtCeil(2.01) === '3', fmtCeil(2.01));
  check('fmtPercent(0.155) = "16%"', fmtPercent(0.155) === '16%', fmtPercent(0.155));
  check('fmtInt(NaN) = "0"', fmtInt(NaN) === '0', fmtInt(NaN));
  check('fmtInt(undefined) = "0"', fmtInt(undefined) === '0', fmtInt(undefined));
  check('fmtPercent(Infinity) = "0%"', fmtPercent(Infinity) === '0%', fmtPercent(Infinity));
}

// ---------------------------------------------------------------------------
console.log('\n【2】四个角色的属性表：行数够、每行都干净');
{
  const rowsPerCharacter = {};
  for (const character of bridge.characters) {
    bridge.setCharacter(character.id);
    bridge.startGame();
    // 造一点小数态：伤害/移速在真实对局里本来就是浮点
    bridge.game.health = bridge.game.maxHealth * 0.5123;
    bridge.game.baseAttack = 11.37;
    bridge.game.moveSpeed = 133.62;
    bridge.game.critChance = 0.155;
    bridge.game.swordJiScale = 1.6;
    bridge.game.umbrellaSpinRatio = 0.5;
    bridge.game.rabbitFeedBonus = 0.235;
    const rows = bridge.statRows();
    rowsPerCharacter[character.id] = rows.length;
    const dirty = rows.filter((row) => !looksClean(row.label) || !looksClean(row.value));
    check(`${character.name}：${rows.length} 行属性，全部无小数点`, dirty.length === 0,
      dirty.length ? dirty.map((r) => `${r.label}=${r.value}`).join(' / ') : '');
    check(`${character.name}：行数在 18~22 之间（两列 9~11 行放得下）`,
      rows.length >= 18 && rows.length <= 22, String(rows.length));
    const dup = rows.map((r) => r.label).filter((label, i, all) => all.indexOf(label) !== i);
    check(`${character.name}：属性名不重复`, dup.length === 0, dup.join(','));
    const hudLine = bridge.compactStatLine();
    check(`${character.name}：HUD 数值行无小数点且不超长`, looksClean(hudLine) && hudLine.length <= 14, `"${hudLine}" ${hudLine.length}字`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n【3】HUD 数值行 vs 生命条：可用宽度 141.8px，按 14px 粗体估算字宽');
{
  // 字宽用保守估计：中文 14px、ASCII 约 7px。只要估算值 ≤ 141.8 就不会压到血条。
  const estimate = (text) => Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 14 : 7), 0);
  const available = 141.8;
  for (const character of bridge.characters) {
    bridge.setCharacter(character.id);
    bridge.startGame();
    bridge.game.level = 12;
    bridge.game.swordWaveCount = 12;
    bridge.game.projectileCount = 12;
    const line = bridge.compactStatLine();
    const width = estimate(line);
    check(`${character.name} 最宽形态估算 ${width.toFixed(0)}px ≤ 141.8px`, width <= available, `"${line}"`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n【4】技能格：只记"真吃到的"，重复的合并成等级');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  check('开局技能格为空', bridge.equipmentSlots().length === 0);
  bridge.game.upgradeLog.push({ title: '月牙刀光', rarity: 'blue', evolution: false });
  bridge.game.upgradeLog.push({ title: '月牙刀光', rarity: 'blue', evolution: false });
  bridge.game.upgradeLog.push({ title: '三刀流', rarity: 'gold', evolution: false });
  bridge.game.upgradeLog.push({ title: '武器进化：三途刀', rarity: 'gold', evolution: true });
  const slots = bridge.equipmentSlots();
  check('4 条记录合并成 3 个格子', slots.length === 3, String(slots.length));
  check('同名技能合并为 Lv.2', slots[0].level === 2, `Lv.${slots[0].level}`);
  check('进化标记保留', slots[2].evolution === true);
  check('格子数不超过 8（界面上只有 8 个位置）', slots.length <= 8);
}

// ---------------------------------------------------------------------------
console.log('\n【5】屏幕流转：升级屏 → 角色面板 → 返回升级屏');
{
  bridge.setCharacter('rabbit');
  bridge.startGame();
  bridge.screen = 'upgrade';
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
  check('升级屏有 1~4 张卡', bridge.game.upgradeChoices.length >= 1 && bridge.game.upgradeChoices.length <= 4, String(bridge.game.upgradeChoices.length));

  const entry = bridge.statsOpenBounds();
  const firstCard = bridge.upgradeCardBounds(0);
  check('角色面板按钮不压第一张升级卡', entry.y + entry.height < firstCard.y, `按钮底 ${entry.y + entry.height} < 卡顶 ${firstCard.y}`);
  check('角色面板按钮在左上角', entry.x <= 16 && entry.y <= bridge.viewInsets.top + 16,
    `x=${entry.x} y=${entry.y}`);
  check('按钮不压标题（标题居中）', entry.x + entry.width < 375 / 2, String(entry.x + entry.width));

  tap(entry);
  check('点「角色面板」→ screen=stats', bridge.screen === 'stats', bridge.screen);
  const panel = bridge.statsPanel();
  check('面板让出安全区（上下各 10px）',
    panel.y === bridge.viewInsets.top + 10
    && panel.y + panel.height === 667 - bridge.viewInsets.bottom - 10,
    `y=${panel.y} h=${panel.height}`);

  // 属性行不能溢出面板：最后一行的底边必须在底部进度条之上
  const rows = bridge.statRows();
  const lastRect = bridge.statsRowBounds(rows.length - 1, rows.length);
  check('属性表最后一行不压底部进度条', lastRect.y + lastRect.height <= panel.y + panel.height - 96,
    `行底 ${lastRect.y + lastRect.height} ≤ ${panel.y + panel.height - 96}`);

  // 技能格 8 个位置都在属性标题上方
  const lastSlot = bridge.statsSlotBounds(7);
  const firstRow = bridge.statsRowBounds(0, rows.length);
  check('技能格在属性表上方', lastSlot.y + lastSlot.height < firstRow.y,
    `格底 ${lastSlot.y + lastSlot.height} < 属性顶 ${firstRow.y}`);

  bridge.draw(); // 真画一遍，确保 drawStats 不抛
  check('drawStats 能画完不抛异常', true);

  tap(bridge.backButtonBounds(panel));
  check('点「返回」→ 回到升级屏', bridge.screen === 'upgrade', bridge.screen);
}

// ---------------------------------------------------------------------------
console.log('\n【6】从暂停屏也能进面板，返回时回暂停屏');
{
  bridge.startGame();
  bridge.screen = 'paused';
  const pauseMenu = vm.runInContext('pauseMenuBounds()', context);
  tap(pauseMenu.stats);
  check('暂停屏点「角色面板」→ screen=stats', bridge.screen === 'stats', bridge.screen);
  check('记住来路 = paused', bridge.statsReturnScreen === 'paused', bridge.statsReturnScreen);
  tap(bridge.backButtonBounds(bridge.statsPanel()));
  check('返回 → 回暂停屏', bridge.screen === 'paused', bridge.screen);
}

// ---------------------------------------------------------------------------
console.log('\n【7】升级确认才记账 + 发光贴图路径不崩');
{
  bridge.startGame();
  bridge.screen = 'upgrade';
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
  const upgrade = bridge.game.upgradeChoices[0];
  bridge.game.pendingUpgrade = upgrade;
  bridge.screen = 'upgradeConfirm';
  const before = bridge.game.upgradeLog.length;
  tap(bridge.upgradeConfirmBounds().confirm);
  check('确认后 upgradeLog +1', bridge.game.upgradeLog.length === before + 1,
    `${before} → ${bridge.game.upgradeLog.length}`);
  check('记的是这张卡', bridge.game.upgradeLog[bridge.game.upgradeLog.length - 1].title === upgrade.title,
    upgrade.title);

  bridge.game.shockwaves.length = 0;
  bridge.levelUpBlast();
  check('levelUpBlast 生成冲击波（供发光贴图使用）', bridge.game.shockwaves.length === 1);
  bridge.draw();
  check('带发光的绘制路径不抛异常', true);
}


console.log('\n【6】从角色面板返回后再选技能：渲染循环必须重启（否则画面卡住）');
{
  bridge.setCharacter('daxia');
  bridge.startGame();
  bridge.screen = 'upgrade';
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
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
  check('战斗中循环在跑', bridge.loopRunning === true);

  // 打开角色面板 → 静态屏，循环自己停
  tap(bridge.statsOpenBounds());
  check('进入角色面板', bridge.screen === 'stats', bridge.screen);
  pump(2);
  check('静态屏上循环已停（省电）', bridge.loopRunning === false, String(bridge.loopRunning));

  // 返回升级屏（这一步以前不重启循环 → 后面选技能就卡死）
  tap({ x: 0, y: 0, width: 1, height: 1 });   // 无害点击，确保在 stats 分支
  const back = bridge.backButtonBounds(bridge.statsPanel());
  tap(back);
  check('回到升级屏', bridge.screen === 'upgrade', bridge.screen);
  check('回升级屏后循环重启', bridge.loopRunning === true, String(bridge.loopRunning));

  // 选卡 → 确认 → 回战斗，仍然在跑
  tap(bridge.upgradeCardBounds(0));
  check('进入确认页', bridge.screen === 'upgradeConfirm', bridge.screen);
  tap(bridge.upgradeConfirmBounds().confirm);
  check('确认后回到战斗', bridge.screen === 'game', bridge.screen);
  check('回战斗后循环仍在跑', bridge.loopRunning === true, String(bridge.loopRunning));
  pump(2);
  check('循环真的在推进帧', stub.raf.scheduled > 0);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
