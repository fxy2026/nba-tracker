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
