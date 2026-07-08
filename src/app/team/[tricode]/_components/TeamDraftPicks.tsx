import Link from "next/link";
import { projectDraft, espnAbbrToTricode, type DraftPick } from "@/lib/draft";

const DRAFT_YEAR = 2026;

async function getTeamPicks(tricode: string): Promise<DraftPick[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft?year=${DRAFT_YEAR}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    if (typeof json !== "object" || json === null || !Array.isArray((json as { picks?: unknown }).picks)) return [];
    return projectDraft(json).filter((p) => espnAbbrToTricode(p.teamAbbr) === tricode);
  } catch {
    return [];
  }
}

export default async function TeamDraftPicks({ tricode, isZh }: { tricode: string; isZh: boolean }) {
  const picks = await getTeamPicks(tricode);
  if (picks.length === 0) return null;
  picks.sort((a, b) => a.overall - b.overall);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
          / {isZh ? "2026 选秀" : "2026 Draft Picks"}
        </h3>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-wrap gap-2">
        {picks.map((p) => (
          <Link
            key={p.overall}
            href="/draft/2026"
            className="glass-tile px-3 py-2 text-xs cursor-pointer hover:border-accent/40 transition-colors group inline-flex items-center gap-2"
          >
            <span className="font-mono tabular-nums text-accent">#{p.overall}</span>
            <span className="text-text-primary font-medium">{p.playerName || (isZh ? "待定" : "TBD")}</span>
            {p.position && <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{p.position}</span>}
            {p.college && <span className="text-text-secondary">{p.college}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
