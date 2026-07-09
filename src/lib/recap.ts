// Template-generated game recaps (自动战报), zh + en. Pure and fully
// deterministic: phrasing variation is seeded from a hash of the gameId so the
// same game always renders the same recap — no randomness, no clock reads.
import type { BoxScore, BoxScoreTeam, PlayerStats } from "@/lib/api";
import type { PlayAction } from "@/components/PlayByPlay";
import { gameScore, scoreToGrade, minutesFromIso } from "@/lib/game-stats";

export interface RecapText {
  title: string;
  paragraphs: string[];
}

export interface Recap {
  zh: RecapText;
  en: RecapText;
}

export interface RecapContext {
  isPlayoffs?: boolean;
}

// Narrative zh team names — the codebase otherwise renders English team names,
// but a Chinese 战报 reads wrong without them. Falls back to teamName.
const TEAM_NAME_ZH: Record<string, string> = {
  ATL: "老鹰", BOS: "凯尔特人", BKN: "篮网", CHA: "黄蜂", CHI: "公牛",
  CLE: "骑士", DAL: "独行侠", DEN: "掘金", DET: "活塞", GSW: "勇士",
  HOU: "火箭", IND: "步行者", LAC: "快船", LAL: "湖人", MEM: "灰熊",
  MIA: "热火", MIL: "雄鹿", MIN: "森林狼", NOP: "鹈鹕", NYK: "尼克斯",
  OKC: "雷霆", ORL: "魔术", PHI: "76人", PHX: "太阳", POR: "开拓者",
  SAC: "国王", SAS: "马刺", TOR: "猛龙", UTA: "爵士", WAS: "奇才",
};

// ---- deterministic variant picking ------------------------------------------

// FNV-1a — small, stable, good enough spread for picking template variants.
// Exported so other deterministic-from-a-string surfaces (e.g. the quiz's
// date-seeded daily challenge) can share the exact same hash.
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Each slot gets its own derived index so one game doesn't pick variant k everywhere
function pickIndex(seed: number, slot: number, count: number): number {
  return (Math.imul(seed ^ (slot + 1), 2654435761) >>> 0) % count;
}

// ---- play-by-play derived facts ----------------------------------------------

interface PbpFacts {
  /** Longest unanswered run of >= 8 points, if any. */
  biggestRun: { side: "home" | "away"; points: number; period: number } | null;
  leadChanges: number;
  /** Last play that flipped the lead (the eventual go-ahead score when it holds). */
  lastGoAhead: { side: "home" | "away"; period: number; clock: string; player: string } | null;
}

function computePbpFacts(actions: PlayAction[]): PbpFacts {
  let prevH = 0;
  let prevA = 0;
  let runSide: "home" | "away" | null = null;
  let runPts = 0;
  let best = { side: null as "home" | "away" | null, points: 0, period: 0 };
  let leadChanges = 0;
  let prevLeader: "home" | "away" | null = null;
  let lastGoAhead: PbpFacts["lastGoAhead"] = null;

  for (const a of actions) {
    const h = parseInt(a.scoreHome);
    const aw = parseInt(a.scoreAway);
    if (!Number.isFinite(h) || !Number.isFinite(aw)) continue;
    const dh = h - prevH;
    const da = aw - prevA;
    if (dh < 0 || da < 0) continue; // malformed row — totals never decrease
    if (dh === 0 && da === 0) continue;
    prevH = h;
    prevA = aw;

    if (dh > 0 && da > 0) {
      // Both totals jumped in one row (gap in the feed) — can't attribute, break the run.
      runSide = null;
      runPts = 0;
    } else {
      const side: "home" | "away" = dh > 0 ? "home" : "away";
      const pts = dh > 0 ? dh : da;
      if (runSide === side) runPts += pts;
      else {
        runSide = side;
        runPts = pts;
      }
      if (runPts > best.points) best = { side, points: runPts, period: a.period };
    }

    const leader: "home" | "away" | null = h > aw ? "home" : aw > h ? "away" : null;
    if (leader && leader !== prevLeader) {
      if (prevLeader) leadChanges++;
      lastGoAhead = { side: leader, period: a.period, clock: a.clock, player: a.playerNameI || "" };
      prevLeader = leader;
    }
  }

  return {
    biggestRun: best.side && best.points >= 8 ? { side: best.side, points: best.points, period: best.period } : null,
    leadChanges,
    lastGoAhead,
  };
}

// "PT04M36.00S" -> { m: 4, s: 36 }; null when unparsable
function parseClock(raw: string): { m: number; s: number } | null {
  const match = /PT(\d+)M([\d.]+)S/.exec(raw || "");
  if (!match) return null;
  return { m: parseInt(match[1], 10), s: Math.floor(parseFloat(match[2])) };
}

// ---- box-score derived facts --------------------------------------------------

function topPerformer(team: BoxScoreTeam) {
  let best: { p: PlayerStats; gs: number; grade: number } | null = null;
  for (const p of team.players) {
    if (p.played !== "1") continue;
    const mins = minutesFromIso(p.statistics.minutes);
    if (mins <= 0) continue;
    const gs = gameScore(p.statistics);
    if (!best || gs > best.gs) best = { p, gs, grade: scoreToGrade(gs, mins) };
  }
  return best;
}

function doubleDigitCount(s: PlayerStats["statistics"]): number {
  return [s.points, s.reboundsTotal, s.assists, s.steals, s.blocks].filter((v) => v >= 10).length;
}

// Quarter where the winner out-scored the loser by the most (>= 5 to be a story)
function decisiveQuarter(winner: BoxScoreTeam, loser: BoxScoreTeam) {
  let best: { period: number; diff: number } | null = null;
  const periods = winner.periods || [];
  for (let i = 0; i < periods.length; i++) {
    const diff = (periods[i]?.score || 0) - (loser.periods?.[i]?.score || 0);
    if (diff >= 5 && (!best || diff > best.diff)) best = { period: periods[i].period, diff };
  }
  return best;
}

function sumTeam(team: BoxScoreTeam, get: (s: PlayerStats["statistics"]) => number): number {
  let total = 0;
  for (const p of team.players) if (p.played === "1") total += get(p.statistics);
  return total;
}

function periodZh(p: number): string {
  return p <= 4 ? `第${p}节` : p === 5 ? "加时赛" : `第${p - 4}个加时`;
}

function periodEn(p: number): string {
  const q = ["the first quarter", "the second quarter", "the third quarter", "the fourth quarter"];
  if (p <= 4) return q[p - 1];
  const n = p - 4;
  return n === 1 ? "overtime" : n === 2 ? "double overtime" : n === 3 ? "triple overtime" : `the ${n}th overtime`;
}

// ---- the recap builder ---------------------------------------------------------

export function buildRecap(box: BoxScore, actions: PlayAction[], context?: RecapContext): Recap | null {
  if (box.gameStatus !== 3) return null;
  const home = box.homeTeam;
  const away = box.awayTeam;
  if (!home || !away || home.score === away.score) return null;

  const seed = hashString(box.gameId);
  const homeWon = home.score > away.score;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const margin = winner.score - loser.score;
  const numOt = Math.max((home.periods?.length || 4) - 4, 0);

  const winZh = TEAM_NAME_ZH[winner.teamTricode] || winner.teamName;
  const loseZh = TEAM_NAME_ZH[loser.teamTricode] || loser.teamName;
  const winEn = winner.teamName;
  const loseEn = loser.teamName;

  const winStar = topPerformer(winner);
  const loseStar = topPerformer(loser);
  const facts = computePbpFacts(actions);
  const swing = decisiveQuarter(winner, loser);

  // -- title ---------------------------------------------------------------
  // Margin-banded verbs; the title gets an OT-flavored verb because "大胜"
  // after overtime reads wrong, while the opener mentions OT separately.
  const baseVerbsZh =
    margin >= 20
      ? ["大胜", "狂胜", "轻松击溃"]
      : margin >= 10
      ? ["击败", "力克", "轻取"]
      : margin >= 6
      ? ["战胜", "击败", "力压"]
      : ["险胜", "惊险战胜", "苦战险胜"];
  const verbsZh = numOt > 0 ? ["加时险胜", "经过加时战胜", "加时力克"] : baseVerbsZh;
  const verbsEn = numOt > 0
    ? ["outlast", "survive", "edge"]
    : margin >= 20
    ? ["rout", "blow out", "cruise past"]
    : margin >= 10
    ? ["beat", "defeat", "top"]
    : margin >= 6
    ? ["hold off", "see off", "get past"]
    : ["edge", "squeak past", "outlast"];
  const verbZh = verbsZh[pickIndex(seed, 0, verbsZh.length)];
  const openerVerbZh = baseVerbsZh[pickIndex(seed, 0, baseVerbsZh.length)];
  const verbEn = verbsEn[pickIndex(seed, 0, verbsEn.length)];
  const otSuffixEn = numOt > 1 ? ` in ${numOt}OT` : numOt === 1 ? " in overtime" : "";

  const score = `${winner.score}-${loser.score}`;
  let titleZh: string;
  let titleEn: string;
  if (winStar) {
    const starPts = winStar.p.statistics.points;
    const tv = pickIndex(seed, 1, 3);
    titleZh =
      tv === 0
        ? `${winZh} ${score} ${verbZh}${loseZh}，${winStar.p.nameI} 砍下 ${starPts} 分`
        : tv === 1
        ? `${winStar.p.nameI} 轰下 ${starPts} 分，${winZh} ${score} ${verbZh}${loseZh}`
        : `${winZh}${verbZh}${loseZh} ${score}，${winStar.p.nameI} 得到 ${starPts} 分领衔全场`;
    titleEn =
      tv === 0
        ? `${winEn} ${verbEn} ${loseEn} ${score}${otSuffixEn} behind ${winStar.p.nameI}'s ${starPts} points`
        : tv === 1
        ? `${winStar.p.nameI} scores ${starPts} as ${winEn} ${verbEn} ${loseEn} ${score}${otSuffixEn}`
        : `${winEn} ${verbEn} ${loseEn} ${score}${otSuffixEn}, ${winStar.p.nameI} pours in ${starPts}`;
  } else {
    titleZh = `${winZh} ${score} ${verbZh}${loseZh}`;
    titleEn = `${winEn} ${verbEn} ${loseEn} ${score}${otSuffixEn}`;
  }

  // -- paragraph 1: opener ---------------------------------------------------
  const venueZh = homeWon ? "坐镇主场" : "客场作战";
  const venueEn = homeWon ? "at home" : "on the road";
  const playoffZh = context?.isPlayoffs ? "在这场季后赛较量中" : "";
  const playoffEnSuffix = context?.isPlayoffs ? " in playoff action" : "";
  const otZh = numOt > 1 ? `经过 ${numOt} 个加时` : numOt === 1 ? "经过加时鏖战" : "";
  const tightFinish = margin <= 5 || numOt > 0;
  const swingZh = swing
    ? `${periodZh(swing.period)}单节净胜 ${swing.diff} 分，成为本场比赛的胜负手。`
    : tightFinish
    ? "双方比分始终胶着，悬念保持到了最后。"
    : "全场没有哪一节分出明显胜负。";
  const swingEn = swing
    ? `A ${swing.diff}-point edge in ${periodEn(swing.period)} proved to be the difference.`
    : tightFinish
    ? "Neither side ever pulled away, and the game stayed tight to the finish."
    : "No single quarter swung the game decisively.";
  const ov = pickIndex(seed, 2, 3);
  const openerZh =
    ov === 0
      ? `${playoffZh ? playoffZh + "，" : ""}${winZh}${venueZh}${otZh}以 ${score} ${openerVerbZh}${loseZh}。${swingZh}`
      : ov === 1
      ? `${winZh}${venueZh}迎战${loseZh}${playoffZh ? "，" + playoffZh : ""}，最终${otZh}以 ${score} 拿下比赛。${swingZh}`
      : `本场比赛${winZh}${venueZh}发挥出色，${otZh}以 ${score} ${openerVerbZh}${loseZh}。${swingZh}`;
  const openerEn =
    ov === 0
      ? `The ${winEn} ${verbEn} the ${loseEn} ${score}${otSuffixEn} ${venueEn}${playoffEnSuffix}. ${swingEn}`
      : ov === 1
      ? `Playing ${venueEn}, the ${winEn} took down the ${loseEn} ${score}${otSuffixEn}${playoffEnSuffix}. ${swingEn}`
      : `The ${winEn} got the better of the ${loseEn} ${venueEn}, closing it out ${score}${otSuffixEn}. ${swingEn}`;

  // -- paragraph 2: star lines -------------------------------------------------
  let starsZh = "";
  let starsEn = "";
  if (winStar) {
    const s = winStar.p.statistics;
    const sv = pickIndex(seed, 3, 3);
    const verbWZh = ["拿下", "砍下", "贡献"][sv];
    const dd = doubleDigitCount(s);
    const ddZh = dd >= 3 ? "，收获三双" : dd >= 2 ? "，完成两双" : "";
    const ddEn = dd >= 3 ? " for a triple-double" : dd >= 2 ? " for a double-double" : "";
    starsZh = `${winZh}方面，${winStar.p.nameI} ${verbWZh} ${s.points} 分 ${s.reboundsTotal} 篮板 ${s.assists} 助攻${ddZh}，赛后评分 ${winStar.grade.toFixed(1)}。`;
    const verbWEn = ["led the way with", "paced the winners with", "powered the win with"][sv];
    starsEn = `${winStar.p.nameI} ${verbWEn} ${s.points} points, ${s.reboundsTotal} rebounds and ${s.assists} assists${ddEn}, earning a ${winStar.grade.toFixed(1)} game grade.`;
    if (loseStar) {
      const ls = loseStar.p.statistics;
      const lv = pickIndex(seed, 4, 3);
      starsZh +=
        lv === 0
          ? `${loseZh}的 ${loseStar.p.nameI} 得到 ${ls.points} 分 ${ls.reboundsTotal} 篮板 ${ls.assists} 助攻（评分 ${loseStar.grade.toFixed(1)}），难挽败局。`
          : lv === 1
          ? `${loseZh}这边，${loseStar.p.nameI} 交出 ${ls.points} 分 ${ls.reboundsTotal} 篮板 ${ls.assists} 助攻的数据（评分 ${loseStar.grade.toFixed(1)}），仍无力回天。`
          : `${loseStar.p.nameI} 为${loseZh}得到 ${ls.points} 分 ${ls.reboundsTotal} 篮板 ${ls.assists} 助攻（评分 ${loseStar.grade.toFixed(1)}），但球队仍吞下失利。`;
      starsEn +=
        lv === 0
          ? ` ${loseStar.p.nameI} had ${ls.points} points, ${ls.reboundsTotal} rebounds and ${ls.assists} assists (${loseStar.grade.toFixed(1)} grade) in the loss for the ${loseEn}.`
          : lv === 1
          ? ` For the ${loseEn}, ${loseStar.p.nameI} countered with ${ls.points} points, ${ls.reboundsTotal} rebounds and ${ls.assists} assists (${loseStar.grade.toFixed(1)} grade) in a losing effort.`
          : ` ${loseStar.p.nameI} kept the ${loseEn} close with ${ls.points} points, ${ls.reboundsTotal} rebounds and ${ls.assists} assists (${loseStar.grade.toFixed(1)} grade), but it wasn't enough.`;
    }
  }

  // -- paragraph 3: turning point (needs play-by-play) --------------------------
  const turnZhParts: string[] = [];
  const turnEnParts: string[] = [];
  if (facts.biggestRun) {
    const runTeam = facts.biggestRun.side === "home" ? home : away;
    const runZhName = TEAM_NAME_ZH[runTeam.teamTricode] || runTeam.teamName;
    const rv = pickIndex(seed, 5, 3);
    turnZhParts.push(
      rv === 0
        ? `${runZhName}在${periodZh(facts.biggestRun.period)}打出一波 ${facts.biggestRun.points}-0 的得分高潮`
        : rv === 1
        ? `${periodZh(facts.biggestRun.period)}，${runZhName}祭出 ${facts.biggestRun.points}-0 的攻击波`
        : `${runZhName}曾在${periodZh(facts.biggestRun.period)}连得 ${facts.biggestRun.points} 分`
    );
    turnEnParts.push(
      rv === 0
        ? `The ${runTeam.teamName} ripped off a ${facts.biggestRun.points}-0 run in ${periodEn(facts.biggestRun.period)}`
        : rv === 1
        ? `A ${facts.biggestRun.points}-0 ${runTeam.teamName} burst in ${periodEn(facts.biggestRun.period)} swung the momentum`
        : `The ${runTeam.teamName} scored ${facts.biggestRun.points} unanswered points in ${periodEn(facts.biggestRun.period)}`
    );
  }
  if (facts.leadChanges >= 8) {
    turnZhParts.push(`双方全场 ${facts.leadChanges} 次互换领先`);
    turnEnParts.push(`the lead changed hands ${facts.leadChanges} times`);
  }
  const winnerSide: "home" | "away" = homeWon ? "home" : "away";
  if (
    (margin <= 5 || numOt > 0) &&
    facts.lastGoAhead &&
    facts.lastGoAhead.side === winnerSide &&
    facts.lastGoAhead.period >= 4
  ) {
    const clock = parseClock(facts.lastGoAhead.clock);
    if (clock && clock.m < 5 && facts.lastGoAhead.player) {
      const when = `${clock.m > 0 ? `${clock.m} 分 ` : ""}${clock.s} 秒`;
      turnZhParts.push(
        `决胜时刻，${facts.lastGoAhead.player} 在${periodZh(facts.lastGoAhead.period)}还剩 ${when}时投中反超一球，${winZh}就此掌控局面`
      );
      const whenEn = `${clock.m}:${String(clock.s).padStart(2, "0")}`;
      turnEnParts.push(
        `${facts.lastGoAhead.player} put the ${winEn} ahead for good with ${whenEn} left in ${periodEn(facts.lastGoAhead.period)}`
      );
    }
  }
  const turningZh = turnZhParts.length > 0 ? `${turnZhParts.join("；")}。` : "";
  const turningEn =
    turnEnParts.length > 0
      ? `${turnEnParts
          .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
          .join("; ")}.`
      : "";

  // -- paragraph 4: closer (notable splits) -------------------------------------
  const closerZhParts: string[] = [];
  const closerEnParts: string[] = [];
  const win3m = sumTeam(winner, (s) => s.threePointersMade);
  const win3a = sumTeam(winner, (s) => s.threePointersAttempted);
  if (win3m >= 17 || (win3a >= 30 && win3m / win3a >= 0.45)) {
    closerZhParts.push(`${winZh}全场三分球 ${win3a} 投 ${win3m} 中，外线火力成为取胜关键`);
    closerEnParts.push(`the ${winEn} buried ${win3m} of ${win3a} threes`);
  }
  const winBench = sumTeam(winner, (s) => s.points) - sumTeamStarters(winner);
  const loseBench = sumTeam(loser, (s) => s.points) - sumTeamStarters(loser);
  if (winBench - loseBench >= 20) {
    closerZhParts.push(`替补得分 ${winBench}-${loseBench} 大幅占优`);
    closerEnParts.push(`their reserves won the bench battle ${winBench}-${loseBench}`);
  }
  const winPaint = winner.statistics?.pointsInThePaint;
  const losePaint = loser.statistics?.pointsInThePaint;
  if (typeof winPaint === "number" && typeof losePaint === "number" && winPaint - losePaint >= 14) {
    closerZhParts.push(`内线得分 ${winPaint}-${losePaint} 占据上风`);
    closerEnParts.push(`they won the paint battle ${winPaint}-${losePaint}`);
  }
  if (numOt > 0 && turnZhParts.length === 0) {
    closerZhParts.push(`比赛${numOt > 1 ? `经过 ${numOt} 个加时` : "进入加时"}才分出胜负`);
    closerEnParts.push(`it took ${numOt > 1 ? `${numOt} overtimes` : "an extra period"} to settle the outcome`);
  }
  let closerZh = "";
  let closerEn = "";
  if (closerZhParts.length > 0) {
    const cv = pickIndex(seed, 6, 3);
    const leadInZh = ["数据层面，", "值得一提的是，", "此外，"][cv];
    const leadInEn = ["On the stat sheet, ", "Notably, ", "Beyond the scoreline, "][cv];
    closerZh = `${leadInZh}${closerZhParts.slice(0, 2).join("，")}。`;
    closerEn = `${leadInEn}${closerEnParts.slice(0, 2).join(", and ")}.`;
  }

  const zhParagraphs = [openerZh, starsZh, turningZh, closerZh].filter(Boolean).slice(0, 4);
  const enParagraphs = [openerEn, starsEn, turningEn, closerEn].filter(Boolean).slice(0, 4);

  return {
    zh: { title: titleZh, paragraphs: zhParagraphs },
    en: { title: titleEn, paragraphs: enParagraphs },
  };
}

function sumTeamStarters(team: BoxScoreTeam): number {
  let total = 0;
  for (const p of team.players) if (p.played === "1" && p.starter === "1") total += p.statistics.points;
  return total;
}
