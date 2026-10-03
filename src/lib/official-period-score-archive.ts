// Server-only boundary: node:crypto prevents this archive from entering client bundles.
// Visitor reads validate bundled, reviewed records without any provider requests.
import { createHash } from "node:crypto";
import game0 from "@/data/official-period-scores/0022500340.json";
import game1 from "@/data/official-period-scores/0022500961.json";
import game2 from "@/data/official-period-scores/0042500101.json";
import game3 from "@/data/official-period-scores/0042500102.json";
import game4 from "@/data/official-period-scores/0042500103.json";
import game5 from "@/data/official-period-scores/0042500104.json";
import game6 from "@/data/official-period-scores/0042500105.json";
import game7 from "@/data/official-period-scores/0042500106.json";
import game8 from "@/data/official-period-scores/0042500107.json";
import game9 from "@/data/official-period-scores/0042500111.json";
import game10 from "@/data/official-period-scores/0042500112.json";
import game11 from "@/data/official-period-scores/0042500113.json";
import game12 from "@/data/official-period-scores/0042500114.json";
import game13 from "@/data/official-period-scores/0042500115.json";
import game14 from "@/data/official-period-scores/0042500116.json";
import game15 from "@/data/official-period-scores/0042500117.json";
import game16 from "@/data/official-period-scores/0042500121.json";
import game17 from "@/data/official-period-scores/0042500122.json";
import game18 from "@/data/official-period-scores/0042500123.json";
import game19 from "@/data/official-period-scores/0042500124.json";
import game20 from "@/data/official-period-scores/0042500125.json";
import game21 from "@/data/official-period-scores/0042500126.json";
import game22 from "@/data/official-period-scores/0042500131.json";
import game23 from "@/data/official-period-scores/0042500132.json";
import game24 from "@/data/official-period-scores/0042500133.json";
import game25 from "@/data/official-period-scores/0042500134.json";
import game26 from "@/data/official-period-scores/0042500135.json";
import game27 from "@/data/official-period-scores/0042500136.json";
import game28 from "@/data/official-period-scores/0042500137.json";
import game29 from "@/data/official-period-scores/0042500141.json";
import game30 from "@/data/official-period-scores/0042500142.json";
import game31 from "@/data/official-period-scores/0042500143.json";
import game32 from "@/data/official-period-scores/0042500144.json";
import game33 from "@/data/official-period-scores/0042500151.json";
import game34 from "@/data/official-period-scores/0042500152.json";
import game35 from "@/data/official-period-scores/0042500153.json";
import game36 from "@/data/official-period-scores/0042500154.json";
import game37 from "@/data/official-period-scores/0042500155.json";
import game38 from "@/data/official-period-scores/0042500161.json";
import game39 from "@/data/official-period-scores/0042500162.json";
import game40 from "@/data/official-period-scores/0042500163.json";
import game41 from "@/data/official-period-scores/0042500164.json";
import game42 from "@/data/official-period-scores/0042500165.json";
import game43 from "@/data/official-period-scores/0042500166.json";
import game44 from "@/data/official-period-scores/0042500171.json";
import game45 from "@/data/official-period-scores/0042500172.json";
import game46 from "@/data/official-period-scores/0042500173.json";
import game47 from "@/data/official-period-scores/0042500174.json";
import game48 from "@/data/official-period-scores/0042500175.json";
import game49 from "@/data/official-period-scores/0042500176.json";
import game50 from "@/data/official-period-scores/0042500201.json";
import game51 from "@/data/official-period-scores/0042500202.json";
import game52 from "@/data/official-period-scores/0042500203.json";
import game53 from "@/data/official-period-scores/0042500204.json";
import game54 from "@/data/official-period-scores/0042500205.json";
import game55 from "@/data/official-period-scores/0042500206.json";
import game56 from "@/data/official-period-scores/0042500207.json";
import game57 from "@/data/official-period-scores/0042500211.json";
import game58 from "@/data/official-period-scores/0042500212.json";
import game59 from "@/data/official-period-scores/0042500213.json";
import game60 from "@/data/official-period-scores/0042500214.json";
import game61 from "@/data/official-period-scores/0042500221.json";
import game62 from "@/data/official-period-scores/0042500222.json";
import game63 from "@/data/official-period-scores/0042500223.json";
import game64 from "@/data/official-period-scores/0042500224.json";
import game65 from "@/data/official-period-scores/0042500231.json";
import game66 from "@/data/official-period-scores/0042500232.json";
import game67 from "@/data/official-period-scores/0042500233.json";
import game68 from "@/data/official-period-scores/0042500234.json";
import game69 from "@/data/official-period-scores/0042500235.json";
import game70 from "@/data/official-period-scores/0042500236.json";
import game71 from "@/data/official-period-scores/0042500301.json";
import game72 from "@/data/official-period-scores/0042500302.json";
import game73 from "@/data/official-period-scores/0042500303.json";
import game74 from "@/data/official-period-scores/0042500304.json";
import game75 from "@/data/official-period-scores/0042500311.json";
import game76 from "@/data/official-period-scores/0042500312.json";
import game77 from "@/data/official-period-scores/0042500313.json";
import game78 from "@/data/official-period-scores/0042500314.json";
import game79 from "@/data/official-period-scores/0042500315.json";
import game80 from "@/data/official-period-scores/0042500316.json";
import game81 from "@/data/official-period-scores/0042500317.json";
import game82 from "@/data/official-period-scores/0042500401.json";
import game83 from "@/data/official-period-scores/0042500402.json";
import game84 from "@/data/official-period-scores/0042500403.json";
import game85 from "@/data/official-period-scores/0042500404.json";
import game86 from "@/data/official-period-scores/0042500405.json";
import manifest from "@/data/official-period-scores-manifest.json";
import { validateOfficialPeriodScores, type OfficialPeriodScores, type PeriodScoreGameIdentity } from "./official-period-score-validation";

// Only these 87 source-reviewed games may use this archive. Both canonical
// identity and each parsed record's SHA-256 are pinned in the reviewed manifest.
const archives: Record<string, unknown> = {
  "0022500340": game0,
  "0022500961": game1,
  "0042500101": game2,
  "0042500102": game3,
  "0042500103": game4,
  "0042500104": game5,
  "0042500105": game6,
  "0042500106": game7,
  "0042500107": game8,
  "0042500111": game9,
  "0042500112": game10,
  "0042500113": game11,
  "0042500114": game12,
  "0042500115": game13,
  "0042500116": game14,
  "0042500117": game15,
  "0042500121": game16,
  "0042500122": game17,
  "0042500123": game18,
  "0042500124": game19,
  "0042500125": game20,
  "0042500126": game21,
  "0042500131": game22,
  "0042500132": game23,
  "0042500133": game24,
  "0042500134": game25,
  "0042500135": game26,
  "0042500136": game27,
  "0042500137": game28,
  "0042500141": game29,
  "0042500142": game30,
  "0042500143": game31,
  "0042500144": game32,
  "0042500151": game33,
  "0042500152": game34,
  "0042500153": game35,
  "0042500154": game36,
  "0042500155": game37,
  "0042500161": game38,
  "0042500162": game39,
  "0042500163": game40,
  "0042500164": game41,
  "0042500165": game42,
  "0042500166": game43,
  "0042500171": game44,
  "0042500172": game45,
  "0042500173": game46,
  "0042500174": game47,
  "0042500175": game48,
  "0042500176": game49,
  "0042500201": game50,
  "0042500202": game51,
  "0042500203": game52,
  "0042500204": game53,
  "0042500205": game54,
  "0042500206": game55,
  "0042500207": game56,
  "0042500211": game57,
  "0042500212": game58,
  "0042500213": game59,
  "0042500214": game60,
  "0042500221": game61,
  "0042500222": game62,
  "0042500223": game63,
  "0042500224": game64,
  "0042500231": game65,
  "0042500232": game66,
  "0042500233": game67,
  "0042500234": game68,
  "0042500235": game69,
  "0042500236": game70,
  "0042500301": game71,
  "0042500302": game72,
  "0042500303": game73,
  "0042500304": game74,
  "0042500311": game75,
  "0042500312": game76,
  "0042500313": game77,
  "0042500314": game78,
  "0042500315": game79,
  "0042500316": game80,
  "0042500317": game81,
  "0042500401": game82,
  "0042500402": game83,
  "0042500403": game84,
  "0042500404": game85,
  "0042500405": game86,
};
const reviewed: Record<string, { recordSha256: string }> = manifest.games;

export function validateReviewedPeriodScores(raw: unknown, game: PeriodScoreGameIdentity, reviewedHash: string): OfficialPeriodScores | null {
  try {
    const encoded = JSON.stringify(raw);
    if (typeof encoded !== "string" || createHash("sha256").update(encoded).digest("hex") !== reviewedHash) return null;
    return validateOfficialPeriodScores(raw, game);
  } catch { return null; }
}

export function getOfficialPeriodScores(game: PeriodScoreGameIdentity): OfficialPeriodScores | null {
  if (!game || game.gameStatus !== 3 || !Object.hasOwn(archives, game.gameId) || !Object.hasOwn(reviewed, game.gameId)) return null;
  return validateReviewedPeriodScores(archives[game.gameId], game, reviewed[game.gameId].recordSha256);
}
