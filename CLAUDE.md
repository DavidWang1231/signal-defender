# SIGNAL // 信号防线 — 项目说明

PCB 电路板美学的弹幕射击游戏。**全部代码在单个 `index.html` 里**（HTML+CSS+JS 约 3000 行），零依赖、无构建、无外部资源，双击即玩。当前版本 **REV 4.0**。中英双语（面向国外求职展示，英文为对外默认）。

## 链接

- 仓库: https://github.com/DavidWang1231/signal-defender
- 在线试玩 (GitHub Pages, main 分支根目录): https://davidwang1231.github.io/signal-defender/
- gh CLI 已登录账号 DavidWang1231，可直接 push / 发 Release / 改仓库设置

## ⚠️ 唯一事实来源

改游戏只改**本仓库的 `index.html`**。`~/Documents/signal_defender_v3_1.html` 和 `~/Downloads/` 下的同名文件是历史开发副本，已过时，不要再编辑。

## 发布流程

1. 改 `index.html`
2. 语法自检: 提取 `<script>` 内容后 `node --check`（无测试框架，靠这个 + 浏览器实测）
3. 版本号在两处: `<title>` 和主菜单 `.refdes`（格式 REV 3.x），大更新时同步 bump
4. `git commit` + `git push` → Pages 约 1 分钟自动更新
5. 大版本再打 tag + `gh release create`

## i18n（REV 3.5 起）

- 语言在 script 最顶部确定：`LANG`（localStorage 键 `signal_lang` > 浏览器语言，非中文默认英文），切换按钮 `#langBtn` 写入后 `location.reload()`
- **JS 字符串**：`T(中文, English)` 辅助函数，数据结构（SKINS/ACH/STORY_BEATS/DAILY_MODS/UPGRADES/THEMES）定义时即翻译
- **静态 HTML**：元素带 `data-en` 属性，英文模式启动时 `applyLangDom()` 批量替换 innerHTML；说明书整块替换为 JS 常量 `EN_HELP`
- 新增任何用户可见文案必须同时提供中英两份（data-en 或 T()），否则英文模式会漏出中文
- README 双语：`README.md` 英文为主，`README.zh-CN.md` 中文，顶部互链，改动需同步两份

## 代码结构速查（均在 index.html 的 script 内）

- `SKINS[]` — 23 架战机: 条件解锁(unlock) / 商店(shop:{series,price}) / 奖励(reward)三类；perk 字段驱动特性；aurum 由签到解锁
- 每日签到: 手动点击制。上线日记入 `save.visits`(留 30 天),`save.checkin={claimed:{date:1},streak,last}`(自动从 3.6 旧档迁移);`pendingCheckins()` 列出上线过但未签的日期,`claimCheckin()` 按时间序逐天签(含补签,前一天已签则连击续),连续 7 天解锁 aurum,已拥有后 day7 改 +300 额外金币;签到页 `#checkinPage`(`buildCheckinPage()`,7 张奖励卡,day7 有 aurum 动画预览),有待签时启动自动弹出
- 暂停键: 空格或 P(togglePause 先 blur 焦点,防空格重复触发按钮)
- `GUNS{}` — 武器系统: default/twin/homing/pierce/heavy/wave，经 `perk.gun` 绑定到战机；子弹由 `mkBullet()` 生成，支持 pierce/homing/wobble/dmg/shape
- Boss 三形态: `spawnBoss()` 按 tier 轮换 core/thermal/glitch，各自 update 分支 + render 分支
- `ACH[]` — 13 成就，带 reward(coins/skin)；`checkAch()` 局内每秒 + 结算时跑
- `DAILY_MODS[]` + `mulberry32` — 每日挑战种子随机(日期字符串转种子)，只替换 gameplay 用的 `rng()`，视觉仍用 Math.random
- `STORY_BEATS{}` — 主线剧情 4 章，角色: OPS(青)/NULL(红)/U1(金)，击败对应 Boss tier 触发
- `players[]` — 多玩家结构(双人对战)，所有玩家状态挂在 player 对象上，没有全局 score/lives
- 音频: `sfxGain`/`bgmMaster` 两条独立增益链，音量设置面板可调；BGM 为程序化合成循环；`SKIN_BGM{}` 高级战机专属曲目(aurum/core/reaper/prism)，`bgmProfile()` 按 save.skin 每小节取，换机即换曲
- 子弹视觉: `mkBullet` 默认色取 skin.trailColor(prism 彩虹)；`perk.bulletShape` 换弹形(aurum="star")；武器专属色(homing/pierce/heavy/wave)不受影响
- 签到 UI: 主菜单 `#checkinCard` 卡片(7 菱形进度点)，`updateCheckinCard()` 随 updateMenuStats 刷新
- 存档: localStorage 键 `signal_save_v3`，`save` 对象 Object.assign 合并保证旧档兼容
- 移动端: `IS_MOBILE` 检测(pointer:coarse)，单指拖动+双指点按冲刺，`@media (pointer:coarse)` 样式块
- 随机事件: `EVENTS[]` 4 种(overload/datarain/silence/magnet)，`runEvent`/`runEventT` 调度(非 Boss 波、非对战/连战)；效果钩子在 diff()(速度)、scoreMult()(×2)、powerups 循环(磁吸)、render()(边框光晕/暗幕)；datarain 掉 coin 道具(+5 进 runCoins，结算并入金币)
- Boss 连战: mode="rush"，wave 从 5 起、damageBoss 后 +4 跳到下个 Boss 波；`rushTime` 计时，HUD 右侧显示 TIME；成绩存 `save.rush={boss,time}`，不写 best.score/best.wave，wave 类成就已排除 rush
- 无人机: 商店 upg `drone`(1200¤)，startGame 里 `p.drones = SKIN_BGM[skin]?2:1`，环绕 42px 自动瞄准射击(update/render 各一段)
- 成绩卡: `buildShareCard()` 离屏 canvas 生成 PCB 风格 PNG(评级 `scoreGrade()`)，`shareCard()` 优先 navigator.share 否则下载；对战模式隐藏 shareBtn

## 已知边界 / 未做

- 双人对战需要实体键盘（同屏共享敌潮比分，皮肤特性对战中禁用，仅武器类型生效）
- 跨设备联机未实现（需 WebSocket 服务器，用户已知晓）
- 平衡性数值(商店价格/金币产出/武器强度)按用户反馈随调
