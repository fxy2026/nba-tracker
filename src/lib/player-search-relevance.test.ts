import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildPlayerIdentityDirectory, searchPlayerIdentities, type PlayerIdentity } from "./player-identity";

const { getDirectory } = vi.hoisted(() => ({ getDirectory: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/player-identity-server", () => ({ getPlayerIdentityDirectory: getDirectory }));
import { OFFICIAL_PLAYER_IDENTITIES } from "./official-player-registry";
import { GET } from "@/app/api/players/search/route";

let directory: readonly PlayerIdentity[];
beforeAll(() => {
  directory = buildPlayerIdentityDirectory({
    snapshot: { players: [], provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } },
    historical: [{ playerId: 201939, name: "Stephen Curry", firstSeason: "2009-10", lastSeason: "2025-26", datasetCount: 1 }],
    legends: [{ id: 201939, name: "Stephen Curry" }],
    registry: OFFICIAL_PLAYER_IDENTITIES,
  });
  getDirectory.mockResolvedValue(directory);
});

const ids = (players: readonly PlayerIdentity[]) => players.map(player => player.id);

describe("canonical player-search relevance", () => {
  it("ranks every whole Curry surname before the Scurry substring without inventing an activity/popularity tier", () => {
    const result = searchPlayerIdentities(directory, "Curry");
    expect(ids(result)).toEqual([209, 2201, 201191, 688, 203552, 201939, 78102]);
    expect(result.map(player => player.name)).toEqual([
      "Dell Curry", "Eddy Curry", "JamesOn Curry", "Michael Curry", "Seth Curry", "Stephen Curry", "Carey Scurry",
    ]);
    expect(result.every(player => !("active" in player))).toBe(true);
  });

  it("ranks complete name tokens before both name prefixes and interior substrings", () => {
    // Fictional identities isolate the matching tiers from existing nickname mappings.
    const row = directory.find(player => player.id === 201939)!;
    const players = [
      { ...row, id: 1, name: "Curryson Example", aliases: [] },
      { ...row, id: 2, name: "Carey Scurry", aliases: [] },
      { ...row, id: 3, name: "Zed Curry", aliases: [] },
      { ...row, id: 4, name: "Alex Curry-Jones", aliases: [] },
    ];
    expect(ids(searchPlayerIdentities(players, "Curry"))).toEqual([4, 3, 1, 2]);
  });

  it("keeps an exact historical full name above the contemporary player from an incidental alias", () => {
    const result = searchPlayerIdentities(directory, "Victor Alexander");
    expect(result[0]?.name).toBe("Victor Alexander");
    expect(result.findIndex(player => player.id === 1641705)).toBeGreaterThan(0);
    expect(searchPlayerIdentities(directory, "Carey Scurry")[0]?.id).toBe(78102);
    expect(searchPlayerIdentities(directory, "Dell Curry")[0]?.id).toBe(209);
  });

  it.each([
    ["库里", 201939], ["chef curry", 201939], ["Steph", 201939], ["乔丹", 893],
    ["Jokic", 203999], ["Nikola Jokić", 203999], ["Ha Seung-jin", 2775], ["201939", 201939], ["2", 2],
  ])("preserves the intended alias, diacritic or ID result for %s", (query, id) => {
    expect(searchPlayerIdentities(directory, String(query))[0]?.id).toBe(id);
  });

  it("treats query regex punctuation literally", () => {
    for (const query of [".*", "[", "(Curry)", "Curry+", "\\", "$"]) {
      expect(searchPlayerIdentities(directory, query), query).toEqual([]);
    }
    expect(searchPlayerIdentities(directory, "O'Neal").some(player => player.id === 406)).toBe(true);
  });

  it("keeps deterministic name/ID ties and distinct namesakes regardless of input order", () => {
    expect(ids(searchPlayerIdentities(directory, "Patrick Ewing"))).toEqual([121, 201607]);
    for (const query of ["Curry", "Johnson", "Patrick Ewing"]) {
      const matches = searchPlayerIdentities(directory, query);
      expect(ids(searchPlayerIdentities([...directory].reverse(), query))).toEqual(ids(matches));
      expect(new Set(ids(matches)).size).toBe(matches.length);
    }
  });

  it("applies endpoint limits after deterministic ranking without duplicate IDs or upstream calls", async () => {
    const fetch = vi.fn(() => { throw new Error("No upstream player-search requests"); });
    vi.stubGlobal("fetch", fetch);
    try {
      for (const [query, limit, count] of [["Curry", "4", 4], ["Johnson", "", 8], ["Johnson", "2000", 30], ["Johnson", "bogus", 8]] as const) {
        const response = await GET(new Request(`https://example.test/api/players/search?q=${query}${limit ? `&limit=${limit}` : ""}`));
        const { data } = await response.json() as { data: PlayerIdentity[] };
        expect(response.status).toBe(200);
        expect(data).toHaveLength(count);
        expect(ids(data)).toEqual(ids(searchPlayerIdentities(directory, query).slice(0, count)));
        expect(new Set(ids(data)).size).toBe(count);
        expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=3600");
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
