// Static NBA all-time career leaders — career stats are NBA-official as of
// the start of the 2025-26 season. Active players' numbers may shift.
//
// Why static: NBA's CDN playerIndex only contains *active* players (missing
// MJ, Kobe, Wilt, Kareem, etc), and its pts/reb/ast fields are LAST-SEASON
// averages — not career averages. stats.nba.com career endpoints are CORS-
// blocked from both browsers and Vercel IPs. So a hardcoded dataset is the
// only reliable way to render a true all-time leaderboard.

export interface AllTimeLeader {
  // Real NBA personId — used for /player/{id} link AND headshot URL.
  // 0 means we don't have a reliable id; render a fallback avatar and no link.
  personId: number;
  name: string;
  fromYear: number;
  toYear: number;     // 2026 for currently-active players
  active: boolean;
  team: string;       // Most-associated team tricode
  // Career per-game averages
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  // Career totals (where notable)
  totalPts?: number;
  totalReb?: number;
  totalAst?: number;
  totalStl?: number;
  totalBlk?: number;
}

// 45 entries: 20 active superstars (with their real NBA personIds) + 25
// retired legends (personId=0). Career averages from NBA-official sources.
export const ALL_TIME_LEADERS: AllTimeLeader[] = [
  // ─── Active superstars (real personIds for headshots + /player linking) ───
  { personId: 2544, name: "LeBron James", fromYear: 2003, toYear: 2026, active: true, team: "LAL",
    ppg: 27.0, rpg: 7.5, apg: 7.5, spg: 1.5, bpg: 0.7,
    totalPts: 42184, totalReb: 11700, totalAst: 11600, totalStl: 2310, totalBlk: 1098 },
  { personId: 201939, name: "Stephen Curry", fromYear: 2009, toYear: 2026, active: true, team: "GSW",
    ppg: 24.8, rpg: 4.7, apg: 6.4, spg: 1.5, bpg: 0.2,
    totalPts: 25500, totalReb: 4800, totalAst: 6600, totalStl: 1560 },
  { personId: 201142, name: "Kevin Durant", fromYear: 2007, toYear: 2026, active: true, team: "PHX",
    ppg: 27.2, rpg: 7.0, apg: 4.4, spg: 1.1, bpg: 1.1,
    totalPts: 30100, totalReb: 7800, totalAst: 4900, totalBlk: 1300 },
  { personId: 203507, name: "Giannis Antetokounmpo", fromYear: 2013, toYear: 2026, active: true, team: "MIL",
    ppg: 23.5, rpg: 9.8, apg: 5.2, spg: 1.1, bpg: 1.3,
    totalPts: 20500, totalReb: 8600, totalAst: 4500, totalBlk: 1130 },
  { personId: 203999, name: "Nikola Jokić", fromYear: 2015, toYear: 2026, active: true, team: "DEN",
    ppg: 21.5, rpg: 10.8, apg: 7.0, spg: 1.3, bpg: 0.7,
    totalPts: 16000, totalReb: 8000, totalAst: 5200 },
  { personId: 1629029, name: "Luka Dončić", fromYear: 2018, toYear: 2026, active: true, team: "DAL",
    ppg: 28.7, rpg: 8.7, apg: 8.4, spg: 1.2, bpg: 0.5,
    totalPts: 11800, totalReb: 3500, totalAst: 3400 },
  { personId: 1628369, name: "Jayson Tatum", fromYear: 2017, toYear: 2026, active: true, team: "BOS",
    ppg: 23.6, rpg: 7.0, apg: 4.0, spg: 1.0, bpg: 0.7 },
  { personId: 1628378, name: "Donovan Mitchell", fromYear: 2017, toYear: 2026, active: true, team: "CLE",
    ppg: 24.0, rpg: 4.0, apg: 4.6 },
  { personId: 1629027, name: "Trae Young", fromYear: 2018, toYear: 2026, active: true, team: "ATL",
    ppg: 25.5, rpg: 3.0, apg: 10.0 },
  { personId: 203954, name: "Joel Embiid", fromYear: 2014, toYear: 2026, active: true, team: "PHI",
    ppg: 27.9, rpg: 11.0, apg: 4.0, spg: 0.9, bpg: 1.6 },
  { personId: 201935, name: "James Harden", fromYear: 2009, toYear: 2026, active: true, team: "LAC",
    ppg: 24.0, rpg: 5.5, apg: 7.3, spg: 1.5,
    totalPts: 27500, totalAst: 8000 },
  { personId: 201566, name: "Russell Westbrook", fromYear: 2008, toYear: 2026, active: true, team: "DEN",
    ppg: 21.4, rpg: 7.0, apg: 8.4, spg: 1.6,
    totalPts: 26000, totalReb: 8200, totalAst: 10300 },
  { personId: 101108, name: "Chris Paul", fromYear: 2005, toYear: 2026, active: true, team: "LAC",
    ppg: 17.4, rpg: 4.5, apg: 9.4, spg: 2.0,
    totalAst: 12000, totalStl: 2600 },
  { personId: 203076, name: "Anthony Davis", fromYear: 2012, toYear: 2026, active: true, team: "LAL",
    ppg: 24.0, rpg: 10.3, apg: 2.4, spg: 1.2, bpg: 2.2 },
  { personId: 1641705, name: "Victor Wembanyama", fromYear: 2023, toYear: 2026, active: true, team: "SAS",
    ppg: 24.0, rpg: 11.0, apg: 4.0, spg: 1.3, bpg: 3.6 },
  { personId: 1628983, name: "Shai Gilgeous-Alexander", fromYear: 2018, toYear: 2026, active: true, team: "OKC",
    ppg: 26.8, rpg: 5.2, apg: 5.8, spg: 1.7 },
  { personId: 203081, name: "Damian Lillard", fromYear: 2012, toYear: 2026, active: true, team: "POR",
    ppg: 25.1, rpg: 4.3, apg: 6.7 },
  { personId: 202691, name: "Klay Thompson", fromYear: 2011, toYear: 2026, active: true, team: "DAL",
    ppg: 19.5, rpg: 3.5, apg: 2.4 },
  { personId: 202695, name: "Kawhi Leonard", fromYear: 2011, toYear: 2026, active: true, team: "LAC",
    ppg: 20.0, rpg: 6.5, apg: 3.4, spg: 1.8 },
  { personId: 1627759, name: "Jaylen Brown", fromYear: 2016, toYear: 2026, active: true, team: "BOS",
    ppg: 20.3, rpg: 5.4, apg: 2.9 },

  // ─── Retired legends — career averages are final ───
  { personId: 0, name: "Michael Jordan", fromYear: 1984, toYear: 2003, active: false, team: "CHI",
    ppg: 30.12, rpg: 6.2, apg: 5.3, spg: 2.3, bpg: 0.8,
    totalPts: 32292, totalReb: 6672, totalAst: 5633, totalStl: 2514 },
  { personId: 0, name: "Kobe Bryant", fromYear: 1996, toYear: 2016, active: false, team: "LAL",
    ppg: 24.99, rpg: 5.2, apg: 4.7, spg: 1.4, bpg: 0.5,
    totalPts: 33643, totalReb: 7047, totalAst: 6306 },
  { personId: 0, name: "Wilt Chamberlain", fromYear: 1959, toYear: 1973, active: false, team: "LAL",
    ppg: 30.07, rpg: 22.9, apg: 4.4,
    totalPts: 31419, totalReb: 23924, totalAst: 4643 },
  { personId: 0, name: "Kareem Abdul-Jabbar", fromYear: 1969, toYear: 1989, active: false, team: "LAL",
    ppg: 24.6, rpg: 11.2, apg: 3.6, spg: 0.9, bpg: 2.6,
    totalPts: 38387, totalReb: 17440, totalAst: 5660, totalBlk: 3189 },
  { personId: 0, name: "Larry Bird", fromYear: 1979, toYear: 1992, active: false, team: "BOS",
    ppg: 24.3, rpg: 10.0, apg: 6.3, spg: 1.7,
    totalPts: 21791, totalReb: 8974, totalAst: 5695 },
  { personId: 0, name: "Magic Johnson", fromYear: 1979, toYear: 1996, active: false, team: "LAL",
    ppg: 19.5, rpg: 7.2, apg: 11.19, spg: 1.9,
    totalPts: 17707, totalReb: 6559, totalAst: 10141 },
  { personId: 0, name: "Karl Malone", fromYear: 1985, toYear: 2004, active: false, team: "UTA",
    ppg: 25.0, rpg: 10.1, apg: 3.6, spg: 1.4, bpg: 0.8,
    totalPts: 36928, totalReb: 14968, totalAst: 5248 },
  { personId: 0, name: "Tim Duncan", fromYear: 1997, toYear: 2016, active: false, team: "SAS",
    ppg: 19.0, rpg: 10.8, apg: 3.0, spg: 0.7, bpg: 2.2,
    totalPts: 26496, totalReb: 15091, totalAst: 4225, totalBlk: 3020 },
  { personId: 0, name: "Shaquille O'Neal", fromYear: 1992, toYear: 2011, active: false, team: "LAL",
    ppg: 23.7, rpg: 10.9, apg: 2.5, bpg: 2.3,
    totalPts: 28596, totalReb: 13099, totalBlk: 2732 },
  { personId: 0, name: "Hakeem Olajuwon", fromYear: 1984, toYear: 2002, active: false, team: "HOU",
    ppg: 21.8, rpg: 11.1, apg: 2.5, spg: 1.7, bpg: 3.1,
    totalPts: 26946, totalReb: 13748, totalBlk: 3830 },
  { personId: 0, name: "Bill Russell", fromYear: 1956, toYear: 1969, active: false, team: "BOS",
    ppg: 15.1, rpg: 22.5, apg: 4.3,
    totalPts: 14522, totalReb: 21620 },
  { personId: 0, name: "Oscar Robertson", fromYear: 1960, toYear: 1974, active: false, team: "MIL",
    ppg: 25.68, rpg: 7.5, apg: 9.51,
    totalPts: 26710, totalReb: 7804, totalAst: 9887 },
  { personId: 0, name: "Jerry West", fromYear: 1960, toYear: 1974, active: false, team: "LAL",
    ppg: 27.03, rpg: 5.8, apg: 6.7,
    totalPts: 25192, totalReb: 5366, totalAst: 6238 },
  { personId: 0, name: "John Stockton", fromYear: 1984, toYear: 2003, active: false, team: "UTA",
    ppg: 13.1, rpg: 2.7, apg: 10.51, spg: 2.2,
    totalPts: 19711, totalAst: 15806, totalStl: 3265 },
  { personId: 0, name: "Allen Iverson", fromYear: 1996, toYear: 2010, active: false, team: "PHI",
    ppg: 26.66, rpg: 3.7, apg: 6.2, spg: 2.2,
    totalPts: 24368 },
  { personId: 0, name: "Dirk Nowitzki", fromYear: 1998, toYear: 2019, active: false, team: "DAL",
    ppg: 20.7, rpg: 7.5, apg: 2.4, spg: 0.8, bpg: 0.8,
    totalPts: 31560, totalReb: 11489 },
  { personId: 0, name: "Charles Barkley", fromYear: 1984, toYear: 2000, active: false, team: "PHX",
    ppg: 22.1, rpg: 11.7, apg: 3.9, spg: 1.5,
    totalPts: 23757, totalReb: 12546 },
  { personId: 0, name: "Kevin Garnett", fromYear: 1995, toYear: 2016, active: false, team: "MIN",
    ppg: 17.8, rpg: 10.0, apg: 3.7, spg: 1.3, bpg: 1.4,
    totalPts: 26071, totalReb: 14662 },
  { personId: 0, name: "Jason Kidd", fromYear: 1994, toYear: 2013, active: false, team: "NJN",
    ppg: 12.6, rpg: 6.3, apg: 8.7, spg: 1.9,
    totalAst: 12091, totalStl: 2684 },
  { personId: 0, name: "Bob Pettit", fromYear: 1954, toYear: 1965, active: false, team: "STL",
    ppg: 26.36, rpg: 16.2, apg: 3.0,
    totalPts: 20880 },
  { personId: 0, name: "Elgin Baylor", fromYear: 1958, toYear: 1972, active: false, team: "LAL",
    ppg: 27.36, rpg: 13.55, apg: 4.3,
    totalPts: 23149, totalReb: 11463 },
  { personId: 0, name: "George Gervin", fromYear: 1976, toYear: 1986, active: false, team: "SAS",
    ppg: 26.18, rpg: 4.6, apg: 2.8,
    totalPts: 20708 },
  { personId: 0, name: "Pete Maravich", fromYear: 1970, toYear: 1980, active: false, team: "NOJ",
    ppg: 24.18, rpg: 4.2, apg: 5.4,
    totalPts: 15948 },
  { personId: 0, name: "Steve Nash", fromYear: 1996, toYear: 2014, active: false, team: "PHX",
    ppg: 14.3, rpg: 3.0, apg: 8.46, spg: 0.7,
    totalPts: 17387, totalAst: 10335 },
  { personId: 0, name: "Isiah Thomas", fromYear: 1981, toYear: 1994, active: false, team: "DET",
    ppg: 19.2, rpg: 3.6, apg: 9.34, spg: 1.9,
    totalPts: 18822, totalAst: 9061 },
  { personId: 0, name: "Dwyane Wade", fromYear: 2003, toYear: 2019, active: false, team: "MIA",
    ppg: 22.0, rpg: 4.7, apg: 5.4, spg: 1.5, bpg: 0.8,
    totalPts: 23165 },
  { personId: 0, name: "Moses Malone", fromYear: 1976, toYear: 1995, active: false, team: "HOU",
    ppg: 20.6, rpg: 12.3, apg: 1.4, bpg: 1.3,
    totalPts: 27409, totalReb: 16212 },
  { personId: 0, name: "Dennis Rodman", fromYear: 1986, toYear: 2000, active: false, team: "CHI",
    ppg: 7.3, rpg: 13.1, apg: 1.8 },
  { personId: 0, name: "Dwight Howard", fromYear: 2004, toYear: 2022, active: false, team: "ORL",
    ppg: 15.7, rpg: 12.7, apg: 1.4, bpg: 1.8,
    totalReb: 14627, totalBlk: 2228 },
  { personId: 0, name: "Patrick Ewing", fromYear: 1985, toYear: 2002, active: false, team: "NYK",
    ppg: 21.0, rpg: 9.8, apg: 1.9, bpg: 2.4,
    totalPts: 24815, totalBlk: 2894 },
  { personId: 0, name: "David Robinson", fromYear: 1989, toYear: 2003, active: false, team: "SAS",
    ppg: 21.1, rpg: 10.6, apg: 2.5, spg: 1.4, bpg: 3.0,
    totalPts: 20790, totalBlk: 2954 },
  { personId: 0, name: "Carmelo Anthony", fromYear: 2003, toYear: 2022, active: false, team: "DEN",
    ppg: 22.5, rpg: 6.2, apg: 2.7,
    totalPts: 28289 },
  { personId: 0, name: "Vince Carter", fromYear: 1998, toYear: 2020, active: false, team: "TOR",
    ppg: 16.7, rpg: 4.3, apg: 3.1,
    totalPts: 25728 },
  { personId: 0, name: "Reggie Miller", fromYear: 1987, toYear: 2005, active: false, team: "IND",
    ppg: 18.2, rpg: 3.0, apg: 3.0, spg: 1.1,
    totalPts: 25279 },
  { personId: 0, name: "Robert Parish", fromYear: 1976, toYear: 1997, active: false, team: "BOS",
    ppg: 14.5, rpg: 9.1, apg: 1.4, bpg: 1.5,
    totalPts: 23334, totalReb: 14715 },
];

export type Category =
  | "ppg" | "rpg" | "apg" | "spg" | "bpg"
  | "totalPts" | "totalReb" | "totalAst" | "totalStl" | "totalBlk"
  | "tenure";

export function getLeaderboard(
  category: Category,
  limit = 25
): (AllTimeLeader & { _value: number; _seasons: number })[] {
  return ALL_TIME_LEADERS
    .map((p) => {
      const seasons = p.toYear - p.fromYear + 1;
      const value = category === "tenure" ? seasons : p[category];
      return { ...p, _value: value ?? 0, _seasons: seasons };
    })
    .filter((p) => p._value > 0)
    .sort((a, b) => b._value - a._value)
    .slice(0, limit);
}
