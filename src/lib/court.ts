// NBA basketball court dimensional constants shared across shot-chart components.
// These are facts about the NBA court geometry — same regardless of SVG layout
// (full vertical, half horizontal, etc.). Each consumer applies its own coord
// mapping (toSvgX/Y) to project these into its layout.

// Court size (real-world feet)
export const COURT_LENGTH_FT = 94;
export const COURT_WIDTH_FT = 50;

// Percentage coordinates the NBA CDN PBP API uses (x = along length, y = along width).
// Basket center is 5.25ft from baseline ≈ 5.59% of 94ft.
export const BASKET_PCT_X = 5.59;
// Free throw line is 19ft from baseline (15ft to backboard + 4ft to FT line).
export const FT_LINE_PCT_X = 19.15;
// Paint (lane) width: 16ft / 50ft = 32% of court width.
export const PAINT_WIDTH_PCT = 32;
// Corner-three: 3pt arc is 3.15ft from sideline = 6.3% width.
export const CORNER_3_PCT_Y = 6.3;
// Corner-three extends 14ft from baseline = 14.89% length.
export const CORNER_3_EXT_PCT_X = 14.89;
// Three-point arc: 23.75ft from basket = 25.26% of court length.
export const THREE_PT_ARC_PCT = 25.26;
// Restricted-area radius: 4ft.
export const RESTRICTED_AREA_FT = 4;
// Free-throw circle radius: 6ft.
export const FT_CIRCLE_FT = 6;

// Real-world distances (feet) — used by shot-zone classification.
export const BASKET_TO_BASELINE_FT = 5.25;
export const THREE_PT_DISTANCE_FT = 23.75;
export const CORNER_3_DISTANCE_FT = 22;
export const CORNER_3_DEPTH_FT = 14 - BASKET_TO_BASELINE_FT; // 8.75ft from basket
