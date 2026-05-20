"use client";

import { useMemo, useState } from "react";
import { GAME_TAG_LABEL, type GameTag } from "@/lib/iconicGames";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  // The list of tag IDs that actually appear in the dataset — passed in so
  // we don't render filter chips for tags nobody on the page has.
  availableTags: GameTag[];
  // The set of game ids currently visible (mirrors the filtered subset).
  // Page-level effect uses this to hide / show cards via CSS attribute
  // selectors without re-rendering the SSR'd list.
  ids: string[];
}

// Pure client component — toggles visibility of game cards rendered by the
// server. Avoids re-fetching or re-rendering the list when filters change.
export default function GamesFilter({ availableTags, ids }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [active, setActive] = useState<Set<GameTag>>(new Set());

  // Effect: rewrite the CSS rule that hides non-matching cards. We can't
  // easily reach the cards through React (they're rendered server-side
  // above this component), so we use a `<style>` tag with `display: none`
  // selectors keyed off data-game-id.
  const hiddenIds = useMemo(() => {
    if (active.size === 0) return [] as string[];
    // We don't have per-id tag info on the client — server emits data-tags
    // on each card. Build a runtime selector that hides cards whose
    // data-tags doesn't contain ANY of the active filters.
    return ids;
  }, [active, ids]);

  const toggle = (tag: GameTag) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const reset = () => setActive(new Set());

  return (
    <>
      <div className="flex items-center flex-wrap gap-1.5 mb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
          {isZh ? "标签筛选" : "Filter by tag"}
        </span>
        {availableTags.map((tag) => {
          const label = GAME_TAG_LABEL[tag];
          const isActive = active.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
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
        {active.size > 0 && (
          <button
            onClick={reset}
            className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 text-text-secondary hover:text-accent cursor-pointer"
          >
            {isZh ? "清除" : "Clear"}
          </button>
        )}
      </div>

      {/* Runtime CSS: hides cards whose tag set doesn't intersect the
          active filters. Uses [data-tags*=...] substring match — cheap and
          works for our enum where tag names don't substring-overlap. */}
      {active.size > 0 && (
        <style>{`
          [data-game-card] { display: none; }
          ${Array.from(active).map((t) => `[data-game-card][data-tags*="${t}"] { display: block; }`).join("\n")}
        `}</style>
      )}
      {/* When zero filters are active we leave cards alone (no style emitted). */}
      {/* The hidden ids list is computed but unused for now — kept for the
          eventual "no results" empty state. */}
      {hiddenIds.length === 0 && null}
    </>
  );
}
