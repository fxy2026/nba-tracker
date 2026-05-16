import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Conference Race",
  description: "Eastern and Western conference playoff seeding race — who's in, who's on the bubble, who's headed to the lottery.",
};

export const revalidate = 600;

interface TeamRec {
  tricode: string;
  teamId: number;
  wins: number;
  losses: number;
  pct: number;
  conference: "East" | "West";
}

async function computeStandings(): Promise<TeamRec[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const records = new Map<string, { tricode: string; teamId: number; wins: number; losses: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!g.gameId.startsWith("002")) continue;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const push = (tri: string, teamId: number, won: boolean) => {
        const r = records.get(tri) || { tricode: tri, teamId, wins: 0, losses: 0 };
        if (won) r.wins++; else r.losses++;
        records.set(tri, r);
      };
      push(g.homeTeam.teamTricode, g.homeTeam.teamId, homeWon);
      push(g.awayTeam.teamTricode, g.awayTeam.teamId, !homeWon);
    }
  }

  const out: TeamRec[] = [];
  for (const r of records.values()) {
    const meta = TEAM_META[r.tricode];
    if (!meta) continue;
    const pct = r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0;
    out.push({ ...r, pct, conference: meta.conference as "East" | "West" });
  }

  // Add any missing teams as zero
  for (const meta of Object.values(TEAM_META)) {
    if (!out.find((o) => o.tricode === meta.tricode)) {
      out.push({ tricode: meta.tricode, teamId: meta.teamId, wins: 0, losses: 0, pct: 0, conference: meta.conference as "East" | "West" });
    }
  }
  return out;
}

function Row({ team, seed }: { team: TeamRec; seed: number }) {
  let category: { label: string; color: string; bg: string };
  if (seed <= 6) category = { label: `${seed}`, color: "#22C55E", bg: "bg-success/10" };
  else if (seed <= 10) category = { label: `${seed}`, color: "#F59E0B", bg: "bg-accent-amber/10" };
  else category = { label: `${seed}`, color: "#94A3B8", bg: "bg-bg-hover" };

  return (
    <Link
      href={`/team/${team.tricode}`}
      className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
    >
      <span
        className="w-9 h-9 flex items-center justify-center rounded-xl text-base font-bold font-mono tabular-nums shrink-0"
        style={{
          background: `${category.color}22`,
          color: category.color,
          boxShadow: `inset 0 0 0 1px ${category.color}55`,
        }}
      >
        {category.label}
      </span>
      <Image
        src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
        alt={team.tricode} width={36} height={36} unoptimized
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">
          {team.tricode}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          <span className="tabular-nums">{team.wins}</span>-<span className="tabular-nums">{team.losses}</span> · <span className="tabular-nums">{(team.pct * 100).toFixed(1)}%</span>
        </p>
      </div>
      <div className="hidden sm:block w-32 h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${team.pct * 100}%`, background: category.color }}
        />
      </div>
    </Link>
  );
}

function ConfPanel({ teams, eyebrow, title, color }: { teams: TeamRec[]; eyebrow: string; title: string; color: string }) {
  const playoff = teams.slice(0, 6);
  const playIn = teams.slice(6, 10);
  const lottery = teams.slice(10);

  return (
    <section className="glass-tile p-5 relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1.5 opacity-80" style={{ background: color }} />
      <div className="relative">
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {eyebrow}</p>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color }}>{title}</h2>
        </div>

        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-success mb-2">Playoff Lock · seeds 1-6</p>
          <div className="space-y-1.5">
            {playoff.map((t, i) => <Row key={t.tricode} team={t} seed={i + 1} />)}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber mb-2">Play-In · seeds 7-10</p>
          <div className="space-y-1.5">
            {playIn.map((t, i) => <Row key={t.tricode} team={t} seed={i + 7} />)}
          </div>
        </div>

        {lottery.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary mb-2">Lottery · seeds 11-15</p>
            <div className="space-y-1.5">
              {lottery.map((t, i) => <Row key={t.tricode} team={t} seed={i + 11} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ConferenceRacePage() {
  const all = await computeStandings();

  if (all.length === 0 || all.every((t) => t.wins + t.losses === 0)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow="League" icon={Trophy} title="Conference Race" />
        <EmptyState icon={Trophy} title="No data" description="Conference race will populate once the season has produced finished games." />
      </div>
    );
  }

  const east = all.filter((t) => t.conference === "East").sort((a, b) => b.pct - a.pct || b.wins - a.wins);
  const west = all.filter((t) => t.conference === "West").sort((a, b) => b.pct - a.pct || b.wins - a.wins);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="League"
        icon={Trophy}
        title="Conference Race"
        subtitle="Playoff seeding race — 1-6 locked in, 7-10 in the play-in tournament, 11-15 lottery bound"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ConfPanel teams={east} eyebrow="East" title="Eastern Conference" color="#3B82F6" />
        <ConfPanel teams={west} eyebrow="West" title="Western Conference" color="#F59E0B" />
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Format</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          The top six seeds in each conference clinch a playoff berth outright. Seeds 7–10 enter the play-in tournament,
          fighting for the final two playoff spots. The remaining teams head to the draft lottery, with worse records
          generally yielding better odds at a top-4 pick.
        </p>
      </div>
    </div>
  );
}
