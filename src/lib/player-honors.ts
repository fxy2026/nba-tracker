import type { PlayerAccolades } from "./playerAccolades";

export type Tier = "gold" | "silver" | "plain";

export interface HonorChip {
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
export function parseHonors(data: unknown, personId?: number): HonorChip[] | null {
  const d = data as {
    resultSets?: { headers?: unknown[]; rowSet?: unknown[][] }[];
    resultSet?: { headers?: unknown[]; rowSet?: unknown[][] };
  } | null;
  const rs = d?.resultSets?.[0] ?? d?.resultSet;
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return null;

  if (!rs.headers.every((h) => typeof h === "string") || new Set(rs.headers).size !== rs.headers.length) return null;
  const headers = rs.headers.map((h) => (h as string).toUpperCase());
  if (new Set(headers).size !== headers.length) return null;
  const descIdx = headers.indexOf("DESCRIPTION");
  const teamNumIdx = headers.indexOf("ALL_NBA_TEAM_NUMBER");
  const seasonIdx = headers.indexOf("SEASON");
  const personIdx = headers.indexOf("PERSON_ID");
  if (descIdx < 0 || seasonIdx < 0) return null;

  const groups = new Map<string, HonorChip>();
  for (const row of rs.rowSet) {
    if (!Array.isArray(row) || row.length !== headers.length) return null;
    if (personIdx >= 0 && (!Number.isSafeInteger(Number(row[personIdx])) || Number(row[personIdx]) <= 0 || (personId !== undefined && Number(row[personIdx]) !== personId))) return null;
    const desc = typeof row[descIdx] === "string" ? (row[descIdx] as string).trim() : "";
    if (!desc) return null;
    // ALL_NBA_TEAM_NUMBER arrives as "1"/"2"/"3", null, or "(null)"
    const value = teamNumIdx >= 0 ? row[teamNumIdx] : null;
    if (![null, "(null)", "", 0, "0", 1, "1", 2, "2", 3, "3"].includes(value as string | number | null)) return null;
    const rawNum = Number(value);
    const teamNum = Number.isInteger(rawNum) && rawNum >= 1 && rawNum <= 3 ? rawNum : null;
    const rawSeason = row[seasonIdx];
    if (rawSeason !== null && (typeof rawSeason !== "string" || !/^\d{4}(?:-\d{2})?$/.test(rawSeason.trim()))) return null;
    const season = typeof rawSeason === "string" ? rawSeason.trim() : "";

    const c = classify(desc, teamNum);
    const existing = groups.get(c.key);
    if (existing) {
      existing.count += 1;
      if (season) existing.seasons.push(season);
    } else {
      groups.set(c.key, { ...c, count: 1, seasons: season ? [season] : [] });
    }
  }
  if (groups.size === 0) return [];

  return [...groups.values()]
    .map((g) => ({ ...g, seasons: [...new Set(g.seasons)].sort() }))
    .sort((a, b) => a.rank - b.rank || b.count - a.count || a.en.localeCompare(b.en));
}

// Curated historical counts remain useful when the upstream awards endpoint
// is unavailable. The source declaration does not imply a fresh recount.
// No per-season tooltips in this mode (counts only).
export function staticHonors(a: PlayerAccolades | null): HonorChip[] | null {
  if (!a) return null;
  const chips: HonorChip[] = [];
  const push = (count: number | undefined, key: string, zh: string, en: string, rank: number, tier: Tier) => {
    if (typeof count === "number" && Number.isSafeInteger(count) && count > 0) chips.push({ key, zh, en, rank, tier, count, seasons: [] });
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


/** Dataset declaration in playerAccolades.ts; this is not a fresh recount. */
export function honorSourceLabel(locale: string, retrievedAt: string | null): string {
  if (!retrievedAt) return locale === "zh"
    ? "人工整理历史计数 · 截至 2025-26 赛季开始 · 数据集注明来源：NBA.com / Basketball-Reference"
    : "Curated historical counts · as of the start of 2025-26 · dataset credits: NBA.com / Basketball-Reference";
  const stamp = retrievedAt.slice(0, 16).replace("T", " ");
  return locale === "zh"
    ? `NBA 荣誉接口返回数据 · 获取于 ${stamp} UTC · 来源更新时间未注明`
    : `NBA awards response · retrieved ${stamp} UTC · source update time unspecified`;
}
