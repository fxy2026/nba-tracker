import { NextRequest, NextResponse } from "next/server";

// Admin stats endpoint — requires auth
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-password");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || authHeader !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Count total replay links
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      const { count } = await supabase.from("replay_links").select("*", { count: "exact", head: true });
      const { data: recentLinks } = await supabase.from("replay_links").select("*").order("created_at", { ascending: false }).limit(5);
      const { data: gameIds } = await supabase.from("replay_links").select("game_id");
      results.replayCount = count || 0;
      results.replayGames = new Set((gameIds || []).map(g => g.game_id)).size;
      results.recentLinks = recentLinks || [];
    }
  } catch { results.replayCount = -1; }

  // 2. Schedule data freshness
  try {
    const { getFullSchedule } = await import("@/lib/api");
    const schedule = await getFullSchedule();
    const totalGames = schedule.reduce((s, d) => s + d.games.length, 0);
    const finishedGames = schedule.reduce((s, d) => s + d.games.filter(g => g.gameStatus === 3).length, 0);
    results.scheduleGames = totalGames;
    results.finishedGames = finishedGames;
    results.scheduleDates = schedule.length;
  } catch { results.scheduleGames = -1; }

  // 3. Player index size
  try {
    const { getPlayerIndex } = await import("@/lib/api");
    const players = await getPlayerIndex();
    results.playerCount = players.length;
    results.activeTeams = new Set(players.map(p => p.teamAbbr)).size;
  } catch { results.playerCount = -1; }

  // 4. Environment check
  results.hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  results.hasAdminPw = !!process.env.ADMIN_PASSWORD;
  results.hasBdlKey = !!process.env.BALLDONTLIE_API_KEY;
  results.nodeEnv = process.env.NODE_ENV;
  results.vercelEnv = process.env.VERCEL_ENV || "local";

  return NextResponse.json(results);
}
