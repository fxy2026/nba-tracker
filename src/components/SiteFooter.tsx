"use client";

import Link from "next/link";
import { Trophy, ExternalLink } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export default function SiteFooter() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";

  // Multi-column footer sitemap — improves internal linking + Google understands site hierarchy
  const groups: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: isZh ? "今日" : "Today",
      links: [
        { href: "/", label: t.nav.today },
        { href: "/calendar", label: t.nav.calendar },
        { href: "/schedule", label: t.nav.schedule },
        { href: "/schedule-heatmap", label: isZh ? "赛程热力图" : "Schedule Heatmap" },
        { href: "/game-predictor", label: isZh ? "比赛预测" : "Game Predictor" },
      ],
    },
    {
      title: isZh ? "排名" : "Standings",
      links: [
        { href: "/standings", label: t.nav.standings },
        { href: "/conference-race", label: isZh ? "分区赛" : "Conference Race" },
        { href: "/divisions", label: isZh ? "六分区" : "Divisions" },
        { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings" },
        { href: "/tier-list", label: isZh ? "等级表" : "Tier List" },
        { href: "/streaks", label: isZh ? "连胜连败" : "Streaks" },
        { href: "/momentum", label: isZh ? "趋势" : "Momentum" },
      ],
    },
    {
      title: isZh ? "数据" : "Stats",
      links: [
        { href: "/stats", label: t.nav.stats },
        { href: "/awards-race", label: isZh ? "奖项争夺" : "Awards Race" },
        { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders" },
        { href: "/iconic-seasons", label: isZh ? "经典赛季" : "Iconic Seasons" },
        { href: "/iconic-games", label: isZh ? "经典之夜" : "Iconic Games" },
        { href: "/milestones", label: isZh ? "里程碑" : "Milestones" },
        { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games" },
        { href: "/records", label: isZh ? "赛季纪录" : "Season Records" },
      ],
    },
    {
      title: isZh ? "球员" : "Players",
      links: [
        { href: "/search", label: t.nav.playerSearch },
        { href: "/compare", label: t.nav.compare },
        { href: "/h2h", label: t.nav.h2h },
        { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch" },
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes" },
        { href: "/by-position", label: isZh ? "按位置" : "By Position" },
        { href: "/by-country", label: isZh ? "按国籍" : "By Country" },
      ],
    },
    {
      title: isZh ? "更多" : "More",
      links: [
        { href: "/explore", label: isZh ? "浏览全部" : "Explore All" },
        { href: "/injuries", label: t.nav.injuries },
        { href: "/transactions", label: t.nav.trades },
        { href: "/history", label: t.nav.champions },
        { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day" },
        { href: "/glossary", label: isZh ? "术语表" : "Glossary" },
        { href: "/quiz", label: isZh ? "NBA 测验" : "NBA Quiz" },
        { href: "/about", label: isZh ? "关于" : "About" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border relative hidden sm:block pb-4 mt-12 safe-area-bottom">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Top: brand + group columns */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-8 mb-8">
          {/* Brand column */}
          <div className="col-span-12 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 group cursor-pointer w-fit">
              <div className="w-8 h-8 rounded-xl bg-accent-gradient flex items-center justify-center shadow-md shadow-accent/30">
                <Trophy size={16} className="text-white" />
              </div>
              <span className="text-base font-bold tracking-tight">
                NBA<span className="text-accent">Tracker</span>
              </span>
            </Link>
            <p className="text-[11px] text-text-secondary mt-3 leading-relaxed">
              {isZh
                ? "独立 NBA 数据仪表板 · 35+ 分析视图 · 与 NBA 无任何隶属关系"
                : "Independent NBA stats dashboard · 35+ analytic views · Not affiliated with the NBA"}
            </p>
          </div>

          {/* 5 link columns */}
          <div className="col-span-12 lg:col-span-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
            {groups.map((g) => (
              <div key={g.title} className="min-w-0">
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2.5 pb-1.5 border-b border-border/40">
                  {g.title}
                </p>
                <ul className="space-y-1.5">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-[11px] text-text-secondary hover:text-accent transition-colors truncate block"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: meta strip */}
        <div className="border-t border-border/40 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-text-secondary/70">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t.footer.madeWith}</span>
            <a href="https://www.xpy.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">FXY</a>
            <span className="text-text-secondary/40">·</span>
            <span>{t.footer.dataFrom}</span>
            <span className="text-text-secondary/40">·</span>
            <a
              href="https://github.com/fxy2026/nba-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-accent transition-colors"
            >
              <ExternalLink size={11} /> {isZh ? "GitHub 开源" : "Open source on GitHub"}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-text-secondary/50">
            <kbd className="px-1.5 py-0.5 bg-bg-card/70 backdrop-blur-md border border-border rounded">←→</kbd>{t.footer.dates}
            <kbd className="px-1.5 py-0.5 bg-bg-card/70 backdrop-blur-md border border-border rounded">⌘K</kbd>{t.footer.searchKey}
            <kbd className="px-1.5 py-0.5 bg-bg-card/70 backdrop-blur-md border border-border rounded">⌘M</kbd>{isZh ? "菜单" : "menu"}
          </div>
        </div>
      </div>
    </footer>
  );
}
