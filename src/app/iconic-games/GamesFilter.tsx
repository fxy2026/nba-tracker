"use client";

import { useState } from "react";
import { GAME_TAG_LABEL, type GameTag } from "@/lib/iconicGames";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  // The list of tag IDs that actually appear in the dataset — passed in so
  // we don't render filter chips for tags nobody on the page has.
  availableTags: GameTag[];
  // The list of decade keys that exist in the dataset (e.g. "1960s", "2010s").
  availableDecades: string[];
}

// Pure client component — toggles visibility of game cards rendered by the
// server. Combines tag and decade filters with AND semantics: a card must
// have at least one active tag AND match at least one active decade.
export default function GamesFilter({ availableTags, availableDecades }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [activeTags, setActiveTags] = useState<Set<GameTag>>(new Set());
  const [activeDecades, setActiveDecades] = useState<Set<string>>(new Set());

  const toggleTag = (tag: GameTag) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const toggleDecade = (d: string) => {
    setActiveDecades((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const reset = () => {
    setActiveTags(new Set());
    setActiveDecades(new Set());
  };

  const hasAny = activeTags.size > 0 || activeDecades.size > 0;

  // Build a CSS rule that:
  // 1. hides all cards by default when any filter is on
  // 2. shows cards matching at least one selected tag (if tags are active)
  //    OR at least one selected decade (if decades are active)
  // Tags and decades combine with OR within each axis, AND across axes.
  const buildCss = () => {
    if (!hasAny) return "";
    const parts: string[] = ["[data-game-card] { display: none; }"];
    const tagSel = Array.from(activeTags).map((t) => `[data-tags*="${t}"]`);
    const decadeSel = Array.from(activeDecades).map((d) => `[data-decade="${d}"]`);
    if (tagSel.length > 0 && decadeSel.length > 0) {
      // both filters active — intersection
      for (const t of tagSel) {
        for (const d of decadeSel) {
          parts.push(`[data-game-card]${t}${d} { display: block; }`);
        }
      }
    } else if (tagSel.length > 0) {
      for (const t of tagSel) parts.push(`[data-game-card]${t} { display: block; }`);
    } else {
      for (const d of decadeSel) parts.push(`[data-game-card]${d} { display: block; }`);
    }
    return parts.join("\n");
  };

  return (
    <>
      {/* Decade chips */}
      {availableDecades.length > 1 && (
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "年代" : "Decade"}
          </span>
          {availableDecades.map((d) => {
            const isActive = activeDecades.has(d);
            return (
              <button
                key={d}
                onClick={() => toggleDecade(d)}
                aria-pressed={isActive}
                className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-colors cursor-pointer ${
                  isActive
                    ? "bg-accent/20 text-accent border-accent/50"
                    : "bg-bg-secondary/40 text-text-secondary border-border hover:border-accent/40"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      {/* Tag chips */}
      <div className="flex items-center flex-wrap gap-1.5 mb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
          {isZh ? "标签" : "Tag"}
        </span>
        {availableTags.map((tag) => {
          const label = GAME_TAG_LABEL[tag];
          const isActive = activeTags.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={isActive}
              className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-colors cursor-pointer ${
                isActive
                  ? "bg-accent-amber/20 text-accent-amber border-accent-amber/50"
                  : "bg-bg-secondary/40 text-text-secondary border-border hover:border-accent/40"
              }`}
            >
              {isZh ? label.zh : label.en}
            </button>
          );
        })}
        {hasAny && (
          <button
            onClick={reset}
            className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 text-text-secondary hover:text-accent cursor-pointer"
          >
            {isZh ? "清除" : "Clear"}
          </button>
        )}
      </div>

      {hasAny && <style>{buildCss()}</style>}
    </>
  );
}
