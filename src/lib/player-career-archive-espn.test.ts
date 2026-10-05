import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jokic from "@/data/player-career-archives/203999-2026-10-03.json";
import { findESPNId } from "./espn";
vi.mock("@/lib/statsProxy", () => ({ STATS_BASE: "https://stats.nba.com/stats", fetchStatsJson: vi.fn().mockResolvedValue(null) }));
import { GET } from "@/app/api/player/route";
const ok = (body: unknown) => ({ ok: true, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

it.each(["Nikola Jokic", "Nikola Jokić", "NIKOLA JOKIC"])("allows complete ESPN history through canonical-name normalization for %s", async callerName => {
  const labels = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "FG", "3PT", "FT"];
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ athletes: [{ id: "3112335", fullName: "Nikola Jokic" }] }))
    .mockResolvedValueOnce(ok({ categories: [{ name: "regularSeason", labels, statistics: jokic.data.careerSeasons.map(row => ({
      season: { displayName: row.SEASON_ID }, teamSlug: "denver-nuggets",
      stats: [row.GP, row.MIN, row.PTS, row.REB, row.AST, row.STL, row.BLK,
        row.FG_PCT * 100, row.FG3_PCT * 100, row.FT_PCT * 100].map(String).concat(["1-2", "1-2", "1-2"]),
    })) }] }));
  vi.stubGlobal("fetch", fetcher);
  const res = await GET(new NextRequest(`http://localhost/api/player?${new URLSearchParams({ id: "203999", name: callerName, team: "DEN" })}`));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.provenance).toMatchObject({ source: "espn", providerPlayerId: "3112335", retrievalKind: "api-response" });
  expect(body.careerSeasons).toHaveLength(11); expect(body).not.toHaveProperty("stale");
  expect(fetcher).toHaveBeenCalledTimes(2); // Existing roster + career requests only.
});

it.each([
  [{ id: "1", fullName: "Nikola Jokic Jr" }],
  [{ id: "1", fullName: "Nikola Jokic" }, { id: "2", fullName: "Nikola Jokić" }],
].map(athletes => ({ athletes })))("does not accept approximate or ambiguous normalized identities", async ({ athletes }) => {
  const fetcher = vi.fn().mockResolvedValue(ok({ athletes })); vi.stubGlobal("fetch", fetcher);
  expect(await findESPNId("Nikola Jokić", "DEN")).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([null, 123, undefined, {}, ""])("ignores malformed ESPN fullName %s", async fullName => {
  const fetcher = vi.fn().mockResolvedValue(ok({ athletes: [{ id: "3112335", fullName }] })); vi.stubGlobal("fetch", fetcher);
  expect(await findESPNId("Nikola Jokić", "DEN")).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([null, undefined, "", "   "])("does not request a roster for malformed input name %s", async name => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await findESPNId(name as unknown as string, "DEN")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
