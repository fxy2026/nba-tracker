import PlayerCareerSource from "@/components/player/PlayerCareerSource";
import type { ArchivedCareerProvenance } from "@/lib/player-career-provenance";

/** Compact only in CareerArc; detailed provenance remains available natively. */
export default function CareerArchiveNotice({ provenance, isZh, checkingLive, onRetry }: {
  provenance: ArchivedCareerProvenance;
  isZh: boolean;
  checkingLive: boolean;
  onRetry: () => void;
}) {
  const { firstSeason, lastSeason, seasonCount } = provenance.coverage;
  return <div className="border-l-2 border-accent/40 pl-3 text-xs text-text-secondary">
    <p className="font-medium text-text-primary">{isZh ? "NBA.com 存档快照" : "Archived NBA.com snapshot"}</p>
    <p className="mt-1">{firstSeason} – {lastSeason} · {isZh ? `${seasonCount} 个常规赛赛季` : `${seasonCount} regular seasons`}</p>
    <p role="status" className="mt-1">{checkingLive
      ? isZh ? "正在检查实时来源…" : "Checking live sources…"
      : isZh ? "实时更新不可用或历史不完整。" : "Live refresh unavailable or history incomplete."}</p>
    <div className="flex items-start gap-3">
      <details className="min-w-0 flex-1">
        <summary className="min-h-11 content-center cursor-pointer text-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {isZh ? "来源与局限" : "Source & limitations"}
        </summary>
        <div className="pb-2">
          <PlayerCareerSource provenance={provenance} isZh={isZh} checkingLive={checkingLive} />
        </div>
      </details>
      <button type="button" disabled={checkingLive} onClick={onRetry} className="min-h-11 min-w-11 shrink-0 text-accent hover:underline disabled:opacity-50 disabled:cursor-default rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {isZh ? "重试" : "Retry"}
      </button>
    </div>
  </div>;
}
