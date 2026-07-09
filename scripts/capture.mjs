/**
 * SIGNAL README 素材抓取:截图 + gameplay GIF,产物写入 media/。
 * 仅开发用,游戏本体不依赖。运行前在仓库根:
 *   npm i --no-save playwright pngjs gifenc && node scripts/capture.mjs
 * 用系统 Chrome(channel)免下载 chromium;静态服务内置,无外部进程。
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "media");
mkdirSync(OUT, { recursive: true });

// ── 静态服务 ──
const MIME = { ".html": "text/html", ".png": "image/png" };
const srv = createServer((req, res) => {
  try {
    const p = join(REPO, req.url.split("?")[0].replace(/\/$/, "/index.html"));
    res.setHeader("Content-Type", MIME[extname(p)] || "text/plain");
    let body = readFileSync(p);
    if (p.endsWith("index.html")) {
      // 游戏整体包在 IIFE 里,外部摸不到任何绑定;注入闭包内 eval 后门(仅本会话,不碰仓库文件)
      body = Buffer.from(
        body.toString("utf8").replace('(() => {\n"use strict";', '(() => {\n"use strict";\nwindow.__hook = (c) => eval(c);')
      );
    }
    res.end(body);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => srv.listen(8123, r));

const browser = await chromium.launch({ channel: "chrome", headless: true });

// 经 __hook(闭包内 direct eval)执行代码,包成 IIFE 以支持 return
async function gexec(page, code) {
  return page.evaluate((c) => window.__hook("(() => {" + c + "})()"), code);
}

// 通用:开页面进 debug 模式,藏调试面板,开 GOD
async function bootGame(viewport, dsf) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: dsf, locale: "en-US" });
  await page.goto("http://localhost:8123/index.html?debug=1");
  // 新档启动会自动弹签到页,点返回回到主菜单
  await page.waitForSelector("#menu:not(.hidden), #checkinPage:not(.hidden)");
  if (await page.isVisible("#checkinPage")) {
    await page.click("#checkinBack");
    await page.waitForSelector("#menu:not(.hidden)");
  }
  await page.evaluate(() => {
    const p = document.getElementById("dbgPanel");
    if (p) p.style.display = "none";
  });
  return page;
}

// 有战绩的老玩家档案(数值与成绩卡一致),菜单/机库不再满屏 0 和全锁
async function seedProfile(page) {
  await gexec(page, `
    save.best = { score: 48730, wave: 17, combo: 41 };
    save.totalBoss = 9; save.totalKills = 812; save.totalGames = 14; save.coins = 1260;
    save.owned = ["xwing", "hornet", "vector"];
    updateMenuStats();
  `);
}

// 进 Boss 战并等到弹幕密集
async function intoBossFight(page, wave, settleMs) {
  await seedProfile(page);
  await page.click("#startBtn");
  await page.waitForTimeout(400);
  await gexec(page, `dbg.god = true; dbgGoto(${wave});`);
  await page.waitForTimeout(settleMs);
  // 跳波次的比分不真实,校准到该波次的正常水平并把机位从出生点挪开
  await gexec(page, `
    players[0].score = 3210; updateHUD();
    players[0].x = W * 0.44; players[0].y = H * 0.62;
  `);
}

// 键盘走位:左右穿插一次冲刺,画面才有生气
async function weave(page, steps) {
  for (const [key, ms] of steps) {
    if (key === "dash") { await page.keyboard.press("Shift"); await page.waitForTimeout(ms); continue; }
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  }
}

// ── 1. 主菜单(菜单纵向内容多,用高视口装下 LOGO 到底部统计) ──
{
  const page = await bootGame({ width: 1280, height: 1220 }, 2);
  await seedProfile(page);
  await page.waitForTimeout(1500); // 背景走线动画铺开
  await page.screenshot({ path: join(OUT, "menu.png") });
  await page.close();
  console.log("menu.png done");
}

// ── 2. Boss 战截图(热失控,螺旋弹幕最上相)+ 候选帧择优 ──
{
  const page = await bootGame({ width: 1280, height: 800 }, 2);
  await intoBossFight(page, 10, 9000);
  let best = null;
  for (let i = 0; i < 4; i++) {
    await weave(page, [["a", 350], ["d", 250]]);
    const buf = await page.screenshot();
    if (!best || buf.length > best.length) best = buf; // 弹幕越密 PNG 越大
  }
  writeFileSync(join(OUT, "boss.png"), best);
  await page.close();
  console.log("boss.png done", (best.length / 1024).toFixed(0) + "KB");
}

// ── 3. 机库(同样纵向偏长,高视口 + 滚回顶部) ──
{
  const page = await bootGame({ width: 1280, height: 1220 }, 2);
  await seedProfile(page);
  await page.click("#hangarBtn");
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById("hangar").scrollTo(0, 0));
  await page.screenshot({ path: join(OUT, "hangar.png") });
  await page.close();
  console.log("hangar.png done");
}

// ── 4. 成绩卡:直接调游戏自己的 buildShareCard() ──
{
  const page = await bootGame({ width: 1280, height: 800 }, 1);
  await page.click("#startBtn");
  await page.waitForTimeout(400);
  const dataUrl = await gexec(page, `
    const p = players[0];
    p.score = 48730; p.combo = 41; p.maxCombo = 41;
    wave = 17; runKills = 236; bossKills = 3; runGraze = 58;
    return buildShareCard().toDataURL("image/png");
  `);
  writeFileSync(join(OUT, "sharecard.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  await page.close();
  console.log("sharecard.png done");
}

// ── 5. og.png 1200x630(分享卡场景,清晰度用 dsf2 再缩) ──
{
  const page = await bootGame({ width: 1200, height: 630 }, 1);
  await intoBossFight(page, 10, 9000);
  await weave(page, [["a", 400], ["d", 300]]);
  await page.screenshot({ path: join(OUT, "og.png") });
  await page.close();
  console.log("og.png done");
}

// ── 6. GIF:CDP screencast 抓帧 → gifenc ──
{
  const page = await bootGame({ width: 1280, height: 800 }, 1);
  await intoBossFight(page, 10, 7000);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (ev) => {
    frames.push({ data: Buffer.from(ev.data, "base64"), t: ev.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: 640, maxHeight: 400, everyNthFrame: 1 });
  // 抓帧期间持续走位:左右穿插两次冲刺
  await weave(page, [["a", 700], ["d", 900], ["dash", 250], ["a", 800], ["d", 600], ["a", 500], ["dash", 250], ["d", 900], ["a", 700], ["d", 400]]);
  await cdp.send("Page.stopScreencast");
  await page.close();
  console.log("raw frames:", frames.length);

  // 按 ~12fps 重采样
  const FPS = 12, STEP = 1 / FPS;
  const t0 = frames[0].t;
  const picked = [];
  let next = 0;
  for (const f of frames) {
    if (f.t - t0 >= next) { picked.push(f); next += STEP; }
  }
  console.log("picked:", picked.length);

  const enc = GIFEncoder();
  let W0 = 0, H0 = 0;
  for (const f of picked) {
    const png = PNG.sync.read(f.data);
    if (!W0) { W0 = png.width; H0 = png.height; }
    if (png.width !== W0) continue; // 防御:尺寸变化的帧丢弃
    const palette = quantize(png.data, 256);
    const index = applyPalette(png.data, palette);
    enc.writeFrame(index, W0, H0, { palette, delay: Math.round(1000 / FPS) });
  }
  enc.finish();
  const out = Buffer.from(enc.bytes());
  writeFileSync(join(OUT, "gameplay.gif"), out);
  console.log("gameplay.gif done", (out.length / 1024 / 1024).toFixed(2) + "MB", W0 + "x" + H0);
}

// ── 7. 顺手验证 REV 4.3 的两个新行为 ──
{
  const page = await bootGame({ width: 800, height: 600 }, 1);
  // 首局提示:fresh save,非移动端 → texts 里应有 SHIFT 提示
  await page.click("#startBtn");
  await page.waitForTimeout(300);
  const r = await gexec(page, `
    const hint = texts.some((t) => /SHIFT/.test(t.str));
    const hintFlag = save.keyHint === 1;
    // 切后台自动暂停:直接派发 visibilitychange 验证监听逻辑
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    const paused = state === S.PAUSE && !document.getElementById("pauseOverlay").classList.contains("hidden");
    return { hint, hintFlag, paused };
  `);
  console.log("VERIFY first-run hint:", r.hint, "| flag saved:", r.hintFlag, "| auto-pause on hide:", r.paused);
  await page.close();
}

await browser.close();
srv.close();
