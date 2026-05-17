"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Calendar, Search, BarChart3, GitCompareArrows, Users, AlertTriangle, History, Target, Swords, ArrowLeftRight, MoreHorizontal, Flame, Award, Crown, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Compass, Activity, Home, Shield, Repeat, HelpCircle, Book, Map as MapIcon } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import CommandPalette from "@/components/CommandPalette";
import { useMoreGroups } from "@/lib/useMoreGroups";

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
  const teamsDialogRef = useRef<HTMLDivElement>(null);
  const teamsCloseBtnRef = useRef<HTMLButtonElement>(null);
  const teamsTriggerRef = useRef<HTMLElement | null>(null);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // Perf: rAF-throttle the scroll handler. Previously fired setState 60-120
    // times/sec on fast scroll, each triggering Navbar (35-item moreGroups) re-render.
    let ticking = false;
    let lastPct = -1;
    let lastScrolled = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const nextPct = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
        const nextScrolled = scrollTop > 8;
        // Only setState when value actually changed — avoid pointless re-renders
        if (nextPct !== lastPct) {
          lastPct = nextPct;
          setScrollPct(nextPct);
        }
        if (nextScrolled !== lastScrolled) {
          lastScrolled = nextScrolled;
          setScrolled(nextScrolled);
        }
        ticking = false;
      });
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

  // Teams modal: body scroll lock + focus trap + initial focus + restore on close.
  useEffect(() => {
    if (!teamsOpen) return;
    // Capture trigger so we can restore focus on close
    teamsTriggerRef.current = (document.activeElement as HTMLElement) || null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Initial focus on the close button
    const id = setTimeout(() => { teamsCloseBtnRef.current?.focus(); }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = teamsDialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to trigger
      teamsTriggerRef.current?.focus?.();
      teamsTriggerRef.current = null;
    };
  }, [teamsOpen]);

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
  // Shared moreGroups — same data drives MobileNav's "更多" button via the
  // useMoreGroups hook. Centralizing eliminates the drift that previously
  // left mobile entirely in English.
  const moreGroups = useMoreGroups();

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
      className="sticky top-0 z-50 bg-bg-secondary/95 border-b border-border safe-area-top"
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
            aria-label={isZh ? "更多导航选项" : "More navigation options"}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
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
            aria-label={isZh ? "球队菜单" : "Teams menu"}
            aria-haspopup="dialog"
            aria-expanded={teamsOpen}
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
                aria-label={isZh ? "打开搜索" : "Open search"}
                aria-expanded={searchOpen}
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
            aria-label={isZh ? "搜索" : "Search"}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
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

      {/* Teams modal — portaled to body. Perf: solid backdrop (no blur),
          plain <img> instead of next/image (30 instances of next/image add
          ~30 React state subscriptions + LCP work for a transient modal). */}
      {teamsOpen && portalReady && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[8vh]"
          onClick={() => setTeamsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="teams-modal-title"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            ref={teamsDialogRef}
            className="relative w-full max-w-md bg-bg-card border border-border rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-accent" />
                <h2 id="teams-modal-title" className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">{t.nav.teams}</h2>
              </div>
              <button
                ref={teamsCloseBtnRef}
                onClick={() => setTeamsOpen(false)}
                aria-label={isZh ? "关闭球队菜单 (Esc)" : "Close teams menu (Esc)"}
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary border border-border px-1.5 py-0.5 rounded hover:bg-bg-hover cursor-pointer inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
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
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-bg-hover cursor-pointer"
                  title={`${tm.city} ${tm.name}`}
                  prefetch={false}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={teamLogoUrl(tm.teamId)}
                    alt={tm.tricode}
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="text-[10px] text-text-secondary font-mono">{tm.tricode}</span>
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
