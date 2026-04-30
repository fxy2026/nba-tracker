"use client";

import { useState, useMemo } from "react";

function formatClock(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return raw;
  const min = parseInt(match[1]);
  const sec = Math.floor(parseFloat(match[2]));
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

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

export default function PlayByPlay({ actions }: Props) {
  const periods = useMemo(() => {
    const ps = [...new Set(actions.map((a) => a.period))].sort((a, b) => a - b);
    return ps;
  }, [actions]);

  const [selectedPeriod, setSelectedPeriod] = useState<number>(periods[periods.length - 1] || 4);

  const filteredActions = useMemo(() => {
    return actions
      .filter((a) => a.period === selectedPeriod && a.description)
      .reverse(); // Most recent first
  }, [actions, selectedPeriod]);

  const getActionStyle = (action: PlayAction) => {
    if (action.shotResult === "Made") return "border-l-success bg-success/5";
    if (action.shotResult === "Missed") return "border-l-danger/50";
    if (action.actionType === "foul") return "border-l-yellow-500/50";
    if (action.actionType === "turnover") return "border-l-danger/30";
    if (action.actionType === "timeout") return "border-l-text-secondary";
    return "border-l-border";
  };

  const getActionIcon = (action: PlayAction) => {
    if (action.shotResult === "Made") return "🏀";
    if (action.actionType === "foul") return "🚫";
    if (action.actionType === "turnover") return "💫";
    if (action.actionType === "timeout") return "⏱";
    if (action.actionType === "substitution") return "🔄";
    if (action.actionType === "rebound") return "📥";
    return "";
  };

  if (actions.length === 0) return null;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-1 h-4 bg-accent rounded-full" />
          Play-by-Play
        </h3>
        <div className="flex rounded-lg overflow-hidden border border-border">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                selectedPeriod === p ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {p <= 4 ? `Q${p}` : `OT${p - 4}`}
              <span className="text-[8px] opacity-60 ml-0.5">
                ({actions.filter((a) => a.period === p && a.description).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
        {filteredActions.map((action) => (
          <div
            key={action.actionNumber}
            className={`flex items-start gap-3 px-4 py-2.5 border-l-2 ${getActionStyle(action)}`}
          >
            <span className="text-xs text-text-secondary font-mono w-12 shrink-0 pt-0.5">
              {formatClock(action.clock)}
            </span>
            <span className="text-sm shrink-0 w-5">{getActionIcon(action)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary">
                {action.teamTricode && (
                  <span className="text-xs font-medium text-accent mr-1.5">{action.teamTricode}</span>
                )}
                {action.description}
              </p>
            </div>
            {action.scoreAway && action.scoreHome && (
              <span className="text-xs font-mono text-text-secondary shrink-0 tabular-nums">
                {action.scoreAway}-{action.scoreHome}
              </span>
            )}
          </div>
        ))}
        {filteredActions.length === 0 && (
          <div className="px-4 py-8 text-center text-text-secondary text-sm">
            No play data for this period
          </div>
        )}
      </div>
    </div>
  );
}
