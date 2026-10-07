'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { useLocale } from './LocaleProvider';
import TeamLogo from './TeamLogo';
import { TEAM_META } from '@/lib/teams';
import { localTz } from '@/lib/timezone';
import { homeDateUrl } from '@/lib/date-navigation';
import { fixtureDateInZone, normalizePlannedFixtureView, PLANNED_SOURCE_URL, type PlannedFixtureQuery, type PlannedFixtureView } from '@/lib/planned-fixtures';

export function PlannedSnapshotNote({ timeZone }: { timeZone: string }) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  return <div className="text-xs leading-relaxed text-text-secondary">
    <p>{isZh ? 'NBA 官方计划赛程 · 2026 年 8 月 13 日版本，可能变更。杯赛待定场次未收录。' : 'NBA published schedule · August 13, 2026 snapshot, subject to change. Cup-dependent games remain unassigned.'}</p>
    <div className="flex flex-wrap items-center gap-x-3">
      <span className="min-w-0 break-words">{isZh ? '显示时区' : 'Times shown in'}: {timeZone}</span>
      <a href={PLANNED_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-accent underline underline-offset-4">{isZh ? 'NBA 原始赛程 PDF' : 'NBA source PDF'}</a>
    </div>
  </div>;
}

/** Fixture-only presentation: deliberately no GameCard, score, live badge or /game link. */
export function PlannedFixtureSection({ view, compact = false }: { view: PlannedFixtureView; compact?: boolean }) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  if (view.state !== 'snapshot') return null;
  return <section aria-label={isZh ? '已公布的计划赛程' : 'Published planned fixtures'} className="glass-tile min-w-0 overflow-hidden my-4">
    <div className="px-4 pt-4 pb-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-2"><CalendarClock size={16} className="text-accent shrink-0" />{isZh ? '2026-27 计划赛程' : '2026-27 planned schedule'}</h2>
      <PlannedSnapshotNote timeZone={view.timeZone} />
    </div>
    {view.fixtures.length > 0 ? <ul className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} border-t border-border/60`}>
      {view.fixtures.map(fixture => <li key={fixture.key} className="min-w-0 border-b border-border/40 px-3 py-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-secondary">
          <time dateTime={fixture.tipoffUTC}>{new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', { timeZone: view.timeZone, month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(fixture.tipoffUTC))}</time>
          <span>{isZh ? '计划时间' : 'Planned tipoff'}</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Link href={`/team/${fixture.awayTricode}`} className="flex min-h-[44px] min-w-0 items-center gap-2 font-semibold text-sm"><TeamLogo teamId={TEAM_META[fixture.awayTricode].teamId} tricode={fixture.awayTricode} size={24} />{fixture.awayTricode}</Link>
          <span className="text-xs text-text-secondary">{fixture.relationship === 'vs' ? (isZh ? '中立场地' : 'neutral site') : (isZh ? '客 / 主' : 'away / home')}</span>
          <Link href={`/team/${fixture.homeTricode}`} className="flex min-h-[44px] min-w-0 items-center gap-2 font-semibold text-sm">{fixture.homeTricode}<TeamLogo teamId={TEAM_META[fixture.homeTricode].teamId} tricode={fixture.homeTricode} size={24} /></Link>
        </div>
        {fixture.venue && <p className="text-xs text-text-secondary mt-1 break-words">{fixture.venue.name} · {fixture.venue.city}</p>}
      </li>)}
    </ul> : <div className="px-4 pb-4 text-sm text-text-secondary">
      <p>{isZh ? '此版本在所选日期没有已分配的常规赛。' : 'No assigned regular-season fixtures for this date in the snapshot.'}</p>
      {view.nextAvailableDate && <Link prefetch={false} href={homeDateUrl(view.nextAvailableDate, view.timeZone)} className="mt-2 inline-flex min-h-[44px] max-w-full flex-wrap items-center gap-2 rounded-lg border border-border px-3 text-accent">
        {isZh ? '查看下一比赛日' : 'Next published date'} {view.nextAvailableDate}<ArrowRight size={14} />
      </Link>}
    </div>}
  </section>;
}

/** Bounded upcoming slice, loaded only after the browser timezone is known.
 * Keyed state + cancellation prevent old team/date responses flashing on navigation. */
export default function PlannedFixturesPanel({ team, compact = false, fallback = null }: { team?: string; compact?: boolean; fallback?: ReactNode }) {
  const { locale } = useLocale();
  const [zone, setZone] = useState<string | null>(null);
  const [response, setResponse] = useState<{ key: string; view: PlannedFixtureView | null; error: boolean; loading: boolean }>({ key: '', view: null, error: false, loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser timezone is unavailable during server rendering
    setZone(localTz());
  }, []);
  const from = zone ? fixtureDateInZone(new Date().toISOString(), zone) : '';
  // A new attempt must hide the previous error while its request is pending.
  const key = `${team ?? ''}:${zone ?? ''}:${from}:${retry}`;
  useEffect(() => {
    if (!zone) return;
    const controller = new AbortController();
    const query: PlannedFixtureQuery = { mode: 'upcoming', from, timeZone: zone, limit: 8, ...(team ? { team } : {}) };
    const params = new URLSearchParams({ from, tz: zone, limit: '8', ...(team ? { team } : {}) });
    fetch(`/api/planned-fixtures?${params}`, { signal: controller.signal }).then(async result => {
      if (!result.ok) throw new Error('Planned fixtures unavailable');
      const view = normalizePlannedFixtureView(await result.json(), query);
      if (!view) throw new Error('Invalid planned fixture response');
      if (!controller.signal.aborted) setResponse({ key, view, error: false, loading: false });
    }).catch(() => { if (!controller.signal.aborted) setResponse({ key, view: null, error: true, loading: false }); });
    return () => controller.abort();
  }, [zone, team, from, key, retry]);
  // Remember pending selections too, so A → B → A cannot restore A's old result.
  if (response.key !== key) setResponse({ key, view: null, error: false, loading: true });
  if (response.key !== key || response.loading) return <p className="px-4 py-6 text-xs text-text-secondary" role="status">{locale === 'zh' ? '正在加载计划赛程…' : 'Loading published schedule…'}</p>;
  if (response.error) return <div className="glass-tile p-4 text-sm"><p>{locale === 'zh' ? '计划赛程暂时无法加载。' : 'Published schedule could not be loaded.'}</p><button className="min-h-[44px] text-accent" onClick={() => setRetry(value => value + 1)}>{locale === 'zh' ? '重试' : 'Retry'}</button></div>;
  return response.view?.state === 'snapshot' ? <PlannedFixtureSection view={response.view} compact={compact} /> : fallback;
}
