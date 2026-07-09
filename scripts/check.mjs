/**
 * SIGNAL // 信号防线 — 提交前自检
 *
 * 无依赖，只用 node 内置模块。本地跑 `node scripts/check.mjs`，CI 里跑同一个文件。
 * 每条检查都对应一种真实会把游戏推坏的方式，不是通用模板。
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CJK = /[一-鿿]/;
const HTML_FILES = ["index.html", "debug.html"];

let failed = 0;
const pass = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => {
  console.log(`  FAIL  ${msg}`);
  failed++;
};
const section = (name) => console.log(`\n${name}`);

/** 取出所有内联 <script> 块（带 src 的外链不算，本项目也不该有）。 */
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    const line = html.slice(0, m.index).split("\n").length;
    out.push({ code: m[1], line });
  }
  return out;
}

// ── 1. 语法 ────────────────────────────────────────────────────────────────
// 单文件游戏没有构建步骤：语法错误会直接推上 Pages 变白屏，没有任何东西拦得住。
section("syntax");
for (const file of HTML_FILES) {
  const html = readFileSync(file, "utf8");
  const blocks = inlineScripts(html);
  if (!blocks.length) {
    fail(`${file}: 没找到内联 <script>`);
    continue;
  }
  for (const { code, line } of blocks) {
    try {
      new vm.Script(code, { filename: file });
      pass(`${file}: <script> @${line} 解析通过 (${code.split("\n").length} 行)`);
    } catch (e) {
      fail(`${file}: <script> @${line} ${e.message}`);
    }
  }
}

// ── 2. 版本号同步 ──────────────────────────────────────────────────────────
// CLAUDE.md 记着版本号散在四处，bump 时必须一起改。这里替人盯着。
section("version");
{
  const html = readFileSync("index.html", "utf8");
  const hits = [...html.matchAll(/REV \d+\.\d+/g)].map((m) => ({
    text: m[0],
    line: html.slice(0, m.index).split("\n").length,
  }));
  const uniq = [...new Set(hits.map((h) => h.text))];
  if (!hits.length) fail("index.html 里一个 REV x.y 都没有");
  else if (uniq.length > 1) {
    fail(`版本号不一致: ${uniq.join(" / ")}`);
    hits.forEach((h) => console.log(`          index.html:${h.line}  ${h.text}`));
  } else pass(`${uniq[0]} 在 ${hits.length} 处保持一致`);
}

// ── 3. i18n 泄漏 ───────────────────────────────────────────────────────────
// 静态 HTML 里的中文必须带 data-en，否则英文模式会漏出中文。
// 三类豁免：<style>/<script> 内部、整块换成 EN_HELP 的说明书、以及由 JS 写入
// textContent/innerHTML 的占位文本（那些走 T() 翻译，HTML 里的中文只是占位）。
section("i18n");
{
  const html = readFileSync("index.html", "utf8");
  const lines = html.split("\n");
  const scriptBody = inlineScripts(html).map((b) => b.code).join("\n");

  // 被 JS 覆盖内容的元素 id —— 它们的 HTML 文本只是占位，不需要 data-en。
  const jsDriven = new Set(
    [...scriptBody.matchAll(/\$\(\s*["']([\w-]+)["']\s*\)\s*\.\s*(?:textContent|innerHTML)\s*=/g)].map(
      (m) => m[1]
    )
  );

  // 说明书整块（#help 到 #helpBack）由 EN_HELP 替换。
  const helpStart = lines.findIndex((l) => /id="help"/.test(l));
  const helpEnd = lines.findIndex((l) => /id="helpBack"/.test(l));

  const depth = (upto, tag) => {
    const before = lines.slice(0, upto + 1).join("\n");
    const open = (before.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const close = (before.match(new RegExp(`</${tag}>`, "g")) || []).length;
    return open > close;
  };

  const leaks = [];
  lines.forEach((l, i) => {
    if (!CJK.test(l)) return;
    if (depth(i, "style") || depth(i, "script")) return;
    if (helpStart >= 0 && i >= helpStart && i <= helpEnd) return;
    if (/^\s*<!--/.test(l)) return;
    if (/data-en=/.test(l)) return;
    if (/<title>/.test(l)) return; // applyLangDom() 里设 document.title
    if (/^\s*<meta\s/.test(l)) return; // meta 内容不渲染给用户
    const id = l.match(/id="([\w-]+)"/)?.[1];
    if (id && jsDriven.has(id)) return;
    leaks.push({ line: i + 1, text: l.trim().slice(0, 80) });
  });

  if (leaks.length) {
    fail(`${leaks.length} 处静态中文没有 data-en（英文模式会漏出中文）`);
    leaks.forEach((k) => console.log(`          index.html:${k.line}  ${k.text}`));
  } else pass("静态 HTML 里的中文都有 data-en 或由 T() 驱动");
}

// ── 4. 零依赖 ──────────────────────────────────────────────────────────────
// "双击即玩、零外部资源" 是这个项目的卖点。一条 CDN 字体就让它离线打不开。
section("zero-deps");
{
  const patterns = [
    [/<script[^>]+\bsrc=/i, "外链 <script src>"],
    [/<link[^>]+href="https?:/i, "外链 <link href>"],
    [/@import\s+(?:url\()?["']?https?:/i, "CSS @import 远程资源"],
    [/url\(\s*["']?https?:/i, "CSS url() 远程资源"],
    [/\bfetch\s*\(|XMLHttpRequest/i, "运行时网络请求"],
  ];
  let dirty = false;
  for (const file of HTML_FILES) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((l, i) => {
      for (const [re, what] of patterns) {
        if (re.test(l)) {
          fail(`${file}:${i + 1} ${what} — ${l.trim().slice(0, 60)}`);
          dirty = true;
        }
      }
    });
  }
  if (!dirty) pass("无外链资源、无运行时网络请求");
}

// ──────────────────────────────────────────────────────────────────────────
console.log(failed ? `\n${failed} 项检查未通过\n` : "\n全部检查通过\n");
process.exit(failed ? 1 : 0);
