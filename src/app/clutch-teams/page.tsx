import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Target } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Clutch Teams",
  description: "Which teams thrive in close games — records in games decided by 5 points or fewer and overtime contests.",
};

export const revalidate = 600;

interface ClutchRec {
  tricode: string;
  teamId: number;
  closeW: number;
  closeL: number;
  otW: number;
  otL: number;
  closePct: number;
  otPct: number;
  totalClose: number;
}

async function compute(): Promise<ClutchRec[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, { tricode: string; teamId: number; closeW: number; closeL: number; otW: number; otL: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!g.gameId.startsWith("002")) continue;
      const margin = Math.abs(g.homeTeam.score - g.awayTeam.score);
      const isOT = /ot/i.test(g.gameStatusText || "");
      const isClose = margin <= 5;
      if (!isClose && !isOT) continue;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const upsert = (tri: string, teamId: number, won: boolean) => {
        const r = map.get(tri) || { tricode: tri, teamId, closeW: 0, closeL: 0, otW: 0, otL: 0 };
        if (isClose) { if (won) r.closeW++; else r.closeL++; }
        if (isOT) { if (won) r.otW++; else r.otL++; }
        map.set(tri, r);
      };
      upsert(g.homeTeam.teamTricode, g.homeTeam.teamId, homeWon);
      upsert(g.awayTeam.teamTricode, g.awayTeam.teamId, !homeWon);
    }
  }

  const out: ClutchRec[] = [];
  for (const r of map.values()) {
    const totalClose = r.closeW + r.closeL;
    const closePct = totalClose > 0 ? r.closeW / totalClose : 0;
    const otTotal = r.otW + r.otL;
    const otPct = otTotal > 0 ? r.otW / otTotal : 0;
    out.push({ ...r, closePct, otPct, totalClose });
  }
  for (const meta of Object.values(TEAM_META)) {
    if (!out.find((o) => o.tricode === meta.tricode)) {
      out.push({ tricode: meta.tricode, teamId: meta.teamId, closeW: 0, closeL: 0, otW: 0, otL: 0, closePct: 0, otPct: 0, totalClose: 0 });
    }
  }
  return out;
}

function Row({ r, value, sub, color, rank }: { r: ClutchRec; value: string; sub: string; color: string; rank: number }) {
  return (
    <Link
      href={`/team/${r.tricode}`}
      className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
    >
      <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-mono tabular-nums shrink-0 bg-bg-hover text-text-secondary">
        {rank}
      </span>
      <Image src={`https://cdn.nba.com/logos/nba/${r.teamId}/global/L/logo.svg`} alt={r.tricode} width={32} height={32} unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{r.tricode}</p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{sub}</p>
      </div>
      <span className="text-base font-light font-mono tabular-nums shrink-0" style={{ color }}>{value}</span>
    </Link>
  );
}

export default async function ClutchTeamsPage() {
  const all = await compute();
  const hasData = all.some((r) => r.totalClose > 0 || r.otW + r.otL > 0);

  if (!hasData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Teams" icon={Target} title="Clutch Teams" />
        <EmptyState icon={Target} title="No close games yet" description="Clutch records will populate once games decided by 5 or fewer points exist." />
      </div>
    );
  }

  const closeQualified = all.filter((r) => r.totalClose >= 3);
  const closeBest = [...closeQualified].sort((a, b) => b.closePct - a.closePct || b.totalClose - a.totalClose).slice(0, 10);
  const closeWorst = [...closeQualified].sort((a, b) => a.closePct - b.closePct || b.totalClose - a.totalClose).slice(0, 10);
  const otTotalQualified = all.filter((r) => r.otW + r.otL >= 1).sort((a, b) => b.otPct - a.otPct || (b.otW + b.otL) - (a.otW + a.otL));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Teams"
        icon={Target}
        title="Clutch Teams"
        subtitle="Records in games decided by 5 points or fewer · plus overtime performance"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-success opacity-80" />
          <div className="relative">
            <div className="mb-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Ice Water</p>
              <h2 className="text-xl font-semibold text-success tracking-tight flex items-center gap-2">
                <Target size={18} />
                Best in Close Games
              </h2>
              <p className="text-xs text-text-secondary mt-1">Games decided by ≤5 · min 3 games qualifies</p>
            </div>
            <div className="space-y-1.5">
              {closeBest.map((r, i) => (
                <Row key={r.tricode} r={r} rank={i + 1}
                  value={`${(r.closePct * 100).toFixed(1)}%`}
                  sub={`${r.closeW}-${r.closeL} in close games · ${r.totalClose} total`}
                  color="#22C55E"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-danger opacity-80" />
          <div className="relative">
            <div className="mb-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Choke Point</p>
              <h2 className="text-xl font-semibold text-danger tracking-tight flex items-center gap-2">
                <Target size={18} />
                Worst in Close Games
              </h2>
              <p className="text-xs text-text-secondary mt-1">Teams losing more than their share when games tighten</p>
            </div>
            <div className="space-y-1.5">
              {closeWorst.map((r, i) => (
                <Row key={r.tricode} r={r} rank={i + 1}
                  value={`${(r.closePct * 100).toFixed(1)}%`}
                  sub={`${r.closeW}-${r.closeL} in close games · ${r.totalClose} total`}
                  color="#DF1B41"
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      {otTotalQualified.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
              <Target size={14} className="text-accent-amber" />
              Overtime Specialists
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{otTotalQualified.length} teams with OT experience</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {otTotalQualified.slice(0, 12).map((r) => (
              <Row key={r.tricode} r={r} rank={otTotalQualified.indexOf(r) + 1}
                value={`${(r.otPct * 100).toFixed(0)}%`}
                sub={`${r.otW}-${r.otL} in OT`}
                color="#F59E0B"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
