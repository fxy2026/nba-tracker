// Single-season snapshots for iconic NBA campaigns — distinct from
// allTimeLeaders.ts (which holds CAREER averages). Lets /compare answer
// "2016 LeBron vs 2018 Harden vs 2019 Kawhi"-style debates.
//
// Stats are NBA-official regular-season per-game for the listed season.
// personId is the NBA CDN ID — same one as the active player's profile, so
// the headshot URL builder reuses /headshots/nba/latest/{id}.png and we get
// the correct face. For long-retired players (Jordan, Magic, etc.) the
// allTimeLeaders.ts personIds are reused.

export interface IconicSeason {
  // Stable id: `${personId}-${seasonStartYear}` so queries / URLs are reversible.
  id: string;
  personId: number;
  name: string;
  // Season in display form: "2015-16", "1995-96"
  season: string;
  // Numeric start year for sort/grouping
  seasonYear: number;
  team: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  // FG% / 3P% / FT% as decimals (0.50 = 50%)
  fgPct?: number;
  tpPct?: number;
  ftPct?: number;
  // One-line narrative — what makes this season memorable
  story: string;
  storyZh?: string;
  // Trophy flags (used as small badges on the comparison panel)
  mvp?: boolean;
  champion?: boolean;
  finalsMvp?: boolean;
  dpoy?: boolean;
  scoringTitle?: boolean;
}

export const ICONIC_SEASONS: IconicSeason[] = [
  // ── 1960s
  { id: "76375-1961", personId: 76375, name: "Wilt Chamberlain", season: "1961-62", seasonYear: 1961, team: "PHI",
    ppg: 50.4, rpg: 25.7, apg: 2.4, fgPct: 0.506,
    story: "Averaged 50.4 PPG and 48.5 MPG — both untouched records. Dropped 100 in a single game.",
    storyZh: "场均 50.4 分、48.5 分钟，至今无人逼近。单场 100 分。",
    scoringTitle: true },
  { id: "77506-1961", personId: 77506, name: "Oscar Robertson", season: "1961-62", seasonYear: 1961, team: "CIN",
    ppg: 30.8, rpg: 12.5, apg: 11.4,
    story: "First triple-double season average in NBA history.",
    storyZh: "NBA 历史首个场均三双赛季。" },

  // ── 1980s
  { id: "1449-1985", personId: 1449, name: "Larry Bird", season: "1985-86", seasonYear: 1985, team: "BOS",
    ppg: 25.8, rpg: 9.8, apg: 6.8, spg: 2.0, fgPct: 0.496, tpPct: 0.423, ftPct: 0.896,
    story: "Third straight MVP. Boston won 67 games and the title.",
    storyZh: "三连 MVP 末年，凯尔特人 67 胜夺冠。",
    mvp: true, champion: true },
  { id: "77142-1986", personId: 77142, name: "Magic Johnson", season: "1986-87", seasonYear: 1986, team: "LAL",
    ppg: 23.9, rpg: 6.3, apg: 12.2, spg: 1.7, fgPct: 0.522, ftPct: 0.848,
    story: "First MVP at age 27, Lakers' 'Showtime' title run, Finals MVP.",
    storyZh: "27 岁首次 MVP，Showtime 王朝夺冠 + 总决赛 MVP。",
    mvp: true, champion: true, finalsMvp: true },
  { id: "893-1987", personId: 893, name: "Michael Jordan", season: "1987-88", seasonYear: 1987, team: "CHI",
    ppg: 35.0, rpg: 5.5, apg: 5.9, spg: 3.2, bpg: 1.6, fgPct: 0.535,
    story: "MVP + DPOY in the same year — still the only player to win both.",
    storyZh: "史上唯一同年 MVP + 防守球员。",
    mvp: true, dpoy: true, scoringTitle: true },

  // ── 1990s
  { id: "165-1993", personId: 165, name: "Hakeem Olajuwon", season: "1993-94", seasonYear: 1993, team: "HOU",
    ppg: 27.3, rpg: 11.9, apg: 3.6, spg: 1.6, bpg: 3.7, fgPct: 0.528,
    story: "MVP, DPOY, and Finals MVP — sweep of the major awards.",
    storyZh: "MVP + DPOY + 总决赛 MVP 同一年包揽。",
    mvp: true, champion: true, finalsMvp: true, dpoy: true },
  { id: "893-1995", personId: 893, name: "Michael Jordan", season: "1995-96", seasonYear: 1995, team: "CHI",
    ppg: 30.4, rpg: 6.6, apg: 4.3, spg: 2.2, fgPct: 0.495,
    story: "Bulls' 72-10 record-setting season. MVP, Finals MVP, scoring title.",
    storyZh: "公牛 72 胜赛季，MVP + 总决赛 MVP + 得分王。",
    mvp: true, champion: true, finalsMvp: true, scoringTitle: true },

  // ── 2000s
  { id: "406-1999", personId: 406, name: "Shaquille O'Neal", season: "1999-00", seasonYear: 1999, team: "LAL",
    ppg: 29.7, rpg: 13.6, apg: 3.8, bpg: 3.0, fgPct: 0.574,
    story: "MVP + Finals MVP + scoring title — peak Shaq, peak fear.",
    storyZh: "MVP + 总决赛 MVP + 得分王，巅峰大鲨鱼。",
    mvp: true, champion: true, finalsMvp: true, scoringTitle: true },
  { id: "1495-2002", personId: 1495, name: "Tim Duncan", season: "2002-03", seasonYear: 2002, team: "SAS",
    ppg: 23.3, rpg: 12.9, apg: 3.9, bpg: 2.9, fgPct: 0.513,
    story: "Second MVP + Finals MVP. The Big Fundamental at his apex.",
    storyZh: "第二个 MVP + 总决赛 MVP，石佛全盛期。",
    mvp: true, champion: true, finalsMvp: true },
  { id: "708-2003", personId: 708, name: "Kevin Garnett", season: "2003-04", seasonYear: 2003, team: "MIN",
    ppg: 24.2, rpg: 13.9, apg: 5.0, spg: 1.5, bpg: 2.2, fgPct: 0.499,
    story: "Lone MVP — carried the Wolves to a 58-win season and West Finals.",
    storyZh: "森林狼 58 胜，孤狼夺 MVP，杀入西决。",
    mvp: true },
  { id: "977-2005", personId: 977, name: "Kobe Bryant", season: "2005-06", seasonYear: 2005, team: "LAL",
    ppg: 35.4, rpg: 5.3, apg: 4.5, spg: 1.8, fgPct: 0.450, tpPct: 0.347, ftPct: 0.850,
    story: "Scored 81 vs Toronto. Career-high PPG. Mamba peak.",
    storyZh: "对猛龙独得 81 分，生涯单赛季 PPG 新高，曼巴巅峰。",
    scoringTitle: true },
  { id: "1717-2006", personId: 1717, name: "Dirk Nowitzki", season: "2006-07", seasonYear: 2006, team: "DAL",
    ppg: 24.6, rpg: 8.9, apg: 3.4, fgPct: 0.502, tpPct: 0.416, ftPct: 0.904,
    story: "First European MVP. Mavs won 67 — lost in Round 1.",
    storyZh: "首位欧洲 MVP；独行侠 67 胜却首轮出局。",
    mvp: true },
  { id: "977-2007", personId: 977, name: "Kobe Bryant", season: "2007-08", seasonYear: 2007, team: "LAL",
    ppg: 28.3, rpg: 6.3, apg: 5.4, spg: 1.8, fgPct: 0.459,
    story: "Lone MVP. Lakers reached the Finals but fell to KG's Celtics.",
    storyZh: "唯一 MVP，湖人闯进总决赛但败给凯尔特人。",
    mvp: true },
  { id: "977-2009", personId: 977, name: "Kobe Bryant", season: "2009-10", seasonYear: 2009, team: "LAL",
    ppg: 27.0, rpg: 5.4, apg: 5.0, spg: 1.5, fgPct: 0.456,
    story: "Back-to-back Finals MVP — beat Boston in 7.",
    storyZh: "连续总决赛 MVP，G7 复仇凯尔特人。",
    champion: true, finalsMvp: true },

  // ── 2010s
  { id: "201939-2014", personId: 201939, name: "Stephen Curry", season: "2014-15", seasonYear: 2014, team: "GSW",
    ppg: 23.8, rpg: 4.3, apg: 7.7, spg: 2.0, fgPct: 0.487, tpPct: 0.443, ftPct: 0.914,
    story: "First MVP. Warriors finally hoist after 40 years.",
    storyZh: "首次 MVP，勇士时隔 40 年再夺冠。",
    mvp: true, champion: true },
  { id: "201939-2015", personId: 201939, name: "Stephen Curry", season: "2015-16", seasonYear: 2015, team: "GSW",
    ppg: 30.1, rpg: 5.4, apg: 6.7, spg: 2.1, fgPct: 0.504, tpPct: 0.454, ftPct: 0.908,
    story: "Unanimous MVP. 73-9 season. 402 threes — both records.",
    storyZh: "全票 MVP，常规赛 73 胜，单赛季 402 记三分，全部历史纪录。",
    mvp: true, scoringTitle: true },
  { id: "2544-2015", personId: 2544, name: "LeBron James", season: "2015-16", seasonYear: 2015, team: "CLE",
    ppg: 25.3, rpg: 7.4, apg: 6.8, spg: 1.4, bpg: 0.6, fgPct: 0.520,
    story: "Down 3-1 to the 73-win Warriors, won three straight. Cleveland's first title.",
    storyZh: "总决赛 1-3 落后 73 胜勇士，连扳三场，骑士首冠。",
    champion: true, finalsMvp: true },
  { id: "201566-2016", personId: 201566, name: "Russell Westbrook", season: "2016-17", seasonYear: 2016, team: "OKC",
    ppg: 31.6, rpg: 10.7, apg: 10.4, spg: 1.6, fgPct: 0.425,
    story: "Triple-double season average — first to do it since Oscar in 1962.",
    storyZh: "场均三双——自 1962 年大 O 以来首人。",
    mvp: true, scoringTitle: true },
  { id: "201935-2017", personId: 201935, name: "James Harden", season: "2017-18", seasonYear: 2017, team: "HOU",
    ppg: 30.4, rpg: 5.4, apg: 8.8, spg: 1.8, fgPct: 0.449, tpPct: 0.367, ftPct: 0.858,
    story: "First MVP. Rockets pushed Golden State to a 7th game in the WCF.",
    storyZh: "首个 MVP，火箭把勇士拖到西决 G7。",
    mvp: true, scoringTitle: true },
  { id: "203507-2018", personId: 203507, name: "Giannis Antetokounmpo", season: "2018-19", seasonYear: 2018, team: "MIL",
    ppg: 27.7, rpg: 12.5, apg: 5.9, spg: 1.3, bpg: 1.5, fgPct: 0.578,
    story: "First MVP. Bucks finished with the league's best record.",
    storyZh: "首个 MVP，雄鹿常规赛战绩联盟第一。",
    mvp: true },
  { id: "202695-2018", personId: 202695, name: "Kawhi Leonard", season: "2018-19", seasonYear: 2018, team: "TOR",
    ppg: 26.6, rpg: 7.3, apg: 3.3, spg: 1.8, bpg: 0.4, fgPct: 0.496, tpPct: 0.371,
    story: "Carried Toronto to its first title. Finals MVP, playoff 30.5 PPG.",
    storyZh: "独自扛着多伦多夺冠，季后赛场均 30.5，总决赛 MVP。",
    champion: true, finalsMvp: true },
  { id: "2544-2019", personId: 2544, name: "LeBron James", season: "2019-20", seasonYear: 2019, team: "LAL",
    ppg: 25.3, rpg: 7.8, apg: 10.2, spg: 1.2, bpg: 0.5, fgPct: 0.493,
    story: "Bubble champion. Fourth Finals MVP — with a fourth franchise.",
    storyZh: "园区夺冠，第 4 个总决赛 MVP，效力的第 4 支球队。",
    champion: true, finalsMvp: true },

  // ── 2020s
  { id: "203999-2020", personId: 203999, name: "Nikola Jokić", season: "2020-21", seasonYear: 2020, team: "DEN",
    ppg: 26.4, rpg: 10.8, apg: 8.3, spg: 1.3, bpg: 0.7, fgPct: 0.566,
    story: "First non-American MVP since Dirk. Did it as a #41 pick.",
    storyZh: "Dirk 之后首位非美籍 MVP；二轮第 41 顺位的逆袭。",
    mvp: true },
  { id: "1628983-2023", personId: 1628983, name: "Shai Gilgeous-Alexander", season: "2023-24", seasonYear: 2023, team: "OKC",
    ppg: 30.1, rpg: 5.5, apg: 6.2, spg: 2.0, fgPct: 0.535, tpPct: 0.353,
    story: "Carried OKC's young core to a 1 seed. Top-3 MVP finish.",
    storyZh: "带雷霆年轻核心打出西部第一；MVP 前三。",
    scoringTitle: true },
];

// Map an iconic-season id back to its full record. Used by compare-page
// search results once the user picks an entry.
export function findIconicSeason(id: string): IconicSeason | undefined {
  return ICONIC_SEASONS.find((s) => s.id === id);
}
