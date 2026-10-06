import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import { TEAM_META } from "@/lib/teams";
import type { PlayerLogRow, PlayerLogStat } from "@/lib/player-game-log-data";
import styles from "./player-game-log.module.css";

const show = (value: number | null) => value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
const secondary: [PlayerLogStat, string][] = [["min", "MIN"], ["stl", "STL"], ["blk", "BLK"], ["oreb", "OREB"], ["dreb", "DREB"], ["tov", "TOV"], ["pf", "PF"], ["plusMinus", "+/−"]];
const shooting = [["fgm", "fga", "FG"], ["fg3m", "fg3a", "3P"], ["ftm", "fta", "FT"]] as const;

function Chevron({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" className={down ? styles.disclosureArrow : undefined}><path d={down ? "m5 7.5 5 5 5-5" : "m7.5 5 5 5-5 5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GameIdentity({ row, isZh }: { row: PlayerLogRow; isZh: boolean }) {
  const date = new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${row.date}T12:00:00Z`));
  return <>
    <div className={styles.cardMeta}><time dateTime={row.date}>{date}</time><span className={`${styles.result} ${row.wl === "W" ? styles.win : row.wl === "L" ? styles.loss : ""}`}>{row.wl === "W" ? (isZh ? "胜" : "WIN") : row.wl === "L" ? (isZh ? "负" : "LOSS") : "—"}</span></div>
    <div className={styles.cardBody}>
      <div className={styles.opponent}><span className={styles.teamLogo}><TeamLogo teamId={TEAM_META[row.opponent]?.teamId} tricode={row.opponent} size={30} /></span><span><strong><span className={styles.venue}>{row.home ? "vs" : "@"}</span> {row.opponent}</strong><span className={styles.homeAway}>{row.team} · {row.home ? (isZh ? "主场" : "Home") : (isZh ? "客场" : "Away")}</span></span></div>
      <dl className={styles.coreStats}>{([['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{show(row[key])}</dd></div>)}</dl>
      {row.internalGameId && <span className={styles.gameArrow}><Chevron /></span>}
    </div>
  </>;
}
function DetailsLabel({ row, isZh }: { row: PlayerLogRow; isZh: boolean }) {
  return <span className={styles.detailsLabel}><span>{show(row.min)} MIN <span aria-hidden="true">·</span> {show(row.fgm)}/{show(row.fga)} FG</span><span>{isZh ? "完整数据" : "All stats"}<Chevron down /></span></span>;
}
export function PlayerGameRowDetails({ row, isZh }: { row: PlayerLogRow; isZh: boolean }) {
  return <div className={styles.detailsContent}>
    <dl className={styles.shootingStats}>{shooting.map(([made, attempts, label]) => <div key={label}><dt>{label}</dt><dd>{show(row[made])}<span> / {show(row[attempts])}</span></dd></div>)}</dl>
    <dl className={styles.secondaryStats}>{secondary.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{show(row[key])}</dd></div>)}</dl>
    {!row.internalGameId && <p className={styles.unavailable}>{isZh ? "本站暂未收录此场完整比赛页，以上为该球员的逐场记录。" : "A full game page is not available here yet. These are this player’s recorded stats."}</p>}
    {row.assistReview && <p className={styles.unavailable}>{isZh ? "助攻核对：StatMuse 为 4，ESPN 原记录为 5。4 次助攻可与 NBA 赛季总计对齐；尚未通过 NBA 官方单场技术统计核验。" : "Assist review: StatMuse lists 4; the original ESPN record lists 5. Using 4 reconciles the NBA season total; an official NBA individual box score has not been verified."} <a className={styles.sourceLink} href={row.assistReview.url} target="_blank" rel="noopener noreferrer">StatMuse ↗</a></p>}
    <a className={styles.sourceLink} href={row.sourceUrl} target="_blank" rel="noopener noreferrer">{isZh ? "查看原始来源" : "Original source"}{row.sourceProvider === "StatMuse" ? " · StatMuse" : row.id.startsWith("espn:") ? " · ESPN" : ""} ↗</a>
  </div>;
}
export default function PlayerGameCards({ rows, isZh }: { rows: PlayerLogRow[]; isZh: boolean }) {
  return <ol className={styles.mobileGames} aria-label={isZh ? "逐场比赛" : "Game-by-game results"}>
    {rows.map(row => <li key={row.id} className={styles.gameCard}>
      {row.internalGameId ? <>
        <Link href={`/game/${row.internalGameId}`} prefetch={false} className={styles.cardLink} aria-label={`${row.date} ${row.team} ${row.home ? "vs" : "@"} ${row.opponent} · ${row.wl ?? "—"} · ${show(row.pts)} PTS, ${show(row.reb)} REB, ${show(row.ast)} AST · ${isZh ? "比赛详情" : "Game details"}`}><GameIdentity row={row} isZh={isZh} /></Link>
        <details className={styles.cardDisclosure}><summary aria-label={`${row.date} ${row.opponent} · ${isZh ? "完整球员数据" : "All player stats"}`}><DetailsLabel row={row} isZh={isZh} /></summary><PlayerGameRowDetails row={row} isZh={isZh} /></details>
      </> : <details className={`${styles.cardDisclosure} ${styles.unmatchedDisclosure}`}><summary><span className={styles.cardMain}><GameIdentity row={row} isZh={isZh} /></span><DetailsLabel row={row} isZh={isZh} /></summary><PlayerGameRowDetails row={row} isZh={isZh} /></details>}
    </li>)}
  </ol>;
}
