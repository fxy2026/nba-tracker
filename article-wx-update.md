# 又把 NBA Tracker 写了一遍：50 个 commit 的"完美化"实录

**作者:** FXY
**日期:** 2026-05-17
**分类:** 技术分享
**标签:** 前端、Next.js、React、PWA、a11y、Service Worker、Web Vitals

---

[上一篇](https://nba.xpy.me/article)写到 NBA Tracker 8800 行、16 个页面就停了。

那时候我以为站点已经"做完了"。

然后我打开自己的首页，看到顶部写着 **"今天 2026-05-16"**。

我抬头看了眼系统时间：**北京时间 5 月 17 日**。

烦了，本来想 10 分钟修个时区。

50 个 commit 之后，整站从 8800 行涨到 30000 行，路由从 16 个变成 46 个，组件从 39 个翻倍到 71 个。

这篇是这次"完美化"押注的全记录。不是教程，是踩坑实录（续）。

---

## 0x00 一个时区 bug，滚出 50 个 commit

直接原因：NBA 官方赛程用美东时间编码。北京时间凌晨开打的比赛，赛程里写的是前一天。我的 `DateNav` 直接用 `new Date()` 算"今天"，所以一切都按服务器 / 浏览器本地时区走。

中国用户看：5/17，今天。
NBA 赛程：5/16，今天。
DateNav 显示：5/16，"今天"。

用户：？

修复说起来很简单——把所有"今天"的计算用 `Intl.DateTimeFormat` 接 `America/New_York` 跑一遍——但接下来的连锁反应让我意识到，这个站点的"完美"远没做到位：

1. 修了 `DateNav.tsx` 之后，发现 `/calendar` 还是按 ET 分组比赛。Beijing 的 5/16 那一格里看不到任何东西。但用户记得"昨天我熬夜看了凯尔特人 vs 76ers"。那场是 ET 5/15 晚间，对应北京 5/16 早上 — 系统却把它分到了 5/15 那一格。
2. 修了 `/calendar` 又发现 `/api/games` 也是按 ET 日期 key 的。同样问题。
3. 时区修完，开始审计其他页面。发现 `/all-time-leaders` 里"NBA 历史得分均值最高"赫然写着 **Luka Dončić 33.5 PPG** ——历史上没人能场均超 30 啊兄弟，**乔丹 30.12、张伯伦 30.07** 才是历史前二。

这时候我意识到这站点不是"做完了"，是"做了一遍轮廓"。每个角落都有可以改的地方。

---

## 0x01 先列账：50 个 commit 干了什么

我用 agent 跑了两轮全栈审计（a11y / 移动端 / 代码质量 / 错误处理 / 数据准确性 / 可发现性 / i18n / 现代 web），整理出 30+ 个具体问题，分成 6 个轨道：

| 轨道 | 内容 | 影响范围 |
|------|------|---------|
| **A 可靠性** | error.tsx · fetchWithRetry · 新鲜度 pill | 5 路由 + 全站 |
| **B 可发现性** | Breadcrumbs · RelatedPages · 搜索别名 | 33 个页面 |
| **C A11y** | Focus trap · aria-label · SVG role | 全站交互 |
| **D 移动端** | 字体 44px · iOS safe-area · 触控目标 | 全站 |
| **E 代码质量** | 拆 BracketTree / game / team · 抽 helpers | 4 大文件 |
| **F Polish** | i18n 漏洞 · 空状态 · 主题闪烁 | 散点修复 |

后面又加了：

- **G 数据准确性**：把 6 个错标签的页面修了（all-time-leaders / rookie-watch / milestones / awards-race ROY / by-position / by-country / by-college）
- **H PWA**：真离线 Service Worker + iOS 安装提示 + OnlineStatus
- **I 微交互**：Toast 全局反馈 + Recently Viewed 历史
- **J 主题完善**：FOWT（flash of wrong theme）杀死 + 系统偏好检测
- **K 现代 web**：Speculation Rules + `:has()` + 容器查询 + scroll-driven 进度条
- **L 内容深度**：词汇表 47→82 词条全中文 + Legend Quiz 模式

下面挑几个有意思的细说。

---

## 0x02 时区：从"看似简单"到"渗透全栈"

直接修复 `DateNav` 没用。整个数据流都得跟。

**正确的设计**：把"用户的本地时区"当成一个 first-class concept 沿着请求链一路传：

```typescript
// src/lib/timezone.ts （新模块）
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

export function localToday(): string {
  return dateInTz(new Date());
}
```

然后 `/api/games` 接受 `?tz=Asia/Shanghai`，扫全赛季日程，把每场比赛的 `gameDateTimeUTC` 用这个时区算成"YYYY-MM-DD"，只保留匹配的：

```typescript
const matched = [];
for (const gd of schedule) {
  for (const g of gd.games) {
    if (!g.gameDateTimeUTC) continue;
    if (dateInTz(new Date(g.gameDateTimeUTC), tz) !== date) continue;
    matched.push(g);
  }
}
```

注意几个细节：
- 服务端首次渲染没法知道用户时区（请求里不带）。所以 `HomeClient` 挂载后用 `useEffect` 检测本地时区，如果跟服务端给的 ET 默认不一样，跳转到真正的"本地今天"。
- 服务端用 `formatDate(new Date())` 仍然算 ET，作为"什么是 NBA 的今天"的参考（live scoreboard endpoint 只返回当下 ET 日的比赛）。两个概念分开，不混用。
- 日历里 ET 5/15 的晚场比赛对应 Beijing 5/16，对北京用户来说就该出现在 5/16 那一格——这是用户真正经历的"昨晚那场比赛"。

修完之后，浮现出一个有趣的产品决策：**给中国用户看 ET 日还是 Beijing 日的比赛？**

我选了"看比赛的实际播放时间在用户本地的日期"。理由：用户不关心"NBA 把它登记成几月几日"，关心的是"那场比赛我什么时候看到的"。

---

## 0x03 数据陷阱：playerIndex 在骗你

打开 `/all-time-leaders`，按"生涯场均得分"排序。前 10 名：

1. Luka Dončić 33.5
2. SGA 31.1
3. Anthony Edwards 28.8
4. Jaylen Brown 28.7
5. ...

**乔丹呢？张伯伦呢？**

排查代码，数据源是 NBA CDN 的 `playerIndex.json`，里面取 `pts/reb/ast` 三个字段：

```typescript
const players = await getPlayerIndex();
const top = players.sort((a, b) => b.pts - a.pts).slice(0, 10);
```

但这里有两个隐藏坑：

1. **playerIndex 只包含现役球员**。乔丹？2003 年退役，不在里面。张伯伦？1973 年退役，不在里面。
2. **playerIndex 的 `pts` 字段是"上一个完整赛季的场均"**，不是生涯均值。Luka 上赛季 33.5 ≠ 他的生涯场均（实际 28-29 之间）。

这意味着 `/all-time-leaders` 字面上就是个谎言：标题"历史排行榜"，内容是"现役球员上赛季均值排行榜"。

修法两条：
- **A**: 改名为"现役球员上赛季排行" — 诚实但弱化
- **B**: 真的搞一份历史数据 — 工作量大但符合页面承诺

我走的 B。

`stats.nba.com` 的历史职业端点被 CORS 卡死，Vercel IP 也被拒，所以走 API 路径不通。最后选了：**手工写一份静态历史榜单**。45 个球员，覆盖 20 个现役 + 25 个退役传奇（乔丹、张伯伦、贾巴尔、科比、魔术师、拉里伯德、斯托克顿、奥尼尔、奥拉朱旺等），生涯均值用 NBA 官方记录：

```typescript
// src/lib/allTimeLeaders.ts
export const ALL_TIME_LEADERS: AllTimeLeader[] = [
  { personId: 0, name: "Michael Jordan", fromYear: 1984, toYear: 2003, active: false, team: "CHI",
    ppg: 30.12, rpg: 6.2, apg: 5.3, spg: 2.3, bpg: 0.8,
    totalPts: 32292, totalReb: 6672, totalAst: 5633, totalStl: 2514 },
  { personId: 0, name: "Wilt Chamberlain", fromYear: 1959, toYear: 1973, active: false, team: "LAL",
    ppg: 30.07, rpg: 22.9, apg: 4.4,
    totalPts: 31419, totalReb: 23924, totalAst: 4643 },
  // ...
];
```

退役传奇没有可靠的 `personId`（NBA 不公开历史球员 ID 数据库），所以用 `personId: 0` 标记，前端渲染时不给链接，头像走 `<PlayerHeadshot>` 的 fallback（首字母圆形）。

**类似的"标签 vs 数据"不一致还在 5 个页面里发现**：

| 页面 | 标签暗示 | 实际数据 | 修法 |
|------|---------|---------|------|
| `/rookie-watch` | "本赛季新秀" | 上赛季新秀 | 关键字改 `draftYear` + ⚠️ 说明 |
| `/milestones` | "Career Milestones" | 用上赛季均×70场×年数*推算*的生涯总和 | 改名"生涯轨迹追踪 / Career Pace Tracker"，明确说是投影 |
| `/awards-race` ROY tab | "Rookie of the Year 竞争" | 所有联赛球员（老兵霸榜） | 加 rookie 过滤器 |
| `/by-position` `/by-country` `/by-college` | 球员场均 | 上赛季均值 | 标签后加"· 上赛季 / · last season" |

**这是这次审计最让我意外的发现：标签错了比 bug 还可怕**。Bug 只是不工作，标签错了是在主动给用户假信息。

---

## 0x04 真 PWA：Service Worker 上线

之前的 PWA 只是有个 manifest.json + apple-touch-icon。点击"安装到主屏"也能装，但**断网就废了**。

这次加了 `public/sw.js`，做了一个 minimal but real Service Worker：

```javascript
const CACHE_VERSION = "v1";
const CACHE_STATIC = `nba-tracker-static-${CACHE_VERSION}`;
const CACHE_PAGES = `nba-tracker-pages-${CACHE_VERSION}`;
const CACHE_IMAGES = `nba-tracker-images-${CACHE_VERSION}`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // /api/* 永远不拦截 — 实时比分必须新鲜
  if (url.pathname.startsWith("/api/")) return;

  // 导航 HTML: network-first，离线降级到 "/" shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE_PAGES).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // _next/static + 字体: cache-first（内容哈希过，不可能 stale）
  // cdn.nba.com 头像 + logo: stale-while-revalidate
  // ...
});
```

设计要点：

1. **`/api/*` 永远 passthrough**。直播比分不能给用户看缓存。
2. **HTML network-first + 离线 fallback**。在线时永远拿新数据，断网时至少能看到 `/` shell + 顶部红条提示。
3. **`_next/static/` cache-first**。这些 URL 是内容哈希的（Next 构建出来文件名带哈希），所以一个 URL 对应一份内容，可以永久缓存。
4. **图片 stale-while-revalidate**。NBA 头像更新得慢，先显示缓存再后台刷新。
5. **版本化缓存**。`CACHE_VERSION = "v1"`，activate 时清掉所有不匹配的旧缓存，避免新部署后老 chunk 僵尸服务。

注册策略：在 `<SwRegister>` 组件里用 `requestIdleCallback` 延迟注册，**别和 LCP 抢资源**：

```tsx
useEffect(() => {
  if (process.env.NODE_ENV !== "production") return; // 开发模式跳过，HMR 会冲突
  const register = () => navigator.serviceWorker.register("/sw.js");
  if ("requestIdleCallback" in window) {
    requestIdleCallback(register);
  } else {
    setTimeout(register, 2000);
  }
}, []);
```

配合现有的 `<OnlineStatus>` 横幅（断网弹红条 / 恢复弹绿条 2.5 秒），整个 PWA 体验现在是：**装到主屏 → 断网也能看 → 联网时无感更新**。

---

## 0x05 拆大文件：BracketTree.tsx 从 911 行变 163 行

季后赛对阵图 `BracketTree.tsx` 一直是个怪兽。911 行里塞了：

- 6 个 helper 函数（gameId 解析、对阵投影、晋级路径检测...）
- 7 个组件（TeamRow / SeriesCard / CandidatesRow / Connector / RoundLabel / ConfHalf / 移动端布局）
- 两套布局（桌面 SVG 树状 + 移动端按分区堆叠）

每次想动一个小细节，都要在这 911 行里翻半天。

拆成：

```
src/lib/playoffs.ts                          # 198 行 — 纯 helpers + 类型
src/components/bracket/
  ├── SeriesCard.tsx                         # 220 行 — 卡片 + 队伍行
  ├── Connector.tsx                          # 50 行  — SVG 连线
  ├── ConfHalf.tsx                           # 184 行 — 分区一半
  ├── BracketMobile.tsx                      # 83 行  — 移动布局
  └── BracketDesktop.tsx                     # 100 行 — 桌面布局
src/components/BracketTree.tsx               # 163 行 — 组合入口
```

**重构原则**（不仅限于 BracketTree）：
1. **纯函数下沉到 `lib/`**。没 React 没 JSX 的，扔到 lib，方便单测。
2. **每个组件单一职责**。能拆成 2 个组件就别共用 1 个。
3. **视觉零变化**。拆完之前我让 agent 把 JSX 一个 token 一个 token 搬过去，再校验渲染结果。
4. **保留 WHY 注释，删除 WHAT 注释**。"为什么 1v8 配 4v5"这种留着，"// loop over games"这种删掉。

`game/[id]/page.tsx` 1026 → 243 行（拆 13 个 `_components/`）和 `team/[tricode]/page.tsx` 786 → 295 行也用了同样的套路。

效果：以后改对阵图只动 `bracket/SeriesCard.tsx` 这种 220 行的文件，不动 911 行的怪物。**可维护性大幅上升**，对用户没有直接感受，但每一次后续迭代都更轻松。

---

## 0x06 多 agent 并行：怎么让 LLM 帮你重构

50 个 commit 里，有一些是大块的机械工作（比如给 21 个页面加 `<RelatedPages>` footer，每个加 5 个上下文链接）。这种活我手工干会很痛苦，但 agent 干非常合适。

实战经验：

1. **任务要自洽**。一个 agent prompt 里要包含：目标文件路径、参考的现有 component API、配色 / 命名规范、约束条件（"不要碰 X 文件夹"）、验证方式（`npm run build`）、汇报格式。
2. **隔离 namespaces**。开 3 个并行 agent 时给它们划好领地："你只动 `src/app/X/page.tsx`，别动 `src/components/`"。否则两个 agent 同时改 layout.tsx 就完蛋。
3. **重要决策不外包**。"这个 helper 函数要不要拆到 lib/" 这种判断我自己做，不让 agent 决定。Agent 适合执行明确的方案，不适合架构选型。
4. **审计 agent 的真实输出**。Agent 报"完成了"不代表没问题。每个 wave 之后我都 `npm run build` + 看 git diff 确认没有 hallucinate。

一次比较成功的 fan-out：拆 BracketTree 的同时，并行让另一个 agent 把 11 个页面加 Breadcrumbs + RelatedPages，第三个 agent 把词汇表扩充 + 翻译成中文。3 个 agent 跑了大概 5-8 分钟，我同时手动写了 `<RecentlyViewed>` 组件。一次推 5 个 commit。

**不是所有任务都适合 agent**。需要跨多个抽象层做决策的工作（比如"该不该加 View Transitions"——既要考虑现代感又要考虑性能开销）还是自己想清楚再动手。Agent 的强项是高确定性 + 高重复性的执行。

---

## 0x07 现代 web 平台：哪些新 API 真的值得用

Chrome 122 / Edge 122 之后有一堆新 API。这次试了几个：

**Speculation Rules API**（Chrome 122+ / Edge 122+）

```tsx
// src/components/SpeculationRules.tsx
<script type="speculationrules" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  prefetch: [{ source: "list", urls: ["/", "/standings", "/stats", "/search", "/calendar"] }],
  prerender: [{
    source: "document",
    where: { and: [{ href_matches: "/*" }, { not: { href_matches: "/admin*" } }, { not: { href_matches: "/api/*" } }] },
    eagerness: "moderate",  // hover 时 prerender
  }],
}) }} />
```

效果：用户鼠标停留在任意站内链接上 ~200ms，浏览器就在后台 prerender 那个页面的完整 RSC 流。点下去**就是 0ms 切换**。

体感非常明显。比手写 `Link.prefetch` 强一档。

**`text-wrap: balance`**

```css
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
```

标题再也不会"最后一行就一个字"。一行 CSS，全站质感拉满。

**`:has()` 选择器**

```css
/* glass-tile 包含 Link/Button 在 hover 时整张卡片提亮 */
.glass-tile:has(a:hover),
.glass-tile:has(button:hover) {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-elevated);
}

/* 卡片内任意子元素 focus-visible 时卡片显示焦点环 */
.glass-tile:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

之前要做"父元素响应子元素状态"必须 JS。现在 CSS 一行。键盘导航的可见性瞬间到位。

**CSS scroll-driven animations**

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
}
@keyframes scroll-progress-grow { to { transform: scaleX(1); } }
```

页面顶部一条 2px 高的进度条，跟着滚动位置走。**零 JS、零 scroll listener、零 jank**。Chrome 115+ 原生支持，老浏览器静默忽略。

**容器查询**

```css
.cq-grid > * { container-type: inline-size; }

@container (max-width: 320px) {
  .glass-tile.cq-adapt { padding: 12px; }
  .glass-tile.cq-adapt > .cq-row { flex-direction: column; gap: 8px; }
}
```

同一个卡片放在三列网格里和放在单列侧栏里自动呈现不同密度。比 media query 精准——media query 跟视口走，容器查询跟父容器走。

**没采用 View Transitions API**。之前为了性能砍过一次，这次评估了一下还是觉得对 LCP 的代价不值得。等 RC 阶段更稳定再说。

---

## 0x08 Service Worker、Web Vitals、Recently Viewed —— 一些细节

**Web Vitals 监控**

`next/web-vitals` 提供了 `useReportWebVitals` 钩子，零依赖：

```tsx
useReportWebVitals((metric) => {
  // 控制台彩色日志：绿色 good / 橙色 needs-improvement / 红色 poor
  console.log(`%c[vitals] ${metric.name} ${metric.value}ms`, ratingColor(metric.rating));

  // localStorage 滚动缓冲（最后 50 条）方便事后翻
  persist(metric);
});
```

没有后端，但每次部署后我会自己开几个站点路径测一下，控制台过滤"vitals"就能看到一行行实测：

```
[vitals] LCP 1234ms good   /standings
[vitals] INP 45ms good     /standings
[vitals] CLS 0.012 good    /standings
```

LCP < 2.5s、INP < 200ms、CLS < 0.1 是 Core Web Vitals 的 good 阈值。配合 Speculation Rules + dynamic import，全站现在大部分页面在 "good" 范围。

**Recently Viewed**

localStorage 存最近 12 条访问，首页有个横向滚动条显示最近 8 个：

```tsx
// src/lib/recentlyViewed.ts
export function recordVisit(kind: RecentKind, id: string, label: string) {
  const items = read();
  const filtered = items.filter((it) => !(it.kind === kind && it.id === id));
  const next = { kind, id, label, ts: Date.now() };
  write([next, ...filtered.slice(0, 11)]);
}
```

挂在 `<RecentVisitTracker kind="player" id="2544" label="LeBron James" />` 这种零 UI 组件上，副作用挂载。首页 `<RecentlyViewed>` 第一次访问时 localStorage 为空，整个组件返回 `null`，不显示空状态——**避免空状态比展示空状态体面**。

**搜索别名扩到 230+**

```typescript
// src/lib/playerAliases.ts
export const PLAYER_ALIASES: Record<string, string> = {
  "king james": "lebron james",
  "字母哥": "antetokounmpo",
  "greek freak": "antetokounmpo",
  "禅师": "phil jackson",
  "蚂蚁": "anthony edwards",
  "崔阳": "trae young",
  "胖虎": "williamson",
  "司机": "nowitzki",
  "禅师": "phil jackson",
  "波波": "popovich",
  // ... 230+ 条
};
```

包括 Hupu 圈子里通用的所有中文外号（曼巴 / 大鲨鱼 / 妖刀 / 狼王 / 真理 / 闪电侠 / 风之子 / 答案 / 篮球之神 ...）。搜"字母哥"返回 Giannis，搜"湖人"返回所有湖人现役球员。

---

## 0x09 完美化的边界

50 个 commit 后我意识到一件事：**"完美"是一个无穷递归**。每修一处都会暴露下一处。

最后停在哪里：
- 所有用户能直接看到 / 直接交互的部分 — done
- 所有数据准确性问题 — done
- 所有可访问性 / 移动端问题 — done
- 代码层面的可维护性（大文件拆分） — done
- 现代 web 平台 — 主流可用的都加了

没做的（明确决定 skip）：
- **真 hreflang**：需要 `/zh/foo` 和 `/en/foo` 分 URL，与现有的 cookie-based 切换冲突
- **完整中文阵营球员**：playerAliases 已经 230+ 条，再加边际收益小
- **View Transitions API**：性能开销 vs 视觉收益不划算
- **Real-time WebSocket scoreboard**：现有的 30s 轮询体感够了
- **Push 通知**：基础设施不在 Vercel 免费层

---

## 0x10 几个真实的教训

1. **小 bug 是冰山**。一个时区显示问题滚出 50 个 commit。所谓"快速修复"经常意味着没修到根因。
2. **数据源会撒谎**。NBA playerIndex 的 pts 字段名让你以为是"得分"，实际是"上赛季场均"。**field 含义 ≠ field 名字**。永远验证一遍。
3. **标签错了比 bug 还可怕**。Bug 是用户能感知到问题（页面崩了/数据没出来），标签错是用户**带着错误信息走**。
4. **可发现性是被严重低估的产品力**。100% 加上 RelatedPages 后我自己在站内点着玩都比以前流连忘返。**死胡同等于没存在**。
5. **现代 CSS 比想象的强大**。`:has()` / 容器查询 / scroll-driven animations / `text-wrap: balance` 都是几行 CSS 拿一两年前要写一堆 JS 才能做的事。**别再写 scroll listener 算进度条了**。
6. **Service Worker 不可怕**。坚持 network-first for HTML + cache-first for hashed assets，配合版本化缓存 purge，没那么容易翻车。
7. **PWA 是免费的护城河**。一份代码同时是网站 + iOS app + Android app + 桌面 PWA。装机率比想象中高。
8. **多 agent 工作流是真的**。划好领地、自洽 prompt、外部验证，能并行推进 3-5 个独立任务，比单线推进快得多。

---

## 现在的样子

线上：**nba.xpy.me**

代码：**github.com/fxy2026/nba-tracker**

测试一下：
- `/all-time-leaders` 切换"生涯总得分" → LeBron 42184 / Kareem 38387 / Karl Malone 36928 / Kobe 33643 / Jordan 32292
- `/glossary` 切中文 → 82 个篮球术语全中文，包括"协防 / 护框者 / 退守战术 / 横扫 / 附加赛"
- 任意比赛/球员/球队详情页底部 → "继续探索"区，5-6 个相关链接
- /search 输入"字母哥" / "King James" / "司机" → 立即命中
- 手机访问 → 顶部"安装"按钮 → 加到主屏
- 装好后断网刷新 → 仍能看到首页 shell + 顶部红条提示

下一次更新（如果还有）：内容深度。也许给 player 页面加 career timeline 可视化，也许在 game-predictor 上做点真的预测逻辑。

季后赛还在打。

---

*这次的 50 个 commit + 21000 行新增代码全部 push 到了 master，每个 commit 都有清晰的中文描述、Co-authored-by 和 build 通过证明。透明度优先。*

*本文采用 CC BY-NC-SA 4.0 许可协议，转载请注明出处。*
