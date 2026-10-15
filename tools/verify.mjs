#!/usr/bin/env node
/**
 * 《小院清理队》静态校验脚本 —— D4 工程质量室 第1轮产出
 *
 * 用途：把 README.md 里承诺的工程纪律变成可执行断言（README:99、README:120-125）。
 *
 * 铁律约束（见任务书）：
 *   - 纯静态：只用 node:fs 读源码文本，**不 require / 不 import game.js**
 *     （game.js:1 直接调用 wx.createCanvas()，任何执行都会崩）。
 *   - 零依赖：只用 Node 内置模块。
 *   - 退出码只由「真失败 FAIL」决定：0 = 无 FAIL，1 = 至少一条 FAIL。
 *     INFO 是信息性告警，**不影响退出码**。
 *
 * 运行：
 *   node 团队工作区/outbox/D4-工程质量/第1轮/03-校验脚本/verify.mjs
 *   node .../verify.mjs --project "D:\小院清理队"   # 指定项目根（默认由本文件位置推导）
 *   node .../verify.mjs --json                     # 额外输出 JSON 结果
 *
 * 断言：
 *   A1 技能稀有度「主效果＝固定攻击力」阶梯不倒挂 + 注释/README 声明的数值与实际一致
 *   A2 balance 表同一层级无重复键（JS 静默后者覆盖前者）
 *   A3 上限常量在声明处与使用处一致，无第二份硬编码
 *   A4 enemies.push( 只出现在白名单函数内，且调用链受 enemyCapacity() 约束
 *   A5 assets/ 与 game.js 引用双向一致
 *
 * 判据纪律（第2版修正，避免假阳性）：
 *   - 「裸数字」类断言必须同行出现容量相关标识符，纯数值巧合不算。
 *   - 「封顶兜底」加成（撞上限后才给的那部分）不计入稀有度阶梯 —— 见 README:100。
 *   - README/注释的数值声明与实际数据不一致 = INFO，不是 FAIL（README 是设计日志）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
// 本文件位于 <项目根>/tools/ ，所以项目根就是它的上一级。
// （原先在 团队工作区/outbox/.../03-校验脚本/ 下，需上溯 5 层；搬到 tools/ 后必须改成 1 层，
//   否则默认根会静默解析成 D:\ 而找不到 game.js。）
const PROJECT_ROOT = path.resolve(argOf('--project', path.resolve(HERE, '..')));
const GAME_PATH = path.resolve(argOf('--source', path.join(PROJECT_ROOT, 'game.js')));
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');

if (!fs.existsSync(GAME_PATH)) {
  console.error(`[致命] 找不到 game.js：${GAME_PATH}`);
  console.error('       用 --project "<项目根>" 指定正确路径。');
  process.exit(1);
}

const source = fs.readFileSync(GAME_PATH, 'utf8');
const lines = source.split(/\r?\n/);             // lines[0] = game.js 第 1 行
const lineAt = (n) => (lines[n - 1] ?? '');
const snippet = (n, max = 160) => {
  const text = lineAt(n).trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const C = { red: '\u001b[31m', green: '\u001b[32m', yellow: '\u001b[33m', dim: '\u001b[2m', reset: '\u001b[0m' };
const results = [];
let failCount = 0;
let infoCount = 0;

function fail(name, detail) {
  results.push({ name, level: 'FAIL' });
  failCount += 1;
  console.log(`${C.red}FAIL${C.reset}  ${name}`);
  if (detail) console.log(detail.split('\n').map((l) => `      ${l}`).join('\n'));
}
function pass(name, detail) {
  results.push({ name, level: 'PASS' });
  console.log(`${C.green}PASS${C.reset}  ${name}`);
  if (detail) console.log(detail.split('\n').map((l) => `      ${l}`).join('\n'));
}
function info(title, detail) {
  infoCount += 1;
  console.log(`${C.yellow}INFO${C.reset}  ${title}`);
  if (detail) console.log(detail.split('\n').map((l) => `      ${l}`).join('\n'));
}
const assertion = (name, ok, detail) => (ok ? pass(name, detail) : fail(name, detail));
const note = (text) => console.log(`      ${text}`);
const section = (title) => console.log(`\n=== ${title} ===`);

/** 从 `from`（一个 { 或 [ 字符）配平到结束，跳过字符串与注释 */
function matchBracket(from, open = '{', close = '}') {
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    const c = source[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i += 1;
      while (i < source.length && source[i] !== quote) { if (source[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i += 1; continue; }
    if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i) + 1; continue; }
    if (c === open) depth += 1;
    else if (c === close) { depth -= 1; if (depth === 0) return { start: from, end: i }; }
  }
  return { start: from, end: source.length - 1 };
}

const lineOfIndex = (() => {
  const offsets = [0];
  for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') offsets.push(i + 1);
  return (index) => {
    let lo = 0; let hi = offsets.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= index) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
})();

function findArrayLiteral(name) {
  const re = new RegExp(`^const\\s+${name}\\s*=\\s*\\[`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const start = source.indexOf('[', m.index);
  const { end } = matchBracket(start, '[', ']');
  return { start, end, startLine: lineOfIndex(start), endLine: lineOfIndex(end) };
}

function findObjectLiteral(name) {
  const re = new RegExp(`^const\\s+${name}\\s*=\\s*\\{`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const start = source.indexOf('{', m.index);
  const { end } = matchBracket(start);
  return { start, end, startLine: lineOfIndex(start), endLine: lineOfIndex(end) };
}

function splitTopLevelElements(arrayLiteral) {
  const out = [];
  let i = arrayLiteral.start + 1;
  while (i < arrayLiteral.end) {
    if (source[i] === '{') {
      const { end } = matchBracket(i);
      out.push({ start: i, end, line: lineOfIndex(i) });
      i = end + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/** 取对象字面量里某个键的「原始值文本 + 绝对行号 + 绝对下标」 */
function rawValue(literal, key) {
  const body = source.slice(literal.start + 1, literal.end);
  const re = new RegExp(`(?:^|[,{\\s])${key}\\s*:\\s*`, 'g');
  const m = re.exec(body);
  if (!m) return null;
  const valueStart = m.index + m[0].length;
  let depth = 0;
  let i = valueStart;
  for (; i < body.length; i += 1) {
    const c = body[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i += 1;
      while (i < body.length && body[i] !== q) { if (body[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth -= 1; }
    else if (c === ',' && depth === 0) break;
  }
  const absIndex = literal.start + 1 + valueStart;
  return { text: body.slice(valueStart, i), absLine: lineOfIndex(absIndex), index: absIndex };
}

/** 取 `apply: () => { ... }` 的函数体文本（含花括号） */
function applyBody(literal) {
  const raw = rawValue(literal, 'apply');
  if (!raw) return '';
  const braceRel = raw.text.indexOf('{');
  if (braceRel < 0) return raw.text;
  const absolute = raw.index + braceRel;
  const { end } = matchBracket(absolute);
  return source.slice(absolute, end + 1);
}

/**
 * 解析 apply 函数体里的标量加成，并区分「主加成」与「封顶兜底加成」。
 *
 * 兜底判据（任一成立即为兜底）：
 *   1. 该语句被 `if (!addCapped(...))` / `if (next < ... - 1e-9)` 之类条件包住
 *      ——包括单行 `if (...) stmt;` 与 `if (...) { stmt; }` 两种写法；
 *   2. 描述文本里出现「已到上限 / 已到下限 / 封顶 / 叠满后 / 双双击顶 / 封顶后」。
 */
function scalarBonuses(body) {
  const found = [];
  const re = /game\.([A-Za-z_$][\w$]*)\s*\+=\s*(-?\d+(?:\.\d+)?)\b/g;
  let m;
  while ((m = re.exec(body))) {
    const stmtStart = Math.max(body.lastIndexOf(';', m.index - 1), body.lastIndexOf('{', m.index - 1)) + 1;
    const before = body.slice(stmtStart, m.index);
    const conditional = /^\s*if\s*\(/.test(before);
    const capPattern = /addCapped\(|\+\s*1e-9|-\s*1e-9/.test(before);
    found.push({
      field: m[1],
      amount: Number(m[2]),
      fallback: conditional || capPattern,
      statement: before.trim().slice(0, 90),
    });
  }
  return found;
}
const FALLBACK_WORDS = /已到上限|已到下限|已满|封顶|叠满后|转为|改为/;

// ---------------------------------------------------------------------------
// A1 技能稀有度攻击力阶梯（技能表从源码解析）
// ---------------------------------------------------------------------------

section('A1 技能稀有度「主效果＝固定攻击力」阶梯（README:99）');

const POOLS = ['upgrades', 'rabbitUpgrades', 'daxiaUpgrades', 'xiaoxianUpgrades'];
const skills = [];
let parseProblems = 0;

for (const poolName of POOLS) {
  const literal = findArrayLiteral(poolName);
  if (!literal) { parseProblems += 1; note(`[解析失败] 找不到数组 ${poolName}`); continue; }
  for (const element of splitTopLevelElements(literal)) {
    const title = rawValue(element, 'title');
    const rarity = rawValue(element, 'rarity');
    if (!title || !rarity) continue;
    const description = rawValue(element, 'description');
    const descriptionText = description ? description.text : '';
    const bonuses = scalarBonuses(applyBody(element)).map((b) => ({
      ...b,
      // 描述里写明是撞上限后的兜底 → 也归入兜底
      fallback: b.fallback || (FALLBACK_WORDS.test(descriptionText) && /上限|封顶|已满/.test(descriptionText)),
    }));
    const attack = bonuses.filter((b) => b.field === 'bonusAttack');
    skills.push({
      pool: poolName,
      title: title.text.replace(/^['"]|['"]$/g, ''),
      rarity: rarity.text.replace(/^['"]|['"]$/g, ''),
      line: element.line,
      attack,
    });
  }
}
const unique = [...new Map(skills.map((s) => [`${s.rarity}|${s.title}`, s])).values()];

// 「主效果＝固定攻击力」的严格定义：apply 里第一句就是无条件、非兜底的 bonusAttack 加成
const mainAttackSkills = [];
const fallbackAttackSkills = [];
for (const s of unique) {
  const first = s.attack[0];
  if (!first) continue;
  if (!first.fallback) mainAttackSkills.push({ ...s, mainAmount: first.amount });
  const fb = s.attack.filter((b) => b.fallback).reduce((sum, b) => sum + b.amount, 0);
  if (fb > 0) fallbackAttackSkills.push({ ...s, fallbackAmount: fb });
}

assertion('A1.0 技能表解析非空（解析失败说明源码结构已变，脚本需同步）',
  parseProblems === 0 && unique.length >= 40 && mainAttackSkills.length >= 4,
  `解析到技能对象 ${skills.length} 条（去重 ${unique.length}），其中「主效果＝固定攻击力」${mainAttackSkills.length} 条；解析失败池 ${parseProblems} 个`);

note('主效果即固定攻击力的技能（参与阶梯断言）：');
for (const r of ['white', 'blue', 'purple', 'gold', 'red']) {
  const rows = mainAttackSkills.filter((s) => s.rarity === r);
  if (rows.length) note(`  ${r.padEnd(7)}${rows.map((s) => `${s.title} +${s.mainAmount}(game.js:${s.line})`).join('、')}`);
}

const ORDER = ['white', 'blue', 'purple', 'gold', 'red'];
const amountsOf = (r) => mainAttackSkills.filter((s) => s.rarity === r).map((s) => s.mainAmount);
const maxOf = (r) => Math.max(0, ...amountsOf(r));
const minOf = (r) => (amountsOf(r).length ? Math.min(...amountsOf(r)) : null);
note('实测阶梯：' + ORDER.map((r) => `${r} ${minOf(r) === null ? '—' : `+${minOf(r)}~${maxOf(r)}`}`).join('  <  '));

const inversions = [];
for (let i = 0; i < ORDER.length; i += 1) {
  for (let j = i + 1; j < ORDER.length; j += 1) {
    const low = maxOf(ORDER[i]);
    const high = minOf(ORDER[j]);
    if (low && high && low > high) {
      const worst = mainAttackSkills.filter((s) => s.rarity === ORDER[i] && s.mainAmount === low).map((s) => `${s.title} game.js:${s.line} +${low}`).join('、');
      const best = mainAttackSkills.filter((s) => s.rarity === ORDER[j] && s.mainAmount === high).map((s) => `${s.title} game.js:${s.line} +${high}`).join('、');
      inversions.push(`${ORDER[i]} 最高（${worst}）> ${ORDER[j]} 最低（${best}）`);
    }
  }
}
assertion('A1.1 主效果攻击力不存在稀有度倒挂（低稀有度上限 ≤ 更高稀有度下限）',
  inversions.length === 0,
  inversions.length ? inversions.join('\n') : '白 ≤ 蓝 ≤ 金 ≤ 红，阶梯成立、不倒挂');

info('封顶兜底攻击力（不计入阶梯，见 README:100）',
  fallbackAttackSkills.length
    ? fallbackAttackSkills.map((s) => `game.js:${s.line} ${s.title}（${s.rarity}）兜底 +${s.fallbackAmount}`).join('\n')
    : '无');

// README:99 声明的逐档区间 vs 实际主效果数据
{
  const README_CLAIM = { white: [2, 2], blue: [3, 4], gold: [5, 7] };
  const off = mainAttackSkills.filter((s) => README_CLAIM[s.rarity]
    && (s.mainAmount < README_CLAIM[s.rarity][0] || s.mainAmount > README_CLAIM[s.rarity][1]));
  const actual = ORDER.filter((r) => minOf(r) !== null).map((r) => `${r} +${minOf(r)}${minOf(r) === maxOf(r) ? '' : `~${maxOf(r)}`}`).join(' / ');
  if (off.length === 0) {
    pass('A1.2 实际攻击力阶梯与 README:99 声明的区间一致', `实际 ${actual} 与 README:99 一致`);
  } else {
    // README 是设计日志：它自身也自相矛盾（README:18 写「攻击力 +8」，README:50 写「攻击 +8」），
    // 所以「文档与代码不符」按信息项处理；真正的阶梯不变式由 A1.1 把关。
    info('实际攻击力阶梯与 README:99 声明的区间不一致（文档 vs 代码）',
      `实际：${actual}\nREADME:99 声明：白 +2 / 蓝 +3~4 / 金 +5~7\n`
      + off.map((s) => `  game.js:${s.line} ${s.title}（${s.rarity}）实际 +${s.mainAmount}`).join('\n')
      + '\n注：README 内部亦不自洽 —— README:18 写「攻击力 +8」、README:50 写「攻击 +8」，与 README:99 的「金 +5~7」互相矛盾。');
  }
}

// 代码注释里声明的阶梯 vs 实际数据（game.js:436-440）
// 注意：该处是 `//` 行注释块，**没有** `*/` 终止符，所以按「起始短语 → 下一个 const」取区间。
{
  const start = source.indexOf('Rarity budget for flat attack');
  const end = start >= 0 ? source.indexOf('const upgrades', start) : -1;
  if (start < 0 || end < 0) {
    info('未找到 game.js:436-440 的阶梯注释', '注释可能已被改写，跳过注释一致性核对');
  } else {
    const commentText = source.slice(start, end);
    const commentLine = lineOfIndex(start);
    const claimed = {};
    const re = /(white|blue|purple|gold|red)\s*\+\s*(\d+)/g;
    let c;
    while ((c = re.exec(commentText))) claimed[c[1]] = Number(c[2]);
    const mismatch = [];
    for (const [r, value] of Object.entries(claimed)) {
      const actualMin = minOf(r);
      const actualMax = maxOf(r);
      if (actualMin === null) continue;
      if (actualMin !== value || actualMax !== value) {
        mismatch.push(`注释声明 ${r} +${value}，实际主效果 ${r} ${actualMin === actualMax ? `+${actualMin}` : `+${actualMin}~${actualMax}`}`);
      }
    }
    const declaredText = Object.entries(claimed).map(([r, v]) => `${r} +${v}`).join(' / ');
    assertion(`A1.3 game.js:${commentLine} 注释声明的攻击力阶梯与实际数据一致`,
      mismatch.length === 0 && Object.keys(claimed).length >= 3,
      mismatch.length
        ? `注释（game.js:${commentLine}-${lineOfIndex(end - 1)}）：${declaredText}\n`
          + `实际数据：${ORDER.filter((r) => minOf(r) !== null).map((r) => `${r} +${minOf(r)}`).join(' / ')}\n`
          + mismatch.map((x) => `  ${x}`).join('\n')
          + `\n原文：${snippet(commentLine)}`
        : `注释与实际一致（${declaredText}）`);
  }
}

// ---------------------------------------------------------------------------
// A2 balance 表无重复键
// ---------------------------------------------------------------------------

section('A2 balance 表同一层级无重复键（game.js:120-406）');

const balanceLiteral = findObjectLiteral('balance');
if (!balanceLiteral) {
  assertion('A2.1 balance 表可定位', false, '找不到 const balance = { ... }');
} else {
  note(`定位：game.js:${lineOfIndex(balanceLiteral.start)}-${lineOfIndex(balanceLiteral.end)}`);
  const keys = [];
  {
    let depth = 0;
    let i = balanceLiteral.start;
    while (i <= balanceLiteral.end) {
      const c = source[i];
      if (c === "'" || c === '"' || c === '`') {
        const q = c; i += 1;
        while (i <= balanceLiteral.end && source[i] !== q) { if (source[i] === '\\') i += 1; i += 1; }
        i += 1; continue;
      }
      if (c === '/' && source[i + 1] === '/') { while (i <= balanceLiteral.end && source[i] !== '\n') i += 1; continue; }
      if (c === '{' || c === '[' || c === '(') { depth += 1; i += 1; continue; }
      if (c === '}' || c === ']' || c === ')') { depth -= 1; i += 1; continue; }
      if (depth === 1 && /[\s,]/.test(source[i - 1] ?? '')) {
        const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(source.slice(i, i + 60));
        if (m) { keys.push({ key: m[1], line: lineOfIndex(i) }); i += m[0].length; continue; }
      }
      i += 1;
    }
  }
  const seen = new Map();
  const dupes = [];
  for (const k of keys) {
    if (seen.has(k.key)) dupes.push(`键 "${k.key}" 在 game.js:${seen.get(k.key)} 与 game.js:${k.line} 重复声明（后者静默覆盖前者）\n    ${snippet(k.line)}`);
    else seen.set(k.key, k.line);
  }
  assertion(`A2.1 balance 顶层键无重复（共解析到 ${seen.size} 个键）`,
    dupes.length === 0 && seen.size > 100,
    dupes.length ? dupes.join('\n') : `无重复键（${seen.size} 个）`);
}

// ---------------------------------------------------------------------------
// A3 上限常量一致性
// ---------------------------------------------------------------------------

section('A3 上限常量：声明处与使用处一致，无第二份硬编码');

const usesOf = (expr) => lines.reduce((acc, text, idx) => (new RegExp(expr).test(text) ? [...acc, idx + 1] : acc), []);
const capacityFnStart = lines.findIndex((t) => /^function enemyCapacity\s*\(/.test(t)) + 1;   // 1-based
const capacityFnEnd = (() => {
  if (!capacityFnStart) return -1;
  let depth = 0;
  for (let n = capacityFnStart; n <= lines.length; n += 1) {
    for (const ch of lines[n - 1]) { if (ch === '{') depth += 1; else if (ch === '}') depth -= 1; }
    if (depth === 0 && n > capacityFnStart) return n;
  }
  return -1;
})();
note(`enemyCapacity() 定义于 game.js:${capacityFnStart}-${capacityFnEnd}`);

const capDetail = [];
for (const key of ['maxEnemiesOnScreen', 'maxEnemiesHardCap', 'eventEnemyReserve']) {
  const declared = balanceLiteral ? rawValue(balanceLiteral, key) : null;
  const allUses = usesOf(`balance\\.${key}\\b`);
  const usesInFn = allUses.filter((l) => l > capacityFnStart && l < capacityFnEnd);
  // 函数外的「只读」引用（例如 XP 衰减用 maxEnemiesOnScreen 当基准）不是第二份上限来源；
  // 真正危险的是函数外再次用它做容量判定/夹取。
  const outsideRaw = allUses.filter((l) => !(l > capacityFnStart && l < capacityFnEnd));
  const outsideWrites = outsideRaw.filter((l) => /(>=|<=|>\s*|<)\s*balance\.|`\$\{[^}]*balance\.|Math\.(min|max)\([^)]*balance\./.test(lineAt(l)));
  const outsideReads = outsideRaw.filter((l) => !outsideWrites.includes(l));
  capDetail.push(`${key} = ${declared ? declared.text.trim() : '?'}（声明 game.js:${declared ? declared.absLine : '?'}）`
    + `｜enemyCapacity() 内使用 game.js:${usesInFn.join(',') || '无'}`
    + `｜函数外只读 game.js:${outsideReads.join(',') || '无'}`
    + `｜函数外容量判定 game.js:${outsideWrites.join(',') || '无'}`);
  assertion(`A3.1 balance.${key} 只在 enemyCapacity() 内参与容量判定`,
    usesInFn.length >= 1 && outsideWrites.length === 0,
    outsideWrites.length
      ? outsideWrites.map((l) => `game.js:${l} 在 enemyCapacity() 之外用 balance.${key} 做容量判定\n    ${snippet(l)}`).join('\n')
      : `声明 game.js:${declared ? declared.absLine : '?'}；容量判定 game.js:${usesInFn.join(',')}（全在 enemyCapacity() 内）`
        + (outsideReads.length ? `；另有只读引用 game.js:${outsideReads.join(',')}（展示/换算，非第二份上限）` : ''));
}
note(capDetail.join('\n'));

// 裸数字形式的容量比较：必须同行出现容量语义标识符，纯数值巧合不算
const bareEnemyCaps = [];
lines.forEach((text, idx) => {
  const n = idx + 1;
  if (/^\s*(\/\/|\*)/.test(text)) return;
  const hasCapacityIdentifier = /capacity|maxEnemies|hardCap|reserve/i.test(text);
  const hasBareCompare = /(enemies|bullets|radialBullets)\.length\s*[<>]=?\s*\d+/.test(text);
  if (hasBareCompare && hasCapacityIdentifier) bareEnemyCaps.push(n);
});
assertion('A3.2 不存在裸数字形式的同屏容量比较（须同行出现 capacity/maxEnemies/hardCap/reserve）',
  bareEnemyCaps.length === 0,
  bareEnemyCaps.length
    ? bareEnemyCaps.map((l) => `game.js:${l}\n    ${snippet(l)}`).join('\n')
    : '全部走 enemyCapacity()；enemies.length < 2 这类循环保护按「无容量标识符」正确排除');

// gunCaps 死常量
{
  const gunCaps = findObjectLiteral('gunCaps');
  if (!gunCaps) assertion('A3.3 gunCaps 可定位', false, '找不到 const gunCaps = { ... }');
  else {
    const dead = [];
    const detail = [];
    for (const key of ['projectileSpeed', 'maxTrackingBullets', 'maxRadialBullets', 'maxRingBullets']) {
      const value = rawValue(gunCaps, key);
      const uses = usesOf(`gunCaps\\.${key}\\b`).filter((l) => l !== (value ? value.absLine : -1));
      detail.push(`gunCaps.${key} = ${value ? value.text.trim() : '?'}｜使用 game.js:${uses.join(',') || '无'}`);
      if (!uses.length) dead.push(`gunCaps.${key} 声明于 game.js:${value ? value.absLine : '?'} 但没有任何使用处`);
    }
    assertion('A3.3 gunCaps 每个上限都有使用处（无死常量）', dead.length === 0, dead.join('\n') || '4 个上限都有使用处');
    note(detail.join('\n'));
  }
}

// 上限取值不得在「容量语境」里以裸数字重复
{
  const suspects = [];
  for (const [label, value, declaredLine] of [['maxEnemiesHardCap', 56, -1], ['maxTrackingBullets', 22, -1], ['projectileSpeed', 640, -1]]) {
    lines.forEach((text, idx) => {
      const n = idx + 1;
      if (n === declaredLine || /^\s*(\/\/|\*)/.test(text)) return;
      const capacityContext = /capacity|maxEnemies|hardCap|bullet|projectile|radial/i.test(text);
      const bareUse = new RegExp(`(length\\s*[<>]=?\\s*${value}\\b|Math\\.(min|max)\\(\\s*${value}\\b)`).test(text);
      if (capacityContext && bareUse) suspects.push(`${label} 的取值 ${value} 在 game.js:${n} 以裸数字再次出现\n    ${snippet(n)}`);
    });
  }
  assertion('A3.4 上限取值未在容量语境里以裸数字重复（无第二份硬编码）',
    suspects.length === 0,
    suspects.length ? suspects.join('\n') : '未发现第二份硬编码（text.length <= 22 之类无容量语境的巧合已排除）');
}

// ---------------------------------------------------------------------------
// A4 单一实现：enemies.push( 白名单 + 调用链守卫
// ---------------------------------------------------------------------------

section('A4 单一实现：enemies.push( 的出现点（README:95）');

const WHITELIST = ['spawnEnemyAtEdge', 'spawnBoss', 'startRandomEvent'];
const functionRanges = (() => {
  const ranges = [];
  const re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(source))) {
    const braceIndex = source.indexOf('{', m.index);
    const { end } = matchBracket(braceIndex);
    ranges.push({ name: m[1], start: lineOfIndex(m.index), end: lineOfIndex(end), startIndex: m.index, endIndex: end });
  }
  return ranges;
})();
const functionAtLine = (line) => (functionRanges.find((r) => line >= r.start && line <= r.end) || {}).name || '(顶层)';

const pushes = [];
lines.forEach((text, idx) => {
  const n = idx + 1;
  if (!text.includes('enemies.push(')) return;
  const range = functionRanges.find((r) => n >= r.start && n <= r.end);
  const body = range ? source.slice(range.startIndex, range.endIndex) : '';
  pushes.push({ line: n, fn: functionAtLine(n), localGuard: /enemyCapacity\(/.test(body), snippet: snippet(n) });
});
note('enemies.push( 全部出现点：');
for (const p of pushes) note(`  game.js:${p.line}  函数 ${p.fn}()  函数体内 enemyCapacity 守卫=${p.localGuard ? '有' : '无'}\n    ${p.snippet}`);

const outside = pushes.filter((p) => !WHITELIST.includes(p.fn));
assertion(`A4.1 enemies.push( 只出现在白名单函数内（白名单：${WHITELIST.join(' / ')}）`,
  outside.length === 0,
  outside.length ? outside.map((p) => `game.js:${p.line} 位于 ${p.fn}()\n    ${p.snippet}`).join('\n')
    : `共 ${pushes.length} 处，全部在白名单内`);

// 守卫在函数内或在调用点均可 —— 逐个白名单函数核对调用链
const guardFindings = [];
const guardTable = [];
for (const fn of WHITELIST) {
  const range = functionRanges.find((r) => r.name === fn);
  if (!range) { guardFindings.push(`找不到函数 ${fn}()`); continue; }
  if (/enemyCapacity\(/.test(source.slice(range.startIndex, range.endIndex))) {
    guardTable.push(`${fn}() 自带敌容量守卫`);
    continue;
  }
  const callSites = [];
  functionRanges.forEach((r) => {
    if (r.name === fn) return;
    const body = source.slice(r.startIndex, r.endIndex);
    const re = new RegExp(`(^|[^.\\w])${fn}\\(`, 'g');
    let m;
    while ((m = re.exec(body))) {
      const absLine = lineOfIndex(r.startIndex + m.index);
      const guardLine = lines.slice(r.start - 1, absLine).reverse().find((t) => /enemyCapacity\(/.test(t));
      const guardMatch = guardLine && /enemyCapacity\((true|false)\)/.exec(guardLine);
      callSites.push({ fn: r.name, line: absLine, guard: guardMatch ? guardMatch[1] : null });
    }
  });
  for (const c of callSites) {
    guardTable.push(`${fn}() ← ${c.fn}()@game.js:${c.line} 守卫 enemyCapacity(${c.guard ?? '无'})`);
    if (!c.guard) guardFindings.push(`${fn}() 被 ${c.fn}() 调用（game.js:${c.line}），调用点之前没有 enemyCapacity() 守卫\n    ${snippet(c.line)}`);
  }
}
note('守卫分布：\n' + guardTable.map((t) => `  ${t}`).join('\n'));

assertion('A4.2 每个 enemies.push( 的调用链上都有 enemyCapacity() 守卫（函数内或调用点）',
  guardFindings.length === 0,
  guardFindings.length ? guardFindings.join('\n') : '所有 push 点都被 enemyCapacity() 约束');

// 刷怪口径契约。**注意：契约不是"所有调用点用同一种口径"。**
//
// spawnEnemyAtEdge 的调用点故意分成两类：
//   - 环境刷怪（spawnEnemy，每帧的常规刷怪）必须用 enemyCapacity(false)，
//     即停在"基础上限"，把 balance.eventEnemyReserve 的 2 个名额**留给**事件与首领；
//   - 预留位消费方（spawnSurge 怪潮 / updateGame 精英突袭 / spawnBoss / startRandomEvent）
//     用 enemyCapacity(true)。
//
// 统一成 true 会让普通怪吃满预留位，此后 startRandomEvent / 首领分支再判 enemyCapacity(true)
// 时场地已满 —— 事件与首领就再也挤不进来（game.js 的 spawnEnemy 注释里记录过
// "首领 15 分钟都没出现"那类事故）。所以这里断言的是**契约**，不是一致性。
{
  // 契约按 (被调用者, 所在函数) 成对定义 —— 只看"所在函数"是不够的：
  // spawnEnemy 内部既有**环境刷怪**（用 false），也有**首领分支**（用 true，
  // 因为首领是"预约好的事件"，本就该占用预留位）。两者在同一函数里，口径相反且都正确。
  const CONTRACT = [
    { callee: 'spawnEnemyAtEdge', caller: 'spawnEnemy', want: 'false' },
    { callee: 'spawnEnemyAtEdge', caller: 'spawnSurge', want: 'true' },
    { callee: 'spawnEnemyAtEdge', caller: 'updateGame', want: 'true' },
    { callee: 'spawnBoss', caller: null, want: 'true' },
  ];
  const violations = [];
  for (const { callee, caller, want } of CONTRACT) {
    for (const t of guardTable) {
      const m = /^(\w+)\(\) ← ([\w]+)\(\)@game\.js:(\d+) 守卫 enemyCapacity\((true|false)\)$/.exec(t);
      if (!m) continue;
      if (m[1] !== callee) continue;
      if (caller !== null && m[2] !== caller) continue;
      if (m[4] !== want) {
        violations.push(`${m[2]}()@game.js:${m[3]} 调用 ${callee}() 时用了 enemyCapacity(${m[4]})，按契约应为 (${want})`);
      }
    }
  }
  assertion('A4.3 刷怪口径符合契约（环境刷怪 false 让出预留位 / 预留位消费方 true）',
    violations.length === 0,
    violations.length
      ? violations.join('\n')
        + '\n  契约：环境刷怪 spawnEnemyAtEdge←spawnEnemy 必须用 false，把 balance.eventEnemyReserve 让给事件与首领；'
        + '\n        spawnEnemyAtEdge←spawnSurge / ←updateGame 用 true；spawnBoss 用 true（预约事件，可占预留位）。'
        + '\n  （这不是"漂移"，是设计。若确实要改契约，请同时改本脚本的 CONTRACT 表并说明理由。）'
      : '环境刷怪用 false 让出预留位；怪潮 / 精英突袭 / 首领用 true，与设计契约一致');
}

// enemyCapacity(true) 的 reserve 语义
{
  const reserveUses = [];
  lines.forEach((text, idx) => { if (/enemyCapacity\(true\)/.test(text)) reserveUses.push({ line: idx + 1, fn: functionAtLine(idx + 1) }); });
  note('enemyCapacity(true)（含事件预留位）出现点：' + (reserveUses.map((r) => `${r.fn}@game.js:${r.line}`).join('、') || '无'));
  const allowed = ['spawnSurge', 'spawnEnemy', 'startRandomEvent', 'updateGame'];
  const bad = reserveUses.filter((r) => !allowed.includes(r.fn));
  assertion(`A4.4 事件/首领预留位只被 ${allowed.join(' / ')} 使用`,
    bad.length === 0,
    bad.map((r) => `game.js:${r.line} 位于 ${r.fn}()`).join('\n') || `${reserveUses.length} 处调用均在预期函数内`);
}

const splices = [];
lines.forEach((text, idx) => {
  const n = idx + 1;
  if (text.includes('enemies.splice(')) splices.push({ line: n, fn: functionAtLine(n), snippet: snippet(n) });
});
note('enemies.splice( 全部出现点（人工核对用，不参与断言）：');
for (const s of splices) note(`  game.js:${s.line}  函数 ${s.fn}()\n    ${s.snippet}`);

// ---------------------------------------------------------------------------
// A5 素材完整性
// ---------------------------------------------------------------------------

section('A5 素材完整性（assets/ ↔ game.js 引用双向一致）');

const assetFiles = fs.existsSync(ASSETS_DIR)
  ? fs.readdirSync(ASSETS_DIR).filter((f) => fs.statSync(path.join(ASSETS_DIR, f)).isFile()).sort()
  : [];
note(`assets/ 实际文件 ${assetFiles.length} 个`);

const referenced = new Map();
const addRef = (file, line) => {
  if (!referenced.has(file)) referenced.set(file, []);
  referenced.get(file).push(line);
};
// 直接引用：'assets/xxx.png' 与 `assets/xxx.png`
// 注意：反引号在 JS 正则字面量里会被模板串转义吃掉，这里显式用 \x60 表达，避免踩坑。
const directRe = /['"\x60]assets\/([^'"\x60$]+)['"\x60]/g;
lines.forEach((text, idx) => {
  let m;
  while ((m = directRe.exec(text))) addRef(m[1], idx + 1);
});
// 模板串引用：`assets/sfx-${name}.wav` —— 用「前后缀」方式解析，再按 playSound() 实际取值展开
{
  const soundNames = new Set();
  const nameRe = /playSound\('([A-Za-z0-9_-]+)'/g;
  lines.forEach((t) => { let n; while ((n = nameRe.exec(t))) soundNames.add(n[1]); });
  const tplRe = /assets\/([^'"\x60$]*?)\$\{[^}]+\}([^'"\x60]*)/g;
  lines.forEach((text, idx) => {
    if (!text.includes('assets/') || !text.includes('${')) return;
    let m;
    while ((m = tplRe.exec(text))) {
      for (const name of soundNames) addRef(`${m[1]}${name}${m[2]}`, idx + 1);
    }
  });
  note(`模板串路径按 playSound() 实际取值展开：${[...soundNames].sort().join('、') || '无'}`);
}
const missingFiles = [...referenced.keys()].filter((f) => !assetFiles.includes(f)).sort();
const orphanFiles = assetFiles.filter((f) => !referenced.has(f)).sort();
note('game.js 引用清单：');
for (const [file, at] of [...referenced.entries()].sort()) note(`  ${file.padEnd(28)} ← game.js:${[...new Set(at)].join(',')}`);
assertion(`A5.1 game.js 引用的每个素材都真实存在（引用 ${referenced.size} 个）`,
  missingFiles.length === 0,
  missingFiles.length ? missingFiles.map((f) => `assets/${f} 不存在，被 game.js:${[...new Set(referenced.get(f))].join(',')} 引用`).join('\n') : '全部存在');

assertion(`A5.2 assets/ 里每个文件都被 game.js 引用（${assetFiles.length} 个文件）`,
  orphanFiles.length === 0,
  orphanFiles.length ? orphanFiles.map((f) => `assets/${f} 未被任何引用（可能是残留素材）`).join('\n') : '无孤立素材');

info('README 素材表 vs assets/ 实际集合（README:131-143）',
  (() => {
    if (!fs.existsSync(README_PATH)) return 'README.md 不存在，跳过';
    const readmeLines = fs.readFileSync(README_PATH, 'utf8').split(/\r?\n/);
    const listed = new Map();
    readmeLines.forEach((text, idx) => {
      const m = /^\|\s*`([^`]+)`\s*\|/.exec(text);
      if (m && /\.(png|jpg|jpeg|wav|mp3)$/i.test(m[1])) listed.set(m[1], idx + 1);
    });
    const notListed = assetFiles.filter((f) => !listed.has(f));
    return `README 逐条列出 ${listed.size} 个（${[...listed.keys()].join('、')}）；未逐条列出 ${notListed.length} 个：${notListed.join('、')}\n`
      + 'README:139 用「敌人贴图（高 303~336）」一行概括敌人贴图，音效 / 棍子 / 速度云 / 手雷等未给任何一行 —— 属文档覆盖度差距，非失败项。';
  })());

// ---------------------------------------------------------------------------
// A6 配置键引用完整性（每一处 config.<key> 引用的键都必须在表里定义）
//
// 为什么要有这条（第1轮最严重的 bug 就是这个形态）：
//   game.js 曾写着 `grenadeRadius: balance.grenadeRadius`，但 balance 表里根本没有这个键
//   （真正的定义叫 startingGrenadeRadius）。于是 game.grenadeRadius = undefined，
//   爆炸判定 `distance > undefined + radius` 恒为 false —— 手雷变成对全屏所有敌人结算的核弹，
//   爆炸环半径是 NaN，addCapped 的兜底产出也永远不触发。
//   这个 bug 能在代码里存活很久，就是因为没有任何东西检查"引用的键是否存在"。
//
// 判据（**不做任何放宽**）：
//   - 叶子级引用：`cfg.key` 必须存在，且必须是叶子（不是子对象）。取路径的**最长前缀**判定。
//   - 方法/下标链：`cfg.arr.find(...)` / `cfg.arr[0]` → 只断言 `cfg.arr` 存在（arr 是叶子即可）。
//   - 只定义未引用 → INFO，不是 FAIL（死键是清理项，不是错误）。
// ---------------------------------------------------------------------------

section('A6 配置键引用完整性（所有 config.<key> 引用的键都必须在表里定义）');

/** 从 index（一个 { 或 [ 字符处）配平到结束；与全局 matchBracket 同源但可指定文本 */
function matchBracketIn(text, from) {
  const open = text[from];
  const close = open === '{' ? '}' : open === '[' ? ']' : ')';
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i += 1;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 1; continue; }
    if (c === open) depth += 1;
    else if (c === close) { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * 递归收集对象字面量里的**全部键路径**。
 * 嵌套必须处理：`balance.a.b` 与 `balance.a` 都是合法路径，但只有叶子才是可用的标量引用。
 * 返回 Map<路径, {line, kind: 'leaf'|'object'}>。
 */
function collectKeyPaths(text, start, end, prefix, out, lineOfIdx) {
  let i = start + 1;
  while (i < end) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { const q = c; i += 1; while (i < end && text[i] !== q) { if (text[i] === '\\') i += 1; i += 1; } i += 1; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < end && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 1; continue; }
    const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(text.slice(i, i + 80));
    if (m) {
      const key = m[1];
      const keyLine = lineOfIdx(i);
      const path = prefix ? `${prefix}.${key}` : key;
      let j = i + m[0].length;
      while (j < end && /\s/.test(text[j])) j += 1;
      if (text[j] === '{') {
        out.set(path, { line: keyLine, kind: 'object' });
        const sub = matchBracketIn(text, j);
        if (sub < 0) break;
        collectKeyPaths(text, j, sub, path, out, lineOfIdx);
      } else {
        out.set(path, { line: keyLine, kind: 'leaf' });
      }
      // 跳到该值的结尾（顶层逗号或当前层的 } ）
      let depth = 0;
      let k = i + m[0].length;
      for (; k < end; k += 1) {
        const ch = text[k];
        if (ch === "'" || ch === '"' || ch === '`') { const q = ch; k += 1; while (k < end && text[k] !== q) { if (text[k] === '\\') k += 1; k += 1; } continue; }
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth -= 1; }
        else if (ch === ',' && depth === 0) break;
      }
      i = k;
      continue;
    }
    i += 1;
  }
  return out;
}

const CONFIG_SCOPE = {
  balance: '数值总表',
  characterStatCaps: '角色属性上限',
  gunCaps: '枪械上限',
  skillRarity: '技能稀有度',
  enemyStatCaps: '敌人属性上限',
  enemyBaseWeights: '敌人基础权重',
  plantSets: '植物套装',
  characterRender: '角色渲染盒',
  elementalDamageColors: '元素伤害配色',
};

/** 把 `cfg.a.b` 这类引用拆成「要被断言的路径 + 后缀操作（调用/下标）」 */
function readMemberPath(text, index, cfgName) {
  const head = new RegExp(`^${cfgName}\\s*\\.\\s*`).exec(text.slice(index));
  if (!head) return null;
  let cursor = index + head[0].length;
  const parts = [];
  while (cursor < text.length) {
    const segment = /^[A-Za-z_$][\w$]*/.exec(text.slice(cursor));
    if (!segment) break;
    parts.push({ name: segment[0], at: cursor });
    cursor += segment[0].length;
    // 只吃「.name」；一旦遇到 ( 或 [ 就停（那是方法调用/下标，不是更深的属性）
    const dot = /^\s*\.\s*(?=[A-Za-z_$])/.exec(text.slice(cursor));
    if (!dot) break;
    cursor += dot[0].length;
  }
  if (!parts.length) return null;
  // `cfg.x.y` 若**末段**（y）是内置成员/方法（arr.length、arr.find），那它访问的不是配置键：
  // 直接判定为「非键引用」，整个交给 BUILTIN_MEMBERS 处理，**不要**退回上一层去做存在性断言
  // —— 否则 `balance.umbrellaSwarmFactors.length` 会被当成"引用 umbrellaSwarmFactors 键"而漏掉判断依据。
  if (parts.length > 1 && BUILTIN_MEMBERS.has(parts[parts.length - 1].name)) {
    const parentPath = parts.slice(0, -1).map((p) => p.name).join('.');
    return { path: `${parentPath}.${parts[parts.length - 1].name}`, suffix: '', builtin: parts[parts.length - 1].name };
  }
  // 末段是下标/调用（arr[0] / arr.find(…)）→ 退回上一层：要断言的是宿主键 `arr` 存在。
  while (parts.length > 1) {
    const after = text.slice(parts[parts.length - 1].at + parts[parts.length - 1].name.length).trimStart();
    if (after.startsWith('(') || after.startsWith('[') || after.startsWith('.')) parts.pop();
    else break;
  }
  const last = parts[parts.length - 1];
  const afterLast = text.slice(last.at + last.name.length);
  const suffix = /^\s*[([?]/.test(afterLast) ? afterLast.trimStart()[0] : '';
  return { path: parts.map((p) => p.name).join('.'), suffix, builtin: null };
}

/**
 * 对象自带的属性 / 内置方法：`<anyObject>.length`、`<anyArray>.filter(…)` 在语法上永远成立，
 * 静态上无法把它们判定成"配置键笔误"。必须**显式排除**，否则会造出假阳性
 * （第2轮实测：`balance.umbrellaSwarmFactors.length` 被误报成"悬空键"，
 *   而 `umbrellaSwarmFactors: [1, 0.5, 0.25]` 是数组、`.length` 是它的内置属性）。
 *
 * 维护约定：以后遇到新的内置成员，往这个名单里加一个词即可 —— 修法显而易见。
 * 被排除的引用不会静默消失，会由 A6.1 的 INFO 单独列出来（避免"排除了就等于没看见"）。
 */
const BUILTIN_MEMBERS = new Set([
  'length',
  'map', 'filter', 'includes', 'indexOf', 'join', 'slice', 'forEach', 'some', 'every',
  'push', 'pop', 'concat', 'reduce', 'find', 'findIndex', 'sort', 'reverse', 'flat', 'keys', 'values', 'entries',
  'constructor', 'hasOwnProperty', 'toString', 'valueOf', 'name', 'prototype',
]);

/** 内置方法调用形式 `cfg.x.map(...)` → 返回被调用的方法名，否则 null */
function calledMethodName(text, index, cfgName) {
  const m = new RegExp(`^${cfgName}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`).exec(text.slice(index));
  return m ? m[1] : null;
}

const configObjects = [];
for (const [name, label] of Object.entries(CONFIG_SCOPE)) {
  const literal = findObjectLiteral(name);
  if (!literal) { configObjects.push({ name, label, missing: true }); continue; }
  const paths = collectKeyPaths(source, literal.start, literal.end, '', new Map(), lineOfIndex);
  configObjects.push({ name, label, literal, paths });
}
// 自动发现：还有哪些顶层对象字面量被「点号引用」但没进 CONFIG_SCOPE（防漏网，只提示不判红）
{
  const discovered = [];
  const names = [...source.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/gm)].map((m) => m[1]);
  for (const name of names) {
    if (CONFIG_SCOPE[name]) continue;
    const literal = findObjectLiteral(name);
    if (!literal) continue;
    const paths = collectKeyPaths(source, literal.start, literal.end, '', new Map(), lineOfIndex);
    const dotRefs = lines.reduce((n, t) => n + (new RegExp(`\\b${name}\\s*\\.\\s*[A-Za-z_$]`, 'g').test(t) ? 1 : 0), 0);
    if (!dotRefs || !paths.size) continue;
    discovered.push(`${name}（game.js:${lineOfIndex(literal.start)}，${paths.size} 个键，有 ${dotRefs} 行点号引用）`);
  }
  if (discovered.length) {
    info('A6 未纳入守卫的配置对象（建议下一轮加进 CONFIG_SCOPE）',
      discovered.join('\n')
      + '\n注：未纳入不等于"没有问题" —— 只是本轮的守卫名单里没有它。'
      + '\n    判断标准：该对象是否"静态声明 + 只用点号访问"；若它会被运行期改写，就不适合做静态断言。');
  }
}

const a6Dangling = [];
const a6Detail = [];
const a6Builtin = [];
for (const cfg of configObjects) {
  if (cfg.missing) { a6Dangling.push(`${cfg.name} 找不到 \`const ${cfg.name} = { ... }\` 定义`); continue; }
  const leafCount = [...cfg.paths.values()].filter((v) => v.kind === 'leaf').length;
  const refs = [];
  lines.forEach((text, idx) => {
    if (/^\s*(\/\/|\*)/.test(text)) return;
    const re = new RegExp(`\\b${cfg.name}\\s*\\.`, 'g');
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 2), m.index);
      if (/[.\w$]/.test(before) && !before.endsWith('..')) continue;   // xxx.balance. / abalance. 不是本对象的引用
      // 约束 1：`cfg.method(` —— 内置/链式方法调用，永远不可能是"配置键"
      const method = calledMethodName(text, m.index, cfg.name);
      if (method) {
        a6Builtin.push(`game.js:${idx + 1}  ${cfg.name}.${method}(…) —— 方法调用（内置名单内），不参与键存在性断言`);
        continue;
      }
      const parsed = readMemberPath(text, m.index, cfg.name);
      if (!parsed) continue;
      // 约束 2：被断言的路径必须是纯标识符序列（排掉内置成员与怪东西）
      if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(parsed.path)) continue;
      if (parsed.builtin || BUILTIN_MEMBERS.has(parsed.path.split('.').pop())) {
        a6Builtin.push(`game.js:${idx + 1}  ${cfg.name}.${parsed.path} —— \`${parsed.builtin || parsed.path.split('.').pop()}\` 在 JS 内置成员名单里，静态无法判定它是否为笔误`);
        continue;
      }
      refs.push({ level: idx + 1, path: parsed.path, suffix: parsed.suffix });
    }
  });
  // 定义，但从未被引用（叶级）→ INFO 用。判定要包含"以字符串/标识符形式在别处出现过"，
  // 否则 `elementalDamageColors.reflect`（元素名以字符串 'reflect' 传进来）会被误报成死键。
  const unused = [...cfg.paths.entries()]
    .filter(([p, v]) => v.kind === 'leaf'
      && !refs.some((r) => r.path === p || r.path.startsWith(`${p}.`))
      && !(new RegExp(`(['"\`])${p.split('.').pop()}\\1|\\b${p.split('.').pop()}\\b(?!\\s*:)`).test(source)))
    .map(([p, v]) => `${cfg.name}.${p}（game.js:${v.line}）`);
  const bad = [];
  for (const r of refs) {
    const parts = r.path.split('.');
    let cursorPath = '';
    let undefinedAt = -1;
    for (let i = 0; i < parts.length; i += 1) {
      cursorPath = cursorPath ? `${cursorPath}.${parts[i]}` : parts[i];
      if (!cfg.paths.has(cursorPath)) { undefinedAt = i; break; }
    }
    if (undefinedAt >= 0) {
      const leafName = parts[undefinedAt];
      // 候选范围必须与"缺失位置"同级，否则会给出毫无帮助的建议：
      //   `balance.typoKey`（缺顶层键）→ 建议范围 = 顶层键
      //   `balance.enemyHealthMultiplier.pink`（缺子对象键）→ 建议范围 = 该子对象的键
      // 第2轮实测：不限定范围时 `balance.typoKey` 会被建议成 `white / blue`（其实是子对象的键），毫无用处。
      const parentPath = parts.slice(0, undefinedAt).join('.');
      const candidates = [...cfg.paths.keys()]
        .filter((p) => (parentPath
          ? (p.startsWith(`${parentPath}.`) && p.slice(parentPath.length + 1).split('.').length === 1)
          : p.split('.').length === 1))
        .map((p) => p.split('.').pop());
      const uniqueCandidates = [...new Set(candidates)];
      // 最接近的定义名：先看包含关系，再看编辑距离
      const contains = uniqueCandidates.filter((c) => c.toLowerCase().includes(leafName.toLowerCase()) || leafName.toLowerCase().includes(c.toLowerCase()));
      const distance = (a, b) => {
        const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
        for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
        for (let i = 1; i <= a.length; i += 1) {
          for (let j = 1; j <= b.length; j += 1) {
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          }
        }
        return dp[a.length][b.length];
      };
      const nearest = contains.length ? contains : uniqueCandidates
        .filter((c) => c !== leafName)
        .map((c) => ({ c, d: distance(leafName.toLowerCase(), c.toLowerCase()) }))
        .sort((x, y) => x.d - y.d).slice(0, 2).map((x) => x.c);
      const scopeLabel = parentPath ? `${cfg.name}.${parentPath} 的子键` : `${cfg.name} 的顶层键`;
      bad.push({ level: r.level, path: r.path, missing: `${cfg.name}.${cursorPath}`, nearest, scopeLabel, suffix: r.suffix });
    } else {
      // 引用的是子对象本身（例如 `balance.enemyHealthMultiplier[r]`）→ 允许，但要报出来
      const defined = cfg.paths.get(r.path);
      if (defined && defined.kind === 'object' && !r.suffix) {
        a6Detail.push(`${cfg.name}.${r.path} 是子对象，被整表引用（game.js:${r.level}）`);
      } else if (r.suffix === '(') {
        a6Builtin.push(`game.js:${r.level}  ${cfg.name}.${r.path}(…) —— 调用配置表里的函数值，其存在性未被断言`);
      }
    }
  }
  if (bad.length) a6Dangling.push(...bad.map((b) => `game.js:${b.level}  ${cfg.name}.${b.path} —— 表里没有 ${b.missing}\n`
    + `    ${snippet(b.level)}\n`
    + `    最接近的定义名（在 ${b.scopeLabel} 里找）：${b.nearest.length ? b.nearest.join(' / ') : '（该范围内没有相近的键名，可能是整体改名或删键）'}`));
  a6Detail.push(`${cfg.label} \`${cfg.name}\`（game.js:${cfg.literal.startLine}）：定义 ${cfg.paths.size} 个键（叶 ${leafCount}），点号引用 ${refs.length} 处`);
  if (unused.length) {
    info(`A6 只定义、未引用（死键，清理项不是错误）：${cfg.name} ${unused.length} 个`,
      unused.join('\n'));
  }
}

assertion('A6.1 所有 config.<key> 引用的键都在配置表里有定义（叶子级）',
  a6Dangling.length === 0,
  a6Dangling.length
    ? `${a6Dangling.length} 处悬空引用：\n${a6Dangling.map((d) => `  ${d}`).join('\n')}\n`
      + '  这类 bug 的表现是"静默失效"：表达式求值成 undefined/NaN，判定恒 false 或恒 true，'
      + '  游戏照常跑、不报错、也没人发现（第1轮的 `balance.grenadeRadius` → 手雷变全屏核弹就是这个形态）。'
    : `已断言 ${configObjects.filter((c) => !c.missing).length} 个配置对象的**全部键路径**：\n`
      + `  ${configObjects.filter((c) => !c.missing).map((c) => {
        const top = [...c.paths.keys()].filter((p) => p.split('.').length === 1).length;
        const leaf = [...c.paths.values()].filter((v) => v.kind === 'leaf').length;
        return `${c.name}(顶层${top}/叶${leaf})`;
      }).join(' / ')}\n`
      + '  口径说明：`顶层N` 与 A2.1 的「顶层键」是同一个口径，可直接对照（balance 两边都是 187）；'
      + '`叶M` 是含嵌套子对象叶片在内的键路径数，因此 M > N 是正常的（balance 有 4 个子对象，展开后多出 17 个叶键）。\n'
      + '  嵌套对象按最长前缀判定（`balance.a.b` 要求 a 是子对象、b 是叶子）；'
      + '  方法调用与下标链只断言其宿主键存在；`.length` 等 JS 内置成员不参与键存在性断言。');
note(a6Detail.join('\n'));
if (a6Builtin.length) {
  info(`A6 不参与键存在性断言的引用（JS 内置成员 / 方法调用 / 函数值调用）：${a6Builtin.length} 处`,
    a6Builtin.join('\n')
    + '\n说明：这些引用语法上永远成立（例如数组的 .length），静态无法判定它是否本意要访问某个配置键 ——'
    + '\n      所以**排除出断言，但列在这里**，避免"排除了就等于没看见"。名单见 tools/verify.mjs 的 BUILTIN_MEMBERS。');
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

console.log(`\n=== 汇总 ===`);
console.log(`      项目根：${PROJECT_ROOT}`);
console.log(`      真失败 FAIL ${failCount} 条 ｜ 通过 PASS ${results.filter((r) => r.level === 'PASS').length} 条 ｜ 信息项 INFO ${infoCount} 条`);
for (const r of results) console.log(`      ${r.level}  ${r.name}`);
console.log(`      退出码：${failCount > 0 ? 1 : 0}（INFO 不影响退出码）`);

if (argv.includes('--json')) {
  console.log('\n=== JSON ===');
  console.log(JSON.stringify({ project: PROJECT_ROOT, failures: failCount, infos: infoCount, results }, null, 2));
}

process.exit(failCount > 0 ? 1 : 0);
