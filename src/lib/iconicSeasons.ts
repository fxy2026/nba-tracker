// Single-season snapshots for iconic NBA campaigns — distinct from
// allTimeLeaders.ts (which holds CAREER averages). Lets /compare answer
// "2016 LeBron vs 2018 Harden vs 2019 Kawhi"-style debates.
//
// Stats are NBA-official regular-season per-game for the listed season.
// personId is the NBA CDN ID — same one as the active player's profile, so
// the headshot URL builder reuses /headshots/nba/latest/{id}.png and we get
// the correct face. For long-retired players (Jordan, Magic, etc.) the
// allTimeLeaders.ts personIds are reused.

// Loose play-style taxonomy — short tags that capture HOW the player won, not
// just how many points. Useful for "different roads to the same destination"
// comparisons (Curry '16 off-ball-shooter vs Westbrook '17 iso-creator).
export type PlayStyle =
  | "high-usage-scorer"
  | "iso-creator"
  | "off-ball-shooter"
  | "elite-passer"
  | "rim-protector"
  | "lockdown-defender"
  | "post-scorer"
  | "do-it-all-wing"
  | "rebound-machine"
  | "pace-setter"
  | "switchable-big"
  | "playmaking-big";

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
  // Playoff per-game for the same season. Skipped when the team was out
  // before the playoffs (rare for an iconic season) or sample was tiny.
  playoffPpg?: number;
  playoffRpg?: number;
  playoffApg?: number;
  playoffGp?: number;
  // 1-3 tags describing how the player operated this season.
  styles?: PlayStyle[];
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
    playoffPpg: 35.0, playoffRpg: 26.6, playoffApg: 3.1, playoffGp: 12,
    styles: ["high-usage-scorer", "rebound-machine", "post-scorer"],
    story: "Averaged 50.4 PPG and 48.5 MPG — both untouched records. Dropped 100 in a single game.",
    storyZh: "场均 50.4 分、48.5 分钟，至今无人逼近。单场 100 分。",
    scoringTitle: true },
  { id: "77506-1961", personId: 77506, name: "Oscar Robertson", season: "1961-62", seasonYear: 1961, team: "CIN",
    ppg: 30.8, rpg: 12.5, apg: 11.4,
    playoffPpg: 30.0, playoffRpg: 11.7, playoffApg: 12.2, playoffGp: 4,
    styles: ["do-it-all-wing", "elite-passer"],
    story: "First triple-double season average in NBA history.",
    storyZh: "NBA 历史首个场均三双赛季。" },

  // ── 1980s
  { id: "1449-1985", personId: 1449, name: "Larry Bird", season: "1985-86", seasonYear: 1985, team: "BOS",
    ppg: 25.8, rpg: 9.8, apg: 6.8, spg: 2.0, fgPct: 0.496, tpPct: 0.423, ftPct: 0.896,
    playoffPpg: 25.9, playoffRpg: 9.3, playoffApg: 8.2, playoffGp: 18,
    styles: ["do-it-all-wing", "off-ball-shooter", "elite-passer"],
    story: "Third straight MVP. Boston won 67 games and the title.",
    storyZh: "三连 MVP 末年，凯尔特人 67 胜夺冠。",
    mvp: true, champion: true },
  { id: "77142-1986", personId: 77142, name: "Magic Johnson", season: "1986-87", seasonYear: 1986, team: "LAL",
    ppg: 23.9, rpg: 6.3, apg: 12.2, spg: 1.7, fgPct: 0.522, ftPct: 0.848,
    playoffPpg: 21.8, playoffRpg: 7.7, playoffApg: 12.2, playoffGp: 18,
    styles: ["elite-passer", "pace-setter", "do-it-all-wing"],
    story: "First MVP at age 27, Lakers' 'Showtime' title run, Finals MVP.",
    storyZh: "27 岁首次 MVP，Showtime 王朝夺冠 + 总决赛 MVP。",
    mvp: true, champion: true, finalsMvp: true },
  { id: "893-1987", personId: 893, name: "Michael Jordan", season: "1987-88", seasonYear: 1987, team: "CHI",
    ppg: 35.0, rpg: 5.5, apg: 5.9, spg: 3.2, bpg: 1.6, fgPct: 0.535,
    playoffPpg: 36.3, playoffRpg: 7.1, playoffApg: 7.8, playoffGp: 10,
    styles: ["high-usage-scorer", "iso-creator", "lockdown-defender"],
    story: "MVP + DPOY in the same year — still the only player to win both.",
    storyZh: "史上唯一同年 MVP + 防守球员。",
    mvp: true, dpoy: true, scoringTitle: true },

  // ── 1990s
  { id: "165-1993", personId: 165, name: "Hakeem Olajuwon", season: "1993-94", seasonYear: 1993, team: "HOU",
    ppg: 27.3, rpg: 11.9, apg: 3.6, spg: 1.6, bpg: 3.7, fgPct: 0.528,
    playoffPpg: 28.9, playoffRpg: 11.0, playoffApg: 4.3, playoffGp: 23,
    styles: ["post-scorer", "rim-protector", "switchable-big"],
    story: "MVP, DPOY, and Finals MVP — sweep of the major awards.",
    storyZh: "MVP + DPOY + 总决赛 MVP 同一年包揽。",
    mvp: true, champion: true, finalsMvp: true, dpoy: true },
  { id: "893-1995", personId: 893, name: "Michael Jordan", season: "1995-96", seasonYear: 1995, team: "CHI",
    ppg: 30.4, rpg: 6.6, apg: 4.3, spg: 2.2, fgPct: 0.495,
    playoffPpg: 30.7, playoffRpg: 4.9, playoffApg: 4.1, playoffGp: 18,
    styles: ["high-usage-scorer", "iso-creator", "lockdown-defender"],
    story: "Bulls' 72-10 record-setting season. MVP, Finals MVP, scoring title.",
    storyZh: "公牛 72 胜赛季，MVP + 总决赛 MVP + 得分王。",
    mvp: true, champion: true, finalsMvp: true, scoringTitle: true },

  // ── 2000s
  { id: "406-1999", personId: 406, name: "Shaquille O'Neal", season: "1999-00", seasonYear: 1999, team: "LAL",
    ppg: 29.7, rpg: 13.6, apg: 3.8, bpg: 3.0, fgPct: 0.574,
    playoffPpg: 30.7, playoffRpg: 15.4, playoffApg: 3.1, playoffGp: 23,
    styles: ["post-scorer", "rim-protector"],
    story: "MVP + Finals MVP + scoring title — peak Shaq, peak fear.",
    storyZh: "MVP + 总决赛 MVP + 得分王，巅峰大鲨鱼。",
    mvp: true, champion: true, finalsMvp: true, scoringTitle: true },
  { id: "1495-2002", personId: 1495, name: "Tim Duncan", season: "2002-03", seasonYear: 2002, team: "SAS",
    ppg: 23.3, rpg: 12.9, apg: 3.9, bpg: 2.9, fgPct: 0.513,
    playoffPpg: 24.7, playoffRpg: 15.4, playoffApg: 5.3, playoffGp: 24,
    styles: ["post-scorer", "rim-protector", "playmaking-big"],
    story: "Second MVP + Finals MVP. The Big Fundamental at his apex.",
    storyZh: "第二个 MVP + 总决赛 MVP，石佛全盛期。",
    mvp: true, champion: true, finalsMvp: true },
  { id: "708-2003", personId: 708, name: "Kevin Garnett", season: "2003-04", seasonYear: 2003, team: "MIN",
    ppg: 24.2, rpg: 13.9, apg: 5.0, spg: 1.5, bpg: 2.2, fgPct: 0.499,
    playoffPpg: 24.3, playoffRpg: 14.6, playoffApg: 5.1, playoffGp: 18,
    styles: ["do-it-all-wing", "switchable-big", "rebound-machine"],
    story: "Lone MVP — carried the Wolves to a 58-win season and West Finals.",
    storyZh: "森林狼 58 胜，孤狼夺 MVP，杀入西决。",
    mvp: true },
  { id: "977-2005", personId: 977, name: "Kobe Bryant", season: "2005-06", seasonYear: 2005, team: "LAL",
    ppg: 35.4, rpg: 5.3, apg: 4.5, spg: 1.8, fgPct: 0.450, tpPct: 0.347, ftPct: 0.850,
    playoffPpg: 27.9, playoffRpg: 6.3, playoffApg: 5.1, playoffGp: 7,
    styles: ["high-usage-scorer", "iso-creator"],
    story: "Scored 81 vs Toronto. Career-high PPG. Mamba peak.",
    storyZh: "对猛龙独得 81 分，生涯单赛季 PPG 新高，曼巴巅峰。",
    scoringTitle: true },
  { id: "1717-2006", personId: 1717, name: "Dirk Nowitzki", season: "2006-07", seasonYear: 2006, team: "DAL",
    ppg: 24.6, rpg: 8.9, apg: 3.4, fgPct: 0.502, tpPct: 0.416, ftPct: 0.904,
    playoffPpg: 19.7, playoffRpg: 11.3, playoffApg: 2.7, playoffGp: 6,
    styles: ["off-ball-shooter", "post-scorer", "switchable-big"],
    story: "First European MVP. Mavs won 67 — lost in Round 1.",
    storyZh: "首位欧洲 MVP；独行侠 67 胜却首轮出局。",
    mvp: true },
  { id: "977-2007", personId: 977, name: "Kobe Bryant", season: "2007-08", seasonYear: 2007, team: "LAL",
    ppg: 28.3, rpg: 6.3, apg: 5.4, spg: 1.8, fgPct: 0.459,
    playoffPpg: 30.1, playoffRpg: 5.7, playoffApg: 5.6, playoffGp: 21,
    styles: ["high-usage-scorer", "iso-creator", "lockdown-defender"],
    story: "Lone MVP. Lakers reached the Finals but fell to KG's Celtics.",
    storyZh: "唯一 MVP，湖人闯进总决赛但败给凯尔特人。",
    mvp: true },
  { id: "977-2009", personId: 977, name: "Kobe Bryant", season: "2009-10", seasonYear: 2009, team: "LAL",
    ppg: 27.0, rpg: 5.4, apg: 5.0, spg: 1.5, fgPct: 0.456,
    playoffPpg: 29.2, playoffRpg: 6.0, playoffApg: 5.5, playoffGp: 23,
    styles: ["high-usage-scorer", "iso-creator"],
    story: "Back-to-back Finals MVP — beat Boston in 7.",
    storyZh: "连续总决赛 MVP，G7 复仇凯尔特人。",
    champion: true, finalsMvp: true },

  // ── 2010s
  { id: "201939-2014", personId: 201939, name: "Stephen Curry", season: "2014-15", seasonYear: 2014, team: "GSW",
    ppg: 23.8, rpg: 4.3, apg: 7.7, spg: 2.0, fgPct: 0.487, tpPct: 0.443, ftPct: 0.914,
    playoffPpg: 28.3, playoffRpg: 5.0, playoffApg: 6.4, playoffGp: 21,
    styles: ["off-ball-shooter", "pace-setter", "elite-passer"],
    story: "First MVP. Warriors finally hoist after 40 years.",
    storyZh: "首次 MVP，勇士时隔 40 年再夺冠。",
    mvp: true, champion: true },
  { id: "201939-2015", personId: 201939, name: "Stephen Curry", season: "2015-16", seasonYear: 2015, team: "GSW",
    ppg: 30.1, rpg: 5.4, apg: 6.7, spg: 2.1, fgPct: 0.504, tpPct: 0.454, ftPct: 0.908,
    playoffPpg: 25.1, playoffRpg: 5.2, playoffApg: 5.5, playoffGp: 18,
    styles: ["off-ball-shooter", "pace-setter", "high-usage-scorer"],
    story: "Unanimous MVP. 73-9 season. 402 threes — both records.",
    storyZh: "全票 MVP，常规赛 73 胜，单赛季 402 记三分，全部历史纪录。",
    mvp: true, scoringTitle: true },
  { id: "2544-2015", personId: 2544, name: "LeBron James", season: "2015-16", seasonYear: 2015, team: "CLE",
    ppg: 25.3, rpg: 7.4, apg: 6.8, spg: 1.4, bpg: 0.6, fgPct: 0.520,
    playoffPpg: 26.3, playoffRpg: 9.5, playoffApg: 7.6, playoffGp: 21,
    styles: ["do-it-all-wing", "iso-creator", "elite-passer"],
    story: "Down 3-1 to the 73-win Warriors, won three straight. Cleveland's first title.",
    storyZh: "总决赛 1-3 落后 73 胜勇士，连扳三场，骑士首冠。",
    champion: true, finalsMvp: true },
  { id: "201566-2016", personId: 201566, name: "Russell Westbrook", season: "2016-17", seasonYear: 2016, team: "OKC",
    ppg: 31.6, rpg: 10.7, apg: 10.4, spg: 1.6, fgPct: 0.425,
    playoffPpg: 37.4, playoffRpg: 11.6, playoffApg: 10.8, playoffGp: 5,
    styles: ["high-usage-scorer", "iso-creator", "pace-setter"],
    story: "Triple-double season average — first to do it since Oscar in 1962.",
    storyZh: "场均三双——自 1962 年大 O 以来首人。",
    mvp: true, scoringTitle: true },
  { id: "201935-2017", personId: 201935, name: "James Harden", season: "2017-18", seasonYear: 2017, team: "HOU",
    ppg: 30.4, rpg: 5.4, apg: 8.8, spg: 1.8, fgPct: 0.449, tpPct: 0.367, ftPct: 0.858,
    playoffPpg: 28.6, playoffRpg: 5.9, playoffApg: 6.8, playoffGp: 17,
    styles: ["iso-creator", "high-usage-scorer", "elite-passer"],
    story: "First MVP. Rockets pushed Golden State to a 7th game in the WCF.",
    storyZh: "首个 MVP，火箭把勇士拖到西决 G7。",
    mvp: true, scoringTitle: true },
  { id: "203507-2018", personId: 203507, name: "Giannis Antetokounmpo", season: "2018-19", seasonYear: 2018, team: "MIL",
    ppg: 27.7, rpg: 12.5, apg: 5.9, spg: 1.3, bpg: 1.5, fgPct: 0.578,
    playoffPpg: 25.5, playoffRpg: 12.3, playoffApg: 4.9, playoffGp: 15,
    styles: ["do-it-all-wing", "rim-protector", "switchable-big"],
    story: "First MVP. Bucks finished with the league's best record.",
    storyZh: "首个 MVP，雄鹿常规赛战绩联盟第一。",
    mvp: true },
  { id: "202695-2018", personId: 202695, name: "Kawhi Leonard", season: "2018-19", seasonYear: 2018, team: "TOR",
    ppg: 26.6, rpg: 7.3, apg: 3.3, spg: 1.8, bpg: 0.4, fgPct: 0.496, tpPct: 0.371,
    playoffPpg: 30.5, playoffRpg: 9.1, playoffApg: 3.9, playoffGp: 24,
    styles: ["do-it-all-wing", "iso-creator", "lockdown-defender"],
    story: "Carried Toronto to its first title. Finals MVP, playoff 30.5 PPG.",
    storyZh: "独自扛着多伦多夺冠，季后赛场均 30.5，总决赛 MVP。",
    champion: true, finalsMvp: true },
  { id: "2544-2019", personId: 2544, name: "LeBron James", season: "2019-20", seasonYear: 2019, team: "LAL",
    ppg: 25.3, rpg: 7.8, apg: 10.2, spg: 1.2, bpg: 0.5, fgPct: 0.493,
    playoffPpg: 27.6, playoffRpg: 10.8, playoffApg: 8.8, playoffGp: 21,
    styles: ["do-it-all-wing", "elite-passer", "iso-creator"],
    story: "Bubble champion. Fourth Finals MVP — with a fourth franchise.",
    storyZh: "园区夺冠，第 4 个总决赛 MVP，效力的第 4 支球队。",
    champion: true, finalsMvp: true },

  // ── 1970s
  { id: "76375-1971", personId: 76375, name: "Wilt Chamberlain", season: "1971-72", seasonYear: 1971, team: "LAL",
    ppg: 14.8, rpg: 19.2, apg: 4.0, fgPct: 0.649,
    playoffPpg: 14.7, playoffRpg: 21.0, playoffApg: 3.3, playoffGp: 15,
    styles: ["rebound-machine", "rim-protector", "post-scorer"],
    story: "Lakers won 33 in a row + the title. Wilt won FMVP at 35 as the defensive anchor.",
    storyZh: "湖人 33 连胜 + 夺冠。35 岁的张大帅以防守核心拿下 FMVP。",
    champion: true, finalsMvp: true },
  { id: "78049-1968", personId: 78049, name: "Bill Russell", season: "1968-69", seasonYear: 1968, team: "BOS",
    ppg: 9.9, rpg: 19.3, apg: 4.9,
    playoffPpg: 10.8, playoffRpg: 24.7, playoffApg: 6.1, playoffGp: 18,
    styles: ["rim-protector", "rebound-machine"],
    story: "Player-coach. Last title of his 11. Beat the Lakers in 7 with Wilt on the other side.",
    storyZh: "球员兼教练。11 冠收官之作。G7 客场击败有张大帅的湖人。",
    champion: true },
  { id: "0-1977", personId: 0, name: "Bill Walton", season: "1977-78", seasonYear: 1977, team: "POR",
    ppg: 18.9, rpg: 13.2, apg: 5.0, bpg: 2.5, fgPct: 0.522,
    styles: ["rim-protector", "playmaking-big"],
    story: "MVP. Foot injury cut the season short; otherwise would've been a likely repeat title.",
    storyZh: "MVP，因脚伤赛季提前结束；否则极可能卫冕。",
    mvp: true },

  // ── 1980s addendum
  { id: "1449-1984", personId: 1449, name: "Larry Bird", season: "1984-85", seasonYear: 1984, team: "BOS",
    ppg: 28.7, rpg: 10.5, apg: 6.6, spg: 1.6, fgPct: 0.522, tpPct: 0.427, ftPct: 0.882,
    playoffPpg: 26.0, playoffRpg: 9.1, playoffApg: 6.6, playoffGp: 20,
    styles: ["do-it-all-wing", "off-ball-shooter", "elite-passer"],
    story: "Second straight MVP. Boston reached the Finals; lost to Magic's Lakers.",
    storyZh: "连续两届 MVP。东决进军总决，败给魔术师湖人。",
    mvp: true },

  // ── 2000s addendum
  { id: "977-2001", personId: 977, name: "Kobe Bryant", season: "2001-02", seasonYear: 2001, team: "LAL",
    ppg: 25.2, rpg: 5.5, apg: 5.5, spg: 1.5, fgPct: 0.469,
    playoffPpg: 26.6, playoffRpg: 5.8, playoffApg: 4.6, playoffGp: 19,
    styles: ["high-usage-scorer", "iso-creator"],
    story: "Three-peat completed. Kobe's first All-NBA First Team selection.",
    storyZh: "湖人三连冠收官。Kobe 首次入选最佳一阵。",
    champion: true },
  { id: "708-2007", personId: 708, name: "Kevin Garnett", season: "2007-08", seasonYear: 2007, team: "BOS",
    ppg: 18.8, rpg: 9.2, apg: 3.4, spg: 1.4, bpg: 1.3, fgPct: 0.539,
    playoffPpg: 20.4, playoffRpg: 10.5, playoffApg: 3.3, playoffGp: 26,
    styles: ["switchable-big", "rim-protector", "post-scorer"],
    story: "First year with the Big Three. DPOY + title. ANYTHING IS POSSIBLE!!!",
    storyZh: "三巨头第一年。DPOY + 总冠军。\"ANYTHING IS POSSIBLE!!!\"",
    champion: true, dpoy: true },
  { id: "2544-2011", personId: 2544, name: "LeBron James", season: "2011-12", seasonYear: 2011, team: "MIA",
    ppg: 27.1, rpg: 7.9, apg: 6.2, spg: 1.9, bpg: 0.8, fgPct: 0.531,
    playoffPpg: 30.3, playoffRpg: 9.7, playoffApg: 5.6, playoffGp: 23,
    styles: ["do-it-all-wing", "iso-creator", "elite-passer"],
    story: "Lockout season. First ring + MVP + FMVP after the G6 Boston classic.",
    storyZh: "停摆赛季。首冠 + MVP + FMVP，G6 客场 45+15 的经典战之后。",
    mvp: true, champion: true, finalsMvp: true },

  // ── 1990s addendum
  { id: "901-1992", personId: 901, name: "Charles Barkley", season: "1992-93", seasonYear: 1992, team: "PHX",
    ppg: 25.6, rpg: 12.2, apg: 5.1, spg: 1.6, bpg: 1.0, fgPct: 0.520,
    playoffPpg: 26.6, playoffRpg: 13.6, playoffApg: 4.3, playoffGp: 24,
    styles: ["post-scorer", "rebound-machine", "do-it-all-wing"],
    story: "MVP. Suns won 62 games and reached the Finals — lost to Jordan's Bulls.",
    storyZh: "MVP 赛季，太阳 62 胜杀入总决赛 —— 被乔丹的公牛击败。",
    mvp: true },
  { id: "252-1996", personId: 252, name: "Karl Malone", season: "1996-97", seasonYear: 1996, team: "UTA",
    ppg: 27.4, rpg: 9.9, apg: 4.5, spg: 1.4, bpg: 0.6, fgPct: 0.550,
    playoffPpg: 26.0, playoffRpg: 10.7, playoffApg: 3.8, playoffGp: 20,
    styles: ["post-scorer", "high-usage-scorer"],
    story: "First MVP — over Jordan in the voting. Lost the Finals to that same Jordan.",
    storyZh: "首个 MVP — 投票战胜乔丹。总决赛却败给乔丹。",
    mvp: true },

  // ── 2000s addendum
  { id: "947-2000", personId: 947, name: "Allen Iverson", season: "2000-01", seasonYear: 2000, team: "PHI",
    ppg: 31.1, rpg: 3.8, apg: 4.6, spg: 2.5, fgPct: 0.420,
    playoffPpg: 32.9, playoffRpg: 3.8, playoffApg: 6.1, playoffGp: 22,
    styles: ["high-usage-scorer", "iso-creator", "pace-setter"],
    story: "MVP at 6 feet flat. Stepped over Tyronn Lue in Game 1 of the Finals before LAL took the next four.",
    storyZh: "182 cm 的 MVP。总决赛 G1 跨过 Lue 拿下唯一一胜，最后 1-4 输给湖人。",
    mvp: true, scoringTitle: true },
  { id: "201142-2009", personId: 201142, name: "Kevin Durant", season: "2009-10", seasonYear: 2009, team: "OKC",
    ppg: 30.1, rpg: 7.6, apg: 2.8, spg: 1.4, bpg: 1.0, fgPct: 0.476, tpPct: 0.365,
    playoffPpg: 25.0, playoffRpg: 7.7, playoffApg: 2.3, playoffGp: 6,
    styles: ["high-usage-scorer", "off-ball-shooter"],
    story: "First scoring title at age 21 — youngest scoring champion ever.",
    storyZh: "21 岁首个得分王 — 史上最年轻得分王。",
    scoringTitle: true },

  // ── 2010s addendum — LeBron's prime years and Heatles peak
  { id: "2544-2008", personId: 2544, name: "LeBron James", season: "2008-09", seasonYear: 2008, team: "CLE",
    ppg: 28.4, rpg: 7.6, apg: 7.2, spg: 1.7, bpg: 1.1, fgPct: 0.489,
    playoffPpg: 35.3, playoffRpg: 9.1, playoffApg: 7.3, playoffGp: 14,
    styles: ["do-it-all-wing", "iso-creator", "elite-passer"],
    story: "First MVP. Cleveland's 66-win regular season; ended in a Magic upset in the East Finals.",
    storyZh: "首个 MVP。骑士 66 胜常规赛 — 东决被魔术爆冷淘汰。",
    mvp: true },
  { id: "2544-2012", personId: 2544, name: "LeBron James", season: "2012-13", seasonYear: 2012, team: "MIA",
    ppg: 26.8, rpg: 8.0, apg: 7.3, spg: 1.7, bpg: 0.9, fgPct: 0.565, tpPct: 0.406,
    playoffPpg: 25.9, playoffRpg: 8.4, playoffApg: 6.6, playoffGp: 23,
    styles: ["do-it-all-wing", "iso-creator", "elite-passer"],
    story: "Heatles peak. 27-game win streak. MVP + Finals MVP, beat Spurs in 7.",
    storyZh: "热火三巨头巅峰。27 连胜。MVP + 总决赛 MVP，G7 战胜马刺。",
    mvp: true, champion: true, finalsMvp: true },

  // ── 2020s addendum — Jokić era + Embiid MVP
  { id: "203954-2022", personId: 203954, name: "Joel Embiid", season: "2022-23", seasonYear: 2022, team: "PHI",
    ppg: 33.1, rpg: 10.2, apg: 4.2, spg: 1.0, bpg: 1.7, fgPct: 0.548,
    playoffPpg: 23.7, playoffRpg: 10.2, playoffApg: 4.5, playoffGp: 9,
    styles: ["post-scorer", "rim-protector", "high-usage-scorer"],
    story: "First MVP. Led the league in scoring as a center — first since Shaq.",
    storyZh: "首个 MVP，得分王 — 中锋拿得分王，自奥尼尔之后首人。",
    mvp: true, scoringTitle: true },
  { id: "203999-2021", personId: 203999, name: "Nikola Jokić", season: "2021-22", seasonYear: 2021, team: "DEN",
    ppg: 27.1, rpg: 13.8, apg: 7.9, spg: 1.5, bpg: 0.9, fgPct: 0.583,
    playoffPpg: 31.0, playoffRpg: 13.2, playoffApg: 5.8, playoffGp: 5,
    styles: ["playmaking-big", "post-scorer", "elite-passer"],
    story: "Back-to-back MVP — same year his All-Star teammates both injured-out for the year.",
    storyZh: "连续 MVP。穆雷和波特双双赛季报销，他用一己之力扛着掘金。",
    mvp: true },

  // ── 2020s
  { id: "203999-2020", personId: 203999, name: "Nikola Jokić", season: "2020-21", seasonYear: 2020, team: "DEN",
    ppg: 26.4, rpg: 10.8, apg: 8.3, spg: 1.3, bpg: 0.7, fgPct: 0.566,
    playoffPpg: 29.1, playoffRpg: 11.3, playoffApg: 5.0, playoffGp: 10,
    styles: ["playmaking-big", "post-scorer", "elite-passer"],
    story: "First non-American MVP since Dirk. Did it as a #41 pick.",
    storyZh: "Dirk 之后首位非美籍 MVP；二轮第 41 顺位的逆袭。",
    mvp: true },
  { id: "1628983-2023", personId: 1628983, name: "Shai Gilgeous-Alexander", season: "2023-24", seasonYear: 2023, team: "OKC",
    ppg: 30.1, rpg: 5.5, apg: 6.2, spg: 2.0, fgPct: 0.535, tpPct: 0.353,
    playoffPpg: 29.4, playoffRpg: 4.6, playoffApg: 6.6, playoffGp: 10,
    styles: ["iso-creator", "high-usage-scorer", "lockdown-defender"],
    story: "Carried OKC's young core to a 1 seed. Top-3 MVP finish.",
    storyZh: "带雷霆年轻核心打出西部第一；MVP 前三。",
    scoringTitle: true },
];

// Display label for play-style tags. Centralized so the chips on the
// compare page (and any future surfaces) stay consistent.
export const PLAY_STYLE_LABEL: Record<PlayStyle, { en: string; zh: string }> = {
  "high-usage-scorer": { en: "High-Usage Scorer", zh: "高使用率得分手" },
  "iso-creator": { en: "ISO Creator", zh: "单打创造者" },
  "off-ball-shooter": { en: "Off-Ball Shooter", zh: "无球射手" },
  "elite-passer": { en: "Elite Passer", zh: "顶级传球" },
  "rim-protector": { en: "Rim Protector", zh: "护框者" },
  "lockdown-defender": { en: "Lockdown Defender", zh: "顶级单防" },
  "post-scorer": { en: "Post Scorer", zh: "低位得分" },
  "do-it-all-wing": { en: "Do-It-All Wing", zh: "全能锋线" },
  "rebound-machine": { en: "Rebound Machine", zh: "篮板机器" },
  "pace-setter": { en: "Pace Setter", zh: "节奏掌控" },
  "switchable-big": { en: "Switchable Big", zh: "换防型内线" },
  "playmaking-big": { en: "Playmaking Big", zh: "组织型内线" },
};

// Map an iconic-season id back to its full record. Used by compare-page
// search results once the user picks an entry.
export function findIconicSeason(id: string): IconicSeason | undefined {
  return ICONIC_SEASONS.find((s) => s.id === id);
}
