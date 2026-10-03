import { PLAYER_ALIASES } from "./playerAliases";

/**
 * Existing person-specific aliases sometimes expand only to a short surname.
 * Prefer their intended NBA identity before applying the bounded result cap.
 * These are ranking hints, not new display names or extra Chinese aliases.
 * Every ID/name pair is checked against the official CommonAllPlayers registry
 * by player-alias-identities.test.ts; no name-based identity merge is permitted.
 */
export const PREFERRED_ALIAS_TARGETS: Readonly<Record<string, { id: number; name: string }>> = {
  "antetokounmpo": { id: 203507, name: "Giannis Antetokounmpo" },
  "jokic": { id: 203999, name: "Nikola Jokić" },
  "harden": { id: 201935, name: "James Harden" },
  "durant": { id: 201142, name: "Kevin Durant" },
  "curry": { id: 201939, name: "Stephen Curry" },
  "lillard": { id: 203081, name: "Damian Lillard" },
  "davis": { id: 203076, name: "Anthony Davis" },
  "thompson": { id: 202691, name: "Klay Thompson" },
  "leonard": { id: 202695, name: "Kawhi Leonard" },
  "irving": { id: 202681, name: "Kyrie Irving" },
  "doncic": { id: 1629029, name: "Luka Dončić" },
  "mitchell": { id: 1628378, name: "Donovan Mitchell" },
  "westbrook": { id: 201566, name: "Russell Westbrook" },
  "embiid": { id: 203954, name: "Joel Embiid" },
  "shai": { id: 1628983, name: "Shai Gilgeous-Alexander" },
  "henderson": { id: 1630703, name: "Scoot Henderson" },
  "wembanyama": { id: 1641705, name: "Victor Wembanyama" },
  "holmgren": { id: 1631096, name: "Chet Holmgren" },
  "banchero": { id: 1631094, name: "Paolo Banchero" },
  "malone": { id: 252, name: "Karl Malone" },
  "rodman": { id: 23, name: "Dennis Rodman" },
  "johnson": { id: 77142, name: "Magic Johnson" },
  "iverson": { id: 947, name: "Allen Iverson" },
  "bryant": { id: 977, name: "Kobe Bryant" },
  "o'neal": { id: 406, name: "Shaquille O'Neal" },
  "duncan": { id: 1495, name: "Tim Duncan" },
  "arenas": { id: 2240, name: "Gilbert Arenas" },
  "carter": { id: 1713, name: "Vince Carter" },
  "ginobili": { id: 1938, name: "Manu Ginobili" },
  "garnett": { id: 708, name: "Kevin Garnett" },
  "pierce": { id: 1718, name: "Paul Pierce" },
  "wade": { id: 2548, name: "Dwyane Wade" },
  "stoudemire": { id: 2405, name: "Amar'e Stoudemire" },
  "randolph": { id: 2216, name: "Zach Randolph" },
  "earl smith": { id: 2747, name: "JR Smith" },
  "olajuwon": { id: 165, name: "Hakeem Olajuwon" },
  "robinson": { id: 764, name: "David Robinson" },
  "barkley": { id: 787, name: "Charles Barkley" },
  "marbury": { id: 950, name: "Stephon Marbury" },
  "jianlian": { id: 201146, name: "Yi Jianlian" },
  "lin": { id: 202391, name: "Jeremy Lin" },
  "bol": { id: 76195, name: "Manute Bol" },
  "bogues": { id: 177, name: "Muggsy Bogues" },
  "smits": { id: 22, name: "Rik Smits" },
  "mutombo": { id: 87, name: "Dikembe Mutombo" },
  "diaw": { id: 2564, name: "Boris Diaw" },
  "young": { id: 1629027, name: "Trae Young" },
  "maxey": { id: 1630178, name: "Tyrese Maxey" },
  "haliburton": { id: 1630169, name: "Tyrese Haliburton" },
  "williamson": { id: 1629627, name: "Zion Williamson" },
  "barnes": { id: 1630567, name: "Scottie Barnes" },
  "cunningham": { id: 1630595, name: "Cade Cunningham" },
  "brunson": { id: 1628973, name: "Jalen Brunson" },
  "ayton": { id: 1629028, name: "Deandre Ayton" },
  "barrett": { id: 1629628, name: "RJ Barrett" },
  "deaaron fox": { id: 1628368, name: "De'Aaron Fox" },
  "siakam": { id: 1627783, name: "Pascal Siakam" },
  "vanvleet": { id: 1627832, name: "Fred VanVleet" },
  "nowitzki": { id: 1717, name: "Dirk Nowitzki" },
  "nash": { id: 959, name: "Steve Nash" },
  "stockton": { id: 304, name: "John Stockton" },
  "pippen": { id: 937, name: "Scottie Pippen" },
  "hibbert": { id: 201579, name: "Roy Hibbert" },
  "morant": { id: 1629630, name: "Ja Morant" },
  "tatum": { id: 1628369, name: "Jayson Tatum" },
};

// Literal surnames remain broad queries, even where the legacy alias table
// also has a convenience expansion for a contemporary player.
const GENERIC_SURNAMES = new Set(["bird", "embiid", "mutombo", "diaw", "edwards", "mobley", "ayton", "barrett", "fox", "siakam", "vanvleet", "hibbert"]);

export function preferredAliasPlayerId(normalizedQuery: string): number | null {
  if (GENERIC_SURNAMES.has(normalizedQuery)) return null;
  const exact = PLAYER_ALIASES[normalizedQuery];
  if (exact) return PREFERRED_ALIAS_TARGETS[exact]?.id ?? null;

  // Preserve expandQuery's existing embedded CJK / multiword alias support.
  // Multiple different targets are intentionally unranked: a multi-person
  // query cannot silently choose just one of the people it mentions.
  const tokens = normalizedQuery.split(/\s+/);
  const targets = new Set<string>();
  for (const [alias, target] of Object.entries(PLAYER_ALIASES)) {
    if (GENERIC_SURNAMES.has(alias)) continue;
    const singleAsciiWord = !alias.includes(" ") && /^[\x20-\x7e]+$/.test(alias);
    if (singleAsciiWord ? tokens.includes(alias) : normalizedQuery.includes(alias)) targets.add(target);
  }
  if (targets.size !== 1) return null;
  const target = [...targets][0];
  return PREFERRED_ALIAS_TARGETS[target]?.id ?? null;
}
