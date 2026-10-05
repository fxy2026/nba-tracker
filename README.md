# NBA Tracker

NBA 比分、球员数据与投篮可视化网站，支持中英文、移动端和带来源说明的历史档案。

*A bilingual NBA dashboard for scores, player research, and source-aware basketball visualizations.*

[在线体验](https://nba.xpy.me) · [技术文章](https://www.xpy.me/article/nba-tracker) · [快速开始](#快速开始) · [文档导航](docs/README.md)

[查看历史演示：2026 年 5 月版本（GIF，约 2.5 MB）](article-images/demo.gif)

> 演示图来自较早版本。各页面的数据覆盖、来源和时间以当前页面说明为准；本项目不是 NBA 官方产品。

## 可以做什么

- **跟踪比赛**：比分、赛程、比赛详情、球员技术统计、可用的逐回合记录与季后赛对阵。
- **研究球员与球队**：中英文搜索、球员档案、生涯数据、球队表现、对比与排行榜。
- **探索投篮与趋势**：比赛投篮图、历史投篮档案、赛季热区，以及 `/lab` 下的分析视图；不同图表各有明确的数据范围。
- **浏览联盟资讯**：新闻、伤病、交易、历史专题、术语表与趣味问答。
- **按自己的习惯使用**：本地时区、主题切换、收藏和最近浏览；支持安装为 PWA，已缓存页面和静态资源可提供有限离线体验，实时 API 仍需联网。

主要入口：[`/explore`](https://nba.xpy.me/explore)、[`/search`](https://nba.xpy.me/search)、[`/calendar`](https://nba.xpy.me/calendar)、[`/shot-archive`](https://nba.xpy.me/shot-archive)、[`/lab`](https://nba.xpy.me/lab)。

## 快速开始

### 环境要求

- **Node.js 24**：与仓库现有 GitHub Actions 使用的主版本一致。
- **npm**：使用仓库的 `package-lock.json` 安装依赖。
- **Git**：用于获取仓库和项目规模统计。

主要浏览页面无需配置 API key 或数据库。上游接口受网络、访问限制和数据覆盖影响，不保证所有比赛或球员都有完整数据。

```bash
git clone https://github.com/fxy2026/nba-tracker.git
cd nba-tracker
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。需要管理后台或其他可选功能时，再按下文配置环境变量。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生成 Next.js 生产构建 |
| `npm start` | 运行已生成的生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test -- --maxWorkers=1` | 单 worker 运行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式 |
| `npm run data:generate` | 从仓库内逐场快照校验并生成聚合数据 |
| `npm run project:stats` | 统计当前工作树中 Git 跟踪的项目文件 |

`dev`、`build`、`test`、`test:watch` 和 `typecheck` 的 npm 前置脚本会自动运行 `data:generate`。它只读取本地快照，不抓取上游数据；不要手改生成的聚合 JSON。新检出仓库请使用 `npm run typecheck`，避免直接运行 `tsc` 跳过生成步骤。

生产模式本地检查：

```bash
npm run build
npm start
```

构建使用 `next/font/google` 下载字体，访问部分页面也会请求上游接口。在受限网络中，字体下载失败或上游超时需要单独排查；离线单元测试通过不代表线上数据可用。

项目规模也可输出为 JSON：

```bash
npm run --silent project:stats -- --json
```

统计基于 Git 跟踪且当前存在的普通文件，按路径名称排除常见凭据、依赖与构建产物；它不是秘密扫描器。行数区分物理行和非空行，包含注释，不代表去注释后的代码量或测试覆盖率。页面/API 数量是约定文件数，不是动态展开后的 URL 或 HTTP 方法数；具体口径见命令输出。

## 架构与目录

这是一个 **单仓库、单个 Next.js 应用**。页面、Route Handlers、数据适配和本地档案共同交付；数据采集工作流独立于访客请求执行。内部模块边界、Docker 自托管与拆仓库的适用条件，见[项目结构与部署选择](docs/design/project-structure.md)。

- **Web**：Next.js App Router、React、TypeScript、Tailwind CSS、Lucide；具体版本见 [`package.json`](package.json) 和锁文件。
- **页面层**：Server Components 组织页面和服务端数据，Client Components 负责筛选、交互与按需加载图表。
- **数据层**：[`src/lib/api.ts`](src/lib/api.ts) 处理 NBA CDN 数据与赛程缓存；[`src/lib/statsProxy.ts`](src/lib/statsProxy.ts) 为 NBA Stats 请求提供超时与熔断；各功能模块负责校验和来源边界。
- **共享类型**：[`src/lib/nba-contracts.ts`](src/lib/nba-contracts.ts) 集中维护比赛、球员与投篮的数据类型；调用方使用 `import type`，`api.ts` 保留兼容的类型导出。
- **持久化**：受控采集和人工核验结果保存为仓库内快照，部分聚合文件在开发、测试和构建前生成。Supabase 仅保留可选的历史功能，不是核心页面启动条件。

```text
NBA CDN / NBA Stats / ESPN
          │
          ▼
服务端适配、校验与缓存 ◀── 已保存且满足对应校验规则的档案
          │
          ├── Server Components
          └── /api/* → Client Components → 图表与交互

受控采集 / 来源核验 → 逐场事实与证据 → 本地生成与校验 → 构建
```

回退顺序由各模块定义；实时响应、已保存档案、计划赛程和推导指标有不同语义，不应混合成一个“完整实时数据集”。

```text
.
├── src/
│   ├── app/              # 页面、布局与 api/ Route Handlers
│   │   └── …/_components/ # 与具体路由共同维护的页面组件
│   ├── components/       # 跨页面 UI、导航与图表
│   ├── lib/              # 数据适配、领域逻辑、校验与测试
│   ├── data/             # 事实快照、来源元数据和生成数据
│   └── locales/          # 中英文文案与翻译类型
├── scripts/              # 数据生成、受控采集、导入和维护工具
├── docs/                 # 数据契约、功能说明、证据与设计记录
├── public/               # 浏览器可直接访问的静态资源与 Service Worker
├── supabase/migrations/  # 已有数据库迁移记录
├── design-system/        # 设计规范与页面设计记录
├── article-images/       # README 与技术文章的演示素材
└── .github/workflows/    # 受控数据采集与历史工作流
```

Vitest 测试与代码就近存放，入口匹配 `src/**/*.test.{ts,tsx}`。服务端档案、压缩数据和来源证据不要放入 `public/` 或直接导入客户端组件；已有文件追踪配置见 [`next.config.ts`](next.config.ts)。

## 数据来源与边界

| 来源 | 当前用途 | 需要注意 |
| --- | --- | --- |
| NBA CDN / NBA Stats | 比分、赛程、球员与比赛统计 | 可能超时、受限或缺失；按功能使用缓存、已有档案或不可用状态 |
| ESPN | 新闻、伤病，以及部分球员生涯数据回退 | 来源 ID 和统计口径需要单独核验 |
| NBA 页面、gamebook 与赛程 PDF | 经核验的比分、投篮、生涯及计划赛程快照 | 仅覆盖已收录对象；捕获时间不等于上游更新时间 |
| BigBallsData | 受控工作流保存的逐场球员数据 | 页面读取已保存快照；供应商校验不自动证明历史球队归属 |
| BallDontLie | 可选薪资接口 | 需要服务端 key 和对应接口权限，不是启动条件 |
| 本地整理与计算 | 历史专题、榜单和部分分析指标 | 以具体模块的来源、范围和计算说明为准 |

维护数据时，需保留以下边界：

- 缺失、过期、部分覆盖和不可用必须明确表达；不能将缺失统计补成真实的零。
- 计划赛程不是已发生比赛；历史样本不是完整赛季；投篮坐标、比分观察序列和逐回合事件不能相互推造。
- 通用供应商快照与独立核验的历史档案分别保留来源和验证范围。新增记录需要相应证据、校验和测试。
- 视频回放链接已退出公开页面和管理界面；保留的旧 API 与存储不代表公开回放功能仍在使用。

从 [文档导航中的数据章节](docs/README.md#数据与来源) 查看每类数据的契约和证据。

## 可选配置

可以从 [`.env.example`](.env.example) 创建本地配置：

```bash
cp .env.example .env.local
```

示例文件保留了一些历史注释；当前功能含义如下。无需为了运行首页填写所有变量，也不要提交真实 key 或密码。

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 服务端内部请求使用的绝对站点 origin；未设置时优先使用 Vercel 的生产域名变量，本地回退到 localhost |
| `ADMIN_PASSWORD` | `/admin` 与相关受保护接口的管理密码 |
| `BALLDONTLIE_API_KEY` | 服务端薪资查询；未设置时该接口返回空数据 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 保留的旧回放存储配置；公开页面不依赖它们 |

特别注意：

- `NEXT_PUBLIC_SITE_URL` 不会自动改写所有品牌链接、SEO metadata、robots 或 sitemap。派生部署需检查 [`layout.tsx`](src/app/layout.tsx)、[`robots.ts`](src/app/robots.ts) 和 [`sitemap.ts`](src/app/sitemap.ts) 中的站点地址。
- Preview 环境默认可能通过 `VERCEL_PROJECT_PRODUCTION_URL` 读取生产站点的赛程投影；需要独立预览数据时，为对应环境明确设置 origin。
- `BIGBALLSDATA_API_KEY` 只属于受控 GitHub Actions 采集流程，不要部署到 Vercel 或暴露给浏览器。详见 [采集维护文档](scripts/recovery/README.md)。
- 当前页面访问统计使用 Vercel Web Analytics，仅在 Vercel production 环境挂载，并受路径与隐私信号过滤；是否收集还需核验项目面板设置。旧 Supabase 采集已停用，历史报表配置不属于新部署必需项。详见 [访问统计说明](docs/design/vercel-web-analytics.md)。

## 部署到 Vercel

现有线上入口为 [nba.xpy.me](https://nba.xpy.me)。部署自己的副本可导入 GitHub 仓库，或使用按钮创建项目：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffxy2026%2Fnba-tracker&project-name=nba-tracker&repository-name=nba-tracker)

1. 选择 **Next.js** framework preset，项目根目录使用仓库根目录。
2. 使用 `npm ci` 安装、`npm run build` 构建；Output Directory 保留框架默认值。构建脚本会先校验并生成本地档案。
3. Node.js 选择 **24.x**，与现有工作流一致；可用版本以 [Vercel 官方说明](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) 为准。
4. 只按需添加上面的可选配置。管理密码、供应商 key 和服务端数据库凭据不得使用 `NEXT_PUBLIC_` 前缀。
5. 核对部署对应的 commit、首页、比赛/球员页面、静态档案读取和错误状态，再检查自定义域名与 SEO 地址。访问统计需单独启用和验证，构建成功不等于已收到访问数据。

应用依赖服务端路由和文件读取，不能仅发布为静态 HTML。保留 `next.config.ts` 中的服务端档案追踪配置，避免构建成功但运行时缺少压缩档案。

## 参与开发

1. 先阅读涉及功能的[文档](docs/README.md)，确认数据范围、路由边界和现有测试。
2. 页面专用组件放在对应路由的 `_components/`，可复用 UI 放在 `src/components/`，数据规则与校验放在 `src/lib/`。小范围提交，避免为目录整齐批量搬动数据。
3. 修改行为时补充相邻测试；修改来源或数据契约时同步更新事实、证据和说明。不要手工修改生成的聚合文件。
4. 提交前运行以下检查，并在 PR 中说明改动范围、测试结果、数据影响及未验证事项；UI 修改附截图。

```bash
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run test:project-stats
npm run build
```

测试使用的重建 fixture 不等于真实来源完整性证明。网络访问、部署验证与受控供应商采集各自独立，运行开发检查不会自动完成这些验证。

## 进一步阅读

- [文档导航](docs/README.md)：按开发、数据、可视化和运维查找说明。
- [技术文章](https://www.xpy.me/article/nba-tracker)：项目实现背景。
- [2026 年 5 月更新记录](docs/2026-05-update.md)：历史设计与改版记录，其中版本、数量和状态不作为当前承诺。

## License

MIT

仓库目前尚未提供独立的 `LICENSE` 文件。

代码许可声明不构成第三方数据、图片、队标或商标的再分发授权；使用这些内容前请核对各来源的条款。
