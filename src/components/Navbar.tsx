"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, Search, BarChart3 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K shortcut to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  const links = [
    { href: "/", label: "Today", icon: Trophy },
    { href: "/schedule", label: "Schedule", icon: Calendar },
    { href: "/stats", label: "Stats", icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-bg-secondary/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center group-hover:bg-accent-hover transition-colors">
            <Trophy size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            NBA<span className="text-accent">Tracker</span>
            <span className="text-[10px] text-text-secondary font-normal ml-1.5 hidden sm:inline">by FXY</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}

          {/* Search */}
          <div className="relative ml-2">
            {searchOpen ? (
              <form
                action="/search"
                className="flex items-center"
                onSubmit={() => setSearchOpen(false)}
              >
                <input
                  ref={inputRef}
                  autoFocus
                  name="q"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search players..."
                  className="w-48 bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  onBlur={() => {
                    if (!searchQuery) setSearchOpen(false);
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Search (Ctrl+K)"
              >
                <Search size={18} />
                <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-bg-card border border-border rounded text-text-secondary">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
