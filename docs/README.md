# 文档导航

[返回项目 README](../README.md)

从任务出发查阅文档。当前运行命令和配置以[项目 README](../README.md) 与 [`package.json`](../package.json) 为入口；带日期的方案、发布记录和证据只描述当时的范围，不自动代表当前部署状态。

## 开发与功能

| 文档 | 适用场景 |
| --- | --- |
| [项目结构与部署选择](design/project-structure.md) | 了解现有边界、Docker 状态及 workspace/多仓库的适用条件 |
| [投篮球场与渲染边界](3d-shot-court.md) | 理解默认俯视图、可选 3D 与原始坐标语义 |
| [赛季热区 UI](player-season-heatmap-ui.md) | 修改热区加载、筛选和展示 |
| [搜索引擎 sitemap](search-engine-sitemap.md) | 维护可索引页面、动态目录和有意排除项 |
| [设计规范](../design-system/nba-tracker/) | 查阅视觉与页面设计记录 |

## 数据与来源

| 文档 | 说明 |
| --- | --- |
| [球员生涯响应来源](player-career-provenance.md) | 实时 API 来源、ID、读取时间与缓存语义 |
| [已核验生涯快照](player-career-archives.md) | 已收录球员的日期快照、覆盖保护与更新流程 |
| [历史生涯档案](data/historical-career/README.md) | 历史球员逐赛季数据的来源与验证边界 |
| [计划赛程](data/planned-fixtures.md) | 官方 PDF 快照、时区、未分配比赛和回退优先级 |
| [官方分节比分](official-period-scores.md) | gamebook 来源、比分核对和展示范围 |
| [比分观察序列](reported-score-sequences.md) | 比分趋势的数据含义及与逐回合记录的区别 |
| [历史得分与逐回合](verified-historical-scoring.md) | 限定比赛的来源、对账和发布检查 |
| [已核验投篮图](verified-shot-charts.md) | 单场坐标、身份、命中数核对与准入条件 |
| [赛季 advanced-14 契约](player-season-advanced14-data-contract.md) | 赛季区域聚合、残余类别与联盟基准限制 |
| [逐场供应商快照](../src/data/provider-player-boxes.README.md) | 权威逐场存储、生成聚合与完整性检查 |
| [历史球队归属核验](../src/data/recovered-player-boxes.README.md) | 独立核验的历史球员统计及覆盖范围 |

对应的核验记录位于 [`evidence/`](evidence/)。查阅或新增数据时，先看相关契约再看具体证据；一个样本通过检查不代表其他比赛、球员或赛季已覆盖。

## 采集与运维

- [受控球员数据采集](../scripts/recovery/README.md)：工作流、额度、离线检查和并发发布边界。操作供应商前先读此文档。
- [Vercel Web Analytics](design/vercel-web-analytics.md)：当前集成、隐私过滤、旧采集退出与上线验证。
- [原 Supabase 访问统计设计](design/visitor-analytics.md)及[部署记录](design/visitor-analytics-deployment.md)：保留的历史资料，已被 Vercel 方案取代，不应按旧清单重新启用采集。
- [数据库迁移记录](../supabase/migrations/)：已保存迁移的历史；不要把记录当作新环境的自动执行指令。

## 历史设计与更新

- [2026 年 5 月更新](2026-05-update.md)：早期改版记录。
- [`superpowers/specs/`](superpowers/specs/) 与 [`superpowers/plans/`](superpowers/plans/)：阶段性设计和实施计划。是否落实需对照当前代码和后续文档。
- [项目技术文章](https://www.xpy.me/article/nba-tracker)：背景与实现叙述；仓库根目录的 `article*.md` 和 `article-images/` 保留相关稿件与素材。

## 文档维护约定

- 根 README 保持简洁，提供运行方式与稳定入口；详细数据契约留在专题文档。
- 更新来源、范围或接口时同步补充文档、证据与测试，注明实际核验日期和未验证项。
- 区分设计意图、代码实现、本地验证和线上状态；历史记录保留时间语境。
- 使用相对链接连接仓库内容。新增专题时在本页添加入口，不复制整份旧文档。
