import { Calendar } from "lucide-react";

export default function SeasonProgress() {
  // 2024-25 NBA season: Oct 22 2024 - Apr 13 2025 (regular season)
  // Playoffs: Apr 19 - June 2025
  const regularStart = new Date("2024-10-22").getTime();
  const regularEnd = new Date("2025-04-13").getTime();
  const playoffsEnd = new Date("2025-06-22").getTime();
  const now = Date.now();

  const isRegularSeason = now >= regularStart && now <= regularEnd;
  const isPlayoffs = now > regularEnd && now <= playoffsEnd;
  const isOffseason = now > playoffsEnd || now < regularStart;

  let progress = 0;
  let label = "";

  if (isRegularSeason) {
    progress = ((now - regularStart) / (regularEnd - regularStart)) * 100;
    label = "Regular Season";
  } else if (isPlayoffs) {
    progress = ((now - regularEnd) / (playoffsEnd - regularEnd)) * 100;
    label = "Playoffs";
  } else if (isOffseason) {
    progress = 100;
    label = "Offseason";
  }

  progress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase text-text-secondary font-semibold flex items-center gap-1">
          <Calendar size={10} />
          2024-25 Season
        </span>
        <span className="text-[10px] text-accent font-medium">{label} &middot; {progress.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all bg-gradient-to-r from-accent to-accent-hover"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
