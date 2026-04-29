"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { GitCompareArrows } from "lucide-react";

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
  { key: "pts", label: "PPG", color: "text-accent" },
  { key: "reb", label: "RPG", color: "text-success" },
  { key: "ast", label: "APG", color: "text-blue-400" },
] as const;

export default function ComparePage() {
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
        Player Comparison
      </h1>

      {/* Player selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Player 1 */}
        <div className="relative">
          <input
            type="text"
            value={player1 ? `${player1.firstName} ${player1.lastName}` : query1}
            onChange={(e) => { setQuery1(e.target.value); setPlayer1(null); }}
            placeholder="Search player 1..."
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

        {/* Player 2 */}
        <div className="relative">
          <input
            type="text"
            value={player2 ? `${player2.firstName} ${player2.lastName}` : query2}
            onChange={(e) => { setQuery2(e.target.value); setPlayer2(null); }}
            placeholder="Search player 2..."
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

      {/* Comparison display */}
      {player1 && player2 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          {/* Headers */}
          <div className="grid grid-cols-3 p-6 border-b border-border">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player1.personId)} alt={`${player1.firstName} ${player1.lastName}`} width={80} height={80} className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary">{player1.firstName} {player1.lastName}</p>
                <p className="text-xs text-text-secondary">{player1.teamCity} {player1.teamName}</p>
                <p className="text-xs text-accent">#{player1.jersey} {player1.position}</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold text-text-secondary">VS</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player2.personId)} alt={`${player2.firstName} ${player2.lastName}`} width={80} height={80} className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary">{player2.firstName} {player2.lastName}</p>
                <p className="text-xs text-text-secondary">{player2.teamCity} {player2.teamName}</p>
                <p className="text-xs text-accent">#{player2.jersey} {player2.position}</p>
              </div>
            </div>
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
        </div>
      )}

      {!player1 && !player2 && (
        <div className="text-center py-16 text-text-secondary">
          <GitCompareArrows size={48} className="mx-auto mb-4 opacity-30" />
          <p>Select two players to compare their career stats</p>
        </div>
      )}
    </div>
  );
}
