"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { PlayerAccolades } from "@/lib/playerAccolades";

import { parseHonors, staticHonors, honorSourceLabel, type HonorChip, type Tier } from "@/lib/player-honors";

const TIER_CLASS: Record<Tier, string> = {
  gold: "border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]",
  silver: "border-[#C0C0C0]/40 bg-[#C0C0C0]/10 text-[#C0C0C0]",
  plain: "border-border bg-bg-card/60 text-text-secondary",
};

export default function PlayerHonors({ playerId, accolades, showLoading = false, archived = false }: { playerId: number; accolades: PlayerAccolades | null; showLoading?: boolean; archived?: boolean }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [upstream, setUpstream] = useState<{ playerId: number; honors: HonorChip[] | null; retrievedAt: string | null; status: "success" | "empty" | "unavailable" } | null>(null);
  // A navigation immediately selects this player's fallback, even before the
  // previous effect cleans up. Neither old counts nor source labels can leak.
  const current = upstream?.playerId === playerId ? upstream : null;
  const honors = current?.honors?.length ? current.honors : staticHonors(accolades);

  useEffect(() => {
    if (archived) return;
    const controller = new AbortController();
    (async () => {
      try {
        const qs = new URLSearchParams({ endpoint: "playerawards", PlayerID: String(playerId) });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Awards unavailable");
        const live = parseHonors(await res.json(), playerId);
        if (live === null) throw new Error("Invalid awards response");
        if (!controller.signal.aborted) setUpstream({ playerId, honors: live, retrievedAt: new Date().toISOString(), status: live.length ? "success" : "empty" });
      } catch {
        if (!controller.signal.aborted) setUpstream({ playerId, honors: null, retrievedAt: null, status: "unavailable" });
        // Keep this player's curated fallback when upstream is unavailable.
      }
    })();
    return () => controller.abort();
  }, [playerId, archived]);

  // No initial data stays unobtrusive; settled empty/error responses explain
  // availability without asserting that the player has no awards.
  if (!honors?.length && !current) return showLoading ? <p role="status" className="sm:hidden rounded-xl bg-bg-secondary p-5 text-sm text-text-secondary">{isZh ? (archived ? "荣誉记录暂未收录，不代表没有荣誉。" : "正在加载荣誉记录…") : (archived ? "Honors are not yet recorded; this does not mean zero awards." : "Loading award records…")}</p> : null;

  return (
    <section className="mt-8 sm:mt-10">
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">
          / {isZh ? "荣誉" : "Honors"}
        </p>
        <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <Trophy size={16} className="text-accent-amber" />
          {isZh ? "荣誉墙" : "Honor Wall"}
        </h2>
        <p className="mt-2 text-[10px] text-text-secondary">{honors?.length ? honorSourceLabel(locale, current?.status === "success" ? current.retrievedAt : null) : ""}</p>
      </div>
      {current?.status === "empty" && <p className="mb-3 text-xs text-text-secondary">{isZh ? "NBA 响应未提供荣誉记录，不代表没有荣誉；已有历史计数保留。" : "The NBA response supplied no award records; this does not establish zero honors. Any historical counts are retained."}</p>}
      {current?.status === "unavailable" && <p className="mb-3 text-xs text-text-secondary">{isZh ? "荣誉接口暂不可用；已有历史计数保留。" : "Awards source unavailable; any historical counts are retained."}</p>}
      <div className="flex flex-wrap gap-2">
        {honors?.map((h) => (
          <span
            key={h.key}
            title={h.seasons.length > 0 ? h.seasons.join(" · ") : undefined}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border backdrop-blur-md cursor-default ${TIER_CLASS[h.tier]}`}
          >
            {isZh ? h.zh : h.en}
            {h.count > 1 && (
              <span className="font-mono tabular-nums text-[10px] opacity-80">×{h.count}</span>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}
