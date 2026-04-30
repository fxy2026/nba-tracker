"use client";

import { useMemo } from "react";

interface PlayAction {
  actionNumber: number;
  clock: string;
  period: number;
  teamTricode: string;
  actionType: string;
  subType: string;
  description: string;
  personId: number;
  playerNameI: string;
  shotResult?: string;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal?: number;
}

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

function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

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

export default function KeyMoments({ actions }: Props) {
  const moments = useMemo(() => {
    if (actions.length === 0) return [];

    const keyMoments: KeyMoment[] = [];

    // Track scoring for runs and lead changes
    let prevDiff = 0; // positive = away leads
    let runTeam = "";
    let runPoints = 0;
    let runStartIdx = 0;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const scoreAway = parseInt(action.scoreAway) || 0;
      const scoreHome = parseInt(action.scoreHome) || 0;
      const diff = scoreAway - scoreHome; // positive = away leads

      // Skip actions without score
      if (!action.scoreAway && !action.scoreHome) continue;

      // Lead change: diff sign changes (and previous diff was not 0)
      if (prevDiff !== 0 && diff !== 0 && Math.sign(diff) !== Math.sign(prevDiff)) {
        keyMoments.push({
          period: action.period,
          clock: action.clock,
          description: `Lead change! ${action.teamTricode} takes the lead${action.description ? ` - ${action.description}` : ""}`,
          scoreAway,
          scoreHome,
          type: "lead_change",
        });
      }

      // Scoring runs: track consecutive scoring by one team
      if (action.isFieldGoal || action.actionType === "freethrow") {
        if (action.teamTricode === runTeam) {
          runPoints += (scoreAway + scoreHome) - (parseInt(actions[runStartIdx]?.scoreAway) || 0) - (parseInt(actions[runStartIdx]?.scoreHome) || 0);
        } else {
          // Check if previous run was significant (8+ unanswered)
          if (runPoints >= 8 && runTeam) {
            const startAction = actions[runStartIdx];
            keyMoments.push({
              period: startAction?.period || action.period,
              clock: startAction?.clock || action.clock,
              description: `${runTeam} goes on a ${runPoints}-0 run`,
              scoreAway: parseInt(actions[i - 1]?.scoreAway) || scoreAway,
              scoreHome: parseInt(actions[i - 1]?.scoreHome) || scoreHome,
              type: "run",
            });
          }
          runTeam = action.teamTricode;
          runPoints = 0;
          runStartIdx = i;
        }
      }

      // Clutch: shots in final 2 minutes of Q4 or any OT (made shots only)
      if ((action.period === 4 || action.period > 4) && action.shotResult === "Made") {
        const clock = action.clock || "";
        const ptMatch = clock.match(/PT(\d+)M/);
        const minutesLeft = ptMatch ? parseInt(ptMatch[1]) : 99;
        if (minutesLeft < 2) {
          // Only include if game is close (within 5 points)
          if (Math.abs(diff) <= 5) {
            keyMoments.push({
              period: action.period,
              clock: action.clock,
              description: action.description || `${action.playerNameI} scores in the clutch`,
              scoreAway,
              scoreHome,
              type: "clutch",
            });
          }
        }
      }

      if (diff !== 0) prevDiff = diff;
    }

    // Check final run
    if (runPoints >= 8 && runTeam) {
      const startAction = actions[runStartIdx];
      keyMoments.push({
        period: startAction?.period || 1,
        clock: startAction?.clock || "",
        description: `${runTeam} goes on a ${runPoints}-0 run`,
        scoreAway: parseInt(actions[actions.length - 1]?.scoreAway) || 0,
        scoreHome: parseInt(actions[actions.length - 1]?.scoreHome) || 0,
        type: "run",
      });
    }

    // Remove duplicates and sort by game time
    const unique = keyMoments.filter((m, idx, arr) => {
      // Remove duplicates with same clock and period
      return idx === arr.findIndex((mm) => mm.period === m.period && mm.clock === m.clock && mm.type === m.type);
    });

    // Sort by period then clock (descending time remaining = chronological order)
    unique.sort((a, b) => {
      const timeA = clockToSeconds(a.clock, a.period);
      const timeB = clockToSeconds(b.clock, b.period);
      return timeA - timeB;
    });

    return unique.slice(0, 15);
  }, [actions]);

  if (moments.length === 0) return null;

  const typeColors: Record<string, string> = {
    run: "bg-success/15 text-success border-l-success",
    lead_change: "bg-accent/10 text-accent border-l-accent",
    clutch: "bg-yellow-500/10 text-yellow-400 border-l-yellow-500",
    swing: "bg-danger/10 text-danger border-l-danger",
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden mt-6">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-1 h-4 bg-accent rounded-full" />
          Key Moments
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{moments.length}</span>
        </h3>
        <div className="flex items-center gap-2 text-[9px]">
          {moments.filter(m => m.type === "run").length > 0 && <span className="px-1.5 py-0.5 rounded bg-success/15 text-success">{moments.filter(m => m.type === "run").length} runs</span>}
          {moments.filter(m => m.type === "clutch").length > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">{moments.filter(m => m.type === "clutch").length} clutch</span>}
          {moments.filter(m => m.type === "lead_change").length > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">{moments.filter(m => m.type === "lead_change").length} leads</span>}
        </div>
      </div>
      <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
        {moments.map((moment, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 ${typeColors[moment.type] || "border-l-border"}`}
          >
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary">
              {periodLabel(moment.period)}
            </span>
            <span className="shrink-0 text-xs font-mono text-text-secondary w-16">
              {moment.clock?.replace("PT", "").replace("M", ":").replace(/(\d+\.\d+)S/, (_, s) => Math.floor(parseFloat(s)).toString().padStart(2, "0")) || ""}
            </span>
            <p className="flex-1 text-sm text-text-primary">{moment.description}</p>
            <span className="shrink-0 text-xs font-mono text-text-secondary tabular-nums">
              {moment.scoreAway}-{moment.scoreHome}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
