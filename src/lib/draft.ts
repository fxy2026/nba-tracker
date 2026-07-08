export interface DraftPick {
  overall: number;
  pick: number;
  round: number;
  playerName: string;
  position: string;
  college: string;
  teamAbbr: string;
  teamId: string;
  headshot: string;
  espnLink: string;
}

// ESPN uses 6 abbreviations that diverge from our TEAM_META tricodes; normalize
// them so draft picks resolve NBA logos and link to /team/[tricode].
const ESPN_ABBR_TO_TRICODE: Record<string, string> = {
  GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS",
};

export function espnAbbrToTricode(abbr: string): string {
  return ESPN_ABBR_TO_TRICODE[abbr] || abbr;
}

interface EspnDraftJson {
  positions?: { id?: string; abbreviation?: string }[];
  teams?: { id?: string; abbreviation?: string }[];
  picks?: {
    overall?: number;
    pick?: number;
    round?: number;
    teamId?: string;
    athlete?: {
      displayName?: string;
      position?: { id?: string };
      team?: { location?: string };
      headshot?: { href?: string };
      link?: string;
    };
  }[];
}

// Maps the raw ESPN draft feed to a flat DraftPick[]. Best-effort: every field
// degrades to "" / 0 rather than throwing, so a traded pick or an athlete
// missing a headshot still projects.
export function projectDraft(espnJson: unknown): DraftPick[] {
  const json = (espnJson ?? {}) as EspnDraftJson;
  const picks = Array.isArray(json.picks) ? json.picks : [];
  const teams = Array.isArray(json.teams) ? json.teams : [];
  const positions = Array.isArray(json.positions) ? json.positions : [];

  const abbrByTeamId = new Map<string, string>();
  for (const t of teams) {
    if (t && typeof t.id === "string") abbrByTeamId.set(t.id, t.abbreviation || "");
  }
  const abbrByPosId = new Map<string, string>();
  for (const p of positions) {
    if (p && typeof p.id === "string") abbrByPosId.set(p.id, p.abbreviation || "");
  }

  const out: DraftPick[] = [];
  for (const p of picks) {
    if (!p || typeof p !== "object") continue;
    const a = p.athlete;
    const teamId = typeof p.teamId === "string" ? p.teamId : "";
    const posId = a?.position?.id;
    out.push({
      overall: typeof p.overall === "number" ? p.overall : 0,
      pick: typeof p.pick === "number" ? p.pick : 0,
      round: typeof p.round === "number" ? p.round : 0,
      playerName: a?.displayName || "",
      position: (posId && abbrByPosId.get(posId)) || "",
      college: a?.team?.location || "",
      teamAbbr: abbrByTeamId.get(teamId) || "",
      teamId,
      headshot: a?.headshot?.href || "",
      espnLink: a?.link || "",
    });
  }
  return out;
}
