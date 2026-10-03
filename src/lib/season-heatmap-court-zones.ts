/** Court borders use BASIC classifications; source AREA labels only subdivide the outside regions. */
export const SEASON_HEATMAP_COURT_GEOMETRY_VERSION = "nba-court-basic12-v1" as const;
export const courtBasic12Zones = [
  { id: "restricted-area", sourceZoneId: "Restricted Area", shotValue: 2 },
  { id: "paint-non-ra", sourceZoneId: "In The Paint (Non-RA)", shotValue: 2 },
  { id: "midrange-left", sourceZoneId: "Mid-Range | Left Side(L)", shotValue: 2 },
  { id: "midrange-left-center", sourceZoneId: "Mid-Range | Left Side Center(LC)", shotValue: 2 },
  { id: "midrange-center", sourceZoneId: "Mid-Range | Center(C)", shotValue: 2 },
  { id: "midrange-right-center", sourceZoneId: "Mid-Range | Right Side Center(RC)", shotValue: 2 },
  { id: "midrange-right", sourceZoneId: "Mid-Range | Right Side(R)", shotValue: 2 },
  { id: "corner-three-left", sourceZoneId: "Left Corner 3", shotValue: 3 },
  { id: "above-break-three-left", sourceZoneId: "Above the Break 3 | Left Side Center(LC)", shotValue: 3 },
  { id: "above-break-three-center", sourceZoneId: "Above the Break 3 | Center(C)", shotValue: 3 },
  { id: "above-break-three-right", sourceZoneId: "Above the Break 3 | Right Side Center(RC)", shotValue: 3 },
  { id: "corner-three-right", sourceZoneId: "Right Corner 3", shotValue: 3 },
] as const;
export type CourtBasic12ZoneId = (typeof courtBasic12Zones)[number]["id"];

/** Deliberate allowlist of source triples; unknown classifications remain non-spatial. */
export function courtZoneForSource(basic: string, area: string, range: string): (typeof courtBasic12Zones)[number] | null {
  if (basic === "Restricted Area" && area === "Center(C)" && range === "Less Than 8 ft.") return courtBasic12Zones[0];
  if (basic === "In The Paint (Non-RA)" && (area === "Center(C)" && (range === "Less Than 8 ft." || range === "8-16 ft.") || (area === "Left Side(L)" || area === "Right Side(R)") && range === "8-16 ft.")) return courtBasic12Zones[1];
  if (basic === "Mid-Range" && (range === "16-24 ft." || range === "8-16 ft." && ["Left Side(L)", "Center(C)", "Right Side(R)"].includes(area))) return courtBasic12Zones.find(zone => zone.sourceZoneId === `${basic} | ${area}`) ?? null;
  if (basic === "Left Corner 3" && area === "Left Side(L)" && range === "24+ ft.") return courtBasic12Zones[7];
  if (basic === "Right Corner 3" && area === "Right Side(R)" && range === "24+ ft.") return courtBasic12Zones[11];
  if (basic === "Above the Break 3" && range === "24+ ft.") return courtBasic12Zones.find(zone => zone.sourceZoneId === `${basic} | ${area}`) ?? null;
  return null;
}
