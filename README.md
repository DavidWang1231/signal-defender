# SIGNAL // Signal Defender

[![check](https://github.com/DavidWang1231/signal-defender/actions/workflows/check.yml/badge.svg)](https://github.com/DavidWang1231/signal-defender/actions/workflows/check.yml)

**English** | [中文](README.zh-CN.md)

> A PCB-aesthetic bullet-hell shooter that lives in a single HTML file — zero dependencies, no build step, double-click to play. Fully bilingual (EN / 中文).

**🎮 Play online: [https://davidwang1231.github.io/signal-defender/](https://davidwang1231.github.io/signal-defender/)**

You are U1, the last arbitration core still awake on the motherboard. Late one night, an unknown signal starts crawling along the bus, erasing the logic gates around it — bring the defense protocol online and hold the board.

## ✨ Features

- **6 game modes**: Endless / Story (a 4-chapter mystery campaign) / Daily Challenge (one global seed + a daily modifier) / Boss Rush gauntlet / local 2-player Versus / achievement hunting
- **Random in-run events**: Overvolt, Data Rain, Bus Silence, Magnet Storm — timed events that reshape each run roguelite-style
- **23 playable ships**: unlocked via challenges, shop purchases, achievement rewards, or a 7-day check-in streak; each ARSENAL-series ship carries a unique weapon (homing missiles, piercing lance, heavy cannon, serpentine wave shot, twin shot)
- **3 rotating boss forms**: Short-Circuit Core (bullet rings + laser sweep), Thermal Runaway (spiral barrage), Clock Glitch (teleport bursts) — one boss every 5 waves, scaling across cycles
- **Coin economy**: score converts to coins; the shop sells themed ships (star / sport / supercar series) and permanent upgrades
- **Daily check-in**: a dedicated sign-in page with 7 reward tiles and growing coin payouts; a 7-day streak unlocks the hidden ship AURUM, and days you launched but forgot to claim can be made up later without breaking the streak
- **Synthesized audio**: background music and every sound effect are generated in real time with the Web Audio API — the BGM shifts automatically during boss fights, and four elite ships (AURUM / MIRROR CORE / REAPER / PRISM) carry their own exclusive themes; independent BGM/SFX volume controls
- **Per-ship bullet styling**: shots are tinted to match each hull — PRISM fires rainbow bullets, AURUM fires spinning gold stars
- **Drone wingman**: a purchasable orbiting co-processor with auto-aim fire; elite ships carry two
- **Shareable score cards**: one click renders a PCB-styled PNG of your run (score, grade, ship) to save or share
- **i18n**: English / Chinese, auto-detected from the browser with an in-game toggle; the choice persists
- **Mobile-friendly**: touch devices switch to one-finger drag + two-finger dash automatically; portrait and landscape both supported, notch-safe
- **Graze system**: skim enemy bullets for bonus points — high-risk, high-skill play
- **Persistent progress**: ships, achievements, coins, and story progress auto-save via localStorage

## 🕹️ Controls

| Platform | Move | Dash (i-frames) | EMP bomb |
|---|---|---|---|
| Desktop | WASD / arrows / mouse drag | Shift | B |
| Mobile | one-finger drag | tap with a 2nd finger / bottom-left button | bottom-right button |
| Versus P1 | WASD | Q | E |
| Versus P2 | arrows | Shift | Enter |

`Space` / `P` pauses · auto-fire · ♪ button (top-right) toggles music · language button (top-left)

> Mouse drag is razor-fast for wild, high-risk play; keyboard moves at a fixed speed for steady, precise dodging — pick your style.

## 🚀 Run locally

No build, no install:

```bash
# option 1: open directly in a browser
open index.html

# option 2: serve it (playable from a phone on the same Wi-Fi)
python3 -m http.server 8000
```

## ✅ Checks

There is no test framework — the regressions in a bullet-hell game are feel and pixels, which unit tests don't catch. Instead one dependency-free script guards the four invariants that can actually ship a broken build, and CI runs it on every push:

```bash
node scripts/check.mjs   # needs nothing but node
```

- **syntax** — the inline `<script>` must parse. With no build step, a syntax error would deploy straight to Pages as a blank screen.
- **version** — the `REV x.y` string lives in four places and must agree.
- **i18n** — every piece of static Chinese needs a `data-en` counterpart, or English mode leaks Chinese.
- **zero-deps** — no external `<script src>`, `<link href>`, `@import`, or runtime `fetch`. One CDN font would break offline play.

## 🛠️ Tech

- Single-file HTML + vanilla JavaScript — no frameworks, no external assets (~120 KB)
- Canvas 2D rendering: every ship, boss, and effect is drawn procedurally; zero image files
- Web Audio API: oscillator-synthesized SFX + procedurally looped BGM on independent gain chains
- Daily Challenge uses a mulberry32 seeded RNG — every player worldwide faces the same enemy waves each day
- i18n via a tiny `T(zh, en)` helper + `data-en` attributes; language resolves before any content renders

## 📄 License

[MIT](LICENSE)
