// =============================================================================
// 粽子手雷长按瞄准回归（方案见 reports/角色技能/47-粽子手雷长按抛物线方案.md）
//
// 长按 180ms → 0.1x；拖动 1.2 → 落点（90~420px）；28px 吸附 / 40px 滞回；
// 松手投掷到落点；回拖 20px / 拖出 1.5×所需行程取消；轻点快速投掷。
//
// 运行：node tools/grenade-aim.test.mjs
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
const context = vm.createContext(sandbox, { name: 'grenade-aim-test' });
vm.runInContext(SOURCE, context, { filename: 'game.js' });
const bridge = vm.runInContext(`(function(){ return {
  get game(){ return game; }, get screen(){ return screen; }, set screen(v){ screen = v; },
  get profile(){ return profile; }, get balance(){ return balance; },
  get width(){ return width; }, get height(){ return height; },
  get viewInsets(){ return viewInsets; },
  setClock: function (v) { Date.now = function () { return v | 0; }; },
  setCharacter: function(id){ profile.character = id; },
  startGame: startGame, updateGame: updateGame, draw: draw,
  skillButtonBounds: skillButtonBounds,
  grenadeLandingPoint: grenadeLandingPoint, grenadeAimPointer: grenadeAimPointer,
  updateGrenadeAimTarget: updateGrenadeAimTarget,
  releaseGrenadeAim: releaseGrenadeAim, throwGrenadeAt: throwGrenadeAt,
  worldToScreen: worldToScreen, enemyVisualCenter: enemyVisualCenter, gameWorldZoom: gameWorldZoom,
}; })()`, context, { filename: 'grenade-aim-bridge.js' });
stub.flushImageLoads();

const BASE_CLOCK = 1_000_000_000;
const world = () => {
  bridge.setCharacter('rabbit');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.setClock(BASE_CLOCK);
  bridge.game.enemies = [];
  bridge.game.spawnTimer = 999;
  return bridge.game;
};
const skill = () => bridge.skillButtonBounds();
const press = () => { const b = skill(); stub.touch.start({ identifier: 81, clientX: b.x, clientY: b.y }); };
const drag = (dx, dy) => { const b = skill(); stub.touch.move({ identifier: 81, clientX: b.x + dx, clientY: b.y + dy }); };
const release = (dx, dy) => { const b = skill(); stub.touch.end({ identifier: 81, clientX: b.x + dx, clientY: b.y + dy }); };
const enterAim = (game) => {
  press();
  bridge.setClock(BASE_CLOCK + 200);
  bridge.updateGame(0.01);
  return game;
};
const makeEnemy = (x, y, extra = {}) => ({
  x, y, radius: 14, health: 500, maxHealth: 500, type: 'basic', weight: 1,
  experience: 0, damage: 1, speed: 0, boss: false, eventSerial: 0,
  hitFlash: 0, dying: 0, lastHitCritical: false, stun: 0, stunFlash: 0, stagger: 0,
  ...extra,
});
const placeEnemyAtScreen = (game, sx, sy) => {
  const screenPoint = bridge.worldToScreen(game.player.x, game.player.y);
  const dx = (sx - screenPoint.x) / bridge.gameWorldZoom;
  const dy = (sy - screenPoint.y) / bridge.gameWorldZoom;
  const enemy = makeEnemy(game.player.x + dx, game.player.y + dy);
  game.enemies.push(enemy);
  return enemy;
};
const screenDistance = (game, point) => {
  const a = bridge.worldToScreen(game.player.x, game.player.y);
  const b = bridge.worldToScreen(point.x, point.y);
  return Math.hypot(b.x - a.x, b.y - a.y);
};

// ---------------------------------------------------------------------------
console.log('\n【1】轻点：快速投掷，不进时缓');
{
  const game = world();
  game.grenadeCooldown = 0;
  game.enemies = [makeEnemy(game.player.x + 150, game.player.y)];
  press();
  bridge.setClock(BASE_CLOCK + 100);
  release(0, 0);
  check('轻点直接投掷', game.grenades.length === 1, String(game.grenades.length));
  check('没有进入瞄准', game.aimActive === false);
}

// ---------------------------------------------------------------------------
console.log('\n【2】长按 200ms：进入 0.1x');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  check('进入瞄准', game.aimActive === true);
  const before = game.elapsed;
  bridge.updateGame(0.1);
  check('世界 delta ×0.1', Math.abs((game.elapsed - before) - 0.01) < 1e-6, (game.elapsed - before).toFixed(4));
}

// ---------------------------------------------------------------------------
console.log('\n【3】拖动 1.2 映射落点距离');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(0, -100);
  bridge.updateGrenadeAimTarget();
  const landing = bridge.grenadeLandingPoint();
  check('拖 100px → 落点 120px', Math.abs(screenDistance(game, landing) - 120) < 2, screenDistance(game, landing).toFixed(1));
}

// ---------------------------------------------------------------------------
console.log('\n【4】落点夹取：最小 90 / 屏幕安全区（420 是上限）');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(0, -20);
  bridge.updateGrenadeAimTarget();
  const near = bridge.grenadeLandingPoint();
  check('拖 20px → 落点 90px', Math.abs(screenDistance(game, near) - 90) < 2, screenDistance(game, near).toFixed(1));
  drag(0, -500);
  bridge.updateGrenadeAimTarget();
  const far = bridge.grenadeLandingPoint();
  check('拖 500px → 落点夹在屏幕安全区（≤420）', screenDistance(game, far) <= 420 && screenDistance(game, far) > 200, screenDistance(game, far).toFixed(1));
}

// ---------------------------------------------------------------------------
console.log('\n【5】落点夹在屏幕安全区');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(500, -500);
  bridge.updateGrenadeAimTarget();
  const landing = bridge.grenadeLandingPoint();
  const screenPoint = bridge.worldToScreen(landing.x, landing.y);
  check('落点在屏幕安全区内',
    screenPoint.x >= 39 && screenPoint.x <= bridge.width - 39
    && screenPoint.y >= bridge.viewInsets.top + 89 && screenPoint.y <= bridge.height - bridge.viewInsets.bottom - 59,
    `${screenPoint.x.toFixed(0)},${screenPoint.y.toFixed(0)}`);
}

// ---------------------------------------------------------------------------
console.log('\n【6】锁定：28px 吸附、40px 滞回');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(0, -150);
  bridge.updateGrenadeAimTarget();
  const pointer = bridge.grenadeAimPointer();
  const pointerScreen = bridge.worldToScreen(pointer.x, pointer.y);
  const target = placeEnemyAtScreen(game, pointerScreen.x, pointerScreen.y - 4);
  bridge.updateGrenadeAimTarget();
  check('落点圈覆盖敌人 → 锁定', game.grenadeAimTarget === target);
  const locked = bridge.grenadeLandingPoint();
  check('锁定后落点 = 敌人位置',
    Math.abs(locked.x - target.x) < 1e-6 && Math.abs(locked.y - target.y) < 1e-6);
  drag(0, -190);
  bridge.updateGrenadeAimTarget();
  check('移开 30px 仍锁定', game.grenadeAimTarget === target);
  drag(120, -260);
  bridge.updateGrenadeAimTarget();
  check('移开 40px 以上解锁', game.grenadeAimTarget === null);
}

// ---------------------------------------------------------------------------
console.log('\n【7】松手：粽子落点 = 预览落点');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(0, -100);
  bridge.updateGrenadeAimTarget();
  const landing = bridge.grenadeLandingPoint();
  release(0, -100);
  check('粽子已投出', game.grenades.length === 1, String(game.grenades.length));
  if (game.grenades.length) {
    const grenade = game.grenades[0];
    check('落点与预览一致', Math.abs(grenade.x - landing.x) < 1 && Math.abs(grenade.y - landing.y) < 1,
      `${Math.hypot(grenade.x - landing.x, grenade.y - landing.y).toFixed(2)}px`);
    check('飞行时长随距离 0.42~0.70s', grenade.duration >= 0.42 && grenade.duration <= 0.75, grenade.duration.toFixed(2));
    check('弧高随距离 84~137px', grenade.arcHeight >= 80 && grenade.arcHeight <= 140, (grenade.arcHeight || 0).toFixed(0));
  }
}

// ---------------------------------------------------------------------------
console.log('\n【8】取消：回拖 20px / 超距 1.5 倍，不消耗冷却');
{
  const game = world();
  game.grenadeCooldown = 0;
  enterAim(game);
  drag(8, 0);
  release(8, 0);
  check('回拖 20px 内 = 取消', game.aimActive === false && game.grenades.length === 0 && game.grenadeCooldown === 0);

  const game2 = world();
  game2.grenadeCooldown = 0;
  enterAim(game2);
  drag(0, -560);   // need = 420/1.2 = 350；1.5× = 525
  bridge.updateGrenadeAimTarget();
  check('拖出 1.5×所需行程 → 超距', game2.grenadeAimOverdrag === true);
  release(0, -560);
  check('超距松手 = 取消，不耗冷却',
    game2.aimActive === false && game2.grenades.length === 0 && game2.grenadeCooldown === 0);
}

// ---------------------------------------------------------------------------
console.log('\n【9】爆炸伤害/眩晕不变');
{
  const game = world();
  game.grenadeCooldown = 0;
  const target = makeEnemy(game.player.x + 120, game.player.y);
  game.enemies = [target];
  bridge.throwGrenadeAt(target.x, target.y);
  let elapsed = 0;
  while (game.grenades.length && elapsed < 2) { bridge.updateGame(0.05); elapsed += 0.05; }
  check('手雷在落点爆炸并造成伤害', target.health < 500, String(target.health));
  check('伤害接近 30% 生命比例', Math.abs((500 - target.health) - 150) < 30, String(500 - target.health));
  check('目标被眩晕', target.stun > 0, (target.stun || 0).toFixed(2));
}

// ---------------------------------------------------------------------------
console.log('\n【10】其他角色 / 绘制');
{
  const game = world();
  bridge.setCharacter('daxia');
  bridge.startGame();
  bridge.screen = 'game';
  bridge.game.enemies = [];
  check('大侠没有手雷瞄准态', bridge.game.aimActive === false);
  bridge.draw();
  check('绘制不抛', true);
}

console.log(`\n  合计：${pass} 项通过${fail ? `，${fail} 项失败` : '，全部通过'}`);
process.exit(fail ? 1 : 0);
