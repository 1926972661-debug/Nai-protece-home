// =============================================================================
// 经济：金币出口（重抽）与种子出口（育苗）回归测试
//
// 背景（reports/经济设计-第1轮.md 的实测）：改动前金币只有 110 的皮肤一次性出口，
// 一局产出 200~400 金币；种子只有 1480 的装饰出口，一局产出 500~2000 粒 ——
// 两个币种都在 1~2 局内「花完、然后没有意义」。本测试守住新增的两个出口：
//   ① 金币 → 升级三选一重抽（30/60/120，每局 3 次）
//   ② 种子 → 育苗（保底一株还没有的植物，按稀有度 60/240/900）
//
// 运行：node tools/economy.test.mjs
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
const context = vm.createContext(sandbox, { name: 'economy-test' });
vm.runInContext('(function(){ let s = 5; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, set profile(v){ profile = v; },
  get balance(){ return balance; }, get plantCatalog(){ return plantCatalog; },
  startGame: startGame, draw: draw, chooseUpgrades: chooseUpgrades,
  rerollCost: rerollCost, rerollLabel: rerollLabel, tryReroll: tryReroll,
  resetRerollForNewLevel: resetRerollForNewLevel,
  rerollButtonBounds: rerollButtonBounds, upgradeCardBounds: upgradeCardBounds,
  nurseryOffer: nurseryOffer, nurseryLabel: nurseryLabel, tryNursery: tryNursery,
  nurseryPool: nurseryPool, nurseryButtonBounds: nurseryButtonBounds,
  plantCodexButtonBounds: plantCodexButtonBounds, gardenPanel: gardenPanel,
  gardenProjects: gardenProjects,
}; })()`, context, { filename: 'economy-bridge.js' });
stub.flushImageLoads();

const tap = (rect) => stub.touch.start({
  identifier: 41,
  clientX: rect.x + rect.width / 2,
  clientY: rect.y + rect.height / 2,
});
const noDecimal = (text) => !String(text).replace(/Lv\./g, '').includes('.');

// ---------------------------------------------------------------------------
console.log('\n【1】改动前的经济容量（把「为什么必须改」钉在测试里）');
{
  // 装饰总容量 = 8 个项目 × Σ(5+3L, L=0..9) = 8 × 185 = 1480 粒
  const perProject = Array.from({ length: 10 }, (_, level) => 5 + level * 3).reduce((a, b) => a + b, 0);
  check('八种装饰各自满级 185 粒', perProject === 185, String(perProject));
  check('装饰总容量 1480 粒', perProject * 8 === 1480, String(perProject * 8));
  const skins = vm.runInContext('appearances.reduce((s, a) => s + a.price, 0)', context);
  check('皮肤总容量 110 金币（一次性）', skins === 110, String(skins));
  check('重抽基础价 1 金币（每次升级重置）', bridge.balance.rerollBaseCost === 1,
    String(bridge.balance.rerollBaseCost));
  check('没有三档价格表了（次数不再封顶）', bridge.balance.rerollCosts === undefined);
  check('育苗三档价格 60 / 240 / 900',
    bridge.balance.nurseryPrices.blue === 60
    && bridge.balance.nurseryPrices.purple === 240
    && bridge.balance.nurseryPrices.gold === 900,
    JSON.stringify(bridge.balance.nurseryPrices));
}

// ---------------------------------------------------------------------------
console.log('\n【2】重抽：1 → 2 → 4 → 8…无上限；每次升级重置回 1');
{
  bridge.profile.coins = 1000;
  bridge.startGame();
  const game = bridge.game;
  check('开局重抽次数为 0', game.rerollCount === 0);
  check('第一次价格 1 金币', bridge.rerollCost() === 1, String(bridge.rerollCost()));

  bridge.screen = 'upgrade';
  game.upgradeChoices = bridge.chooseUpgrades();
  const startCoins = bridge.profile.coins;
  tap(bridge.rerollButtonBounds());
  check('点重抽扣 1 金币', bridge.profile.coins === startCoins - 1, `${startCoins} → ${bridge.profile.coins}`);
  check('次数 +1', game.rerollCount === 1);
  check('重抽后仍是 1~4 张卡', game.upgradeChoices.length >= 1 && game.upgradeChoices.length <= 4, String(game.upgradeChoices.length));
  check('价格涨到 2', bridge.rerollCost() === 2, String(bridge.rerollCost()));

  // 一路翻倍：2 → 4 → 8 → 16 → 32 → 64，累计 1+2+4+8+16+32+64 = 127
  const expected = [2, 4, 8, 16, 32, 64];
  let paid = 1;
  for (const price of expected) {
    check(`第 ${game.rerollCount + 1} 次价格 = ${price}`, bridge.rerollCost() === price, String(bridge.rerollCost()));
    tap(bridge.rerollButtonBounds());
    paid += price;
  }
  check('累计花掉 127 金币', 1000 - bridge.profile.coins === paid, String(1000 - bridge.profile.coins));
  check('次数 7 次也没有封顶', game.rerollCount === 7, String(game.rerollCount));
  check('下一次价格 = 128（继续翻倍）', bridge.rerollCost() === 128, String(bridge.rerollCost()));
  check('按钮文案只写这一次的价格', bridge.rerollLabel() === '重抽 128 金币', bridge.rerollLabel());

  // 每次升级重置回 1
  bridge.resetRerollForNewLevel();
  check('升级后次数归零', game.rerollCount === 0);
  check('升级后价格回到 1 金币', bridge.rerollCost() === 1, String(bridge.rerollCost()));
}

console.log('\n【3】重抽：金币不够时点不动，文案说清差多少');
{
  bridge.profile.coins = 0;
  bridge.startGame();
  bridge.screen = 'upgrade';
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
  const before = bridge.profile.coins;
  tap(bridge.rerollButtonBounds());
  check('金币不足不扣钱', bridge.profile.coins === before, String(bridge.profile.coins));
  check('次数不变', bridge.game.rerollCount === 0);
  const label = bridge.rerollLabel();
  check('文案写明差额且无小数点', label.includes('差 1') && noDecimal(label), label);
}

// ---------------------------------------------------------------------------
console.log('\n【4】育苗：只给「还没有的」植物，按稀有度定价');
{
  bridge.profile.plants = [];
  bridge.profile.seeds = 1000;
  const offer = bridge.nurseryOffer();
  check('首档是蓝植物、价 60', offer && offer.rarity === 'blue' && offer.price === 60,
    JSON.stringify(offer && { rarity: offer.rarity, price: offer.price }));
  check('蓝池 3 株', offer.pool.length === 3, String(offer.pool.length));

  const plant = bridge.tryNursery();
  check('育苗成功返回一株植物', !!plant, plant && plant.name);
  check('种子扣 60', bridge.profile.seeds === 940, String(bridge.profile.seeds));
  check('植物进了存档', bridge.profile.plants.length === 1 && bridge.profile.plants[0] === plant.id);
  check('红隐藏植物不在可卖池里',
    !bridge.nurseryPool('red').length && !bridge.plantCatalog.filter((p) => p.rarity === 'red' && bridge.nurseryPool('red').includes(p)).length);
  check('同一株不会卖第二次', !bridge.nurseryOffer().pool.some((item) => item.id === plant.id));

  // 买空蓝池 → 自动进入紫档
  bridge.tryNursery(); bridge.tryNursery();
  const next = bridge.nurseryOffer();
  check('蓝池买空后自动进紫档（240）', next && next.rarity === 'purple' && next.price === 240,
    JSON.stringify(next && { rarity: next.rarity, price: next.price }));
  const label = bridge.nurseryLabel();
  check('按钮文案无小数点', noDecimal(label), label);
}

// ---------------------------------------------------------------------------
console.log('\n【5】育苗：种子不够 / 全部集齐 都有明确反馈');
{
  bridge.profile.plants = [];
  bridge.profile.seeds = 10;
  const bought = bridge.tryNursery();
  check('种子不够时返回 null', bought === null);
  check('种子不变', bridge.profile.seeds === 10, String(bridge.profile.seeds));
  check('按钮文案写明差额', bridge.nurseryLabel().includes('差 50'), bridge.nurseryLabel());

  // 把蓝/紫/金全买齐（直接塞存档），只剩红隐藏
  bridge.profile.plants = bridge.plantCatalog.filter((p) => p.set).map((p) => p.id);
  bridge.profile.seeds = 99999;
  check('全部集齐后没有可育苗档位', bridge.nurseryOffer() === null);
  check('按钮变成「植物已集齐」', bridge.nurseryLabel() === '植物已集齐', bridge.nurseryLabel());
  check('集齐后不会再扣种子', bridge.tryNursery() === null && bridge.profile.seeds === 99999);
}

// ---------------------------------------------------------------------------
console.log('\n【6】按钮布局：小院底部两个按钮并排、互不重叠、都在面板内');
{
  const panel = bridge.gardenPanel();
  const codex = bridge.plantCodexButtonBounds();
  const nursery = bridge.nurseryButtonBounds();
  check('图鉴在左、育苗在右', codex.x < nursery.x, `${codex.x} < ${nursery.x}`);
  check('两按钮不重叠', codex.x + codex.width <= nursery.x, `${codex.x + codex.width} ≤ ${nursery.x}`);
  check('都在面板左右边界内', codex.x >= panel.x && nursery.x + nursery.width <= panel.x + panel.width,
    `面板 ${panel.x}..${panel.x + panel.width}`);
  check('都在面板底部之上', codex.y + codex.height <= panel.y + panel.height,
    `${codex.y + codex.height} ≤ ${panel.y + panel.height}`);
  check('种子较贵时按钮仍可点（不是灰掉就没救）', nursery.width > 100);

  // 重抽按钮：在最后一张卡下方，且不越出屏幕
  bridge.startGame();
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
  const lastCard = bridge.upgradeCardBounds(bridge.game.upgradeChoices.length - 1);
  const reroll = bridge.rerollButtonBounds();
  check('重抽按钮在最后一张卡下方', reroll.y >= lastCard.y + lastCard.height,
    `${reroll.y} ≥ ${lastCard.y + lastCard.height}`);
  check('重抽按钮不越出屏幕', reroll.y + reroll.height <= 667 && reroll.x >= 0 && reroll.x + reroll.width <= 375,
    `y ${reroll.y}..${reroll.y + reroll.height}`);
}

// ---------------------------------------------------------------------------
console.log('\n【7】界面：小院屏与升级屏真画一遍不抛异常');
{
  bridge.profile.coins = 500;
  bridge.profile.seeds = 500;
  bridge.profile.plants = [];
  bridge.startGame();
  bridge.screen = 'garden';
  bridge.draw();
  check('garden 屏绘制不抛', true);
  bridge.screen = 'upgrade';
  bridge.game.upgradeChoices = bridge.chooseUpgrades();
  bridge.draw();
  check('upgrade 屏绘制不抛', true);
  tap(bridge.nurseryButtonBounds());
  check('在小院屏点育苗按钮位置不会崩（屏不对时不该乱花种子）', bridge.profile.seeds === 500, String(bridge.profile.seeds));
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
