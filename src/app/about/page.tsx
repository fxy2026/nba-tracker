import type { Metadata } from "next";
import Link from "next/link";
import { Info, ExternalLink, Mail, Trophy, GitCompareArrows, Flame, Crown, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "关于 NBA Tracker" : "About NBA Tracker",
    description: isZh
      ? "关于 NBA Tracker —— 一个由篮球爱好者独立打造的开源 NBA 数据看板。与 NBA 官方无任何关联，数据来自 NBA 公共 API。"
      : "About NBA Tracker — an independent, open-source NBA statistics dashboard built by a basketball fan. Not affiliated with the NBA. Data sourced from official NBA public APIs.",
  };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "关于" : "About"}
        icon={Info}
        title={isZh ? "关于 NBA Tracker" : "About NBA Tracker"}
        subtitle={isZh ? "一个独立的、由球迷打造的 NBA 全景看板" : "An independent, fan-built dashboard for everything NBA"}
      />

      <div className="space-y-5">
        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Trophy size={16} className="text-accent-amber" />
            {isZh ? "这是什么" : "What this is"}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isZh ? (
              <>
                NBA Tracker 是一个个人项目，提供实时比分、联盟排名、球员和球队数据、季后赛对阵图、奖项追踪，以及 30+ 个其他视角观察当前 NBA 赛季。所有数据都基于联盟公开数据源计算 —— 不抓取任何编辑内容或付费内容。目标是打造一个简洁、信息密集、加载迅速的 UI，对标主流体育站点。
              </>
            ) : (
              <>
                NBA Tracker is a personal project that surfaces live scores, league standings,
                player and team statistics, playoff brackets, awards races, and 30+ other views
                on the current NBA season. Everything is computed from the league&apos;s public
                data feeds — no scraping of editorial content or paid content. The goal is a
                clean, dense, fast UI that benchmarks against major sports sites.
              </>
            )}
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">
            {isZh ? "招牌功能" : "Highlights"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/compare" className="glass-tile p-3 hover:border-accent/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <GitCompareArrows size={14} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">
                  {isZh ? "球员对比" : "Player Compare"}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isZh
                  ? "2-way 雷达图 / 3-way 多人 / 时代背景 / 雷达 / 季后赛切换 / 投票 / 一键社交分享图"
                  : "2-way radar / 3-way grid / era context / RS-PO toggle / pick voting / one-tap share image"}
              </p>
            </Link>
            <Link href="/iconic-seasons" className="glass-tile p-3 hover:border-accent/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Crown size={14} className="text-accent-amber" />
                <span className="text-sm font-semibold text-text-primary">
                  {isZh ? "经典赛季" : "Iconic Seasons"}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isZh
                  ? "34 个手挑巅峰赛季 · 中英叙事 · 季后赛对位 · 风格标签"
                  : "34 hand-curated peak campaigns · bilingual narratives · playoff splits · style tags"}
              </p>
            </Link>
            <Link href="/iconic-games" className="glass-tile p-3 hover:border-accent/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">
                  {isZh ? "经典之夜" : "Iconic Games"}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isZh
                  ? "25 个改写生涯的夜晚 · Wilt 100 / Kobe 81 / MJ 流感 / The Block"
                  : "25 single-night performances · Wilt 100 / Kobe 81 / MJ flu game / The Block"}
              </p>
            </Link>
            <Link href="/this-day" className="glass-tile p-3 hover:border-accent/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-success" />
                <span className="text-sm font-semibold text-text-primary">
                  {isZh ? "历史上的今天" : "On This Day"}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isZh
                  ? "今日历史 + 同一天的经典之夜（按月日匹配）"
                  : "Same-date historical games + iconic-game match by month-day"}
              </p>
            </Link>
          </div>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2">{isZh ? "数据来源" : "Data sources"}</h2>
          <ul className="text-sm text-text-secondary leading-relaxed space-y-1.5 list-disc list-inside">
            <li>
              <span className="font-mono text-text-primary">cdn.nba.com</span>
              {isZh
                ? " —— NBA 官方的公共静态数据 CDN：赛程、实时比分板、Box Score、逐球回放、球员索引、球队徽标。"
                : " — the NBA's public static data CDN: schedule, live scoreboard, box scores, play-by-play, player index, team logos."}
            </li>
            <li>
              {isZh
                ? "综合分析（实力榜、连胜连败、势头、分级榜等）由本项目自行计算 —— 并非 NBA 官方提供。"
                : "Aggregate analytics (power rankings, streaks, momentum, tier list, etc) are derived in this project — not provided by the NBA."}
            </li>
          </ul>
        </section>

        <section id="visitor-statistics" className="glass-tile p-5 scroll-mt-24">
          <h2 className="text-base font-semibold text-text-primary mb-2">
            {isZh ? "访问统计与隐私" : "Visit statistics & privacy"}
          </h2>
          <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              {isZh
                ? "启用后，本站的第一方统计用于了解各类页面的浏览量，帮助改进网站。只按预设页面类别汇总（不含具体球员或比赛 ID），并统计来源类别和屏幕尺寸类别（手机、平板、桌面或未知）。浏览量不等于独立访客人数。"
                : "When enabled, our first-party statistics count page views to help improve the site. Counts use a fixed set of page categories, without individual player or game IDs, plus source categories and screen-size categories (mobile, tablet, desktop or unknown). Page views are not a count of unique people."}
            </p>
            <p>
              {isZh
                ? "这些统计存放在 Supabase 的非公开数据库表中，不保存原始 IP 地址、原始 User-Agent、完整页面或来源网址、查询参数或搜索词。每次浏览生成一个随机事件 ID，仅用于防止重复计数。此功能默认不设置统计 Cookie 或持久浏览器标识，并遵循浏览器的 Do Not Track 和 Global Privacy Control 信号。"
                : "These statistics are stored in private Supabase tables, without raw IP addresses, raw User-Agent strings, full page or referrer URLs, query parameters or search terms. Each page view gets a random event ID only to prevent duplicate counting. This feature uses no analytics cookies or persistent browser identifier by default and honors browser Do Not Track and Global Privacy Control signals."}
            </p>
            <p>
              {isZh
                ? "保留目标：事件 ID 约 48 小时，按日汇总数据 90 天。实际删除依赖清理任务成功执行，服务暂停或故障可能延迟删除。托管、CDN 和数据库服务商可能另行处理 IP 等网络数据，其日志和备份不适用上述统计数据保留期限。"
                : "Retention targets are about 48 hours for event IDs and 90 days for daily aggregates. Deletion depends on successful cleanup; service pauses or failures may delay it. Hosting, CDN and database providers may separately process network data such as IP addresses. Their logs and backups have separate retention policies."}
            </p>
            <p>
              {isZh
                ? "此外，生产版本会加载 Cloudflare Web Analytics。WebVitals 性能诊断会在浏览器本地保存最近 50 条指标（含页面路径），并输出到控制台；该诊断模块不向后端上传这些记录。它们与上述第一方访问统计分开运行。"
                : "Separately, production builds load Cloudflare Web Analytics. WebVitals performance diagnostics keep the latest 50 metrics, including page paths, in browser local storage and write to the console; that diagnostic module does not upload those records to a backend. These operate separately from the first-party visit statistics above."}
            </p>
          </div>
        </section>

        <section className="glass-tile p-5 ring-1 ring-accent-amber/30 bg-accent-amber/[0.03]">
          <h2 className="text-base font-semibold text-accent-amber mb-2">{isZh ? "免责声明" : "Disclaimer"}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isZh ? (
              <>
                NBA Tracker <strong>不隶属于、也未获得</strong>美国职业篮球联赛（NBA）或其任何球队的认可、赞助或授权。NBA 名称、球队名称、徽标及相关标识均为 NBA Properties, Inc. 以及相应球队的注册商标。本站为免费、无广告的球迷项目，仅供信息和娱乐用途，按现状提供。
              </>
            ) : (
              <>
                NBA Tracker is <strong>not affiliated with, endorsed by, or sponsored by</strong> the National
                Basketball Association (NBA) or any of its teams. The NBA name, team names, logos, and
                related marks are trademarks of NBA Properties, Inc. and the respective teams. This site
                is a free, ad-free fan project provided as-is for informational and entertainment purposes only.
              </>
            )}
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2">{isZh ? "技术栈" : "Technology"}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isZh
              ? "基于 Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 构建。服务端组件负责 SSR 数据获取，客户端组件提供交互，部署于 Vercel。源数据在服务端获取并积极缓存，以减轻 NBA CDN 的负载。"
              : "Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4. Server components for SSR data fetching, client components for interactivity, deployed on Vercel. Source data is fetched server-side and cached aggressively to minimize load on the NBA CDN."}
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Mail size={16} className="text-accent" />
            {isZh ? "联系" : "Contact"}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isZh ? "发现 Bug 或有功能建议？项目欢迎反馈。可通过 GitHub 仓库联系：" : "Found a bug or have a feature request? The project is open to feedback. Reach out via the GitHub repository:"}
            {" "}
            <a
              href="https://github.com/fxy2026/nba-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <ExternalLink size={14} /> github.com/fxy2026/nba-tracker
            </a>
          </p>
        </section>

        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-sm text-text-secondary hover:text-accent transition-colors font-mono uppercase tracking-[0.15em]"
          >
            {isZh ? "← 回到今日比赛" : "← Back to today's games"}
          </Link>
        </div>
      </div>
    </div>
  );
}
