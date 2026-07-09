# 批次 3：质量、无障碍与留存打磨 — 设计

日期：2026-07-09
状态：范围经侦察在当前 master（批次 1+2 已合）逐项核实，用户授权自主推进（[[autonomous-decision-preference]]）
来源：批次 3 侦察工作流（5 路：i18n / loading+导航 / a11y+图表 / 留存 / 小遗留），全部候选 confirmed-applies，带精确锚点。三批计划的第三批（收尾）。

## 背景

批次 1（加固）+ 批次 2（休赛期内容）已上线。本批清理批次 1 UX 审计 + 批次 1/2 评审攒下的质量/无障碍/留存欠账。全部有精确锚点，改动分散但独立。

## 范围（分 5 组，11 个任务）

### 组 Q — i18n 漏翻译（zh 体验在核心页破功）

**Q1 核心页扫（S/M 混合，多文件）**：`stats/page.tsx`（title "Stats & Rankings"、TABS 标签在模块级 const 需搬进组件或按 key 查、eyebrow "League"、"{SEASON} Season"）；`game/[id]/_components/StatsTable.tsx:128`（"Player"→"球员"，isZh 已在 scope）；`components/DateJumper.tsx:20`（"Jump to date"，需加 useLocale import）；`components/ShotChart.tsx:254`（"3-Point"，需新增 `shotChartComp.threePtZone` key，勿复用带冒号的 threePoint）；`milestones/page.tsx:141-143` + `stats/MvpLadder.tsx:88-93`（空状态，后者加 statsPage.noMvp* key）；`game/[id]/_components/GameLeaders.tsx:80`（"Game Score" tooltip）。

**Q2 game-predictor 全页 i18n（L）**：`game-predictor/page.tsx` 主组件 isZh 已在 scope，修 EmptyState/header/stat tiles/Method（~210-276）；**GameRow（line 121 起）无 isZh，需把 isZh 作为 prop 穿进去**修其内部串（"% confident"/"★ Pick"/"Spread"/"vs"/"Underdog"/"Edge"）；eyebrow "Tool"。

**Q3 player/[id] 页 i18n 扫（L，高流量，最大漏点）**：`player/[id]/page.tsx` t 已在 scope，修可见 section headers（"Profile"/"Stats Deep Dive"/"Connections"）+ tiles（"Status"/"Active"/"Estimated Total"/"No scoring data"/"{ppg} ppg × ~{gp} gp × {seasons} seasons"）+ milestone 串（"25,000+ career points (est.)" 等）。加 t.playerDetail.* key。

**Q4 屏幕阅读器标签（M）**：`DateNav.tsx`（"Previous/Next day"、"Date navigation"，t 已在 scope）；`BackToTop.tsx`（"Back to top (press T)"，需加 useLocale）；`ToastProvider.tsx:94`（"Dismiss"，ToastItem 加 useLocale）。**不做** landmark aria-label（Breadcrumb/Home/Main nav — SR-only，收益极低）。

### 组 L — loading 骨架 + 导航可发现性

**L1 loading.tsx 补齐（S，纯新增 2 行文件）**：给 8 个动态 SSR 且有服务端网络 await 的路由加 loading.tsx（复用 `about/loading.tsx` 的 PageSkeleton 模式，maxWidth/variant 按各页匹配）：`lab/game-impact`、`lab/team-trajectory`、`lab/career-arc`、`lab/explore`、`lab`（landing，grid variant）、`player/[id]/gamelog`、`draft/2026`、`season/2025-26`。**不做** iconic-*/legends/[id]（全 SSG，loading 几乎不渲染，无运行时价值）。

**L2 iconic 导航注册（S）**：`iconic-games` + `iconic-seasons` 目前只在 SiteFooter，孤立于导航。注册进 `useMoreGroups.ts`（More 组，Crown/Flame 图标已导入）+ `explore/page.tsx`（Game Archive 分类），仿批次 2 draft/recap 注册。CommandPalette 计数是动态的自动更新；"35+" placeholder 技术上仍成立，不改。

### 组 A — 图表无障碍

**A1 色盲友好（S×3，同文件）**：`PointDiffChart.tsx` W/L 细条（307-323）现在只有颜色 + hover title——加非颜色线索（W/L 字母或形状）；`ShotChart.tsx` 区域命中率 tier（276）只有绿/琥珀/红色——加 ▲/▼/– 箭头 glyph；`ShotChart.tsx` 2PT-made（绿圆 r4）vs 3PT-made（紫圆 r5）+ 图例（231/235 同为 r4 纯色差）——给 2PT/3PT 不同形状（圆 vs 菱形/环）并同步图例。

**A2 触屏 tooltip（S×2 + M×2）**：仿 `ScatterExplorer.tsx`（svg 加 touch-none + onPointerMove/Down/Leave + nearest-point）。近乎 drop-in（S）：`TakeoverChart.tsx`（onMouseMove/Leave→onPointer* + onPointerDown + 改"hover"文案）、`ShotHeatmap.tsx`（zone path onMouseEnter/Leave→onPointerEnter/Leave）。需 SVG 级 pointer 层（M）：`TrajectoryChart.tsx`（r=5 小点，需父 svg nearest-point）、`PointDiffChart.tsx`（每格是导航 Link，需解耦 hover-preview 与导航——单透明 pointer 层设 hovered，仅显式 tap 才导航）。

### 组 R — 留存机制（批次 2 明确留到批次 3；仅 quiz，predictor 延后）

**R1 quiz 持久化 + 连胜（M）**：新 `src/lib/quizStats.ts`（localStorage，SSR-guard 仿 favorites.ts/recentlyViewed.ts，key `nba-tracker-quiz-stats` 无碰撞）存 {totalRight,totalWrong,curStreak,bestStreak,lastPlayedDate,byMode}；在 quiz handlePick 里记录；组件用 FollowStrip 的 post-mount gate（mounted useEffect + `eslint-disable react-hooks/set-state-in-effect`）读取——**不在 useState initializer 读 localStorage**。

**R2 每日挑战模式（M）**：加第 5 个 mode "daily"。确定性是重点：`sample()`/`buildQuestion()` 加可选 `rng` 参数（默认 Math.random），daily 模式传 date-hash seed 的 mulberry32；seed 复用 recap.ts hashString（导出）或 DailyIconicPick 的 pickFor hash；日期在 mounted-gate effect 里 `formatDate(new Date())` 派生存 state（避免 render 里的 impure new Date()/Math.random）；quizStats 里存 per-day 已玩标记防刷。

**R3 分享卡（S）**：复用现成 `ShareButton.tsx`（已本地化），在成就 tile（quiz/page.tsx ~317-332）渲染 `<ShareButton text={...} />`，文案客户端从 score+streak 拼。

**不做**：predictor 的"我的预测 vs 模型 + 赛季命中率"——休赛期 predictor 整页空（无 gameStatus===1 比赛可预测，也无新 final 可判分），建了是死 UI 且无法端到端测。等赛季回归（约 10 月）单独做。

### 组 B — DRY + 小遗留

**B1 lib/dates.ts 统一（M）**：新 `src/lib/dates.ts` 出 `formatGameDate(dateOrIso, locale, opts?)` + `formatRelative(ms, locale, variant?)`，迁移 13 个手写 `isZh?'zh-CN':'en-US'` 的 toLocaleDateString 显示站点 + 3 个各自实现的 relative-time（NewsFeed formatPublished / UpdatedPill / injuries daysAgo，注意边缘文案差异用 variant 参数）。**排除** `api.ts:657` formatDate——它是 en-CA/ET 的 schedule date-KEY 生成器（8 处用作键，非显示），折进去会破坏 scoreboard 键控。带 vitest。

**B2 小修复打包（S 各项，一个任务）**：`injuries/page.tsx` getInjuries 补 isValidInjuryFeed 形状守卫 + AbortSignal 超时（port 批次 1 route 的）；`public/sw.js` 提取 putAndTrim helper（消 pages/images 两处重复）+ 用 event.waitUntil 包住 put/trim；3 处 `font-black`→`font-bold`（player 页 ×2 + TeamHero，900 从未加载在合成加粗）；`draft/2026/page.tsx` 5 个 `<th>` 加 scope="col"；`GameAutoRefresh.tsx` interval 加 ±3s jitter（仿 LiveScoreRefresher）；删 6 个 orphaned playerStats locale key（recentGames/matchup/scoringTrend/avgLabel/highLabel/lowLabel，三个 locale 文件各 6 行；**勿动** teamPage.recentGames 和 playerStats.date/wl，这些在用）。

## 非目标

- predictor pick 功能（休赛期死 UI，延后到赛季批次）。
- landmark aria-label i18n（SR-only 收益极低）。
- SSG 路由（iconic-*/legends）的 loading.tsx（几乎不渲染）。
- 代码健康大重构（CompareClient 1181 行、player page monolith、四套 SVG 球场统一）——非本批质量打磨范畴，留待专门重构轮。

## 关键约定

- 双语：server 用 getLocale()/getTranslations，client 用 useLocale()；能加 t.* key 就加（新 key 三个 locale 文件同步 en/zh/types），零散串用 inline isZh。
- React 19 purity（eslint 强规则）：不在 render 里裸调 Date.now()/Math.random()/new Date()（用 lazy-init 或 mounted-gate effect + 现有 eslint-disable 注释先例）；localStorage 只在 post-mount effect 读。
- 图表 pointer 改造统一仿 ScatterExplorer；色盲线索用非颜色冗余编码 + 尽量走 theme --success/--danger 变量。
- locale 文件多任务会碰——**新增 key 用不同命名空间、删除限指定行**，施工顺序上让碰 locale 文件的任务串行。

## 验证与交付

- 每任务独立 commit，可单独 revert。硬门槛：tsc 0 错、`npm run test` 全绿（含新增 quizStats/dates 测试）、lint 无新增回归（0/0 基线）、生产 build 过。
- **UI 硬要求**：i18n 改动、图表 a11y、quiz 留存必须 dev server 浏览器实测 golden path（本机 AdGuardHome 占 127.0.0.1:3000，用自定义端口起 dev；见 [[batch-plan-status]]）。zh + en 两种 locale 都要看。色盲线索、触屏 tooltip 要实际验证呈现。

## 施工顺序

Q1→Q2→Q3→Q4（i18n，Q1/Q4 碰 locale 文件串行）；L1（loading，独立可先）→L2（导航，碰 useMoreGroups/explore）；A1→A2（图表，A1/A2 都碰 PointDiffChart/ShotChart 需串行）；B1（dates）→R1→R2→R3（quiz 链）；B2（小修复，碰 locale 删 key 放最后避冲突）。组间大体独立，locale 文件是主要串行约束。
