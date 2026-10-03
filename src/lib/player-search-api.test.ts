import { beforeEach, expect, it, vi } from "vitest";
import type { PlayerIdentity } from "./player-identity";
const { directory } = vi.hoisted(() => ({ directory: vi.fn() }));
vi.mock("@/lib/player-identity-server", () => ({ getPlayerIdentityDirectory: directory }));
import { GET } from "@/app/api/players/search/route";
const row = (id: number, name: string, extra: Partial<PlayerIdentity> = {}): PlayerIdentity => ({ id, name, href: `/player/${id}`, aliases: [], sources: ["all-time-registry"], teamLabel: null, teamAbbr: null, position: null, indexProvenance: null, shotCoverage: null, ...extra });
const rows = [row(787, "Charles Barkley"), row(901, "Otis Thorpe"), row(76804, "George Gervin"), row(76681, "Julius Erving"), row(201939, "Stephen Curry", { sources: ["player-index"], teamLabel: "Golden State Warriors", teamAbbr: "GSW" }), row(893, "Michael Jordan"), row(2, "Historical ID fixture"), row(203999, "Nikola Jokić"), row(121, "Patrick Ewing"), row(201607, "Patrick Ewing"), row(1863, "Earl Boykins", { sources: ["historical-shots"] })];
beforeEach(() => directory.mockResolvedValue(rows));
it.each([
  ["Barkley", 787], ["sir charles", 787], ["Gervin", 76804], ["901", 901], ["76681", 76681], ["Curry", 201939], ["Michael Jordan", 893], ["Earl Boykins", 1863], ["203999", 203999], ["2", 2], ["Jokic", 203999], ["乔丹", 893],
])("the shared identity endpoint resolves %s without fetching a biography", async (query, id) => {
  const response = await GET(new Request(`https://example.test/api/players/search?q=${encodeURIComponent(query)}`));
  expect(response.status).toBe(200); const json = await response.json(); expect(json.data[0]).toMatchObject({ id, href: `/player/${id}` });
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
  expect(JSON.stringify(json)).not.toContain("biography"); expect(Buffer.byteLength(JSON.stringify(json))).toBeLessThan(5000);
});
it("preserves namesake IDs and supports existing team queries", async () => {
  const namesakes = await (await GET(new Request("https://example.test/api/players/search?q=Patrick%20Ewing"))).json();
  expect(namesakes.data.map((player: PlayerIdentity) => player.id)).toEqual([121, 201607]);
  const team = await (await GET(new Request("https://example.test/api/players/search?q=Warriors"))).json(); expect(team.data[0].id).toBe(201939);
});
it("bounds requests to eight results by default and thirty even for a hostile limit", async () => {
  directory.mockResolvedValue(Array.from({ length: 60 }, (_, index) => row(index + 1, `Player ${index}`)));
  for (const [limit, expected] of [["", 8], ["&limit=2000", 30], ["&limit=-2", 1], ["&limit=bogus", 8]] as const) {
    const json = await (await GET(new Request(`https://example.test/api/players/search?q=Player${limit}`))).json(); expect(json.data).toHaveLength(expected);
  }
});
it("short/empty input needs no directory fetch, valid absent names return an explicit empty array", async () => {
  directory.mockClear();
  expect(await (await GET(new Request("https://example.test/api/players/search?q=C"))).json()).toEqual({ data: [] }); expect(directory).not.toHaveBeenCalled();
  expect(await (await GET(new Request("https://example.test/api/players/search?q=NoSuchPlayer"))).json()).toEqual({ data: [] });
});
it("an unavailable directory is distinct from no matches and is not cached", async () => {
  directory.mockRejectedValueOnce(new Error("unavailable"));
  const response = await GET(new Request("https://example.test/api/players/search?q=Curry"));
  expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(await response.json()).toHaveProperty("error");
});
