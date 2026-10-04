"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, type LucideIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export interface PaletteItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string;
}

export interface PaletteGroup {
  title: string;
  eyebrow?: string;
  color: string;
  items: PaletteItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  groups: PaletteGroup[];
}

/**
 * Perf rebuild:
 *  - O(1) globalIdx lookup via Map (was O(n²) indexOf)
 *  - Keyboard handler reads activeIdx/flatItems via refs → stable, registers once
 *  - Memo'd PaletteRow extracted so item rerender only happens for changed item
 *  - Single onMouseEnter handler walks data-idx attribute (no per-row closure)
 */
export default function CommandPalette({ open, onClose, groups }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-results`;

  // Each opening owns its focus timer and restores the trigger on close.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const id = setTimeout(() => {
      setQuery("");
      setActiveIdx(0);
      // Browsing the menu should not immediately cover it with a phone keyboard.
      // Desktop retains the searchable-first keyboard workflow.
      if (window.matchMedia?.("(max-width: 639px) and (pointer: coarse)").matches) dialogRef.current?.focus();
      else inputRef.current?.focus();
    }, 0);
    return () => {
      clearTimeout(id);
      trigger?.focus?.();
    };
  }, [open]);

  // Body scroll lock when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // The on-screen keyboard can shrink the visual viewport without changing dvh.
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const phone = window.matchMedia("(max-width: 639px)").matches;
      overlay.style.top = phone ? `${viewport.offsetTop}px` : "";
      overlay.style.height = phone ? `${viewport.height}px` : "";
      overlay.style.bottom = phone ? "auto" : "";
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Filter once per query
  const { filtered, flatItems, idxByHref } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredGroups = q
      ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            const text = `${it.label} ${it.keywords || ""} ${it.href}`.toLowerCase();
            return text.includes(q);
          }),
        }))
        .filter((g) => g.items.length > 0)
      : groups;
    const flat = filteredGroups.flatMap((g) => g.items);
    const idx = new Map<string, number>();
    flat.forEach((it, i) => idx.set(it.href, i));
    return { filtered: filteredGroups, flatItems: flat, idxByHref: idx };
  }, [groups, query]);

  // Stable refs for keyboard handler — avoid re-registering on every render.
  // Per React 19: ref writes must happen in effect, not during render.
  const stateRef = useRef({ activeIdx, flatItems, open });
  useEffect(() => {
    stateRef.current = { activeIdx, flatItems, open };
  });

  // Reset activeIdx when filtered set changes (deferred to satisfy React 19 lint)
  useEffect(() => {
    const id = setTimeout(() => setActiveIdx(0), 0);
    return () => clearTimeout(id);
  }, [query]);

  // Keyboard nav — register ONCE for the lifetime of open=true
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const { activeIdx: a, flatItems: items, open: isOpen } = stateRef.current;
      const root = dialogRef.current;
      if (!isOpen || e.defaultPrevented || e.isComposing || e.keyCode === 229 || !root ||
        !(e.target instanceof Node) || !root.contains(e.target)) return;
      // The combobox owns result selection. Buttons and links retain their
      // native Enter activation, including Close, Clear and focused results.
      if ((e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") &&
        e.target !== inputRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // Clamp to >= 0 so the no-results state (items.length - 1 === -1)
        // never produces a negative activeIdx / invalid aria-activedescendant.
        setActiveIdx((i) => Math.max(0, Math.min(i + 1, items.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = items[a];
        if (it) {
          router.push(it.href);
          onClose();
        }
      } else if (e.key === "Tab") {
        // Focus trap — wrap focus inside the dialog
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
          if (active === root || active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !root.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, router]);

  // Stable onMouseEnter: reads index from event target's data-idx attribute
  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-idx]");
    if (!target) return;
    const i = Number(target.dataset.idx);
    if (!Number.isNaN(i) && i !== stateRef.current.activeIdx) {
      setActiveIdx(i);
    }
  };

  if (typeof window === "undefined" || !open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-6 pt-[max(12px,env(safe-area-inset-top))] sm:pt-[8vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? "命令面板" : "Command palette"}
    >
      {/* Backdrop — solid color, NO blur (Windows perf) */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full min-w-0 max-w-2xl max-h-[min(100%,calc(100dvh-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] sm:max-h-[80vh] flex flex-col bg-bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/60 shrink-0">
          <Search size={16} className="text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isZh ? "搜索页面..." : "Search pages..."}
            aria-label={isZh ? "搜索页面" : "Search pages"}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIdx < flatItems.length ? `${baseId}-opt-${activeIdx}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="text-text-secondary hover:text-text-primary p-1 rounded cursor-pointer inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label={isZh ? "清除搜索" : "Clear search"}
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[12px] sm:text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary border border-border px-1.5 py-0.5 rounded hover:bg-bg-hover cursor-pointer inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
            aria-label={isZh ? "关闭 (Esc)" : "Close (Esc)"}
          >
            <X size={18} aria-hidden="true" className="sm:hidden" />
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>

        {/* Screen-reader result count — visual count lives in the footer */}
        <span className="sr-only" aria-live="polite">
          {flatItems.length} {isZh ? "个页面" : "pages"}
        </span>

        {/* Results scroll area */}
        <div id={listboxId} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" onMouseEnter={handleEnter}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-text-secondary">
                {isZh ? "没有匹配 " : "No matches for "}
                <span className="font-mono text-text-primary">&quot;{query}&quot;</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3" onMouseOver={handleEnter} role="presentation">
              {filtered.map((group, gi) => (
                <section key={group.title} role="group" aria-labelledby={`${baseId}-grp-${gi}`}>
                  <div className="px-2 py-1 mb-1 flex items-center gap-2" role="presentation">
                    <span className="w-1 h-1 rounded-full" style={{ background: group.color }} />
                    <p id={`${baseId}-grp-${gi}`} className="text-[9px] font-mono uppercase tracking-[0.25em]" style={{ color: group.color }}>
                      {group.title}
                    </p>
                    {group.eyebrow && (
                      <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-text-secondary/40">/ {group.eyebrow}</p>
                    )}
                  </div>
                  <div className="space-y-0.5" role="presentation">
                    {group.items.map((it) => {
                      const Icon = it.icon;
                      const globalIdx = idxByHref.get(it.href) ?? 0;
                      const isActive = globalIdx === activeIdx;
                      const isCurrentPage = pathname === it.href;
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={onClose}
                          data-idx={globalIdx}
                          id={`${baseId}-opt-${globalIdx}`}
                          role="option"
                          aria-selected={isActive}
                          className={`flex min-h-11 sm:min-h-0 items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer ${
                            isActive
                              ? "bg-accent/15 text-accent"
                              : isCurrentPage
                              ? "bg-accent/8 text-accent"
                              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                          }`}
                        >
                          {Icon && <Icon size={14} className="shrink-0" />}
                          <span className="flex-1 truncate">{it.label}</span>
                          {isCurrentPage && (
                            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-accent/70">{isZh ? "当前" : "current"}</span>
                          )}
                          {isActive && !isCurrentPage && (
                            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">↵</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/60 px-4 py-2 flex items-center justify-between text-[12px] sm:text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 shrink-0">
          <span className="sm:hidden normal-case tracking-normal">{isZh ? "点击页面前往" : "Tap a page to open"}</span>
          <span className="hidden sm:flex items-center gap-3">
            <span><kbd className="px-1 border border-border rounded">↑</kbd> <kbd className="px-1 border border-border rounded">↓</kbd> {isZh ? "切换" : "navigate"}</span>
            <span><kbd className="px-1 border border-border rounded">↵</kbd> {isZh ? "进入" : "open"}</span>
          </span>
          <span className="tabular-nums">{flatItems.length} {isZh ? "个页面" : "pages"}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
