// =============================================================================
// 奶大侠「无极剑阵 / 寂 / 一人一刀索敌」专项测试
//
// 为什么需要它：`node --check`、`tools/verify.mjs`、乃至跑一整局仿真，都只能证明
// "**能跑通**"，证明不了"**新形态真的触发了**" —— 靠自然抽卡要很久才够到门槛。
//
// 做法：借 D5 无头仿真室的 wx 桩把 game.js 载入 vm context，然后**直接把刀光数设到门槛**
// 调 `fireSwordWave()`，检查生成出来的刀光数组本身。
//
// 依赖：团队工作区/outbox/D5-无头仿真室/第1轮/sim/{wx-stub,harness}.mjs（已在仓库里）
// 运行：node tools/daxia-form.test.mjs
// =============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installStub, DEFAULT_SYSTEM } from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  [v] ${name}${detail ? '  ' + detail : ''}`); }
  else { fail += 1; console.log(`  [x] ${name}${detail ? '  ' + detail : ''}`); }
};

const sandbox = {};
const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
const context = vm.createContext(sandbox, { name: 'daxia-form-test' });

vm.runInContext('(function(){ let s = 1; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', context);
vm.runInContext(readFileSync(join(ROOT, 'game.js'), 'utf8'), context, { filename: 'game.js' });

const bridge = vm.runInContext(`(function () {
  return {
    get game() { return game; },
    get screen() { return screen; },
    get balance() { return balance; },
    get profile() { return profile; },
    get characters() { return characters; },
    fireSwordWave: fireSwordWave,
    updateSwordWaves: updateSwordWaves,
    swordWaveMode: swordWaveMode,
    gainSwordWaves: gainSwordWaves,
    planSwordVolley: planSwordVolley,
    pickAttackTargets: pickAttackTargets,
    crescentBladeGeometry: crescentBladeGeometry,
    currentBladeScale: currentBladeScale,
    swordWaveDamageAt: swordWaveDamageAt,
    daxiaUpgrades: daxiaUpgrades,
    characterCardBounds: characterCardBounds,
    menuLayout: menuLayout,
    setClock: function (v) { Date.now = function () { return v | 0; }; },
  };
})()`, context, { filename: 'daxia-form-bridge.js' });

bridge.setClock(0);

const charIndex = bridge.characters.findIndex((c) => c.id === 'daxia');
const card = bridge.characterCardBounds(charIndex);
stub.touch.start({ identifier: 9, clientX: card.x + card.width / 2, clientY: card.y + card.height / 2 });
const layout = bridge.menuLayout();
stub.touch.start({ identifier: 9, clientX: layout.start.x + layout.start.width / 2, clientY: layout.start.y + layout.start.height / 2 });

const game = bridge.game;
const balance = bridge.balance;
const F = balance.daxiaFormationWaveThreshold;
const J = balance.daxiaJiWaveThreshold;
check('开局成功（角色=奶大侠）', bridge.screen === 'game' && bridge.profile.character === 'daxia', `screen=${bridge.screen}`);
check(`门槛符合预期：无极剑阵 ${F} 道 / 寂 ${J} 道`, F === 6 && J === 12, `实际 ${F} / ${J}`);

const mkEnemy = (x, y, hp = 100000) => ({
  x, y, radius: 12, health: hp, maxHealth: hp, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false,
});

// ---------------------------------------------------------------------------
console.log('\n【1】形态判定（swordWaveMode）');
const modeAt = (n) => { game.swordWaveCount = n; return bridge.swordWaveMode(); };
check('刀光数 1 → normal', modeAt(1) === 'normal');
check(`刀光数 ${F - 1} → normal（差 1 未到剑阵）`, modeAt(F - 1) === 'normal');
check(`刀光数 ${F} → formation（无极剑阵）`, modeAt(F) === 'formation');
check(`刀光数 ${J - 1} → formation（差 1 未到寂）`, modeAt(J - 1) === 'formation');
check(`刀光数 ${J} → ji（寂）`, modeAt(J) === 'ji');
check('刀光数 40 → ji', modeAt(40) === 'ji');

// ---------------------------------------------------------------------------
console.log(`\n【2】无极剑阵：刀光数 ${F} 时应 360° 等分打出`);
game.enemies.length = 0;
game.swordWaveCount = F;
game.swordWaves.length = 0;
bridge.fireSwordWave(0);
const formation = game.swordWaves.slice();
check(`生成 ${F} 道刀光`, formation.length === F, `实际 ${formation.length}`);
check('全部不是环形刀光', formation.every((w) => !w.radial));
check('全部 offset = 0（不再并排）', formation.every((w) => w.offset === 0));
{
  const angles = formation.map((w) => ((w.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  const step = (Math.PI * 2) / F;
  let evenly = true;
  for (let i = 1; i < angles.length; i += 1) {
    if (Math.abs((angles[i] - angles[i - 1]) - step) > 1e-9) { evenly = false; break; }
  }
  check(`角度按 2π/${F} 等分（真正的 360° 全方位）`, evenly, `间隔=${step.toFixed(6)}`);
}
check('每道都是同一规格（无巨型刀光）', formation.every((w) => w.damage === formation[0].damage && w.giant === undefined));

// ---------------------------------------------------------------------------
console.log(`\n【3】寂：刀光数 ${J} 时应合成 1 道环形刀光`);
const perWave = formation[0].damage;
game.swordWaveCount = J;
game.swordJiScale = 1;
game.swordWaves.length = 0;
bridge.fireSwordWave(0);
const jiWaves = game.swordWaves.slice();
check('只生成 1 道刀光（全部合成 1 道）', jiWaves.length === 1, `实际 ${jiWaves.length}`);
const ji = jiWaves[0];
check('标记为环形刀光（radial）', ji.radial === true);
check('初始半径 = 0（由内向外扩张）', ji.radius === 0);
check(`damage = 单道伤害 × ${J}（合成不损失总伤害）`,
  Math.abs(ji.damage - perWave * J) < 1e-6,
  `寂=${ji.damage.toFixed(1)} 期望=${(perWave * J).toFixed(1)}`);
check('环带厚度取 swordHalfWidth（宽刃/横扫千军 因此联动）',
  Math.abs(ji.band - game.swordHalfWidth * balance.daxiaJiBandScale) < 1e-9,
  `band=${ji.band.toFixed(1)}`);

// ---------------------------------------------------------------------------
console.log('\n【4】寂：扩张速度与环带命中');
game.swordWaves.length = 0;
game.swordWaveCount = J;
bridge.fireSwordWave(0);
const ring = game.swordWaves[0];
const beforeRadius = ring.radius;
const dt = 1 / 60;
bridge.updateSwordWaves(dt);
const expectedGrow = game.swordWaveSpeed * dt * balance.daxiaJiExpandSpeed;
check('半径按 刀光速度 × daxiaJiExpandSpeed 扩张',
  Math.abs(ring.radius - (beforeRadius + expectedGrow)) < 1e-6,
  `+${(ring.radius - beforeRadius).toFixed(3)} 期望 +${expectedGrow.toFixed(3)}`);
check('环形刀光不做 x/y 位移（原地扩张）',
  Math.abs(ring.x - game.player.x) < 1e-9 && Math.abs(ring.y - game.player.y) < 1e-9);
game.enemies.length = 0;
const onRing = mkEnemy(game.player.x + ring.radius, game.player.y);
const offRing = mkEnemy(game.player.x + ring.radius + ring.band + 12 + 300, game.player.y);
game.enemies.push(onRing, offRing);
bridge.updateSwordWaves(dt);
check('落在环带上的敌人被命中', ring.hitEnemies.indexOf(onRing) >= 0);
check('远在环外的敌人未被命中', ring.hitEnemies.indexOf(offRing) < 0);

// ---------------------------------------------------------------------------
console.log('\n【5】三张「多刀光」技能：未到寂加刀光 / 到寂后折算成寂伤害');
const find = (t) => bridge.daxiaUpgrades.find((u) => u.title === t);
const shuangfeng = find('双锋');
const sandao = find('三刀流');
const jiGuide = find('剑阵引导');
check('「双锋」在技能池里', !!shuangfeng);
check('「三刀流」已加入技能池（金色）', !!sandao && sandao.rarity === 'gold');
check('「剑阵引导」仍在技能池里（金色）', !!jiGuide && jiGuide.rarity === 'gold');
if (shuangfeng) {
  game.swordWaveCount = 1; game.swordJiScale = 1;
  shuangfeng.apply();
  check('双锋 未到寂时 刀光数 +2', game.swordWaveCount === 3, `刀光数=${game.swordWaveCount}`);
  game.swordWaveCount = J; game.swordJiScale = 1;
  shuangfeng.apply();
  check('双锋 到寂后 不改刀光数', game.swordWaveCount === J);
  check('双锋 到寂后 寂伤害 +40%', Math.abs(game.swordJiScale - 1.4) < 1e-9, `scale=${game.swordJiScale}`);
}
if (sandao) {
  game.swordWaveCount = 1; game.swordJiScale = 1; game.swordFireInterval = balance.daxiaFireInterval;
  sandao.apply();
  check('三刀流 未到寂时 刀光数 +3', game.swordWaveCount === 4, `刀光数=${game.swordWaveCount}`);
  const expectInterval = balance.daxiaFireInterval / (1 + balance.daxiaSanDaoAttackSpeed);
  check('三刀流 攻速 +50%（出刀间隔 ÷1.5）',
    Math.abs(game.swordFireInterval - expectInterval) < 1e-9,
    `间隔 → ${game.swordFireInterval.toFixed(4)}`);
  game.swordFireInterval = balance.daxiaFireIntervalMin;
  const dmgBefore = game.swordDamage;
  sandao.apply();
  check('三刀流 已到下限制时改为刀光伤害 +6',
    game.swordFireInterval === balance.daxiaFireIntervalMin && game.swordDamage === dmgBefore + 6);
  game.swordWaveCount = J; game.swordJiScale = 1;
  sandao.apply();
  check('三刀流 到寂后 寂伤害 +60%', Math.abs(game.swordJiScale - 1.6) < 1e-9, `scale=${game.swordJiScale}`);
}
if (jiGuide) {
  game.swordWaveCount = 1; game.swordJiScale = 1;
  jiGuide.apply();
  check('剑阵引导 未到寂时 刀光数 +4', game.swordWaveCount === 5);
  game.swordWaveCount = J; game.swordJiScale = 1;
  jiGuide.apply();
  check('剑阵引导 到寂后 寂伤害 +80%', Math.abs(game.swordJiScale - 1.8) < 1e-9, `scale=${game.swordJiScale}`);
}
game.swordWaveCount = 1; game.swordJiScale = 1;
bridge.gainSwordWaves(3);
check('gainSwordWaves 未到寂时加刀光', game.swordWaveCount === 4 && game.swordJiScale === 1);
game.swordWaveCount = J; game.swordJiScale = 1;
bridge.gainSwordWaves(3);
check('gainSwordWaves 到寂后折算成寂伤害（不加刀光）',
  game.swordWaveCount === J && Math.abs(game.swordJiScale - 1.6) < 1e-9);

// ---------------------------------------------------------------------------
console.log('\n【6】索敌：每道刀光各索一个不同的敌人（核心需求）');
{
  const p = game.player;
  game.enemies.length = 0;
  // 三个距离/方向都不同的敌人：近(+x)、中(+y)、远(-x)
  const near = mkEnemy(p.x + 50, p.y);
  const mid = mkEnemy(p.x, p.y + 90);
  const far = mkEnemy(p.x - 120, p.y);
  game.enemies.push(far, mid, near);   // 故意乱序放入，验证是"按距离"而不是"按数组顺序"

  check('pickAttackTargets 按最近优先返回', (() => {
    const t = bridge.pickAttackTargets(3);
    return t.length === 3 && t[0] === near && t[1] === mid && t[2] === far;
  })(), `返回 ${bridge.pickAttackTargets(3).length} 个`);

  game.swordWaveCount = 3;
  const plan = bridge.planSwordVolley(3);
  check('刀光数 3、敌人数 3 → 计划 3 项', plan.length === 3);
  const expectAngles = [near, mid, far].map((e) => Math.atan2(e.y - p.y, e.x - p.x));
  check('每道刀光各自瞄准一个不同的敌人',
    plan.every((item, i) => Math.abs(item.angle - expectAngles[i]) < 1e-9),
    `计划角度=${plan.map((x) => x.angle.toFixed(2)).join(',')}`);
  check('三个角度互不相同（不会三刀追同一个小怪）',
    new Set(plan.map((x) => x.angle.toFixed(6))).size === 3);
  check('一人一刀时 offset 全为 0（不需要错开）', plan.every((x) => x.offset === 0));

  // 真正打出来，验证角度被写进了刀光
  game.swordWaves.length = 0;
  bridge.fireSwordWave(plan[0].angle, plan);
  const volley = game.swordWaves.slice();
  check('打出 3 道刀光', volley.length === 3);
  check('刀光角度 = 计划角度（不是全部同向）',
    new Set(volley.map((w) => w.angle.toFixed(6))).size === 3,
    `实际角度=${volley.map((w) => w.angle.toFixed(2)).join(',')}`);

  // 敌人少于刀光数 → 轮流分配 + 同目标横向错开
  game.enemies.length = 0;
  const a = mkEnemy(p.x + 60, p.y);
  const b = mkEnemy(p.x, p.y + 70);
  game.enemies.push(a, b);
  game.swordWaveCount = 5;
  const plan2 = bridge.planSwordVolley(5);
  check('刀光数 5、敌人数 2 → 计划仍是 5 项', plan2.length === 5);
  const angleA = Math.atan2(a.y - p.y, a.x - p.x);
  const angleB = Math.atan2(b.y - p.y, b.x - p.x);
  check('轮流分配：只有两个角度（对应两个敌人）',
    new Set(plan2.map((x) => x.angle.toFixed(6))).size === 2);
  check('两个角度就是那两个敌人', plan2.every((x) => Math.abs(x.angle - angleA) < 1e-9 || Math.abs(x.angle - angleB) < 1e-9));
  {
    const groupOf = (ang) => plan2.filter((x) => Math.abs(x.angle - ang) < 1e-9).map((x) => x.offset).sort((m, n) => m - n);
    const gA = groupOf(angleA);
    const gB = groupOf(angleB);
    const centered = (g) => Math.abs((g[0] + g[g.length - 1]) / 2) < 1e-9;
    check('同一目标的多道刀光横向错开且居中', gA.length >= 2 && gB.length >= 2
      && new Set(gA).size === gA.length && new Set(gB).size === gB.length
      && centered(gA) && centered(gB),
    `A组 offsets=${gA.map((v) => v.toFixed(0))} ｜ B组=${gB.map((v) => v.toFixed(0))}`);
  }

  // 一个敌人都没有 → 空计划
  game.enemies.length = 0;
  check('没有敌人时计划为空（不出刀）', bridge.planSwordVolley(3).length === 0);
}

// ---------------------------------------------------------------------------
console.log('\n【7】回归：兜底并排行为 + 刀势机制已彻底删除');
game.enemies.length = 0;
game.swordWaveCount = 4;
game.swordWaves.length = 0;
bridge.fireSwordWave(0.5);        // 不传计划 → 走兜底
const normal = game.swordWaves.slice();
check('生成 4 道刀光', normal.length === 4, `实际 ${normal.length}`);
check('兜底时全部同一角度（并排，不是 360°）', normal.every((w) => Math.abs(w.angle - 0.5) < 1e-9));
check('兜底时 offset 关于 0 对称',
  Math.abs((normal.map((w) => w.offset).sort((m, n) => m - n)[0]
    + normal.map((w) => w.offset).sort((m, n) => m - n)[3]) / 2) < 1e-9,
  `offsets=${normal.map((w) => w.offset.toFixed(1)).join(',')}`);
check('刀光对象上不再有 giant 字段', normal.every((w) => w.giant === undefined));

check('刀势状态已删除（swordMomentum 不存在）', game.swordMomentum === undefined);
check('刀势状态已删除（swordMomentumReady 不存在）', game.swordMomentumReady === undefined);
check('刀势状态已删除（momentumLockout 不存在）', game.momentumLockout === undefined);
check('balance 里刀势参数已删除',
  balance.momentumMax === undefined && balance.momentumPerHit === undefined
  && balance.momentumDecay === undefined && balance.momentumLockout === undefined
  && balance.momentumDamageScale === undefined && balance.momentumWidthScale === undefined);

// ---------------------------------------------------------------------------
console.log('\n【8】无极剑阵 / 寂 形态下刀光厚度降为 30%（且不碰命中判定）');
{
  const B = bridge.balance;
  const bladeThickness = (k) => {
    const g = bridge.crescentBladeGeometry(k);
    return game.swordHalfWidth * (1 - g.innerRatio) + g.offset;
  };
  const g1 = bridge.crescentBladeGeometry(1);
  const gk = bridge.crescentBladeGeometry(B.daxiaWaveFormBladeScale);

  check('普通形态几何与改动前一致（innerRatio 0.93）', Math.abs(g1.innerRatio - 0.93) < 1e-12, `innerRatio=${g1.innerRatio}`);
  check('普通形态后移量 = daxiaWaveThickness × daxiaWaveBladeScale × 1.9',
    Math.abs(g1.offset - B.daxiaWaveThickness * B.daxiaWaveBladeScale * 1.9) < 1e-9, `offset=${g1.offset.toFixed(3)}`);

  const t1 = bladeThickness(1);
  const tk = bladeThickness(B.daxiaWaveFormBladeScale);
  check(`剑阵/寂 下厚度 = 普通形态的 ${(B.daxiaWaveFormBladeScale * 100).toFixed(0)}%`,
    Math.abs(tk / t1 - B.daxiaWaveFormBladeScale) < 1e-9,
    `${t1.toFixed(2)}px → ${tk.toFixed(2)}px（比值 ${(tk / t1 * 100).toFixed(1)}%）`);

  // 关键回归：如果只缩 thick、不缩内弧半径比，是缩不到 30% 的（会停在 48%）
  const onlyThick = game.swordHalfWidth * (1 - 0.93) + gk.offset;
  check('已同时缩「内弧半径差」与「后移量」两项（只缩后移量会停在 48%）',
    onlyThick / t1 > 0.4 && Math.abs(tk / t1 - 0.3) < 1e-9,
    `只缩后移量 = ${(onlyThick / t1 * 100).toFixed(1)}%`);

  // 形态系数只在两种新形态下生效
  game.swordWaveCount = 1;
  check('普通形态下形态系数 = 1', bridge.currentBladeScale() === 1);
  game.swordWaveCount = F;
  check('无极剑阵下形态系数 = daxiaWaveFormBladeScale', bridge.currentBladeScale() === B.daxiaWaveFormBladeScale);
  game.swordWaveCount = J;
  check('寂形态下形态系数 = daxiaWaveFormBladeScale', bridge.currentBladeScale() === B.daxiaWaveFormBladeScale);

  // 命中判定必须一行没动
  check('命中用的 daxiaWaveThickness 未被改动', B.daxiaWaveThickness === 22, `= ${B.daxiaWaveThickness}`);
  game.swordWaveCount = J;
  game.swordJiScale = 1;
  game.swordWaves.length = 0;
  bridge.fireSwordWave(0);
  const ringNow = game.swordWaves[0];
  check('寂 的命中环带 band 不受视觉变细影响',
    Math.abs(ringNow.band - game.swordHalfWidth * B.daxiaJiBandScale) < 1e-9,
    `band=${ringNow.band.toFixed(1)}`);
  game.swordWaveCount = F;
  game.swordWaves.length = 0;
  bridge.fireSwordWave(0);
  check('无极剑阵 的每道刀光 halfWidth 不受视觉变细影响',
    game.swordWaves.every((w) => w.halfWidth === game.swordHalfWidth),
    `halfWidth=${game.swordWaves[0].halfWidth}`);
}

// ---------------------------------------------------------------------------
console.log('\n【9】刀光消失机制：未命中活满 4 秒 / 命中后 2 秒递减后消失');
{
  const B = bridge.balance;
  const dt = 1 / 60;
  const mk = (over) => Object.assign({
    x: 0, y: 0, angle: 0, offset: 0, age: 0, life: B.daxiaWaveLife, fade: 1, damage: 100,
    hasHit: false, hitEnemies: [], halfWidth: game.swordHalfWidth, travelled: 0, returned: false,
  }, over);
  const dmg = (w) => bridge.swordWaveDamageAt(w);

  // 先确保没有"刀气纵横"这类会让衰减失效的技能干扰
  game.swordNoFalloff = false;
  game.swordFalloffBonus = 0;
  game.weaponEvolution = null;

  check(`参数：命中后寿命 ${B.daxiaHitLife}s、两档 ${B.daxiaHitFalloffEarly}/${B.daxiaHitFalloffLate}s`,
    B.daxiaHitLife === 2 && B.daxiaHitFalloffEarly === 0.5 && B.daxiaHitFalloffLate === 2);

  // 未命中：始终保持满伤害（这是相对旧行为的关键变化 —— 旧版按出刀时刻衰减）
  check('未命中：出刀后 3.9 秒仍是满伤害（旧版此时只剩 25%）', dmg(mk({ age: 3.9 })) === 100,
    `age=3.9 → ${dmg(mk({ age: 3.9 }))}（旧版按 age<2/4 会判成 25）`);

  // 已命中：以"首次命中"为锚点
  const hit = (age, hitAge) => dmg(mk({ age, hitAge, hasHit: true }));
  check('命中后 0.2s（< 0.5s）→ 早期倍率 50%', hit(0.2, 0) === 50, `${hit(0.2, 0)}`);
  check('命中后 1.0s（0.5~2s）→ 后期倍率 25%', hit(1.0, 0) === 25, `${hit(1.0, 0)}`);
  check('命中后 2.1s（> 2s）→ 0', hit(2.1, 0) === 0, `${hit(2.1, 0)}`);
  check('锚点是命中时刻而非出刀时刻：age=3、hitAge=2.8 → 仍是 50%（刚命中）',
    hit(3, 2.8) === 50, `${hit(3, 2.8)}`);

  // 三途刀放宽为 70% / 40%
  game.weaponEvolution = 'threefold';
  check('三途刀：命中后早期 = 70%', hit(0.2, 0) === 70, `${hit(0.2, 0)}`);
  check('三途刀：命中后后期 = 40%', hit(1.0, 0) === 40, `${hit(1.0, 0)}`);
  game.weaponEvolution = null;

  // 余劲不散：两档与命中后寿命一起推迟/延长
  game.swordFalloffBonus = 1;
  check('余劲不散 +1：档位推迟到 1.5/3s（命中后 1.0s 仍是 50%）', hit(1.0, 0) === 50, `${hit(1.0, 0)}`);
  check('余劲不散 +1：命中后寿命延长到 3s（2.5s 时仍有伤害）', hit(2.5, 0) === 25, `${hit(2.5, 0)}`);
  game.swordFalloffBonus = 0;

  // 消失时机：用真的 updateSwordWaves 走一遍
  const stepOnce = (wave) => {
    game.swordWaves.length = 0;
    game.swordWaves.push(wave);
    bridge.updateSwordWaves(dt);
    return game.swordWaves.length ? game.swordWaves[0].fade : 0;
  };
  check('未命中：age 逼近 4s 时还在（fade 未开始掉）',
    stepOnce(mk({ age: B.daxiaWaveLife - dt - 0.01 })) === 1, `fade=${stepOnce(mk({ age: B.daxiaWaveLife - dt - 0.01 }))}`);
  check('未命中：age 越过 4s 后开始淡出',
    stepOnce(mk({ age: B.daxiaWaveLife + 0.01 })) < 1, `fade=${stepOnce(mk({ age: B.daxiaWaveLife + 0.01 }))}`);
  check('已命中：越过 hitAge+2s 就开始淡出（而不是等到 4s）',
    stepOnce(mk({ age: 1 + B.daxiaHitLife + 0.01, hitAge: 1, hasHit: true })) < 1);
  check('已命中：刚到 hitAge+2s 之前还没淡出',
    stepOnce(mk({ age: 1 + B.daxiaHitLife - dt - 0.01, hitAge: 1, hasHit: true })) === 1);

  // 刀光对象被真正命中时应当记下 hitAge
  // 注意摆位：刀光的命中带是**垂直于行进方向的薄片** —— 沿行进方向只有
  // daxiaWaveThickness + 敌人半径 = 34px 的容差，所以把敌人放在正前方 60px 处是打不到的，
  // 必须放进带内（横向偏开、纵向距离很近）。
  const p = game.player;
  game.enemies.length = 0;
  game.enemies.push({
    x: p.x + 10, y: p.y + 40, radius: 12, health: 100000, maxHealth: 100000, type: 'basic', weight: 1,
    experience: 0, damage: 1, speed: 0, knockbackResist: 0, boss: false, eventSerial: 0,
    hitFlash: 0, dying: 0, lastHitCritical: false,
  });
  game.swordWaveCount = 1;
  game.swordWaves.length = 0;
  bridge.fireSwordWave(0);
  const w = game.swordWaves[0];
  w.age = 1.7;   // 假装已经飞了 1.7 秒才碰到敌人
  bridge.updateSwordWaves(dt);
  check('真正命中时会把当时的 age 记进 hitAge', w.hitAge !== undefined && Math.abs(w.hitAge - (1.7 + dt)) < 1e-9,
    `hitAge=${w.hitAge === undefined ? 'undefined' : w.hitAge.toFixed(4)}（期望 ${(1.7 + dt).toFixed(4)}）`);
  check('命中前 hitAge 是 undefined', mk({}).hitAge === undefined);
}

// ---------------------------------------------------------------------------
console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
