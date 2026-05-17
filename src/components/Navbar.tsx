"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Calendar, Search, BarChart3, GitCompareArrows, Users, AlertTriangle, History, Target, Swords, ArrowLeftRight, MoreHorizontal, Flame, Award, Crown, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Compass, Activity, Home, Shield, Repeat, HelpCircle, Book, Map as MapIcon } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { TEAM_META } from "@/lib/teams";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";

const TEAMS = Object.values(TEAM_META);

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (teamsRef.current && !teamsRef.current.contains(e.target as Node)) {
        setTeamsOpen(false);
      }
    }
    if (teamsOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [teamsOpen]);

  // Primary nav — always visible
  const primaryLinks = useMemo(() => [
    { href: "/", label: t.nav.today, icon: Trophy },
    { href: "/calendar", label: t.nav.calendar, icon: Calendar },
    { href: "/stats", label: t.nav.stats, icon: BarChart3 },
    { href: "/standings", label: t.nav.standings, icon: BarChart3 },
  ], [t]);

  // Secondary nav — mega-menu organized into categorized columns
  const moreGroups = useMemo(() => [
    {
      title: "League Order",
      eyebrow: "Standings",
      color: "#FFD700",
      items: [
        { href: "/conference-race", label: "Conference Race", icon: Trophy },
        { href: "/divisions", label: "Divisions", icon: MapIcon },
        { href: "/power-rankings", label: "Power Rankings", icon: Crown },
        { href: "/tier-list", label: "Tier List", icon: Layers },
        { href: "/streaks", label: "Streaks", icon: Flame },
        { href: "/momentum", label: "Momentum", icon: TrendingUp },
        { href: "/clutch-teams", label: "Clutch Teams", icon: Target },
        { href: "/scoring-output", label: "Scoring Output", icon: Shield },
      ],
    },
    {
      title: "Awards & Leaders",
      eyebrow: "Hardware",
      color: "#A855F7",
      items: [
        { href: "/awards-race", label: "Awards Race", icon: Award },
        { href: "/all-time-leaders", label: "All-Time Leaders", icon: Crown },
        { href: "/milestones", label: "Milestones", icon: TrendingUp },
        { href: "/best-games", label: "Best Games", icon: Flame },
        { href: "/records", label: "Season Records", icon: BookOpen },
        { href: "/clutch", label: t.nav.playoffLeaders, icon: Target },
      ],
    },
    {
      title: "Players",
      eyebrow: "People",
      color: "#3B82F6",
      items: [
        { href: "/search", label: t.nav.playerSearch, icon: Search },
        { href: "/compare", label: t.nav.compare, icon: GitCompareArrows },
        { href: "/h2h", label: t.nav.h2h, icon: Swords },
        { href: "/rookie-watch", label: "Rookie Watch", icon: Sparkles },
        { href: "/draft-classes", label: "Draft Classes", icon: GraduationCap },
        { href: "/by-position", label: "By Position", icon: Users },
        { href: "/by-country", label: "By Country", icon: Globe },
        { href: "/by-college", label: "By College", icon: School },
        { href: "/favorites", label: t.nav.favorites, icon: Trophy },
      ],
    },
    {
      title: "More",
      eyebrow: "Tools & History",
      color: "#22C55E",
      items: [
        { href: "/explore", label: "Explore All", icon: Compass },
        { href: "/game-predictor", label: "Game Predictor", icon: Zap },
        { href: "/schedule-heatmap", label: "Schedule Heatmap", icon: Activity },
        { href: "/back-to-back", label: "Back-to-Backs", icon: Repeat },
        { href: "/home-vs-road", label: "Home vs Road", icon: Home },
        { href: "/rivalries", label: "Rivalries", icon: Swords },
        { href: "/this-day", label: "On This Day", icon: CalendarDays },
        { href: "/history", label: t.nav.champions, icon: History },
        { href: "/injuries", label: t.nav.injuries, icon: AlertTriangle },
        { href: "/transactions", label: t.nav.trades, icon: ArrowLeftRight },
        { href: "/glossary", label: "Glossary", icon: Book },
        { href: "/quiz", label: "NBA Quiz", icon: HelpCircle },
      ],
    },
  ], [t]);

  const allMoreHrefs = useMemo(() => moreGroups.flatMap((g) => g.items.map((i) => i.href)), [moreGroups]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isMoreActive = allMoreHrefs.some((href) => pathname === href);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) { document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }
  }, [moreOpen]);

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

          {/* More Dropdown */}
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMoreOpen(!moreOpen)}
              aria-label="More navigation options"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                moreOpen || isMoreActive ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}>
              <MoreHorizontal size={16} />
              <span className="hidden lg:inline">{t.nav.more}</span>
            </button>
            {moreOpen && (
              <div
                className="fixed right-3 sm:right-4 w-[min(92vw,760px)] glass-tile p-4 z-50 animate-fade-in overflow-y-auto"
                style={{
                  top: "68px",
                  maxHeight: "calc(100vh - 80px)",
                }}
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4">
                  {moreGroups.map((group) => (
                    <div key={group.title} className="min-w-0">
                      <div className="mb-2 pb-1.5 border-b border-border/60">
                        <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-text-secondary/50">/ {group.eyebrow}</p>
                        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: group.color }}>{group.title}</p>
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map(({ href, label, icon: Icon }) => (
                          <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                              pathname === href ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                            }`}>
                            <Icon size={13} className="shrink-0" />
                            <span className="truncate">{label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Teams Dropdown */}
          <div className="relative" ref={teamsRef}>
            <button
              onClick={() => setTeamsOpen(!teamsOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                teamsOpen || pathname.startsWith("/team")
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Users size={16} />
              <span className="hidden lg:inline">{t.nav.teams}</span>
            </button>
            {teamsOpen && (
              <div
                className="fixed right-3 sm:right-4 w-[360px] max-w-[92vw] glass-tile p-3 z-50 animate-fade-in overflow-y-auto"
                style={{
                  top: "68px",
                  maxHeight: "calc(100vh - 80px)",
                }}
              >
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
                        width={28}
                        height={28}
                        unoptimized
                      />
                      <span className="text-[10px] text-text-secondary group-hover:text-accent transition-colors font-mono">{tm.tricode}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

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
    </nav>
  );
}
