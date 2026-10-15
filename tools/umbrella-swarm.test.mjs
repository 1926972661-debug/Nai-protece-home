// =============================================================================
// 奶小仙三处改动：
//   ① 持伞（state === 'held'，伞在身上）不绘制
//   ② 红色技能「万伞归一」下伞不再被回收
//   ③ 杀掉目标后自动寻找**绝对血量最高**的敌人继续攻击
//
// 做法：借 D5 的 wx 桩载入 game.js，直接摆敌人与伞的状态，调 updateOneUmbrella()，
// 并用挂过钩的 context.drawImage 统计"到底画了几把伞"。
//
// 依赖：团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs
// 运行：node tools/umbrella-swarm.test.mjs
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
const context = vm.createContext(sandbox, { name: 'umbrella-test' });
vm.runInContext('(function(){ let s = 1; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){return game;}, get screen(){return screen;}, get balance(){return balance;},
  get profile(){return profile;}, get characters(){return characters;},
  get umbrellaSprite(){return umbrellaSprite;}, get umbrellaReady(){return umbrellaReady;},
  updateOneUmbrella: updateOneUmbrella, pickHighestHealthEnemy: pickHighestHealthEnemy,
  draw: draw, characterCardBounds: characterCardBounds, menuLayout: menuLayout,
  setClock: function(v){ Date.now = function(){ return v|0; }; },
}; })()`, context, { filename: 'umbrella-bridge.js' });
bridge.setClock(0);
// 必须显式触发图片加载：wx 桩的 createImage() 不会自动 onload，
// 不调这一句 umbrellaReady 永远为 false（第一版就栽在这里，4 条绘制断言全假失败）。
stub.flushImageLoads();
const idx = bridge.characters.findIndex((c) => c.id === 'xiaoxian');
const card = bridge.characterCardBounds(idx);
stub.touch.start({ identifier: 9, clientX: card.x + card.width / 2, clientY: card.y + card.height / 2 });
const layout = bridge.menuLayout();
stub.touch.start({ identifier: 9, clientX: layout.start.x + layout.start.width / 2, clientY: layout.start.y + layout.start.height / 2 });

const game = bridge.game;
const balance = bridge.balance;
check('开局（奶小仙）', bridge.screen === 'game' && bridge.profile.character === 'xiaoxian');
check('umbrellaReady（素材已加载）', bridge.umbrellaReady === true);

const mk = (x, y, hp) => ({
  x, y, radius: 12, health: hp, maxHealth: hp, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false,
});

// ---------------------------------------------------------------------------
console.log('\n【1】pickHighestHealthEnemy：判据是「绝对血量」，不是距离或百分比');
{
  const p = game.player;
  game.enemies.length = 0;
  // ⚠️ 距离必须留在**屏幕内**：桩的屏幕是 375×667，且 pickHighestHealthEnemy 会过
  //    isEnemyVisible()。第一版把敌人放在 +300，被正确判为离屏，于是挑不到它
  //    —— 那是测试的错，不是代码的错。
  const near = mk(p.x + 40, p.y, 100);            // 最近但最薄
  const far = mk(p.x + 150, p.y, 900);            // 最远但最厚
  const mid = mk(p.x + 90, p.y, 400);
  game.enemies.push(near, mid, far);
  check('挑出绝对血量最高的（900），而不是最近的（100）',
    bridge.pickHighestHealthEnemy(null) === far);
  check('会跳过已死亡的目标', (() => {
    far.health = 0;
    const got = bridge.pickHighestHealthEnemy(null);
    far.health = 900;
    return got === mid;
  })());
  check('avoid 列表被尊重', bridge.pickHighestHealthEnemy([far]) === mid);
  check('没有敌人时返回 null', (() => {
    const keep = game.enemies.slice();
    game.enemies.length = 0;
    const got = bridge.pickHighestHealthEnemy(null);
    game.enemies.push(...keep);
    return got === null;
  })());
}

// ---------------------------------------------------------------------------
console.log('\n【2】未拿红技能：目标死亡 → 伞回手（原行为不变）');
{
  const p = game.player;
  game.umbrellaSwarm = false;
  game.enemies.length = 0;
  const a = mk(p.x + 80, p.y, 500);
  const b = mk(p.x + 200, p.y, 900);
  game.enemies.push(a, b);
  const u = game.umbrellas[0];
  u.state = 'spinning'; u.target = a; u.x = a.x; u.y = a.y; u.spinTime = 1;
  a.health = 0;                       // 目标死掉
  bridge.updateOneUmbrella(u, 1 / 60);
  check('目标死亡后 state 变为 returning', u.state === 'returning', `state=${u.state}`);
}

// ---------------------------------------------------------------------------
console.log('\n【3】拿到红技能：伞不再被回收，自动换到绝对血量最高的敌人');
{
  const p = game.player;
  game.umbrellaSwarm = true;
  game.enemies.length = 0;
  const a = mk(p.x + 60, p.y, 500);
  const thin = mk(p.x + 30, p.y, 120);    // 更近但更薄
  const thick = mk(p.x + 130, p.y, 1400); // 更远但最厚（仍在屏幕内）
  game.enemies.push(a, thin, thick);
  const u = game.umbrellas[0];
  u.state = 'spinning'; u.target = a; u.x = a.x; u.y = a.y;
  u.spinTime = 3; u.spinAccum = 9; u.hitEnemies = [a];
  a.health = 0;
  bridge.updateOneUmbrella(u, 1 / 60);
  check('不再回手，state 仍是 spinning', u.state === 'spinning', `state=${u.state}`);
  check('新目标是绝对血量最高的那只（1400）', u.target === thick,
    `新目标血量=${u.target ? u.target.health : 'null'}`);
  check('命中表已清空（新目标能重新被磨）', u.hitEnemies.length === 0);
  // 换目标那一帧就 return 了（不等本帧的 spinTime += delta），所以期望是 0 ——
  // 关键是它**归零**了，不会把上一个目标的递增带到新目标身上。
  check('自旋计时归零（伤害递增不会跨目标累计）', u.spinTime === 0,
    `spinTime=${u.spinTime}`);
  check('伞移动到新目标身上', u.x === thick.x && u.y === thick.y);

  // 8 秒不再触发收回
  u.spinTime = balance.umbrellaMaxSpin + 5;
  bridge.updateOneUmbrella(u, 1 / 60);
  check(`spinTime 被封顶在 umbrellaMaxSpin（${balance.umbrellaMaxSpin}），且不进入 returning`,
    u.state === 'spinning' && u.spinTime <= balance.umbrellaMaxSpin,
    `spinTime=${u.spinTime} state=${u.state}`);
}

// ---------------------------------------------------------------------------
console.log('\n【4】归鞘回血改到「换目标瞬间」结算（否则永不回手会让它静默失效）');
{
  const p = game.player;
  game.umbrellaSwarm = true;
  game.enemies.length = 0;
  const a = mk(p.x + 80, p.y, 500);
  const b = mk(p.x + 200, p.y, 900);
  game.enemies.push(a, b);
  const u = game.umbrellas[0];
  game.maxHealth = 100; game.health = 20; game.umbrellaHealBonus = 0;
  u.state = 'spinning'; u.target = a; u.x = a.x; u.y = a.y;
  u.primaryDamage = 200; u.spinTime = 1; u.hitEnemies = [a];
  a.health = 0;
  const before = game.health;
  bridge.updateOneUmbrella(u, 1 / 60);
  const heal = Math.round(200 * balance.umbrellaReturnHealRatio);
  check(`换目标时按主目标伤害×${balance.umbrellaReturnHealRatio} 回血（期望 +${heal}）`,
    game.health === Math.min(100, before + heal),
    `${before} → ${game.health}`);
  check('回血后 primaryDamage 清零', u.primaryDamage === 0);

  // 满血时不该刷治疗数字
  game.health = 100;
  const u2 = game.umbrellas[0];
  u2.primaryDamage = 200; u2.target = b; u2.state = 'spinning';
  b.health = 0;
  const pops = game.healPops.length;
  bridge.updateOneUmbrella(u2, 1 / 60);
  check('满血时不产生治疗飘字', game.healPops.length === pops);
  game.health = 100;
}

// ---------------------------------------------------------------------------
console.log('\n【5】绘制：收在身上的伞不画，飞在场上的伞照画');
{
  const p = game.player;
  const calls = [];
  const orig = stub.context.drawImage;
  stub.context.drawImage = function (img) {
    calls.push(img);
    return orig.apply(this, arguments);
  };
  const countUmbrellaDraws = () => {
    calls.length = 0;
    bridge.draw();
    return calls.filter((img) => img === bridge.umbrellaSprite).length;
  };

  const u = game.umbrellas[0];
  game.enemies.length = 0;
  game.enemies.push(mk(p.x + 120, p.y, 500));

  u.state = 'held';
  check('state=held（伞在身上）→ 一次都不画', countUmbrellaDraws() === 0, `画了 ${countUmbrellaDraws()} 次`);

  u.state = 'spinning'; u.target = game.enemies[0]; u.x = game.enemies[0].x; u.y = game.enemies[0].y;
  const flying = countUmbrellaDraws();
  check('state=spinning（伞在场）→ 会画', flying >= 1, `画了 ${flying} 次`);

  u.state = 'flying';
  const flying2 = countUmbrellaDraws();
  check('state=flying（掷出中）→ 会画', flying2 >= 1, `画了 ${flying2} 次`);

  u.state = 'returning';
  const returning = countUmbrellaDraws();
  check('state=returning（回程中）→ 会画', returning >= 1, `画了 ${returning} 次`);

  stub.context.drawImage = orig;
  u.state = 'held'; u.target = null;
}

// ---------------------------------------------------------------------------
console.log('\n【6】红技能卡确实会打开这个机制');
{
  const wanjia = vm.runInContext('xiaoxianUpgrades.find(u => u.title === "万伞归一")', context);
  check('技能池里有「万伞归一」', !!wanjia && wanjia.rarity === 'red');
  check('它的描述已写明"伞不再被回收"与"绝对血量最高"',
    wanjia.description.includes('不再被回收') && wanjia.description.includes('绝对血量最高'));
  game.umbrellaSwarm = false;
  wanjia.apply();
  check('apply() 会把 umbrellaSwarm 置为 true', game.umbrellaSwarm === true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
