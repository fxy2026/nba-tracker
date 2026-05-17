/* eslint-disable @next/next/no-img-element -- ImageResponse template requires raw <img> */
import { ImageResponse } from "next/og";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";

export const runtime = "nodejs";
export const alt = "NBA playoff series";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function roundLabel(gameId: string): string {
  const r = parseInt(gameId.charAt(7)) || 0;
  if (r === 1) return "First Round";
  if (r === 2) return "Conf. Semifinals";
  if (r === 3) return "Conf. Finals";
  if (r === 4) return "NBA Finals";
  return "Playoffs";
}

// Every multi-child <div> needs explicit display: flex per Satori (next/og engine).
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const schedule = await getFullSchedule().catch(() => []);
  const matching = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameId.startsWith(id)) matching.push(g);
    }
  }

  if (matching.length === 0 || !/^004\d{6}$/.test(id)) {
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

  matching.sort((a, b) => (a.gameCode || a.gameId).localeCompare(b.gameCode || b.gameId));
  const first = matching[0];
  const codes = [first.homeTeam.teamTricode, first.awayTeam.teamTricode].sort();
  const [t1Code, t2Code] = codes;

  let t1Wins = 0, t2Wins = 0;
  let t1Id = 0, t2Id = 0;
  for (const g of matching) {
    if (g.homeTeam.teamTricode === t1Code) t1Id = g.homeTeam.teamId;
    if (g.awayTeam.teamTricode === t1Code) t1Id = g.awayTeam.teamId;
    if (g.homeTeam.teamTricode === t2Code) t2Id = g.homeTeam.teamId;
    if (g.awayTeam.teamTricode === t2Code) t2Id = g.awayTeam.teamId;
    if (g.gameStatus !== 3) continue;
    const homeWon = g.homeTeam.score > g.awayTeam.score;
    const winner = homeWon ? g.homeTeam.teamTricode : g.awayTeam.teamTricode;
    if (winner === t1Code) t1Wins++; else t2Wins++;
  }

  const t1Color = TEAM_META[t1Code]?.primaryColor || "#3B82F6";
  const t2Color = TEAM_META[t2Code]?.primaryColor || "#F59E0B";
  const finished = t1Wins >= 4 || t2Wins >= 4;
  const winnerCode = t1Wins >= 4 ? t1Code : t2Wins >= 4 ? t2Code : null;
  const round = roundLabel(id);

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
        {/* Faded team-color side glows */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${t1Color}55 0%, transparent 30%, transparent 70%, ${t2Color}55 100%)`,
            display: "flex",
          }}
        />

        {/* Brand strip */}
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
            position: "relative",
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
          <div style={{ display: "flex", color: "#F59E0B", fontWeight: 700 }}>{round}</div>
        </div>

        {/* Hero: T1 logo | score | T2 logo */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 60px",
            gap: 30,
            position: "relative",
          }}
        >
          {/* Team 1 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              opacity: finished && winnerCode !== t1Code ? 0.45 : 1,
            }}
          >
            <img
              src={`https://cdn.nba.com/logos/nba/${t1Id}/global/L/logo.svg`}
              width={200}
              height={200}
              alt=""
            />
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -1.5,
                display: "flex",
              }}
            >
              {t1Code}
            </div>
          </div>

          {/* Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "0 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 20,
              }}
            >
              <span
                style={{
                  fontSize: 160,
                  fontWeight: 200,
                  color: t1Wins >= 4 ? "#FFD700" : t1Wins > t2Wins ? t1Color : "rgba(255,255,255,0.7)",
                  fontFamily: "monospace",
                  letterSpacing: -6,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {t1Wins}
              </span>
              <span
                style={{
                  fontSize: 64,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "monospace",
                  display: "flex",
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontSize: 160,
                  fontWeight: 200,
                  color: t2Wins >= 4 ? "#FFD700" : t2Wins > t1Wins ? t2Color : "rgba(255,255,255,0.7)",
                  fontFamily: "monospace",
                  letterSpacing: -6,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {t2Wins}
              </span>
            </div>
            <div
              style={{
                fontSize: 18,
                color: finished ? "#FFD700" : "rgba(255,255,255,0.6)",
                fontFamily: "monospace",
                letterSpacing: 3,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {finished
                ? `${winnerCode} wins ${Math.max(t1Wins, t2Wins)}-${Math.min(t1Wins, t2Wins)}`
                : `Best of 7 · ${matching.filter((g) => g.gameStatus === 3).length} played`}
            </div>
          </div>

          {/* Team 2 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              opacity: finished && winnerCode !== t2Code ? 0.45 : 1,
            }}
          >
            <img
              src={`https://cdn.nba.com/logos/nba/${t2Id}/global/L/logo.svg`}
              width={200}
              height={200}
              alt=""
            />
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -1.5,
                display: "flex",
              }}
            >
              {t2Code}
            </div>
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
            position: "relative",
          }}
        >
          nba.xpy.me/series/{id}
        </div>

        {/* Accent stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: `linear-gradient(90deg, ${t1Color} 0%, ${t2Color} 100%)`,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
