import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import Breadcrumbs from "@/components/Breadcrumbs";
import { currentSeason } from "@/lib/constants";
import type { SixersSeasonArchive as Archive, SixersArchiveResult } from "@/lib/sixers-season-archive";

export function SixersSeasonNavigation({ historical, isZh }: { historical: boolean; isZh: boolean }) {
  return <nav aria-label={isZh ? "76人赛季" : "76ers seasons"} className="flex flex-wrap gap-2 mb-5 text-sm">
    <Link className={`rounded-full border px-4 py-2 ${historical ? "border-border text-text-secondary hover:text-accent" : "border-accent text-accent"}`} href="/team/PHI" aria-current={historical ? undefined : "page"}>{currentSeason()} · {isZh ? "返回球队主页" : "Team overview"}</Link>
    <Link className={`rounded-full border px-4 py-2 ${historical ? "border-accent text-accent" : "border-border text-text-secondary hover:text-accent"}`} href="/team/PHI?season=2024-25" aria-current={historical ? "page" : undefined}>2024–25 · {isZh ? "历史赛季" : "Season archive"}</Link>
  </nav>;
}
function Results({ games, isZh }: { games: SixersArchiveResult[]; isZh: boolean }) {
  return <ul className="divide-y divide-border/60">
    {[...games].reverse().map(game => {
      const home = game.home.tricode === "PHI", phi = home ? game.home : game.away, opponent = home ? game.away : game.home;
      const won = phi.score > opponent.score;
      return <li key={game.eventId} className="px-4 py-3 sm:px-5">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3">
          <time dateTime={game.date} className="text-xs tabular-nums text-text-secondary">{game.date}</time>
          <span className="text-sm font-medium">{home ? "vs" : "@"} {opponent.tricode}</span>
          <span className="font-mono text-sm tabular-nums"><span className={won ? "text-success" : "text-danger"}>{won ? "W" : "L"}</span> {phi.score}–{opponent.score}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs">
          {game.nbaGameId ? <Link className="text-accent hover:underline" href={`/game/${game.nbaGameId}`} aria-label={`${game.date} PHI ${home ? "vs" : "@"} ${opponent.tricode} ${isZh ? "球员数据" : "player stats"}`}>{isZh ? "查看球员数据" : "Player stats"} →</Link>
            : <span className="text-text-secondary">{isZh ? "NBA 比赛编号未映射" : "NBA game ID not mapped"}</span>}
          <a className="text-text-secondary hover:text-accent hover:underline" href={game.source.url} target="_blank" rel="noopener noreferrer">ESPN ↗</a>
        </div>
      </li>;
    })}
  </ul>;
}
export default function SixersSeasonArchive({ archive, isZh }: { archive: Archive; isZh: boolean }) {
  const regular = archive.games.filter(g => g.phase === "regular"), preseason = archive.games.filter(g => g.phase === "preseason");
  let wins = 0, scored = 0, allowed = 0;
  for (const g of regular) {
    const [phi, opponent] = g.home.tricode === "PHI" ? [g.home, g.away] : [g.away, g.home];
    if (phi.score > opponent.score) wins++;
    scored += phi.score; allowed += opponent.score;
  }
  const imported = regular.filter(g => g.boxEntry).length;
  return <div className="max-w-6xl mx-auto px-4 py-6">
    <Breadcrumbs items={[{ label: isZh ? "球队" : "Teams", href: "/standings" }, { label: "Philadelphia 76ers", href: "/team/PHI" }, { label: "2024–25" }]} />
    <SixersSeasonNavigation historical isZh={isZh} />
    <section className="glass-tile p-5 sm:p-8">
      <div className="flex items-center gap-4"><TeamLogo teamId={1610612755} tricode="PHI" size={64} /><div>
        <p className="text-xs uppercase tracking-widest text-text-secondary">{isZh ? "已归档赛季" : "Season archive"} · 2024–25</p>
        <h1 className="mt-1 text-2xl font-semibold">{isZh ? "费城76人" : "Philadelphia 76ers"}</h1>
      </div></div>
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[[isZh ? "常规赛战绩" : "Regular-season record", `${wins}–${regular.length - wins}`], [isZh ? "场均得分" : "Points per game", (scored / regular.length).toFixed(1)], [isZh ? "场均失分" : "Opponent PPG", (allowed / regular.length).toFixed(1)]].map(([label, value]) => <div key={label}><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-xl sm:text-3xl font-mono tabular-nums">{value}</p></div>)}
      </div>
      <p className="mt-5 text-sm text-text-secondary">{isZh ? `已收录 ${regular.length} 场常规赛、${preseason.length} 场季前赛结果；${imported} 场常规赛可查看双方球员基础数据。` : `${regular.length} regular-season and ${preseason.length} preseason results; both teams’ basic player stats are available for ${imported} regular-season games.`}</p>
      <p className="mt-2 text-xs text-text-secondary">{isZh ? "比分及球员数据来自 ESPN 已归档来源。站内比赛链接通过已归档 NBA 投篮与逐回合数据核对日期、主客队及终场比分；球员数据未逐项核对 NBA 官方报告。统计仅计算本赛季常规赛，日期使用美国东部时间。" : "Scores and player stats come from archived ESPN sources. Internal game links match archived NBA shot and play-by-play feeds on date, home/away teams and final score; player rows were not individually verified against official NBA reports. Summary statistics use this regular season only. Dates are US Eastern."}</p>
    </section>
    <section className="glass-tile mt-6 overflow-hidden" aria-labelledby="sixers-regular-results"><h2 id="sixers-regular-results" className="px-4 pt-5 pb-3 sm:px-5 text-lg font-semibold">{isZh ? "常规赛" : "Regular season"} · {regular.length}</h2><Results games={regular} isZh={isZh} /></section>
    <section className="glass-tile mt-6 overflow-hidden" aria-labelledby="sixers-preseason-results"><h2 id="sixers-preseason-results" className="px-4 pt-5 pb-3 sm:px-5 text-lg font-semibold">{isZh ? "季前赛" : "Preseason"} · {preseason.length}</h2><p className="px-4 pb-3 sm:px-5 text-xs text-text-secondary">{isZh ? "季前赛结果已收录；比赛编号尚未跨数据源映射，可通过 ESPN 来源查看。" : "Preseason results are included. Their game IDs have not been mapped across sources; ESPN source links are available."}</p><Results games={preseason} isZh={isZh} /></section>
  </div>;
}
