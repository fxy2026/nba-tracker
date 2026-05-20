// Career accolade counts keyed by NBA personId. Hand-curated from NBA.com /
// Basketball-Reference. Numbers reflect awards as of the start of the
// 2025-26 season; active players' counts will keep growing.
//
// Why these five categories: they're the trophy chips that drive 90%+ of
// "X vs Y" arguments in NBA discourse — championships, MVPs, Finals MVPs,
// All-Star selections, and All-NBA selections. DPOY left out as a separate
// dataset since most legends in our pool aren't defenders-of-the-year.

export interface PlayerAccolades {
  championships: number;
  mvps: number;
  finalsMvps: number;
  allStars: number;
  allNba: number;
  // Scoring/rebounding/assist titles — combined "stat-leader" badge.
  statTitles?: number;
  // DPOY count — only set on players who have one.
  dpoy?: number;
}

export const PLAYER_ACCOLADES: Record<number, PlayerAccolades> = {
  // ── Retired legends (matched to ALL_TIME_LEADERS personIds) ──
  893: { championships: 6, mvps: 5, finalsMvps: 6, allStars: 14, allNba: 11, statTitles: 10, dpoy: 1 }, // Jordan
  977: { championships: 5, mvps: 1, finalsMvps: 2, allStars: 18, allNba: 15, statTitles: 2 }, // Kobe
  76375: { championships: 2, mvps: 4, finalsMvps: 1, allStars: 13, allNba: 10, statTitles: 11 }, // Wilt
  76003: { championships: 6, mvps: 6, finalsMvps: 2, allStars: 19, allNba: 15 }, // Kareem
  1449: { championships: 3, mvps: 3, finalsMvps: 2, allStars: 12, allNba: 10 }, // Bird
  77142: { championships: 5, mvps: 3, finalsMvps: 3, allStars: 12, allNba: 10 }, // Magic
  252: { championships: 0, mvps: 2, finalsMvps: 0, allStars: 14, allNba: 14 }, // K.Malone
  1495: { championships: 5, mvps: 2, finalsMvps: 3, allStars: 15, allNba: 15 }, // Duncan
  406: { championships: 4, mvps: 1, finalsMvps: 3, allStars: 15, allNba: 14, statTitles: 2 }, // Shaq
  165: { championships: 2, mvps: 1, finalsMvps: 2, allStars: 12, allNba: 12, dpoy: 2 }, // Hakeem
  78049: { championships: 11, mvps: 5, finalsMvps: 0, allStars: 12, allNba: 11 }, // B.Russell
  77506: { championships: 1, mvps: 1, finalsMvps: 0, allStars: 12, allNba: 11 }, // O.Robertson
  78491: { championships: 1, mvps: 0, finalsMvps: 1, allStars: 14, allNba: 12 }, // J.West
  304: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 10, allNba: 11 }, // Stockton
  947: { championships: 0, mvps: 1, finalsMvps: 0, allStars: 11, allNba: 7, statTitles: 4 }, // Iverson
  1717: { championships: 1, mvps: 1, finalsMvps: 1, allStars: 14, allNba: 12 }, // Dirk
  901: { championships: 0, mvps: 1, finalsMvps: 0, allStars: 11, allNba: 11 }, // Barkley
  708: { championships: 1, mvps: 1, finalsMvps: 0, allStars: 15, allNba: 9, dpoy: 1 }, // KG
  76246: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 11, allNba: 10 }, // Baylor
  76681: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 9, allNba: 7, statTitles: 4 }, // Gervin
  77381: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 5, allNba: 4, statTitles: 1 }, // Maravich
  959: { championships: 0, mvps: 2, finalsMvps: 0, allStars: 8, allNba: 7, statTitles: 5 }, // Nash
  2548: { championships: 3, mvps: 0, finalsMvps: 1, allStars: 13, allNba: 8, statTitles: 1 }, // Wade
  2546: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 10, allNba: 6, statTitles: 1 }, // Carmelo
  1713: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 8, allNba: 2 }, // V.Carter
  397: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 5, allNba: 3 }, // R.Miller
  2730: { championships: 1, mvps: 0, finalsMvps: 0, allStars: 8, allNba: 8, dpoy: 3 }, // Howard

  // ── Active superstars ──
  2544: { championships: 4, mvps: 4, finalsMvps: 4, allStars: 21, allNba: 21 }, // LeBron
  201939: { championships: 4, mvps: 2, finalsMvps: 1, allStars: 11, allNba: 11 }, // Curry
  201142: { championships: 2, mvps: 1, finalsMvps: 2, allStars: 15, allNba: 11, statTitles: 4 }, // KD
  203507: { championships: 1, mvps: 2, finalsMvps: 1, allStars: 9, allNba: 8, dpoy: 1 }, // Giannis
  203999: { championships: 1, mvps: 3, finalsMvps: 1, allStars: 7, allNba: 6 }, // Jokić
  1629029: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 6, allNba: 5, statTitles: 1 }, // Luka
  1628369: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 6, allNba: 4 }, // Tatum
  1628378: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 6, allNba: 0 }, // D.Mitchell
  1629027: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 4, allNba: 1 }, // T.Young
  203954: { championships: 0, mvps: 1, finalsMvps: 0, allStars: 7, allNba: 5, statTitles: 2 }, // Embiid
  201935: { championships: 0, mvps: 1, finalsMvps: 0, allStars: 11, allNba: 7, statTitles: 4 }, // Harden
  201566: { championships: 0, mvps: 1, finalsMvps: 0, allStars: 9, allNba: 9, statTitles: 2 }, // Westbrook
  101108: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 12, allNba: 11, statTitles: 5 }, // CP3
  203076: { championships: 1, mvps: 0, finalsMvps: 0, allStars: 11, allNba: 5 }, // A.Davis
  1641705: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 1, allNba: 1 }, // Wemby
  1628983: { championships: 1, mvps: 1, finalsMvps: 1, allStars: 5, allNba: 4, statTitles: 1 }, // SGA
  203081: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 8, allNba: 7 }, // Lillard
  202691: { championships: 4, mvps: 0, finalsMvps: 0, allStars: 5, allNba: 2 }, // Klay
  202695: { championships: 2, mvps: 0, finalsMvps: 2, allStars: 6, allNba: 6, dpoy: 2 }, // Kawhi
  1627759: { championships: 1, mvps: 0, finalsMvps: 1, allStars: 4, allNba: 2 }, // J.Brown
  203903: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 1, allNba: 0 }, // J.Clarkson (6MOY)
};

export function getAccolades(personId: number): PlayerAccolades | null {
  return PLAYER_ACCOLADES[personId] ?? null;
}
