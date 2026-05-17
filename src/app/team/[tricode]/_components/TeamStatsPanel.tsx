import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import { TEAM_META, type TeamMeta } from "@/lib/teams";
import type { Translations } from "@/locales";
import type { RecentGame } from "./TeamScheduleCard";

interface Props {
  team: TeamMeta;
  t: Translations;
  recentGames: RecentGame[];
  gamesPlayed: number;
  ppg: string;
  oppPpg: string;
}

/**
 * Pre-chart analytics tiles: season progression bars (10-game segments),
 * vs-division split, recent-opponents strip, off-vs-def comparison.
 * These all gate on `recentGames.length` or `gamesPlayed` so render
 * conditionally.
 */
export default function TeamStatsPanel({ team, t, recentGames, gamesPlayed, ppg, oppPpg }: Props) {
  return (
    <>
      {/* Season Progression — wins per 10-game segment */}
      {recentGames.length >= 10 && <SeasonProgression recentGames={recentGames} t={t} />}

      {/* vs Division Record */}
      {recentGames.length > 0 && <VsDivisionRecord team={team} recentGames={recentGames} t={t} />}

      {/* Recent Opponents */}
      {recentGames.length > 0 && (
        <div className="glass-tile p-4 mt-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.recentOpponents}</h3>
          <div className="flex items-center gap-2 overflow-x-auto">
            {recentGames.slice(0, 8).map((g, i) => (
              <Link key={i} href={`/team/${g.opponent}`} className="flex flex-col items-center gap-1 shrink-0">
                <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={28} />
                <span className={`text-[9px] font-bold ${g.won ? "text-success" : "text-danger"}`}>
                  {g.won ? "W" : "L"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Offense vs Defense */}
      {gamesPlayed > 0 && <OffVsDef ppg={ppg} oppPpg={oppPpg} t={t} />}
    </>
  );
}

function SeasonProgression({ recentGames, t }: { recentGames: RecentGame[]; t: Translations }) {
  // Reverse to chronological order so the leftmost bar is the oldest segment.
  const chronological = [...recentGames].reverse();
  const segments: { label: string; wins: number; total: number }[] = [];
  for (let i = 0; i < chronological.length; i += 10) {
    const chunk = chronological.slice(i, i + 10);
    const w = chunk.filter(g => g.won).length;
    const start = i + 1;
    const end = Math.min(i + 10, chronological.length);
    segments.push({ label: `${start}-${end}`, wins: w, total: chunk.length });
  }
  const maxWins = Math.max(...segments.map(s => s.total), 1);
  return (
    <div className="glass-tile p-4 mt-6">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.seasonProgression}</h3>
      <div className="flex items-end gap-2 h-28">
        {segments.map((seg, i) => {
          const barH = (seg.wins / maxWins) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-accent">{seg.wins}W</span>
              <div className="w-full rounded-t relative" style={{ height: `${barH}%`, minHeight: "4px" }}>
                <div className="w-full h-full bg-accent/70 rounded-t" />
              </div>
              <span className="text-[9px] text-text-secondary">{seg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VsDivisionRecord({ team, recentGames, t }: { team: TeamMeta; recentGames: RecentGame[]; t: Translations }) {
  const divisionTeams = new Set(
    Object.values(TEAM_META)
      .filter((tm) => tm.division === team.division && tm.tricode !== team.tricode)
      .map((tm) => tm.tricode),
  );
  let divW = 0, divL = 0, nonDivW = 0, nonDivL = 0;
  for (const g of recentGames) {
    if (divisionTeams.has(g.opponent)) {
      if (g.won) divW++; else divL++;
    } else {
      if (g.won) nonDivW++; else nonDivL++;
    }
  }
  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      <div className="glass-tile p-4 text-center">
        <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.vsDivision}</p>
        <p className="text-xl font-bold mt-1">
          <span className="text-success">{divW}</span>
          <span className="text-text-secondary mx-1">-</span>
          <span className="text-danger">{divL}</span>
        </p>
      </div>
      <div className="glass-tile p-4 text-center">
        <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.vsNonDivision}</p>
        <p className="text-xl font-bold mt-1">
          <span className="text-success">{nonDivW}</span>
          <span className="text-text-secondary mx-1">-</span>
          <span className="text-danger">{nonDivL}</span>
        </p>
      </div>
    </div>
  );
}

function OffVsDef({ ppg, oppPpg, t }: { ppg: string; oppPpg: string; t: Translations }) {
  return (
    <div className="glass-tile p-4 mt-6">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.offVsDef}</h3>
      <div className="flex items-end gap-1 h-20">
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-accent font-bold">{ppg}</span>
          <div className="w-full bg-accent/20 rounded-t" style={{ height: `${(parseFloat(ppg) / 150) * 100}%` }}>
            <div className="w-full h-full bg-accent rounded-t" />
          </div>
          <span className="text-[10px] text-text-secondary">OFF</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-danger font-bold">{oppPpg}</span>
          <div className="w-full bg-danger/20 rounded-t" style={{ height: `${(parseFloat(oppPpg) / 150) * 100}%` }}>
            <div className="w-full h-full bg-danger rounded-t" />
          </div>
          <span className="text-[10px] text-text-secondary">DEF</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className={`text-xs font-bold ${parseFloat(ppg) > parseFloat(oppPpg) ? "text-success" : "text-danger"}`}>
            {(parseFloat(ppg) - parseFloat(oppPpg) > 0 ? "+" : "")}{(parseFloat(ppg) - parseFloat(oppPpg)).toFixed(1)}
          </span>
          <div className="w-full bg-bg-hover rounded-t" style={{ height: `${(Math.abs(parseFloat(ppg) - parseFloat(oppPpg)) / 20) * 100}%` }}>
            <div className={`w-full h-full rounded-t ${parseFloat(ppg) > parseFloat(oppPpg) ? "bg-success" : "bg-danger"}`} />
          </div>
          <span className="text-[10px] text-text-secondary">NET</span>
        </div>
      </div>
    </div>
  );
}
