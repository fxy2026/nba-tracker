// Server-only boundary: node:crypto prevents this archive from entering client bundles.
// Visitor reads validate bundled, reviewed records without any provider requests.
import { createHash } from "node:crypto";
import game1 from "@/data/official-period-scores/0042500401.json";
import game2 from "@/data/official-period-scores/0042500402.json";
import game3 from "@/data/official-period-scores/0042500403.json";
import game4 from "@/data/official-period-scores/0042500404.json";
import game5 from "@/data/official-period-scores/0042500405.json";
import { validateOfficialPeriodScores, type OfficialPeriodScores, type PeriodScoreGameIdentity } from "./official-period-score-validation";

// Only these five source-reviewed Finals may use this archive. Changing a
// record requires reviewing its evidence and explicitly replacing its hash.
const archives: Record<string, { raw: unknown; sha256: string }> = {
  "0042500401": { raw: game1, sha256: "460924c8d23e36bbefc0da6f76078076967e85a8cd2a2e047a2dbb165dc1950f" },
  "0042500402": { raw: game2, sha256: "7d1c44301e9133f8a76211b3e84a53b7f4723a07657665e6dba244ff4fdb847d" },
  "0042500403": { raw: game3, sha256: "04784e0c129669349592d38ac9fb15fd6b6fec5fe14ae580a8499732459ac80b" },
  "0042500404": { raw: game4, sha256: "f3f4ada88a14fa98b061c248d1ddf70049ef2984a2813db2149f4507ce8b6ae8" },
  "0042500405": { raw: game5, sha256: "244a7f8c08416df1f34db176d949ff94005fca14608d861ff29c76d9c9a32b26" },
};

export function validateReviewedPeriodScores(raw: unknown, game: PeriodScoreGameIdentity, reviewedHash: string): OfficialPeriodScores | null {
  try {
    const encoded = JSON.stringify(raw);
    if (typeof encoded !== "string" || createHash("sha256").update(encoded).digest("hex") !== reviewedHash) return null;
    return validateOfficialPeriodScores(raw, game);
  } catch { return null; }
}

export function getOfficialPeriodScores(game: PeriodScoreGameIdentity): OfficialPeriodScores | null {
  if (game.gameStatus !== 3 || !Object.hasOwn(archives, game.gameId)) return null;
  const archive = archives[game.gameId];
  return validateReviewedPeriodScores(archive.raw, game, archive.sha256);
}
