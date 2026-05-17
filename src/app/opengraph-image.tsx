import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "NBA Tracker — Live Scores · Player Stats · Schedule";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori (next/og engine) requires every <div> with multiple children to have
// explicit `display: flex` (or contents/none). Forgetting it crashes the build:
// "Expected <div> to have explicit display: flex".
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0A0E27 0%, #1E1B4B 60%, #312E81 100%)",
          padding: 80,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
              color: "#FFFFFF",
            }}
          >
            NBA
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -1.5,
                lineHeight: 1,
                display: "flex",
              }}
            >
              NBATracker
            </div>
            <div
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: 4,
                marginTop: 6,
                textTransform: "uppercase",
                fontFamily: "monospace",
                display: "flex",
              }}
            >
              by FXY · nba.xpy.me
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 80,
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: -2,
              lineHeight: 1.1,
              maxWidth: 1000,
              display: "flex",
            }}
          >
            Live NBA scores, stats & analytics
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.4,
              maxWidth: 1000,
              marginTop: 8,
              display: "flex",
            }}
          >
            35+ analytic views · power rankings · awards races · playoff bracket
          </div>
        </div>

        {/* Feature chips at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            right: 80,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {["LIVE SCORES", "POWER RANKINGS", "MVP RACE", "PLAYOFF BRACKET", "STAT LEADERS"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 16px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 999,
                fontSize: 14,
                color: "rgba(255,255,255,0.85)",
                fontFamily: "monospace",
                letterSpacing: 2,
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Bottom accent stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #F59E0B 0%, #3B82F6 50%, #A855F7 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
