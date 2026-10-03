"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SeasonHeatmapResource } from "@/components/SeasonHeatmapExplorer";
import { startSeasonRequest } from "@/components/shot-map/shot-map-request-state";
import { datasetKey, heatmapCopy, percent, type HeatmapLocale } from "@/components/season-heatmap/season-heatmap-display";
import { courtSeasonHeatmapUrl, decodeCourtSeasonHeatmapResource } from "@/lib/season-heatmap-request";
import type { HeatmapIdentity, SeasonHeatmapDisplayRow } from "@/lib/season-heatmap";
import styles from "@/components/shot-map/shot-map.module.css";
import CareerArchiveCourt from "./CareerArchiveCourt";
import linkedStyles from "./career-season-heatmap.module.css";

interface Props { playerId: number; season: string; locale: HeatmapLocale }
/** The career scrubber is the only season owner. A new identity discards both
 * the old result and zone detail synchronously, before the next effect runs. */
export default function CareerSeasonHeatmap({ playerId, season, locale }: Props) {
  const identity: HeatmapIdentity = { playerId, season, seasonType: "Regular Season" };
  return <LinkedSeason key={datasetKey(identity)} identity={identity} locale={locale} />;
}
function LinkedSeason({ identity, locale }: { identity: HeatmapIdentity; locale: HeatmapLocale }) {
  const [resource, setResource] = useState<SeasonHeatmapResource>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<SeasonHeatmapDisplayRow["id"] | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const selectZone = (zone: string | null) => {
    if (!zone || resource.status !== "ready" || ![...resource.data.zones, ...resource.data.residuals].some(row => row.id === zone)) return;
    setSelectedId(zone as SeasonHeatmapDisplayRow["id"]);
    setSelectionRevision(value => value + 1);
  };
  useEffect(() => {
    if (!selectedId || !selectionRevision) return;
    const panel = root.current?.querySelector<HTMLElement>('[data-heatmap-details="true"]');
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      panel.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "auto" });
    }
  }, [selectedId, selectionRevision]);
  const dismissDetails = () => {
    setSelectedId(null);
    if (selectedId) root.current?.querySelector<HTMLElement>(`[data-zone-id="${selectedId}"], [data-list-zone="${selectedId}"]`)?.focus();
  };
  const { playerId, season, seasonType } = identity;
  useEffect(() => {
    if (!season) return;
    return startSeasonRequest({ playerId, season, seasonType }, courtSeasonHeatmapUrl,
      decodeCourtSeasonHeatmapResource, setResource, retry > 0);
  }, [playerId, season, seasonType, retry]);
  const data = resource.status === "ready" ? resource.data : null;
  const t = heatmapCopy(data, locale);
  const status = season ? resource.status : "unavailable";
  return <section ref={root} onKeyDown={event => { if (event.key === "Escape" && selectedId) { event.stopPropagation(); dismissDetails(); } }} className={`${styles.explorer} ${linkedStyles.linked}`} lang={locale === "zh" ? "zh-CN" : "en"}
    aria-label={locale === "zh" ? "所选赛季投篮档案" : "Selected-season shot archive"}
    data-career-shot-archive={datasetKey(identity)} data-season-heatmap={data ? "archive-summary" : "unresolved-archive"}>
    <div className={linkedStyles.heading}>
      <h3>{season} · {t.regular}</h3>
      {data && <span data-season-total="true">{percent(data.totals.fga ? data.totals.fgm / data.totals.fga : null)} · {data.totals.fgm} / {data.totals.fga}</span>}
    </div>
    {data ? <CareerArchiveCourt data={data} locale={locale}
      selectedId={selectedId} onSelect={selectZone} onDismissDetails={dismissDetails} detailsId={`${id}-details`} /> :
      <div className={styles.state} role={status === "error" ? "alert" : "status"} aria-busy={status === "loading"}>
        <p>{status === "loading" ? t.loading : status === "error" ? t.error : t.unavailable}</p>
        {status === "error" && <button type="button" onClick={() => setRetry(value => value + 1)}>{t.retry}</button>}
        <small>{locale === "zh"
          ? "仅使用本地投篮档案；未收录的赛季保持缺失，不以近期比赛样本替代。空白不表示零出手。"
          : "Local shot archive only. Missing seasons remain unavailable, without recent-game sample substitutes. A blank chart does not mean zero attempts."}</small>
      </div>}
  </section>;
}
