import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    const games = await getGamesByDate(date);
    return NextResponse.json(
      { data: games },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
