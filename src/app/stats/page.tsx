"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Users, Trophy, Crown } from "lucide-react";

const STATS_API = "/api/stats";
const CURRENT_SEASON = "2024-25";

// ========== Types ==========

interface LeaderRow {
  PLAYER_ID: number;
  RANK: number;
  PLAYER: string;
  TEAM: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  EFF: number;
  TOV: number;
}

interface TeamRow {
  TEAM_ID: number;
  TEAM_NAME: string;
  GP: number;
  W: number;
  L: number;
  W_PCT: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  PTS: number;
  PLUS_MINUS: number;
}

interface AwardRow {
  PERSON_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  TEAM: string;
  DESCRIPTION: string;
  ALL_NBA_TEAM_NUMBER: string | null;
  SEASON: string;
}

// ========== Stat Categories ==========

const PLAYER_CATS = [
  { key: "PTS", label: "Points" },
  { key: "REB", label: "Rebs" },
  { key: "AST", label: "Assists" },
  { key: "STL", label: "Steals" },
  { key: "BLK", label: "Blocks" },
  { key: "FG_PCT", label: "FG%" },
  { key: "FG3_PCT", label: "3P%" },
  { key: "EFF", label: "Effect" },
] as const;

const TEAM_SORT_KEYS = [
  { key: "PTS", label: "PPG" },
  { key: "REB", label: "RPG" },
  { key: "AST", label: "APG" },
  { key: "FG_PCT", label: "FG%" },
  { key: "FG3_PCT", label: "3P%" },
  { key: "PLUS_MINUS", label: "+/-" },
  { key: "W_PCT", label: "Win%" },
] as const;

const AWARD_TYPES = [
  { key: "MVP", label: "MVP", desc: "NBA Most Valuable Player" },
  { key: "FMVP", label: "FMVP", desc: "NBA Finals Most Valuable Player" },
  { key: "DPOY", label: "DPOY", desc: "NBA Defensive Player of the Year" },
  { key: "ROY", label: "ROY", desc: "NBA Rookie of the Year" },
  { key: "6MOY", label: "6MOY", desc: "NBA Sixth Man of the Year" },
  { key: "MIP", label: "MIP", desc: "NBA Most Improved Player" },
  { key: "ALL_NBA_1", label: "All-NBA 1st", desc: "All-NBA" },
  { key: "ALL_NBA_2", label: "All-NBA 2nd", desc: "All-NBA" },
  { key: "ALL_NBA_3", label: "All-NBA 3rd", desc: "All-NBA" },
] as const;

// Well-known player IDs for award lookups
const STAR_PLAYERS = [
  { id: 2544, name: "LeBron James" },
  { id: 201566, name: "Russell Westbrook" },
  { id: 201142, name: "Kevin Durant" },
  { id: 201939, name: "Stephen Curry" },
  { id: 203507, name: "Giannis Antetokounmpo" },
  { id: 203999, name: "Nikola Jokic" },
  { id: 1629029, name: "Luka Doncic" },
  { id: 1628369, name: "Jayson Tatum" },
  { id: 203954, name: "Joel Embiid" },
  { id: 1629630, name: "Ja Morant" },
  { id: 1630162, name: "Anthony Edwards" },
  { id: 1630595, name: "Chet Holmgren" },
  { id: 1630169, name: "Tyrese Haliburton" },
  { id: 203076, name: "Anthony Davis" },
  { id: 1628983, name: "Shai Gilgeous-Alexander" },
  { id: 1630596, name: "Paolo Banchero" },
  { id: 203081, name: "Damian Lillard" },
  { id: 1629627, name: "Zion Williamson" },
  { id: 203110, name: "Draymond Green" },
  { id: 101108, name: "Chris Paul" },
];

type Tab = "players" | "teams" | "awards";

async function fetchStats(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`${STATS_API}?${qs}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function parseResultSet(data: { resultSet?: { headers: string[]; rowSet: unknown[][] }; resultSets?: { headers: string[]; rowSet: unknown[][] }[] }) {
  const rs = data.resultSet || data.resultSets?.[0];
  if (!rs) return [];
  const headers = rs.headers;
  return rs.rowSet.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
    return obj;
  });
}

function headshotUrl(id: number) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
}

// ========== Main Component ==========

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("players");

  const tabs = [
    { key: "players" as Tab, label: "Player Leaders", icon: Users },
    { key: "teams" as Tab, label: "Team Rankings", icon: BarChart3 },
    { key: "awards" as Tab, label: "Awards", icon: Trophy },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-5 flex items-center gap-2">
        <Crown size={24} className="text-accent" />
        Stats & Rankings
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-bg-card rounded-xl p-1 border border-border w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "players" && <PlayerLeaders />}
      {tab === "teams" && <TeamRankings />}
      {tab === "awards" && <AwardsSection />}
    </div>
  );
}

// ========== Player Leaders ==========

function PlayerLeaders() {
  const [cat, setCat] = useState("PTS");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonType, setSeasonType] = useState("Regular+Season");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStats("leagueleaders", {
        LeagueID: "00",
        PerMode: "PerGame",
        Scope: "S",
        Season: CURRENT_SEASON,
        SeasonType: seasonType,
        StatCategory: cat,
      });
      setRows(parseResultSet(data) as unknown as LeaderRow[]);
    } catch { setRows([]); }
    setLoading(false);
  }, [cat, seasonType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {PLAYER_CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                cat === c.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <select
          value={seasonType}
          onChange={(e) => setSeasonType(e.target.value)}
          className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
        >
          <option value="Regular+Season">Regular Season</option>
          <option value="Playoffs">Playoffs</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-text-secondary py-20 text-sm">Loading...</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-3 w-8">#</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 font-bold text-accent">{PLAYER_CATS.find((c) => c.key === cat)?.label}</th>
                  <th className="text-center py-3 px-2">PTS</th>
                  <th className="text-center py-3 px-2">REB</th>
                  <th className="text-center py-3 px-2">AST</th>
                  <th className="text-center py-3 px-2">STL</th>
                  <th className="text-center py-3 px-2">BLK</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={r.PLAYER_ID} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i < 3 ? "bg-accent/5" : ""}`}>
                    <td className="py-2.5 px-3 text-text-secondary font-medium">{r.RANK}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={headshotUrl(r.PLAYER_ID)} alt="" className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.PLAYER}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-text-secondary">{r.TEAM}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.GP}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-accent">
                      {cat.includes("PCT") ? (r[cat as keyof LeaderRow] as number * 100).toFixed(1) + "%" : (r[cat as keyof LeaderRow] as number).toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.PTS.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.REB.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.AST.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.STL.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.BLK.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Team Rankings ==========

function TeamRankings() {
  const [sortKey, setSortKey] = useState("PTS");
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStats("leaguedashteamstats", {
        Season: CURRENT_SEASON,
        SeasonType: "Regular+Season",
        PerMode: "PerGame",
        MeasureType: "Base",
        LeagueID: "00",
      });
      const parsed = parseResultSet(data) as unknown as TeamRow[];
      setRows(parsed);
    } catch { setRows([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey as keyof TeamRow] as number;
    const vb = b[sortKey as keyof TeamRow] as number;
    return vb - va;
  });

  // Team tricode map for logos
  const teamIdToTricode: Record<number, string> = {
    1610612737: "ATL", 1610612738: "BOS", 1610612751: "BKN", 1610612766: "CHA",
    1610612741: "CHI", 1610612739: "CLE", 1610612742: "DAL", 1610612743: "DEN",
    1610612765: "DET", 1610612744: "GSW", 1610612745: "HOU", 1610612754: "IND",
    1610612746: "LAC", 1610612747: "LAL", 1610612763: "MEM", 1610612748: "MIA",
    1610612749: "MIL", 1610612750: "MIN", 1610612740: "NOP", 1610612752: "NYK",
    1610612760: "OKC", 1610612753: "ORL", 1610612755: "PHI", 1610612756: "PHX",
    1610612757: "POR", 1610612758: "SAC", 1610612759: "SAS", 1610612761: "TOR",
    1610612762: "UTA", 1610612764: "WAS",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {TEAM_SORT_KEYS.map((c) => (
            <button
              key={c.key}
              onClick={() => setSortKey(c.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                sortKey === c.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-text-secondary py-20 text-sm">Loading...</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-3 w-8">#</th>
                  <th className="text-left py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">W</th>
                  <th className="text-center py-3 px-2">L</th>
                  <th className="text-center py-3 px-2">Win%</th>
                  <th className="text-center py-3 px-2 font-bold text-accent">{TEAM_SORT_KEYS.find((c) => c.key === sortKey)?.label}</th>
                  <th className="text-center py-3 px-2">PPG</th>
                  <th className="text-center py-3 px-2">RPG</th>
                  <th className="text-center py-3 px-2">APG</th>
                  <th className="text-center py-3 px-2">FG%</th>
                  <th className="text-center py-3 px-2">3P%</th>
                  <th className="text-center py-3 px-2">+/-</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const tri = teamIdToTricode[r.TEAM_ID] || "";
                  const logoUrl = r.TEAM_ID ? `https://cdn.nba.com/logos/nba/${r.TEAM_ID}/global/L/logo.svg` : "";
                  return (
                    <tr key={r.TEAM_ID} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i < 3 ? "bg-accent/5" : ""}`}>
                      <td className="py-2.5 px-3 text-text-secondary font-medium">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={tri} className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <span className="font-medium text-text-primary whitespace-nowrap">{r.TEAM_NAME}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-success font-medium">{r.W}</td>
                      <td className="py-2.5 px-2 text-center text-danger font-medium">{r.L}</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{(r.W_PCT * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-center font-bold text-accent">
                        {sortKey.includes("PCT") ? (r[sortKey as keyof TeamRow] as number * 100).toFixed(1) + "%" : (r[sortKey as keyof TeamRow] as number).toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{r.PTS.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{r.REB.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{r.AST.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{(r.FG_PCT * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{(r.FG3_PCT * 100).toFixed(1)}%</td>
                      <td className={`py-2.5 px-2 text-center font-medium ${r.PLUS_MINUS > 0 ? "text-success" : r.PLUS_MINUS < 0 ? "text-danger" : "text-text-secondary"}`}>
                        {r.PLUS_MINUS > 0 ? "+" : ""}{r.PLUS_MINUS.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Awards Section ==========

function AwardsSection() {
  const [awardType, setAwardType] = useState("MVP");
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedPlayers, setLoadedPlayers] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const allAwards: AwardRow[] = [];
    const loaded = new Set<number>();

    // Fetch awards for known star players in parallel
    const results = await Promise.allSettled(
      STAR_PLAYERS.map(async (p) => {
        const data = await fetchStats("playerawards", { PlayerID: String(p.id) });
        const rs = data.resultSets?.[0];
        if (!rs) return [];
        return rs.rowSet.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          rs.headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
          return obj as unknown as AwardRow;
        });
      })
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        allAwards.push(...r.value);
        loaded.add(STAR_PLAYERS[i].id);
      }
    });

    setAwards(allAwards);
    setLoadedPlayers(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter awards by type
  const awardConfig = AWARD_TYPES.find((a) => a.key === awardType);
  const filtered = awards.filter((a) => {
    if (!awardConfig) return false;
    if (awardType.startsWith("ALL_NBA_")) {
      const teamNum = awardType.split("_")[2];
      return a.DESCRIPTION === "All-NBA" && a.ALL_NBA_TEAM_NUMBER === teamNum;
    }
    return a.DESCRIPTION === awardConfig.desc;
  });

  // Group by season, sort descending
  const bySeason = filtered.reduce<Record<string, AwardRow[]>>((acc, a) => {
    const s = a.SEASON;
    if (!acc[s]) acc[s] = [];
    acc[s].push(a);
    return acc;
  }, {});
  const seasons = Object.keys(bySeason).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-border">
          {AWARD_TYPES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAwardType(a.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                awardType === a.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-secondary">
          {loadedPlayers.size} players loaded
        </span>
      </div>

      {loading ? (
        <div className="text-center text-text-secondary py-20 text-sm">Loading awards for {STAR_PLAYERS.length} star players...</div>
      ) : seasons.length === 0 ? (
        <div className="text-center text-text-secondary py-20 text-sm">No {awardConfig?.label} records found</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-4">Season</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Team</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((season) =>
                  bySeason[season].map((a, i) => (
                    <tr key={`${season}-${a.PERSON_ID}-${i}`} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                      <td className="py-2.5 px-4 text-accent font-medium">{season}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={headshotUrl(a.PERSON_ID)} alt="" className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                          <span className="font-medium text-text-primary">{a.FIRST_NAME} {a.LAST_NAME}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-text-secondary">{a.TEAM}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
