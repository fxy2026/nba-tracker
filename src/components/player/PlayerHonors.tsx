"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { PlayerAccolades } from "@/lib/playerAccolades";

type Tier = "gold" | "silver" | "plain";

interface HonorChip {
  key: string;
  zh: string;
  en: string;
  /** Prestige sort order — lower renders first (championships/MVP at the top). */
  rank: number;
  tier: Tier;
  count: number;
  seasons: string[];
}

const ORDINAL_ZH = ["", "一", "二", "三"];
const ORDINAL_EN = ["", "1st", "2nd", "3rd"];

// The ~20 common stats.nba.com playerawards descriptions, keyed lowercase.
// Anything not listed here renders the upstream English description verbatim
// in both locales — never invent a translation for an unknown award.
const AWARD_META: Record<string, { zh: string; en: string; rank: number; tier: Tier }> = {
  "nba champion": { zh: "NBA 总冠军", en: "NBA Champion", rank: 10, tier: "gold" },
  "nba most valuable player": { zh: "常规赛 MVP", en: "MVP", rank: 20, tier: "gold" },
  "nba finals most valuable player": { zh: "总决赛 MVP (FMVP)", en: "Finals MVP", rank: 30, tier: "gold" },
  "hall of fame inductee": { zh: "名人堂成员", en: "Hall of Fame", rank: 40, tier: "gold" },
  "nba defensive player of the year": { zh: "最佳防守球员 (DPOY)", en: "Defensive Player of the Year", rank: 200, tier: "silver" },
  "nba rookie of the year": { zh: "最佳新秀 (ROY)", en: "Rookie of the Year", rank: 210, tier: "silver" },
  "nba all-star": { zh: "全明星", en: "All-Star", rank: 400, tier: "silver" },
  "nba all-star most valuable player": { zh: "全明星 MVP", en: "All-Star MVP", rank: 410, tier: "silver" },
  "nba scoring champion": { zh: "得分王", en: "Scoring Champion", rank: 420, tier: "silver" },
  "nba sixth man of the year": { zh: "最佳第六人", en: "Sixth Man of the Year", rank: 430, tier: "silver" },
  "nba most improved player": { zh: "进步最快球员 (MIP)", en: "Most Improved Player", rank: 440, tier: "silver" },
  "nba clutch player of the year": { zh: "最佳关键球员", en: "Clutch Player of the Year", rank: 450, tier: "silver" },
  "nba in-season tournament most valuable player": { zh: "季中锦标赛 MVP", en: "NBA Cup MVP", rank: 460, tier: "silver" },
  "olympic gold medal": { zh: "奥运金牌", en: "Olympic Gold Medal", rank: 600, tier: "gold" },
  "olympic silver medal": { zh: "奥运银牌", en: "Olympic Silver Medal", rank: 610, tier: "plain" },
  "olympic bronze medal": { zh: "奥运铜牌", en: "Olympic Bronze Medal", rank: 620, tier: "plain" },
  "nba player of the month": { zh: "月最佳球员", en: "Player of the Month", rank: 900, tier: "plain" },
  "nba rookie of the month": { zh: "月最佳新秀", en: "Rookie of the Month", rank: 910, tier: "plain" },
  "nba player of the week": { zh: "周最佳球员", en: "Player of the Week", rank: 920, tier: "plain" },
};

function classify(desc: string, teamNum: number | null): Omit<HonorChip, "count" | "seasons"> {
  const lower = desc.toLowerCase();
  // Team selections carry the 1/2/3 in ALL_NBA_TEAM_NUMBER, not the description
  if (lower.includes("all-nba")) {
    if (teamNum) return { key: `all-nba-${teamNum}`, zh: `最佳阵容${ORDINAL_ZH[teamNum]}阵`, en: `All-NBA ${ORDINAL_EN[teamNum]} Team`, rank: 90 + teamNum * 10, tier: teamNum === 1 ? "gold" : "silver" };
    return { key: "all-nba", zh: "最佳阵容", en: "All-NBA Team", rank: 130, tier: "silver" };
  }
  if (lower.includes("all-defensive")) {
    if (teamNum) return { key: `all-defensive-${teamNum}`, zh: `最佳防守阵容${ORDINAL_ZH[teamNum]}阵`, en: `All-Defensive ${ORDINAL_EN[teamNum]} Team`, rank: 290 + teamNum * 10, tier: "silver" };
    return { key: "all-defensive", zh: "最佳防守阵容", en: "All-Defensive Team", rank: 330, tier: "silver" };
  }
  if (lower.includes("all-rookie")) {
    if (teamNum) return { key: `all-rookie-${teamNum}`, zh: `最佳新秀阵容${ORDINAL_ZH[teamNum]}阵`, en: `All-Rookie ${ORDINAL_EN[teamNum]} Team`, rank: 490 + teamNum * 10, tier: "plain" };
    return { key: "all-rookie", zh: "最佳新秀阵容", en: "All-Rookie Team", rank: 530, tier: "plain" };
  }
  const meta = AWARD_META[lower];
  if (meta) return { key: lower, ...meta };
  // Unmapped award — verbatim in both locales; weekly/monthly ones sort last
  const recurring = lower.includes("week") || lower.includes("month");
  return { key: lower, zh: desc, en: desc, rank: recurring ? 930 : 800, tier: "plain" };
}

/**
 * Header-driven parse of a stats.nba.com playerawards payload (same defensive
 * convention as parseUpstreamBoards): scan headers by name so column order
 * doesn't matter, return null on any unexpected shape so the wall hides.
 */
function parseHonors(data: unknown): HonorChip[] | null {
  const d = data as {
    resultSets?: { headers?: unknown[]; rowSet?: unknown[][] }[];
    resultSet?: { headers?: unknown[]; rowSet?: unknown[][] };
  } | null;
  const rs = d?.resultSets?.[0] ?? d?.resultSet;
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return null;

  let descIdx = -1;
  let teamNumIdx = -1;
  let seasonIdx = -1;
  rs.headers.forEach((h, i) => {
    if (typeof h !== "string") return;
    const u = h.toUpperCase();
    if (descIdx === -1 && u.includes("DESCRIPTION")) descIdx = i;
    if (teamNumIdx === -1 && u.includes("TEAM_NUMBER")) teamNumIdx = i;
    if (u === "SEASON") seasonIdx = i;
    else if (seasonIdx === -1 && u.includes("SEASON")) seasonIdx = i;
  });
  if (descIdx === -1) return null;

  const groups = new Map<string, HonorChip>();
  for (const row of rs.rowSet) {
    if (!Array.isArray(row)) continue;
    const desc = typeof row[descIdx] === "string" ? (row[descIdx] as string).trim() : "";
    if (!desc) continue;
    // ALL_NBA_TEAM_NUMBER arrives as "1"/"2"/"3", null, or "(null)"
    const rawNum = teamNumIdx >= 0 ? Number(row[teamNumIdx]) : NaN;
    const teamNum = Number.isInteger(rawNum) && rawNum >= 1 && rawNum <= 3 ? rawNum : null;
    const season = seasonIdx >= 0 && typeof row[seasonIdx] === "string" ? (row[seasonIdx] as string).trim() : "";

    const c = classify(desc, teamNum);
    const existing = groups.get(c.key);
    if (existing) {
      existing.count += 1;
      if (season) existing.seasons.push(season);
    } else {
      groups.set(c.key, { ...c, count: 1, seasons: season ? [season] : [] });
    }
  }
  if (groups.size === 0) return null;

  return [...groups.values()]
    .map((g) => ({ ...g, seasons: [...new Set(g.seasons)].sort() }))
    .sort((a, b) => a.rank - b.rank || b.count - a.count || a.en.localeCompare(b.en));
}

// stats.nba.com blackholes the playerawards endpoint for datacenter IPs, so
// in production the live fetch usually fails — the hand-curated counts in
// PLAYER_ACCOLADES keep the wall alive for the ~50 star players people visit.
// No per-season tooltips in this mode (counts only).
function staticHonors(a: PlayerAccolades | null): HonorChip[] | null {
  if (!a) return null;
  const chips: HonorChip[] = [];
  const push = (count: number | undefined, key: string, zh: string, en: string, rank: number, tier: Tier) => {
    if (count && count > 0) chips.push({ key, zh, en, rank, tier, count, seasons: [] });
  };
  push(a.championships, "nba champion", "NBA 总冠军", "NBA Champion", 10, "gold");
  push(a.mvps, "nba most valuable player", "常规赛 MVP", "MVP", 20, "gold");
  push(a.finalsMvps, "nba finals most valuable player", "总决赛 MVP (FMVP)", "Finals MVP", 30, "gold");
  push(a.allNba, "all-nba", "最佳阵容", "All-NBA Team", 130, "silver");
  push(a.dpoy, "nba defensive player of the year", "最佳防守球员 (DPOY)", "Defensive Player of the Year", 200, "silver");
  push(a.allStars, "nba all-star", "全明星", "All-Star", 400, "silver");
  push(a.statTitles, "stat-titles", "数据王", "Stat Titles", 425, "silver");
  if (chips.length === 0) return null;
  return chips.sort((x, y) => x.rank - y.rank);
}

const TIER_CLASS: Record<Tier, string> = {
  gold: "border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]",
  silver: "border-[#C0C0C0]/40 bg-[#C0C0C0]/10 text-[#C0C0C0]",
  plain: "border-border bg-bg-card/60 text-text-secondary",
};

export default function PlayerHonors({ playerId, accolades }: { playerId: number; accolades: PlayerAccolades | null }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  // Render the curated counts immediately so the wall never blocks on the
  // (production-blackholed) playerawards fetch; upgrade to the live,
  // per-season-tooltip version only if that fetch actually lands.
  const [honors, setHonors] = useState<HonorChip[] | null>(() => staticHonors(accolades));

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const qs = new URLSearchParams({ endpoint: "playerawards", PlayerID: String(playerId) });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) return;
        const live = parseHonors(await res.json());
        if (live && !controller.signal.aborted) setHonors(live);
      } catch {
        // keep the static fallback already on screen
      }
    })();
    return () => controller.abort();
  }, [playerId]);

  // No curated counts and no live data → the honor wall simply doesn't exist
  if (!honors || honors.length === 0) return null;

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
      </div>
      <div className="flex flex-wrap gap-2">
        {honors.map((h) => (
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
