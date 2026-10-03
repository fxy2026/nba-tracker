import { useId } from "react";
import { advanced14DisplayGeometry, seasonHeatmapCourt, SEASON_HEATMAP_DISPLAY_GEOMETRY_VERSION } from "@/lib/season-heatmap-geometry";
import { courtBasicDimensions, courtBasicGeometry, courtBasicMarkings, COURT_BASIC_GEOMETRY_VERSION } from "@/lib/season-heatmap-court-geometry";
import type { SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import { heatmapCopy, displayPositions, HEATMAP_COLORS, LOW_SAMPLE_ATTEMPTS, rate, share, zoneColor, zoneName, type HeatmapLocale, type HeatmapMode } from "./season-heatmap-display";
import styles from "./season-heatmap.module.css";

interface Props { data: SeasonHeatmapRendererDTO; mode: HeatmapMode; locale: HeatmapLocale; selectedId: string | null; onSelect: (id: SeasonHeatmapDisplayRow["id"]) => void; detailsId: string }
/** Only these 14 immutable source IDs can acquire spatial geometry. */
function AdvancedDistanceCourt({ data, mode, locale, selectedId, onSelect, detailsId }: Props) {
  const id = useId().replace(/:/g, "");
  const t = heatmapCopy(data, locale);
  const rows = new Map(data.zones.map(row => [row.id, row]));
  const geometries = advanced14DisplayGeometry.filter(g => rows.has(g.id));
  return <svg xmlns="http://www.w3.org/2000/svg" className={styles.court} viewBox={seasonHeatmapCourt.viewBox} data-display-geometry={SEASON_HEATMAP_DISPLAY_GEOMETRY_VERSION} role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
    <title id={`${id}-title`}>{`${t.title} · ${data.season}`}</title>
    <desc id={`${id}-desc`}>{t.hint}. {t.schematic} {t.low}.</desc>
    {geometries.map(g => {
      const row = rows.get(g.id)!;
      return <g key={g.id} role="button" tabIndex={0} aria-pressed={selectedId === row.id} aria-controls={detailsId}
        aria-label={`${zoneName(row.id, locale)}: ${rate(row)}, ${row.fgm} / ${row.fga}; ${t.attempts} ${share(row)}${row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? `; ${t.low}` : ""}`}
        className={styles.region} data-zone-id={row.id} onClick={() => onSelect(row.id)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}>
        <path data-zone-fill={row.id} d={g.pathD} fill={zoneColor(row, mode, data.benchmark)} stroke="#f5f0e4" strokeWidth="2" strokeLinejoin="round" />
      </g>;
    })}
    {/* Court markings are decorative and separate from the source-zone boundaries. */}
    <g pointerEvents="none" aria-hidden="true" data-court-markings="true" fill="none" stroke="#f5f0e4" strokeWidth="2.3" strokeOpacity=".9">
      <path d="M204 0V228H396V0 M228 228A72 72 0 0 0 372 228 M228 490A72 72 0 0 1 372 490" />
      <path d="M264 48H336" strokeWidth="3.6" /><circle cx="300" cy="60" r="11" strokeWidth="3" /><path d="M258 60A42 42 0 0 0 342 60" strokeWidth="3" />
      <rect x="1.4" y="1.4" width="597.2" height="487.2" strokeWidth="2.8" />
    </g>
    {geometries.map(g => {
      const row = rows.get(g.id)!, [x, y] = displayPositions[g.id], corner = g.id === "left-24-plus" || g.id === "right-24-plus";
      const background = zoneColor(row, mode, data.benchmark), cornerX = g.id === "left-24-plus" ? 18 : 582;
      return <g key={g.id} data-zone-label={row.id} fill={HEATMAP_COLORS.ink} textAnchor="middle" fontFamily="Arial, 'Noto Sans CJK SC', sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}
        pointerEvents={corner ? "auto" : "none"} aria-hidden="true" onClick={corner ? () => onSelect(row.id) : undefined}>
        {corner && <>
          <path data-corner-leader={row.id} d={`M${x},-10H${cornerX}V32`} fill="none" stroke={HEATMAP_COLORS.ink} strokeWidth="1.7" />
          <circle cx={cornerX} cy="32" r="3.1" fill={HEATMAP_COLORS.ink} />
          <rect x={x - 44} y="-66" width="88" height="55" rx="6" fill={background} />
        </>}
        <text x={x} y={y} fontSize="23" fontWeight="600">{mode === "volume" ? share(row) : rate(row)}</text>
        <text x={x} y={y + 23} fontSize="20.5">{row.fgm}/{row.fga}{row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? "*" : ""}</text>
      </g>;
    })}
  </svg>;
}


/** Court BASIC categories have their own immutable IDs and data projection.
 * The legacy distance chart is never reused as court-aligned counts. */
export default function SeasonHeatmapCourt(props: Props) {
  return props.data.geometryVersion === COURT_BASIC_GEOMETRY_VERSION ? <CourtAlignedHeatmap {...props} /> : <AdvancedDistanceCourt {...props} />;
}
function CourtAlignedHeatmap({ data, mode, locale, selectedId, onSelect, detailsId }: Props) {
  const id = useId().replace(/:/g, ""), t = heatmapCopy(data, locale);
  const rows = new Map(data.zones.map(row => [row.id, row]));
  const geometries = courtBasicGeometry.filter(g => rows.has(g.id));
  return <svg xmlns="http://www.w3.org/2000/svg" className={styles.court} viewBox={courtBasicDimensions.viewBox} data-display-geometry={COURT_BASIC_GEOMETRY_VERSION}
    role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
    <title id={`${id}-title`}>{`${t.title} · ${data.season}`}</title>
    <desc id={`${id}-desc`}>{t.hint}. {t.schematic} {t.low}.</desc>
    {geometries.map(g => {
      const row = rows.get(g.id)!;
      return <g key={g.id} role="button" tabIndex={0} aria-pressed={selectedId === row.id} aria-controls={detailsId}
        aria-label={`${zoneName(row.id, locale)}: ${rate(row)}, ${row.fgm} / ${row.fga}; ${t.attempts} ${share(row)}${row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? `; ${t.low}` : ""}`}
        className={styles.region} data-zone-id={row.id} onClick={() => onSelect(row.id)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}>
        <path data-zone-fill={row.id} d={g.pathD} fill={zoneColor(row, mode, data.benchmark)} fillRule="evenodd" stroke="#f5f0e4" strokeWidth="1.5" strokeLinejoin="round" />
      </g>;
    })}
    <g pointerEvents="none" aria-hidden="true" data-court-markings="true" fill="none" stroke="#fffaf0" strokeWidth="2.7" strokeLinejoin="round">
      <path data-court-line="paint" d={courtBasicMarkings.lane} />
      <path data-court-line="three-point" d={courtBasicMarkings.threePoint} />
      <path data-court-line="restricted-area" d={courtBasicMarkings.restricted} />
      <path d={courtBasicMarkings.halfCourt} />
      <path d={courtBasicMarkings.freeThrowOutside} strokeOpacity=".55" />
      <path d={courtBasicMarkings.freeThrowInside} strokeOpacity=".3" strokeDasharray="5 7" />
      <path d="M264 48H336" strokeWidth="4" /><circle cx="300" cy="63" r="9" strokeWidth="3" />
      <rect x="1.4" y="1.4" width="597.2" height="561.2" strokeWidth="2.8" />
    </g>
    {geometries.map(g => {
      const row = rows.get(g.id)!, [x, y] = g.labelPosition, external = y < 0;
      const color = zoneColor(row, mode, data.benchmark);
      const anchorX = g.id === "restricted-area" ? 300 : g.id === "corner-three-left" ? 18 : 582;
      const anchorY = g.id === "restricted-area" ? 25 : 42;
      return <g key={g.id} data-zone-label={row.id} className={external ? styles.courtCallout : undefined}
        fill={external ? "var(--heat-text, #202a39)" : HEATMAP_COLORS.ink} textAnchor="middle" fontFamily="Arial, 'Noto Sans CJK SC', sans-serif"
        style={{ fontVariantNumeric: "tabular-nums" }} pointerEvents={external ? "auto" : "none"} aria-hidden="true"
        onClick={external ? () => onSelect(row.id) : undefined}>
        {external && <>
          <path data-court-leader={row.id} d={`M${x},-23V-10H${anchorX}V${anchorY}`} fill="none" stroke="var(--heat-callout-line, #ccd5e1)" strokeWidth="1.7" />
          <circle cx={anchorX} cy={anchorY} r="3" fill="var(--heat-callout-line, #ccd5e1)" />
          <circle cx={x - 61} cy="-95" r="4" fill={color} />
          <text x={x} y="-90" fill="var(--heat-muted, #6c798b)" fontSize="17">{g.id === "restricted-area" ? (locale === "zh" ? "篮下限制区" : "Restricted area") : g.id === "corner-three-left" ? (locale === "zh" ? "左底角三分" : "Left corner 3") : (locale === "zh" ? "右底角三分" : "Right corner 3")}</text>
        </>}
        <text x={x} y={y} fontSize="25" fontWeight="600">{mode === "volume" ? share(row) : rate(row)}</text>
        <text x={x} y={y + 23} fontSize="20">{row.fgm}/{row.fga}{row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? "*" : ""}</text>
      </g>;
    })}
  </svg>;
}
