import { NextRequest, NextResponse } from "next/server";
import { parseTransactionPlayers, classifyTransaction } from "@/lib/transactions";

interface ESPNTransaction {
  date: string;
  team?: { displayName: string; abbreviation: string; logos?: { href?: string }[] };
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
  players: string[];
  kind: string;
  teamLogo: string;
}

const DEFAULT_LIMIT = 150;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=${limit}`,
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
    // Shape guard (batch 1 C11c): an unexpected body must not be cached as "none".
    const items: unknown = data.transactions ?? data.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ transactions: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const transactions: CleanedTransaction[] = (items as ESPNTransaction[]).map((t) => {
      const description = t.description || "";
      return {
        date: t.date || "",
        team: t.team?.displayName || "Unknown",
        teamAbbr: t.team?.abbreviation || "",
        player: t.athletes?.[0]?.displayName || "",
        type: t.type?.text || "Transaction",
        description,
        players: parseTransactionPlayers(description),
        kind: classifyTransaction(description),
        teamLogo: t.team?.logos?.[0]?.href || "",
      };
    });

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
