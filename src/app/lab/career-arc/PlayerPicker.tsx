"use client";

// Minimal player picker for the Career Arc tool. Reuses the /api/search
// endpoint (same as the global SearchInput) but, instead of going to
// /player/{id}, navigates within the tool — /lab/career-arc?id={picked} — so
// the server page re-resolves the name + the client refetches the new arc.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { playerHeadshotUrl } from "@/lib/teamUrls";

interface SearchResult {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  teamCity: string;
  teamName: string;
  position: string;
  pts: number;
}

interface Props {
  isZh: boolean;
  currentName: string;
}

export default function PlayerPicker({ isZh, currentName }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id so a slow earlier query can't overwrite newer results, and a
  // fetch in flight when the user picks/clears can't re-open the dropdown.
  const searchReqId = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search. Clearing results below the threshold and setting them
  // post-fetch are intentional state syncs for an external input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const reqId = ++searchReqId.current;
      setLoading(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (reqId !== searchReqId.current) return; // a newer query (or a pick/clear) superseded us
        if (res.ok) {
          const json = await res.json();
          if (reqId !== searchReqId.current) return;
          // De-dupe by personId — search can return the same player as both an
          // active entry and a legend/iconic-season entry.
          const seen = new Set<number>();
          const list = (json.data || []).filter((p: SearchResult) => {
            if (!p.personId || seen.has(p.personId)) return false;
            seen.add(p.personId);
            return true;
          });
          setResults(list);
          setOpen(true);
        }
      } catch {
        /* timeout or network error — leave previous results */
      }
      if (reqId === searchReqId.current) setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pick = (id: number) => {
    searchReqId.current++; // invalidate any in-flight search so it can't re-open the dropdown
    setOpen(false);
    setQuery("");
    router.push(`/lab/career-arc?id=${id}`);
  };

  return (
    <div ref={wrapperRef} className="relative w-full sm:max-w-sm">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={
            currentName
              ? (isZh ? `当前：${currentName} · 搜索切换球员` : `Now: ${currentName} · search to switch`)
              : (isZh ? "搜索球员…" : "Search a player…")
          }
          aria-label={isZh ? "搜索球员" : "Search a player"}
          className="w-full glass-tile pl-9 pr-9 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors"
        />
        {query && (
          <button
            onClick={() => { searchReqId.current++; setQuery(""); setResults([]); setOpen(false); }}
            aria-label={isZh ? "清除" : "Clear"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={14} />
          </button>
        )}
        {loading && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full glass-tile shadow-2xl overflow-hidden max-h-[360px] overflow-y-auto animate-fade-in">
          {results.map((p) => (
            <button
              key={p.personId}
              onClick={() => pick(p.personId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-0 hover:bg-bg-hover cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                <Image
                  src={playerHeadshotUrl(p.personId)}
                  alt={`${p.firstName} ${p.lastName}`}
                  width={36}
                  height={36}
                  unoptimized
                  className="w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm truncate">{p.firstName} {p.lastName}</p>
                <p className="text-xs text-text-secondary truncate">
                  {p.teamCity} {p.teamName}{p.position ? ` · ${p.position}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 top-full mt-2 w-full glass-tile shadow-2xl p-4 text-center">
          <p className="text-text-secondary text-xs">
            {isZh ? `未找到 “${query}”` : `No players match “${query}”`}
          </p>
        </div>
      )}
    </div>
  );
}
