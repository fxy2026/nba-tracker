import { useId } from "react";
import { advanced14Geometry } from "@/lib/season-heatmap-geometry";
import type { SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import { copy, displayPositions, displayX, HEATMAP_COLORS, LOW_SAMPLE_ATTEMPTS, rate, schematicStrips, share, zoneColor, zoneName, type HeatmapLocale, type HeatmapMode } from "./season-heatmap-display";
import styles from "./season-heatmap.module.css";

interface Props { data: SeasonHeatmapRendererDTO; mode: HeatmapMode; locale: HeatmapLocale; selectedId: string | null; onSelect: (id: SeasonHeatmapDisplayRow["id"]) => void; detailsId: string }
/** Only these 14 immutable source IDs can acquire spatial geometry. */
export default function SeasonHeatmapCourt({ data, mode, locale, selectedId, onSelect, detailsId }: Props) {
  const id = useId().replace(/:/g, "");
  const t = copy[locale];
  const rows = new Map(data.zones.map(row => [row.id, row]));
  const geometries = advanced14Geometry.filter(g => rows.has(g.id));
  const leftBaseline = rows.get("left-center-24-plus"), rightBaseline = rows.get("right-center-24-plus");
  const transform = (strip: typeof schematicStrips[number]) => `matrix(${strip.scale} 0 0 1 ${strip.translate} 0)`;
  return <svg xmlns="http://www.w3.org/2000/svg" className={styles.court} viewBox="0 0 600 564" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
    <title id={`${id}-title`}>{t.title} · {data.season}</title>
    <desc id={`${id}-desc`}>{t.hint}. {t.schematic} {t.low}.</desc>
    <defs>{schematicStrips.map(strip => <clipPath id={`${id}-${strip.name}`} key={strip.name}><rect x={strip.x} y="0" width={strip.width} height="564" /></clipPath>)}</defs>
    {/* Match the v3 underpainting: clip-edge antialiasing must blend into the
        same zone color, never create a fake vertical boundary below a corner. */}
    <rect data-display-underpaint="left" x="0" y="0" width="600" height="564" fill={leftBaseline ? zoneColor(leftBaseline, mode, data.benchmark) : HEATMAP_COLORS.neutral} />
    <rect data-display-underpaint="right" x="530" y="168" width="4" height="396" fill={rightBaseline ? zoneColor(rightBaseline, mode, data.benchmark) : HEATMAP_COLORS.neutral} />
    {geometries.map(g => {
      const row = rows.get(g.id)!;
      return <g key={g.id} role="button" tabIndex={0} aria-pressed={selectedId === row.id} aria-controls={detailsId}
        aria-label={`${zoneName(row.id, locale)}: ${rate(row)}, ${row.fgm} / ${row.fga}; ${t.attempts} ${share(row)}${row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? `; ${t.low}` : ""}`}
        className={styles.region} data-zone-id={row.id} onClick={() => onSelect(row.id)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}>
        {schematicStrips.map(strip => <g clipPath={`url(#${id}-${strip.name})`} key={strip.name}>
          <path d={g.pathD} transform={transform(strip)} fill={zoneColor(row, mode, data.benchmark)} stroke="#f5f0e4" strokeWidth="2" strokeLinejoin="round" />
        </g>)}
      </g>;
    })}
    {/* Decorative court marks and typography never receive the horizontal geometry transform. */}
    <g pointerEvents="none" aria-hidden="true">
      {schematicStrips.map(strip => <g key={strip.name} clipPath={`url(#${id}-${strip.name})`}><g transform={transform(strip)} fill="none" stroke="#f5f0e4" strokeWidth="2.7">
        <path d="M204 0V228H396V0 M228 228A72 72 0 0 0 372 228 M228 564A72 72 0 0 1 372 564" />
        <path d="M264 48H336" strokeWidth="3.6" /><circle cx="300" cy="60" r="11" strokeWidth="3" /><path d="M252 60A48 48 0 0 0 348 60" strokeWidth="3" />
      </g></g>)}
      {geometries.map(g => {
        const row = rows.get(g.id)!, [x, y] = displayPositions[g.id], corner = g.id === "left-24-plus" || g.id === "right-24-plus";
        const background = zoneColor(row, mode, data.benchmark);
        return <g key={g.id} data-zone-label={row.id} fill={HEATMAP_COLORS.ink} textAnchor="middle" fontFamily="Arial, 'Noto Sans CJK SC', sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
          {/* Same-color backing keeps court marks clear of the two central labels. */}
          {g.id === "center-under-8" && <rect x={displayX(250)} y="99" width={displayX(350) - displayX(250)} height="45" rx="2" fill={background} />}
          {g.id === "center-16-24" && <rect x={displayX(265)} y="281" width={displayX(335) - displayX(265)} height="19" rx="2" fill={background} />}
          <text x={displayX(x)} y={y} fontSize={corner ? 19.5 : 23} fontWeight="600">{mode === "volume" ? share(row) : rate(row)}</text>
          <text x={displayX(x)} y={y + 23} fontSize={corner ? 18 : 20.5}>{row.fgm}/{row.fga}{row.fga > 0 && row.fga < LOW_SAMPLE_ATTEMPTS ? "*" : ""}</text>
        </g>;
      })}
      <rect x="1.4" y="1.4" width="597.2" height="561.2" fill="none" stroke="#f5f0e4" strokeWidth="2.8" />
    </g>
  </svg>;
}
