"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Calendar, Search, BarChart3, GitCompareArrows, Users, AlertTriangle, History, Target, Swords, ArrowLeftRight, MoreHorizontal, Flame, Award, Crown, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Compass, Activity, Home, Shield, Repeat, HelpCircle, Book, Map as MapIcon } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { TEAM_META } from "@/lib/teams";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import CommandPalette, { type PaletteGroup } from "@/components/CommandPalette";

const TEAMS = Object.values(TEAM_META);

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function handleScroll() {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollPct(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
      setScrolled(scrollTop > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        if (searchOpen) { setSearchOpen(false); setSearchQuery(""); }
        if (teamsOpen) setTeamsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, teamsOpen]);

  // Teams dropdown close: handled by backdrop click + Escape (in keyboard handler above)

  // Primary nav — always visible
  const primaryLinks = useMemo(() => [
    { href: "/", label: t.nav.today, icon: Trophy },
    { href: "/calendar", label: t.nav.calendar, icon: Calendar },
    { href: "/stats", label: t.nav.stats, icon: BarChart3 },
    { href: "/standings", label: t.nav.standings, icon: BarChart3 },
  ], [t]);

  // Portal target available only on client. By the time user clicks a button to open
  // the dropdown, hydration is complete and document.body exists.
  const portalReady = typeof window !== "undefined";

  // Secondary nav — mega-menu organized into categorized columns
  const moreGroups: PaletteGroup[] = useMemo(() => [
    {
      title: isZh ? "联赛排序" : "League Order",
      eyebrow: isZh ? "排名" : "Standings",
      color: "#FFD700",
      items: [
        { href: "/conference-race", label: isZh ? "分区赛" : "Conference Race", icon: Trophy, keywords: "conference race playoff seeding" },
        { href: "/divisions", label: isZh ? "六分区" : "Divisions", icon: MapIcon, keywords: "divisions atlantic central southeast" },
        { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings", icon: Crown, keywords: "power rankings" },
        { href: "/tier-list", label: isZh ? "等级表" : "Tier List", icon: Layers, keywords: "tier list S A B C" },
        { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", icon: Flame, keywords: "streaks hot cold" },
        { href: "/momentum", label: isZh ? "趋势" : "Momentum", icon: TrendingUp, keywords: "momentum trend" },
        { href: "/clutch-teams", label: isZh ? "关键时刻" : "Clutch Teams", icon: Target, keywords: "clutch close games" },
        { href: "/scoring-output", label: isZh ? "攻防输出" : "Scoring Output", icon: Shield, keywords: "scoring offense defense net" },
      ],
    },
    {
      title: isZh ? "奖项与排行" : "Awards & Leaders",
      eyebrow: isZh ? "奖项" : "Hardware",
      color: "#A855F7",
      items: [
        { href: "/awards-race", label: isZh ? "奖项争夺" : "Awards Race", icon: Award, keywords: "MVP ROY DPOY 6MOY MIP" },
        { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", icon: Crown, keywords: "all time leaders PPG career" },
        { href: "/milestones", label: isZh ? "里程碑" : "Milestones", icon: TrendingUp, keywords: "milestones career thresholds" },
        { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", icon: Flame, keywords: "best games closest blowouts OT" },
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
        { href: "/compare", label: t.nav.compare, icon: GitCompareArrows, keywords: "compare player stats" },
        { href: "/h2h", label: t.nav.h2h, icon: Swords, keywords: "head to head h2h matchup" },
        { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", icon: Sparkles, keywords: "rookie watch first year" },
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", icon: GraduationCap, keywords: "draft classes year" },
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

  const allMoreHrefs = useMemo(() => moreGroups.flatMap((g) => g.items.map((i) => i.href)), [moreGroups]);

  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = allMoreHrefs.some((href) => pathname === href);

  // Cmd+M / Ctrl+M shortcut to open the command palette (Cmd+K is search)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        setMoreOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav
      data-scrolled={scrolled ? "true" : "false"}
      className="sticky top-0 z-50 bg-bg-secondary/75 backdrop-blur-md border-b border-border safe-area-top transition-all duration-300"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 h-12 sm:h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent-gradient flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-accent/30">
            <Trophy size={17} className="text-white" />
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/20 pointer-events-none" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight">
            NBA<span className="text-accent">Tracker</span>
            <span className="text-[10px] text-text-secondary font-normal ml-1.5 hidden sm:inline font-mono uppercase tracking-[0.15em]">by FXY</span>
          </span>
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
          {primaryLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} prefetch={true}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}>
                <Icon size={16} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}

          {/* More button — opens command palette modal */}
          <button onClick={() => setMoreOpen(true)}
            aria-label="More navigation options"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isMoreActive ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}>
            <MoreHorizontal size={16} />
            <span className="hidden lg:inline">{t.nav.more}</span>
          </button>

          {/* Teams button — opens 30-team grid */}
          <button
            type="button"
            onClick={() => setTeamsOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              teamsOpen || pathname.startsWith("/team")
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <Users size={16} />
            <span className="hidden lg:inline">{t.nav.teams}</span>
          </button>

          <LocaleToggle />
          <ThemeToggle />

          {/* Search */}
          <div className="relative ml-1">
            {searchOpen ? (
              <form className="flex items-center" onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  setSearchOpen(false);
                  setSearchQuery("");
                }
              }}>
                <input
                  ref={inputRef}
                  autoFocus
                  name="q"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.nav.searchPlaceholder}
                  aria-label={t.nav.search}
                  className="w-48 bg-bg-card/70 backdrop-blur-md border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60 focus:bg-bg-card transition-colors"
                  onBlur={() => { setTimeout(() => { if (!searchQuery) setSearchOpen(false); }, 150); }}
                />
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title={t.nav.searchShortcut}
              >
                <Search size={18} />
                <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 bg-bg-card border border-border rounded text-text-secondary">⌘K</kbd>
              </button>
            )}
          </div>
        </div>

        {/* Mobile right side — only search + theme + locale */}
        <div className="flex sm:hidden items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <button
            onClick={() => {
              router.push("/search");
            }}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Search size={18} />
          </button>
        </div>
      </div>
      {/* Scroll progress bar */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-transparent">
        <div className="h-full bg-accent transition-[width] duration-75" style={{ width: `${scrollPct}%` }} />
      </div>

      {/* Command palette (renders to document.body via portal — escapes nav containment) */}
      <CommandPalette open={moreOpen} onClose={() => setMoreOpen(false)} groups={moreGroups} />

      {/* Teams modal — portaled to body so nav's backdrop-filter doesn't trap it */}
      {teamsOpen && portalReady && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[8vh] animate-fade-in"
          onClick={() => setTeamsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Teams"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-tile p-4 shadow-2xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-accent" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">{t.nav.teams}</p>
              </div>
              <button
                onClick={() => setTeamsOpen(false)}
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary border border-border px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {TEAMS.map((tm) => (
                <Link
                  key={tm.tricode}
                  href={`/team/${tm.tricode}`}
                  onClick={() => setTeamsOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-bg-hover transition-colors group cursor-pointer"
                  title={`${tm.city} ${tm.name}`}
                >
                  <Image
                    src={`https://cdn.nba.com/logos/nba/${tm.teamId}/global/L/logo.svg`}
                    alt={tm.tricode}
                    width={32}
                    height={32}
                    unoptimized
                  />
                  <span className="text-[10px] text-text-secondary group-hover:text-accent transition-colors font-mono">{tm.tricode}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}
