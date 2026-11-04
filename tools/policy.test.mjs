// =============================================================================
// 走位策略回归门：balanced 必须「像玩家」，不能退化成 kite/none
//
// 背景：`none`（站桩）与 `kite`（只会逃）会让难度结论互相矛盾 —— 同一个至尊奶，
// 站桩能撑满 180 秒，逃跑时 180 秒只杀 7~65 只（近战环绕棍逃跑=打不到人）。
// D0 在 harness 里加了 `balanced`（保持距离带 + 优先打残血 + 血低才拉开）。
// 这个测试保证它不会在后续改动里退化成"不输出"。
//
// 运行：node tools/policy.test.mjs   （会真跑 3 局仿真，约 15~25 秒）
// =============================================================================
import {
  runOne, makeProfilePreset, CHARACTER_NAMES,
} from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/harness.mjs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  [v] ${name}${detail ? '  ' + detail : ''}`); }
  else { fail += 1; console.log(`  [x] ${name}${detail ? '  ' + detail : ''}`); }
};

const profile = makeProfilePreset('garden10plants');
const run = (character, move, seconds = 45) => runOne({
  character,
  seconds,
  policy: 'random',
  move,
  useSkill: true,
  profile,
  seed: 1,
  draw: false,
  quiet: true,
});

console.log('\n【1】balanced 在 45 秒内必须真的打到东西（近战角色尤其）');
{
  const supreme = run('supreme', 'balanced');
  check('至尊奶 balanced 击杀 > 0', supreme.kills > 0,
    `kills=${supreme.kills} level=${supreme.level}`);
  check('至尊奶 balanced 击杀 ≥ 15（不是只蹭到一两只）', supreme.kills >= 15,
    `kills=${supreme.kills}`);
  check('45 秒内至少升 1 级', supreme.level >= 2, `lv=${supreme.level}`);
}

console.log('\n【2】balanced 应该明显强于「站桩」与「只会逃」');
{
  const balanced = run('supreme', 'balanced');
  const idle = run('supreme', 'none');
  const kite = run('supreme', 'kite');
  check('balanced 击杀 > 站桩', balanced.kills > idle.kills,
    `balanced=${balanced.kills} vs none=${idle.kills}`);
  check('balanced 击杀 > kite（kite 会把近战角色饿死）', balanced.kills > kite.kills,
    `balanced=${balanced.kills} vs kite=${kite.kills}`);
}

console.log('\n【3】balanced 不是无敌：240 秒跑不完或者掉血，二者必居其一');
{
  // 只看「有没有压力」：45 秒内血量下降或已经能死，说明接触判定在工作
  const rabbit = run('rabbit', 'balanced', 90);
  const pressure = rabbit.died || rabbit.health < rabbit.maxHealth - 1;
  check('瘦嘟嘟 balanced 90 秒内有掉血或有死亡',
    pressure, `hp=${Math.round(rabbit.health)}/${Math.round(rabbit.maxHealth)} died=${rabbit.died}`);
  check('瘦嘟嘟 balanced 不会 0 击杀', rabbit.kills > 0, `kills=${rabbit.kills}`);
}

console.log('\n【4】策略是「可选」的，没传就等价于站桩（不能静默变成 balanced）');
{
  check('四个角色名都在', Object.keys(CHARACTER_NAMES).length === 4,
    Object.keys(CHARACTER_NAMES).join(','));
  const omitted = runOne({ character: 'supreme', seconds: 30, policy: 'random', useSkill: true, profile, seed: 1, draw: false, quiet: true });
  const idle = run('supreme', 'none', 30);
  check('不传 move 与 move=none 结果同量级（差 < 30%）',
    Math.abs(omitted.kills - idle.kills) <= Math.max(3, idle.kills * 0.3),
    `omitted=${omitted.kills} none=${idle.kills}`);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
