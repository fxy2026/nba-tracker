import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  const games = await getGamesByDate(date);
  return NextResponse.json(
    { data: games },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
