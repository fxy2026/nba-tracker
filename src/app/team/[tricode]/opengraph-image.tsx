/* eslint-disable @next/next/no-img-element -- ImageResponse template requires raw <img> */
import { ImageResponse } from "next/og";
import { TEAM_META } from "@/lib/teams";
import { getFullSchedule } from "@/lib/api";

export const runtime = "nodejs";
export const alt = "NBA team page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Every multi-child <div> needs explicit display: flex per Satori (next/og engine).
export default async function Image({ params }: { params: Promise<{ tricode: string }> }) {
  const { tricode } = await params;
  const team = TEAM_META[tricode.toUpperCase()];

  if (!team) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0A0E27",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          NBA Tracker
        </div>
      ),
      { ...size }
    );
  }

  // Compute regular-season record from schedule
  const schedule = await getFullSchedule().catch(() => []);
  let wins = 0, losses = 0;
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3 || !g.gameId.startsWith("002")) continue;
      const isHome = g.homeTeam.teamTricode === team.tricode;
      const isAway = g.awayTeam.teamTricode === team.tricode;
      if (!isHome && !isAway) continue;
      const teamScore = isHome ? g.homeTeam.score : g.awayTeam.score;
      const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
      if (teamScore > oppScore) wins++; else losses++;
    }
  }

  const pct = wins + losses > 0 ? wins / (wins + losses) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${team.primaryColor} 0%, #0A0E27 75%)`,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Brand bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 60px",
            color: "rgba(255,255,255,0.8)",
            fontSize: 18,
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #3B82F6, #1E40AF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                color: "white",
              }}
            >
              NBA
            </div>
            <span style={{ color: "#FFFFFF", fontWeight: 700, letterSpacing: -0.5, fontFamily: "system-ui" }}>
              NBA Tracker
            </span>
          </div>
          <div style={{ display: "flex" }}>{team.conference} · {team.division}</div>
        </div>

        {/* Main hero — logo + name + record */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 80px",
            gap: 60,
          }}
        >
          <img
            src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
            width={260}
            height={260}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 32,
                color: "rgba(255,255,255,0.7)",
                fontWeight: 400,
                letterSpacing: -0.5,
                display: "flex",
              }}
            >
              {team.city}
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -3,
                lineHeight: 1,
                display: "flex",
              }}
            >
              {team.name}
            </div>
            {wins + losses > 0 && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 16 }}>
                <span
                  style={{
                    fontSize: 64,
                    fontWeight: 200,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    letterSpacing: -2,
                    display: "flex",
                  }}
                >
                  {wins}-{losses}
                </span>
                <span
                  style={{
                    fontSize: 22,
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "monospace",
                    letterSpacing: 2,
                    display: "flex",
                  }}
                >
                  .{String(Math.round(pct * 1000)).padStart(3, "0")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "32px",
            color: "rgba(255,255,255,0.55)",
            fontSize: 18,
            fontFamily: "monospace",
            letterSpacing: 3,
          }}
        >
          nba.xpy.me/team/{team.tricode}
        </div>

        {/* Accent stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: team.primaryColor,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
