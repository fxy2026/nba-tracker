/** Display geometry only: observed NBA ADVANCED SVG, not a raw-shot classifier.
 * Never infer fine-zone membership from these illustration paths or seven-zone data. */
export const SEASON_HEATMAP_GEOMETRY_VERSION = "nba-advanced14-svg-v1" as const;
export const SEASON_HEATMAP_CLASSIFICATION_VERSION = "nba-advanced14-source-labels-v1" as const;
export const advanced14SourceIllustration = {
  version: SEASON_HEATMAP_GEOMETRY_VERSION,
  viewBox: "0 0 540 570",
  sourcePathTransform: "scale(0.835)",
  coordinateSpace: "rendered-svg-illustration-not-shot-classifier",
  classifierBoundariesVerified: false,
} as const;
export const advanced14Geometry = [
  {
    "id": "center-under-8",
    "sourceZoneId": "Center(C) | Less Than 8 ft.",
    "pathD": "M220,3A96,96,0,1,0,380,3Z",
    "labelGroupTranslate": [
      215,
      30
    ]
  },
  {
    "id": "left-8-16",
    "sourceZoneId": "Left Side(L) | 8-16 ft.",
    "pathD": "M117,0H220A96,96,0,0,0,250,140L203,224A192,192,0,0,1,117,0Z",
    "labelGroupTranslate": [
      95,
      30
    ]
  },
  {
    "id": "center-8-16",
    "sourceZoneId": "Center(C) | 8-16 ft.",
    "pathD": "M250,140A96,96,0,0,0,350,140L394,224A192,192,0,0,1,203,224Z",
    "labelGroupTranslate": [
      215,
      130
    ]
  },
  {
    "id": "right-8-16",
    "sourceZoneId": "Right Side(R) | 8-16 ft.",
    "pathD": "M483,0H380A96,96,0,0,1,350,140L397,224A192,192,0,0,0,483,0Z",
    "labelGroupTranslate": [
      335,
      30
    ]
  },
  {
    "id": "left-16-24",
    "sourceZoneId": "Left Side(L) | 16-24 ft.",
    "pathD": "M36,0V168A285,285,0,0,0,68,226L147,173A192,192,0,0,1,117,0Z",
    "labelGroupTranslate": [
      35,
      100
    ]
  },
  {
    "id": "left-center-16-24",
    "sourceZoneId": "Left Side Center(LC) | 16-24 ft.",
    "pathD": "M147,173A192,192,0,0,0,241,240L214,333A285,285,0,0,1,68,226Z",
    "labelGroupTranslate": [
      95,
      180
    ]
  },
  {
    "id": "center-16-24",
    "sourceZoneId": "Center(C) | 16-24 ft.",
    "pathD": "M241,240A192,192,0,0,0,359,240L386,333A285,285,0,0,1,214,333Z",
    "labelGroupTranslate": [
      215,
      210
    ]
  },
  {
    "id": "right-center-16-24",
    "sourceZoneId": "Right Side Center(RC) | 16-24 ft.",
    "pathD": "M359,240A192,192,0,0,0,453,173L532,226A285,285,0,0,1,386,333Z",
    "labelGroupTranslate": [
      335,
      180
    ]
  },
  {
    "id": "right-16-24",
    "sourceZoneId": "Right Side(R) | 16-24 ft.",
    "pathD": "M564,0V168A285,285,0,0,1,532,226L453,173A192,192,0,0,0,483,0Z",
    "labelGroupTranslate": [
      395,
      100
    ]
  },
  {
    "id": "left-24-plus",
    "sourceZoneId": "Left Side(L) | 24+ ft.",
    "pathD": "M0,0H36V168H0Z",
    "labelGroupTranslate": [
      -15,
      30
    ]
  },
  {
    "id": "left-center-24-plus",
    "sourceZoneId": "Left Side Center(LC) | 24+ ft.",
    "pathD": "M0,168H36A285,285,0,0,0,210,332L150,564H0Z",
    "labelGroupTranslate": [
      35,
      300
    ]
  },
  {
    "id": "center-24-plus",
    "sourceZoneId": "Center(C) | 24+ ft.",
    "pathD": "M210,332A285,285,0,0,0,390,332L450,564H150Z",
    "labelGroupTranslate": [
      215,
      300
    ]
  },
  {
    "id": "right-center-24-plus",
    "sourceZoneId": "Right Side Center(RC) | 24+ ft.",
    "pathD": "M564,168A285,285,0,0,1,390,332L450,564H600V168Z",
    "labelGroupTranslate": [
      395,
      300
    ]
  },
  {
    "id": "right-24-plus",
    "sourceZoneId": "Right Side(R) | 24+ ft.",
    "pathD": "M564,0H600V168H564Z",
    "labelGroupTranslate": [
      445,
      30
    ]
  }
] as const;
export type Advanced14ZoneId = typeof advanced14Geometry[number]["id"];

/** Renderer-only revision. The immutable NBA evidence paths above remain unchanged.
 * These shared circular boundaries illustrate source AREA | RANGE labels; they
 * never classify shots, change counts, or claim independently verified NBA cuts. */
export const SEASON_HEATMAP_DISPLAY_GEOMETRY_VERSION = "coherent-advanced14-illustration-v2" as const;
export const seasonHeatmapCourt = { width: 600, height: 490, hoopX: 300, hoopY: 60, cornerX: 36, innerRadius: 96, middleRadius: 192, outerRadius: 285, viewBox: "0 -70 600 560" } as const;
const degrees = Math.PI / 180;
const clean = (n: number) => Number(n.toFixed(6));
const point = (radius: number, angle: number): readonly [number, number] => [clean(300 + radius * Math.cos(angle * degrees)), clean(60 + radius * Math.sin(angle * degrees))];
const xy = (p: readonly [number, number]) => `${p[0]},${p[1]}`;
const at = (radius: number, angle: number) => xy(point(radius, angle));
const topRight = (radius: number) => -Math.asin(60 / radius) / degrees;
const topLeft = (radius: number) => 180 - topRight(radius);
const cornerAngle = Math.acos(264 / seasonHeatmapCourt.outerRadius) / degrees;
export const seasonHeatmapCornerY = point(285, cornerAngle)[1];
// Every shared ring is split at the union of its adjoining radial boundaries.
// Adjacent regions therefore reuse exactly the same endpoint pairs and radii.
const ringCuts: Record<number, readonly number[]> = {
  96: [topRight(96), 60, 120, topLeft(96)],
  192: [topRight(192), 35, 60, 72, 108, 120, 145, topLeft(192)],
  285: [cornerAngle, 35, 72, 108, 145, 180 - cornerAngle],
};
function arc(radius: number, from: number, to: number): string {
  const cuts = ringCuts[radius].filter(a => a > Math.min(from, to) && a < Math.max(from, to));
  if (from > to) cuts.reverse();
  return [...cuts, to].map(angle => `A${radius},${radius},0,0,${from < to ? 1 : 0},${at(radius, angle)}`).join("");
}
const line = (radius: number, angle: number) => `L${at(radius, angle)}`;
const start = (radius: number, angle: number) => `M${at(radius, angle)}`;
const outerLeft = 180 - cornerAngle;
const bottomLeft = clean(300 + (490 - 60) / Math.tan(108 * degrees));
const bottomRight = clean(600 - bottomLeft);
const displayPaths: Record<Advanced14ZoneId, string> = {
  "center-under-8": `${start(96, topLeft(96))}${line(96, topRight(96))}${arc(96, topRight(96), topLeft(96))}Z`,
  "left-8-16": `${start(192, topLeft(192))}${line(96, topLeft(96))}${arc(96, topLeft(96), 120)}${line(192, 120)}${arc(192, 120, topLeft(192))}Z`,
  "center-8-16": `${start(96, 120)}${arc(96, 120, 60)}${line(192, 60)}${arc(192, 60, 120)}Z`,
  "right-8-16": `${start(96, topRight(96))}${line(192, topRight(192))}${arc(192, topRight(192), 60)}${line(96, 60)}${arc(96, 60, topRight(96))}Z`,
  "left-16-24": `M36,0${line(192, topLeft(192))}${arc(192, topLeft(192), 145)}${line(285, 145)}${arc(285, 145, outerLeft)}Z`,
  "left-center-16-24": `${start(192, 145)}${arc(192, 145, 108)}${line(285, 108)}${arc(285, 108, 145)}Z`,
  "center-16-24": `${start(192, 108)}${arc(192, 108, 72)}${line(285, 72)}${arc(285, 72, 108)}Z`,
  "right-center-16-24": `${start(192, 72)}${arc(192, 72, 35)}${line(285, 35)}${arc(285, 35, 72)}Z`,
  "right-16-24": `${start(192, topRight(192))}L564,0L564,${seasonHeatmapCornerY}${arc(285, cornerAngle, 35)}${line(192, 35)}${arc(192, 35, topRight(192))}Z`,
  "left-24-plus": `M0,0H36V${seasonHeatmapCornerY}H0Z`,
  "left-center-24-plus": `M0,${seasonHeatmapCornerY}H36${arc(285, outerLeft, 108)}L${bottomLeft},490H0Z`,
  "center-24-plus": `${start(285, 108)}${arc(285, 108, 72)}L${bottomRight},490H${bottomLeft}Z`,
  "right-center-24-plus": `${start(285, 72)}${arc(285, 72, cornerAngle)}H600V490H${bottomRight}Z`,
  "right-24-plus": `M564,0H600V${seasonHeatmapCornerY}H564Z`,
};
export const advanced14DisplayGeometry = advanced14Geometry.map(({ id, sourceZoneId }) => ({ id, sourceZoneId, pathD: displayPaths[id] }));
