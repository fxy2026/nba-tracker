"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Calendar, Search, BarChart3, GitCompareArrows, Users, AlertTriangle, History, Target, Swords, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { TEAM_META } from "@/lib/teams";
import ThemeToggle from "@/components/ThemeToggle";

const TEAMS = Object.values(TEAM_META);

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollPct(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
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
  const primaryLinks = [
    { href: "/", label: "Today", icon: Trophy },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/stats", label: "Stats", icon: BarChart3 },
    { href: "/standings", label: "Standings", icon: BarChart3 },
  ];

  // Secondary nav — inside "More" dropdown
  const moreLinks = [
    { href: "/compare", label: "Compare Players", icon: GitCompareArrows },
    { href: "/h2h", label: "Head to Head", icon: Swords },
    { href: "/clutch", label: "Playoff Leaders", icon: Target },
    { href: "/injuries", label: "Injury Report", icon: AlertTriangle },
    { href: "/transactions", label: "Trades", icon: ArrowLeftRight },
    { href: "/history", label: "Champions", icon: History },
    { href: "/search", label: "Player Search", icon: Search },
    { href: "/favorites", label: "Favorites", icon: Trophy },
  ];

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isMoreActive = moreLinks.some(({ href }) => pathname === href);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) { document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }
  }, [moreOpen]);

  return (
    <nav className="sticky top-0 z-50 bg-bg-secondary/90 backdrop-blur-md border-b border-border safe-area-top" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 h-12 sm:h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-accent rounded-lg flex items-center justify-center group-hover:bg-accent-hover transition-colors">
            <Trophy size={18} className="text-white" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight">
            NBA<span className="text-accent">Tracker</span>
            <span className="text-[10px] text-text-secondary font-normal ml-1.5 hidden sm:inline">by FXY</span>
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                moreOpen || isMoreActive ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}>
              <MoreHorizontal size={16} />
              <span className="hidden lg:inline">More</span>
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50">
                {moreLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      pathname === href ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    }`}>
                    <Icon size={14} />
                    {label}
                  </Link>
                ))}
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
              <span className="hidden lg:inline">Teams</span>
            </button>
            {teamsOpen && (
              <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[90vw] bg-bg-card border border-border rounded-xl shadow-2xl p-3 z-50">
                <div className="grid grid-cols-5 gap-1.5">
                  {TEAMS.map((t) => (
                    <Link
                      key={t.tricode}
                      href={`/team/${t.tricode}`}
                      onClick={() => setTeamsOpen(false)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-bg-hover transition-colors group"
                      title={`${t.city} ${t.name}`}
                    >
                      <Image
                        src={`https://cdn.nba.com/logos/nba/${t.teamId}/global/L/logo.svg`}
                        alt={t.tricode}
                        width={28}
                        height={28}
                        unoptimized
                      />
                      <span className="text-[10px] text-text-secondary group-hover:text-accent transition-colors">{t.tricode}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                  placeholder="Search players..."
                  aria-label="Search players"
                  className="w-48 bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  onBlur={() => { setTimeout(() => { if (!searchQuery) setSearchOpen(false); }, 150); }}
                />
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Search (Ctrl+K)"
              >
                <Search size={18} />
                <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 bg-bg-card border border-border rounded text-text-secondary">⌘K</kbd>
              </button>
            )}
          </div>
        </div>

        {/* Mobile right side — only search + theme */}
        <div className="flex sm:hidden items-center gap-1">
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
