#!/usr/bin/env node
/**
 * 《小院清理队》资产预算闸 —— 界面UI第1轮产出
 *
 * 目的：微信小游戏主包上限 4 MB。这个脚本把「主包到底多大」从口头承诺变成可执行拦截，
 * 让美术素材在**进仓库之前**就撞墙，而不是在上传时才发现。
 *
 * 与 tools/verify.mjs 的分工：
 *   verify.mjs A5 管「素材与代码引用一致」（有没有多余/缺失的文件）；
 *   本脚本只管「字节预算」（包多大、单个文件多大、哪些文件明显可压）。
 *   两者都不 require game.js。
 *
 * 用法：
 *   node tools/asset-budget.mjs                 # 人读表格
 *   node tools/asset-budget.mjs --json          # 机器读
 *   node tools/asset-budget.mjs --root "D:\小院清理队"
 *
 * 退出码：0 = 无 FAIL，1 = 至少一条 FAIL。INFO 不影响退出码。
 *
 * 预算口径：按 project.config.json 的 packOptions.ignore 计算「真实会上传的文件集」，
 * 不按 git 追踪集。目录型 ignore 按前缀匹配（value 及其所有子路径）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- 预算常量（唯一事实源，改这里就是改闸） --------------------------------
const MAIN_PACK_LIMIT = 4 * 1024 * 1024;      // 微信小游戏主包硬上限
const HEADROOM_WARN = 3.2 * 1024 * 1024;      // 80%：留给下一批美术素材的余量
const SINGLE_FILE_LIMIT = 512 * 1024;         // 单个素材超过它几乎必然是没压
const HEAVY_FILE = 256 * 1024;                // 超过它就值得报出来
const BITS_PER_PX_WARN = 6;                   // PNG 每像素位数 > 6 基本等于没优化

// 开发者工具永远不会上传的东西。写在这里而不是塞进 project.config.json 的 ignore，
// 是因为那是「项目配置」，这几项是平台常识；改了会让 ignore 列表读起来像在藏东西。
const IMPLICIT_IGNORE = ['.git', 'node_modules'];

// ---- 基础 ------------------------------------------------------------------

function parseArgs(argv) {
  const args = { json: false, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--root') { args.root = argv[i + 1]; i += 1; }
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));
const PROJECT_ROOT = ARGS.root ? path.resolve(ARGS.root) : path.resolve(HERE, '..');

const results = [];
function assertion(name, ok, detail) { results.push({ kind: 'assert', name, ok, detail }); }
function info(name, detail) { results.push({ kind: 'info', name, ok: null, detail }); }

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---- 文件集 ----------------------------------------------------------------

function loadIgnoreRules() {
  const configPath = path.join(PROJECT_ROOT, 'project.config.json');
  if (!fs.existsSync(configPath)) return [];
  const config = readJson(configPath);
  const rules = (config.packOptions && config.packOptions.ignore) || [];
  return rules
    .filter((rule) => rule && typeof rule.value === 'string' && rule.value.length)
    .map((rule) => ({
      type: rule.type === 'file' ? 'file' : 'folder',
      value: rule.value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''),
    }));
}

function isIgnored(relative, rules) {
  const p = relative.replace(/\\/g, '/');
  for (const implicit of IMPLICIT_IGNORE) {
    if (p === implicit || p.startsWith(implicit + '/')) return true;
  }
  for (const rule of rules) {
    if (rule.type === 'folder' && (p === rule.value || p.startsWith(rule.value + '/'))) return true;
    if (rule.type === 'file' && p === rule.value) return true;
  }
  return false;
}

function walk(dir, rules, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(PROJECT_ROOT, full);
    if (isIgnored(relative, rules)) continue;
    if (entry.isDirectory()) walk(full, rules, out);
    else if (entry.isFile()) out.push({ relative: relative.replace(/\\/g, '/'), full, bytes: fs.statSync(full).size });
  }
  return out;
}

// ---- 图像头（不引依赖，只读头部拿尺寸） ------------------------------------

function imageSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) { i += 1; continue; }
      const marker = buffer[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = buffer.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: 'jpeg', height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      }
      i += 2 + length;
    }
  }
  if (buffer.length > 12 && buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') {
    return { format: 'webp', width: null, height: null };
  }
  return null;
}

function human(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ---- 主流程 ----------------------------------------------------------------

function main() {
  const rules = loadIgnoreRules();
  const shipped = walk(PROJECT_ROOT, rules, []);
  const total = shipped.reduce((sum, file) => sum + file.bytes, 0);
  const assets = shipped.filter((file) => file.relative.startsWith('assets/'));
  const images = [];
  for (const file of assets) {
    const size = imageSize(file.full);
    if (size && size.width) {
      images.push({ ...file, ...size, bitsPerPx: (file.bytes * 8) / (size.width * size.height) });
    }
  }

  // B1 主包总量
  assertion(
    `B1 主包总量 ${human(total)} / 上限 4 MB（按 packOptions.ignore 计算 ${shipped.length} 个文件）`,
    total <= MAIN_PACK_LIMIT,
    total > MAIN_PACK_LIMIT
      ? `超限 ${human(total - MAIN_PACK_LIMIT)}：上传会被微信直接拒绝。最大三个文件：` +
        shipped.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 3)
          .map((file) => `${file.relative} ${human(file.bytes)}`).join('、')
      : `余量 ${human(MAIN_PACK_LIMIT - total)}`,
  );

  if (total > HEADROOM_WARN) {
    info(`B1.1 已用 ${((total / MAIN_PACK_LIMIT) * 100).toFixed(0)}% 主包（预警线 80%）`,
      total > MAIN_PACK_LIMIT
        ? `已超硬上限 ${human(total - MAIN_PACK_LIMIT)}`
        : `再进 ${human(HEADROOM_WARN - total)} 以上素材就会失去安全余量`);
  }

  // B2 单文件上限
  const fat = assets.filter((file) => file.bytes > SINGLE_FILE_LIMIT);
  assertion(
    `B2 没有单个素材超过 ${human(SINGLE_FILE_LIMIT)}（${assets.length} 个素材）`,
    fat.length === 0,
    fat.length ? fat.map((file) => `${file.relative} ${human(file.bytes)}`).join('\n') : '无',
  );

  // B3 重文件 + 可压线索（INFO）
  const heavy = assets.filter((file) => file.bytes > HEAVY_FILE).sort((a, b) => b.bytes - a.bytes);
  if (heavy.length) {
    info(`B3 重素材 ${heavy.length} 个，合计 ${human(heavy.reduce((s, f) => s + f.bytes, 0))}（占素材 ${((heavy.reduce((s, f) => s + f.bytes, 0) / assets.reduce((s, f) => s + f.bytes, 0)) * 100).toFixed(0)}%）`,
      heavy.map((file) => `${file.relative} ${human(file.bytes)}`).join('、'));
  }

  // B4 采样率异常（INFO）
  const bloated = images.filter((image) => image.bitsPerPx > BITS_PER_PX_WARN);
  if (bloated.length) {
    info(`B4 ${bloated.length} 张图每像素位数 > ${BITS_PER_PX_WARN}，几乎肯定能压`,
      bloated.map((image) => `${image.relative} ${image.width}x${image.height} ${image.bitsPerPx.toFixed(2)} bits/px ${human(image.bytes)}`).join('\n'));
  }

  // B5 分辨率与 3 倍屏需求（INFO）：告诉美术这张图最多能撑多大的屏上尺寸
  if (images.length) {
    info('B5 每张图在 pixelRatio=3 屏上最大可用的 CSS 尺寸（长边/3）',
      images.sort((a, b) => b.width - a.width)
        .map((image) => `${image.relative} ${image.width}x${image.height} -> ${Math.round(Math.max(image.width, image.height) / 3)}px`)
        .join('\n'));
  }

  const fail = results.filter((r) => r.kind === 'assert' && !r.ok);
  const pass = results.filter((r) => r.kind === 'assert' && r.ok);

  if (ARGS.json) {
    console.log(JSON.stringify({
      projectRoot: PROJECT_ROOT,
      totalBytes: total,
      limitBytes: MAIN_PACK_LIMIT,
      shippedFiles: shipped.length,
      assetBytes: assets.reduce((s, f) => s + f.bytes, 0),
      fail: fail.length,
      pass: pass.length,
      results,
    }, null, 2));
  } else {
    console.log(`资产预算闸 · ${PROJECT_ROOT}`);
    console.log(`主包 ${human(total)} / ${human(MAIN_PACK_LIMIT)}；素材 ${assets.length} 个 ${human(assets.reduce((s, f) => s + f.bytes, 0))}；文件 ${shipped.length} 个\n`);
    for (const row of results) {
      const tag = row.kind === 'info' ? 'INFO' : row.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${row.name}`);
      if (row.kind === 'info' || !row.ok) console.log('       ' + String(row.detail).split('\n').join('\n       '));
    }
    console.log(`\n结果：${pass.length} PASS / ${fail.length} FAIL / ${results.filter((r) => r.kind === 'info').length} INFO`);
    if (fail.length) console.log('FAIL 会阻断出包。先跑 团队工作区/reports/界面UI/tools/bake-probe.py 看这几个文件能压到多少。');
  }
  return fail.length ? 1 : 0;
}

process.exit(main());
