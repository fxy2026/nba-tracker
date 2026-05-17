# NBA Tracker v2：从 8800 行到 30000 行，做了什么

**作者:** FXY
**日期:** 2026-05-17
**分类:** 技术分享
**标签:** Next.js 16、React 19、Tailwind 4、Service Worker、a11y、PWA

---

## 前情提要

[上一篇](https://nba.xpy.me/article)写到 NBA Tracker 第一版：8800 行、16 个页面、纯 SVG 投篮图、Suspense 流式渲染。那时季后赛刚开始，我以为站点已经"做完"了。

直到一次在手机上点开底栏"更多"——弹层从底部升起，但顶部撑到了状态栏，下面那点点也看不全。手指按住屏幕想往下滚，**结果滚的是下层页面**，弹层本身一动不动。

排查下来是三个问题叠加：

- 弹层没设 `max-height` 和 `overflow-y-auto`
- 弹层打开时 body 没锁 `overflow: hidden`，iOS Safari 触摸事件直接穿透
- 移动端"更多"还在用一套**全英文**的硬编码翻译，跟桌面端**两套实现**

修着修着发现，这个站点的"完美"远没做到位。每个角落都有可以改的地方。

这一篇记录接下来三天我把站点从 8800 行写到 30000 行的过程：UI 重构、共享原语抽象、现代 CSS 落地、PWA 完整化、a11y 工程化、数据准确性修复。代码全部开源在 `github.com/fxy2026/nba-tracker`。

---

## Part 1：现在长什么样

先看成品，再讲技术。

### 首页

📷 截图：https://nba.xpy.me/

【图片：首页桌面端 — 文件 01-homepage-desktop.png】

依然是当日比赛 + 季后赛对阵图，比分 30 秒自动刷新。但加了几处细节：

- 顶部 2 像素的进度条跟着滚动位置慢慢填满，纯 CSS 实现，零 JS
- 每个数据页标题旁有"X 分钟前更新"标签，告诉你这页数据有多新

📷 截图：在 https://nba.xpy.me/standings 滚到中间，看顶部和标题

【图片：滚动驱动进度条 + "X 分钟前更新"标签 — 文件 25-scroll-progress-updated-pill.png】

往下滚还有"最近浏览"卡片，把你刚点开过的球员/球队/比赛缩成一行横向滚动：

📷 截图：先访问 https://nba.xpy.me/player/2544 / https://nba.xpy.me/team/LAL / https://nba.xpy.me/game/0042500411，回首页滚到中部

【图片：最近浏览卡片 — 文件 20-recently-viewed.png】

第一次访问的人看不到这块——空状态不显示，有了再说。

### 季后赛对阵图

底部的对阵图是树状的 SVG 连接线。每个系列卡片旁边有进度点（这个系列打了几场），并且**已晋级球队的下一轮位置会预填**——比如雷霆 4-0 横扫太阳后，下一轮"OKC vs ???"会直接标出 OKC，等火箭-湖人系列结束再填另一边：

![BracketTree 树状结构示意](article-images/mermaid-update-01-bracket-projection.png)

📷 截图：https://nba.xpy.me/ 滚到底部

【图片：对阵图全貌 — 文件 30-bracket-tree.png】

每个系列卡片可以点进去，跳到独立的系列赛详情页：

📷 截图：https://nba.xpy.me/series/004250010

【图片：系列赛详情页 — 文件 31-series-detail.png】

页面包含逐场战果、双方场均、最大胜差、关键球员排行——把整个 best-of-7 拍扁到一个页面看。这是新加的页面。

### 历史排行：修了一个数据 bug

打开 `/all-time-leaders`，按"生涯场均得分"排序。在第一版里，前几名是：

```
1. Luka Dončić    33.5 PPG
2. SGA            31.1
3. Anthony Edwards 28.8
```

但 NBA 历史上能场均超过 30 分的只有两个人：乔丹 30.12、张伯伦 30.07。Luka 上赛季 33.5 是他**一个赛季**的数据，不是生涯。

后面技术部分会讲为什么。现在修好了：

📷 截图：https://nba.xpy.me/all-time-leaders 点"生涯总得分" tab

【图片：真历史排行榜 — 文件 21-all-time-leaders-real.png】

- 生涯场均得分：乔丹 30.12 / 张伯伦 30.07 / Luka 28.7 / 拉里伯德 27.2 / 詹姆斯 27.0
- 生涯总得分：詹姆斯 42184 / 贾巴尔 38387 / 卡尔马龙 36928 / 科比 33643 / 乔丹 32292
- 生涯场均助攻：魔术师 11.19 / 斯托克顿 10.51 / 大 O 9.51 / 保罗 9.4
- 生涯总篮板：张伯伦 23924 / 拉塞尔 21620 / 贾巴尔 17440

45 位球员，20 个现役 + 25 个退役传奇。

### 词汇表：82 个篮球术语，全中文

`/glossary` 第一版只有英文。这次扩到 82 个词条，全部翻译成虎扑式中文（"协防 / 护框者 / 退守战术 / 横扫 / 附加赛 / 双双 / 三双 / 接球投篮"），加了"阵容与战术"和"交易与名单"两个新分类。

📷 截图：https://nba.xpy.me/glossary （记得切到中文模式）

【图片：中文词汇表全屏 — 文件 22-glossary-zh.png】

可以搜索，按分类浏览。中英文搜索都能匹配。

### Quiz：新加"猜历史名人"

`/quiz` 第一版有 3 个模式：看头像猜人 / 看数据猜人 / 猜球队。这次加了第 4 个：**猜历史名人**。从那 45 位球员里随机出题，给生涯均值让你 4 选 1：

📷 截图：https://nba.xpy.me/quiz 切到第 4 个 tab

【图片：Legend Quiz 模式 — 文件 28-legend-quiz.png】

知道乔丹生涯场均 30.12 是一回事，看到一组 `30.07 / 22.9 / 4.4 / 退役` 能马上认出是张伯伦——又是一回事（22.9 篮板就是大杀器：除了张伯伦只有比尔拉塞尔 22.5）。

### PWA：能装到手机主屏

整站可以"安装到主屏"，装好之后就是一个独立 App，没有浏览器 chrome：

📷 截图：用 Chrome / Edge / 安卓浏览器开 https://nba.xpy.me，等 InstallPrompt 弹出

【图片：安装提示卡片 — 文件 26-install-prompt.png】

- 安卓 / Chrome / Edge：底部弹出"安装"卡片，点一下确认
- iPhone Safari：弹出"点击分享按钮 → 添加到主屏"的引导（iOS 不允许程序触发安装）

装完之后**断网也能用**。打开 F12 → Network → Offline 然后刷新：

📷 截图：装站点后 DevTools 切 offline 刷新

【图片：离线模式 + 顶部红条 — 文件 27-offline-banner.png】

- 顶部弹红条："网络已断开 · 已显示缓存数据"
- 首页 shell 还在
- 静态资源（CSS / 字体 / 球队 logo）全部从缓存来
- 联网时无感恢复，红条变绿条 2.5 秒后消失

### 全站发现：没有死胡同

第一版的痛点：点进一个数据页（比如 `/streaks` 连胜连败榜）看完只能浏览器后退。现在每个数据页底部都有"继续探索"区，5-6 个相关链接：

📷 截图：滚到 https://nba.xpy.me/standings 底部

【图片：RelatedPages 卡片网格 — 文件 24-related-pages.png】

详情页顶部还多了 breadcrumbs：

📷 截图：https://nba.xpy.me/player/2544 顶部

【图片：Breadcrumbs + "X 分钟前"标签 — 文件 23-breadcrumbs.png】

整站 33 个分析页都标准化了这两个组件。

### 搜索：230+ 别名

第一版搜"字母哥"返回 0 结果。现在能搜：

- **中文外号**：字母哥、大胡子、阿杜、库里、利拉德、浓眉、卡哇伊、东契奇、威少、大帝、塔图姆、文班、蚂蚁、崔阳、胖虎、司机、麦迪、纳什...
- **英文外号**：King James、Greek Freak、Chef Curry、Dame、AD、The Beard、KD...
- **传奇球员**：乔丹、科比、张伯伦、魔术师、拉里伯德、奥尼尔、邓肯、艾弗森、奥拉朱旺...
- **球队名直接搜**：搜"湖人"或"Lakers"返回整队现役球员

📷 截图：https://nba.xpy.me/search 或在站内任何位置按 Cmd+K

【图片：搜索"字母哥"返回 Giannis — 文件 32-bilingual-search.png】

---

## Part 2：技术怎么实现的

下面挑几个核心的实现细节聊聊。

### 拆分巨型组件：从 911 行到 163 行

第一版的对阵图 `BracketTree.tsx` 是 911 行的单文件。React 组件、纯函数、桌面布局、移动布局全部混在一起：

![BracketTree 拆分前](article-images/mermaid-update-02-bracket-before.png)

每次想动一个细节都要在这 911 行里翻很久才能找到对应位置。拆完之后变成 7 个文件：

![BracketTree 拆分后](article-images/mermaid-update-03-bracket-after.png)

拆分原则：

1. **纯函数下沉到 `lib/`**：无 React、无 JSX、无副作用的代码全部抽到 `lib/playoffs.ts`，纯 TS。可以独立测试，也方便 server component 直接调用。
2. **组件单一职责**：一个文件一个组件（或紧密耦合的小组件组）。
3. **视觉零变化**：重构期间 CSS 类名、prop 形状一个字符都不改。

`game/[id]/page.tsx`（比赛详情页）也用同样思路：**1026 行 → 243 行 + 13 个 `_components/` 子组件**。`team/[tricode]/page.tsx`：**786 行 → 295 行 + 6 个子组件**。

> Next.js 的 `_components/` 约定：在 App Router 里，下划线开头的文件夹不会被识别为路由。所以可以放在路由文件夹下作为同 colocate 的私有组件——只在比赛页用到的子组件就该和它一起住，不污染全局 `src/components/` 命名空间。

拆分的最大收益不是行数减少，是单元的认知负担降低——以后维护这个区域不需要把 900 行装进脑子。

### 时区：一个 bug 渗透到全栈

这次重构的真正起点是时区。中国用户北京时间 5/17 早上 10 点打开网站，看到顶部写着"今天 5/16"：

![时区 bug 流程](article-images/mermaid-update-04-tz-bug.png)

直接原因：**NBA 官方赛程用美东时间编码**。北京时间凌晨开打的比赛，在赛程数据里写的是前一天。但服务端代码强转 ET 算"今天"，于是中国用户看到的"今天"是 ET 的今天（北京的昨天）。

修法：把"用户的本地时区"当成 first-class concept 沿请求链一路传。新加 `src/lib/timezone.ts`：

```typescript
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

然后 `/api/games` 接受 `?tz=Asia/Shanghai`，扫全赛季日程，把每场比赛的 UTC 开球时间换算到用户时区，看它落在哪一天：

```typescript
for (const gd of schedule) {
  for (const g of gd.games) {
    if (!g.gameDateTimeUTC) continue;
    if (dateInTz(new Date(g.gameDateTimeUTC), tz) !== date) continue;
    matched.push(g);
  }
}
```

修完之后的数据流：

![时区修复流程](article-images/mermaid-update-05-tz-fix.png)

修复扩散到 `DateNav.tsx`、`GamesList.tsx`、`/api/calendar`、`/app/calendar/page.tsx` 等多处。每一处都用 `Intl.DateTimeFormat` + 用户时区，不用 `new Date().toISOString()`（返回 UTC）也不用强转 ET 的 helper。

注意两个分离的概念**不能混**：

- **"NBA 的今天"**：ET today。用于 live scoreboard endpoint。NBA 这个 endpoint 只返回当前 ET 日的比赛
- **"用户的今天"**：local tz today。用于显示哪一格高亮、`/api/games?date=` 该取哪天的比赛

第一版混在一起，结果就是开头那个 bug。

### 手机端"更多"菜单的修复

表面上是"弹层撑出屏幕"，但 root cause 不止一个：

![弹层 bug 结构](article-images/mermaid-update-06-mobile-bug.png)

更深的问题是**两套实现两套翻译**：桌面 Navbar 的"更多"菜单已经全中文翻译完了，手机的 MobileNav 重新写了一套英文硬编码版本。维护两份必然漂移。

修法：抽到共享 hook，桌面手机都用同一个 CommandPalette：

![弹层修复结构](article-images/mermaid-update-07-mobile-fix.png)

`src/lib/useMoreGroups.ts` 成为单一数据源：

```typescript
export function useMoreGroups(): PaletteGroup[] {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";

  return useMemo<PaletteGroup[]>(() => [
    {
      title: isZh ? "联赛排序" : "League Order",
      eyebrow: isZh ? "排名" : "Standings",
      color: "#FFD700",
      items: [
        { href: "/conference-race", label: isZh ? "分区赛" : "Conference Race", icon: Trophy },
        { href: "/divisions", label: isZh ? "六分区" : "Divisions", icon: MapIcon },
        { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings", icon: Crown },
        { href: "/tier-list", label: isZh ? "等级表" : "Tier List", icon: Layers },
        // ...
      ],
    },
    // ... 4 个分类共 35 个链接
  ], [t, isZh]);
}
```

桌面 Navbar 和手机 MobileNav 都 `const moreGroups = useMoreGroups();`，传给同一个 `<CommandPalette>` 组件。手机端从底部抽屉切换到居中模态：

- 不会被 Navbar 顶栏挡住
- 自带搜索框（输入"战力"立刻定位"战力榜"）
- 焦点陷阱 + body scroll lock（继承自 CommandPalette）
- Esc / 点击外侧关闭
- 全中文

副作用是删了 88 行重复代码。

修弹层本身的几个细节：

```tsx
// Body scroll lock — iOS Safari 会高高兴兴地穿透弹层滚下层页面
useEffect(() => {
  if (!moreOpen) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = prev; };
}, [moreOpen]);
```

- `100dvh` 而不是 `100vh`：动态视口高度，会考虑浏览器地址栏
- `env(safe-area-inset-bottom)`：iOS 刘海屏的底部安全区
- `overscrollBehavior: contain`：阻止滚动链（scroll chaining）——弹层滚到底再继续滑不会传到 body
- `touchAction: pan-y`：允许垂直拖动，禁止水平滑动

> body 锁的 cleanup 一定要还原原始值，不要硬编码成 `"auto"`。否则套娃 modal（modal 里再开 modal）外层关闭时会把内层的锁也清掉。

### 现代 CSS：去 JS 化

这几年 CSS 加了一堆以前需要 JS 才能做的能力。

**`text-wrap: balance`**

```css
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
```

`balance` 让浏览器在标题断行时计算最佳分布，避免"最后一行就一个字"。`pretty` 给段落用，优化最后一行密度。一行 CSS，全站质感拉满。Chrome 114+ / Edge 114+ / Safari 17.4+ 已支持。

**`:has()` 选择器**

之前要做"父元素响应子元素状态"必须 JS，开个 state 监听 hover。现在：

```css
/* 卡片含 Link/Button 在 hover 时整张卡片提亮 */
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

Chrome 105+ / Edge 105+ / Safari 15.4+ / Firefox 121+ 支持，覆盖率足够。

**滚动驱动动画**

页面顶部那条 2px 的进度条，跟着滚动位置走：

```css
.scroll-progress-rail::after {
  content: "";
  display: block;
  height: 100%;
  background: var(--gradient-accent);
  transform-origin: 0 50%;
  animation: scroll-progress-grow linear;
  animation-timeline: scroll(root);  /* ← 关键 */
}
@keyframes scroll-progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

零 JS、零 scroll listener、零 jank。Chrome 115+ 原生支持，老浏览器静默忽略。之前类似效果需要：

```javascript
window.addEventListener("scroll", () => {
  const progress = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  bar.style.transform = `scaleX(${progress})`;
}, { passive: true });
```

每次滚动事件都触发布局抖动。CSS 自己搞定后，浏览器优化掉合成层。

### Speculation Rules：预测性导航

Chrome 122+ 加的新 API，能告诉浏览器哪些 URL 值得预先 prefetch 或者 prerender：

![Speculation Rules 时序](article-images/mermaid-update-08-speculation.png)

代码：

```tsx
const rules = {
  prefetch: [
    { source: "list", urls: ["/", "/standings", "/stats", "/search", "/calendar"] },
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
      eagerness: "moderate",  // hover ~200ms 时 prerender
    },
  ],
};

return <script type="speculationrules" dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }} />;
```

两个层级：

1. **prefetch**：固定的 5 个高频入口一次性 prefetch
2. **prerender + `eagerness: "moderate"`**：鼠标 hover 200ms 后浏览器在后台 prerender 任意站内非 /admin 非 /api 链接

不支持的浏览器忽略整个 script tag，零副作用。比手写 `Link.prefetch` 强一档。

### Service Worker：分桶缓存

之前的 PWA 只有 manifest.json。能装到主屏，但断网就废了。这次加了 `public/sw.js`，按请求类型分桶缓存：

![Service Worker 缓存决策](article-images/mermaid-update-09-sw-cache.png)

代码：

```javascript
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;  // 实时数据不拦截

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // _next/static 走 cache-first，cdn.nba.com 走 SWR...
});
```

设计要点：

1. **`/api/*` 永远 passthrough**：直播比分不能缓存
2. **HTML network-first + 离线 shell fallback**：在线时永远拿新数据；断网时拿缓存或 `/` 首页
3. **`_next/static/` cache-first**：Next 构建的资源 URL 带内容哈希，可以无限期缓存
4. **图片 stale-while-revalidate**：先显示缓存，后台刷新
5. **版本化缓存**：`CACHE_VERSION = "v1"`，每次 breaking change bump。activate 时清掉旧版本，避免新部署后老 chunk 僵尸服务

iOS Safari 特殊处理：那个浏览器**永远不会触发** `beforeinstallprompt`。所以 InstallPrompt 组件做 UA 检测，遇到 iOS 不显示 Install 按钮，改为弹引导："点击 Safari 分享按钮 → 添加到主屏幕"。

### 数据准确性：playerIndex 的字段语义

回到开头那个"为什么 Luka 排第一乔丹消失了"的问题。

NBA CDN 的 `playerIndex.json` 有 `pts/reb/ast` 三个字段。字段名让你以为是"得分"。实际含义是：**该球员上一个完整赛季的场均**（如果今年没打就是 0）。而且 playerIndex **只包含现役球员**——乔丹 2003 年退役不在里面，张伯伦 1973 年退役更不在：

![playerIndex 语义](article-images/mermaid-update-10-playerindex.png)

`stats.nba.com` 的历史职业端点被 CORS 卡死，Vercel IP 也被拒，走 API 路径不通。最后的修法：手工录入静态历史榜单。45 个球员，覆盖 20 个现役 + 25 个退役传奇，生涯均值用 NBA 官方记录：

```typescript
// src/lib/allTimeLeaders.ts
export const ALL_TIME_LEADERS: AllTimeLeader[] = [
  { personId: 0, name: "Michael Jordan", fromYear: 1984, toYear: 2003, active: false, team: "CHI",
    ppg: 30.12, rpg: 6.2, apg: 5.3, spg: 2.3, bpg: 0.8,
    totalPts: 32292, totalReb: 6672, totalAst: 5633, totalStl: 2514 },
  { personId: 0, name: "Wilt Chamberlain", fromYear: 1959, toYear: 1973, active: false, team: "LAL",
    ppg: 30.07, rpg: 22.9, apg: 4.4,
    totalPts: 31419, totalReb: 23924, totalAst: 4643 },
  // ... 共 45 条
];
```

类似的"标签 vs 数据"不一致还在 5 个页面里发现：

| 页面 | 错误标签 | 实际数据 | 修法 |
|------|---------|---------|------|
| `/rookie-watch` | "本赛季新秀" | 上赛季新秀（playerIndex 数据滞后） | 按 draftYear 过滤 + 显式说明 |
| `/milestones` | "Career Milestones" | 用上赛季均推算的生涯总和 | 改名"生涯轨迹追踪"，明确是投影 |
| `/awards-race` ROY | "Rookie of the Year" | 所有联赛球员（老兵霸榜） | 加 rookie 过滤器 |
| `/by-position/country/college` | 球员场均 | 上赛季均值 | 标签后加"· 上赛季"限定 |

Bug 让用户感知到问题（页面挂了，数据没出来）。标签错让用户带着错误信息走。后者更难发现，影响更大。

---

## Part 3：现在的状态

代码层面：

| 指标 | 第一版 | 现在 |
|------|-------|------|
| 代码行数 (TS/TSX) | 8,800 | **30,000+** |
| 路由 | 16 | **46** |
| React 组件 | 39 | **71** |
| API endpoint | 13 | **16** |
| lib 模块 | ~5 | **20** |
| 词汇表条目（中英） | 47 | **82** |
| 球员搜索别名 | ~0 | **230+** |
| 有 RelatedPages 的页面 | 4 | **33（100%）** |
| 有 Breadcrumbs 的页面 | 1 | **24** |
| 有 error.tsx 的路由 | 1 | **6** |

体验层面：

- 装到主屏 → 断网能看 → 联网无感更新
- 中英双语全覆盖，搜索支持中英文别名 + 球队名直搜
- A11y 焦点陷阱 / aria-label / SVG `role="img"` / 屏幕阅读器友好
- 44px 触控目标 + iOS 安全区 + 反穿透
- 33 个数据页底部都有"继续探索"，没死胡同
- 滚动条 / "X 分钟前"标签 / 最近浏览 / Toast 反馈 / Web Vitals 监控

---

## 几个工程教训

1. **field 的名字 ≠ field 的含义**。永远验证一遍数据源 schema。一个叫 `pts` 的字段可能是生涯均值，可能是上赛季，也可能是当前赛季——名字从来不会告诉你它实际是什么。
2. **小 bug 是冰山**。手机端"更多"菜单滚不动这种小问题，往往挂着 body scroll lock 缺失、max-height 没设、overscrollBehavior 没配置、两套实现两份翻译漂移一整套问题。
3. **本地时区是 first-class concept**。函数签名上写出来，不要让"哪个 timezone"成为隐含的、由调用者随机决定的参数。
4. **拆分的最大收益不是行数减少**。是单元的认知负担降低——以后维护这个区域不需要把 900 行装进脑子。
5. **CSS 已经能做你以为只能 JS 做的事**。`:has()`、容器查询、滚动驱动动画、`text-wrap: balance` 都是这两年的新能力。别再写 scroll listener 算进度条了。
6. **Service Worker 不可怕**。坚持几个原则：`/api/*` 不拦截 / HTML network-first / hashed static 永久缓存 / 版本化 purge。
7. **PWA 是免费的护城河**。一份代码同时是网站 + iOS app + Android app + 桌面 PWA。
8. **标签错比 bug 还可怕**。Bug 是用户能感知到问题。标签错是用户带着错误信息走。

---

## 现在试试

线上地址：**[nba.xpy.me](https://nba.xpy.me)**

代码（完全开源）：**[github.com/fxy2026/nba-tracker](https://github.com/fxy2026/nba-tracker)**

试试这些：

- [/all-time-leaders](https://nba.xpy.me/all-time-leaders) 切换"生涯总得分" → 看到詹姆斯 42184 / 贾巴尔 38387 / 卡尔马龙 36928
- [/glossary](https://nba.xpy.me/glossary) 切中文 → 82 个篮球术语全中文
- [/search](https://nba.xpy.me/search) 输入"字母哥"或"司机" → 立即命中
- 任意比赛/球员/球队详情页底部 → "继续探索"卡片
- 手机访问 → 顶部"安装到主屏"按钮 → 加到主屏
- 装好后断网刷新 → 仍能看到首页 shell + 顶部红条提示离线

代码 fork 之后可以一键部署到自己的 Vercel，env vars 留空也能用（NBA CDN 数据完全免费）。

季后赛还在打。

---

*本文采用 CC BY-NC-SA 4.0 许可协议，转载请注明出处。*
