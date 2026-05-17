"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, type LucideIcon } from "lucide-react";

export interface PaletteItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Keywords for search matching beyond label */
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

export default function CommandPalette({ open, onClose, groups }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = typeof window !== "undefined";

  // Reset query and focus when transitioning closed → open
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = !prevOpenRef.current && open;
    prevOpenRef.current = open;
    if (justOpened) {
      // Defer state updates to next tick to avoid sync-setState-in-effect lint
      setTimeout(() => {
        setQuery("");
        setActiveIdx(0);
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Flatten + filter items based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (!q) return true;
          const text = `${it.label} ${it.keywords || ""} ${it.href}`.toLowerCase();
          return text.includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const flatItems = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  // Reset activeIdx when filter changes (defer to avoid sync-setState-in-effect)
  useEffect(() => {
    const id = setTimeout(() => setActiveIdx(0), 0);
    return () => clearTimeout(id);
  }, [query]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = flatItems[activeIdx];
        if (it) {
          router.push(it.href);
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flatItems, activeIdx, onClose, router]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 pt-[8vh] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] flex flex-col glass-tile overflow-hidden shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0">
          <Search size={16} className="text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to anywhere · search 30+ pages..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-secondary hover:text-text-primary p-1 rounded cursor-pointer"
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary border border-border px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors cursor-pointer"
            aria-label="Close (Esc)"
          >
            ESC
          </button>
        </div>

        {/* Results scroll area */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-text-secondary">
                No matches for <span className="font-mono text-text-primary">&quot;{query}&quot;</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((group) => (
                <section key={group.title}>
                  <div className="px-2 py-1 mb-1 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full" style={{ background: group.color }} />
                    <p className="text-[9px] font-mono uppercase tracking-[0.25em]" style={{ color: group.color }}>
                      {group.title}
                    </p>
                    {group.eyebrow && (
                      <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-text-secondary/40">/ {group.eyebrow}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((it) => {
                      const Icon = it.icon;
                      const globalIdx = flatItems.indexOf(it);
                      const isActive = globalIdx === activeIdx;
                      const isCurrentPage = pathname === it.href;
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={onClose}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                            isActive
                              ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                              : isCurrentPage
                              ? "bg-accent/8 text-accent"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {Icon && <Icon size={14} className="shrink-0" />}
                          <span className="flex-1 truncate">{it.label}</span>
                          {isCurrentPage && (
                            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-accent/70">current</span>
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
        <div className="border-t border-border/60 px-4 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 shrink-0">
          <span className="flex items-center gap-3">
            <span><kbd className="px-1 border border-border rounded">↑</kbd> <kbd className="px-1 border border-border rounded">↓</kbd> navigate</span>
            <span><kbd className="px-1 border border-border rounded">↵</kbd> open</span>
          </span>
          <span className="tabular-nums">{flatItems.length} pages</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
