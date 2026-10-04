"use client";

import { Newspaper } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Shared by the visibility boundary, chunk fallback and mounted data loaders.
// Preserve the existing loading geometry without mounting the request owners.
export function PlayerSalaryLoading() {
  return (
    <div className="glass-tile overflow-hidden" aria-hidden="true">
      <div className="px-4 py-3 border-b border-border">
        <div className="skeleton-shimmer h-2.5 w-16 rounded" />
        <div className="skeleton-shimmer h-3.5 w-28 rounded mt-2" />
      </div>
      <div className="p-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-8 rounded" />
        ))}
      </div>
    </div>
  );
}

export function PlayerNewsLoading() {
  const { t } = useLocale();
  return (
    <div className="glass-tile p-4">
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ News</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <Newspaper size={14} className="text-accent-amber" />
          {t.playerNews.title}
        </h3>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-bg-secondary/60 rounded-lg skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}
