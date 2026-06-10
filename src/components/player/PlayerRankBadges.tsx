"use client";

import { useEffect, useState } from "react";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";

const CATS = [
  { key: "PTS", zh: "得分", en: "scoring", unitZh: "分", unitEn: "PPG" },
  { key: "REB", zh: "篮板", en: "rebounding", unitZh: "篮板", unitEn: "RPG" },
  { key: "AST", zh: "助攻", en: "assists", unitZh: "助攻", unitEn: "APG" },
  { key: "STL", zh: "抢断", en: "steals", unitZh: "抢断", unitEn: "SPG" },
  { key: "BLK", zh: "盖帽", en: "blocks", unitZh: "盖帽", unitEn: "BPG" },
] as const;

type CatKey = (typeof CATS)[number]["key"];

interface RankEntry {
  key: CatKey;
  rank: number;
  value: number;
}

const TOP_RANK_CUTOFF = 25;

// Header-driven parse of one leagueleaders payload (sorted by PTS, but every
// row carries all five per-game columns). Returns [] on any unexpected shape
// or when the player isn't among the qualified leaders — caller hides itself.
function computeRanks(data: unknown, playerId: number): RankEntry[] {
  const d = data as {
    resultSet?: { headers?: unknown[]; rowSet?: unknown[][] };
    resultSets?: { headers?: unknown[]; rowSet?: unknown[][] }[];
  } | null;
  const rs = d?.resultSet ?? d?.resultSets?.[0];
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return [];

  const idx = new Map<string, number>();
  rs.headers.forEach((h, i) => {
    if (typeof h === "string") idx.set(h, i);
  });
  const idIdx = idx.get("PLAYER_ID");
  if (idIdx == null || CATS.some((c) => !idx.has(c.key))) return [];

  const rows = rs.rowSet.filter((r): r is unknown[] => Array.isArray(r));
  const mine = rows.find((r) => Number(r[idIdx]) === playerId);
  if (!mine) return [];

  // Strict number check — Number(null) is 0, which would fabricate a 0.0 stat.
  const num = (raw: unknown): number | null =>
    typeof raw === "number" && Number.isFinite(raw) ? raw : null;

  const out: RankEntry[] = [];
  for (const cat of CATS) {
    const ci = idx.get(cat.key)!;
    const v = num(mine[ci]);
    if (v == null) continue;
    // Competition ranking within the payload: 1 + players strictly ahead.
    let rank = 1;
    for (const r of rows) {
      const other = num(r[ci]);
      if (other != null && other > v) rank++;
    }
    if (rank <= TOP_RANK_CUTOFF) out.push({ key: cat.key, rank, value: v });
  }
  return out;
}

export default function PlayerRankBadges({ playerId }: { playerId: number }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [ranks, setRanks] = useState<RankEntry[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: CURRENT_SEASON,
          SeasonType: "Regular Season",
          StatCategory: "PTS",
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const entries = computeRanks(data, playerId);
        if (!controller.signal.aborted) setRanks(entries);
      } catch {
        /* silent hide — retired/low-minutes players or upstream failure */
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [playerId]);

  if (!ranks?.length) return null;

  return (
    <div className="glass-tile px-4 py-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-text-secondary font-mono uppercase tracking-[0.15em] mr-1 whitespace-nowrap">
        {isZh ? `${CURRENT_SEASON} 联盟排名` : `${CURRENT_SEASON} League Ranks`}
      </span>
      {ranks.map((r) => {
        const cat = CATS.find((c) => c.key === r.key)!;
        const tierCls =
          r.rank <= 3
            ? "bg-accent-amber/15 text-accent-amber ring-1 ring-accent-amber/30"
            : r.rank <= 10
              ? "bg-accent/10 text-accent ring-1 ring-accent/25"
              : "bg-bg-secondary/60 text-text-secondary ring-1 ring-border";
        return (
          <span
            key={r.key}
            title={
              isZh
                ? `${CURRENT_SEASON} 场均 ${r.value.toFixed(1)} ${cat.unitZh}`
                : `${r.value.toFixed(1)} ${cat.unitEn} (${CURRENT_SEASON})`
            }
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums cursor-default ${tierCls}`}
          >
            {isZh ? `联盟${cat.zh}第${r.rank}` : `#${r.rank} in ${cat.en}`}
          </span>
        );
      })}
    </div>
  );
}
