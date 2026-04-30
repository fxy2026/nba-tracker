import { Calendar } from "lucide-react";

export default function SeasonProgress() {
  // 2025-26 NBA season: Oct 21 2025 - Apr 12 2026 (regular season)
  // Playoffs: Apr 18 - June 2026
  const regularStart = new Date("2025-10-21").getTime();
  const regularEnd = new Date("2026-04-12").getTime();
  const playoffsEnd = new Date("2026-06-21").getTime();
  const now = Date.now();

  const isRegularSeason = now >= regularStart && now <= regularEnd;
  const isPlayoffs = now > regularEnd && now <= playoffsEnd;
  const isOffseason = now > playoffsEnd || now < regularStart;

  let progress = 0;
  let label = "";
  let phase: "regular" | "playoffs" | "offseason" = "offseason";

  if (isRegularSeason) {
    progress = ((now - regularStart) / (regularEnd - regularStart)) * 100;
    label = "Regular Season";
    phase = "regular";
  } else if (isPlayoffs) {
    progress = ((now - regularEnd) / (playoffsEnd - regularEnd)) * 100;
    label = "Playoffs";
    phase = "playoffs";
  } else if (isOffseason) {
    progress = 100;
    label = "Offseason";
  }

  progress = Math.min(Math.max(progress, 0), 100);

  // Days remaining in current phase
  let daysLeft = 0;
  if (phase === "regular") {
    daysLeft = Math.ceil((regularEnd - now) / (1000 * 60 * 60 * 24));
  } else if (phase === "playoffs") {
    daysLeft = Math.ceil((playoffsEnd - now) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border p-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase text-text-secondary font-semibold flex items-center gap-1">
          <Calendar size={10} />
          2025-26 Season
        </span>
        <div className="flex items-center gap-2">
          {daysLeft > 0 && (
            <span className="text-[10px] text-text-secondary">{daysLeft}d left</span>
          )}
          <span className={`text-[10px] font-medium ${phase === "playoffs" ? "text-yellow-500" : "text-accent"}`}>
            {label} &middot; {progress.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            phase === "playoffs"
              ? "bg-gradient-to-r from-yellow-500 to-orange-500"
              : "bg-gradient-to-r from-accent to-accent-hover"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
