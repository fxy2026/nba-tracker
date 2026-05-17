import { NextResponse } from "next/server";

interface ESPNTransaction {
  date: string;
  team?: { displayName: string; abbreviation: string };
  athletes?: { displayName: string }[];
  description: string;
  type?: { text: string };
}

interface CleanedTransaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ transactions: [] }, { status: 502 });
    }

    const data = await res.json();
    const items: ESPNTransaction[] = data.transactions || data.items || [];

    const transactions: CleanedTransaction[] = items.slice(0, 30).map((t) => ({
      date: t.date || "",
      team: t.team?.displayName || "Unknown",
      teamAbbr: t.team?.abbreviation || "",
      player: t.athletes?.[0]?.displayName || "",
      type: t.type?.text || "Transaction",
      description: t.description || "",
    }));

    return NextResponse.json(
      { transactions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json({ transactions: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
