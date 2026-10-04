import { NextRequest } from "next/server";
import { isAdminRequest, privateAdminJson } from "@/lib/admin-auth";

export interface AdminStats {
  generatedAt: string;
  data: {
    status: "available" | "unavailable";
    source: "bundled-archive";
    recordedSeason: string | null;
    recordedGames: number | null;
    completedRecordedGames: number | null;
    recordedDates: number | null;
    indexedPlayers: number | null;
    playerIndexSeason: string | null;
    playerIndexFetchedAt: string | null;
  };
  environment: { adminConfigured: true; deployment: string };
}

// Operator-only bundled coverage. No live provider, database or traffic reads.
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return privateAdminJson({ error: "Unauthorized" }, 401);
  const results: AdminStats = {
    generatedAt: new Date().toISOString(),
    data: { status: "unavailable", source: "bundled-archive", recordedSeason: null, recordedGames: null, completedRecordedGames: null, recordedDates: null, indexedPlayers: null, playerIndexSeason: null, playerIndexFetchedAt: null },
    environment: { adminConfigured: true, deployment: ["production", "preview", "development"].includes(process.env.VERCEL_ENV ?? "") ? process.env.VERCEL_ENV! : "local" },
  };
  try {
    const { getRecorded2025SeasonSchedule, getBundledPlayerIndexSnapshot } = await import("@/lib/api");
    const schedule = getRecorded2025SeasonSchedule();
    const players = getBundledPlayerIndexSnapshot();
    results.data = {
      status: "available", source: "bundled-archive", recordedSeason: "2025-26",
      recordedGames: schedule.reduce((sum, day) => sum + day.games.length, 0),
      completedRecordedGames: schedule.reduce((sum, day) => sum + day.games.filter(game => game.gameStatus === 3).length, 0),
      recordedDates: schedule.length, indexedPlayers: players.players.length,
      playerIndexSeason: players.provenance.season, playerIndexFetchedAt: players.provenance.retrievedAt,
    };
  } catch { /* Unavailable bundled data is not a measured zero or live outage. */ }
  return privateAdminJson(results);
}
