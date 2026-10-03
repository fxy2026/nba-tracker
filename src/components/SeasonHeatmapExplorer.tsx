"use client";

import { useId, useState } from "react";
import Select from "@/components/ui/Select";
import type { HeatmapIdentity, HeatmapSeasonType, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import SeasonHeatmapCourt from "./season-heatmap/SeasonHeatmapCourt";
import { copy, datasetKey, heatmapCopy, HEATMAP_COLORS, LOW_SAMPLE_ATTEMPTS, percent, rate, referenceDifference, sameIdentity, share, zoneColor, zoneName, type HeatmapLocale, type HeatmapMode } from "./season-heatmap/season-heatmap-display";
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
  const id = useId(), detailsId = `${id}-details`;
  const metadata = datasets.filter(dataset => dataset.playerId === player.id);
  const seasons = [...new Set(metadata.map(dataset => dataset.season))].sort().reverse();
  const [selection, setSelection] = useState<HeatmapIdentity>(() => ({ playerId: player.id, season: initialSelection?.season ?? seasons[0] ?? "", seasonType: initialSelection?.seasonType ?? "Regular Season" }));
  const [mode, setMode] = useState<HeatmapMode>(initialMode);
  const [selectedId, setSelectedId] = useState<SeasonHeatmapDisplayRow["id"] | null>(null);
  const currentMetadata = metadata.find(dataset => sameIdentity(dataset, selection));
  const resource = currentMetadata?.availability === "available" ? resources[datasetKey(selection)] : undefined;
  const matches = resource?.status !== "ready" || sameIdentity(resource.data, selection);
  const data = resource?.status === "ready" && matches ? resource.data : null;
  const t = heatmapCopy(data, locale);
  const selected = data ? [...data.zones, ...data.residuals].find(row => row.id === selectedId) ?? null : null;
  const status = !matches ? "error" : resource?.status ?? "unavailable";
  const noBaseline = data && (!data.benchmark || data.zones.some(row => !row.leagueAverage));
  function choose(next: HeatmapIdentity) {
    if (sameIdentity(next, selection)) return;
    setSelection(next); setSelectedId(null);
    if (metadata.some(dataset => sameIdentity(dataset, next) && dataset.availability === "available")) onRequest?.(next, "select");
  }
  const typeName = (type: HeatmapSeasonType) => type === "Regular Season" ? t.regular : t.playoffs;
  return <section className={styles.explorer} aria-labelledby={`${id}-heading`} lang={locale === "zh" ? "zh-CN" : "en"} data-season-heatmap={!data && publication === "verified" ? "unresolved-archive" : data?.status === "archive-summary" ? "archive-summary" : publication === "verified" ? "verified-aggregate" : "private-preview"}>
    <header className={styles.header}>
      <div className={styles.eyebrow}><span>{t.archive}</span><span>{!data && publication === "verified" ? locale === "zh" ? "投篮档案" : "SHOT ARCHIVE" : data?.status === "archive-summary" || publication === "verified" ? t.verified : t.preview}</span></div>
      <h2 id={`${id}-heading`}>{player.name}</h2>
      <div className={styles.identity}><span>{player.secondaryName}</span><span>{player.teamLabel}</span></div>
    </header>
    <div className={styles.filters}>
      <div className={styles.seasonLabel}><Select aria-label={t.season} className={styles.seasonSelect} value={selection.season} disabled={!seasons.length} onValueChange={season => choose({ ...selection, season })}
        options={[...(!seasons.includes(selection.season) ? [{ value: selection.season, label: selection.season || "—" }] : []), ...seasons.map(season => ({ value: season, label: season.replace("-", "–") }))]} /></div>
      <div className={styles.segment} role="group" aria-label={t.type}>
        {(["Regular Season", "Playoffs"] as const).map(type => <button type="button" key={type} aria-pressed={selection.seasonType === type} onClick={() => choose({ ...selection, seasonType: type })}>{typeName(type)}</button>)}
      </div>
    </div>
    <div className={styles.sectionHeading}><h3>{t.title}</h3>{data && <span data-season-total="true">{percent(data.totals.fga ? data.totals.fgm / data.totals.fga : null)} · {data.totals.fgm} / {data.totals.fga}</span>}</div>
    {data ? <>
      <div className={styles.modeSelector} role="group" aria-label={t.mode}>
        {(["reference", "percentage", "volume"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{t[value]}</button>)}
      </div>
      {data.status === "archive-summary" && data.archive && <ArchiveContext data={data} locale={locale} />}
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
      <footer className={styles.footer}><span>{data.coverage.aggregate === "full-season-reconciled" ? t.full : t.partial}</span><span>{data.coverage.normalZoneAttempts} {locale === "zh" ? "分区出手" : "mapped attempts"}{data.coverage.residualAttempts > 0 ? ` + ${data.coverage.residualAttempts} ${locale === "zh" ? "未映射出手" : "unmapped"}` : ""} = {data.coverage.seasonAttemptDenominator}</span><p>{t.point}</p>{data.source && <p><a className={styles.sourceLink} href={data.source.url} target="_blank" rel="noreferrer">{t.source}</a><span> · {t.sourceDate}: {data.source.capturedAtUtc?.slice(0, 10) ?? data.source.observedAtWindowUtc?.[0].slice(0, 10) ?? t.missing} UTC</span></p>}{data.status === "archive-summary" && data.archive && <>
        <p>{locale === "zh" ? "档案整体比赛日期" : "Archive-wide game dates"}: {data.archive.sourceCoverage.from} – {data.archive.sourceCoverage.to} · {locale === "zh" ? "来源元数据核验日期" : "Source metadata observed"}: {data.archive.metadataObservedAtUtc.slice(0, 10)} UTC</p>
        {data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA" && <p>{locale === "zh" ? "联盟参考范围" : "League reference period"}: {data.benchmark.season} · {typeName(data.benchmark.seasonType)} · {data.benchmark.from} – {data.benchmark.to}. {data.benchmark.shotBearingGames} {locale === "zh" ? "场有投篮记录的比赛" : "shot-bearing games"}; {data.benchmark.leagueFgm} / {data.benchmark.leagueFga} {locale === "zh" ? "联盟命中 / 出手" : "league makes / attempts"}.</p>}
      </>}</footer>
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
  const t = heatmapCopy(data, locale), delta = referenceDifference(row, data.benchmark), residual = row.id === "backcourt" || row.id === "unclassified" || row.id === "classification-conflict";
  return <><span className={styles.detailEyebrow}>{t.details}</span><h4>{zoneName(row.id, locale)}</h4><div className={styles.detailRate}>{rate(row)}</div>
    <dl><div><dt>{t.made}</dt><dd>{row.fgm} / {row.fga}</dd></div>{data.status === "archive-summary" && <div><dt>{locale === "zh" ? "明确三分命中 / 出手" : "Explicit 3P made / attempts"}</dt><dd>{row.fg3m} / {row.fg3a}</dd></div>}<div><dt>{t.attempts}</dt><dd>{share(row)}<small>{row.fga} / {data.coverage.seasonAttemptDenominator}</small></dd></div><div><dt>{t.la}</dt><dd>{data.benchmark && row.leagueAverage ? `${row.leagueAverage.displayedPct}%` : t.missing}{row.leagueAverage?.provenance === "weighted-archive-counts-not-official-displayed-LA" && <small>{row.leagueAverage.leagueFgm} / {row.leagueAverage.leagueFga}</small>}</dd></div><div><dt>{t.difference}</dt><dd>{delta === null ? t.missing : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${t.pp}`}</dd></div></dl>
    {row.fga === 0 ? <p className={styles.note}>{t.none}</p> : row.fga < LOW_SAMPLE_ATTEMPTS && <p className={styles.lowSample}>{t.lowDetail}</p>}
    {residual && <p className={styles.note}>{t.residualNote}</p>}<p className={styles.note}>{t.benchmark}</p>
  </>;
}

function ArchiveContext({ data, locale }: { data: SeasonHeatmapRendererDTO; locale: HeatmapLocale }) {
  const archive = data.archive!;
  const zh = locale === "zh";
  const control = archive.officialControl;
  const shortfall = control && archive.coverageStatus === "official-shooting-totals-mismatch" ? {
    fgm: control.fgm - data.totals.fgm,
    fga: control.fga - data.totals.fga,
    fg3m: control.fg3m - archive.fg3m,
    fg3a: control.fg3a - archive.fg3a,
  } : null;
  const hasShortfall = shortfall && Object.values(shortfall).every(value => value >= 0) && Object.values(shortfall).some(value => value > 0);
  const status = archive.coverageStatus === "official-shooting-totals-match"
    ? zh ? "四项投篮总数与官方核验值一致；逐次投篮、分区与联盟覆盖完整性尚未独立核验。" : "The four shooting totals match the official control. Individual shots, zones and complete league coverage are not independently verified."
    : archive.coverageStatus === "official-shooting-totals-mismatch"
      ? zh ? "档案总数与官方核验值不一致；本图保留原始档案统计，不补造缺失投篮。" : "Archive totals differ from the official control. This chart preserves archive counts; missing shots are not invented."
      : zh ? "档案总数尚未与官方赛季总数核验；不宣称全赛季完整覆盖。" : "Archive totals have not been reconciled to official season totals; complete season coverage is not claimed.";
  return <div className={styles.archiveContext} data-archive-coverage={archive.coverageStatus}>
    <p>{status}</p>
    {hasShortfall && <p data-archive-shortfall="true">{zh
      ? `档案较官方核验值少 ${shortfall.fgm} 次投篮命中、${shortfall.fga} 次出手；其中三分少 ${shortfall.fg3m} 次命中、${shortfall.fg3a} 次出手。缺口不分配到球场分区。`
      : `Archive shortfall vs official control: ${shortfall.fgm} made field ${shortfall.fgm === 1 ? "goal" : "goals"} and ${shortfall.fga} ${shortfall.fga === 1 ? "attempt" : "attempts"}; ${shortfall.fg3m} made ${shortfall.fg3m === 1 ? "three-pointer" : "three-pointers"} and ${shortfall.fg3a} three-point ${shortfall.fg3a === 1 ? "attempt" : "attempts"}. The shortfall is not assigned to court zones.`}</p>}
    <p>{zh ? "档案投篮命中 / 出手" : "Archive FG made / attempts"}: {data.totals.fgm} / {data.totals.fga}</p>
    <p>{zh ? "档案三分命中 / 出手" : "Archive 3P made / attempts"}: {archive.fg3m} / {archive.fg3a} · {zh ? "有投篮记录的比赛" : "Shot-bearing games"}: {archive.shotBearingGames} · {zh ? "官方 GP" : "Official GP"}: {archive.officialGp ?? (zh ? "未提供" : "unavailable")}</p>
    <p>{zh ? "有投篮记录的场数并非出场数，零出手比赛可能不在档案中。三分仅按明确 SHOT_TYPE 统计，不由 24+ 英尺分区推断。" : "Shot-bearing games are not GP: zero-attempt games may be absent. Three-pointers use explicit SHOT_TYPE, never 24+ ft. zone membership."}</p>
    {archive.officialControl && <p><a className={styles.sourceLink} href={archive.officialControl.url} target="_blank" rel="noreferrer">{zh ? "官方投篮总数核验来源" : "Official shooting-total control"}</a>: {archive.officialControl.fgm} / {archive.officialControl.fga} FG · {archive.officialControl.fg3m} / {archive.officialControl.fg3a} 3P · {archive.officialControl.capturedAtUtc.slice(0, 10)} UTC</p>}
  </div>;
}
