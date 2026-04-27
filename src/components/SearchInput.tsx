"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";

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

export default function SearchInput({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      // Use a 0ms timeout to avoid synchronous setState in effect
      debounceRef.current = setTimeout(() => {
        setResults([]);
        setShowDropdown(false);
      }, 0);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data || []);
          setShowDropdown(true);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);

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
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search players by name..."
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

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto">
          {results.map((p) => (
            <Link
              key={p.personId}
              href={`/player/${p.personId}`}
              onClick={() => setShowDropdown(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors border-b border-border/50 last:border-0"
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
              <div className="text-right shrink-0">
                <p className="text-xs text-accent font-medium">{p.pts} PPG</p>
                <p className="text-xs text-text-secondary">{p.reb} RPG &middot; {p.ast} APG</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 top-full mt-2 w-full bg-bg-card border border-border rounded-xl shadow-2xl p-6 text-center">
          <p className="text-text-secondary text-sm">No players found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
