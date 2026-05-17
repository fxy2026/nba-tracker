import Link from "next/link";
import { Users } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import type { PlayerInfo } from "@/lib/api";
import type { Translations } from "@/locales";

interface TeamRosterProps {
  roster: PlayerInfo[];
  t: Translations;
}

/**
 * Roster section bundle: position-breakdown donut, top-3 scorers strip,
 * and the full sortable-looking stats table. Kept together because all
 * three render off the same `roster` array — splitting would force the
 * page to pass identical data three times.
 */
export default function TeamRoster({ roster, t }: TeamRosterProps) {
  return (
    <>
      {/* Position Breakdown (Feature 2) */}
      {roster.length > 0 && <PositionBreakdown roster={roster} t={t} />}

      {/* Top Scorers */}
      {roster.length >= 3 && (
        <div className="glass-tile p-4 mt-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.topScorers}</h3>
          <div className="grid grid-cols-3 gap-3">
            {roster.slice(0, 3).map((p) => (
              <Link key={p.personId} href={`/player/${p.personId}`} className="flex flex-col items-center gap-2 bg-bg-secondary rounded-lg p-3 hover:bg-bg-hover transition-colors">
                <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={48} />
                <span className="text-sm font-medium text-text-primary text-center">{p.firstName} {p.lastName}</span>
                <span className="text-lg font-bold text-accent">{p.pts} <span className="text-xs text-text-secondary font-normal">PPG</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Roster table */}
      <div className="glass-tile overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <h2 className="font-semibold text-sm">{t.teamPage.roster}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs">
                <th className="text-left py-3 px-4">Player</th>
                <th className="text-center py-3 px-2">#</th>
                <th className="text-center py-3 px-2">Pos</th>
                <th className="text-center py-3 px-2">PPG</th>
                <th className="text-center py-3 px-2">RPG</th>
                <th className="text-center py-3 px-2">APG</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.personId} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="py-2.5 px-4">
                    <Link href={`/player/${p.personId}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={28} />
                      <span className="font-medium text-text-primary">{p.firstName} {p.lastName}</span>
                    </Link>
                  </td>
                  <td className="text-center py-2.5 px-2 text-text-secondary">{p.jersey || "-"}</td>
                  <td className="text-center py-2.5 px-2 text-text-secondary">{p.position || "-"}</td>
                  <td className="text-center py-2.5 px-2 font-medium text-accent">{p.pts}</td>
                  <td className="text-center py-2.5 px-2">{p.reb}</td>
                  <td className="text-center py-2.5 px-2">{p.ast}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/**
 * Mini donut chart of Guard/Forward/Center distribution. Returns null when
 * none of the positions are populated (rare — usually preseason rosters).
 */
function PositionBreakdown({ roster, t }: { roster: PlayerInfo[]; t: Translations }) {
  const posCount: Record<string, number> = { Guard: 0, Forward: 0, Center: 0 };
  for (const p of roster) {
    const pos = (p.position || "").toUpperCase();
    if (pos.includes("G")) posCount["Guard"]++;
    else if (pos.includes("F")) posCount["Forward"]++;
    else if (pos.includes("C")) posCount["Center"]++;
  }
  const total = posCount.Guard + posCount.Forward + posCount.Center;
  if (total === 0) return null;
  const colors = { Guard: "var(--accent)", Forward: "var(--success)", Center: "var(--danger)" };
  const size = 80;
  const cx = size / 2, cy = size / 2, r = 30;
  let currentAngle = -Math.PI / 2;
  const slices: { key: string; path: string; color: string }[] = [];
  for (const [label, count] of Object.entries(posCount)) {
    if (count === 0) continue;
    const angle = (count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(currentAngle + angle);
    const y2 = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    slices.push({
      key: label,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[label as keyof typeof colors],
    });
    currentAngle += angle;
  }
  return (
    <div className="glass-tile p-4 mt-6">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.positionBreakdown}</h3>
      <div className="flex items-center gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map(s => <path key={s.key} d={s.path} fill={s.color} opacity={0.8} />)}
        </svg>
        <div className="flex flex-wrap gap-3">
          {Object.entries(posCount).filter(([,c]) => c > 0).map(([label, count]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[label as keyof typeof colors] }} />
              <span className="text-text-primary font-medium">{label}</span>
              <span className="text-text-secondary">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
