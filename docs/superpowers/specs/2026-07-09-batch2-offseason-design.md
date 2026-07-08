# 批次 2：休赛期内容层 — 设计

日期：2026-07-09
状态：范围经数据源实测确定，用户授权自主推进（[[autonomous-decision-preference]]）
来源：批次 2 侦察工作流（5 路实测 ESPN/CDN/BDL + 代码插入点勘察）。三批计划的第二批。

## 背景

现在是 2026 年 7 月休赛期。主页在这个季节退化成空状态：`BestOfNightCard`（只回看 7 天）、`TodayStars`、`HomeExtra` 全部渲染 null；`GamesList` 显示"无比赛"面板。而 7 月正是自由市场 + 选秀后最热的产品窗口。本批补齐一个"休赛期内容层"，全部基于**已验证可用**的数据源。

## 数据源实测结论（决定范围）

- **ESPN 交易** `.../nba/transactions`：`?limit=N`（≤500，过大静默回落 25，需 cap）。字段仅 `{date, description(纯文本散文), team{id,abbreviation,displayName,logos[]}}`。无金额、无结构化 player/type 字段、无按队端点（前端过滤）、只当日历年。现应用 `slice(0,30)`。
- **ESPN 新闻** `.../nba/news`：`?limit=50` 上限 ~50 篇，`categories[]` 带 team/athlete/topic 标签。现应用只取 6。
- **ESPN 选秀** `.../nba/draft?year=2026`：完整真实 2026 结果，`picks[]` 60 个 + `teams[]` 30 个。ESPN athlete.id ≠ NBA personId。
- **SEASON_SNAPSHOT**：球队级（冠军/战绩/每场比分），无球员级数据。

**两处不可用（本批不做，已确认）**：
- **工资/薪资表**：BDL 合同端点需 GOAT 档，本地 key 免费档 → 全 401。等 key 升级再单独做。
- **夏联 live 页**：CDN 未发布 2026-27，无夏联 slate。等 CDN 翻页。

## 范围（5 项）

### T1. games.ts 前缀防御（安全修复，先行）

**问题**：`isCountedSeason(gameId) = !isPreseason && !isAllStar`，对夏联前缀（gameId 前 2 位 13/14/15/16）和 NBA Cup（前 3 位 006）都返回 true。CDN 一发布 2026-27，夏联比赛会污染 `getRecentForm` 等一切 counted-season 消费方。

**方案**：`src/lib/games.ts` 加 `isSummerLeague(gameId)`（前 2 位 ∈ {13,14,15,16}）和 `isCup(gameId)`（前 3 位 === "006"）；`isCountedSeason` 改为显式白名单：仅 `isRegular || isPlayoff || isPlayIn` 为 true（把 preseason/allstar/summerleague/cup 全排除）。加 vitest 覆盖各前缀。纯防御，当前无夏联数据也不改变任何现有行为（现 feed 无这些前缀）。

### T2. FA 交易追踪深化 + 新闻 feed

**`/api/transactions`**：`slice(0,30)` → `?limit` 参数（默认 150，cap 500）。保留现有 CleanedTransaction 形状，新增从 description 轻量解析出的 `players`（正则抓 `位置缩写 + 人名`，如 "C Felix Okpara"）和 `kind`（signed/traded/waived/claimed/other，关键词匹配）——**明确标注是 best-effort 文本解析，解析不出就留空/other，绝不编造**。带 team logo url。
**`/api/news`**：新增 `?limit`（默认 30，cap 50），返回 `categories` 里的 team/athlete/topic 标签供分组。
**`/transactions` 页**：现有按日期分组时间线 + 分类 chip 保留；新增 (a) 球队过滤 chips（从 `[...new Set(teamAbbr)]` 派生，点击过滤）；(b) 交易项渲染带 team logo + 解析出的球员链到 /player（名字匹配 player-index，匹配不到就纯文本）+ kind 色标。双语。
**新闻**：`/news` 页（若存在）或交易页附带的新闻 rail 提升取数到 30，按 topic 分组。

### T3. /draft/2026 选秀页

新路由 `src/app/draft/2026/page.tsx`（server，仿 momentum.tsx 骨架）。新 `/api/draft?year=2026` 代理 ESPN draft 端点（服务端 fetch + 超时 + s-maxage 长缓存，历史选秀不变）。渲染：按 round 分组的 pick-by-pick 表，每行 overall/pick、球员名（best-effort 名字匹配到 /player/[id]，否则纯文本 + ESPN headshot）、位置、学校、NBA 队 logo。顶部状元卡片。双语。
- `/draft-classes` 加 "2026" 区块入口链到新页（现有页按 active player index 分组，2026 新秀还没进 index，所以是独立入口而非合并）。
- `team/[tricode]` 页加"本队 2026 选秀"chips（从 draft 数据按 teamId 过滤；小 panel，仿 TeamLegends 自包含模式）。
- 注册到 3 个发现面：`useMoreGroups.ts`、`explore/page.tsx`、`sitemap.ts`。

### T4. 2025-26 赛季回顾页

新路由 `src/app/season/2025-26/page.tsx`（server）。全部从 `SEASON_SNAPSHOT` + 重走 `getFullSchedule`（best-games/records 逻辑是 file-local 不可 import，重实现或读快照）派生：
- **冠军卡**：尼克斯 4-1 马刺（从快照季后赛 004 场次推导，复用 /history 的推导），Finals 逐场比分。
- **赛季之最**：最高/最低团队得分、最大分差等（从快照 finishedGames 算，仅 002/004）。
- **年度最佳比赛**：最接近/最高分（从快照算）。
- **奖项**：读 `awards.json`，**仅当 2025-26 行非占位**（非 "TBD"/"-"）才渲染该 section；占位则整段隐藏（优雅降级——用户填 awards.json 后自动出现）。
- 链到 /history、/all-time-leaders、/records 等既有页。
- 注册到 3 个发现面。

### T5. 休赛期主页 hero

`src/app/page.tsx` 在 `<HomeClient>` **上方**加一个 server 段 `<OffseasonHero>`（新组件），仅在休赛期（无当日比赛 / SeasonProgress 判定 offseason）渲染：
- 2025-26 冠军 banner（尼克斯，链 /season/2025-26）。
- 到 2026-27 开赛的倒计时（目标日用一个**明确标注"预计"的估计常量** `NEXT_SEASON_START_ESTIMATE`，CDN 发布后可更新；文案"预计 10 月下旬回归 / est. late October"）。
- 最新 5 条交易 strip（走 `/api/transactions`，链 /transactions）。
- 3 条热点新闻标题（走 `/api/news`，链外部）。
- 链到 /draft/2026 和 /season/2025-26。
- 双语；在赛季中不渲染（不影响现有主页）。

## 非目标（本批不做）

- 工资/薪资表（BDL GOAT 档挡死）、夏联 live 页（CDN 未发布）——见上。
- 留存机制（quiz streak、predictor 用户选、daily 种子挑战）——留批次 3。
- awards.json / 2026 FMVP 的内容填充——需用户人工数据，回顾页对占位优雅降级即可。
- 批次 1 攒下的遗留清单（locale 孤儿键、/injuries 页守卫、sw.js 去重等）——批次 3。

## 关键约定

- 全部新页仿 `momentum.tsx` server-page 模板：`Breadcrumbs` + `PageHeader`（`updatedAt={getScheduleAge()}`）+ 内容 + `RelatedPages`；双语走 `getLocale()`/inline isZh。
- 新 API route：ESPN/CDN 数据用 `next: { revalidate }`（选秀历史数据 86400，交易/新闻 1800）+ AbortSignal 超时 + 形状守卫（学批次 1 C11c：非预期 shape 返回错误态不缓存空）。
- 文本解析（交易 players/kind）：best-effort，解析失败留空，UI 对空优雅降级，绝不编造数据。
- 名字匹配 ESPN→personId：查 player-index，匹配到才链 /player，否则纯文本 + ESPN headshot/link。
- 新页必须注册到 useMoreGroups + explore + sitemap 三处才可发现。

## 验证与交付

- 每编号项独立 commit，可单独 revert。
- 硬门槛：`tsc --noEmit` 0 错、`npm run test` 全绿（含新增：games 前缀、交易解析、draft 投影、recap 派生）、lint 无新增回归、生产 build 通过。
- **UI 硬要求**：每个新页/主页 hero 必须开 dev server 在浏览器实测 golden path + 休赛期空状态（本机 AdGuardHome 占 127.0.0.1:3000，dev 时 localhost 偶发 401 是它，非应用问题——见 [[batch-plan-status]]）。
- ESPN 端点从本机可直连（node fetch + UA header）；Vercel 上是服务端 fetch，同样可用。

## 施工顺序

T1（安全，独立）→ T2（交易/新闻，独立）→ T3（选秀，独立）→ T4（回顾，独立）→ T5（主页 hero，链前四者，最后）。T2-T5 数据层彼此独立可并行起草；T5 依赖前四者的路由存在（做交叉链接）。
