/* eslint-disable @next/next/no-img-element -- ImageResponse template requires raw <img> */
import { ImageResponse } from "next/og";
import { getPlayerInfo, getPlayerHeadshotUrl } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";

export const runtime = "nodejs";
export const alt = "NBA player profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Every multi-child <div> needs explicit display: flex per Satori (next/og engine).
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  const player = !isNaN(personId) ? await getPlayerInfo(personId).catch(() => null) : null;

  if (!player) {
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

  const fullName = `${player.firstName} ${player.lastName}`;
  const teamMeta = TEAM_META[player.teamAbbr];
  const teamColor = teamMeta?.primaryColor || "#3B82F6";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(120deg, ${teamColor} 0%, #0A0E27 60%)`,
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {teamMeta && (
              <img
                src={`https://cdn.nba.com/logos/nba/${teamMeta.teamId}/global/L/logo.svg`}
                width={36}
                height={36}
                alt=""
              />
            )}
            <span style={{ display: "flex" }}>{player.teamCity} {player.teamName}</span>
          </div>
        </div>

        {/* Main — headshot on right, stats on left */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 80px",
            gap: 40,
          }}
        >
          {/* Left: name + stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {player.jersey && (
              <div
                style={{
                  fontSize: 26,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: 3,
                  display: "flex",
                }}
              >
                #{player.jersey} · {player.position || "—"}
              </div>
            )}
            <div
              style={{
                fontSize: 76,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -3,
                lineHeight: 1,
                maxWidth: 580,
                display: "flex",
              }}
            >
              {fullName}
            </div>

            {/* PPG / RPG / APG stat row */}
            <div style={{ display: "flex", gap: 36, marginTop: 28 }}>
              <StatBlock value={player.pts.toFixed(1)} label="PPG" />
              <StatBlock value={player.reb.toFixed(1)} label="RPG" />
              <StatBlock value={player.ast.toFixed(1)} label="APG" />
            </div>
          </div>

          {/* Right: headshot */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              height: 360,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `4px solid ${teamColor}`,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src={getPlayerHeadshotUrl(player.personId)}
              width={360}
              height={360}
              alt=""
              style={{ objectFit: "cover" }}
            />
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
          nba.xpy.me/player/{player.personId}
        </div>

        {/* Accent stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: teamColor,
          }}
        />
      </div>
    ),
    { ...size }
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 56,
          fontWeight: 200,
          color: "#FFFFFF",
          fontFamily: "monospace",
          letterSpacing: -2,
          lineHeight: 1,
          display: "flex",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 16,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "monospace",
          letterSpacing: 3,
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        {label}
      </span>
    </div>
  );
}
