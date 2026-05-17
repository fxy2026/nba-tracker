import Link from "next/link";
import { Trophy } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import type { Translations } from "@/locales";
import type { RecentGame } from "./TeamScheduleCard";

export interface Rivalry {
  opponent: string;
  opponentId: number;
  wins: number;
  losses: number;
}

interface Props {
  t: Translations;
  recentGames: RecentGame[];
  rivalries: Rivalry[];
}

/**
 * Post-grid trends: monthly W/L tiles with win% sparkline, plus the H2H
 * rivalries table. Rendered together because both pull from the same
 * derived state and share visual rhythm with the surrounding glass-tiles.
 */
export default function TeamTrendsPanel({ t, recentGames, rivalries }: Props) {
  return (
    <>
      {/* Monthly Record */}
      {recentGames.length > 0 && <MonthlyRecord recentGames={recentGames} t={t} />}

      {/* Head-to-Head */}
      {rivalries.length > 0 && (
        <div className="glass-tile overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.h2hPage.title}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-4">{t.teamPage.opponent}</th>
                  <th className="text-center py-3 px-2">W</th>
                  <th className="text-center py-3 px-2">L</th>
                  <th className="text-center py-3 px-2">Win%</th>
                </tr>
              </thead>
              <tbody>
                {rivalries.map((r) => (
                  <tr key={r.opponent} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                    <td className="py-2.5 px-4">
                      <Link href={`/team/${r.opponent}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                        <TeamLogo teamId={r.opponentId} tricode={r.opponent} size={20} />
                        <span className="font-medium text-text-primary">{r.opponent}</span>
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2 text-success font-medium">{r.wins}</td>
                    <td className="text-center py-2.5 px-2 text-danger font-medium">{r.losses}</td>
                    <td className="text-center py-2.5 px-2 font-medium text-accent">
                      {((r.wins / (r.wins + r.losses)) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Monthly W/L tiles + win% sparkline. Returns null when < 2 distinct
 * months exist (sparkline requires at least 2 points).
 */
function MonthlyRecord({ recentGames, t }: { recentGames: RecentGame[]; t: Translations }) {
  const byMonth = new Map<string, { w: number; l: number }>();
  for (const g of recentGames) {
    const month = g.date.slice(0, 7); // "2025-04"
    const rec = byMonth.get(month) || { w: 0, l: 0 };
    if (g.won) rec.w++; else rec.l++;
    byMonth.set(month, rec);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (months.length < 2) return null;

  // Feature 11: Win percentage sparkline geometry (computed inline below)
  const pcts = months.map(([, rec]) => rec.w / (rec.w + rec.l || 1));
  const w = 200, h = 40, pad = 4;
  const xStep = (w - pad * 2) / (pcts.length - 1);
  const points = pcts.map((p, i) => `${pad + i * xStep},${h - pad - p * (h - pad * 2)}`).join(" ");

  return (
    <div className="glass-tile p-4 mt-6">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.monthlyRecord}</h3>
      <div className="flex flex-wrap gap-2">
        {months.map(([month, rec]) => (
          <div key={month} className="bg-bg-secondary rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-text-secondary">{new Date(month + "-01").toLocaleDateString("en-US", { month: "short" })}</p>
            <p className="text-sm font-bold">
              <span className="text-success">{rec.w}</span>
              <span className="text-text-secondary mx-0.5">-</span>
              <span className="text-danger">{rec.l}</span>
            </p>
          </div>
        ))}
      </div>
      {months.length >= 2 && (
        <div className="mt-3">
          <p className="text-[10px] text-text-secondary mb-1">{t.teamPage.winPctTrend}</p>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[240px]" preserveAspectRatio="none">
            <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
            <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pcts.map((p, i) => (
              <circle key={i} cx={pad + i * xStep} cy={h - pad - p * (h - pad * 2)} r="2.5" fill="var(--accent)" />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
