"use client";

import { useState } from "react";
import { PLAY_STYLE_LABEL, type PlayStyle } from "@/lib/iconicSeasons";
import { useLocale } from "@/components/LocaleProvider";

type Trophy = "mvp" | "champion" | "finalsMvp" | "dpoy" | "scoringTitle";
const TROPHY_LABEL: Record<Trophy, { en: string; zh: string }> = {
  mvp: { en: "MVP", zh: "MVP" },
  champion: { en: "🏆 Champion", zh: "🏆 冠军" },
  finalsMvp: { en: "Finals MVP", zh: "总决赛 MVP" },
  dpoy: { en: "DPOY", zh: "防守球员" },
  scoringTitle: { en: "Scoring Title", zh: "得分王" },
};

interface Props {
  availableDecades: string[];
  availableStyles: PlayStyle[];
  availableTrophies: Trophy[];
}

// Pure-CSS filter for /iconic-seasons cards. Three axes:
// - decade (60s … 20s) — uses data-decade attr
// - play-style — uses data-styles substring match (multi-tag)
// - trophy — uses data-trophies substring match (multi-flag)
// Within an axis: OR. Across axes: AND.
export default function SeasonsFilter({ availableDecades, availableStyles, availableTrophies }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [decades, setDecades] = useState<Set<string>>(new Set());
  const [styles, setStyles] = useState<Set<PlayStyle>>(new Set());
  const [trophies, setTrophies] = useState<Set<Trophy>>(new Set());

  const toggle = <T,>(set: Set<T>, update: (s: Set<T>) => void) => (value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  const reset = () => {
    setDecades(new Set());
    setStyles(new Set());
    setTrophies(new Set());
  };

  const hasAny = decades.size + styles.size + trophies.size > 0;

  // Build runtime CSS — each axis contributes a SELECTOR group; cards must
  // match at least one selector from each active axis.
  const buildCss = () => {
    if (!hasAny) return "";
    const decadeSel = Array.from(decades).map((d) => `[data-decade="${d}"]`);
    const styleSel = Array.from(styles).map((s) => `[data-styles*="${s}"]`);
    const trophySel = Array.from(trophies).map((t) => `[data-trophies*="${t}"]`);
    const axes = [decadeSel, styleSel, trophySel].filter((arr) => arr.length > 0);
    if (axes.length === 0) return "";
    // Cartesian product of selector groups → ensures AND across axes
    let combos: string[] = [""];
    for (const axis of axes) {
      const next: string[] = [];
      for (const prefix of combos) {
        for (const sel of axis) next.push(prefix + sel);
      }
      combos = next;
    }
    const parts: string[] = ["[data-season-card] { display: none; }"];
    for (const c of combos) parts.push(`[data-season-card]${c} { display: block; }`);
    return parts.join("\n");
  };

  return (
    <>
      {availableDecades.length > 1 && (
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "年代" : "Decade"}
          </span>
          {availableDecades.map((d) => {
            const isActive = decades.has(d);
            return (
              <button
                key={d}
                onClick={() => toggle(decades, setDecades)(d)}
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

      {availableTrophies.length > 1 && (
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "奖项" : "Trophy"}
          </span>
          {availableTrophies.map((tr) => {
            const isActive = trophies.has(tr);
            const label = TROPHY_LABEL[tr];
            return (
              <button
                key={tr}
                onClick={() => toggle(trophies, setTrophies)(tr)}
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
        </div>
      )}

      {availableStyles.length > 1 && (
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "风格" : "Style"}
          </span>
          {availableStyles.map((st) => {
            const isActive = styles.has(st);
            const label = PLAY_STYLE_LABEL[st];
            return (
              <button
                key={st}
                onClick={() => toggle(styles, setStyles)(st)}
                className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-colors cursor-pointer ${
                  isActive
                    ? "bg-success/20 text-success border-success/50"
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
      )}

      {hasAny && <style>{buildCss()}</style>}
    </>
  );
}
