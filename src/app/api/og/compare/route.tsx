import { ImageResponse } from "next/og";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import { playerHeadshotUrl } from "@/lib/teamUrls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OgPlayer {
  name: string;
  season?: string;
  team: string;
  ppg: number;
  rpg: number;
  apg: number;
  personId: number;
  isIconic: boolean;
}

function resolve(id: string): OgPlayer | null {
  if (id.includes("-")) {
    const s = ICONIC_SEASONS.find((x) => x.id === id);
    if (s) return { name: s.name, season: s.season, team: s.team, ppg: s.ppg, rpg: s.rpg, apg: s.apg, personId: s.personId, isIconic: true };
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const legend = ALL_TIME_LEADERS.find((p) => p.personId === numId && !p.active);
  if (legend) return { name: legend.name, team: legend.team, ppg: legend.ppg, rpg: legend.rpg, apg: legend.apg, personId: legend.personId, isIconic: false };
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p1 = searchParams.get("p1") ?? "";
  const p2 = searchParams.get("p2") ?? "";

  const a = resolve(p1);
  const b = resolve(p2);

  // When either side is missing or unresolved (e.g., active player ID we
  // don't pre-load), fall back to a generic comparison cover.
  if (!a || !b) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #0A0E27 0%, #1E1B4B 60%, #312E81 100%)",
            fontFamily: "system-ui, sans-serif", color: "white",
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>NBA Tracker</div>
          <div style={{ fontSize: 32, opacity: 0.7, marginTop: 12 }}>Player Comparison</div>
          <div style={{ fontSize: 18, opacity: 0.5, marginTop: 20 }}>nba.xpy.me/compare</div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  // Side-by-side comparison card. Headshots are inlined via NBA CDN; satori
  // fetches them at render time and inlines them in the PNG output.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #0A0E27 0%, #1E1B4B 60%, #312E81 100%)",
          fontFamily: "system-ui, sans-serif", color: "white",
          padding: "40px 60px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 12, background: "#3B82F6",
              fontSize: 20, fontWeight: 700,
            }}>NBA</div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 600 }}>Tracker</div>
          </div>
          <div style={{ display: "flex", fontSize: 14, color: "#94A3B8", letterSpacing: 4, textTransform: "uppercase" }}>
            Compare
          </div>
        </div>

        {/* Body — two halves with VS center */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", marginTop: 30, gap: 30 }}>
          {/* Left player */}
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={playerHeadshotUrl(a.personId)}
              width={180}
              height={180}
              style={{ borderRadius: 16, objectFit: "cover" }}
              alt=""
            />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, marginTop: 16, textAlign: "center" }}>
              {a.name}
            </div>
            {a.season && (
              <div style={{
                display: "flex",
                marginTop: 8, fontSize: 16, padding: "4px 12px",
                background: "rgba(59,130,246,0.2)", color: "#60A5FA", borderRadius: 8,
              }}>
                {a.season}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 14, color: "#94A3B8" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300, color: "#F59E0B" }}>{a.ppg.toFixed(1)}</span>
                <span>PPG</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300 }}>{a.rpg.toFixed(1)}</span>
                <span>RPG</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300 }}>{a.apg.toFixed(1)}</span>
                <span>APG</span>
              </div>
            </div>
          </div>

          {/* VS */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            color: "#F59E0B", fontSize: 60, fontWeight: 200, letterSpacing: 4,
          }}>
            VS
          </div>

          {/* Right player */}
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={playerHeadshotUrl(b.personId)}
              width={180}
              height={180}
              style={{ borderRadius: 16, objectFit: "cover" }}
              alt=""
            />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, marginTop: 16, textAlign: "center" }}>
              {b.name}
            </div>
            {b.season && (
              <div style={{
                display: "flex",
                marginTop: 8, fontSize: 16, padding: "4px 12px",
                background: "rgba(34,197,94,0.2)", color: "#4ADE80", borderRadius: 8,
              }}>
                {b.season}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 14, color: "#94A3B8" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300, color: "#F59E0B" }}>{b.ppg.toFixed(1)}</span>
                <span>PPG</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300 }}>{b.rpg.toFixed(1)}</span>
                <span>RPG</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 300 }}>{b.apg.toFixed(1)}</span>
                <span>APG</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 16, color: "#64748B", marginTop: 20 }}>
          nba.xpy.me/compare
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
