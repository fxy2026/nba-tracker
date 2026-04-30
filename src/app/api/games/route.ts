import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    const games = await getGamesByDate(date);

    // Smart caching: past dates cache longer, today shorter for live updates
    const today = new Date().toISOString().split("T")[0];
    const cacheControl = date < today
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : date > today
      ? "public, s-maxage=300, stale-while-revalidate=3600"
      : "public, s-maxage=30, stale-while-revalidate=120";

    return NextResponse.json(
      { data: games },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
