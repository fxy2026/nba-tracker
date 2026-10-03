"use client";

import { useState, useEffect, useLayoutEffect, useRef, useId, type KeyboardEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X, UserRound, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { playerIndexLabel } from "@/lib/player-index-provenance";
import type { PlayerIdentity } from "@/lib/player-identity";
import { canSearchPlayers, isPlayerSearchResult, playerNameMatch } from "@/lib/player-search-ui";
import { positionSelectPopup, type SelectPopupPosition } from "./ui/select-behavior";
import styles from "./player-search.module.css";

const SEARCH_HISTORY_KEY = "nba-search-history";
const MAX_HISTORY = 5;

function getSearchHistory(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 100).slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}
function saveSearchHistory(query: string) {
  try {
    const history = getSearchHistory().filter((item) => item !== query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([query, ...history].slice(0, MAX_HISTORY)));
  } catch { /* Storage is optional. */ }
}

interface SearchInputProps {
  initialQuery?: string;
  variant?: "page" | "home";
  autoFocus?: boolean;
}

function ResultName({ name, query }: { name: string; query: string }) {
  const match = playerNameMatch(name, query);
  return <span className={styles.name}>{match ? <>{name.slice(0, match.start)}<mark>{name.slice(match.start, match.end)}</mark>{name.slice(match.end)}</> : name}</span>;
}

export default function SearchInput({ initialQuery = "", variant = "page", autoFocus = variant === "page" }: SearchInputProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const isZh = locale === "zh";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlayerIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [popupPosition, setPopupPosition] = useState<SelectPopupPosition | null>(null);
  const id = useId();
  const listId = `${id}-players`;
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  // Dismissing while a request is pending must not let its result reopen the menu.
  const allowOpen = useRef(Boolean(initialQuery));
  const limit = variant === "home" ? 8 : 30;
  const popupOpen = (showDropdown && canSearchPlayers(query)) || (focused && !showDropdown && !canSearchPlayers(query));

  useEffect(() => {
    requestRef.current?.abort();
    allowOpen.current = Boolean(initialQuery);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt a newly committed URL query, preserving unrelated typing drafts
    setQuery(initialQuery);
    setResults([]);
    setSelectedIndex(-1);
    setShowDropdown(false);
    setLoading(false);
    setError(false);
  }, [initialQuery]);

  function changeQuery(next: string) {
    requestRef.current?.abort();
    allowOpen.current = true;
    setQuery(next.slice(0, 100));
    setResults([]);
    setSelectedIndex(-1);
    setShowDropdown(false);
    setLoading(false);
    setError(false);
  }
  function dismiss() {
    allowOpen.current = false;
    setShowDropdown(false);
    setSelectedIndex(-1);
    setFocused(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- optional browser storage only after hydration
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    function outside(event: Event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) {
        allowOpen.current = false;
        setShowDropdown(false);
        setSelectedIndex(-1);
        setFocused(false);
      }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!popupOpen || !inputRef.current || !popupRef.current) return;
    const updatePosition = (event?: Event) => {
      if (event?.target === popupRef.current || !inputRef.current || !popupRef.current) return;
      const viewport = window.visualViewport;
      const bounds = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0, width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight };
      const rect = inputRef.current.getBoundingClientRect();
      // Apply width before measuring wrapped names. The shared Select helper
      // flips above the field and bounds height around the mobile keyboard.
      popupRef.current.style.width = `${positionSelectPopup(rect, bounds, 320).width}px`;
      const next = positionSelectPopup(rect, bounds, popupRef.current.scrollHeight + 2);
      setPopupPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof SelectPopupPosition] === next[key as keyof SelectPopupPosition]) ? previous : next);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updatePosition());
    observer?.observe(inputRef.current);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      observer?.disconnect();
    };
  }, [popupOpen, query, results.length, loading, error, searchHistory.length]);

  useEffect(() => {
    if (!showDropdown || selectedIndex < 0 || !listRef.current) return;
    const option = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    const panel = listRef.current.parentElement;
    if (!option || !panel) return;
    // Scroll only the dropdown, not the scoreboard underneath it.
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight;
  }, [showDropdown, selectedIndex]);

  function navigate(player: PlayerIdentity) {
    dismiss();
    router.push(`/player/${player.id}`);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
    if (event.key === "Tab") { dismiss(); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length > 0) {
      event.preventDefault();
      allowOpen.current = true;
      setShowDropdown(true);
      setSelectedIndex((previous) => event.key === "ArrowDown" ? (previous + 1) % results.length : (previous <= 0 ? results.length : previous) - 1);
      return;
    }
    if (event.key === "Enter" && showDropdown && results.length > 0) {
      const selected = selectedIndex >= 0 ? selectedIndex : results.length === 1 ? 0 : -1;
      if (selected >= 0 && selected < results.length) { event.preventDefault(); navigate(results[selected]); }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    if (!canSearchPlayers(query)) return () => controller.abort();

    const debounce = setTimeout(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(false);
      setShowDropdown(allowOpen.current);
      deadline = setTimeout(() => {
        controller.abort();
        if (requestRef.current === controller) {
          setLoading(false);
          setError(true);
          setShowDropdown(allowOpen.current);
        }
      }, 8000);
      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const json: { data?: unknown } = await response.json();
        if (controller.signal.aborted) return;
        if (!Array.isArray(json.data)) throw new Error("Invalid search response");
        if (json.data.some((row) => !isPlayerSearchResult(row))) throw new Error("Invalid player identity");
        const unique = new Set<number>();
        const rows = json.data.filter(isPlayerSearchResult).filter((row) => {
          if (unique.has(row.id)) return false;
          unique.add(row.id);
          return true;
        }).slice(0, limit);
        setResults(rows);
        setSelectedIndex(-1);
        setShowDropdown(allowOpen.current);
        if (rows.length > 0) {
          saveSearchHistory(query.trim());
          setSearchHistory(getSearchHistory());
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setShowDropdown(allowOpen.current);
        }
      } finally {
        clearTimeout(deadline);
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(debounce);
      clearTimeout(deadline);
    };
  }, [query, initialQuery, limit, retry]);

  const resultMenu = showDropdown && canSearchPlayers(query);
  const helpMenu = focused && !showDropdown && !canSearchPlayers(query);
  const hasResults = resultMenu && !loading && !error && results.length > 0;
  const status = loading ? (isZh ? "正在搜索…" : "Searching…") : error ? (isZh ? "搜索暂时不可用" : "Search is temporarily unavailable") : `${results.length} ${isZh ? "位球员" : results.length === 1 ? "player" : "players"}`;

  return (
    <div ref={wrapperRef} className={`${styles.root} ${variant === "home" ? styles.home : ""}`} data-player-search={variant}>
      <form role="search" aria-label={isZh ? "球员搜索" : "Player search"} onSubmit={(event) => {
        event.preventDefault();
        if (canSearchPlayers(query)) { dismiss(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }
      }}>
        <div className={styles.field}>
          <Search size={20} aria-hidden="true" className={styles.icon} />
          <input
            ref={inputRef} type="search" role="combobox" autoComplete="off" spellCheck={false}
            value={query} maxLength={100} onChange={(event) => changeQuery(event.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => { allowOpen.current = true; setFocused(true); if (canSearchPlayers(query)) setShowDropdown(true); }}
            placeholder={isZh ? "球员姓名 / NBA ID" : "Player name or NBA ID"}
            aria-label={isZh ? "搜索球员姓名或 NBA ID" : "Search player name or NBA ID"}
            aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={Boolean(hasResults)}
            aria-controls={hasResults ? listId : undefined}
            aria-activedescendant={hasResults && selectedIndex >= 0 ? `${listId}-${results[selectedIndex]?.id}` : undefined}
            aria-describedby={`${id}-hint`} className={styles.input} autoFocus={autoFocus}
          />
          {query && <button type="button" aria-label={isZh ? "清空搜索" : "Clear search"} onClick={() => { changeQuery(""); inputRef.current?.focus(); }} className={styles.clear}><X size={17} aria-hidden="true" /></button>}
        </div>
      </form>
      <span id={`${id}-hint`} className="sr-only">{isZh ? "支持中英文姓名、昵称和 NBA ID。使用上下方向键选择，回车打开，Esc 关闭。" : "Search names, known aliases or NBA IDs. Use arrow keys to choose, Enter to open, Escape to close."}</span>
      <span className="sr-only" aria-live="polite">{resultMenu ? status : ""}</span>
      {helpMenu && typeof document !== "undefined" && createPortal(<div ref={popupRef} className={styles.popup} style={popupPosition ?? { visibility: "hidden" }}>
        <div className={styles.hint}><strong>{isZh ? "从名字或球员 ID 开始" : "Start with a name or player ID"}</strong>{isZh ? "例如 Curry、乔丹、2544" : "Try Curry, Michael Jordan, or 2544"}</div>
        {searchHistory.length > 0 && !query && <><div className={styles.caption}>{isZh ? "最近搜索" : "Recent searches"}</div>{searchHistory.map((item) => <button key={item} type="button" className={styles.history} onMouseDown={(event) => event.preventDefault()} onClick={() => { changeQuery(item); inputRef.current?.focus(); }}>{item}</button>)}</>}
      </div>, document.body)}
      {resultMenu && typeof document !== "undefined" && createPortal(<div ref={popupRef} className={styles.popup} style={popupPosition ?? { visibility: "hidden" }} data-player-search-popup="true">
        {loading ? <div className={`${styles.hint} flex items-center gap-2`}><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />{status}</div>
          : error ? <div className={styles.hint}><strong>{status}</strong>{isZh ? "请稍后重试，输入的内容会保留。" : "Please try again. Your search is still here."}<div><button type="button" className={styles.retry} onClick={() => { allowOpen.current = true; setRetry((value) => value + 1); }}>{isZh ? "重试" : "Try again"}</button></div></div>
          : results.length === 0 ? <div className={styles.hint}><strong>{t.searchPage.noResults}</strong>{isZh ? "试试完整姓名、英文拼写或 NBA ID。" : "Try the full name, another spelling, or an NBA ID."}</div>
          : <>
            <div className={styles.caption}><span>{status}</span><span>{isZh ? "打开球员档案" : "Open player profile"}</span></div>
            <div id={listId} ref={listRef} role="listbox" aria-label={isZh ? "匹配的球员" : "Matching players"}>
              {results.map((player, index) => {
                const context = [player.teamLabel, player.position].filter(Boolean).join(" · ");
                const years = player.sourceYears ? `${player.sourceYears.from}${player.sourceYears.from === player.sourceYears.to ? "" : `–${player.sourceYears.to}`} · ${isZh ? "NBA 赛季起始年" : "NBA season starts"}` : null;
                const source = player.indexProvenance ? playerIndexLabel(player.indexProvenance, locale) : player.shotCoverage ? `${player.shotCoverage.firstSeason}–${player.shotCoverage.lastSeason} · ${isZh ? "投篮档案" : "shot archive"}` : (isZh ? "NBA 球员名录" : "NBA player index");
                return <Link key={player.id} id={`${listId}-${player.id}`} href={`/player/${player.id}`} prefetch={false} role="option" aria-selected={index === selectedIndex} tabIndex={-1}
                  onClick={dismiss} onPointerMove={(event) => { if (event.pointerType === "mouse") setSelectedIndex(index); }}
                  onPointerDown={(event) => { if (event.pointerType === "mouse") event.preventDefault(); }}
                  className={styles.option} data-active={index === selectedIndex || undefined}>
                  <span className={styles.avatar} aria-hidden="true"><UserRound size={17} /></span>
                  <span className="min-w-0 flex-1"><ResultName name={player.name} query={query} /><span className={styles.context}>{context ? `${context} · ` : ""}{!player.indexProvenance && years ? years : source}</span></span>
                  <span className={styles.id}>ID {player.id}</span><ArrowUpRight size={15} aria-hidden="true" className="shrink-0 text-text-secondary" />
                </Link>;
              })}
            </div>
          </>}
      </div>, document.body)}
    </div>
  );
}
