"use client";

import { useId, useState } from "react";
import type { HeatmapIdentity, HeatmapSeasonType, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import SeasonHeatmapCourt from "./season-heatmap/SeasonHeatmapCourt";
import { copy, datasetKey, HEATMAP_COLORS, LOW_SAMPLE_ATTEMPTS, percent, rate, referenceDifference, sameIdentity, share, zoneColor, zoneName, type HeatmapLocale, type HeatmapMode } from "./season-heatmap/season-heatmap-display";
import styles from "./season-heatmap/season-heatmap.module.css";

export type SeasonHeatmapResource =
  | { status: "ready"; data: SeasonHeatmapRendererDTO }
  | { status: "loading" }
  | { status: "error" }
  | { status: "unavailable" };
export interface SeasonHeatmapDatasetMetadata extends HeatmapIdentity { availability: "available" | "unavailable" }
export interface SeasonHeatmapExplorerProps {
  player: { id: number; name: string; secondaryName?: string; teamLabel?: string };
  locale?: HeatmapLocale;
  /** Only explicitly supplied seasons appear. No inferred all-season coverage. */
  datasets: readonly SeasonHeatmapDatasetMetadata[];
  /** Ready values must come from the server-only validated DTO projection. */
  resources: Readonly<Record<string, SeasonHeatmapResource | undefined>>;
  initialSelection?: Pick<HeatmapIdentity, "season" | "seasonType">;
  initialMode?: HeatmapMode;
  publication?: "preview" | "verified";
  /** The host owns loading/error updates. This component never fetches. */
  onRequest?: (identity: HeatmapIdentity, reason: "select" | "retry") => void;
}

/** Presentation-only explorer; the host supplies validated resources and owns requests. */
export default function SeasonHeatmapExplorer(props: SeasonHeatmapExplorerProps) {
  // Replacing a player resets selection and zone focus without a stale-data frame.
  return <Explorer key={props.player.id} {...props} />;
}
function Explorer({ player, locale = "en", datasets, resources, initialSelection, initialMode = "reference", publication = "preview", onRequest }: SeasonHeatmapExplorerProps) {
  const t = copy[locale], id = useId(), detailsId = `${id}-details`;
  const metadata = datasets.filter(dataset => dataset.playerId === player.id);
  const seasons = [...new Set(metadata.map(dataset => dataset.season))].sort().reverse();
  const [selection, setSelection] = useState<HeatmapIdentity>(() => ({ playerId: player.id, season: initialSelection?.season ?? seasons[0] ?? "", seasonType: initialSelection?.seasonType ?? "Regular Season" }));
  const [mode, setMode] = useState<HeatmapMode>(initialMode);
  const [selectedId, setSelectedId] = useState<SeasonHeatmapDisplayRow["id"] | null>(null);
  const currentMetadata = metadata.find(dataset => sameIdentity(dataset, selection));
  const resource = currentMetadata?.availability === "available" ? resources[datasetKey(selection)] : undefined;
  const matches = resource?.status !== "ready" || sameIdentity(resource.data, selection);
  const data = resource?.status === "ready" && matches ? resource.data : null;
  const selected = data ? [...data.zones, ...data.residuals].find(row => row.id === selectedId) ?? null : null;
  const status = !matches ? "error" : resource?.status ?? "unavailable";
  const noBaseline = data && (!data.benchmark || data.zones.some(row => !row.leagueAverage));
  function choose(next: HeatmapIdentity) {
    if (sameIdentity(next, selection)) return;
    setSelection(next); setSelectedId(null);
    if (metadata.some(dataset => sameIdentity(dataset, next) && dataset.availability === "available")) onRequest?.(next, "select");
  }
  const typeName = (type: HeatmapSeasonType) => type === "Regular Season" ? t.regular : t.playoffs;
  return <section className={styles.explorer} aria-labelledby={`${id}-heading`} lang={locale === "zh" ? "zh-CN" : "en"} data-season-heatmap={publication === "verified" ? "verified-aggregate" : "private-preview"}>
    <header className={styles.header}>
      <div className={styles.eyebrow}><span>{t.archive}</span><span>{publication === "verified" ? t.verified : t.preview}</span></div>
      <h2 id={`${id}-heading`}>{player.name}</h2>
      <div className={styles.identity}><span>{player.secondaryName}</span><span>{player.teamLabel}</span></div>
    </header>
    <div className={styles.filters}>
      <label className={styles.seasonLabel}><span className={styles.srOnly}>{t.season}</span><select aria-label={t.season} value={selection.season} disabled={!seasons.length} onChange={event => choose({ ...selection, season: event.target.value })}>
        {!seasons.includes(selection.season) && <option value={selection.season}>{selection.season || "—"}</option>}
        {seasons.map(season => <option key={season} value={season}>{season.replace("-", "–")}</option>)}
      </select></label>
      <div className={styles.segment} role="group" aria-label={t.type}>
        {(["Regular Season", "Playoffs"] as const).map(type => <button type="button" key={type} aria-pressed={selection.seasonType === type} onClick={() => choose({ ...selection, seasonType: type })}>{typeName(type)}</button>)}
      </div>
    </div>
    <div className={styles.sectionHeading}><h3>{t.title}</h3>{data && <span data-season-total="true">{percent(data.totals.fga ? data.totals.fgm / data.totals.fga : null)} · {data.totals.fgm} / {data.totals.fga}</span>}</div>
    {data ? <>
      <div className={styles.modeSelector} role="group" aria-label={t.mode}>
        {(["reference", "percentage", "volume"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{t[value]}</button>)}
      </div>
      <div className={styles.content}>
        <div className={styles.visual}>
          <SeasonHeatmapCourt data={data} mode={mode} locale={locale} selectedId={selected?.id ?? null} onSelect={setSelectedId} detailsId={detailsId} />
          <Legend mode={mode} locale={locale} neutral={Boolean(noBaseline) || data.zones.some(row => row.fga === 0)} />
          <div className={styles.reading}><span>{mode === "volume" ? t.shareRead : t.read}</span><span>{t.low}</span></div>
          <p className={styles.note}>{mode === "reference" ? t.benchmark : mode === "volume" ? `${t.attempts}: ${data.coverage.seasonAttemptDenominator} ${locale === "zh" ? "次出手" : "attempts"}.` : locale === "zh" ? "颜色表示实际命中率，不与联盟基准比较。" : "Colors show absolute FG%, without a league comparison."}</p>
          {mode === "reference" && noBaseline && <p className={styles.note}>{t.noBaseline}</p>}
          <p className={styles.note}>{t.schematic}</p>
        </div>
        <aside className={styles.details} id={detailsId} aria-label={t.details} aria-live="polite" aria-atomic="true">
          {selected ? <ZoneDetails row={selected} data={data} locale={locale} /> : <div className={styles.emptyDetails}><span className={styles.detailEyebrow}>{t.details}</span><h4>{t.hint}</h4><p>{locale === "zh" ? "点击球场分区，或使用下方分区列表。" : "Tap the court or use the zone list below."}</p><p>{t.low}</p></div>}
        </aside>
      </div>
      {data.residuals.length > 0 && <section className={styles.residuals} aria-label={t.residual}>
        <h4>{t.residual}</h4><p className={styles.note}>{t.residualNote}</p>
        <div>{data.residuals.map(row => <ZoneButton row={row} data={data} mode={mode} selectedId={selected?.id ?? null} locale={locale} onSelect={setSelectedId} detailsId={detailsId} key={row.id} />)}</div>
      </section>}
      <details className={styles.zoneList}>
        <summary>{t.allZones} <span>{data.zones.length}</span></summary>
        <div className={styles.listRows}>{data.zones.map(row => <ZoneButton row={row} data={data} mode={mode} selectedId={selected?.id ?? null} locale={locale} onSelect={setSelectedId} detailsId={detailsId} key={row.id} />)}</div>
      </details>
      <footer className={styles.footer}><span>{data.coverage.aggregate === "full-season-reconciled" ? t.full : t.partial}</span><span>{data.coverage.normalZoneAttempts} {locale === "zh" ? "分区出手" : "mapped attempts"}{data.coverage.residualAttempts > 0 ? ` + ${data.coverage.residualAttempts} ${locale === "zh" ? "未映射出手" : "unmapped"}` : ""} = {data.coverage.seasonAttemptDenominator}</span><p>{t.point}</p>{data.source && <p><a className={styles.sourceLink} href={data.source.url} target="_blank" rel="noreferrer">{t.source}</a><span> · {t.sourceDate}: {data.source.capturedAtUtc?.slice(0, 10) ?? data.source.observedAtWindowUtc?.[0].slice(0, 10) ?? t.missing} UTC</span></p>}</footer>
    </> : <div className={styles.state} role={status === "error" ? "alert" : "status"} aria-busy={status === "loading"}>
      <span className={styles.detailEyebrow}>{selection.season} · {typeName(selection.seasonType)}</span>
      <p>{!seasons.length ? t.empty : !matches ? t.wrong : status === "loading" ? t.loading : status === "error" ? t.error : t.unavailable}</p>
      {status === "error" && onRequest && <button type="button" onClick={() => onRequest(selection, "retry")}>{t.retry}</button>}
      <small>{t.known}</small>
    </div>}
  </section>;
}
function Legend({ mode, locale, neutral }: { mode: HeatmapMode; locale: HeatmapLocale; neutral: boolean }) {
  const t = copy[locale];
  const entries = mode === "reference" ? [[HEATMAP_COLORS.above, t.above], [HEATMAP_COLORS.near, t.near], [HEATMAP_COLORS.below, t.below]] : mode === "percentage" ? [[HEATMAP_COLORS.below, "<30%"], [HEATMAP_COLORS.lightBlue, "30–<45%"], [HEATMAP_COLORS.near, "45–<60%"], [HEATMAP_COLORS.above, "≥60%"]] : [[HEATMAP_COLORS.below, "<5%"], [HEATMAP_COLORS.near, "5–<15%"], [HEATMAP_COLORS.above, "≥15%"]];
  if (neutral) entries.push([HEATMAP_COLORS.neutral, mode === "reference" ? t.neutral : t.none]);
  return <div className={styles.legend} aria-label={t.mode}>{entries.map(([color, label]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div>;
}
function ZoneButton({ row, data, mode, selectedId, locale, onSelect, detailsId }: { row: SeasonHeatmapDisplayRow; data: SeasonHeatmapRendererDTO; mode: HeatmapMode; selectedId: string | null; locale: HeatmapLocale; onSelect: (id: SeasonHeatmapDisplayRow["id"]) => void; detailsId: string }) {
  return <button type="button" className={styles.zoneButton} aria-pressed={row.id === selectedId} aria-controls={detailsId} data-list-zone={row.id} onClick={() => onSelect(row.id)}>
    <span><i style={{ backgroundColor: zoneColor(row, mode, data.benchmark) }} />{zoneName(row.id, locale)}</span><span>{rate(row)} · {row.fgm}/{row.fga}{row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? "*" : ""}<small>{share(row)} {copy[locale].volume}</small></span>
  </button>;
}
function ZoneDetails({ row, data, locale }: { row: SeasonHeatmapDisplayRow; data: SeasonHeatmapRendererDTO; locale: HeatmapLocale }) {
  const t = copy[locale], delta = referenceDifference(row, data.benchmark), residual = row.id === "backcourt" || row.id === "unclassified";
  return <><span className={styles.detailEyebrow}>{t.details}</span><h4>{zoneName(row.id, locale)}</h4><div className={styles.detailRate}>{rate(row)}</div>
    <dl><div><dt>{t.made}</dt><dd>{row.fgm} / {row.fga}</dd></div><div><dt>{t.attempts}</dt><dd>{share(row)}<small>{row.fga} / {data.coverage.seasonAttemptDenominator}</small></dd></div><div><dt>{t.la}</dt><dd>{data.benchmark && row.leagueAverage ? `${row.leagueAverage.displayedPct}%` : t.missing}</dd></div><div><dt>{t.difference}</dt><dd>{delta === null ? t.missing : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${t.pp}`}</dd></div></dl>
    {row.fga === 0 ? <p className={styles.note}>{t.none}</p> : row.fga < LOW_SAMPLE_ATTEMPTS && <p className={styles.lowSample}>{t.lowDetail}</p>}
    {residual && <p className={styles.note}>{t.residualNote}</p>}<p className={styles.note}>{t.benchmark}</p>
  </>;
}
