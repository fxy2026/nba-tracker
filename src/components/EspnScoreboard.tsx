'use client';

import type { EspnScoreboardView, EspnScoreGame } from '@/lib/espn-scoreboard';
import { useLocale } from './LocaleProvider';
import TeamLogo from './TeamLogo';
import { TEAM_META } from '@/lib/teams';

function statusLabel(game: EspnScoreGame, zh: boolean): string {
  return ({ scheduled: zh ? '未开始' : 'Scheduled', live: zh ? '进行中' : 'Live', final: zh ? '已结束' : 'Final', postponed: zh ? '延期' : 'Postponed', canceled: zh ? '取消' : 'Canceled' })[game.status];
}
/** Separate cards avoid treating ESPN event/player IDs as NBA identities. */
export default function EspnScoreboard({ view }: { view: EspnScoreboardView }) {
  const { locale } = useLocale(), zh = locale === 'zh';
  if (view.state === 'unavailable') return <p role="status" className="mt-4 text-sm text-text-secondary">
    {zh ? '当日比分源暂时不可用，无法确认是否有比赛。已公布的常规赛赛程不代表当日比分。' : 'Daily score sources are unavailable; game availability could not be confirmed. Published regular-season fixtures do not establish today’s scores.'}
  </p>;
  return <section className="mt-6 min-w-0" aria-label={zh ? 'ESPN 当日比分' : 'ESPN daily scores'}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
      <h2 className="font-semibold text-text-primary">{zh ? '当日比赛' : 'Daily games'} · ESPN</h2>
      <span className="break-words">{view.timeZone}</span>
    </div>
    <p className="mb-2 text-xs text-text-secondary">{zh ? '查询时间' : 'Retrieved'}: <time dateTime={view.retrievedAtUTC}>{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { timeZone: view.timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(view.retrievedAtUTC))}</time></p>
    <p className="mb-3 text-xs text-text-secondary">{zh ? 'NBA 数据暂缺，使用 ESPN 备用比分。比赛详情在 ESPN 打开。' : 'NBA data is unavailable. Scores are supplied by ESPN; game details open on ESPN.'}</p>
    {view.games.length === 0 ? <p className="glass-tile p-4 text-sm text-text-secondary">{zh ? 'ESPN 在所选日期未列出比赛。' : 'ESPN lists no games on the selected date.'}</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {view.games.map(game => <article key={game.key} className="glass-tile min-w-0 overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <span>{game.seasonType === 1 ? (zh ? '季前赛' : 'Preseason') : game.seasonType === 3 ? (zh ? '季后赛' : 'Postseason') : (zh ? '常规赛' : 'Regular season')}</span>
          <span className={game.status === 'live' ? 'text-success' : ''}>{statusLabel(game, zh)}{game.status === 'live' ? ` · ${game.statusText}` : ''}</span>
        </div>
        <time dateTime={game.tipoffUTC} className="mb-3 block text-xs text-text-secondary">{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { timeZone: view.timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(game.tipoffUTC))}</time>
        {[game.away, game.home].map((team, index) => <div key={team.id} className="flex min-h-11 min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {team.tricode && <TeamLogo teamId={TEAM_META[team.tricode].teamId} tricode={team.tricode} size={28} />}
            <span className="min-w-0 truncate text-sm font-semibold" title={team.name}>{team.tricode ?? team.abbreviation}</span>
            <span className="text-[10px] text-text-secondary">{index === 0 ? (zh ? '客' : 'away') : (zh ? '主' : 'home')}</span>
          </div>
          <span className="font-mono text-xl font-semibold tabular-nums">{team.score ?? '—'}</span>
        </div>)}
        {game.sourceUrl && <a href={game.sourceUrl} aria-label={`${game.away.name} · ${game.home.name} · ${zh ? "在 ESPN 查看比赛" : "View game on ESPN"}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs text-accent underline underline-offset-4">{zh ? '在 ESPN 查看比赛' : 'View game on ESPN'} ↗</a>}
      </article>)}
    </div>}
  </section>;
}
