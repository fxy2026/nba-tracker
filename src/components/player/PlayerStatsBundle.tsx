"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
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
}

interface GameLogRow {
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  PLUS_MINUS: number;
}

// Single component that fetches both career stats + game log in ONE API call
export default function PlayerStatsBundle({ playerId }: { playerId: number }) {
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);
  const [games, setGames] = useState<GameLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/player?id=${playerId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setSeasons(data.careerSeasons || []);
          setGames(data.recentGames || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-secondary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scoring Trend Chart */}
      {games && games.length >= 3 && (
        <GameTrendChart games={games} />
      )}

      {/* Recent Games */}
      {games && games.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <h3 className="text-sm font-semibold">Recent Games (2025-26)</h3>
            {(() => {
              const last10 = [...games].slice(0, 10).reverse();
              if (last10.length < 2) return null;
              const maxPts = Math.max(...last10.map(g => g.PTS), 1);
              const w = 50, h = 16;
              const step = w / (last10.length - 1);
              const pts = last10.map((g, i) => ({
                x: i * step,
                y: h - (g.PTS / maxPts) * (h - 2) - 1,
              }));
              const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              return (
                <svg width={w} height={h} className="shrink-0">
                  <polyline points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
            })()}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">Date</th>
                  <th className="text-left py-2.5 px-2">Matchup</th>
                  <th className="text-center py-2.5 px-2">W/L</th>
                  <th className="text-center py-2.5 px-2">MIN</th>
                  <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
                  <th className="text-center py-2.5 px-2">REB</th>
                  <th className="text-center py-2.5 px-2">AST</th>
                  <th className="text-center py-2.5 px-2">+/-</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.GAME_ID} className="border-b border-border/30 hover:bg-bg-hover/50">
                    <td className="py-2 px-3 text-text-secondary sticky left-0 bg-bg-card whitespace-nowrap">
                      {g.GAME_DATE ? new Date(g.GAME_DATE).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                    </td>
                    <td className="py-2 px-2">
                      <Link href={`/game/${g.GAME_ID}`} className="text-text-primary hover:text-accent transition-colors whitespace-nowrap">
                        {g.MATCHUP}
                      </Link>
                    </td>
                    <td className={`text-center py-2 px-2 font-bold ${g.WL === "W" ? "text-success" : "text-danger"}`}>{g.WL}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{g.MIN}</td>
                    <td className="text-center py-2 px-2 font-bold text-accent">
                      {g.PTS}
                      {g.PTS >= 40 && <span className="ml-0.5 text-[8px] text-yellow-400">&#9733;</span>}
                    </td>
                    <td className="text-center py-2 px-2">{g.REB}</td>
                    <td className="text-center py-2 px-2">{g.AST}</td>
                    <td className={`text-center py-2 px-2 ${g.PLUS_MINUS > 0 ? "text-success" : g.PLUS_MINUS < 0 ? "text-danger" : "text-text-secondary"}`}>
                      {g.PLUS_MINUS > 0 ? "+" : ""}{g.PLUS_MINUS}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Career Stats */}
      {seasons && seasons.length > 0 && (
        <CareerStatsTable seasons={seasons} />
      )}
    </div>
  );
}

function GameTrendChart({ games }: { games: GameLogRow[] }) {
  // Show last 20 games in chronological order (oldest first)
  const data = [...games].reverse().slice(-20);
  const maxPts = Math.max(...data.map((g) => g.PTS), 10);
  const avgPts = data.reduce((s, g) => s + g.PTS, 0) / data.length;

  const w = 600, h = 160, pad = { top: 20, right: 10, bottom: 24, left: 32 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const xStep = plotW / Math.max(data.length - 1, 1);
  const points = data.map((g, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + plotH - (g.PTS / maxPts) * plotH,
    pts: g.PTS,
    date: g.GAME_DATE,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = linePath + ` L${points[points.length - 1].x},${pad.top + plotH} L${points[0].x},${pad.top + plotH} Z`;
  const avgY = pad.top + plotH - (avgPts / maxPts) * plotH;

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-1 h-4 bg-accent rounded-full" />
          Scoring Trend (Last {data.length} Games)
        </h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-text-secondary">Avg: <span className="text-accent font-bold">{avgPts.toFixed(1)}</span></span>
          <span className="text-text-secondary">High: <span className="text-success font-bold">{Math.max(...data.map(g => g.PTS))}</span></span>
          <span className="text-text-secondary">Low: <span className="text-danger font-bold">{Math.min(...data.map(g => g.PTS))}</span></span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis labels */}
        {[0, Math.round(maxPts / 2), maxPts].map((v) => {
          const y = pad.top + plotH - (v / maxPts) * plotH;
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={pad.left - 4} y={y} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={9}>{v}</text>
            </g>
          );
        })}
        {/* Average line */}
        <line x1={pad.left} y1={avgY} x2={w - pad.right} y2={avgY} stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6} />
        <text x={w - pad.right + 2} y={avgY} dominantBaseline="central" fill="var(--accent)" fontSize={8} opacity={0.8}>avg {avgPts.toFixed(1)}</text>
        {/* Area fill */}
        <path d={areaPath} fill="var(--accent)" fillOpacity={0.08} />
        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={1.5} />
        ))}
        {/* X-axis labels (every 5 games) */}
        {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p, i) => (
          <text key={i} x={p.x} y={h - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize={8}>
            {p.date ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Compare current to career average
function CompareArrow({ current, career }: { current: number; career: number }) {
  if (current > career) return <span className="text-success text-[9px] ml-0.5">&#9650;</span>;
  if (current < career) return <span className="text-danger text-[9px] ml-0.5">&#9660;</span>;
  return null;
}

function CareerStatsTable({ seasons }: { seasons: SeasonRow[] }) {
  // Find best season by PPG
  let bestIdx = 0;
  let bestPts = 0;
  for (let i = 0; i < seasons.length; i++) {
    if (seasons[i].PTS > bestPts) {
      bestPts = seasons[i].PTS;
      bestIdx = i;
    }
  }

  // Compute career averages (weighted by GP)
  let totalGP = 0, totalMIN = 0, totalPTS = 0, totalREB = 0, totalAST = 0;
  let totalSTL = 0, totalBLK = 0;
  let fgMadeTotal = 0, fgAttTotal = 0, fg3MadeTotal = 0, fg3AttTotal = 0, ftMadeTotal = 0, ftAttTotal = 0;

  for (const s of seasons) {
    totalGP += s.GP;
    totalMIN += s.MIN * s.GP;
    totalPTS += s.PTS * s.GP;
    totalREB += s.REB * s.GP;
    totalAST += s.AST * s.GP;
    totalSTL += s.STL * s.GP;
    totalBLK += s.BLK * s.GP;
    // Approximate FG/3P/FT attempts from percentages
    if (s.FG_PCT != null) {
      fgMadeTotal += s.FG_PCT * s.GP;
      fgAttTotal += s.GP;
    }
    if (s.FG3_PCT != null) {
      fg3MadeTotal += s.FG3_PCT * s.GP;
      fg3AttTotal += s.GP;
    }
    if (s.FT_PCT != null) {
      ftMadeTotal += s.FT_PCT * s.GP;
      ftAttTotal += s.GP;
    }
  }

  const careerAvg = totalGP > 0 ? {
    GP: totalGP,
    MIN: totalMIN / totalGP,
    PTS: totalPTS / totalGP,
    REB: totalREB / totalGP,
    AST: totalAST / totalGP,
    STL: totalSTL / totalGP,
    BLK: totalBLK / totalGP,
    FG_PCT: fgAttTotal > 0 ? fgMadeTotal / fgAttTotal : null,
    FG3_PCT: fg3AttTotal > 0 ? fg3MadeTotal / fg3AttTotal : null,
    FT_PCT: ftAttTotal > 0 ? ftMadeTotal / ftAttTotal : null,
  } : null;

  // Current season = last one in the list
  const currentSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Season-by-Season Stats</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">Season</th>
              <th className="text-left py-2.5 px-2">Team</th>
              <th className="text-center py-2.5 px-2">GP</th>
              <th className="text-center py-2.5 px-2">MIN</th>
              <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
              <th className="text-center py-2.5 px-2">REB</th>
              <th className="text-center py-2.5 px-2">AST</th>
              <th className="text-center py-2.5 px-2">STL</th>
              <th className="text-center py-2.5 px-2">BLK</th>
              <th className="text-center py-2.5 px-2">FG%</th>
              <th className="text-center py-2.5 px-2">3P%</th>
              <th className="text-center py-2.5 px-2">FT%</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s, i) => (
              <tr
                key={`${s.SEASON_ID}-${s.TEAM_ABBREVIATION}-${i}`}
                className={`border-b border-border/30 hover:bg-bg-hover/50 ${i === bestIdx ? "bg-accent/5" : ""}`}
              >
                <td className={`py-2 px-3 font-medium sticky left-0 ${i === bestIdx ? "text-accent bg-accent/5" : "text-text-primary bg-bg-card"}`}>
                  <span className="flex items-center gap-1">
                    {i === bestIdx && <span className="text-accent" title="Best PPG season">&#9733;</span>}
                    {s.SEASON_ID}
                  </span>
                </td>
                <td className="py-2 px-2 text-text-secondary">{s.TEAM_ABBREVIATION}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.GP}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.MIN?.toFixed(1)}</td>
                <td className={`text-center py-2 px-2 font-bold ${i === bestIdx ? "text-accent" : "text-accent"}`}>{s.PTS?.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{s.REB?.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{s.AST?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.STL?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.BLK?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FG_PCT != null ? (s.FG_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FG3_PCT != null ? (s.FG3_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FT_PCT != null ? (s.FT_PCT * 100).toFixed(1) + "%" : "-"}</td>
              </tr>
            ))}
            {/* Career Average Row */}
            {careerAvg && (
              <tr className="border-t-2 border-border bg-bg-secondary/50 font-medium">
                <td className="py-2 px-3 sticky left-0 bg-bg-secondary/50 text-text-primary font-bold">Career</td>
                <td className="py-2 px-2 text-text-secondary">-</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.GP}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.MIN.toFixed(1)}</td>
                <td className="text-center py-2 px-2 font-bold text-text-primary">{careerAvg.PTS.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{careerAvg.REB.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{careerAvg.AST.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.STL.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.BLK.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FG_PCT != null ? (careerAvg.FG_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FG3_PCT != null ? (careerAvg.FG3_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FT_PCT != null ? (careerAvg.FT_PCT * 100).toFixed(1) + "%" : "-"}</td>
              </tr>
            )}
            {/* Current Season vs Career Comparison */}
            {currentSeason && careerAvg && seasons.length > 1 && (
              <tr className="bg-bg-hover/30 text-[10px]">
                <td className="py-1.5 px-3 sticky left-0 bg-bg-hover/30 text-text-secondary italic" colSpan={4}>vs Career Avg</td>
                <td className="text-center py-1.5 px-2 font-medium">
                  {currentSeason.PTS > careerAvg.PTS ? "+" : ""}{(currentSeason.PTS - careerAvg.PTS).toFixed(1)}
                  <CompareArrow current={currentSeason.PTS} career={careerAvg.PTS} />
                </td>
                <td className="text-center py-1.5 px-2">
                  {currentSeason.REB > careerAvg.REB ? "+" : ""}{(currentSeason.REB - careerAvg.REB).toFixed(1)}
                  <CompareArrow current={currentSeason.REB} career={careerAvg.REB} />
                </td>
                <td className="text-center py-1.5 px-2">
                  {currentSeason.AST > careerAvg.AST ? "+" : ""}{(currentSeason.AST - careerAvg.AST).toFixed(1)}
                  <CompareArrow current={currentSeason.AST} career={careerAvg.AST} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">
                  {currentSeason.STL > careerAvg.STL ? "+" : ""}{(currentSeason.STL - careerAvg.STL).toFixed(1)}
                  <CompareArrow current={currentSeason.STL} career={careerAvg.STL} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">
                  {currentSeason.BLK > careerAvg.BLK ? "+" : ""}{(currentSeason.BLK - careerAvg.BLK).toFixed(1)}
                  <CompareArrow current={currentSeason.BLK} career={careerAvg.BLK} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
