"use client";

import { useMemo, useState } from "react";
import { Book, Search, X, type LucideIcon, BarChart3, Shield, Zap, Trophy, Calendar, Layers, ArrowLeftRight, HelpCircle, ListOrdered, Crown, TrendingUp } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";

interface Term {
  term: string;
  abbr?: string;
  definition: string;
  // Optional zh equivalents. When isZh=true, fall back to English fields if missing.
  termZh?: string;
  definitionZh?: string;
}

interface Section {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  color: string;
  terms: Term[];
}

const SECTIONS: Section[] = [
  {
    title: "Basic Stats",
    eyebrow: "Box Score 101",
    icon: BarChart3,
    color: "#3B82F6",
    terms: [
      { term: "Points Per Game", abbr: "PPG", definition: "Average points scored by a player or team per game.", termZh: "场均得分", definitionZh: "球员或球队每场比赛平均得分。" },
      { term: "Rebounds Per Game", abbr: "RPG", definition: "Average rebounds — both offensive (after own team's missed shot) and defensive — per game.", termZh: "场均篮板", definitionZh: "每场比赛平均篮板数 — 包括进攻篮板（本队投失后抢下）和防守篮板。" },
      { term: "Assists Per Game", abbr: "APG", definition: "Average passes per game that directly lead to a teammate's made basket.", termZh: "场均助攻", definitionZh: "每场比赛平均直接造成队友得分的传球次数。" },
      { term: "Steals Per Game", abbr: "SPG", definition: "Average possessions taken from an opponent by deflection or live-ball strip.", termZh: "场均抢断", definitionZh: "每场比赛平均通过拨球或活球断球从对手手中夺取的球权次数。" },
      { term: "Blocks Per Game", abbr: "BPG", definition: "Average shot attempts deflected by a defender before reaching the rim.", termZh: "场均盖帽", definitionZh: "每场比赛平均被防守人在球进入篮筐前打掉的投篮次数。" },
      { term: "Turnovers Per Game", abbr: "TOPG", definition: "Average possessions lost by a team due to a bad pass, offensive foul, traveling, etc.", termZh: "场均失误", definitionZh: "每场比赛因传球失误、进攻犯规、走步等失去的球权次数。" },
      { term: "Minutes Played", abbr: "MIN", definition: "Total game time on the court. 48 min per regulation game, +5 min per overtime.", termZh: "出场时间", definitionZh: "球员在场总时间。常规赛每场 48 分钟，每节加时再加 5 分钟。" },
      { term: "Plus-Minus", abbr: "+/-", definition: "Point differential while a player is on the court — measures team-level impact.", termZh: "正负值", definitionZh: "球员在场时球队的净得分差 — 衡量球队层面的影响。" },
      { term: "Double-Double", definition: "Recording 10 or more in two box-score categories (points, rebounds, assists, steals, blocks) in a single game.", termZh: "两双", definitionZh: "单场比赛在得分、篮板、助攻、抢断、盖帽五项数据中有两项达到两位数（10+）。" },
      { term: "Triple-Double", definition: "Recording 10 or more in three box-score categories in a single game — a hallmark of all-around production.", termZh: "三双", definitionZh: "单场比赛在五项基本数据中有三项达到两位数（10+） — 全能表现的标志。" },
      { term: "Foul Out", definition: "A player accumulating 6 personal fouls in a game is disqualified for the rest of the night.", termZh: "6犯离场", definitionZh: "球员单场累计 6 次个人犯规后将被罚出场，本场比赛不得再上。" },
      { term: "And-One", definition: "Making a shot while being fouled, earning a free throw for a potential three- or four-point play.", termZh: "2+1", definitionZh: "在被犯规情况下仍命中投篮，可加罚一次罚球，形成 3 分或 4 分打。" },
    ],
  },
  {
    title: "Shooting & Efficiency",
    eyebrow: "Shot quality",
    icon: Zap,
    color: "#F59E0B",
    terms: [
      { term: "Field Goal Percentage", abbr: "FG%", definition: "Made shots divided by attempted shots, all locations. Top scorers usually sit at ≥50% (paint) or ≥40% (wings).", termZh: "投篮命中率", definitionZh: "命中数除以出手数，包含所有位置。顶级得分手通常 ≥50%（内线）或 ≥40%（锋线）。" },
      { term: "Three-Point Percentage", abbr: "3P%", definition: "Made threes ÷ attempted threes. League average is around 36%. Elite shooters live above 40%.", termZh: "三分命中率", definitionZh: "三分命中数 ÷ 三分出手数。联盟平均约 36%，顶级射手稳定在 40% 以上。" },
      { term: "Free Throw Percentage", abbr: "FT%", definition: "Made free throws ÷ attempted free throws. Elite shooters are above 85%.", termZh: "罚球命中率", definitionZh: "罚球命中数 ÷ 罚球出手数。顶级射手在 85% 以上。" },
      { term: "Effective FG%", abbr: "eFG%", definition: "FG% adjusted to credit threes 1.5×. A 40% 3P shooter has eFG% of 60% on threes alone.", termZh: "有效命中率", definitionZh: "经过加权的投篮命中率，三分按 1.5 倍计算。40% 三分射手仅看三分 eFG% 为 60%。" },
      { term: "True Shooting %", abbr: "TS%", definition: "Scoring efficiency accounting for field goals, threes, and free throws. League average ~57%.", termZh: "真实命中率", definitionZh: "考虑投篮、三分和罚球的综合得分效率指标，联盟平均约 57%。" },
      { term: "Usage Rate", abbr: "USG%", definition: "Percentage of team possessions a player ends (shot, turnover, FT trip) while on the court.", termZh: "使用率", definitionZh: "球员在场时结束本队进攻回合（出手、失误、获得罚球）的比例。" },
      { term: "Offensive Rating", abbr: "ORTG", definition: "Points produced per 100 possessions while a player or team is on the court.", termZh: "进攻效率", definitionZh: "球员或球队在场时每 100 回合得分。" },
      { term: "Defensive Rating", abbr: "DRTG", definition: "Points allowed per 100 possessions while a player or team is on the court.", termZh: "防守效率", definitionZh: "球员或球队在场时每 100 回合失分。" },
      { term: "Net Rating", abbr: "NETRTG", definition: "ORTG − DRTG. Positive means the team outscored opponents per 100 possessions.", termZh: "净效率", definitionZh: "进攻效率 − 防守效率。为正代表每 100 回合净胜对手。" },
      { term: "Heat Check", definition: "A risky shot taken by a player who's just made several in a row to test if they're 'on fire'.", termZh: "热手测试", definitionZh: "球员手感火热时主动尝试的高难度出手，用于验证自己是否处于'手感全开'状态。" },
      { term: "Mid-Range", definition: "Shots taken from inside the three-point line but outside the paint — increasingly rare in the modern NBA.", termZh: "中距离", definitionZh: "三分线内、禁区外的投篮区域 — 在现代 NBA 中出手占比越来越低。" },
      { term: "Catch-and-Shoot", definition: "A jump shot taken immediately after receiving a pass, with no dribble in between.", termZh: "接球投篮", definitionZh: "接到传球后不运球、直接起跳出手的投篮方式。" },
      { term: "Pull-Up Jumper", definition: "A jumper taken off the dribble — typically harder than catch-and-shoot looks.", termZh: "干拔跳投", definitionZh: "运球后直接急停起跳的跳投 — 难度通常高于接球投篮。" },
    ],
  },
  {
    title: "Advanced",
    eyebrow: "Single-number metrics",
    icon: BarChart3,
    color: "#A855F7",
    terms: [
      { term: "Player Efficiency Rating", abbr: "PER", definition: "Hollinger's per-minute box-score composite. League average is fixed at 15. MVPs typically top 28.", termZh: "球员效率值", definitionZh: "Hollinger 的每分钟综合数据指标，联盟均值固定为 15，MVP 通常超过 28。" },
      { term: "Box Plus-Minus", abbr: "BPM", definition: "Estimate of points contributed per 100 possessions above league average, derived from box-score stats.", termZh: "盒式正负值", definitionZh: "基于基础数据估算的、每 100 回合相较联盟平均的得分贡献。" },
      { term: "Value Over Replacement Player", abbr: "VORP", definition: "Cumulative season impact above a freely-available replacement-level player.", termZh: "替代球员价值", definitionZh: "整赛季相较于自由市场可任意获得的替代级球员的累计贡献值。" },
      { term: "Win Shares", abbr: "WS", definition: "Number of wins a player is estimated to have produced through offense and defense.", termZh: "胜利贡献值", definitionZh: "估算球员通过进攻和防守为球队贡献的胜场数。" },
      { term: "Pace", definition: "Possessions per 48 minutes. Faster pace = more shots = inflated counting stats.", termZh: "比赛节奏", definitionZh: "每 48 分钟的回合数。节奏越快 = 出手越多 = 基础数据更高。" },
      { term: "Assist-to-Turnover Ratio", abbr: "AST/TO", definition: "Passes that lead to baskets divided by possessions lost. Above 2.0 is solid for guards.", termZh: "助攻失误比", definitionZh: "助攻次数除以失误次数。后卫在 2.0 以上属于稳健。" },
      { term: "True Usage", definition: "Usage rate adjusted to include passes to teammates that lead to shots — a more complete picture of offensive load.", termZh: "真实使用率", definitionZh: "在使用率基础上额外计入造成队友出手的传球，更完整反映进攻负担。" },
      { term: "Free Throw Rate", abbr: "FTr", definition: "Free throw attempts divided by field goal attempts. Indicates how often a player gets to the line.", termZh: "罚球率", definitionZh: "罚球出手数除以投篮出手数，衡量球员造杀伤、上罚球线的频率。" },
      { term: "3-Point Attempt Rate", abbr: "3PAr", definition: "Share of total field goal attempts that come from three-point range.", termZh: "三分出手率", definitionZh: "三分出手数占总投篮出手数的比例。" },
      { term: "Assist Percentage", abbr: "AST%", definition: "Estimate of the percentage of teammate field goals a player assisted while on the court.", termZh: "助攻率", definitionZh: "球员在场时由其助攻的队友进球占队友总进球的比例估算。" },
      { term: "Rebound Percentage", abbr: "REB%", definition: "Estimate of the percentage of available rebounds a player grabbed while on the court.", termZh: "篮板率", definitionZh: "球员在场时抢下的篮板数占可争抢篮板总数的比例估算。" },
    ],
  },
  {
    title: "Game & Schedule",
    eyebrow: "Around the calendar",
    icon: Calendar,
    color: "#22C55E",
    terms: [
      { term: "Back-to-Back", abbr: "B2B", definition: "Two games on consecutive calendar days. Win rate on night 2 of B2Bs is historically below average.", termZh: "背靠背", definitionZh: "连续两天比赛。第二天的胜率历来低于平均。" },
      { term: "Overtime", abbr: "OT", definition: "Five-minute extra period when regulation ends tied. Multiple OTs are possible (2OT, 3OT).", termZh: "加时赛", definitionZh: "常规时间结束打平后增加的 5 分钟延长时段，可能有多个加时（2OT、3OT）。" },
      { term: "DNP", definition: "Did Not Play — a player on the roster who didn't see the floor (coach's decision, injury, rest).", termZh: "未出场", definitionZh: "Did Not Play — 名单中的球员未登场（教练决定、伤病或轮休）。" },
      { term: "Garbage Time", definition: "Final minutes of a blowout when bench players are in and the result is decided. Stats inflate here.", termZh: "垃圾时间", definitionZh: "比分悬殊、胜负已分的最后几分钟，替补球员上场，此时数据通常虚高。" },
      { term: "Tip-Off", definition: "The opening jump ball that starts each game.", termZh: "开球跳球", definitionZh: "每场比赛开始时的中圈跳球。" },
      { term: "Buzzer Beater", definition: "A shot taken before time expires that decides the period or game.", termZh: "压哨绝杀", definitionZh: "在时间结束前出手并命中、决定本节或比赛胜负的投篮。" },
      { term: "Travel", definition: "A violation where a player moves their pivot foot illegally without dribbling. Possession goes to the opponent.", termZh: "走步", definitionZh: "球员未运球时违规移动中枢脚的违例。球权转交对手。" },
      { term: "Carry", definition: "A violation where the player's hand goes under or beside the ball while dribbling, briefly 'carrying' it.", termZh: "翻腕", definitionZh: "运球时手部从球的下方或侧面托住球的违例，相当于短暂'端球'。" },
      { term: "Technical Foul", abbr: "T", definition: "A foul for unsportsmanlike behavior (arguing, taunting). Opponent gets one free throw and possession.", termZh: "技术犯规", definitionZh: "因不正当行为（争辩、挑衅）受罚的犯规。对手获得一次罚球和球权。" },
      { term: "Flagrant Foul", definition: "Excessive or unnecessary contact. Flagrant 1 = two free throws + possession. Flagrant 2 = ejection.", termZh: "恶意犯规", definitionZh: "过度或不必要的身体接触。一级恶犯：两罚一掷；二级恶犯：直接驱逐出场。" },
      { term: "Lottery", definition: "The annual weighted draw among non-playoff teams to determine the order of the top 14 draft picks.", termZh: "乐透", definitionZh: "未进入季后赛的球队按加权方式抽签，决定选秀大会前 14 顺位的年度仪式。" },
    ],
  },
  {
    title: "Postseason",
    eyebrow: "Playoffs & beyond",
    icon: Trophy,
    color: "#FFD700",
    terms: [
      { term: "Play-In Tournament", definition: "Mini-tournament for seeds 7-10 of each conference to claim the final two playoff spots.", termZh: "附加赛", definitionZh: "东西部第 7-10 名进行的小型淘汰赛，争夺最后两个季后赛席位。" },
      { term: "Conference Finals", abbr: "ECF/WCF", definition: "Best-of-7 series that decides the East and West representatives to the NBA Finals.", termZh: "分区决赛", definitionZh: "决出东西部冠军、进军总决赛的七场四胜系列赛。" },
      { term: "Sweep", definition: "Winning a playoff series 4-0 without losing a single game.", termZh: "横扫", definitionZh: "以 4-0 横扫赢下季后赛系列赛，未输一场。" },
      { term: "Gentleman's Sweep", definition: "Winning a series 4-1 — losing only one game, often when the trailing team's home court drops.", termZh: "绅士横扫", definitionZh: "以 4-1 赢下系列赛 — 仅输一场，常出现在劣势方主场失守的场景。" },
      { term: "MVP", definition: "Most Valuable Player — regular season's top player as voted by media. Separate Finals MVP exists.", termZh: "最有价值球员", definitionZh: "Most Valuable Player — 常规赛由媒体投票评出的最佳球员。总决赛 MVP 单独评选。" },
      { term: "Clutch", definition: "Last 5 minutes of a game with a score margin of 5 or fewer points.", termZh: "关键时刻", definitionZh: "比赛最后 5 分钟、分差在 5 分以内的时段。" },
      { term: "Higher Seed", definition: "The team with the better regular-season record in a playoff matchup — earns home-court advantage.", termZh: "高顺位种子", definitionZh: "季后赛对阵中常规赛战绩更好的一方，享有主场优势。" },
      { term: "Home-Court Advantage", definition: "The higher seed plays more games at home in a playoff series (4 of 7 in a 2-2-1-1-1 format).", termZh: "主场优势", definitionZh: "高顺位种子在季后赛系列赛中拥有更多主场（七场四胜中按 2-2-1-1-1 分布占 4 场）。" },
      { term: "Game 7", definition: "The decisive seventh game of a tied playoff series — winner takes the series.", termZh: "抢七", definitionZh: "系列赛打成 3-3 时的决胜第七场 — 胜者晋级。" },
      { term: "Three-Peat", definition: "Winning the NBA championship three years in a row. Rare and historic.", termZh: "三连冠", definitionZh: "连续三年夺得 NBA 总冠军，极为罕见且具有历史意义。" },
      { term: "Dynasty", definition: "An extended run of championship-level success by a single franchise across multiple seasons.", termZh: "王朝", definitionZh: "一支球队在多个赛季中持续保持夺冠竞争力的辉煌时期。" },
    ],
  },
  {
    title: "Defense",
    eyebrow: "On the other end",
    icon: Shield,
    color: "#DF1B41",
    terms: [
      { term: "Help Defense", definition: "Rotating off your assignment to contest a teammate's beaten matchup.", termZh: "协防", definitionZh: "离开自己的对位防守人去补防被突破的队友。" },
      { term: "Rim Protector", definition: "A big who deters and contests shots at the basket — typically high BPG and low opponent FG% at the rim.", termZh: "护框者", definitionZh: "在篮筐附近威慑和干扰投篮的内线 — 通常场均盖帽高、对手篮下命中率低。" },
      { term: "Switch", definition: "Defenders trade assignments during an action like a pick-and-roll instead of fighting over the screen.", termZh: "换防", definitionZh: "在挡拆等配合中，防守人交换对位而非绕过掩护。" },
      { term: "Zone Defense", definition: "Each defender guards an area rather than a specific opponent. Limited use in NBA due to rules.", termZh: "区域联防", definitionZh: "每名防守人负责一片区域而非盯人。NBA 规则限制其大范围使用。" },
      { term: "Hedge", definition: "Big briefly comes out to slow the ball-handler in a pick-and-roll before recovering.", termZh: "夹击延误", definitionZh: "挡拆中大个子短暂上前延误持球人后再回防自己的对位。" },
      { term: "Drop Coverage", definition: "Big stays back near the paint in a pick-and-roll, conceding the mid-range to protect the rim.", termZh: "退守战术", definitionZh: "挡拆时大个子退到禁区附近，让出中距离来保护篮筐。" },
      { term: "Box Out", definition: "Using your body to seal a defender behind you so you can grab the rebound.", termZh: "卡位", definitionZh: "用身体将对手挡在身后，为抢篮板创造位置。" },
      { term: "Pick", definition: "A legal screen set by an offensive player to free a teammate from their defender.", termZh: "掩护", definitionZh: "进攻球员通过合法挡人为队友摆脱防守的动作。" },
      { term: "Pick and Roll", abbr: "PnR", definition: "A two-man action where a player sets a screen and then rolls toward the basket as the ball-handler attacks.", termZh: "挡拆", definitionZh: "二人配合：掩护人完成掩护后顺下切入篮下，持球人借机进攻。" },
      { term: "Iso", definition: "Isolation — clearing one side of the floor so a ball-handler can attack their defender one-on-one.", termZh: "单打", definitionZh: "Isolation — 拉开一侧空间，让持球人与防守人一对一进攻。" },
      { term: "Stretch Big", definition: "A center or power forward who can shoot threes, spacing the floor for the offense.", termZh: "空间型内线", definitionZh: "能投三分的中锋或大前锋，为进攻拉开空间。" },
      { term: "Lob", definition: "A high pass thrown near the rim for a teammate to catch and finish — typically a dunk (alley-oop).", termZh: "空接", definitionZh: "在篮筐附近抛出的高传球，由队友凌空接住完成进攻 — 通常以扣篮（alley-oop）收尾。" },
    ],
  },
  {
    title: "Lineup & Tactics",
    eyebrow: "On-floor groups",
    icon: Layers,
    color: "#0EA5E9",
    terms: [
      { term: "Small Ball", definition: "A lineup featuring smaller, faster players — typically no traditional center — emphasizing pace and shooting.", termZh: "小球阵容", definitionZh: "由更矮、更快的球员组成、通常不上传统中锋的阵容，强调速度和投射。" },
      { term: "Twin Towers", definition: "A lineup that pairs two true centers or oversized bigs in the frontcourt for size and rim protection.", termZh: "双塔", definitionZh: "前场同时使用两名真正中锋或大体型内线的阵容，主打高度和护框。" },
      { term: "Death Lineup", definition: "A team's most lethal small-ball five — historically the Warriors' Curry/Thompson/Iguodala/Barnes/Green group.", termZh: "死亡五小", definitionZh: "球队最具杀伤力的小球五人组 — 历史上以勇士的库里/汤普森/伊戈达拉/巴恩斯/格林组合为代表。" },
      { term: "Rotation", definition: "The set of players a coach regularly uses, and the order/minutes in which they enter and exit games.", termZh: "轮换", definitionZh: "教练常规使用的球员组合，及其上下场的顺序和时间分配。" },
      { term: "Closing Lineup", definition: "The five players a coach trusts to finish a close game in the final minutes.", termZh: "决胜阵容", definitionZh: "教练在比赛最后关键时刻信任的收官五人组。" },
    ],
  },
  {
    title: "Trade & Roster",
    eyebrow: "Off-court moves",
    icon: ArrowLeftRight,
    color: "#94A3B8",
    terms: [
      { term: "Sign-and-Trade", definition: "A team signs its own free agent then trades him — lets the player get a bigger contract while the team gets assets back.", termZh: "先签后换", definitionZh: "球队先与自家自由球员续约后立即将其交易出去 — 让球员拿到更大合同，球队收回筹码。" },
      { term: "Buyout", definition: "A team and player agree to terminate his contract — the player gives back money, becomes a free agent.", termZh: "买断", definitionZh: "球队与球员协商终止合同 — 球员退还部分薪水，成为自由球员。" },
      { term: "Two-Way Contract", definition: "A contract allowing a player to split time between the NBA roster and the team's G League affiliate.", termZh: "双向合同", definitionZh: "允许球员在 NBA 球队与下属发展联盟球队之间穿梭出场的合同。" },
      { term: "G League", definition: "The NBA's official minor league for developing prospects, two-way players, and rehabbing veterans.", termZh: "发展联盟", definitionZh: "NBA 官方下属次级联赛，用于培养新秀、双向球员和老将复出过渡。" },
      { term: "Restricted Free Agent", abbr: "RFA", definition: "A free agent whose original team can match any outside offer sheet to retain him.", termZh: "受限制自由球员", definitionZh: "自由球员，但原球队有权匹配其他球队提供的报价合同以保留该球员。" },
      { term: "Unrestricted Free Agent", abbr: "UFA", definition: "A free agent with no restrictions — can sign with any team without his old club having a chance to match.", termZh: "不受限自由球员", definitionZh: "完全自由的球员，可与任何球队签约，原球队无权匹配。" },
      { term: "Trade Deadline", definition: "The annual cutoff (mid-February) after which trades cannot be completed for the rest of the season.", termZh: "交易截止日", definitionZh: "每年 2 月中旬的年度截止时间点，此后本赛季不得再完成交易。" },
    ],
  },
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-amber/30 text-text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const SECTION_TITLE_ZH: Record<string, { title: string; eyebrow: string }> = {
  "Basic Stats": { title: "基础数据", eyebrow: "技术统计入门" },
  "Shooting & Efficiency": { title: "投篮与效率", eyebrow: "投篮质量" },
  "Advanced": { title: "进阶数据", eyebrow: "综合指标" },
  "Game & Schedule": { title: "比赛与赛程", eyebrow: "围绕日历" },
  "Postseason": { title: "季后赛", eyebrow: "季后赛及之后" },
  "Defense": { title: "防守", eyebrow: "另一端" },
  "Lineup & Tactics": { title: "阵容与战术", eyebrow: "场上组合" },
  "Trade & Roster": { title: "交易与名单", eyebrow: "场外运作" },
};

export default function GlossarySearchable() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) return SECTIONS;
    const matches = (t: Term) =>
      t.term.toLowerCase().includes(trimmed) ||
      (t.abbr || "").toLowerCase().includes(trimmed) ||
      t.definition.toLowerCase().includes(trimmed) ||
      (t.termZh || "").includes(trimmed) ||
      (t.definitionZh || "").includes(trimmed);
    return SECTIONS
      .map((sec) => ({
        ...sec,
        terms: sec.terms.filter(matches),
      }))
      .filter((sec) => sec.terms.length > 0);
  }, [trimmed]);

  const totalTerms = SECTIONS.reduce((s, sec) => s + sec.terms.length, 0);
  const matchCount = filtered.reduce((s, sec) => s + sec.terms.length, 0);

  // FAQPage JSON-LD — Google's FAQ rich result is restricted to authoritative
  // sources nowadays, but Bing + Knowledge Graph still pick it up, and the
  // markup costs nothing to serve. Built off the same SECTIONS data the page
  // shows, so the on-page content matches the schema (Google's hard rule).
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECTIONS.flatMap((sec) =>
      sec.terms.map((term) => {
        const label = isZh && term.termZh ? term.termZh : term.term;
        const abbr = term.abbr ? ` (${term.abbr})` : "";
        const answer = isZh && term.definitionZh ? term.definitionZh : term.definition;
        return {
          "@type": "Question",
          name: `${label}${abbr}`,
          acceptedAnswer: { "@type": "Answer", text: answer },
        };
      }),
    ),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHeader
        eyebrow={isZh ? "学习" : "Learn"}
        icon={Book}
        title={isZh ? "NBA 术语" : "NBA Glossary"}
        subtitle={
          isZh
            ? `${totalTerms} 个术语与概念 · 从技术统计基础到进阶指标与战术行话`
            : `${totalTerms} terms and concepts · from box-score basics to advanced metrics and tactical jargon`
        }
      />

      <Breadcrumbs
        items={[
          { label: isZh ? "学习" : "Learn" },
          { label: isZh ? "NBA 术语" : "NBA Glossary" },
        ]}
      />

      {/* Search bar */}
      <div className="glass-tile p-2 mb-5 flex items-center gap-2">
        <Search size={16} className="text-text-secondary ml-2 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isZh ? "搜索术语、缩写或描述..." : "Search terms, abbreviations, or descriptions..."}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none py-2"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            aria-label={isZh ? "清除搜索" : "Clear search"}
          >
            <X size={14} />
          </button>
        )}
        {trimmed && (
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary tabular-nums shrink-0 pr-2">
            {isZh ? `${matchCount} 条匹配` : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-tile p-8 text-center">
          <p className="text-sm text-text-secondary">
            {isZh ? "未找到匹配 " : "No terms match "}<span className="font-mono text-text-primary">&quot;{query}&quot;</span>
          </p>
          <button
            onClick={() => setQuery("")}
            className="mt-3 text-xs font-mono uppercase tracking-[0.15em] text-accent hover:underline cursor-pointer"
          >
            {isZh ? "清除搜索" : "Clear search"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((sec) => {
            const Icon = sec.icon;
            const zhMeta = SECTION_TITLE_ZH[sec.title];
            const titleDisplay = isZh && zhMeta ? zhMeta.title : sec.title;
            const eyebrowDisplay = isZh && zhMeta ? zhMeta.eyebrow : sec.eyebrow;
            return (
              <section key={sec.title} className="glass-tile p-5 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: sec.color }} />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <Icon size={18} style={{ color: sec.color }} />
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {eyebrowDisplay}</p>
                      <h2 className="text-xl font-semibold tracking-tight" style={{ color: sec.color }}>{titleDisplay}</h2>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sec.terms.map((t) => {
                      const termDisplay = isZh && t.termZh ? t.termZh : t.term;
                      const definitionDisplay = isZh && t.definitionZh ? t.definitionZh : t.definition;
                      return (
                        <div key={t.term} className="glass-tile p-3">
                          <dt className="text-sm font-bold text-text-primary flex items-baseline gap-2 mb-1">
                            <span>{highlight(termDisplay, query)}</span>
                            {t.abbr && (
                              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent">/ {highlight(t.abbr, query)}</span>
                            )}
                          </dt>
                          <dd className="text-xs text-text-secondary leading-relaxed">{highlight(definitionDisplay, query)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/quiz", label: isZh ? "NBA 测验" : "NBA quiz", icon: HelpCircle },
          { href: "/about", label: isZh ? "关于" : "About this site", icon: Book },
          { href: "/explore", label: isZh ? "浏览全站" : "Explore", icon: ListOrdered },
          { href: "/history", label: isZh ? "历届冠军" : "Past champions", icon: Crown },
          { href: "/milestones", label: isZh ? "生涯里程碑" : "Milestones", icon: TrendingUp },
        ]}
      />
    </div>
  );
}
