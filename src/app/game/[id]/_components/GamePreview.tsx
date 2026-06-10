import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import GameCountdown from "@/components/GameCountdown";
import { getFullSchedule, toBeijingTime } from "@/lib/api";
import { getSeasonSeries, getRecentForm } from "@/lib/games";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";
import { TEAM_META } from "@/lib/teams";

export interface PreviewTeam {
  tricode: string;
  teamId: number;
  teamCity: string;
  teamName: string;
}

// ESPN injuries payload (same shape the /injuries page consumes) — schema
// drifts, so every field is optional and failures degrade to an empty list.
interface InjuryItem {
  status?: string;
  athlete?: { displayName?: string; position?: { abbreviation?: string } };
}
interface TeamInjury {
  displayName?: string;
  injuries?: InjuryItem[];
}

async function getInjuries(): Promise<TeamInjury[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    return json.injuries || [];
  } catch {
    return [];
  }
}

function teamInjuries(all: TeamInjury[], tricode: string): InjuryItem[] {
  const meta = TEAM_META[tricode];
  if (!meta) return [];
  const cityLower = meta.city.toLowerCase();
  const nameLower = meta.name.toLowerCase();
  const entry = all.find((t) => {
    const dn = (t.displayName || "").toLowerCase();
    return dn.includes(nameLower) || dn.includes(cityLower);
  });
  return (entry?.injuries || []).filter((i) => i.athlete?.displayName);
}

function statusTone(status: string | undefined): string {
  const s = (status || "").toLowerCase();
  if (s.includes("out")) return "text-danger bg-danger/10";
  if (s.includes("day-to-day") || s.includes("questionable") || s.includes("doubtful"))
    return "text-accent-amber bg-accent-amber/10";
  return "text-text-secondary bg-bg-hover";
}

function rankLabel(rank: number, conference: "East" | "West" | undefined, isZh: boolean): string {
  if (!rank || !conference) return "";
  if (isZh) return `${conference === "East" ? "东部" : "西部"}第 ${rank}`;
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? "th" : rank % 10 === 1 ? "st" : rank % 10 === 2 ? "nd" : rank % 10 === 3 ? "rd" : "th";
  return `${rank}${suffix} in the ${conference}`;
}

export default async function GamePreview({
  home,
  away,
  gameTimeUTC,
  arenaName,
  arenaCity,
  isZh,
}: {
  home: PreviewTeam;
  away: PreviewTeam;
  gameTimeUTC: string;
  arenaName?: string;
  arenaCity?: string;
  isZh: boolean;
}) {
  const [schedule, injuries] = await Promise.all([
    getFullSchedule().catch(() => []),
    getInjuries(),
  ]);

  const rows = computeStandingsRows(schedule);
  const rowOf = (tricode: string): StandingsRow | undefined => rows.find((r) => r.tricode === tricode);
  const confRank = (tricode: string): number => {
    const meta = TEAM_META[tricode];
    if (!meta) return 0;
    return rows.filter((r) => r.conference === meta.conference).findIndex((r) => r.tricode === tricode) + 1;
  };

  const awayRow = rowOf(away.tricode);
  const homeRow = rowOf(home.tricode);
  const series = getSeasonSeries(schedule, away.tricode, home.tricode);
  const awayForm = getRecentForm(schedule, away.tricode, 5);
  const homeForm = getRecentForm(schedule, home.tricode, 5);
  const awayInjuries = teamInjuries(injuries, away.tricode);
  const homeInjuries = teamInjuries(injuries, home.tricode);

  // Comparison rows from the one-pass standings splits (schedule cache only —
  // full shooting-split season averages would need a stats.nba call, skipped).
  const fmtRec = (w: number, l: number) => `${w}-${l}`;
  const compareRows: { label: string; a: string; h: string; aBetter: boolean; hBetter: boolean }[] = [];
  if (awayRow && homeRow) {
    const push = (label: string, a: string, h: string, aVal: number, hVal: number, lowerBetter = false) => {
      const aBetter = lowerBetter ? aVal < hVal : aVal > hVal;
      const hBetter = lowerBetter ? hVal < aVal : hVal > aVal;
      compareRows.push({ label, a, h, aBetter, hBetter });
    };
    push(isZh ? "战绩" : "Record", fmtRec(awayRow.wins, awayRow.losses), fmtRec(homeRow.wins, homeRow.losses), awayRow.pct, homeRow.pct);
    push(isZh ? "主场" : "Home", fmtRec(awayRow.homeW, awayRow.homeL), fmtRec(homeRow.homeW, homeRow.homeL), awayRow.homeW - awayRow.homeL, homeRow.homeW - homeRow.homeL);
    push(isZh ? "客场" : "Road", fmtRec(awayRow.roadW, awayRow.roadL), fmtRec(homeRow.roadW, homeRow.roadL), awayRow.roadW - awayRow.roadL, homeRow.roadW - homeRow.roadL);
    push(isZh ? "场均得分" : "PPG", awayRow.ppg.toFixed(1), homeRow.ppg.toFixed(1), awayRow.ppg, homeRow.ppg);
    push(isZh ? "场均失分" : "OPP PPG", awayRow.oppg.toFixed(1), homeRow.oppg.toFixed(1), awayRow.oppg, homeRow.oppg, true);
    push(
      isZh ? "净胜分" : "Net",
      `${awayRow.diff >= 0 ? "+" : ""}${awayRow.diff.toFixed(1)}`,
      `${homeRow.diff >= 0 ? "+" : ""}${homeRow.diff.toFixed(1)}`,
      awayRow.diff,
      homeRow.diff
    );
  }

  const beijingTime = toBeijingTime(gameTimeUTC);

  const formDots = (form: typeof awayForm) => (
    <div className="flex items-center gap-1">
      {form.length === 0 && <span className="text-[10px] text-text-secondary">{isZh ? "暂无比赛" : "No games yet"}</span>}
      {[...form].reverse().map((g) => (
        <Link
          key={g.gameId}
          href={`/game/${g.gameId}`}
          title={`${g.date} ${g.home ? "vs" : "@"} ${g.opponent} ${g.teamScore}-${g.oppScore}`}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-transform hover:scale-110 ${
            g.won ? "bg-success/15 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {g.won ? "W" : "L"}
        </Link>
      ))}
    </div>
  );

  const formRecord = (form: typeof awayForm) => {
    const w = form.filter((g) => g.won).length;
    return isZh ? `${w} 胜 ${form.length - w} 负` : `${w}-${form.length - w}`;
  };

  const injuryList = (list: InjuryItem[]) => (
    <div className="space-y-1.5">
      {list.length === 0 && (
        <p className="text-xs text-text-secondary">{isZh ? "暂无伤病信息" : "No injuries reported"}</p>
      )}
      {list.slice(0, 5).map((inj, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${statusTone(inj.status)}`}>
            {inj.status || (isZh ? "未知" : "Unknown")}
          </span>
          <span className="text-text-primary truncate">{inj.athlete?.displayName}</span>
          {inj.athlete?.position?.abbreviation && (
            <span className="text-text-secondary shrink-0">{inj.athlete.position.abbreviation}</span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="glass-tile p-4 sm:p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {isZh ? "比赛前瞻" : "Game Preview"}
      </h3>

      {/* Tipoff + venue */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
        {beijingTime && <span>{isZh ? "北京时间" : "Beijing"} {beijingTime}</span>}
        {arenaName && (
          <span>
            · {arenaName}
            {arenaCity ? `, ${arenaCity}` : ""}
          </span>
        )}
        <GameCountdown gameTimeUTC={gameTimeUTC} />
      </div>

      {/* Records + conference ranks */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {[
          { team: away, row: awayRow, rank: confRank(away.tricode) },
          { team: home, row: homeRow, rank: confRank(home.tricode) },
        ].map(({ team, row, rank }, i) => (
          <Link
            key={team.tricode}
            href={`/team/${team.tricode}`}
            className={`flex items-center gap-3 flex-1 hover:bg-bg-hover rounded-lg p-2 -m-2 transition-colors ${i === 1 ? "flex-row-reverse text-right" : ""}`}
          >
            <TeamLogo teamId={team.teamId} tricode={team.tricode} size={44} />
            <div>
              <p className="text-sm font-bold text-text-primary">
                {team.teamCity} {team.teamName}
              </p>
              <p className="text-xs text-text-secondary">
                {row ? fmtRec(row.wins, row.losses) : "0-0"}
                {row && row.streak && <span className="ml-1.5 font-mono">{row.streak}</span>}
              </p>
              {rank > 0 && (
                <p className="text-[10px] text-accent-amber font-medium">
                  {rankLabel(rank, TEAM_META[team.tricode]?.conference, isZh)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Side-by-side comparison (schedule-cache splits) */}
      {compareRows.length > 0 && (
        <div className="border-t border-border pt-3 mb-4 space-y-1.5">
          {compareRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span className={`w-20 font-mono tabular-nums ${r.aBetter ? "text-accent-amber font-bold" : "text-text-primary"}`}>{r.a}</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/70">{r.label}</span>
              <span className={`w-20 text-right font-mono tabular-nums ${r.hBetter ? "text-accent-amber font-bold" : "text-text-primary"}`}>{r.h}</span>
            </div>
          ))}
        </div>
      )}

      {/* Last-5 form */}
      <div className="border-t border-border pt-3 mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-2">
          {isZh ? "近 5 场" : "Last 5"}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {formDots(awayForm)}
            {awayForm.length > 0 && <span className="text-[10px] text-text-secondary">{formRecord(awayForm)}</span>}
          </div>
          <div className="flex items-center gap-2 flex-row-reverse">
            {formDots(homeForm)}
            {homeForm.length > 0 && <span className="text-[10px] text-text-secondary">{formRecord(homeForm)}</span>}
          </div>
        </div>
      </div>

      {/* Season series */}
      <div className="border-t border-border pt-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
            {isZh ? "本赛季交手" : "Season series"}
          </p>
          <Link
            href={`/h2h?t1=${away.tricode}&t2=${home.tricode}`}
            className="text-[10px] text-accent hover:underline"
          >
            {isZh ? "历史交锋 →" : "Full head-to-head →"}
          </Link>
        </div>
        {series.games.length === 0 ? (
          <p className="text-xs text-text-secondary">{isZh ? "两队本赛季尚未交手" : "First meeting of the season"}</p>
        ) : (
          <>
            <p className="text-xs text-text-primary mb-2">
              <span className="font-bold">{away.tricode} {series.wins[away.tricode] || 0}</span>
              <span className="text-text-secondary mx-1.5">-</span>
              <span className="font-bold">{series.wins[home.tricode] || 0} {home.tricode}</span>
            </p>
            <div className="space-y-1">
              {series.games.map((g) => {
                const homeWon = g.homeScore > g.awayScore;
                return (
                  <Link
                    key={g.gameId}
                    href={`/game/${g.gameId}`}
                    className="flex items-center gap-3 text-xs hover:bg-bg-hover rounded px-1.5 py-1 -mx-1.5 transition-colors"
                  >
                    <span className="text-text-secondary w-20 shrink-0">{g.date}</span>
                    <span className={`font-mono tabular-nums ${!homeWon ? "text-text-primary font-bold" : "text-text-secondary"}`}>
                      {g.awayTricode} {g.awayScore}
                    </span>
                    <span className="text-text-secondary">@</span>
                    <span className={`font-mono tabular-nums ${homeWon ? "text-text-primary font-bold" : "text-text-secondary"}`}>
                      {g.homeScore} {g.homeTricode}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Injury flags */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
            {isZh ? "伤病情况" : "Injury report"}
          </p>
          <Link href="/injuries" className="text-[10px] text-accent hover:underline">
            {isZh ? "全部伤病 →" : "All injuries →"}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">{away.teamCity} {away.teamName}</p>
            {injuryList(awayInjuries)}
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">{home.teamCity} {home.teamName}</p>
            {injuryList(homeInjuries)}
          </div>
        </div>
      </div>
    </div>
  );
}
