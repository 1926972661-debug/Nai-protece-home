// =============================================================================
// 通用规则：拿到红色技能之后，升级所需经验提高
//
// 规则（对所有角色生效）：
//   拿到红技能前   experienceBase + 等级 × experiencePerLevel   = 4 + 2L
//   拿到红技能后  (experienceBase + 等级 × redExperienceStep) × redExperienceMultiplier
//                                                              = (4 + 4L) × 2 = 8 + 8L
//
// 为什么单独一个文件：这是**通用规则**，不是奶大侠专属，所以要对四个角色都验证，
// 而 daxia-form.test.mjs 只覆盖奶大侠的攻击形态。
// 做法：每个角色用一个全新的 vm context 载入 game.js，走真实触摸路径开一局，
// 然后驱动一次**真实的红色技能拾取**（设置 pendingUpgrade 并点确认键），
// 检查 redSkillTaken 与 experienceNeeded。
//
// 依赖：团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs
// 运行：node tools/experience-rule.test.mjs
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

// 起一个全新世界，返回桥接对象
function boot(character) {
  const sandbox = {};
  const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
  const context = vm.createContext(sandbox, { name: `xp-${character}` });
  vm.runInContext('(function(){ let s = 1; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
  vm.runInContext(SOURCE, context, { filename: 'game.js' });
  const bridge = vm.runInContext(`(function () {
    return {
      get game() { return game; },
      get screen() { return screen; },
      get balance() { return balance; },
      get profile() { return profile; },
      get characters() { return characters; },
      get upgrades() { return upgrades; },
      get rabbitUpgrades() { return rabbitUpgrades; },
      get daxiaUpgrades() { return daxiaUpgrades; },
      get xiaoxianUpgrades() { return xiaoxianUpgrades; },
      experienceNeededFor: experienceNeededFor,
      gainExperience: gainExperience,
      characterCardBounds: characterCardBounds,
      menuLayout: menuLayout,
      upgradeConfirmBounds: upgradeConfirmBounds,
      setScreen: function (v) { screen = v; },
      setClock: function (v) { Date.now = function () { return v | 0; }; },
    };
  })()`, context, { filename: 'xp-bridge.js' });
  bridge.setClock(0);
  const idx = bridge.characters.findIndex((c) => c.id === character);
  const card = bridge.characterCardBounds(idx);
  stub.touch.start({ identifier: 9, clientX: card.x + card.width / 2, clientY: card.y + card.height / 2 });
  const layout = bridge.menuLayout();
  stub.touch.start({ identifier: 9, clientX: layout.start.x + layout.start.width / 2, clientY: layout.start.y + layout.start.height / 2 });
  return { bridge, stub };
}

// 驱动一次真实的红色技能拾取
function takeRed(world, red) {
  const { bridge, stub } = world;
  bridge.game.pendingUpgrade = red;
  bridge.setScreen('upgradeConfirm');
  const btn = bridge.upgradeConfirmBounds().confirm;
  stub.touch.start({ identifier: 7, clientX: btn.x + btn.width / 2, clientY: btn.y + btn.height / 2 });
}

const B = (() => {
  const w = boot('daxia');
  return w.bridge.balance;
})();

console.log('【1】公式本身（纯函数）');
{
  const w = boot('daxia');
  const { bridge } = w;
  const g = bridge.game;
  check(`balance 里四个参数都在（base=${B.experienceBase} perLevel=${B.experiencePerLevel} ×${B.redExperienceMultiplier} step=${B.redExperienceStep}）`,
    B.experienceBase === 4 && B.experiencePerLevel === 2 && B.redExperienceMultiplier === 2 && B.redExperienceStep === 4);

  g.redSkillTaken = false;
  let okBefore = true;
  for (const L of [1, 5, 10, 30, 50, 99]) {
    if (bridge.experienceNeededFor(L) !== B.experienceBase + L * B.experiencePerLevel) okBefore = false;
  }
  check('未拿红技能：experienceBase + 等级 × experiencePerLevel（原公式不变）', okBefore,
    `L=10 → ${bridge.experienceNeededFor(10)}`);

  g.redSkillTaken = true;
  let okAfter = true;
  for (const L of [1, 5, 10, 30, 50, 99]) {
    const want = (B.experienceBase + L * B.redExperienceStep) * B.redExperienceMultiplier;
    if (bridge.experienceNeededFor(L) !== want) okAfter = false;
  }
  check('拿红技能后：(experienceBase + 等级 × redExperienceStep) × redExperienceMultiplier', okAfter,
    `L=10 → ${bridge.experienceNeededFor(10)}（原 ${B.experienceBase + 10 * B.experiencePerLevel}）`);

  const ratio = (L) => bridge.experienceNeededFor(L) / (B.experienceBase + L * B.experiencePerLevel);
  check('整体确实翻倍以上（倍数随等级升到约 3.9 倍）',
    ratio(1) > 2 && ratio(50) > 3.5 && ratio(50) < 4.1,
    `L=1 → ${ratio(1).toFixed(2)}× ｜ L=50 → ${ratio(50).toFixed(2)}×`);
  check('每级固定增量变大（2 → 4），所以是"固定增加"',
    bridge.experienceNeededFor(11) - bridge.experienceNeededFor(10)
      === (B.experienceBase + 11 * B.redExperienceStep) * B.redExperienceMultiplier
        - (B.experienceBase + 10 * B.redExperienceStep) * B.redExperienceMultiplier,
    `相邻两级差 = ${bridge.experienceNeededFor(11) - bridge.experienceNeededFor(10)}`);
}

console.log('\n【2】真实的红色技能拾取会立刻生效（四个角色都验）');
{
  const pools = {
    supreme: (b) => b.upgrades,
    rabbit: (b) => b.rabbitUpgrades,
    daxia: (b) => b.daxiaUpgrades,
    xiaoxian: (b) => b.xiaoxianUpgrades,
  };
  for (const character of ['supreme', 'rabbit', 'daxia', 'xiaoxian']) {
    const w = boot(character);
    const { bridge } = w;
    const g = bridge.game;
    const red = pools[character](bridge).find((u) => u.rarity === 'red');
    if (!red) { check(`${character} 能找到一张红卡`, false, '没找到 red 卡'); continue; }
    g.level = 12;
    g.experienceNeeded = bridge.experienceNeededFor(12);
    const before = g.experienceNeeded;
    check(`${character}：开局 redSkillTaken = false`, g.redSkillTaken === false);
    takeRed(w, red);
    check(`${character}：拾取「${red.title}」后 redSkillTaken = true`, g.redSkillTaken === true);
    const want = (B.experienceBase + 12 * B.redExperienceStep) * B.redExperienceMultiplier;
    check(`${character}：当前这一级的需求**立刻**抬高到 ${want}`,
      g.experienceNeeded === want,
      `${before} → ${g.experienceNeeded}`);
  }
}

console.log('\n【3】升级时走新公式 / 未拿红技能时走旧公式');
{
  const w = boot('daxia');
  const { bridge } = w;
  const g = bridge.game;
  // 未拿红技能：把经验灌满触发一次升级，之后应等于旧公式
  g.level = 20; g.experience = 0; g.experienceNeeded = 1; g.redSkillTaken = false;
  g.experience = g.experienceNeeded;
  w.bridge.gainExperience(0);
  check('未拿红技能：升级后 experienceNeeded = 4 + 等级×2',
    g.experienceNeeded === B.experienceBase + g.level * B.experiencePerLevel,
    `L=${g.level} → ${g.experienceNeeded}`);

  // 拿红技能后再升一级
  g.redSkillTaken = true;
  g.experienceNeeded = bridge.experienceNeededFor(g.level);
  g.experience = g.experienceNeeded;
  w.bridge.gainExperience(0);
  check('拿红技能后：升级后 experienceNeeded = (4 + 等级×4) × 2',
    g.experienceNeeded === (B.experienceBase + g.level * B.redExperienceStep) * B.redExperienceMultiplier,
    `L=${g.level} → ${g.experienceNeeded}`);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
