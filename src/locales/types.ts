export type Locale = "zh" | "en";

export interface Translations {
  // ---- Navigation ----
  nav: {
    today: string;
    calendar: string;
    stats: string;
    standings: string;
    more: string;
    teams: string;
    search: string;
    compare: string;
    h2h: string;
    playoffLeaders: string;
    injuries: string;
    trades: string;
    champions: string;
    playerSearch: string;
    favorites: string;
    schedule: string;
    explore: string;
    analysis: string;
    searchPlaceholder: string;
    searchShortcut: string;
    skipToContent: string;
  };

  // ---- Metadata / SEO ----
  meta: {
    siteTitle: string;
    siteTitleTemplate: string;
    siteDescription: string;
    ogTitle: string;
    ogDescription: string;
    twitterDescription: string;
    // sub-page meta
    standingsTitle: string;
    standingsDesc: string;
    scheduleTitle: string;
    scheduleDesc: string;
    calendarTitle: string;
    calendarDesc: string;
    injuriesTitle: string;
    injuriesDesc: string;
    championsTitle: string;
    championsDesc: string;
    h2hTitle: string;
    h2hDesc: string;
    searchTitle: string;
    searchDesc: string;
    tradesTitle: string;
    tradesDesc: string;
    clutchTitle: string;
    clutchDesc: string;
    compareTitle: string;
    compareDesc: string;
    favoritesTitle: string;
    favoritesDesc: string;
    statsTitle: string;
    statsDesc: string;
    adminTitle: string;
  };

  // ---- Footer ----
  footer: {
    madeWith: string;
    dataFrom: string;
    openSource: string;
    github: string;
    shortcuts: string;
    dates: string;
    searchKey: string;
    top: string;
  };

  // ---- Common / Shared ----
  common: {
    loading: string;
    error: string;
    retry: string;
    home: string;
    back: string;
    backToHome: string;
    backToGames: string;
    backToSearch: string;
    noData: string;
    beijing: string;
    beijingTime: string;
    updated: string;
    final: string;
    live: string;
    upcoming: string;
    scheduled: string;
    playoffs: string;
    regularSeason: string;
    preseason: string;
    offseason: string;
    allStarBreak: string;
    nbaFinals: string;
    today: string;
    vs: string;
    game: string;
    games: string;
    player: string;
    players: string;
    team: string;
    teams: string;
    season: string;
    career: string;
    points: string;
    wins: string;
    losses: string;
    tied: string;
    copied: string;
  };

  // ---- Error pages ----
  errors: {
    pageError: string;
    pageErrorDesc: string;
    criticalError: string;
    criticalErrorDesc: string;
    gameLoadError: string;
    gameLoadErrorDesc: string;
    notFoundTitle: string;
    notFoundDesc: string;
    notFoundHint: string;
    errorId: string;
    orBackHome: string;
  };

  // ---- Home / GamesList ----
  home: {
    failedToLoad: string;
    gameOfTheDay: string;
    margin: string;
    packedSlate: string;
    lightDay: string;
    liveCount: string;
    finalCount: string;
    totalPoints: string;
    across: string;
    finishedGame: string;
    finishedGames: string;
    playoffGamesToday: string;
    liveNow: string;
    noGames: string;
    noGamesHint: string;
    noGamesToday: string;
    browseRecent: string;
    yesterdayResults: string;
    checkStandings: string;
    conferenceRankings: string;
    findPlayer: string;
    findAnyPlayer: string;
    latestInjury: string;
    dayInsights: string;
    avgTotalPts: string;
    homeAway: string;
    thrillers: string;
    blowouts: string;
    yesterdayLink: string;
    rankings: string;
    searchPlayers: string;
    injuryReport: string;
    funFact: string;
  };

  // ---- Game Card ----
  gameCard: {
    replay: string;
    halftime: string;
    close: string;
    highScore: string;
    nailBiter: string;
    semis: string;
    confFinals: string;
    finals: string;
  };

  // ---- DateNav ----
  dateNav: {
    today: string;
  };

  // ---- Game Detail Page ----
  gameDetail: {
    boxScore: string;
    shotChart: string;
    playByPlay: string;
    playerRatings: string;
    starters: string;
    bench: string;
    dnp: string;
    gameSummary: string;
    pace: string;
    ptsPerQ: string;
    biggestRun: string;
    astTo: string;
    fouls: string;
    tripleDouble: string;
    doubleDouble: string;
    dimes: string;
    largestLead: string;
    boxScoreNotAvailable: string;
    gameNotStarted: string;
    thriller: string;
    blowout: string;
    ot: string;
    mvp: string;
    estPace: string;
    totalPoints: string;
    benchPoints: string;
    freeThrowAtt: string;
    shootingEfficiency: string;
    gameReplay: string;
    statsRadar: string;
    scoringPerQ: string;
    total: string;
    halftime: string;
    highestScoringQ: string;
    ledBy: string;
  };

  // ---- Standings ----
  standingsPage: {
    divisionStandings: string;
    top6Hint: string;
    playoff: string;
    playIn: string;
    confLeader: string;
    gamesLeft: string;
    best: string;
    proj: string;
    eastAvgW: string;
    westAvgW: string;
    eastVsWest: string;
    eastLeads: string;
    westLeads: string;
    eastConference: string;
    westConference: string;
    fullRankings: string;
    totalGames: string;
    playoffLine: string;
    playInLine: string;
    pct: string;
    gb: string;
  };

  // ---- Schedule ----
  schedulePage: {
    recentSchedule: string;
    quickStats: string;
    days: string;
    completed: string;
    filterByTeam: string;
    all: string;
    noGamesFound: string;
  };

  // ---- Calendar ----
  calendarPage: {
    seasonCalendar: string;
    nbaSeason: string;
    gamesThisMonth: string;
    gameDays: string;
    busiest: string;
    avg: string;
    gamesPerDay: string;
    more: string;
    sun: string;
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;
    sat: string;
  };

  // ---- Injuries ----
  injuriesPage: {
    title: string;
    dataSource: string;
    lastUpdated: string;
    out: string;
    doubtful: string;
    dayToDay: string;
    questionable: string;
    mostAffected: string;
    allTeams: string;
    noInjuryData: string;
    offseasonNote: string;
  };

  // ---- History / Champions ----
  historyPage: {
    title: string;
    sweeps: string;
    game7s: string;
    repeatChamps: string;
    mostFmvps: string;
    year: string;
    champion: string;
    finalsMvp: string;
    runnerUp: string;
    series: string;
    repeat: string;
    sweep: string;
    g7: string;
    championshipsByFranchise: string;
    dynastyWatch: string;
  };

  // ---- H2H ----
  h2hPage: {
    title: string;
    selectHint: string;
    gamesThisSeason: string;
    dominates: string;
    seriesTied: string;
    noGames: string;
    avgScore: string;
    gamesPlayed: string;
    blowoutWins: string;
    biggestWins: string;
    scoringDist: string;
    avgTotal: string;
    highest: string;
    lowest: string;
    homeAwaySplit: string;
    homeLabel: string;
    awayLabel: string;
    lastMeeting: string;
    pointDiffTrend: string;
    gameResults: string;
  };

  // ---- Compare ----
  comparePage: {
    title: string;
    searchPlayer1: string;
    searchPlayer2: string;
    popularMatchups: string;
    position: string;
    statsComparison: string;
    samePosition: string;
    leads: string;
    categories: string;
    tiedAll: string;
    radarComparison: string;
    overallScore: string;
    scoreFormula: string;
    selectHint: string;
    swapPlayers: string;
  };

  // ---- Search ----
  searchPage: {
    title: string;
    popularPlayers: string;
    guard: string;
    forward: string;
    center: string;
    searchHint: string;
    tip: string;
    noResults: string;
    noResultsFor: string;
    tryDifferent: string;
    star: string;
  };

  // ---- Favorites ----
  favoritesPage: {
    title: string;
    exportBtn: string;
    noFavorites: string;
    noFavoritesHint: string;
    findPlayers: string;
    browseTeams: string;
    favoriteTeams: string;
    favoritePlayers: string;
  };

  // ---- Clutch / Playoff Performers ----
  clutchPage: {
    title: string;
    subtitle: string;
    topScorer: string;
    topPlaymaker: string;
    mostGames: string;
    gp: string;
    efficiency: string;
    scoring: string;
    playmaking: string;
    steals: string;
    fgPct: string;
    failedToLoad: string;
    noData: string;
  };

  // ---- Player Detail ----
  playerDetail: {
    bodyMetrics: string;
    height: string;
    weight: string;
    country: string;
    seasons: string;
    draftInfo: string;
    yearLabel: string;
    round: string;
    pick: string;
    college: string;
    undrafted: string;
    careerTimeline: string;
    current: string;
    eliteScorer: string;
    scorer: string;
    floorGeneral: string;
    playmaker: string;
    glassCleaner: string;
    rebounder: string;
    allAround: string;
    veteran: string;
    risingStar: string;
    careerAverages: string;
    scoringProfile: string;
    careerPpg: string;
    careerMilestones: string;
    moreInfo: string;
    playerProfile: string;
    fullCareerStats: string;
    salaryContract: string;
    capInfo: string;
    latestNews: string;
    searchArticles: string;
    statsAnalytics: string;
    advancedData: string;
    teammates: string;
    similarPlayers: string;
  };

  // ---- Player Stats Bundle ----
  playerStats: {
    detailedUnavailable: string;
    viewOnNba: string;
    basketballRef: string;
    recentGames: string;
    date: string;
    matchup: string;
    wl: string;
    scoringTrend: string;
    avgLabel: string;
    highLabel: string;
    lowLabel: string;
    seasonBySeasonStats: string;
    bestSeason: string;
    vsCareerAvg: string;
  };

  // ---- Player Advanced Stats ----
  playerAdvanced: {
    title: string;
    tsPct: string;
    trueShooting: string;
    elite: string;
    aboveAvg: string;
    efgPct: string;
    effectiveFg: string;
    usgPct: string;
    usageRate: string;
  };

  // ---- Player Measurements ----
  playerMeasurements: {
    title: string;
    wingspan: string;
    standingReach: string;
    heightNoShoes: string;
    handLength: string;
    handWidth: string;
    bodyFat: string;
    disclaimer: string;
  };

  // ---- Player News ----
  playerNews: {
    title: string;
  };

  // ---- Player Salary ----
  playerSalary: {
    title: string;
    seasonCol: string;
    baseSalary: string;
    capHit: string;
  };

  // ---- Shot Heatmap ----
  shotHeatmap: {
    belowAvg: string;
    avg: string;
    aboveAvg: string;
  };

  // ---- Shot Chart ----
  shotChartComp: {
    allPlayers: string;
    all: string;
    fg: string;
    twoPoint: string;
    threePoint: string;
    twoPtMade: string;
    threePtMade: string;
    missed: string;
    restrictedArea: string;
    paintNonRa: string;
    midRange: string;
  };

  // ---- Player Shot Chart ----
  playerShotChart: {
    thisGame: string;
    totalFg: string;
    shotLog: string;
    noShotData: string;
    miss: string;
  };

  // ---- Play by Play ----
  playByPlayComp: {
    title: string;
    noPlayData: string;
    quarter: string;
    overtime: string;
  };

  // ---- Key Moments ----
  keyMoments: {
    title: string;
    runs: string;
    clutch: string;
    leads: string;
  };

  // ---- Win Probability ----
  winProb: {
    title: string;
    homeLeading: string;
    awayLeading: string;
  };

  // ---- Scoring Flow ----
  scoringFlow: {
    title: string;
    ledBy: string;
  };

  // ---- Quarter Scores ----
  quarterScores: {
    halftime: string;
    highestScoring: string;
  };

  // ---- Quarter Bars ----
  quarterBars: {
    title: string;
  };

  // ---- Team Compare ----
  teamCompare: {
    title: string;
    rebounds: string;
    assists: string;
    stealsLabel: string;
    blocks: string;
    turnovers: string;
    paintPts: string;
    fastBreak: string;
  };

  // ---- Playoff Bracket ----
  playoffBracket: {
    title: string;
    firstRound: string;
    confSemis: string;
    confFinals: string;
    finals: string;
    eastConference: string;
    westConference: string;
    completed: string;
    active: string;
  };

  // ---- Live / Score ----
  liveScore: {
    autoRefreshing: string;
    refreshNow: string;
    liveLabel: string;
  };

  // ---- Standings Mini ----
  standingsMini: {
    east: string;
    west: string;
    fullStandings: string;
  };

  // ---- Today Stars ----
  todayStars: {
    title: string;
    tripleDouble: string;
    doubleDouble: string;
    thirtyPts: string;
  };

  // ---- Share ----
  share: {
    shareGame: string;
    copied: string;
  };

  // ---- Season Progress ----
  seasonProgress: {
    seasonLabel: string;
    daysLeft: string;
  };

  // ---- Recent Highlights ----
  recentHighlights: {
    title: string;
    clutch: string;
    blowout: string;
    po: string;
    winBy: string;
  };

  // ---- Theme Toggle ----
  theme: {
    switchToLight: string;
    switchToDark: string;
  };

  // ---- Locale Toggle ----
  locale: {
    switchToChinese: string;
    switchToEnglish: string;
  };

  // ---- Stats page ----
  statsPage: {
    regularSeason: string;
    playoffs: string;
    failedToLoad: string;
    all: string;
    eastern: string;
    western: string;
    playoffLine: string;
    playInLine: string;
    mvpRankingNote: string;
    minGpRequired: string;
  };

  // ---- Team Page ----
  teamPage: {
    backToStandings: string;
    record: string;
    winPct: string;
    last10: string;
    playersCount: string;
    home: string;
    away: string;
    streak: string;
    bestStreak: string;
    worstStreak: string;
    seasonProgression: string;
    vsDivision: string;
    vsNonDivision: string;
    recentOpponents: string;
    offVsDef: string;
    pointDiff: string;
    lastNGames: string;
    recentGames: string;
    upcomingGames: string;
    noCompletedGames: string;
    noUpcomingGames: string;
    toughSchedule: string;
    easySchedule: string;
    average: string;
    monthlyRecord: string;
    winPctTrend: string;
    positionBreakdown: string;
    topScorers: string;
    roster: string;
    opponent: string;
    teamDesc: string;
    teamDescEn: string;
    scheduleLink: string;
    conference: string;
    division: string;
  };

  // ---- Favorite Button ----
  favorite: {
    add: string;
    remove: string;
  };

  // ---- Export ----
  export: {
    copied: string;
    exportBtn: string;
    eastConf: string;
    westConf: string;
  };

  // ---- Admin ----
  admin: {
    login: string;
    enterPassword: string;
    passwordPlaceholder: string;
    loggingIn: string;
    loginBtn: string;
    panel: string;
    replayLinks: string;
    dashboard: string;
    gamesWithReplay: string;
    finishedGames: string;
    playersIndexed: string;
    recentlyAdded: string;
    ok: string;
    down: string;
    clickRefresh: string;
    environment: string;
    supabase: string;
    adminPassword: string;
    ballDontLieApi: string;
    set: string;
    missing: string;
    dataSources: string;
    nbaCdnEspn: string;
    scheduleScores: string;
    replayStorage: string;
    postgresql: string;
    hosting: string;
    quickLinks: string;
    refreshDashboard: string;
    searchLabel: string;
    yesterday: string;
    todayLabel: string;
    tomorrow: string;
    id: string;
    noGamesOn: string;
    addReplayLink: string;
    titlePlaceholder: string;
    url: string;
    cloudDrive: string;
    youtube: string;
    bilibili: string;
    other: string;
    adding: string;
    addLink: string;
    selectGame: string;
    chooseFromLeft: string;
    noReplayLinks: string;
  };
}
