import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// 192×192 is a multiple of 48 — required by Google's favicon-in-search rule.
// The pre-existing /favicon.ico is 256×256, which Google rejects.
export default function Icon() {
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
          borderRadius: 32,
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
