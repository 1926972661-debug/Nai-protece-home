// 成长曲线审计：每秒采样「玩家有效生命 / 承受伤害速率 / 敌人压力」，用来看难度曲线
// 到底是哪一侧失衡（玩家变太肉，还是敌人压力不够）。
//
// 为什么不用现成的 run.mjs：它只给终局快照（kills/level/health），说明不了「第 40 秒发生了什么」。
// 这个脚本只读 game 状态，不改任何数值，输出直接可以贴进报告。
//
// 运行：
//   node tools/growth-audit.mjs --character daxia --seconds 300 --seed 1
//   node tools/growth-audit.mjs --character daxia --seed 1 --csv  （只出 CSV 行）
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installStub, DEFAULT_SYSTEM } from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE = readFileSync(join(ROOT, 'game.js'), 'utf8');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const CHARACTER = arg('character', 'daxia');
const SECONDS = Number(arg('seconds', '300'));
const SEED = Number(arg('seed', '1'));
const CSV = process.argv.includes('--csv');
const PROFILE = arg('profile', 'garden10plants');

// 用种子替换 Math.random，保证同一 seed 每次跑的曲线一致
const sandbox = {};
const stub = installStub(sandbox, {
  root: ROOT,
  assetDir: join(ROOT, 'assets'),
  system: { ...DEFAULT_SYSTEM },
  profile: PROFILE,
});
const context = vm.createContext(sandbox, { name: 'growth-audit' });
vm.runInContext(`(function(){ let s = ${SEED}; Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`, context);
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, get profile(){ return profile; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame,
}; })()`, context, { filename: 'growth-bridge.js' });
stub.flushImageLoads();

bridge.setCharacter(CHARACTER);
bridge.startGame();

const dt = 1 / 60;
const totalFrames = Math.round(SECONDS * 60);
let previousHealth = bridge.game.health;
let damageSecond = 0;
const rows = [];

for (let frame = 0; frame < totalFrames; frame += 1) {
  const game = bridge.game;
  bridge.updateGame(dt);
  if (game.health < previousHealth) damageSecond += previousHealth - game.health;
  previousHealth = game.health;

  if ((frame + 1) % 60 === 0) {
    rows.push({
      t: Math.round(game.elapsed),
      hp: Math.round(game.health),
      maxHp: Math.round(game.maxHealth),
      dmg: Math.round(damageSecond),
      enemies: game.enemies.length,
      level: game.level,
      gold: game.goldPicks,
      red: game.redPicks,
      kills: game.kills,
      attack: Math.round(game.baseAttack + game.bonusAttack
        + (game.character === 'rabbit' ? game.bulletDamage : game.character === 'daxia' ? game.swordDamage : game.character === 'xiaoxian' ? game.umbrellaDamage : 0)),
      wave: game.wave,
    });
    damageSecond = 0;
  }
  if (bridge.screen === 'result') break;
}

const last = rows[rows.length - 1] || {};
const summary = {
  character: CHARACTER,
  seed: SEED,
  endedAt: last.t,
  outcome: bridge.screen === 'result' ? (bridge.game.resultWon ? 'won' : 'died') : 'survived',
  finalLevel: last.level,
  finalMaxHp: last.maxHp,
  finalAttack: last.attack,
  goldPicks: last.gold,
  redPicks: last.red,
  // 最近 30 秒承受伤害的均值（每秒）
  lateIncomingDps: (() => {
    const tail = rows.slice(-30);
    if (!tail.length) return 0;
    return Math.round(tail.reduce((sum, row) => sum + row.dmg, 0) / tail.length);
  })(),
  peakIncomingDps: Math.max.apply(null, rows.map((row) => row.dmg).concat([0])),
  peakEnemies: Math.max.apply(null, rows.map((row) => row.enemies).concat([0])),
};

if (CSV) {
  console.log('t,hp,maxHp,dmg,enemies,level,gold,red,kills,attack,wave');
  rows.forEach((row) => console.log([row.t, row.hp, row.maxHp, row.dmg, row.enemies, row.level, row.gold, row.red, row.kills, row.attack, row.wave].join(',')));
} else {
  console.log(`成长审计 · ${CHARACTER} · seed ${SEED} · ${SECONDS}s 上限`);
  console.log('  t    HP/上限     承伤/s  同屏  等级  金/红  击杀  攻击  波');
  rows.filter((row, index) => index % 10 === 0 || index === rows.length - 1).forEach((row) => {
    console.log(`  ${String(row.t).padStart(3)}  ${String(row.hp).padStart(4)}/${String(row.maxHp).padEnd(5)}  ${String(row.dmg).padStart(5)}  ${String(row.enemies).padStart(4)}  ${String(row.level).padStart(4)}  ${row.gold}/${row.red}    ${String(row.kills).padStart(3)}  ${String(row.attack).padStart(3)}  ${row.wave}`);
  });
  console.log('\n  结论：' + JSON.stringify(summary));
}
