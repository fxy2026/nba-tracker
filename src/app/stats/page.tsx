"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Users, Trophy, Crown } from "lucide-react";

const STATS_API = "/api/stats";
const CURRENT_SEASON = "2024-25";

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
  EFF: number;
}

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

function headshotUrl(id: number) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
}

type Tab = "players" | "teams" | "awards";

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("players");
  const tabs = [
    { key: "players" as Tab, label: "Player Leaders", icon: Users },
    { key: "teams" as Tab, label: "Team Standings", icon: BarChart3 },
    { key: "awards" as Tab, label: "Awards", icon: Trophy },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-5 flex items-center gap-2">
        <Crown size={24} className="text-accent" />
        Stats & Rankings
      </h1>
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
      {tab === "teams" && <TeamStandings />}
      {tab === "awards" && <AwardsSection />}
    </div>
  );
}

// ==================== Player Leaders (via leagueleaders API) ====================

function PlayerLeaders() {
  const [cat, setCat] = useState("PTS");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seasonType, setSeasonType] = useState("Regular+Season");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        endpoint: "leagueleaders",
        LeagueID: "00",
        PerMode: "PerGame",
        Scope: "S",
        Season: CURRENT_SEASON,
        SeasonType: seasonType,
        StatCategory: cat,
      }).toString();
      const res = await fetch(`${STATS_API}?${qs}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const rs = data.resultSet;
      if (!rs) throw new Error("No data");
      const headers: string[] = rs.headers;
      const parsed = rs.rowSet.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      }) as unknown as LeaderRow[];
      setRows(parsed);
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, [cat, seasonType]);

  useEffect(() => { load(); }, [load]);

  const fmtVal = (r: LeaderRow, key: string) => {
    const v = r[key as keyof LeaderRow] as number;
    if (key.includes("PCT")) return (v * 100).toFixed(1) + "%";
    return v.toFixed(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-border">
          {PLAYER_CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${cat === c.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)}
          className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary">
          <option value="Regular+Season">Regular Season</option>
          <option value="Playoffs">Playoffs</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-text-secondary py-20 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-center text-danger py-20 text-sm">Failed to load: {error}</div>
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
                          <img src={headshotUrl(r.PLAYER_ID)} alt="" className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.PLAYER}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-text-secondary">{r.TEAM}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.GP}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-accent">{fmtVal(r, cat)}</td>
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

// ==================== Team Standings (via CDN schedule data) ====================

interface TeamRecord { tricode: string; teamId: number; teamName: string; teamCity: string; wins: number; losses: number; }

function TeamStandings() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [conf, setConf] = useState<"all" | "east" | "west">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/games?date=standings");
        // Fallback: compute from schedule
        const schedRes = await fetch("https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json", {
          headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/" },
        });
        if (!schedRes.ok) throw new Error("Failed");
        const data = await schedRes.json();
        const dates = data.leagueSchedule?.gameDates || [];
        const teamMap: Record<string, TeamRecord> = {};
        for (const gd of dates) {
          for (const g of gd.games) {
            if (g.gameStatus !== 3) continue; // only finished games
            const h = g.homeTeam;
            const a = g.awayTeam;
            if (!teamMap[h.teamTricode]) teamMap[h.teamTricode] = { tricode: h.teamTricode, teamId: h.teamId, teamName: h.teamName, teamCity: h.teamCity, wins: 0, losses: 0 };
            if (!teamMap[a.teamTricode]) teamMap[a.teamTricode] = { tricode: a.teamTricode, teamId: a.teamId, teamName: a.teamName, teamCity: a.teamCity, wins: 0, losses: 0 };
            if (h.score > a.score) { teamMap[h.teamTricode].wins++; teamMap[a.teamTricode].losses++; }
            else { teamMap[a.teamTricode].wins++; teamMap[h.teamTricode].losses++; }
          }
        }
        setTeams(Object.values(teamMap).sort((a, b) => {
          const wa = a.wins / (a.wins + a.losses || 1);
          const wb = b.wins / (b.wins + b.losses || 1);
          return wb - wa;
        }));
      } catch { setTeams([]); }
      setLoading(false);
    })();
  }, []);

  const EAST = ["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS"];
  const filtered = conf === "all" ? teams : teams.filter((t) => conf === "east" ? EAST.includes(t.tricode) : !EAST.includes(t.tricode));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["all","east","west"] as const).map((c) => (
            <button key={c} onClick={() => setConf(c)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${conf === c ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {c === "all" ? "All" : c === "east" ? "Eastern" : "Western"}
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
                  <th className="text-center py-3 px-2">GB</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const pct = t.wins + t.losses > 0 ? t.wins / (t.wins + t.losses) : 0;
                  const topPct = filtered[0] ? filtered[0].wins / (filtered[0].wins + filtered[0].losses || 1) : 0;
                  const gb = i === 0 ? "-" : (((topPct - pct) * (filtered[0].wins + filtered[0].losses)) / 2).toFixed(1);
                  const logoUrl = `https://cdn.nba.com/logos/nba/${t.teamId}/global/L/logo.svg`;
                  return (
                    <tr key={t.tricode} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i < 8 ? "bg-accent/5" : ""}`}>
                      <td className="py-2.5 px-3 text-text-secondary font-medium">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt={t.tricode} className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span className="font-medium text-text-primary whitespace-nowrap">{t.teamCity} {t.teamName}</span>
                          <span className="text-text-secondary text-xs">{t.tricode}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-success font-medium">{t.wins}</td>
                      <td className="py-2.5 px-2 text-center text-danger font-medium">{t.losses}</td>
                      <td className="py-2.5 px-2 text-center font-medium text-accent">{(pct * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-center text-text-secondary">{gb}</td>
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

// ==================== Awards (hardcoded historical data) ====================

const AWARD_CATS = [
  { key: "mvp", label: "MVP" },
  { key: "fmvp", label: "FMVP" },
  { key: "dpoy", label: "DPOY" },
  { key: "roy", label: "ROY" },
  { key: "smoy", label: "6MOY" },
  { key: "mip", label: "MIP" },
  { key: "nba1", label: "All-NBA 1st" },
] as const;

interface AwardEntry { season: string; player: string; team: string; }

const AWARDS_DATA: Record<string, AwardEntry[]> = {
  mvp: [
    { season: "2024-25", player: "Shai Gilgeous-Alexander", team: "OKC" },
    { season: "2023-24", player: "Nikola Jokic", team: "DEN" },
    { season: "2022-23", player: "Joel Embiid", team: "PHI" },
    { season: "2021-22", player: "Nikola Jokic", team: "DEN" },
    { season: "2020-21", player: "Nikola Jokic", team: "DEN" },
    { season: "2019-20", player: "Giannis Antetokounmpo", team: "MIL" },
    { season: "2018-19", player: "Giannis Antetokounmpo", team: "MIL" },
    { season: "2017-18", player: "James Harden", team: "HOU" },
    { season: "2016-17", player: "Russell Westbrook", team: "OKC" },
    { season: "2015-16", player: "Stephen Curry", team: "GSW" },
    { season: "2014-15", player: "Stephen Curry", team: "GSW" },
    { season: "2013-14", player: "Kevin Durant", team: "OKC" },
    { season: "2012-13", player: "LeBron James", team: "MIA" },
    { season: "2011-12", player: "LeBron James", team: "MIA" },
    { season: "2010-11", player: "Derrick Rose", team: "CHI" },
    { season: "2009-10", player: "LeBron James", team: "CLE" },
    { season: "2008-09", player: "LeBron James", team: "CLE" },
    { season: "2007-08", player: "Kobe Bryant", team: "LAL" },
    { season: "2006-07", player: "Dirk Nowitzki", team: "DAL" },
    { season: "2005-06", player: "Steve Nash", team: "PHX" },
    { season: "2004-05", player: "Steve Nash", team: "PHX" },
    { season: "2003-04", player: "Kevin Garnett", team: "MIN" },
    { season: "2002-03", player: "Tim Duncan", team: "SAS" },
    { season: "2001-02", player: "Tim Duncan", team: "SAS" },
    { season: "2000-01", player: "Allen Iverson", team: "PHI" },
  ],
  fmvp: [
    { season: "2024-25", player: "TBD", team: "-" },
    { season: "2023-24", player: "Jaylen Brown", team: "BOS" },
    { season: "2022-23", player: "Nikola Jokic", team: "DEN" },
    { season: "2021-22", player: "Stephen Curry", team: "GSW" },
    { season: "2020-21", player: "Giannis Antetokounmpo", team: "MIL" },
    { season: "2019-20", player: "LeBron James", team: "LAL" },
    { season: "2018-19", player: "Kawhi Leonard", team: "TOR" },
    { season: "2017-18", player: "Kevin Durant", team: "GSW" },
    { season: "2016-17", player: "Kevin Durant", team: "GSW" },
    { season: "2015-16", player: "LeBron James", team: "CLE" },
    { season: "2014-15", player: "Andre Iguodala", team: "GSW" },
    { season: "2013-14", player: "Kawhi Leonard", team: "SAS" },
    { season: "2012-13", player: "LeBron James", team: "MIA" },
    { season: "2011-12", player: "LeBron James", team: "MIA" },
    { season: "2010-11", player: "Dirk Nowitzki", team: "DAL" },
  ],
  dpoy: [
    { season: "2024-25", player: "Victor Wembanyama", team: "SAS" },
    { season: "2023-24", player: "Rudy Gobert", team: "MIN" },
    { season: "2022-23", player: "Jaren Jackson Jr.", team: "MEM" },
    { season: "2021-22", player: "Marcus Smart", team: "BOS" },
    { season: "2020-21", player: "Rudy Gobert", team: "UTA" },
    { season: "2019-20", player: "Giannis Antetokounmpo", team: "MIL" },
    { season: "2018-19", player: "Rudy Gobert", team: "UTA" },
    { season: "2017-18", player: "Rudy Gobert", team: "UTA" },
    { season: "2016-17", player: "Draymond Green", team: "GSW" },
    { season: "2015-16", player: "Kawhi Leonard", team: "SAS" },
    { season: "2014-15", player: "Kawhi Leonard", team: "SAS" },
  ],
  roy: [
    { season: "2024-25", player: "Zach Edey", team: "MEM" },
    { season: "2023-24", player: "Chet Holmgren", team: "OKC" },
    { season: "2022-23", player: "Paolo Banchero", team: "ORL" },
    { season: "2021-22", player: "Scottie Barnes", team: "TOR" },
    { season: "2020-21", player: "LaMelo Ball", team: "CHA" },
    { season: "2019-20", player: "Ja Morant", team: "MEM" },
    { season: "2018-19", player: "Luka Doncic", team: "DAL" },
    { season: "2017-18", player: "Ben Simmons", team: "PHI" },
    { season: "2016-17", player: "Malcolm Brogdon", team: "MIL" },
    { season: "2015-16", player: "Karl-Anthony Towns", team: "MIN" },
  ],
  smoy: [
    { season: "2024-25", player: "Payton Pritchard", team: "BOS" },
    { season: "2023-24", player: "Naz Reid", team: "MIN" },
    { season: "2022-23", player: "Malcolm Brogdon", team: "BOS" },
    { season: "2021-22", player: "Tyler Herro", team: "MIA" },
    { season: "2020-21", player: "Jordan Clarkson", team: "UTA" },
    { season: "2019-20", player: "Montrezl Harrell", team: "LAC" },
    { season: "2018-19", player: "Lou Williams", team: "LAC" },
    { season: "2017-18", player: "Lou Williams", team: "LAC" },
  ],
  mip: [
    { season: "2024-25", player: "Dyson Daniels", team: "ATL" },
    { season: "2023-24", player: "Tyrese Maxey", team: "PHI" },
    { season: "2022-23", player: "Lauri Markkanen", team: "UTA" },
    { season: "2021-22", player: "Ja Morant", team: "MEM" },
    { season: "2020-21", player: "Julius Randle", team: "NYK" },
    { season: "2019-20", player: "Brandon Ingram", team: "NOP" },
    { season: "2018-19", player: "Pascal Siakam", team: "TOR" },
    { season: "2017-18", player: "Victor Oladipo", team: "IND" },
  ],
  nba1: [
    { season: "2023-24", player: "Luka Doncic / SGA / Giannis / Jayson Tatum / Nikola Jokic", team: "DAL/OKC/MIL/BOS/DEN" },
    { season: "2022-23", player: "Luka Doncic / SGA / Giannis / Jayson Tatum / Joel Embiid", team: "DAL/OKC/MIL/BOS/PHI" },
    { season: "2021-22", player: "Luka Doncic / Devin Booker / Giannis / Jayson Tatum / Nikola Jokic", team: "DAL/PHX/MIL/BOS/DEN" },
    { season: "2020-21", player: "Luka Doncic / Stephen Curry / Giannis / Kawhi Leonard / Nikola Jokic", team: "DAL/GSW/MIL/LAC/DEN" },
    { season: "2019-20", player: "LeBron James / James Harden / Giannis / Anthony Davis / Luka Doncic", team: "LAL/HOU/MIL/LAL/DAL" },
    { season: "2018-19", player: "Stephen Curry / James Harden / Giannis / Paul George / Nikola Jokic", team: "GSW/HOU/MIL/OKC/DEN" },
    { season: "2017-18", player: "LeBron James / James Harden / Anthony Davis / Damian Lillard / Kevin Durant", team: "CLE/HOU/NOP/POR/GSW" },
  ],
};

function AwardsSection() {
  const [cat, setCat] = useState("mvp");
  const entries = AWARDS_DATA[cat] || [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-border">
          {AWARD_CATS.map((a) => (
            <button key={a.key} onClick={() => setCat(a.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${cat === a.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

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
              {entries.map((e, i) => (
                <tr key={i} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i === 0 ? "bg-accent/5" : ""}`}>
                  <td className="py-3 px-4 text-accent font-medium">{e.season}</td>
                  <td className="py-3 px-2 font-medium text-text-primary">{e.player}</td>
                  <td className="py-3 px-2 text-text-secondary">{e.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
