/** Court-aligned display geometry, never a shot-coordinate classifier.
 * BASIC/AREA source labels determine counts. The court dimensions and its RA,
 * lane, and three-point lines are NBA regulation dimensions; the internal
 * direction dividers are schematic and are not claimed as NBA classifier cuts.
 * NBA rule 1: https://cdn.nba.com/manage/2026/01/Official-2025-26-NBA-Playing-Rules.pdf
 * Diagram: https://cms.nba.com/wp-content/uploads/sites/4/2025/10/2025-26-NBA-Officials-Guide.pdf
 */
export const COURT_BASIC_GEOMETRY_VERSION = "nba-court-basic12-v1" as const;
export const COURT_BASIC_CLASSIFICATION_VERSION = "nba-basic-area-explicit-shot-type-v1" as const;
export const courtBasicDimensions = {
  unitsPerFoot: 12, width: 600, height: 564, hoopX: 300, hoopY: 63,
  paintLeft: 204, paintRight: 396, freeThrowY: 228, backboardY: 48,
  restrictedRadius: 48, threePointRadius: 285, cornerLeft: 36, cornerRight: 564,
  // Space above the baseline belongs to labels, not to the playing surface.
  viewBox: "0 -112 600 676", directionBoundariesVerified: false,
} as const;
export const courtBasicZoneIds = [
  "restricted-area", "paint-non-ra", "midrange-left", "midrange-left-center",
  "midrange-center", "midrange-right-center", "midrange-right", "corner-three-left",
  "above-break-three-left", "above-break-three-center", "above-break-three-right", "corner-three-right",
] as const;
export type CourtBasicZoneId = typeof courtBasicZoneIds[number];
const rad = Math.PI / 180;
const clean = (n: number) => Number(n.toFixed(6));
const point = (angle: number) => [clean(300 + 285 * Math.cos(angle * rad)), clean(63 + 285 * Math.sin(angle * rad))] as const;
const xy = (p: readonly [number, number]) => `${p[0]},${p[1]}`;
const at = (angle: number) => xy(point(angle));
const cornerAngle = Math.acos(264 / 285) / rad;
export const courtBasicCornerY = point(cornerAngle)[1];
const cutAngles = [cornerAngle, 30, 70, 110, 150, 180 - cornerAngle];
// Reuse the same arc endpoint segments in neighboring zones to avoid hairline gaps.
const arc = (from: number, to: number) => {
  const cuts = cutAngles.filter(a => a > Math.min(from, to) && a < Math.max(from, to));
  if (from > to) cuts.reverse();
  return [...cuts, to].map(a => `A285,285,0,0,${from < to ? 1 : 0},${at(a)}`).join("");
};
const paintSideY = clean(63 + 96 * Math.tan(30 * rad));
const paintBottomLeft = clean(300 + 165 / Math.tan(110 * rad));
const paintBottomRight = clean(600 - paintBottomLeft);
const halfCourtLeft = clean(300 + 501 / Math.tan(110 * rad));
const halfCourtRight = clean(600 - halfCourtLeft);
// Regulation RA is a forward semicircle plus stubs back to the backboard.
// Its source statistical category is illustrated here; exact raw-point cuts are unverified.
export const courtBasicRestrictedPath = "M252,48H348V63A48,48,0,0,1,252,63Z";
const paths: Record<CourtBasicZoneId, string> = {
  "restricted-area": courtBasicRestrictedPath,
  "paint-non-ra": `M204,0H396V228H204Z ${courtBasicRestrictedPath}`,
  "midrange-left": `M36,0H204V${paintSideY}L${at(150)}${arc(150, 180 - cornerAngle)}Z`,
  "midrange-left-center": `M204,${paintSideY}L${at(150)}${arc(150,110)}L${paintBottomLeft},228H204Z`,
  "midrange-center": `M${paintBottomLeft},228H${paintBottomRight}L${at(70)}${arc(70,110)}Z`,
  "midrange-right-center": `M${paintBottomRight},228H396V${paintSideY}L${at(30)}${arc(30,70)}Z`,
  "midrange-right": `M396,0H564V${courtBasicCornerY}${arc(cornerAngle,30)}L396,${paintSideY}Z`,
  "corner-three-left": `M0,0H36V${courtBasicCornerY}H0Z`,
  "above-break-three-left": `M0,${courtBasicCornerY}H36${arc(180-cornerAngle,110)}L${halfCourtLeft},564H0Z`,
  "above-break-three-center": `M${at(110)}${arc(110,70)}L${halfCourtRight},564H${halfCourtLeft}Z`,
  "above-break-three-right": `M${at(70)}${arc(70,cornerAngle)}H600V564H${halfCourtRight}Z`,
  "corner-three-right": `M564,0H600V${courtBasicCornerY}H564Z`,
};
export const courtBasicPositions: Record<CourtBasicZoneId, readonly [number, number]> = {
  "restricted-area": [300,-65], "paint-non-ra": [300,166],
  "midrange-left": [122,75], "midrange-left-center": [144,250], "midrange-center": [300,268],
  "midrange-right-center": [456,250], "midrange-right": [478,75],
  "corner-three-left": [83,-65], "above-break-three-left": [100,432],
  "above-break-three-center": [300,456], "above-break-three-right": [500,432], "corner-three-right": [517,-65],
};
export const courtBasicGeometry = courtBasicZoneIds.map(id => ({ id, pathD: paths[id], labelPosition: courtBasicPositions[id] }));
export const courtBasicMarkings = {
  lane: "M204,0V228H396V0",
  freeThrowOutside: "M228,228A72,72,0,0,0,372,228",
  freeThrowInside: "M228,228A72,72,0,0,1,372,228",
  threePoint: `M36,0V${courtBasicCornerY}${arc(180-cornerAngle,cornerAngle)}V0`,
  restricted: "M252,48V63A48,48,0,0,0,348,63V48",
  halfCourt: "M228,564A72,72,0,0,1,372,564",
} as const;

/** Only schematic source-category cuts; regulation outlines are drawn separately.
 * Endpoints reuse the zone geometry exactly. This does not classify any shots. */
export const courtBasicStatisticalDividers = [
  `M204,${paintSideY}L${at(150)}`,
  `M${paintBottomLeft},228L${at(110)}`,
  `M${paintBottomRight},228L${at(70)}`,
  `M396,${paintSideY}L${at(30)}`,
  `M${at(110)}L${halfCourtLeft},564`,
  `M${at(70)}L${halfCourtRight},564`,
  `M0,${courtBasicCornerY}H36`,
  `M564,${courtBasicCornerY}H600`,
] as const;
