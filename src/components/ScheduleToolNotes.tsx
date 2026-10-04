import type { ReactNode } from 'react';
import { PlannedSnapshotNote } from './PlannedFixtures';

/** Compact route-local disclosure; the full qualifications remain available. */
export default function ScheduleToolNotes({ planned, isZh, children }: { planned: boolean; isZh: boolean; children: ReactNode }) {
  return <section aria-label={isZh ? '赛程范围与说明' : 'Schedule scope and notes'} className="mb-4 min-w-0 text-sm">
    {planned && <p className="font-medium leading-snug">{isZh ? '2026-27 部分计划 · 每队 80 场已分配、2 场待定' : '2026-27 partial plan · 80 assigned/team · 2 pending/team'}</p>}
    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{planned
      ? (isZh ? '美国东部时间（ET）· 2026 年 8 月 13 日版本 · 可能变更' : 'Eastern Time (ET) · Aug 13, 2026 snapshot · may change')
      : (isZh ? '日期按美国东部时间（ET）' : 'Dates in Eastern Time (ET)')}</p>
    <details className="mt-1">
      <summary className="min-h-[44px] cursor-pointer rounded-lg py-3 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent">{isZh ? '来源与计算说明' : 'Source and calculation notes'}</summary>
      <div className="space-y-3 pb-3 text-sm leading-relaxed text-text-secondary">
        {planned && <>
          <p className="font-medium">{isZh ? '2026-27 部分计划赛程 · 每队已分配 80 场' : '2026-27 partial planned schedule · 80 assigned games per team'}</p>
          <PlannedSnapshotNote timeZone="America/New_York" />
        </>}
        {children}
      </div>
    </details>
  </section>;
}
