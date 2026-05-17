# NBA Tracker 重构记：从 UI 拆分到现代 Web 平台

**作者:** FXY
**日期:** 2026-05-17
**分类:** 技术分享
**标签:** Next.js 16、React 19、Tailwind 4、Service Worker、a11y、CSS

---

[上一篇](https://nba.xpy.me/article)记录了 NBA Tracker 第一版的 8800 行实现：服务端组件 + ISR、11MB 赛程的内存缓存、纯 SVG 投篮图、Suspense 流式渲染。

这是一篇续篇，记录从那一版到现在大概 30000 行的演进。不讲新增了哪些功能（功能上变化不大），讲架构层面的几个关键决策：UI 重构、共享原语抽象、现代 CSS 落地、PWA 完整化、a11y 工程化。

代码全部开源在 `github.com/fxy2026/nba-tracker`，每一处都可以对照源码看。

---

## 0x01 从 BracketTree 拆分说起

季后赛对阵图 `BracketTree.tsx` 是这次重构的起点。911 行单文件，混在一起的有：

- 6 个纯函数：`parseGameId` / `projectFutureSeries` / `winnerOf` / `isOnChampionPath` / `makeProjectedFull` / `makeProjectedPartial`
- 7 个 React 组件：`TeamRow` / `SeriesCard` / `CandidatesRow` / `ProgressDots` / `Connector` / `RoundLabel` / `ConfHalf`
- 两套布局：桌面 SVG 树状 + 移动端按分区堆叠

每次想动一个细节——比如改卡片的种子数显示位置——都要在 911 行里翻很久才能找到对应位置。

**拆分原则**：

1. **纯函数下沉到 `lib/`**。无 React、无 JSX、无副作用的代码全部抽到 `lib/`，纯 TS。这样可以独立测试，也方便 server component 直接调用。
2. **组件单一职责**。一个文件一个组件（或紧密耦合的小组件组）。
3. **视觉零变化**。重构期间 CSS 类名、prop 形状一个字符都不能改，确保渲染结果 byte-identical。

拆完结构：

```
src/lib/playoffs.ts                        # 198 行 — pure helpers + types
src/components/bracket/
  ├── SeriesCard.tsx                       # 220 行 — 系列赛卡片 + 队伍行
  ├── Connector.tsx                        # 50 行  — SVG 连线
  ├── ConfHalf.tsx                         # 184 行 — 一半分区的组合
  ├── BracketMobile.tsx                    # 83 行  — 移动端按分区垂直堆叠
  └── BracketDesktop.tsx                   # 100 行 — 桌面 SVG 树状布局
src/components/BracketTree.tsx             # 163 行 — 组合入口
```

`BracketTree.tsx` 从 911 行变成 163 行的"组合入口"，只负责把数据传给桌面或移动布局：

```tsx
export default function BracketTree({ schedule }: Props) {
  const series = useMemo(() => parsePlayoffSeries(schedule), [schedule]);
  // 桌面用 hidden md:block，移动用 md:hidden。两套布局共享同一份 series 数据。
  return (
    <section className="my-8">
      <BracketDesktop series={series} className="hidden md:block" />
      <BracketMobile series={series} className="md:hidden" />
    </section>
  );
}
```

同样的套路用在 `game/[id]/page.tsx` (1026 行 → 243 行 + 13 个 `_components/` + `lib/game-stats.ts`) 和 `team/[tricode]/page.tsx` (786 行 → 295 行 + 6 个 `_components/` + `lib/team-rank.ts`)。

**Next.js 的 `_components/` 约定**：在 App Router 里，下划线开头的文件夹**不会被识别为路由**，所以可以放在路由文件夹下作为同 colocate 的私有组件。这避免了 `src/components/game/` 这种全局命名空间——只在 game 详情页用到的子组件就该和它一起。

```
src/app/game/[id]/
  ├── page.tsx                             # 243 行，纯组合
  ├── error.tsx
  ├── loading.tsx
  ├── opengraph-image.tsx
  └── _components/                         # ← 这些不会变成 /game/[id]/_components 路由
      ├── GameHero.tsx
      ├── GameLeaders.tsx
      ├── GameHeadlines.tsx
      ├── GameMeta.tsx
      ├── StatsTable.tsx
      ├── BoxScoreSection.tsx
      ├── ShotChartSection.tsx
      ├── PlayByPlaySection.tsx
      ├── KeyMomentsSection.tsx
      ├── ReplaySection.tsx
      ├── ScoringFlowSection.tsx
      ├── StatsRadar.tsx
      └── ShootingEfficiency.tsx
```

---

## 0x02 提取共享原语：去重 80 个 import

UI 拆分暴露出大量重复代码。最典型的是 NBA CDN 的 URL 拼接，散落在 31 个文件：

```typescript
// 31 个文件都在写：
<Image src={`https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`} ... />
<img src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png`} ... />
```

抽到 `src/lib/teamUrls.ts`：

```typescript
export function teamLogoUrl(teamId: number | string, size: "L" | "M" | "S" = "L"): string {
  return `https://cdn.nba.com/logos/nba/${teamId}/global/${size}/logo.svg`;
}

export function playerHeadshotUrl(personId: number | string, dimensions = "1040x760"): string {
  return `https://cdn.nba.com/headshots/nba/latest/${dimensions}/${personId}.png`;
}
```

类似的还有 `gameId` 前缀判断：

```typescript
// src/lib/games.ts
// NBA 用 gameId 前 3 位编码比赛类型：001=季前赛, 002=常规赛, 003=全明星, 004=季后赛, 005=附加赛
export function isPreseason(gameId: string): boolean { return gameId.startsWith("001"); }
export function isRegular(gameId: string): boolean { return gameId.startsWith("002"); }
export function isAllStar(gameId: string): boolean { return gameId.startsWith("003"); }
export function isPlayoff(gameId: string): boolean { return gameId.startsWith("004"); }
export function isPlayIn(gameId: string): boolean { return gameId.startsWith("005"); }
// 排除非 NBA 球队的友谊赛（季前赛 + 全明星）
export function isCountedSeason(gameId: string): boolean {
  return !isPreseason(gameId) && !isAllStar(gameId);
}

export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
}
```

之前 12+ 个地方写过 `wins / (wins + losses || 1)`，22+ 个地方写过 `gameId.startsWith("002")`。统一之后未来要改判定规则只动一个文件。

新增的 lib 模块清单：

| 文件 | 职责 | 替代了多少重复 |
|------|------|----------------|
| `lib/playoffs.ts` | 季后赛对阵图纯函数 | BracketTree 内联 |
| `lib/game-stats.ts` | 比赛页自动叙事 helpers | game/[id] 内联 |
| `lib/team-rank.ts` | 分区排名计算 | team/[tricode] 内联 |
| `lib/teamUrls.ts` | NBA CDN URL builders | 46 处 |
| `lib/games.ts` | gameId 谓词 + winPct | 30+ 处 |
| `lib/timezone.ts` | 本地时区计算 | 5 个文件的内联 |
| `lib/recentlyViewed.ts` | localStorage 访问记录 | 新增功能 |
| `lib/allTimeLeaders.ts` | NBA 历史球员静态数据 | 替换错误的 playerIndex 用法 |
| `lib/playerAliases.ts` | 球员搜索别名表 | 新增功能 |

总共消除 80+ 处重复 import 和重复字符串。

---

## 0x03 时区：一个看似简单的 bug 渗透全栈

NBA 官方赛程用美东时间编码。北京时间凌晨开打的比赛，在赛程数据里写的是前一天。

最初的 `DateNav.tsx` 直接用 `new Date()` 算"今天"——意味着 server-side 跑 ET（Vercel 默认 UTC，但代码里强转 ET），client-side 跑用户本地时区。两边不一致：

- 中国用户北京时间 10am 5/17 打开网站
- Server side `formatDate(new Date())` → 美东 10pm 5/16 → "今天 = 5/16"
- Client side `new Date()` → 北京 10am 5/17 → 但 DateNav 用了 server 传下来的 "5/16"
- 用户看到："今天 5/16，没有比赛" ← ？

修正方向：**把"用户的本地时区"当成 first-class concept 沿请求链一路传**。

```typescript
// src/lib/timezone.ts
export function localTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function dateInTz(d: Date, tz: string = localTz()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
```

然后 `/api/games` 接受 `?tz=Asia/Shanghai`：

```typescript
// src/app/api/games/route.ts
const tz = searchParams.get("tz") || "America/New_York";
const matched: ScheduleGame[] = [];
for (const gd of schedule) {
  for (const g of gd.games) {
    if (!g.gameDateTimeUTC) continue;
    // 把每场比赛的 UTC 开球时间换算到用户时区，看它落在哪一天
    if (dateInTz(new Date(g.gameDateTimeUTC), tz) !== date) continue;
    matched.push(g);
  }
}
```

`/api/calendar` 同样接受 `?tz=`。客户端 `HomeClient.tsx` 在 `useEffect` 里检测本地时区：

```tsx
useEffect(() => {
  if (searchParams.get("date")) return; // 用户明确指定了日期就不动
  const localToday = dateInTz(new Date(), getLocalTz());
  if (localToday !== initialDate) setSelectedDate(localToday);
}, []);
```

注意两个分离的概念：

- **"NBA 的今天"** = ET today，用于 `live scoreboard` endpoint。NBA 这个 endpoint 只返回当前 ET 日的比赛，所以判定"哪场是 live 比赛"必须用 ET。
- **"用户的今天"** = local tz today，用于显示哪一格高亮、`/api/games?date=` 该取哪天的比赛。

这两个不能混。混了就是上面那个 bug。

类似的修复扩散到：`DateNav.tsx`、`HomeClient.tsx`、`GamesList.tsx`、`/api/games`、`/api/calendar`、`/app/calendar/page.tsx`、`back-to-back/page.tsx`、`admin/page.tsx`。每一处都在用 `Intl.DateTimeFormat` + 用户时区，不用 `new Date().toISOString()`（那个返回 UTC）也不用 `formatDate(new Date())`（那个强转 ET）。

---

## 0x04 共享 UI 原语 + 跨页面发现

提取共享 lib 后，下一步是提取共享组件。识别出 3 个跨多页面用到的模式：

**`<PageHeader>`**：每个页面顶部都有的眉头 / 标题 / 副标题 / 操作槽。

```tsx
interface PageHeaderProps {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  updatedAt?: number | null;  // ms since data was fetched — 渲染 <UpdatedPill>
}
```

`updatedAt` 接收 `getScheduleAge()` 的返回值（schedule cache 距今 ms 数），下面挂一个客户端 `<UpdatedPill>` 实时更新"X 分钟前"：

```tsx
// src/components/UpdatedPill.tsx
export default function UpdatedPill({ ageMs }: { ageMs: number | null }) {
  const { locale } = useLocale();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (ageMs === null) return null;
  const total = ageMs + tick * 30_000;
  // ... 格式化为 "刚刚更新 / X 分钟前 / X 小时前"
}
```

`getScheduleAge()` 是新加到 `lib/api.ts` 的 sync getter：

```typescript
let scheduleCache: { data: ScheduleDate[]; ts: number } | null = null;

export function getScheduleAge(): number | null {
  return scheduleCache ? Date.now() - scheduleCache.ts : null;
}
```

接到 17 个 schedule-derived 页面（`/standings`、`/power-rankings`、`/streaks`、`/momentum` ...），每个页面标题下显示"X 分钟前更新"——用户看到的是"NBA 的赛程数据缓存了多久"，对实时性预期校准。

**`<Breadcrumbs>` + `<RelatedPages>`**：跨页面发现。

之前每个详情页都是死胡同——从 `/game/{id}` 看完比赛只能浏览器回退。现在标准化两个组件：

```tsx
// 顶部
<Breadcrumbs items={[
  { label: round.full, href: "/" },
  { label: `${team1.tricode} vs ${team2.tricode}` },
]} />

// 底部
<RelatedPages
  eyebrow={isZh ? "继续探索" : "Keep exploring"}
  pages={[
    { href: `/team/${home}`, label: "球队主页", icon: Users },
    { href: `/h2h?t1=${home}&t2=${away}`, label: "历史交锋", icon: GitCompareArrows },
    // ... 5-6 个上下文相关链接
  ]}
/>
```

每个详情页 / 分析页都加上这两个组件。**100% 覆盖**意味着用户在任意一个数据视图都能跳到相关的 4-6 个视图。SEO 也会受益——内部链接图密度上升。

---

## 0x05 现代 CSS：去 JS 化

这几年 CSS 加了很多以前需要 JS 才能做的能力。这次有几个真的落地：

### `text-wrap: balance`

```css
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
```

`balance` 让浏览器在标题断行时计算最佳分布，避免"最后一行就一个字"。`pretty` 给段落用——稍微弱一点，但优化最后一行密度。

一行 CSS，全站质感拉满。Chrome 114+ / Edge 114+ / Safari 17.4+ 已支持。

### `:has()` 选择器

之前要做"父元素响应子元素状态"必须 JS：

```jsx
<div className={isChildHovered ? "active" : ""} onMouseEnter={...}>
  <Link onMouseEnter={() => setIsChildHovered(true)}>...</Link>
</div>
```

现在 CSS：

```css
/* glass-tile 含 Link/Button 在 hover 时整张卡片提亮 */
.glass-tile:has(a:hover),
.glass-tile:has(button:hover) {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-elevated);
}

/* 卡片内任意子元素 focus-visible 时显示焦点环 — 键盘用户友好 */
.glass-tile:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Chrome 105+ / Edge 105+ / Safari 15.4+ / Firefox 121+ 支持。覆盖率足够。

### 滚动驱动动画

```css
.scroll-progress-rail::after {
  content: "";
  display: block;
  height: 100%;
  background: var(--gradient-accent);
  transform-origin: 0 50%;
  transform: scaleX(0);
  animation: scroll-progress-grow linear;
  animation-timeline: scroll(root);
  animation-range: 0 100%;
}
@keyframes scroll-progress-grow { to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) {
  .scroll-progress-rail::after { animation: none; }
}
```

页面顶部 2px 的进度条，跟着 `scroll(root)` 时间线走。**零 JS、零 scroll listener、零 jank**。

之前类似效果需要：

```javascript
window.addEventListener("scroll", () => {
  const progress = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  bar.style.transform = `scaleX(${progress})`;
}, { passive: true });
```

每次滚动事件都触发布局抖动。现在 CSS 自己搞定，浏览器优化掉合成层。Chrome 115+ / Edge 115+ 原生支持，旧浏览器静默忽略——进度条不显示，但不报错。

### 容器查询

```css
.cq-grid > * { container-type: inline-size; }

@container (max-width: 320px) {
  .glass-tile.cq-adapt { padding: 12px; }
  .glass-tile.cq-adapt > .cq-row {
    flex-direction: column;
    gap: 8px;
  }
}
```

同一个卡片放在三列网格里和放在单列侧栏里自动呈现不同密度。区别于 media query：媒体查询跟视口走，容器查询跟父容器宽度走。三列网格在 1200px 视口下每列只有 ~380px，但媒体查询不知道这件事；容器查询知道。

### `text-wrap` 和 `:has()` 之外，还有一个隐藏的 iOS 修复

iOS Safari 在 input 字体小于 16px 时会自动放大屏幕。这个行为很烦，但只发生在 mobile：

```css
@media (max-width: 767px) {
  input[type="date"],
  input[type="search"],
  input[type="text"],
  input[type="email"],
  input[type="password"],
  textarea { font-size: max(16px, 1em); }
}
```

只针对会获取焦点的几种 input，紧凑的 filter chip 之类的小字按钮不受影响。

---

## 0x06 Speculation Rules：预测性导航

Chrome 122+ / Edge 122+ 上线了 Speculation Rules API。在 HTML 里放一个 `<script type="speculationrules">` 告诉浏览器：哪些 URL 值得预先 prefetch 或者 prerender。

```tsx
// src/components/SpeculationRules.tsx
const rules = {
  prefetch: [
    {
      source: "list",
      urls: ["/", "/standings", "/stats", "/search", "/calendar"],
    },
  ],
  prerender: [
    {
      source: "document",
      where: {
        and: [
          { href_matches: "/*" },
          { not: { href_matches: "/admin*" } },
          { not: { href_matches: "/api/*" } },
        ],
      },
      eagerness: "moderate",
    },
  ],
};

return (
  <script
    type="speculationrules"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
  />
);
```

两个层级：

1. **prefetch**: 站点固定的 5 个高频入口（首页、排名、数据、搜索、日历）一次性 prefetch。
2. **prerender** + `eagerness: "moderate"`: 用户鼠标停留在站内任意非 admin / 非 api 链接 **~200ms** 后，浏览器在后台完整 prerender 那个页面的 RSC stream。点击的时候页面已经渲染好了，**切换是 0ms**。

不支持的浏览器会忽略整个 script tag。零副作用。

### 配合 Service Worker 的注意事项

Service Worker 的 fetch listener 不能拦截 prerender 请求（会被识别为"speculation"），所以两套预取机制是叠加的，不冲突：

- Speculation Rules → 浏览器主动 prerender
- Service Worker → 实际请求时按 cache 策略响应

---

## 0x07 Service Worker：bucketed caching

之前的 PWA 只有 manifest.json + apple-touch-icon。"安装到主屏"能工作，但**断网就废了**。

加了 `public/sw.js`，按请求类型分桶缓存：

```javascript
const CACHE_VERSION = "v1";
const CACHE_STATIC = `nba-tracker-static-${CACHE_VERSION}`;
const CACHE_PAGES = `nba-tracker-pages-${CACHE_VERSION}`;
const CACHE_IMAGES = `nba-tracker-images-${CACHE_VERSION}`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // /api/* 永远不拦截 — 实时比分必须新鲜
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // 导航 HTML: network-first，离线降级到 "/" shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  const bucketName = bucket(url);
  if (!bucketName) return;

  // _next/static 和字体: cache-first（内容哈希过，永远不会 stale）
  // cdn.nba.com 头像和 logo: stale-while-revalidate
  // ...
});
```

设计要点：

1. **`/api/*` 永远 passthrough**。直播比分不能给用户看缓存。
2. **HTML network-first + offline shell fallback**。在线时永远拿新数据；断网时拿缓存的 HTML 或者 "/" 首页 shell。
3. **`_next/static/` cache-first**。Next 构建的 static asset URL 是内容哈希的，比如 `/_next/static/chunks/page-abc123.js`，所以一个 URL 对应永久不变的内容，可以无限期缓存。
4. **图片 stale-while-revalidate**。NBA 头像更新得慢，先显示缓存，后台刷新。
5. **版本化缓存**。`CACHE_VERSION = "v1"`，每次有破坏性 deploy 就 bump。`activate` 时清掉所有不匹配的旧缓存，避免新部署后老 chunk 僵尸服务。

注册策略——**不和 LCP 抢资源**：

```tsx
// src/components/SwRegister.tsx
useEffect(() => {
  if (process.env.NODE_ENV !== "production") return; // 开发模式跳过，HMR 会冲突
  if (!("serviceWorker" in navigator)) return;

  const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" });
  if ("requestIdleCallback" in window) {
    requestIdleCallback(register);
  } else {
    setTimeout(register, 2000);
  }
}, []);
```

`requestIdleCallback` 把注册放到浏览器空闲时间——LCP 之后，TTI 之前。

配合 `<OnlineStatus>` 顶部横幅（断网时弹红条 / 恢复时绿条 2.5 秒），PWA 体验现在是：**装到主屏 → 断网也能看 → 联网时无感更新**。

### iOS Safari 的特殊处理

iOS Safari **永远不会触发** `beforeinstallprompt` 事件。这意味着 Android / desktop Chrome 那一套"点 Install 按钮就装"在 iOS 不工作。iOS 必须用户手动 Share → Add to Home Screen。

`InstallPrompt` 组件做了 UA 检测：

```tsx
function isIosSafariNonStandalone(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (!iOS) return false;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (!isSafari) return false;
  // 已经安装运行在 standalone 模式 → 不显示
  if ((window.navigator as any).standalone === true) return false;
  return true;
}
```

是 iOS Safari + 没安装 → 弹"点击 Safari 分享按钮 → 添加到主屏幕"提示卡片（没有 Install 按钮，纯说明 + 关闭按钮）。

---

## 0x08 a11y 不是"加个 aria-label"那么简单

之前以为 a11y 就是给图标按钮加 `aria-label`。审计完发现更复杂的是**焦点管理**和 **SVG charts**。

### 焦点陷阱（Focus Trap）

CommandPalette 和 Teams modal 之前是这样：键盘用户按 Tab 可以**跳出 modal 跑到背景的元素**。这不符合 dialog 的 WAI-ARIA 规范。

标准 focus trap 实现：

```tsx
useEffect(() => {
  if (!open) return;

  const previouslyFocused = document.activeElement as HTMLElement;
  const dialog = dialogRef.current;
  if (!dialog) return;

  const focusables = dialog.querySelectorAll<HTMLElement>(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  first?.focus();

  function trap(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  document.addEventListener("keydown", trap);
  return () => {
    document.removeEventListener("keydown", trap);
    previouslyFocused?.focus?.(); // 关闭时焦点回到触发按钮
  };
}, [open]);
```

要点：

1. 记录打开前 active element，关闭时还回去。屏幕阅读器用户不会"丢失"上下文。
2. Tab 到最后一个可聚焦元素时按下 Tab → wrap 到第一个。Shift+Tab 在第一个 → wrap 到最后一个。
3. 初始焦点放到第一个可聚焦元素（一般是 close button 或 search input）。

### SVG 图表的可访问性

整站有 5 个 SVG chart 组件：`PointDiffChart`、`PlayerShotChart`、`ShotHeatmap`、`ShotChart`、`ScoringFlow`。屏幕阅读器读它们就是"图片图片图片"——没语义。

最低限度修法：

```tsx
<svg
  viewBox="..."
  role="img"
  aria-label={isZh ? "近 15 场净胜分趋势" : "Last 15 games point differential trend"}
>
  {/* paths, circles, text */}
</svg>
```

`role="img"` 告诉屏幕阅读器把整个 SVG 当一张图来读，配合 `aria-label` 给出语义化的摘要。用户不会听到每个 `<circle>` 的坐标，而是听到这张图在表达什么。

更完整的做法是用 `<desc>` 元素描述每个数据点，但对这种聚合趋势图来说，一句摘要够了。

### body 滚动锁

modal 打开时背景可以滚动是 a11y 反模式（也是 mobile 反模式——用户不知道自己在 modal 里还是页面里）。

```tsx
useEffect(() => {
  if (!open) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = prev;
  };
}, [open]);
```

cleanup 必须还原原始值（不是写死 `"auto"`），否则套娃 modal 关闭后顶层 modal 也会丢失锁。

---

## 0x09 数据准确性：标签错比 bug 还可怕

UI 重构期间发现一类隐藏问题：**字段名和实际含义不一致**。

NBA CDN 的 `playerIndex.json` 有 `pts/reb/ast` 三个字段：

```typescript
interface PlayerInfo {
  personId: number;
  firstName: string;
  lastName: string;
  // ...
  pts: number;
  reb: number;
  ast: number;
}
```

字段名让你以为是"得分"。实际含义是：**该球员上一个完整赛季的场均得分**（如果今年没打就是 0）。而且——**playerIndex 只包含现役球员**。乔丹 2003 年退役不在里面，张伯伦 1973 年退役更不在。

`/all-time-leaders` 当时按这个字段排序，标题写"NBA 历史排行榜"，结果显示：

1. Luka Dončić 33.5 PPG
2. SGA 31.1
3. Anthony Edwards 28.8
4. ...

历史上没人能场均超 30 — 乔丹生涯 30.12、张伯伦 30.07 才是前二。这个页面字面上**在主动给用户假信息**。

修法：

```typescript
// src/lib/allTimeLeaders.ts — 手工录入的静态历史数据
export const ALL_TIME_LEADERS: AllTimeLeader[] = [
  // 20 个现役球星 + 25 个退役传奇
  { personId: 2544, name: "LeBron James", fromYear: 2003, toYear: 2026, active: true, team: "LAL",
    ppg: 27.0, rpg: 7.5, apg: 7.5, spg: 1.5, bpg: 0.7,
    totalPts: 42184, totalReb: 11700, totalAst: 11600 },
  { personId: 0, name: "Michael Jordan", fromYear: 1984, toYear: 2003, active: false, team: "CHI",
    ppg: 30.12, rpg: 6.2, apg: 5.3, spg: 2.3, bpg: 0.8,
    totalPts: 32292, totalReb: 6672, totalAst: 5633, totalStl: 2514 },
  { personId: 0, name: "Wilt Chamberlain", fromYear: 1959, toYear: 1973, active: false, team: "LAL",
    ppg: 30.07, rpg: 22.9, apg: 4.4,
    totalPts: 31419, totalReb: 23924, totalAst: 4643 },
  // ... 45 条
];
```

为什么静态：`stats.nba.com` 的历史职业端点被 CORS 卡死，Vercel IP 也被拒。走 API 路径不通。手工录入 45 条数据比尝试代理国际/国内反爬靠谱。

退役传奇没有 `personId`（NBA 不公开历史球员 ID 数据库），统一用 `personId: 0`。前端渲染时：

```tsx
return p.active && p.personId > 0 ? (
  <Link href={`/player/${p.personId}`} className={cardCls}>
    {inner}
  </Link>
) : (
  // 退役传奇渲染为不可点击的纯展示卡
  <div className={cardCls}>{inner}</div>
);
```

`<PlayerHeadshot>` 组件自带 fallback——personId=0 时 CDN 返回 404，组件捕获 `onError` 显示首字母圆形。

同样的"标签 vs 数据"不一致在另外 5 个页面也找到了：

| 页面 | 错误标签 | 实际数据 | 修法 |
|------|---------|---------|------|
| `/rookie-watch` | "本赛季新秀" | 上赛季新秀（playerIndex 数据滞后） | 改为按 `draftYear` 过滤 + 显式说明 |
| `/milestones` | "Career Milestones" | 用上赛季均 × 70 场 × 年数推算的生涯总和 | 改名 "Career Pace Tracker / 生涯轨迹追踪"，明确是投影 |
| `/awards-race` ROY | "Rookie of the Year 竞争" | 所有联赛球员（老兵霸榜） | 加 rookie 过滤器交叉引用 playerIndex draftYear |
| `/by-position/country/college` | 球员场均 | 上赛季均值 | 在标签后加 "· 上赛季" 限定词 |

**Bug 让用户能感知到（页面挂了，数据没出来）。标签错让用户带着错误信息走**。后者更难发现，影响更大。

---

## 0x0A 跨切关注点的状态管理

PWA 完整化、a11y、用户偏好这些都是**跨切关注点**——不属于某个具体页面，是整个应用层面的状态。

集中处理几个：

### `<ToastProvider>` 全局通知

React 19 context + createPortal，挂在 root layout：

```tsx
// src/components/ToastProvider.tsx
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext value={{ toast }}>
      {children}
      {toasts.length > 0 && createPortal(
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] ..." role="status" aria-live="polite">
          {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
        </div>,
        document.body
      )}
    </ToastContext>
  );
}

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) return { toast: () => {} }; // SSR 或没有 provider 时 no-op
  return ctx;
}
```

任何 client component 一行调用：

```tsx
const { toast } = useToast();
toast(isZh ? "已添加到收藏" : "Added to favorites");
```

`role="status"` + `aria-live="polite"` 让屏幕阅读器播报 toast 内容。这是免费的 a11y win——视觉反馈和声音反馈一起到位。

### `<ThemeScript>` 内联消除主题闪烁

前一版的 ThemeToggle 在 useEffect 里读 localStorage，意味着初次渲染时浏览器先按默认（dark）画了一遍，几十毫秒后切到 light——出现明显闪烁。

正确做法是在 React 之前同步执行：

```tsx
// src/components/ThemeScript.tsx
export default function ThemeScript() {
  const code = `(function(){try{
    var t=localStorage.getItem('theme');
    if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
    if(t==='light'){document.documentElement.setAttribute('data-theme','light');}
    var m=document.querySelector('meta[name="theme-color"]');
    if(m){m.setAttribute('content',t==='light'?'#F8FAFC':'#060912');}
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
```

挂在 `<head>` 里。Next.js 16 把这个 `<script>` 同步注入 HTML，浏览器解析到这里**立刻执行**——在第一帧渲染之前。`data-theme` 一旦设上，Tailwind 4 的 `[data-theme="light"]` 选择器立即生效。

副带做的事：

- 没存过偏好的用户根据 `prefers-color-scheme` 自动适配系统主题
- 同步更新 `<meta name="theme-color">` —— Android Chrome 地址栏 / iOS PWA 状态栏跟着换色

### `<RecentlyViewed>` localStorage 跨页面状态

用户访问过的 player / team / game 通过 localStorage 跨页面共享：

```typescript
// src/lib/recentlyViewed.ts
export function recordVisit(kind: RecentKind, id: string, label: string): void {
  const items = read();
  const filtered = items.filter((it) => !(it.kind === kind && it.id === id));
  const next: RecentItem = { kind, id, label, ts: Date.now() };
  // 每种类型 capped 至 12，避免无限增长
  const sameKind = filtered.filter((it) => it.kind === kind).slice(0, 11);
  const otherKinds = filtered.filter((it) => it.kind !== kind);
  write([next, ...sameKind, ...otherKinds].sort((a, b) => b.ts - a.ts));
}
```

详情页挂一个零 UI 的 tracker：

```tsx
// src/components/RecentVisitTracker.tsx
export default function RecentVisitTracker({ kind, id, label }: Props) {
  useEffect(() => {
    recordVisit(kind, id, label);
  }, [kind, id, label]);
  return null;
}

// 详情页使用
<RecentVisitTracker kind="player" id={String(personId)} label={fullName} />
```

首页有 `<RecentlyViewed>` 横向滚动条显示最近 8 条。**首次访问时 localStorage 空，整个组件 `return null`，不显示空状态——避免空状态比展示空状态体面**。

---

## 0x0B Web Vitals 监控（局部）

`next/web-vitals` 提供了 `useReportWebVitals` 钩子。零依赖：

```tsx
// src/components/WebVitalsReporter.tsx
import { useReportWebVitals } from "next/web-vitals";

const STORAGE_KEY = "nba-tracker-vitals";
const MAX_ENTRIES = 50;

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const entry = {
      name: metric.name,
      value: metric.value,
      rating: (metric as any).rating,  // "good" | "needs-improvement" | "poor"
      id: metric.id,
      ts: Date.now(),
      path: window.location.pathname,
    };

    // localStorage 滚动缓冲（最近 50 条）方便事后翻
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
    } catch {}

    // 控制台彩色日志：filter "vitals" 就能看到
    console.log(
      `%c[vitals] %c${entry.name} ${fmt(entry.name, entry.value)} %c${entry.rating}%c  ${entry.path}`,
      "color: #3B82F6;",
      "color: #FFFFFF; font-weight: bold;",
      ratingColor(entry.rating),
      "color: #94A3B8;"
    );
  });
  return null;
}
```

没有后端，但每次部署后开几个路径，控制台过滤 "vitals" 就能看到实测：

```
[vitals] LCP 1234ms good   /standings
[vitals] INP 45ms good     /standings
[vitals] CLS 0.012 good    /standings
```

Core Web Vitals 的 "good" 阈值：LCP < 2.5s、INP < 200ms、CLS < 0.1。配合 Speculation Rules + dynamic import，全站大部分页面在 good 范围。

将来想接 Vercel Analytics 或者别的 dashboard，只需要把 `console.log` 那段换成 `fetch('/api/vitals', ...)`。架构上是 ready 的。

---

## 0x0C 几个真实的工程教训

1. **field 的名字 ≠ field 的含义**。永远验证一遍数据源的 schema 文档（或者抓一次原始返回）确认字段语义。
2. **跨切关注点早抽**。Toast / Theme / RecentlyViewed 这种应用级别的状态值得用 context 集中管理，不要让每个页面各搞各的。
3. **本地时区是 first-class concept**。不要让"哪个 timezone"成为一个隐含的、由调用者随机决定的参数。**显式传，函数签名上写出来**。
4. **CSS 已经能做你以为只能 JS 做的事**。`text-wrap`、`:has()`、容器查询、滚动驱动动画都是这两年的新东西，但能力很强。**别再写 scroll listener 算进度条了**。
5. **拆分的最大收益不是行数减少**。是单元的 cognitive load 降低——以后维护这个区域不需要把 900 行装进脑子。
6. **a11y 的"小事"是焦点管理**。aria-label 是入门；focus trap + restoration + scroll lock 才是 dialog 真正合规的部分。
7. **Service Worker 不可怕**。坚持几个原则：`/api/*` 不拦截 / HTML network-first / hashed static 永久缓存 / 版本化 purge。
8. **静态数据有时候是正确答案**。整 stats.nba.com 反爬代理不如手工录 45 条历史数据。

---

## 当前状态

```
30,000+   行 TypeScript/TSX
71        React 组件
46        路由
16        API endpoints
20        lib 模块
82        词汇表条目（中英双语）
230+      球员搜索别名
~5s       生产构建（Turbopack）
0         lint 错误，0 类型错误
```

线上：**nba.xpy.me**
代码：**github.com/fxy2026/nba-tracker**
详细 changelog：**docs/2026-05-update.md**

---

*本文采用 CC BY-NC-SA 4.0 许可协议，转载请注明出处。*
