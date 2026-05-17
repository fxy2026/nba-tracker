/* eslint-disable @next/next/no-img-element -- ImageResponse template requires raw <img> */
import { ImageResponse } from "next/og";
import { getBoxScore } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";

export const runtime = "nodejs"; // needs node fetch for nba CDN
export const alt = "NBA game score";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const box = await getBoxScore(id).catch(() => null);

  if (!box) {
    // Fallback: simple branded card
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0A0E27, #1E1B4B)",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          NBA Tracker
        </div>
      ),
      { ...size }
    );
  }

  const isFinal = box.gameStatus === 3;
  const awayWon = box.awayTeam.score > box.homeTeam.score;
  const homeColor = TEAM_META[box.homeTeam.teamTricode]?.primaryColor || "#3B82F6";
  const awayColor = TEAM_META[box.awayTeam.teamTricode]?.primaryColor || "#F59E0B";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0E27",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Split team-color background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${awayColor}33 0%, transparent 30%, transparent 70%, ${homeColor}33 100%)`,
          }}
        />

        {/* Top brand strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 60px",
            color: "rgba(255,255,255,0.7)",
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
                fontSize: 20,
              }}
            >
              🏀
            </div>
            <span style={{ color: "#FFFFFF", fontWeight: 700, letterSpacing: -0.5, fontFamily: "system-ui" }}>NBA Tracker</span>
          </div>
          <div>{isFinal ? "Final" : box.gameStatus === 2 ? "Live" : "Scheduled"}</div>
        </div>

        {/* Score row */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 60px",
            gap: 40,
          }}
        >
          {/* Away */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <img
              src={`https://cdn.nba.com/logos/nba/${box.awayTeam.teamId}/global/L/logo.svg`}
              width={160}
              height={160}
              alt=""
              style={{ opacity: isFinal && !awayWon ? 0.4 : 1 }}
            />
            <div style={{ fontSize: 56, fontWeight: 800, color: "#FFFFFF", letterSpacing: -2, opacity: isFinal && !awayWon ? 0.5 : 1 }}>
              {box.awayTeam.teamTricode}
            </div>
            <div
              style={{
                fontSize: 140,
                fontWeight: 200,
                color: awayWon ? "#F59E0B" : "rgba(255,255,255,0.7)",
                lineHeight: 1,
                fontFamily: "monospace",
                letterSpacing: -4,
              }}
            >
              {box.awayTeam.score}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              color: "rgba(255,255,255,0.5)",
              fontSize: 22,
              fontFamily: "monospace",
              letterSpacing: 3,
            }}
          >
            <div style={{ fontSize: 60, opacity: 0.3 }}>·</div>
            <div>{box.gameStatusText || "vs"}</div>
            {(box.homeTeam.periods?.length ?? 0) > 4 && (
              <div style={{ fontSize: 18, color: "#F59E0B", fontWeight: 700 }}>
                {(box.homeTeam.periods.length - 4)}OT
              </div>
            )}
          </div>

          {/* Home */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <img
              src={`https://cdn.nba.com/logos/nba/${box.homeTeam.teamId}/global/L/logo.svg`}
              width={160}
              height={160}
              alt=""
              style={{ opacity: isFinal && awayWon ? 0.4 : 1 }}
            />
            <div style={{ fontSize: 56, fontWeight: 800, color: "#FFFFFF", letterSpacing: -2, opacity: isFinal && awayWon ? 0.5 : 1 }}>
              {box.homeTeam.teamTricode}
            </div>
            <div
              style={{
                fontSize: 140,
                fontWeight: 200,
                color: !awayWon ? "#F59E0B" : "rgba(255,255,255,0.7)",
                lineHeight: 1,
                fontFamily: "monospace",
                letterSpacing: -4,
              }}
            >
              {box.homeTeam.score}
            </div>
          </div>
        </div>

        {/* Bottom meta */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "32px",
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          {box.arena?.arenaName}{box.arena?.arenaCity ? ` · ${box.arena.arenaCity}` : ""}
        </div>

        {/* Bottom accent stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: `linear-gradient(90deg, ${awayColor} 0%, ${homeColor} 100%)`,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
