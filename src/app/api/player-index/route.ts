import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/api";

export async function GET() {
  try {
    const data = await getPlayerIndex();
    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load player index" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
