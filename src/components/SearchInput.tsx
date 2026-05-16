"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface SearchResult {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  jersey: string;
  position: string;
  pts: number;
  reb: number;
  ast: number;
}

const SEARCH_HISTORY_KEY = "nba-search-history";
const MAX_HISTORY = 5;

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSearchHistory(query: string) {
  try {
    const history = getSearchHistory().filter((q) => q !== query);
    history.unshift(query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export default function SearchInput({ initialQuery = "" }: { initialQuery?: string }) {
  const { t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Hydration: search history from localStorage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when results change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(-1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < results.length) {
      e.preventDefault();
      const selected = results[selectedIndex];
      setShowDropdown(false);
      window.location.href = `/player/${selected.personId}`;
    }
  };

  // Debounced search — clearing results below the threshold and setting them
  // post-fetch are intentional state syncs for an external input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data || []);
          setShowDropdown(true);
          if ((json.data || []).length > 0) {
            saveSearchHistory(query.trim());
            setSearchHistory(getSearchHistory());
          }
        }
      } catch { /* timeout or network error */ }
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (results.length > 0) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={t.nav.searchPlaceholder}
          aria-label={t.nav.searchPlaceholder}
          className="w-full bg-bg-card border border-border rounded-xl pl-11 pr-10 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors"
          autoFocus
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setShowDropdown(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Recent search history */}
      {focused && !query && searchHistory.length > 0 && !showDropdown && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {searchHistory.map((q) => (
            <button
              key={q}
              onMouseDown={(e) => { e.preventDefault(); setQuery(q); }}
              className="text-xs px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto">
          {/* Feature 10: Result count */}
          <div className="px-4 py-2 border-b border-border/50 bg-bg-secondary/50" aria-live="polite">
            <span className="text-xs text-text-secondary font-medium">{results.length} {results.length !== 1 ? t.common.players : t.common.player}</span>
          </div>
          {results.map((p, idx) => (
            <Link
              key={p.personId}
              href={`/player/${p.personId}`}
              onClick={() => setShowDropdown(false)}
              className={`flex items-center gap-3 px-4 py-3 transition-colors border-b border-border/50 last:border-0 ${idx === selectedIndex ? "bg-accent/10" : "hover:bg-bg-hover"}`}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                <Image
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.personId}.png`}
                  alt={`${p.firstName} ${p.lastName}`}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">
                  {p.firstName} {p.lastName}
                </p>
                <p className="text-xs text-text-secondary">
                  {p.teamCity} {p.teamName} &middot; #{p.jersey} {p.position}
                </p>
              </div>
              <div className="text-right shrink-0 flex items-center gap-1.5">
                {p.pts > 25 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">{t.searchPage.star}</span>
                )}
                <div>
                  <p className="text-xs text-accent font-medium">{p.pts} PPG</p>
                  <p className="text-xs text-text-secondary">{p.reb} RPG &middot; {p.ast} APG</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 top-full mt-2 w-full bg-bg-card border border-border rounded-xl shadow-2xl p-6 text-center">
          <svg viewBox="0 0 80 80" className="w-16 h-16 mx-auto mb-3 opacity-20">
            <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <line x1="40" y1="12" x2="40" y2="68" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12,40 Q40,18 68,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12,40 Q40,62 68,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="text-text-primary text-sm font-medium">{t.searchPage.noResults}</p>
          <p className="text-text-secondary text-xs mt-1">
            {t.searchPage.noResultsFor} &ldquo;{query}&rdquo;{t.searchPage.tryDifferent}
          </p>
        </div>
      )}
    </div>
  );
}
