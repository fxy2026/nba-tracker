"use client";

import { useMemo, memo } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { getScoringRuns, getScoringChange, chronologicalActions, readScorePair, type ScorePair } from "@/lib/scoring-runs";
import { describeAction, type PlayAction } from "@/components/PlayByPlay";

interface Props {
  actions: PlayAction[];
}

interface KeyMoment {
  period: number;
  clock: string;
  description: string;
  scoreAway: number;
  scoreHome: number;
  type: "run" | "lead_change" | "clutch" | "swing";
}

// periodLabel moved inline inside component to access translations

function clockToSeconds(clock: string, period: number): number {
  // Format: "PT05M30.00S" or "5:30"
  if (!clock) return 0;
  let minutes = 0, seconds = 0;
  const ptMatch = clock.match(/PT(\d+)M([\d.]+)S/);
  if (ptMatch) {
    minutes = parseInt(ptMatch[1]);
    seconds = parseFloat(ptMatch[2]);
  } else {
    const parts = clock.split(":");
    if (parts.length === 2) {
      minutes = parseInt(parts[0]);
      seconds = parseFloat(parts[1]);
    }
  }
  // Total seconds remaining in game (periods are 12 min each, OT is 5 min)
  const periodLength = period <= 4 ? 720 : 300;
  const elapsedInPeriod = periodLength - (minutes * 60 + seconds);
  const previousPeriods = period <= 4 ? (period - 1) * 720 : (4 * 720) + (period - 5) * 300;
  return previousPeriods + elapsedInPeriod;
}

export default memo(function KeyMoments({ actions }: Props) {
  const { locale, t } = useLocale();
  const isZh = locale === "zh";
  const moments = useMemo(() => {
    if (actions.length === 0) return [];

    const keyMoments: KeyMoment[] = getScoringRuns(actions).map((run) => ({
      period: run.period, clock: run.clock, scoreHome: run.scoreHome, scoreAway: run.scoreAway,
      description: isZh ? `${run.teamTricode} 打出 ${run.points}-0 攻击波` : `${run.teamTricode} goes on a ${run.points}-0 run`,
      type: "run",
    }));

    // Lead changes use paired scores only; unknown values are never zero.
    let prevDiff = 0; // positive = away leads
    let previousScore: ScorePair | null = null;

    for (const action of chronologicalActions(actions)) {
      const score = readScorePair(action);
      if (!score) { prevDiff = 0; previousScore = null; continue; }
      const scoring = previousScore ? getScoringChange(action, previousScore, score) : null;
      if (previousScore && !scoring && (score.scoreHome !== previousScore.scoreHome || score.scoreAway !== previousScore.scoreAway)) prevDiff = 0;
      previousScore = score;
      const { scoreAway, scoreHome } = score;
      const diff = scoreAway - scoreHome; // positive = away leads

      // Lead change: diff sign changes (and previous diff was not 0)
      if (prevDiff !== 0 && diff !== 0 && Math.sign(diff) !== Math.sign(prevDiff)) {
        keyMoments.push({
          period: action.period,
          clock: action.clock,
          description: isZh
            ? `${action.teamTricode} 反超比分${action.description ? ` —— ${describeAction(action, true)}` : ""}`
            : `Lead change! ${action.teamTricode} takes the lead${action.description ? ` - ${action.description}` : ""}`,
          scoreAway,
          scoreHome,
          type: "lead_change",
        });
      }

      // Clutch: shots in final 2 minutes of Q4 or any OT (made shots only)
      if (action.period >= 4 && scoring) {
        const clock = action.clock || "";
        const ptMatch = clock.match(/PT(\d+)M/);
        const minutesLeft = ptMatch ? parseInt(ptMatch[1]) : 99;
        if (minutesLeft < 2) {
          // Only include if game is close (within 5 points)
          if (Math.abs(diff) <= 5) {
            keyMoments.push({
              period: action.period,
              clock: action.clock,
              description: isZh
                ? describeAction(action, true) || `${action.playerNameI} 关键时刻得分`
                : action.description || `${action.playerNameI} scores in the clutch`,
              scoreAway,
              scoreHome,
              type: "clutch",
            });
          }
        }
      }

      if (diff !== 0) prevDiff = diff;
    }

    // Remove duplicates and sort by game time
    const unique = keyMoments.filter((m, idx, arr) => {
      // Remove duplicates with same clock and period
      return idx === arr.findIndex((mm) => mm.period === m.period && mm.clock === m.clock && mm.type === m.type && mm.scoreHome === m.scoreHome && mm.scoreAway === m.scoreAway);
    });

    // Sort by period then clock (descending time remaining = chronological order)
    unique.sort((a, b) => {
      const timeA = clockToSeconds(a.clock, a.period);
      const timeB = clockToSeconds(b.clock, b.period);
      return timeA - timeB;
    });

    return unique.slice(0, 15);
  }, [actions, isZh]);

  if (moments.length === 0) return null;

  const typeColors: Record<string, string> = {
    run: "bg-success/15 text-success border-l-success",
    lead_change: "bg-accent/10 text-accent border-l-accent",
    clutch: "bg-accent-amber/10 text-accent-amber border-l-accent-amber",
    swing: "bg-danger/10 text-danger border-l-danger",
  };

  const counts = { run: 0, clutch: 0, lead_change: 0, swing: 0 };
  for (const m of moments) counts[m.type]++;

  return (
    <div className="glass-tile overflow-hidden mt-6">
      <div className="px-4 py-3 border-b border-border flex items-end justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Highlights</p>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
            <span className="w-1 h-4 bg-accent-amber rounded-full" />
            {t.keyMoments.title}
            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber">{moments.length}</span>
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.1em]">
          {counts.run > 0 && <span className="px-1.5 py-0.5 rounded bg-success/15 text-success font-bold tabular-nums">{counts.run} <span className="font-normal opacity-80">{t.keyMoments.runs}</span></span>}
          {counts.clutch > 0 && <span className="px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-bold tabular-nums">{counts.clutch} <span className="font-normal opacity-80">{t.keyMoments.clutch}</span></span>}
          {counts.lead_change > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-bold tabular-nums">{counts.lead_change} <span className="font-normal opacity-80">{t.keyMoments.leads}</span></span>}
        </div>
      </div>
      <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
        {moments.map((moment, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 ${typeColors[moment.type] || "border-l-border"}`}
          >
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-bg-secondary/60 backdrop-blur-sm text-text-secondary">
              {moment.period <= 4 ? `${t.playByPlayComp.quarter}${moment.period}` : `${t.playByPlayComp.overtime}${moment.period - 4}`}
            </span>
            <span className="shrink-0 text-xs font-mono tabular-nums text-text-secondary w-16">
              {moment.clock?.replace("PT", "").replace("M", ":").replace(/(\d+\.\d+)S/, (_, s) => Math.floor(parseFloat(s)).toString().padStart(2, "0")) || ""}
            </span>
            <p className="flex-1 text-sm text-text-primary">{moment.description}</p>
            <span className="shrink-0 text-xs font-mono tabular-nums text-text-secondary">
              {moment.scoreAway}-{moment.scoreHome}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
