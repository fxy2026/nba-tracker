import type { ReactNode } from "react";
import { getTodayScoreboard, type ScheduleGame } from "@/lib/api";
import HomeClient from "./HomeClient";

interface Props {
  initialDate: string;
  initialIsToday: boolean;
  afterGames?: ReactNode;
}

// Only ET-today uses the small live scoreboard. Dated views still leave the
// full schedule to the client, and timezone correction stays in HomeClient.
// This component suspends independently of the homepage's search/static shell.
export default async function HomeGames({ initialDate, initialIsToday, afterGames }: Props) {
  let initialGames: ScheduleGame[] | undefined;
  if (initialIsToday) {
    try {
      const liveGames = await getTodayScoreboard();
      // Failure or an empty response must not manufacture a verified empty day.
      // Preserve the existing client fetch/skeleton when no SSR rows are known.
      if (liveGames.length > 0) initialGames = liveGames.map(g => ({
        gameId: g.gameId,
        gameCode: g.gameCode,
        gameStatus: g.gameStatus,
        gameStatusText: g.gameStatusText,
        gameDateTimeUTC: g.gameTimeUTC,
        homeTeam: { ...g.homeTeam, teamSlug: "" },
        awayTeam: { ...g.awayTeam, teamSlug: "" },
        seriesText: g.seriesText,
        gameLeaders: g.gameLeaders,
      }));
    } catch { /* Client fetch remains the fallback, never a fabricated empty day. */ }
  }
  return <HomeClient initialDate={initialDate} initialIsToday={initialIsToday} initialGames={initialGames} afterGames={afterGames} />;
}

export function HomeGamesLoading({ locale }: { locale: "en" | "zh" }) {
  return <div role="status" aria-busy="true">
    <span className="sr-only">{locale === "zh" ? "正在加载比赛…" : "Loading games…"}</span>
    <div aria-hidden="true">
      <div className="mx-auto mt-4 h-14 max-w-md rounded-lg skeleton-shimmer" />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[180px] rounded-xl border border-border skeleton-shimmer" />)}
      </div>
    </div>
  </div>;
}
