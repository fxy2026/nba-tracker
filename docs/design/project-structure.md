# 项目结构与部署选择

[返回文档导航](../README.md) · [运行与部署入口](../../README.md)

核对日期：2026-10-05。现状依据本文链接的当前仓库文件。本文区分已有结构与后续建议；Docker、workspace、多仓库和进一步的领域拆分均不是本文交付的能力或已承诺的迁移计划。

## 当前结构

- **一个仓库、一个 Next.js 应用**：根目录只有一套应用 `package.json` 与锁文件，没有配置 workspaces。`src/app` 同时承载页面和 Route Handlers。
- **共享领域逻辑**：页面与 API 使用同一组赛程、球员身份、统计和档案校验模块。`src/lib` 同时包含纯函数、客户端辅助代码和服务端加载器，不能把整个目录视为客户端安全或服务端专用。
- **已完成的类型边界提取**：[`nba-contracts.ts`](../../src/lib/nba-contracts.ts) 承接原 `api.ts` 的 18 个类型声明，16 个直接调用方改用 `import type` 引用；[`api.ts`](../../src/lib/api.ts) 保留兼容类型导出，运行时请求与缓存仍由原模块处理。
- **已有服务端边界**：档案加载器等模块通过 `server-only` 限制导入；客户端接收相应的展示数据。边界测试见 [`client-api-boundary.test.ts`](../../src/lib/client-api-boundary.test.ts)。
- **采集独立执行、代码共同维护**：[`scripts/recovery/`](../../scripts/recovery/README.md) 在 GitHub Actions 中运行，复用应用的校验器并生成应用读取的档案。独立执行不要求立即拆仓库。
- **当前发布方式**：按 README 的 Next.js/Vercel 流程构建。当前无 Dockerfile、Compose 文件或 `.dockerignore`，也未设置 `output: 'standalone'`；没有经过验证的容器构建和运行流程。

项目文件数、代码行数和档案字节数可用 `npm run project:stats` 查看。它们不等于浏览器 bundle、函数部署包或运行内存，也不足以单独证明需要拆服务。

## 建议先改善内部边界

保留当前仓库和发布单元，按业务逐步整理赛程/比赛、球员/生涯、投篮档案、管理/访问统计等模块：

1. **路由与 UI**：`src/app` 负责请求和页面组合；专用 UI 与路由就近维护，可复用组件留在 `src/components`。
2. **纯领域规则**：类型、身份映射、统计口径与校验不依赖 React、Next.js 请求上下文或供应商网络调用。
3. **服务端适配**：来源访问、缓存、文件读取和凭据集中在服务端接口之后，只向页面暴露必要数据。
4. **客户端交互**：筛选、请求生命周期和图表渲染不直接读取服务端档案；通过明确的响应类型与服务端衔接。

这是一组依赖边界建议，不是新增 `domain/` 或 `packages/` 目录的完成声明。首步已提取上述共享类型并保留兼容导出；进一步拆分运行时领域模块前，仍需验证调用方、导入方向与行为，再决定是否扩大范围。[Next.js 项目组织指南](https://nextjs.org/docs/app/getting-started/project-structure)允许在路由内共同维护相关代码，无需为分层改变 URL。

尤其应保留档案的实际路径、来源和校验规则：[`next.config.ts`](../../next.config.ts) 的追踪清单及部分 `process.cwd()/src/data` 文件读取依赖这些位置。目录整理不应顺带改变数据含义或发布契约。

## Docker 与自托管：可选的后续路径

Next.js 支持普通 Node.js 服务和 Docker 部署；离开 Vercel 并不要求先使用 Docker。只有出现明确的自托管环境或可复现镜像分发需求时，才建议新增容器方案。[Next.js 部署选项](https://nextjs.org/docs/app/getting-started/deploying)

若决定实施，至少需要以下工作；当前仓库尚未完成这份清单：

- **构建契约**：保留开发依赖，先 `npm ci` 再 `npm run build`。`prebuild` 使用 TypeScript 编译生成工具，并校验、生成本地聚合；直接调用 `next build` 或先删掉构建依赖会跳过或破坏这个入口。
- **运行产物**：评估 standalone 输出，并单独打包 `public` 与 `.next/static`；它们不会自动复制到 standalone。保持正确工作目录，逐项核验动态选择的 JSON/gzip 档案是否进入最终镜像。[输出与文件追踪](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- **字体与配置**：当前构建需要下载 Google 字体。`NEXT_PUBLIC_*` 环境变量会在 `next build` 时内联，不能假定同一镜像只改运行变量就能切换所有域名；管理密码与服务端 key 不得写入镜像层。[环境变量与自托管](https://nextjs.org/docs/app/guides/self-hosting#environment-variables)
- **主机运维**：配置非 root 运行、可写缓存位置、只读档案、健康检查、日志、补丁和回滚；部署还需 TLS 与反向代理。先验证单实例，再评估多副本的缓存与发布协调。[Next.js 自托管](https://nextjs.org/docs/app/guides/self-hosting)
- **验收**：检查静态资源、字体、档案页面/API、缺失配置、后台鉴权、重启和缓存权限。镜像能够构建不等于目标环境已可用。

本项目还有几项迁移时必须核对的行为：

- 赛程内部请求会使用 `NEXT_PUBLIC_SITE_URL`、Vercel 生产域名变量或 localhost；反向代理与预览环境要分别测试，避免请求另一个部署。
- metadata、sitemap、robots 和部分分享链接包含现有域名。应用能启动不代表所有公开链接已迁移。
- 应用自己的进程内赛程缓存与熔断状态不会因增加容器副本而自动共享，需要单独评估。
- Vercel Analytics 只在指定的 Vercel production 条件下挂载。迁移主机时不要伪造 `VERCEL_ENV`，也不要重新启用已停用的 Supabase 采集。
- 容器不会自动运行 GitHub Actions 或刷新已打包档案；当前数据更新仍需经过校验和新的构建部署。旧回放功能也不要求为网站额外部署数据库。

## 何时考虑 workspace 或多仓库

| 选择 | 适合出现的真实需求 | 增加的维护工作 |
| --- | --- | --- |
| 继续单应用仓库 | Web 与采集共享契约、同一团队共同演进 | 维护内部边界和相关测试 |
| 单仓库 workspaces | 第二个应用真正复用公共契约，或采集工具需要独立依赖与发布周期 | 包接口、依赖方向、构建顺序与按包验证 |
| 多仓库 | 明确的独立负责人、权限隔离或独立版本发布要求 | 跨仓库契约版本、兼容性、集成测试和发布协调 |

推荐先验证复用需求，再考虑包结构。[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)支持同仓库的本地包管理，但不会自动建立清晰的领域边界。页面数量增加、文档较多或文件名较长，都不应成为单独拆仓库的理由。

如果未来档案增长影响构建时间、发布包大小或更新频率，应先测量具体瓶颈，再评估对象存储等数据交付方式。数据存储调整与代码拆仓库是两个独立决策。
