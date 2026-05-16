import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Rookie Watch",
  description: "Top performing rookies and sophomores this season — ranked by per-game scoring.",
};

export const revalidate = 600;

interface RookieRow {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  college: string;
  country: string;
  pts: number;
  reb: number;
  ast: number;
  composite: number;
}

function scoreRookie(p: { pts: number; reb: number; ast: number }) {
  return p.pts + p.reb * 1.2 + p.ast * 1.5;
}

function classify(players: { fromYear: string; toYear: string }[]): { rookieYear: string | null; sophomoreYear: string | null } {
  // Find the most common max toYear — that's likely the current season
  const maxTo = players.reduce((m, p) => {
    const t = parseInt(p.toYear || "0");
    return t > m ? t : m;
  }, 0);
  if (!maxTo) return { rookieYear: null, sophomoreYear: null };
  return { rookieYear: String(maxTo), sophomoreYear: String(maxTo - 1) };
}

function Card({ p, rank }: { p: RookieRow; rank: number }) {
  const isTop3 = rank < 3;
  const medalBg = rank === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
    : rank === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
    : rank === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
    : "bg-bg-hover text-text-secondary";

  return (
    <Link
      href={`/player/${p.personId}`}
      className={`glass-tile p-3 flex items-center gap-3 group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
    >
      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
        {rank + 1}
      </span>
      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
          {p.firstName} {p.lastName}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          {p.teamAbbr || "—"}
          {p.draftYear && p.draftNumber && (
            <> · #<span className="tabular-nums">{p.draftNumber}</span> in <span className="tabular-nums">{p.draftYear}</span></>
          )}
          {p.college && <> · {p.college}</>}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">PPG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-primary">{p.pts.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">RPG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{p.reb.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">APG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{p.ast.toFixed(1)}</p>
        </div>
      </div>
      <div className="flex sm:hidden flex-col items-end shrink-0">
        <span className="text-base font-light font-mono tabular-nums text-accent-amber">{p.pts.toFixed(1)}</span>
        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">ppg</span>
      </div>
    </Link>
  );
}

export default async function RookieWatchPage() {
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Players" icon={Sparkles} title="Rookie Watch" />
        <EmptyState icon={Sparkles} title="No data" description="Could not load player index." />
      </div>
    );
  }

  const { rookieYear, sophomoreYear } = classify(players);

  const rookies: RookieRow[] = players
    .filter((p) => p.fromYear === rookieYear && p.fromYear === p.toYear && p.pts > 0)
    .map((p) => ({
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      draftYear: p.draftYear,
      draftRound: p.draftRound,
      draftNumber: p.draftNumber,
      college: p.college,
      country: p.country,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      composite: scoreRookie(p),
    }))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 25);

  const sophomores: RookieRow[] = players
    .filter((p) => p.fromYear === sophomoreYear && parseInt(p.toYear) >= parseInt(sophomoreYear || "0") && p.pts > 0)
    .map((p) => ({
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      draftYear: p.draftYear,
      draftRound: p.draftRound,
      draftNumber: p.draftNumber,
      college: p.college,
      country: p.country,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      composite: scoreRookie(p),
    }))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 15);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Players"
        icon={Sparkles}
        title="Rookie Watch"
        subtitle={`Top rookies${rookieYear ? ` (class of ${rookieYear})` : ""} ranked by composite score · PPG + RPG×1.2 + APG×1.5`}
      />

      {rookies.length > 0 ? (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
              <Sparkles size={14} />
              Rookie Ladder
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{rookies.length} ranked</span>
          </div>
          <div className="space-y-2">
            {rookies.map((p, i) => <Card key={p.personId} p={p} rank={i} />)}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No rookies tracked yet"
          description="The player index has not surfaced first-year players for this season."
        />
      )}

      {sophomores.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              Sophomore Class
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{sophomores.length} ranked</span>
          </div>
          <div className="space-y-2">
            {sophomores.map((p, i) => <Card key={p.personId} p={p} rank={i} />)}
          </div>
        </section>
      )}

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Method</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Rookies are players whose <span className="font-mono">fromYear</span> equals the latest season in the index
          and who have played only one season so far. Sophomores started one season earlier and are still active.
          Composite score weights rebounds and assists slightly higher than points to surface well-rounded play.
        </p>
      </div>
    </div>
  );
}
