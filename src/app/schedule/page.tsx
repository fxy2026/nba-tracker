import { getFullSchedule, type ScheduleGame } from "@/lib/api";
import GameCard from "@/components/GameCard";

export default async function SchedulePage() {
  const allDates = await getFullSchedule();

  // Find dates with completed/in-progress games, show recent ones
  const today = new Date();
  const todayStr = `${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getDate().toString().padStart(2, "0")}/${today.getFullYear()}`;

  // Get recent 14 days of games
  const recentDates: { dateStr: string; displayDate: string; games: ScheduleGame[] }[] = [];

  for (const gd of allDates) {
    const datePart = gd.gameDate.split(" ")[0]; // "04/25/2026"
    const [month, day, year] = datePart.split("/");
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const diffDays = Math.floor((today.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= -7 && diffDays <= 14 && gd.games.length > 0) {
      recentDates.push({
        dateStr: `${year}-${month}-${day}`,
        displayDate: dateObj.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
        games: gd.games,
      });
    }
  }

  // Sort by date descending (most recent first)
  recentDates.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Recent Schedule</h1>

      {recentDates.length > 0 ? (
        <div className="space-y-8">
          {recentDates.map(({ dateStr, displayDate, games }) => (
            <div key={dateStr} className="schedule-section">
              <h2 className="text-sm font-medium text-text-secondary mb-3 sticky top-16 bg-bg-primary py-2 z-10">
                {displayDate}
                <span className="ml-2 text-xs text-text-secondary/60">
                  ({games.length} games)
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <GameCard key={game.gameId} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
          <p className="text-lg">No games found</p>
        </div>
      )}
    </div>
  );
}
