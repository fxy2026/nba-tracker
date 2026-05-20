import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS masks home-screen icons with its own rounded-rect, so no borderRadius.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#928CEE",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }}>NBA</div>
        <div style={{ fontSize: 20, opacity: 0.85, marginTop: 6 }}>Tracker</div>
      </div>
    ),
    size,
  );
}
