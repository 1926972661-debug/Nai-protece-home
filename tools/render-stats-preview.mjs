// 把「角色面板」的真实布局数据导成 JSON，供 render-stats-preview.py 画出示意稿。
//
// 关键点：坐标不是在这里手抄的，而是调用 game.js 里的 statsPanel / statsSlotBounds /
// statsRowBounds / statRows 得到的，所以示意图与线上位置一致（差别只有字体渲染引擎）。
//
// 运行：node tools/render-stats-preview.mjs > %TEMP%/stats-panel.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installStub, DEFAULT_SYSTEM } from '../团队工作区/outbox/D5-无头仿真室/第1轮/sim/wx-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE = readFileSync(join(ROOT, 'game.js'), 'utf8');

const sandbox = {};
const stub = installStub(sandbox, { root: ROOT, assetDir: join(ROOT, 'assets'), system: { ...DEFAULT_SYSTEM } });
const context = vm.createContext(sandbox, { name: 'stats-preview' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get profile(){ return profile; }, startGame: startGame,
  setCharacter: function(id){ profile.character = id; },
  statsPanel: statsPanel, statsSlotBounds: statsSlotBounds, statsRowBounds: statsRowBounds,
  bottomBar: function(){ return statsPanel().y + statsPanel().height - 60; },
  statRows: statRows, equipmentSlots: equipmentSlots, backButtonBounds: backButtonBounds,
}; })()`, context, { filename: 'stats-preview-bridge.js' });
stub.flushImageLoads();

bridge.setCharacter('daxia');
bridge.startGame();
const game = bridge.game;
// 造一局中期的状态：等级、血、一堆技能
game.level = 9;
game.health = game.maxHealth * 0.68;
game.baseAttack = 42;
game.bonusAttack = 18;
game.swordDamage = 9;
game.knockback = 3;
game.moveSpeed = 128;
game.critChance = 0.22;
game.critMultiplier = 2;
game.bestCombo = 41;
game.kills = 187;
game.experience = 12;
game.experienceNeeded = 30;
game.seedsEarned = 34;
game.wave = 4;
game.waveKills = 13;
game.waveGoal = 20;
// 存档里的展示值也给成「像玩过几局」的数，空账号画出来 0 金币 0 秒没有说服力
bridge.profile.coins = 1240;
bridge.profile.bestTime = 214;
bridge.profile.bestKills = 186;
game.swordWaveCount = 5;
game.swordJiScale = 1.6;
game.upgradeLog.push(
  { title: '月牙刀光', rarity: 'blue', evolution: false },
  { title: '月牙刀光', rarity: 'blue', evolution: false },
  { title: '三刀流', rarity: 'gold', evolution: false },
  { title: '余劲不散', rarity: 'purple', evolution: false },
  { title: '武器进化：三途刀', rarity: 'gold', evolution: true },
);

const panel = bridge.statsPanel();
const rows = bridge.statRows();
const payload = {
  screen: { width: 375, height: 667 },
  panel,
  rows: rows.map((row, index) => ({ ...row, rect: bridge.statsRowBounds(index, rows.length) })),
  rowsPerColumn: Math.ceil(rows.length / 2),
  slots: Array.from({ length: 8 }, (_, index) => {
    const slot = bridge.equipmentSlots()[index] || null;
    return { rect: bridge.statsSlotBounds(index), slot };
  }),
  back: bridge.backButtonBounds(panel),
  progress: { y: bridge.bottomBar(), ratio: game.waveKills / game.waveGoal, label: `第 ${game.wave} 波 · 击杀 ${game.waveKills}/${game.waveGoal} · ${Math.round(game.waveKills / game.waveGoal * 100)}%` },
  character: { name: '奶大侠', style: '月牙刀光', level: game.level },
};
const target = process.env.STATS_PREVIEW_OUT
  || join(process.env.TEMP || '/tmp', 'stats-panel.json');
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(target);
