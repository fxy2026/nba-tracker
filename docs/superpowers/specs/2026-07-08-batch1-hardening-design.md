# 批次 1：数据层加固 + 性能修复 — 设计

日期：2026-07-08
状态：已获用户批准的方向，待 spec 评审
来源：五维并行审计（代码健康 / 性能 / 功能缺口 / UX / 数据健壮性），本批为三批施工计划的第一批（后续：批次 2 休赛期内容层、批次 3 质量打磨）。

## 目标

1. 拆除两颗有明确 deadline 的定时炸弹：赛季常量硬编码（2026-10 爆）、schedule feed 翻页数据清空（约 2026-08 中爆）。
2. 修复现行 bug：/injuries 球队张冠李戴、/history 冠军 TBD。
3. 消除三个性能硬伤：球员页 4 秒白等、player-shots 重复下载 PBP、11MB schedule 冷启动税。
4. 为外部 API 依赖补齐超时 / 熔断 / 投毒防护 / 限流处理。

## 非目标（本批不做）

- 休赛期新功能（批次 2）：主页休赛期模式、FA 追踪深化、赛季回顾页、工资表、选秀/夏联。
- i18n 清扫、loading 骨架、触屏图表、色盲友好、导航可发现性（批次 3）。
- CompareClient / player page monolith 拆分、四套 SVG 球场渲染统一（批次 3 或更后）。
- follow-digest 补测试属于批次 3，但本批凡是新写的纯逻辑必须带测试。

---

## A. 赛季切换排雷

### A1 赛季派生化

`src/lib/constants.ts` 新增纯函数 `currentSeason(date: Date): string`：

- 起始年 = 月份 ≥ 10 ? 当年 : 上一年；返回 `"YYYY-YY"` 格式（如 `"2025-26"`）。
- 语义：7–9 月（休赛期）仍返回刚结束的赛季——休赛期查 leagueleaders / playergamelog 查的就是旧季；10 月 1 日翻季。
- `export const CURRENT_SEASON = currentSeason(new Date())`（module scope 求值，消费者 import 不变）。
- `SEASON_START/SEASON_END/PLAYOFFS_END` 保留为展示兜底，`SeasonProgress` 改为优先从 schedule feed 的实际首末场日期推导赛季阶段，feed 不可用时退回常量。
- `awards-race` 里从字符串推导新秀年的逻辑改用 `currentSeason` 派生。
- vitest：翻季边界（9/30、10/1、1 月、6 月、7 月）。

`src/data/awards.json` 的 2025-26 TBD 占位行不在本批处理（批次 2 赛季回顾时人工补齐内容）。

### A2 Feed 翻页防护 + 赛末快照

**问题**：`scheduleLeagueV2.json` 是单赛季文档。CDN 翻到 2026-27 后（历史上约 8 月中），standings / records / follow-digest 等约 20 个消费方同时清空。

**方案**：

1. 一次性脚本 `scripts/snapshot-season.mjs`：趁 feed 还是 2025-26，把赛末数据固化为 `src/data/season-2025-26-final.json`（沿用 `allTimeLeaders.ts` 的 curated-data 模式）。内容：
   - 每队：W/L、主客战绩、streak、分区/分区排名（与 standings route 现有输出形状一致）；
   - 已完赛比赛瘦身行：gameId、日期、双方 tricode + 得分、gameStatus（供 follow-digest 战绩/最近比赛回退与批次 2 赛季回顾复用）。
2. `api.ts` 解析 schedule 时记录 feed 的 `seasonYear`，暴露给消费方。
3. 回退逻辑：standings route 与 follow-digest 在 **feed 中已完赛比赛数为 0** 时回退到快照数据（而非渲染空表）。8 月中–10 月窗口期：feed=2026-27（全未开赛）→ 命中回退；10 月开赛后 feed 有完赛比赛 → 自动切回 live。回退响应携带来源标记（如 `season: "2025-26"` + `archived: true`），UI 展示"2025-26 赛季最终"字样，避免被误认为新赛季实时数据。
4. vitest：回退触发条件（空 feed / 新季未开赛 feed / 正常 feed）。

### A3 缓存投毒防护

`src/lib/api.ts`：

- `fetchScheduleBlocking` / `fetchScheduleInBackground`：仅当解析出的 `gameDates` 非空才提交缓存；后台刷新失败或得到空结果时**保留旧的 stale 缓存**，不得用 `[]` 覆盖。
- `getPlayerIndex`：`if (playerIndexCache)` 对空数组恒真 → 改为长度检查；`fetchPlayerIndex` 仅在 `players.length > 0` 时提交；`rs.rowSet` 缺失时不抛未捕获 TypeError（返回空并不缓存）。
- vitest：200-空-body / 缺 rowSet / 正常三种 fixture。

---

## B. 现行 bug

### B4 /injuries 球队匹配张冠李戴

"Or**la**ndo".includes("la") 命中 LAC 的 city="LA"，魔术伤病挂到快船名下。FavoritesDashboard（commit c99d4b1）已修：昵称优先匹配 + `city.length > 3` 守卫。

- 把该匹配逻辑提取为 `src/lib/teams.ts` 的共享函数（如 `findTeamByDisplayName`），/injuries 页与 FavoritesDashboard 共用。
- vitest：Orlando Magic ≠ LAC、LA Clippers / Los Angeles Lakers 正常命中等 case。

### B5 /history 冠军 TBD

`src/app/history/page.tsx` 2025、2026 两行均为 TBD：

- 2026（2025-26 赛季）：冠军、比分从 A2 快照的季后赛结果推导校验后写入（数据在自家 feed 里）。
- 2025（2024-25 赛季）：当前 feed 已无该季数据，人工补一行。
- FMVP 两年均人工补（一行数据，无自动来源）。

---

## C. 性能修复

### C6 球员页 4 秒白等 + 重复请求

- 新建 `src/lib/statsProxy.ts`：集中 stats.nba.com 伪装头、带超时 fetch、blackhole 熔断注册表（现状：/api/stats 与 /api/matchups 各自实现，/api/player 与 /api/player-shots 没有熔断）。四个代理路由全部换用，行为不变，纯去重。
- `/api/player`：**移除**对已黑洞 `playergamelog` 的请求（follow-digest 已证明 CDN box score 可替代该数据路径，且该请求在 Vercel 上从未成功过）；接入熔断器；`export const maxDuration`（覆盖 ESPN 串行链最坏情况）。
- 客户端：`PlayerStatsBundle` 与 `PlayerAdvancedStats` 的重复 `/api/player` 请求合并——共享 hook（module 级 `Map<url, Promise>` 缓存）。
- 顺带删除 `follow-digest.ts` 里的死代码 `parseLatestPlayerLine`（黑洞路径的遗留解析器，零引用）。

### C7 player-shots 重复下载 PBP

`getPlayByPlay` 的缓存 pin 依赖 `boxScoreCache` 中的 gameStatus，而 /api/player-shots 从不拉 box score → 缓存永不生效，每请求重新下载最多 30 份完整 PBP。

- pbpCache 条目自带 `final` 标志（依据 PBP 自身或 schedule 的 gameStatus===3 判定），不再依赖 boxScoreCache。
- 补 inflight 去重（对齐 `getBoxScore` 现有模式）。
- 已完赛比赛的 fetch `revalidate` 由 60 拉长到 86400（完赛数据不可变）。

### C8 直播页降频

`GameAutoRefresh` INTERVAL 15s → 30s（box score 上游 TTL 即 30s，数据不可能更新，纯省 lambda 和流量）。更优的"轮询瘦身端点 + 有变化才 refresh"留待未来，不在本批。

### C9 CDN fetch 超时

- `getTodayScoreboard` / `getBoxScore` / `getPlayByPlay` / `fetchPlayerIndex` 补 AbortSignal 超时（8s 级）。
- `/api/games` ET 路径的裸 `getTodayScoreboard()` 调用补降级（对齐同文件 tz 路径的 `.catch(() => [])`），一次瞬时网络错误不再 500 整个端点。

### C10 BallDontLie 限流

`/api/salary`：失败/429 响应加内存负缓存（短 TTL，尊重 Retry-After）并带 `Cache-Control: s-maxage=60` 返回（现状：失败响应无缓存头，每个访客都重新烧配额）；contracts fetch 补 AbortSignal（现在只有 search 有）；`export const maxDuration`。

### C11 小赢包

- Compare 页两处头像 URL 显式传 `"260x190"`（现状 fallthrough 到 1040x760，单次对比拉几 MB PNG）。
- `public/sw.js` CACHE_IMAGES 桶加上限（约 300 条，复用现有 pages 桶的 trim helper）。
- ESPN 守卫：`/api/injuries` 响应加形状校验（非预期结构返回错误态而非静默空数组）；`espn.ts` career stats 的 label 解析失败时返回 null 而非全 0 假数据。

---

## D. Schedule 瘦身基建（重方案，已选定）

**问题**：11MB `scheduleLeagueV2.json` 超过 Vercel 数据缓存约 2MB 的单条上限 → `next: { revalidate }` 是无效摆设，唯一缓存是 per-lambda 内存。每个冷实例下载 + parse 11MB 才能出首字节，堵住 15+ 页面；比赛页（最高流量路由）因 `getSeasonRank` 在关键 `Promise.all` 里也中招。

**方案**（主）：

1. 盘点全部 `getFullSchedule` 消费者实际读取的字段，提炼 `SlimScheduleGame` 类型（预计：gameId、gameDateEst/gameDateTimeUTC、gameStatus、gameStatusText、双方 {teamId, teamTricode, score, wins, losses}、seriesGameNumber/seriesText 等，以 grep 结果为准）。
2. `getSlimSchedule()`：用 Next 16 `"use cache"` + `cacheLife`（约 2h）缓存**瘦身后的产物**。11MB 的下载和 parse 只发生在缓存 miss 的那一次；瘦身产物 <2MB 可进 Vercel 共享数据缓存，跨 lambda 生效。实施前先读 `node_modules/next/dist/docs/` 核实 `"use cache"` 在动态 SSR 页面下的准确用法与限制（缓存函数内不得读 cookies——本函数不读）。
3. 全部消费者迁移到 slim 类型；原 `getFullSchedule` 降为 slim builder 的内部实现，不再对外导出。
4. 比赛页：`getSeasonRank` 移出关键 `Promise.all`，改为 Suspense 流式（页脚徽章不该挡整页 TTFB）；`generateMetadata` 的 schedule 兜底路径同步处理。
5. 验收：实测 slim JSON 序列化体积 <2MB；vitest 用 fixture 验证 slim 转换字段完整性。

**回退方案**（若文档核实发现 `"use cache"` 在本版本/本架构下有阻碍）：自代理路由 `/api/schedule-slim`（s-maxage CDN 缓存 + 服务端绝对 URL fetch，revalidate 生效因为响应 <2MB）。风险：preview 部署保护可能拦截自 fetch，仅生产域名可靠——故仅作回退。

**风险**：字段遗漏导致某页缺数据。缓解：迁移全靠 TypeScript strict 类型驱动（slim 类型不含的字段编译即报错），逐消费者过 tsc；不允许 `as any` 逃逸。

---

## E. 字体裁剪

现状：layout.tsx 预加载 9 个 woff2（Fira Sans 300/400/500/600/700 + Fira Code 300/500/600/700），约 120-200KB，与首屏关键请求抢带宽；zh 用户主要渲染系统 CJK 字体，收益面更小。

- 先 grep 审计 `font-light|font-medium|font-semibold|font-bold` 及自定义 fontWeight 的实际使用，只删真正未使用的字重（Fira Code 之前已审计过一轮，复核即可）。
- 改动后 dev server 浏览器前后对照关键页面（主页、比赛页、stats 表格）；出现明显字形回退（合成加粗）则回滚该字重。

---

## 验证与交付

- 每个编号项独立 commit（风格沿用 git log：`fix(api): …` / `perf(schedule): …`），可单独 revert。
- 硬门槛：`tsc --noEmit` 0 错误；`npm run test` 全绿（含新增测试：currentSeason、快照回退、投毒守卫、injuries 匹配、slim 转换）；lint 无新增回归（老 baseline 不算）。
- dev server 实测 golden path：主页、已完赛比赛详情页、球员页（观察 /api/player 单请求 + 无 4s 停顿）、standings、/injuries（Orlando case）、compare、/history。
- 7 月无直播比赛，C8 的直播行为以代码审查 + 已完赛页回归为准，开赛后无需再验。

## 实施顺序建议

A/B/C 三组内部各项彼此独立可并行；D 是最大单项，依赖 A3（同文件 api.ts，先做防护再做瘦身，避免冲突）；E 独立，放最后（需要视觉对照）。详细任务拆分见实施计划（writing-plans 产出）。
