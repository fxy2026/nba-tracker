import { getSeasonRank } from "@/lib/season-ranks";
import type { Translations } from "@/locales";

// Only surface ranks within top 10 — past that "the 47th-closest game" is noise.
const RANK_THRESHOLD = 10;

export default async function SeasonRankBadge({ gameId, t }: { gameId: string; t: Translations }) {
  const seasonRank = await getSeasonRank(gameId).catch(() => null);
  if (!seasonRank) return null;

  // Pick at most two notable ranks. A close game can't also be a blowout, so
  // those two are mutually exclusive by construction; scoring rank is orthogonal.
  type Badge = { kind: "scoring" | "blowout" | "close"; rank: number; tone: string };
  const badges: Badge[] = [];
  if (seasonRank.totalPointsRank <= RANK_THRESHOLD) {
    badges.push({ kind: "scoring", rank: seasonRank.totalPointsRank, tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  }
  if (seasonRank.marginRank <= RANK_THRESHOLD) {
    badges.push({ kind: "blowout", rank: seasonRank.marginRank, tone: "bg-danger/10 text-danger border-danger/30" });
  } else if (seasonRank.closeRank <= RANK_THRESHOLD) {
    badges.push({ kind: "close", rank: seasonRank.closeRank, tone: "bg-success/10 text-success border-success/30" });
  }
  if (badges.length === 0) return null;

  const badgeLabel = (kind: Badge["kind"]) =>
    kind === "scoring" ? t.gameDetail.seasonRankScoring
      : kind === "blowout" ? t.gameDetail.seasonRankBlowout
      : t.gameDetail.seasonRankClose;

  return (
    <>
      {badges.map((b) => (
        <div
          key={b.kind}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${b.tone}`}
        >
          <span className="font-bold tabular-nums">#{b.rank}</span>
          <span>{badgeLabel(b.kind)} {t.gameDetail.seasonRankOf}</span>
        </div>
      ))}
    </>
  );
}
