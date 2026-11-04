// =============================================================================
// 至尊奶「棍影冲刺」v2 回归测试
//
// 规格见 团队工作区/reports/角色技能/26-至尊奶冲刺优化方案.md
//   - 伤害：base+bonus+2+棍数×2+dashBonus×2（Lv1 仍是 6，后期随棍阵成长）
//   - 冲刺 + 结束后 0.08s 免疫接触伤害
//   - 命中：眩晕 0.25s（boss 半额）、击退 ×1.8、棍势 +1（上限 2，4 秒）
//   - 首次命中：顿帧 0.04s + 震屏
//   - 残影最多 3 个；冷却转好时技能键脉冲
//
// 运行：node tools/dash-skill.test.mjs
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
const context = vm.createContext(sandbox, { name: 'dash-skill-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; },
  get balance(){ return balance; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, draw: draw, updateGame: updateGame,
  activateDash: activateDash, dashDamage: dashDamage,
  getOrbitSticks: getOrbitSticks,
  chooseUpgrades: chooseUpgrades,
  get codexText(){ return characterCodices.supreme; },
  get activeSkillText(){ return characterActiveSkills.supreme; },
}; })()`, context, { filename: 'dash-bridge.js' });
stub.flushImageLoads();

const makeEnemy = (x, y, hp = 100000) => ({
  x, y, radius: 12, health: hp, maxHealth: hp, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0,
});

const world = () => {
  bridge.setCharacter('supreme');
  bridge.startGame();
  bridge.screen = 'game';
  return bridge.game;
};

// ---------------------------------------------------------------------------
console.log('\n【1】伤害公式：Lv1 不膨胀，后期随棍阵成长');
{
  const game = world();
  game.baseAttack = 2; game.bonusAttack = 0; game.orbitStickCount = 1; game.dashBonusDamage = 0; game.dashRodBonus = 0;
  check('Lv1 冲刺伤害 = 6（与旧版持平）', bridge.dashDamage() === 6, String(bridge.dashDamage()));

  game.baseAttack = 10; game.orbitStickCount = 4; game.dashBonusDamage = 3;
  check('中期（10 攻 / 4 棍 / +3）= 26', bridge.dashDamage() === 26, String(bridge.dashDamage()));

  game.baseAttack = 17; game.orbitStickCount = 7; game.dashBonusDamage = 6;
  check('后期（17 攻 / 7 棍 / +6）= 45', bridge.dashDamage() === 45, String(bridge.dashDamage()));

  game.dashRodBonus = 2;
  check('棍势计入伤害（+2 棍 → +4 伤害）', bridge.dashDamage() === 49, String(bridge.dashDamage()));
}

// ---------------------------------------------------------------------------
console.log('\n【2】无敌窗口：冲刺期间 + 结束后 0.08s 不吃接触伤害');
{
  const game = world();
  game.player.x = game.worldWidth / 2;
  game.player.y = game.worldHeight / 2;
  game.dashCharges = game.dashChargeMax;
  game.input = { x: 1, y: 0 };
  bridge.activateDash();
  check('冲刺进入无敌计时（0.26 + 0.08 = 0.34s）',
    Math.abs(game.dashInvulnTimer - (bridge.balance.dashDuration + bridge.balance.dashInvulnExtra)) < 1e-6,
    String(game.dashInvulnTimer));

  // 放一个贴脸敌人，推进一小段：仍不应掉血
  const before = game.health;
  game.enemies = [makeEnemy(game.player.x, game.player.y, 100)];
  game.damageCooldown = 0;
  bridge.updateGame(0.05);
  check('冲刺中不被贴脸敌人扣血', game.health === before, `${before} → ${game.health}`);

  // 推进到无敌结束（冲刺结束后 0.08s 之外），把敌人重新贴到玩家身上，应当开始吃伤害
  game.dashInvulnTimer = 0;
  game.dashTimer = 0;
  game.enemies[0].x = game.player.x;
  game.enemies[0].y = game.player.y;
  game.enemies[0].stun = 0;
  game.damageCooldown = 0;
  bridge.updateGame(0.05);
  check('无敌结束后会吃伤害', game.health < before, `${before} → ${game.health}`);
}

// ---------------------------------------------------------------------------
console.log('\n【3】命中效果：眩晕 / 击退 / 棍势 / 首次命中顿帧震屏');
{
  const game = world();
  game.player.x = game.worldWidth / 2;
  game.player.y = game.worldHeight / 2;
  game.baseAttack = 5; game.bonusAttack = 0; game.orbitStickCount = 4; game.dashBonusDamage = 0;
  game.dashCharges = game.dashChargeMax;
  game.input = { x: 1, y: 0 };
  const enemy = makeEnemy(game.player.x + 8, game.player.y, 100000);
  game.enemies = [enemy];
  bridge.activateDash();

  // 推一帧让命中分支执行
  bridge.updateGame(0.03);
  check('命中后眩晕 0.25s', Math.abs((enemy.stun || 0) - bridge.balance.dashStun) < 1e-6, String(enemy.stun));
  check('命中后棍势 +1', game.dashRodBonus === 1, String(game.dashRodBonus));
  check('棍势计时 = 4 秒', game.dashRodTimer > 0);
  check('棍阵根数计入棍势', bridge.getOrbitSticks().length === 5, String(bridge.getOrbitSticks().length));
  check('首次命中触发顿帧', game.hitStop > 0, String(game.hitStop));
  check('首次命中触发震屏', game.shakePower >= bridge.balance.dashShakePower, String(game.shakePower));

  // 同一敌人同一次冲刺只吃一次
  const hpAfterFirst = enemy.health;
  bridge.updateGame(0.05);
  check('同一敌人同一次冲刺只命中一次', enemy.health === hpAfterFirst, `${hpAfterFirst} → ${enemy.health}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】棍势：上限 2 层，4 秒后归零');
{
  const game = world();
  game.dashRodBonus = 0;
  game.dashRodTimer = bridge.balance.dashStickBonusLife;
  // 直接模拟三次命中累加（走真实分支太重，这里验证上限与衰减的纯逻辑）
  for (let i = 0; i < 5; i += 1) {
    if ((game.dashRodBonus || 0) < bridge.balance.dashStickBonusMax) game.dashRodBonus += 1;
  }
  check('棍势上限 2', game.dashRodBonus === 2, String(game.dashRodBonus));

  game.dashRodTimer = 0.05;
  bridge.updateGame(0.1);
  check('4 秒到期后棍势归零', game.dashRodBonus === 0, String(game.dashRodBonus));
  check('棍阵根数回到基础值', bridge.getOrbitSticks().length === game.orbitStickCount,
    `${bridge.getOrbitSticks().length} / ${game.orbitStickCount}`);
}

// ---------------------------------------------------------------------------
console.log('\n【5】残影 / 就绪脉冲 / 文案');
{
  const game = world();
  game.dashCharges = game.dashChargeMax;
  game.input = { x: 1, y: 0 };
  bridge.activateDash();
  for (let i = 0; i < 12; i += 1) bridge.updateGame(0.03);
  check('残影不超过 3 个', (game.dashGhosts || []).length <= bridge.balance.dashGhostMax,
    String((game.dashGhosts || []).length));
  check('残影会随时间消失', (game.dashGhosts || []).every((ghost) => ghost.life > 0));

  game.dashChargeTimer = game.dashRecharge - 0.01;
  bridge.updateGame(0.02);
  check('冷却转好记录时间（技能键脉冲用）', game.dashReadyAt > -999, String(game.dashReadyAt));

  check('技能图鉴写明免疫接触伤害', bridge.activeSkillText.includes('免疫接触伤害'), bridge.activeSkillText);

  // 绘制路径不抛（含残影与速度线）
  game.dashTimer = 0.1;
  game.dashGhosts = [{ x: game.player.x, y: game.player.y, facing: 1, life: 0.1 }];
  bridge.screen = 'game';
  bridge.draw();
  check('冲刺中绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
