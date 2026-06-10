"use client";

import { useEffect, useState } from "react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { useLocale } from "@/components/LocaleProvider";
import type { MatchupsPayload } from "@/app/api/matchups/route";

export interface MatchupScorer {
  personId: number;
  name: string;
  teamTricode: string;
  points: number;
}

// Sub-2-possession pairings are switch noise (a 6-second cross-match), not a
// real defensive assignment.
const MIN_POSSESSIONS = 2;
const DEFENDERS_SHOWN = 3;

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_84px_44px_72px] gap-2";

/**
 * Who guarded the game's top scorers, from NBA player-tracking matchup data
 * (stats.nba.com via /api/matchups). Renders nothing until the payload
 * arrives and hides entirely when the upstream is unreachable or the game has
 * no tracking data — same silent-hide contract as PlayerRankBadges.
 */
export default function MatchupSection({ gameId, scorers }: { gameId: string; scorers: MatchupScorer[] }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [payload, setPayload] = useState<MatchupsPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // /api/matchups aborts upstream at 20s — this only guards a hung proxy.
    const timeout = setTimeout(() => controller.abort(), 25000);
    (async () => {
      try {
        const res = await fetch(`/api/matchups?gameId=${gameId}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: MatchupsPayload = await res.json();
        if (!controller.signal.aborted) setPayload(data);
      } catch {
        /* silent hide — stats.nba.com unreachable or no tracking data */
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [gameId]);

  const rows = scorers
    .map((scorer) => ({
      scorer,
      defenders: (payload?.players?.[String(scorer.personId)] ?? [])
        .filter((d) => d.possessions >= MIN_POSSESSIONS)
        .slice(0, DEFENDERS_SHOWN),
    }))
    .filter((r) => r.defenders.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="glass-tile p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {isZh ? "对位数据" : "Defensive Matchups"}
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
        {rows.map(({ scorer, defenders }) => (
          <div key={scorer.personId}>
            <div className="flex items-center gap-2 mb-2">
              <PlayerHeadshot personId={scorer.personId} name={scorer.name} size={28} />
              <span className="text-sm font-medium text-text-primary">{scorer.name}</span>
              <span className="text-[10px] text-text-secondary">{scorer.teamTricode}</span>
              <span className="ml-auto text-xs font-mono tabular-nums text-text-secondary">
                {scorer.points} {isZh ? "分" : "PTS"}
              </span>
            </div>
            <div className={`${ROW_GRID} px-3 pb-1 text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary`}>
              <span>{isZh ? "对位防守人" : "Defender"}</span>
              <span className="text-right">{isZh ? "时间·回合" : "Time·Poss"}</span>
              <span className="text-right">{isZh ? "被得分" : "Pts"}</span>
              <span className="text-right">{isZh ? "命中率" : "FG"}</span>
            </div>
            <div className="space-y-1">
              {defenders.map((d) => (
                <div key={d.personId} className={`${ROW_GRID} items-center px-3 py-1.5 bg-bg-secondary rounded-lg`}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <PlayerHeadshot personId={d.personId} name={d.name} size={20} />
                    <span className="text-xs text-text-primary truncate">{d.name}</span>
                  </span>
                  <span className="text-right text-[11px] font-mono tabular-nums text-text-secondary">
                    {d.minutes || "—"} · {d.possessions.toFixed(1)}
                  </span>
                  <span className="text-right text-xs font-mono tabular-nums font-medium text-text-primary">
                    {d.points}
                  </span>
                  <span className="text-right text-[11px] font-mono tabular-nums text-text-secondary">
                    {d.fgm}/{d.fga}
                    {d.fga > 0 && ` · ${Math.round((d.fgm / d.fga) * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-text-secondary mt-3">
        {isZh
          ? "对位数据来自 NBA 官方球员追踪：回合为部分回合（换防/包夹按比例计入），各防守人相加可能与全场数据有出入。"
          : "Matchup data from NBA player tracking. Possessions are partial (switches and double-teams count fractionally), so per-defender rows may not sum to full-game totals."}
      </p>
    </div>
  );
}
