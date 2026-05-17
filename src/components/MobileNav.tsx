"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, BarChart3, Search, MoreHorizontal, GitCompareArrows, Swords, Target, AlertTriangle, ArrowLeftRight, History, Heart, ListOrdered, Clock, Flame, Award, Crown, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Users, Compass, Activity, Home, Shield, Repeat, HelpCircle, Book, Map as MapIcon, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocale } from "@/components/LocaleProvider";

export default function MobileNav() {
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [moreOpen, setMoreOpen] = useState(false);

  const mainLinks = useMemo(() => [
    { href: "/", label: t.nav.today, icon: Trophy },
    { href: "/calendar", label: t.nav.calendar, icon: Calendar },
    { href: "/stats", label: t.nav.stats, icon: BarChart3 },
    { href: "/search", label: t.nav.search, icon: Search },
  ], [t]);

  const moreGroups = useMemo(() => [
    {
      title: t.nav.explore,
      items: [
        { href: "/explore", label: "Explore", icon: Compass },
        { href: "/standings", label: t.nav.standings, icon: ListOrdered },
        { href: "/conference-race", label: "Conference", icon: Trophy },
        { href: "/schedule", label: t.nav.schedule, icon: Clock },
        { href: "/schedule-heatmap", label: "Heatmap", icon: Activity },
        { href: "/back-to-back", label: "B2Bs", icon: Repeat },
        { href: "/injuries", label: t.nav.injuries, icon: AlertTriangle },
        { href: "/transactions", label: t.nav.trades, icon: ArrowLeftRight },
        { href: "/quiz", label: "Quiz", icon: HelpCircle },
        { href: "/glossary", label: "Glossary", icon: Book },
      ],
    },
    {
      title: t.nav.analysis,
      items: [
        { href: "/streaks", label: "Streaks", icon: Flame },
        { href: "/power-rankings", label: "Power", icon: Crown },
        { href: "/tier-list", label: "Tiers", icon: Layers },
        { href: "/divisions", label: "Divisions", icon: MapIcon },
        { href: "/awards-race", label: "Awards", icon: Award },
        { href: "/game-predictor", label: "Predictor", icon: Zap },
        { href: "/scoring-output", label: "Output", icon: Shield },
        { href: "/home-vs-road", label: "Splits", icon: Home },
        { href: "/momentum", label: "Momentum", icon: TrendingUp },
        { href: "/clutch-teams", label: "Clutch", icon: Target },
        { href: "/rivalries", label: "Rivalries", icon: Swords },
        { href: "/compare", label: t.nav.compare, icon: GitCompareArrows },
        { href: "/h2h", label: t.nav.h2h, icon: Swords },
      ],
    },
    {
      title: "History",
      items: [
        { href: "/best-games", label: "Best Games", icon: Flame },
        { href: "/records", label: "Records", icon: BookOpen },
        { href: "/all-time-leaders", label: "All-Time", icon: Crown },
        { href: "/milestones", label: "Milestones", icon: TrendingUp },
        { href: "/history", label: t.nav.champions, icon: History },
      ],
    },
    {
      title: "Players",
      items: [
        { href: "/rookie-watch", label: "Rookies", icon: Sparkles },
        { href: "/draft-classes", label: "Classes", icon: GraduationCap },
        { href: "/by-country", label: "Global", icon: Globe },
        { href: "/by-position", label: "Position", icon: Users },
        { href: "/by-college", label: "College", icon: School },
        { href: "/this-day", label: "This Day", icon: CalendarDays },
        { href: "/favorites", label: t.nav.favorites, icon: Heart },
      ],
    },
  ], [t]);

  const allMoreLinks = useMemo(() => moreGroups.flatMap((g) => g.items), [moreGroups]);
  const isMoreActive = allMoreLinks.some(({ href }) => pathname === href);

  // Body scroll lock when More overlay is open — otherwise iOS Safari will
  // happily scroll the underlying page through the modal. Also closes on
  // Escape for desktop keyboard users (even on the sm:hidden version,
  // remote desktop / DevTools mobile emulation).
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={isZh ? "导航菜单" : "Navigation menu"}
        >
          {/* Spacer absorbs touch above panel — taps close, swipes don't reach body */}
          <div className="flex-1" aria-hidden="true" />
          <div
            className="bg-bg-card/95 backdrop-blur-xl border-t border-border rounded-t-2xl shadow-2xl mb-14 max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
          >
            {/* Handle bar + close button row — sticks to panel top while content scrolls */}
            <div className="flex items-center justify-center relative px-4 pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-border rounded-full" aria-hidden="true" />
              <button
                onClick={() => setMoreOpen(false)}
                aria-label={isZh ? "关闭" : "Close"}
                className="absolute right-2 top-2 p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable content area */}
            <div className="overflow-y-auto px-4 pb-2 flex-1">
              {moreGroups.map((group) => (
                <div key={group.title} className="mb-3">
                  <p className="text-[9px] font-mono text-text-secondary uppercase font-semibold tracking-[0.25em] mb-2 px-1">/ {group.title}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-colors min-h-[60px] cursor-pointer ${
                          pathname === href ? "bg-accent/15 text-accent ring-1 ring-accent/30" : "bg-bg-hover/60 text-text-secondary active:bg-bg-hover"
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[10px] font-medium leading-tight">{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 border-t border-border safe-area-bottom" role="navigation" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-14">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center px-2 py-1 rounded-lg transition-colors cursor-pointer relative ${
                  active ? "text-accent" : "text-text-secondary"
                }`}
              >
                {active && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            aria-label={isZh ? "更多导航选项" : "More navigation options"}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center px-2 py-1 rounded-lg transition-colors cursor-pointer relative ${
              moreOpen || isMoreActive ? "text-accent" : "text-text-secondary"
            }`}
          >
            {(moreOpen || isMoreActive) && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
            <MoreHorizontal size={20} strokeWidth={moreOpen || isMoreActive ? 2.5 : 2} />
            <span className={`text-[9px] ${moreOpen || isMoreActive ? "font-bold" : "font-medium"}`}>{t.nav.more}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
