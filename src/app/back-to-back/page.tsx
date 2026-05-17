import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Back-to-Backs",
  description: "Teams that have played the most back-to-back games this season and upcoming B2B situations on the schedule.",
};

export const revalidate = 600;

interface B2BInstance {
  teamTricode: string;
  teamId: number;
  dates: [string, string];
  game1Id: string;
  game2Id: string;
  isFuture: boolean;
  game1Won?: boolean;
  game2Won?: boolean;
}

function parseUS(s: string): string | null {
  const date = s.split(" ")[0];
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function compute() {
  const schedule = await getFullSchedule().catch(() => []);
  type Apr = { date: string; gameId: string; status: number; teamId: number; won: boolean | null };
  const teamApps = new Map<string, Apr[]>();

  for (const gd of schedule) {
    const iso = parseUS(gd.gameDate);
    if (!iso) continue;
    for (const g of gd.games) {
      // Skip preseason (001) exhibition vs international teams; keep regular season + playoffs
      if (g.gameId.startsWith("001")) continue;
      const won = g.gameStatus === 3 ? g.homeTeam.score > g.awayTeam.score : null;
      const pushH = teamApps.get(g.homeTeam.teamTricode) || [];
      pushH.push({ date: iso, gameId: g.gameId, status: g.gameStatus, teamId: g.homeTeam.teamId, won });
      teamApps.set(g.homeTeam.teamTricode, pushH);
      const pushA = teamApps.get(g.awayTeam.teamTricode) || [];
      pushA.push({ date: iso, gameId: g.gameId, status: g.gameStatus, teamId: g.awayTeam.teamId, won: won === null ? null : !won });
      teamApps.set(g.awayTeam.teamTricode, pushA);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const instances: B2BInstance[] = [];
  for (const [tricode, apps] of teamApps) {
    apps.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < apps.length - 1; i++) {
      const a = apps[i];
      const b = apps[i + 1];
      if (b.date !== addDays(a.date, 1)) continue;
      instances.push({
        teamTricode: tricode,
        teamId: a.teamId,
        dates: [a.date, b.date],
        game1Id: a.gameId,
        game2Id: b.gameId,
        isFuture: a.date > todayIso,
        game1Won: a.won === null ? undefined : a.won,
        game2Won: b.won === null ? undefined : b.won,
      });
    }
  }

  const past = instances.filter((i) => !i.isFuture);
  const future = instances.filter((i) => i.isFuture);

  // Aggregate per team
  const totals = new Map<string, { team: string; teamId: number; played: number; upcoming: number; pastB2bWins: number; pastB2bGames: number }>();
  for (const ins of instances) {
    const cur = totals.get(ins.teamTricode) || { team: ins.teamTricode, teamId: ins.teamId, played: 0, upcoming: 0, pastB2bWins: 0, pastB2bGames: 0 };
    if (ins.isFuture) cur.upcoming++;
    else {
      cur.played++;
      if (ins.game1Won === true) cur.pastB2bWins++;
      if (ins.game2Won === true) cur.pastB2bWins++;
      cur.pastB2bGames += 2;
    }
    totals.set(ins.teamTricode, cur);
  }
  // Add missing teams
  for (const meta of Object.values(TEAM_META)) {
    if (!totals.has(meta.tricode)) {
      totals.set(meta.tricode, { team: meta.tricode, teamId: meta.teamId, played: 0, upcoming: 0, pastB2bWins: 0, pastB2bGames: 0 });
    }
  }

  return {
    past,
    future: future.sort((a, b) => a.dates[0].localeCompare(b.dates[0])).slice(0, 15),
    totals: [...totals.values()],
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`;
}

export default async function BackToBackPage() {
  const { past, future, totals } = await compute();

  if (past.length === 0 && future.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Schedule" icon={Repeat} title="Back-to-Backs" />
        <EmptyState icon={Repeat} title="No B2Bs detected" description="No consecutive-day game pairs were found in the schedule." />
      </div>
    );
  }

  const ranked = [...totals].sort((a, b) => (b.played + b.upcoming) - (a.played + a.upcoming)).slice(0, 15);
  const maxCount = ranked[0]?.played + ranked[0]?.upcoming || 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Schedule"
        icon={Repeat}
        title="Back-to-Backs"
        subtitle={`${past.length} B2B game pairs played · ${future.length} upcoming · the league's most punishing scheduling artifact`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Repeat size={14} />
              Most B2Bs By Team
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
          </div>
          <div className="space-y-1.5">
            {ranked.map((r) => {
              const total = r.played + r.upcoming;
              const pct = (total / maxCount) * 100;
              const winPct = r.pastB2bGames > 0 ? (r.pastB2bWins / r.pastB2bGames) * 100 : null;
              return (
                <Link
                  key={r.team}
                  href={`/team/${r.team}`}
                  className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
                >
                  <Image src={`https://cdn.nba.com/logos/nba/${r.teamId}/global/L/logo.svg`} alt={r.team} width={32} height={32} unoptimized />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold font-mono group-hover:text-accent transition-colors">{r.team}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                      <span className="tabular-nums">{r.played}</span> played · <span className="tabular-nums">{r.upcoming}</span> upcoming
                      {winPct !== null && <> · <span className="tabular-nums">{winPct.toFixed(0)}%</span> on B2Bs</>}
                    </p>
                    <div className="h-1 bg-bg-hover rounded-full overflow-hidden mt-1.5">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xl font-light font-mono tabular-nums text-accent shrink-0">{total}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
              <Repeat size={14} className="text-accent-amber" />
              Upcoming B2Bs
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{future.length} ahead</span>
          </div>
          <div className="space-y-1.5">
            {future.length === 0 ? (
              <div className="glass-tile p-4 text-center text-xs font-mono text-text-secondary">
                No upcoming back-to-backs detected
              </div>
            ) : future.map((ins, i) => (
              <div key={`${ins.teamTricode}-${ins.dates[0]}-${i}`} className="glass-tile p-3 flex items-center gap-3">
                <Image src={`https://cdn.nba.com/logos/nba/${ins.teamId}/global/L/logo.svg`} alt={ins.teamTricode} width={32} height={32} unoptimized />
                <Link href={`/team/${ins.teamTricode}`} className="text-sm font-bold font-mono hover:text-accent transition-colors shrink-0">
                  {ins.teamTricode}
                </Link>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Link href={`/game/${ins.game1Id}`} className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors">
                    {fmtDate(ins.dates[0])}
                  </Link>
                  <span className="text-text-secondary/40">→</span>
                  <Link href={`/game/${ins.game2Id}`} className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors">
                    {fmtDate(ins.dates[1])}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Method</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          A back-to-back is any pair of games scheduled on consecutive calendar days. The NBA has progressively reduced
          B2Bs to manage player workload — historically tied to lower win rates on the second night, especially when
          traveling between cities.
        </p>
      </div>
    </div>
  );
}
