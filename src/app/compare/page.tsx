"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { GitCompareArrows, ArrowLeftRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface PlayerData {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  teamName: string;
  teamCity: string;
  jersey: string;
  position: string;
  pts: number;
  reb: number;
  ast: number;
}

const COMPARE_STATS = [
  { key: "pts", label: "PPG", color: "text-accent", barColor: "var(--accent)" },
  { key: "reb", label: "RPG", color: "text-success", barColor: "var(--success)" },
  { key: "ast", label: "APG", color: "text-blue-400", barColor: "#60a5fa" },
] as const;

export default function ComparePage() {
  const { t } = useLocale();
  const [query1, setQuery1] = useState("");
  const [query2, setQuery2] = useState("");
  const [results1, setResults1] = useState<PlayerData[]>([]);
  const [results2, setResults2] = useState<PlayerData[]>([]);
  const [player1, setPlayer1] = useState<PlayerData | null>(null);
  const [player2, setPlayer2] = useState<PlayerData | null>(null);

  const search = async (q: string, setter: (r: PlayerData[]) => void) => {
    if (q.length < 2) { setter([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setter(json.data || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const t = setTimeout(() => search(query1, setResults1), 300);
    return () => clearTimeout(t);
  }, [query1]);

  useEffect(() => {
    const t = setTimeout(() => search(query2, setResults2), 300);
    return () => clearTimeout(t);
  }, [query2]);

  const headshotUrl = (id: number) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <GitCompareArrows size={24} className="text-accent" />
        {t.comparePage.title}
      </h1>

      {/* Player selection */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 mb-8 items-start">
        {/* Player 1 */}
        <div className="relative">
          <input
            type="text"
            value={player1 ? `${player1.firstName} ${player1.lastName}` : query1}
            onChange={(e) => { setQuery1(e.target.value); setPlayer1(null); }}
            placeholder={t.comparePage.searchPlayer1}
            className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
          {results1.length > 0 && !player1 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {results1.map((p) => (
                <button key={p.personId} onClick={() => { setPlayer1(p); setResults1([]); setQuery1(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover text-left text-sm">
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  <span className="text-text-secondary text-xs ml-auto">{p.teamAbbr}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap button */}
        <div className="flex items-center justify-center md:pt-3">
          <button
            onClick={() => {
              const tempP = player1;
              const tempQ = query1;
              setPlayer1(player2);
              setQuery1(query2);
              setPlayer2(tempP);
              setQuery2(tempQ);
            }}
            className="p-2 rounded-lg bg-bg-card border border-border hover:bg-bg-hover hover:border-accent/50 transition-colors text-text-secondary hover:text-accent"
            title={t.comparePage.swapPlayers}
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>

        {/* Player 2 */}
        <div className="relative">
          <input
            type="text"
            value={player2 ? `${player2.firstName} ${player2.lastName}` : query2}
            onChange={(e) => { setQuery2(e.target.value); setPlayer2(null); }}
            placeholder={t.comparePage.searchPlayer2}
            className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
          {results2.length > 0 && !player2 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {results2.map((p) => (
                <button key={p.personId} onClick={() => { setPlayer2(p); setResults2([]); setQuery2(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover text-left text-sm">
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  <span className="text-text-secondary text-xs ml-auto">{p.teamAbbr}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popular Matchups */}
      <div className="mb-6">
        <p className="text-xs text-text-secondary font-medium mb-2">{t.comparePage.popularMatchups}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "LeBron vs Curry", q1: "LeBron", q2: "Curry" },
            { label: "Jokic vs Embiid", q1: "Jokic", q2: "Embiid" },
            { label: "Luka vs SGA", q1: "Luka", q2: "Gilgeous" },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setQuery1(preset.q1); setQuery2(preset.q2); setPlayer1(null); setPlayer2(null); }}
              className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison display */}
      {player1 && player2 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          {/* Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] p-6 border-b border-border">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player1.personId)} alt={`${player1.firstName} ${player1.lastName}`} width={80} height={80} className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary">{player1.firstName} {player1.lastName}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">{player1.position}</span>
                <p className="text-sm font-semibold text-text-primary mt-1">{player1.teamAbbr}</p>
                <p className="text-[10px] text-text-secondary">{player1.teamCity} {player1.teamName} &middot; #{player1.jersey}</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-4">
              <div className="w-px h-8 bg-border" />
              <span className="text-2xl font-bold text-text-secondary">{t.common.vs}</span>
              <div className="w-px h-8 bg-border" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player2.personId)} alt={`${player2.firstName} ${player2.lastName}`} width={80} height={80} className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary">{player2.firstName} {player2.lastName}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">{player2.position}</span>
                <p className="text-sm font-semibold text-text-primary mt-1">{player2.teamAbbr}</p>
                <p className="text-[10px] text-text-secondary">{player2.teamCity} {player2.teamName} &middot; #{player2.jersey}</p>
              </div>
            </div>
          </div>

          {/* Position comparison + separator */}
          <div className="flex items-center gap-3 px-6 py-2 bg-bg-secondary/30">
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary uppercase font-medium">{t.comparePage.statsComparison}</span>
              {player1.position && player2.position && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${player1.position === player2.position ? "bg-accent/15 text-accent" : "bg-bg-hover text-text-secondary"}`}>
                  {player1.position === player2.position ? `${t.comparePage.samePosition}${player1.position}` : `${player1.position} ${t.common.vs} ${player2.position}`}
                </span>
              )}
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stats bars */}
          <div className="p-6 space-y-5">
            {COMPARE_STATS.map(({ key, label, color }) => {
              const v1 = player1[key as keyof PlayerData] as number;
              const v2 = player2[key as keyof PlayerData] as number;
              const max = Math.max(v1, v2, 0.1);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-lg font-bold ${v1 >= v2 ? color : "text-text-secondary"}`}>{v1}</span>
                    <span className="text-xs text-text-secondary font-medium uppercase">{label}</span>
                    <span className={`text-lg font-bold ${v2 >= v1 ? color : "text-text-secondary"}`}>{v2}</span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div className="flex-1 flex justify-end">
                      <div className={`h-full rounded-l-full ${v1 >= v2 ? "bg-accent" : "bg-bg-hover"}`}
                        style={{ width: `${(v1 / max) * 100}%` }} />
                    </div>
                    <div className="flex-1">
                      <div className={`h-full rounded-r-full ${v2 >= v1 ? "bg-accent" : "bg-bg-hover"}`}
                        style={{ width: `${(v2 / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Winner Summary */}
          <div className="px-6 py-3 bg-bg-secondary/50 border-t border-border">
            {(() => {
              let p1Wins = 0, p2Wins = 0;
              for (const { key } of COMPARE_STATS) {
                const v1 = player1[key as keyof PlayerData] as number;
                const v2 = player2[key as keyof PlayerData] as number;
                if (v1 > v2) p1Wins++;
                else if (v2 > v1) p2Wins++;
              }
              const winner = p1Wins > p2Wins ? player1 : p2Wins > p1Wins ? player2 : null;
              return (
                <p className="text-center text-sm">
                  {winner ? (
                    <><span className="text-accent font-bold">{winner.firstName} {winner.lastName}</span> <span className="text-text-secondary">{t.comparePage.leads} {p1Wins > p2Wins ? p1Wins : p2Wins}-{p1Wins > p2Wins ? p2Wins : p1Wins} {t.comparePage.categories}</span></>
                  ) : (
                    <span className="text-text-secondary">{t.comparePage.tiedAll}</span>
                  )}
                </p>
              );
            })()}
            {/* Per-category advantage */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {COMPARE_STATS.map(({ key, label }) => {
                const v1 = player1[key as keyof PlayerData] as number;
                const v2 = player2[key as keyof PlayerData] as number;
                const advantage = v1 > v2 ? player1 : v2 > v1 ? player2 : null;
                return (
                  <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    advantage === player1 ? "bg-accent/15 text-accent" :
                    advantage === player2 ? "bg-success/15 text-success" :
                    "bg-bg-hover text-text-secondary"
                  }`}>
                    {label}: {advantage ? `${advantage.lastName}` : t.common.tied}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Radar Chart */}
          <div className="px-6 pb-4">
            <h3 className="text-xs text-text-secondary font-medium uppercase mb-2 text-center">{t.comparePage.radarComparison}</h3>
            {(() => {
              const stats = COMPARE_STATS.map(({ key, label }) => {
                const v1 = player1[key as keyof PlayerData] as number;
                const v2 = player2[key as keyof PlayerData] as number;
                const max = Math.max(v1, v2, 0.1);
                return { label, v1: v1 / max, v2: v2 / max };
              });
              const cx = 100, cy = 100, r = 70;
              const n = stats.length;
              const angleStep = (2 * Math.PI) / n;
              const getPoint = (ratio: number, i: number) => {
                const angle = -Math.PI / 2 + i * angleStep;
                return { x: cx + r * ratio * Math.cos(angle), y: cy + r * ratio * Math.sin(angle) };
              };
              const p1Points = stats.map((s, i) => getPoint(s.v1, i));
              const p2Points = stats.map((s, i) => getPoint(s.v2, i));
              const poly1 = p1Points.map(p => `${p.x},${p.y}`).join(" ");
              const poly2 = p2Points.map(p => `${p.x},${p.y}`).join(" ");
              // Grid rings
              const rings = [0.33, 0.66, 1.0];
              return (
                <svg viewBox="0 0 200 200" className="w-full max-w-[240px] mx-auto">
                  {rings.map((ring) => (
                    <polygon key={ring} points={Array.from({ length: n }, (_, i) => {
                      const pt = getPoint(ring, i);
                      return `${pt.x},${pt.y}`;
                    }).join(" ")} fill="none" stroke="var(--border)" strokeWidth="0.5" />
                  ))}
                  {stats.map((_, i) => {
                    const pt = getPoint(1, i);
                    return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="var(--border)" strokeWidth="0.3" />;
                  })}
                  <polygon points={poly1} fill="var(--accent)" fillOpacity="0.25" stroke="var(--accent)" strokeWidth="1.5" />
                  <polygon points={poly2} fill="var(--success)" fillOpacity="0.15" stroke="var(--success)" strokeWidth="1.5" strokeDasharray="4 2" />
                  {stats.map((s, i) => {
                    const pt = getPoint(1.18, i);
                    return <text key={i} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{s.label}</text>;
                  })}
                </svg>
              );
            })()}
            <div className="flex justify-center gap-4 mt-1 text-[10px] text-text-secondary">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />{player1.lastName}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />{player2.lastName}</span>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div className="px-6 pb-6">
            <svg viewBox="0 0 300 140" className="w-full max-w-md mx-auto">
              {COMPARE_STATS.map(({ key, label, barColor }, i) => {
                const v1 = player1[key as keyof PlayerData] as number;
                const v2 = player2[key as keyof PlayerData] as number;
                const max = Math.max(v1, v2, 0.1);
                const barW = 30;
                const gap = 100;
                const baseX = 50 + i * gap;
                const maxH = 90;
                return (
                  <g key={key}>
                    <rect x={baseX - barW / 2 - 2} y={20 + maxH - (v1 / max) * maxH} width={barW} height={(v1 / max) * maxH}
                      rx={4} fill={barColor} opacity={0.7} />
                    <rect x={baseX + barW / 2 + 2} y={20 + maxH - (v2 / max) * maxH} width={barW} height={(v2 / max) * maxH}
                      rx={4} fill={barColor} opacity={0.35} />
                    <text x={baseX - 2} y={16} textAnchor="middle" fill="var(--text-secondary)" fontSize={9} fontWeight={600}>{v1}</text>
                    <text x={baseX + barW + 2} y={16} textAnchor="middle" fill="var(--text-secondary)" fontSize={9}>{v2}</text>
                    <text x={baseX + barW / 4} y={125} textAnchor="middle" fill="var(--text-secondary)" fontSize={10} fontWeight={500}>{label}</text>
                  </g>
                );
              })}
              <text x={10} y={135} fill="var(--text-secondary)" fontSize={8}>&#9632; {player1.lastName}</text>
              <text x={200} y={135} fill="var(--text-secondary)" fontSize={8} opacity={0.5}>&#9632; {player2.lastName}</text>
            </svg>
          </div>
        </div>
      )}

      {/* Overall Production Score */}
      {player1 && player2 && (() => {
        // Simple production score: PTS + 1.2*REB + 1.5*AST
        const score1 = player1.pts + 1.2 * player1.reb + 1.5 * player1.ast;
        const score2 = player2.pts + 1.2 * player2.reb + 1.5 * player2.ast;
        return (
          <div className="bg-bg-card border border-border rounded-xl p-4 mt-4">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3 text-center">{t.comparePage.overallScore}</h3>
            <p className="text-[9px] text-text-secondary text-center mb-3">{t.comparePage.scoreFormula}</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-right">
                <span className={`text-lg font-bold ${score1 >= score2 ? "text-accent" : "text-text-secondary"}`}>{score1.toFixed(1)}</span>
                <p className="text-[10px] text-text-secondary">{player1.lastName}</p>
              </div>
              <div className="w-32 h-3 bg-bg-hover rounded-full overflow-hidden flex">
                <div className="h-full bg-accent rounded-l-full" style={{ width: `${(score1 / (score1 + score2)) * 100}%` }} />
                <div className="h-full bg-success rounded-r-full" style={{ width: `${(score2 / (score1 + score2)) * 100}%` }} />
              </div>
              <div className="flex-1">
                <span className={`text-lg font-bold ${score2 >= score1 ? "text-success" : "text-text-secondary"}`}>{score2.toFixed(1)}</span>
                <p className="text-[10px] text-text-secondary">{player2.lastName}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {!player1 && !player2 && (
        <div className="text-center py-16 text-text-secondary">
          <GitCompareArrows size={48} className="mx-auto mb-4 opacity-30" />
          <p>{t.comparePage.selectHint}</p>
        </div>
      )}
    </div>
  );
}
