// =============================================================================
// 首局引导 + 死因复盘 回归测试
//
// 部门升级为「游戏开发部」后，D0 动手的三件事里有两件在这里立规矩：
//   ① 首局引导：三步提示只对未完成引导的账号出现，且走完一次就写存档标记
//   ② 死因复盘：被哪个怪打死、挨了多少点伤害、给一句能用的建议
//
// 运行：node tools/tutorial-death.test.mjs
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
const context = vm.createContext(sandbox, { name: 'tutorial-death-test' });
vm.runInContext('(function(){ let s = 3; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, set profile(v){ profile = v; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  damagePlayer: damagePlayer, finishGame: finishGame, saveProfile: saveProfile,
  describeDeath: describeDeath, chooseUpgrades: chooseUpgrades,
  upgradeConfirmBounds: upgradeConfirmBounds,
}; })()`, context, { filename: 'tutorial-bridge.js' });
stub.flushImageLoads();

const tap = (rect) => stub.touch.start({
  identifier: 31,
  clientX: rect.x + rect.width / 2,
  clientY: rect.y + rect.height / 2,
});

// ---------------------------------------------------------------------------
console.log('\n【1】存档：tutorialDone 默认 false，老存档读出来也是 false');
{
  check('默认存档 tutorialDone = false', bridge.profile.tutorialDone === false, String(bridge.profile.tutorialDone));
  const migrated = vm.runInContext('normalizeProfile({ version: 1, coins: 5 })', context);
  check('老存档（无该字段）迁移后为 false', migrated.tutorialDone === false, String(migrated.tutorialDone));
  const kept = vm.runInContext('normalizeProfile({ version: 2, tutorialDone: true })', context);
  check('已有 true 的存档不会被清零', kept.tutorialDone === true, String(kept.tutorialDone));
}

// ---------------------------------------------------------------------------
console.log('\n【2】首局引导：0 移动 → 1 攻击 → 2 选卡 → 3 完成');
{
  bridge.profile.tutorialDone = false;
  bridge.setCharacter('supreme');
  bridge.startGame();
  const game = bridge.game;
  check('新账号开局 coachStep = 0', game.coachStep === 0, String(game.coachStep));

  game.input = { x: 1, y: 0 };
  for (let i = 0; i < 30; i += 1) bridge.updateGame(1 / 60);
  check('移动 60px 后进入第 1 步', game.coachStep === 1, `coachStep=${game.coachStep} moved=${Math.round(game.coachMoved)}`);

  // 升级 → 引导第 2 步
  game.coachStep = 1;
  game.experience = game.experienceNeeded;
  game.level = 1;
  vm.runInContext('gainExperience(0)', context);
  check('升级打开卡片时进入第 2 步', game.coachStep === 2, String(game.coachStep));

  // 确认吃卡 → 引导完成 + 写存档
  game.pendingUpgrade = bridge.chooseUpgrades()[0];
  bridge.screen = 'upgradeConfirm';
  tap(bridge.upgradeConfirmBounds().confirm);
  check('确认吃卡后 coachStep = 3（完成）', game.coachStep === 3, String(game.coachStep));
  check('存档标记 tutorialDone = true', bridge.profile.tutorialDone === true);

  // 老账号不再出现引导
  bridge.startGame();
  check('已完成的账号新开一局 coachStep 直接是 3', bridge.game.coachStep === 3, String(bridge.game.coachStep));
  bridge.draw();
  check('引导状态下 drawGame 不抛异常', true);
}

// ---------------------------------------------------------------------------
console.log('\n【3】死因复盘：来源 / 伤害 / 建议');
{
  bridge.profile.tutorialDone = true;
  bridge.setCharacter('daxia');
  bridge.startGame();
  const game = bridge.game;

  const enemy = {
    x: game.player.x + 10, y: game.player.y, radius: 14, health: 50, maxHealth: 50,
    type: 'stalker', weight: 1, speed: 40, damage: 37, facing: 1, pushTrail: [], stun: 0, hitFlash: 0,
  };
  game.damageReduction = 0;
  game.thornPermanent = false;
  game.thornCharge = 0;
  bridge.damagePlayer(37, enemy);
  check('damagePlayer 记录了 lastHit', !!game.lastHit && game.lastHit.type === 'stalker', JSON.stringify(game.lastHit));

  const cause = bridge.describeDeath(game.lastHit);
  check('死因名字是「夜行客」', cause.name === '夜行客', cause.name);
  check('死因伤害是整数 37', cause.damage === 37, String(cause.damage));
  check('建议里包含「墙角」这类可执行动作', cause.advice.includes('墙角'), cause.advice);
  check('建议文案不含小数点', !cause.advice.replace(/Lv\./g, '').includes('.'));

  // 未知类型也要有兜底
  const fallback = bridge.describeDeath({ type: 'nope', damage: 12.4 });
  check('未知敌人类型有兜底名字与建议', fallback.name === '捣蛋虫' && fallback.advice.length > 0, fallback.name);
  check('兜底伤害取整', fallback.damage === 12, String(fallback.damage));
  // 没有记录时按最普通的敌人算，不能让复盘行崩掉
  check('无 lastHit 时回落到基础敌人', bridge.describeDeath(null).name === '草团怪', bridge.describeDeath(null).name);

  // 死亡流程：血量归零 → deathCause 定格 → 结算屏
  game.lastHit = { type: 'boss', boss: true, damage: 40 };
  game.health = 1;
  game.damageCooldown = 0;
  game.invulnTimer = 0;
  bridge.damagePlayer(40, { type: 'boss', boss: true, health: 100, damage: 40 });
  for (let i = 0; i < 3; i += 1) bridge.updateGame(1 / 60);
  check('血量归零后进入结算屏', bridge.screen === 'result', bridge.screen);
  check('deathCause 已定格为首领', game.deathCause && game.deathCause.name === '王座首领', JSON.stringify(game.deathCause));
  bridge.draw();
  check('结算页画死因行不抛异常', true);
}

// ---------------------------------------------------------------------------
console.log('\n【4】胜利/提前结算不该有死因行');
{
  bridge.setCharacter('xiaoxian');
  bridge.startGame();
  bridge.game.deathCause = null;
  bridge.finishGame(true);
  check('胜利局 deathCause 为空（不显示复盘）', bridge.game.deathCause === null);
  bridge.draw();
  check('胜利结算页照常可画', bridge.screen === 'result');
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
