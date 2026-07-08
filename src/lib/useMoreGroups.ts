"use client";

import { useMemo } from "react";
import {
  Trophy, Search, GitCompareArrows, Users, AlertTriangle, History, Target, Swords,
  ArrowLeftRight, Flame, Award, Crown, Layers, Zap, TrendingUp, Sparkles, BookOpen,
  GraduationCap, Globe, School, CalendarDays, Compass, Activity, Home, Shield, Repeat,
  HelpCircle, Book, Map as MapIcon, ListOrdered, FlaskConical, LineChart, ScatterChart,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { PaletteGroup } from "@/components/CommandPalette";

// Shared "More menu" navigation groups used by both Navbar (desktop) and
// MobileNav. Returns a fully-localized PaletteGroup[] suitable for direct
// feed into <CommandPalette>. Centralizing here means there's exactly one
// source of truth for nav structure + Chinese translations — previously
// desktop had a nice zh version while mobile was English-only.
export function useMoreGroups(): PaletteGroup[] {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";

  return useMemo<PaletteGroup[]>(() => [
    {
      // Marquee destinations surfaced first so the palette opens on the 6
      // tools most users want, rather than a flat wall of 37 equal links.
      // These items are MOVED out of their categorized groups below (not
      // duplicated) — CommandPalette keys by href, so a repeated href would
      // break keyboard nav and throw a React key warning.
      title: isZh ? "常用" : "Popular",
      eyebrow: isZh ? "精选" : "Featured",
      color: "#F97316",
      items: [
        { href: "/compare", label: t.nav.compare, icon: GitCompareArrows, keywords: "compare player stats" },
        { href: "/h2h", label: t.nav.h2h, icon: Swords, keywords: "head to head h2h matchup" },
        { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings", icon: Crown, keywords: "power rankings" },
        { href: "/awards-race", label: isZh ? "奖项争夺" : "Awards Race", icon: Award, keywords: "MVP ROY DPOY 6MOY MIP" },
        { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", icon: Flame, keywords: "best games closest blowouts OT" },
        { href: "/best-of-night", label: isZh ? "今日最佳" : "Player of the Night", icon: Sparkles, keywords: "player of the night best performer game score" },
      ],
    },
    {
      title: isZh ? "数据实验室" : "Data Lab",
      eyebrow: isZh ? "深度数据" : "Deep Data",
      color: "#06B6D4",
      items: [
        { href: "/lab", label: isZh ? "数据实验室" : "Data Lab", icon: FlaskConical, keywords: "data lab visualization deep" },
        { href: "/lab/explore", label: isZh ? "散点探索器" : "Scatter Explorer", icon: ScatterChart, keywords: "scatter explore stats two axis" },
        { href: "/lab/team-trajectory", label: isZh ? "球队轨迹" : "Team Trajectory", icon: LineChart, keywords: "team trajectory season win curve" },
        { href: "/lab/career-arc", label: isZh ? "生涯弧线" : "Career Arc", icon: TrendingUp, keywords: "career arc player shot evolution" },
        { href: "/lab/game-impact", label: isZh ? "得分接管曲线" : "Takeover Curve", icon: Activity, keywords: "game impact takeover scoring" },
      ],
    },
    {
      title: isZh ? "联赛排序" : "League Order",
      eyebrow: isZh ? "排名" : "Standings",
      color: "#FFD700",
      items: [
        { href: "/standings", label: t.nav.standings, icon: ListOrdered, keywords: "standings table conference rank" },
        { href: "/conference-race", label: isZh ? "分区赛" : "Conference Race", icon: Trophy, keywords: "conference race playoff seeding" },
        { href: "/divisions", label: isZh ? "六分区" : "Divisions", icon: MapIcon, keywords: "divisions atlantic central southeast" },
        { href: "/tier-list", label: isZh ? "等级表" : "Tier List", icon: Layers, keywords: "tier list S A B C" },
        { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", icon: Flame, keywords: "streaks hot cold" },
        { href: "/momentum", label: isZh ? "趋势" : "Momentum", icon: TrendingUp, keywords: "momentum trend" },
        { href: "/clutch-teams", label: isZh ? "关键时刻" : "Clutch Teams", icon: Target, keywords: "clutch close games" },
        { href: "/scoring-output", label: isZh ? "攻防输出" : "Scoring Output", icon: Shield, keywords: "scoring offense defense net" },
        { href: "/team-stats", label: isZh ? "球队数据榜" : "Team Stat Boards", icon: Layers, keywords: "team stats rankings ppg fg3 rebounds" },
      ],
    },
    {
      title: isZh ? "奖项与排行" : "Awards & Leaders",
      eyebrow: isZh ? "奖项" : "Hardware",
      color: "#A855F7",
      items: [
        { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", icon: Crown, keywords: "all time leaders PPG career" },
        { href: "/milestones", label: isZh ? "里程碑" : "Milestones", icon: TrendingUp, keywords: "milestones career thresholds" },
        { href: "/records", label: isZh ? "赛季纪录" : "Season Records", icon: BookOpen, keywords: "records highest lowest" },
        { href: "/clutch", label: t.nav.playoffLeaders, icon: Target, keywords: "playoff leaders clutch" },
      ],
    },
    {
      title: isZh ? "球员" : "Players",
      eyebrow: isZh ? "人物" : "People",
      color: "#3B82F6",
      items: [
        { href: "/search", label: t.nav.playerSearch, icon: Search, keywords: "search player" },
        { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", icon: Sparkles, keywords: "rookie watch first year" },
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", icon: GraduationCap, keywords: "draft classes year" },
        { href: "/draft/2026", label: isZh ? "2026 选秀" : "2026 Draft", icon: Sparkles, keywords: "2026 draft picks board lottery" },
        { href: "/by-position", label: isZh ? "按位置" : "By Position", icon: Users, keywords: "position guard forward center" },
        { href: "/by-country", label: isZh ? "按国籍" : "By Country", icon: Globe, keywords: "country international" },
        { href: "/by-college", label: isZh ? "按大学" : "By College", icon: School, keywords: "college university" },
        { href: "/favorites", label: t.nav.favorites, icon: Trophy, keywords: "favorites saved" },
      ],
    },
    {
      title: isZh ? "更多" : "More",
      eyebrow: isZh ? "工具与历史" : "Tools & History",
      color: "#22C55E",
      items: [
        { href: "/explore", label: isZh ? "浏览全部" : "Explore All", icon: Compass, keywords: "explore index all" },
        { href: "/game-predictor", label: isZh ? "比赛预测" : "Game Predictor", icon: Zap, keywords: "predictor win probability" },
        { href: "/schedule-heatmap", label: isZh ? "赛程热力图" : "Schedule Heatmap", icon: Activity, keywords: "schedule heatmap calendar density" },
        { href: "/back-to-back", label: isZh ? "背靠背" : "Back-to-Backs", icon: Repeat, keywords: "back to back B2B" },
        { href: "/home-vs-road", label: isZh ? "主客场" : "Home vs Road", icon: Home, keywords: "home road splits" },
        { href: "/rivalries", label: isZh ? "宿敌对决" : "Rivalries", icon: Swords, keywords: "rivalries matchups" },
        { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", icon: CalendarDays, keywords: "on this day history" },
        { href: "/history", label: t.nav.champions, icon: History, keywords: "champions finals history" },
        { href: "/injuries", label: t.nav.injuries, icon: AlertTriangle, keywords: "injuries injury report" },
        { href: "/transactions", label: t.nav.trades, icon: ArrowLeftRight, keywords: "trades transactions signings" },
        { href: "/glossary", label: isZh ? "术语表" : "Glossary", icon: Book, keywords: "glossary terms PPG PER" },
        { href: "/quiz", label: isZh ? "NBA 测验" : "NBA Quiz", icon: HelpCircle, keywords: "quiz trivia game" },
      ],
    },
  ], [t, isZh]);
}
