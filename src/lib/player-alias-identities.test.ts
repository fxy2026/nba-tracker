import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import registry from "@/data/player-identity/official-all-player-identities.compact.json";
import { OFFICIAL_PLAYER_IDENTITIES } from "./official-player-registry";
import { buildPlayerIdentityDirectory, searchPlayerIdentities, type PlayerIdentity } from "./player-identity";
import { PREFERRED_ALIAS_TARGETS, preferredAliasPlayerId } from "./player-alias-identities";
import { PLAYER_ALIASES } from "./playerAliases";

let directory: readonly PlayerIdentity[];
beforeAll(() => {
  directory = buildPlayerIdentityDirectory({ snapshot: { players: [], provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } }, historical: [], legends: [], registry: OFFICIAL_PLAYER_IDENTITIES });
  expect(directory).toHaveLength(5238);
});
it("every preferred alias identity matches the exact official NBA ID and spelling", () => {
  for (const [target, identity] of Object.entries(PREFERRED_ALIAS_TARGETS)) {
    expect(registry.rows.find(row => row[0] === identity.id)?.[1], target).toBe(identity.name);
  }
});
it.each([
  ["林书豪", 202391], ["豪小子", 202391], ["克莱", 202691], ["vinsanity", 1713],
  ["库里", 201939], ["Steph", 201939], ["chef curry", 201939], ["Magic", 77142],
  ["the admiral", 764], ["the mailman", 252], ["卡哇伊", 202695], ["the brow", 203076],
  ["奥尼尔", 406], ["曼巴", 977], ["巴克利", 787], ["冰人", 76804],
  ["jr smith", 2747], ["swipa", 1628368], ["易建联", 201146], ["manute", 76195],
])("full-registry query %s puts intended ID %s before the homepage and page result caps", (query, id) => {
  const results = searchPlayerIdentities(directory, String(query));
  expect(results[0]?.id).toBe(id); expect(results.slice(0, 8).some(row => row.id === id)).toBe(true); expect(results.slice(0, 30).some(row => row.id === id)).toBe(true);
});
it("every existing exact alias with a preferred identity survives the eight-result cap", () => {
  for (const alias of Object.keys(PLAYER_ALIASES)) {
    const preferredId = preferredAliasPlayerId(alias);
    if (preferredId === null) continue;
    expect(searchPlayerIdentities(directory, alias)[0]?.id, alias).toBe(preferredId);
  }
});
it.each(["Curry", "Thompson", "Carter", "Johnson", "Lin", "Fox", "Edwards"])("ordinary surname %s remains a multi-person search", surname => {
  expect(preferredAliasPlayerId(surname.toLowerCase())).toBeNull();
  const expected = directory.filter(row => row.name.toLowerCase().includes(surname.toLowerCase())).map(row => row.id);
  const matches = new Set(searchPlayerIdentities(directory, surname).map(row => row.id));
  expect(expected.length).toBeGreaterThan(1); for (const id of expected) expect(matches.has(id)).toBe(true);
});
it("known full-name namesakes and exact numeric IDs still take their own canonical routes", () => {
  expect(searchPlayerIdentities(directory, "Patrick Ewing").map(row => row.id)).toEqual([121, 201607]);
  expect(searchPlayerIdentities(directory, "201584")[0]?.name).not.toBe("Jeremy Lin");
  expect(searchPlayerIdentities(directory, "202391")[0]?.name).toBe("Jeremy Lin");
});
it("all 38 official exact-name groups retain every distinct NBA identity", () => {
  const groups = new Map<string, number[]>();
  for (const player of directory) groups.set(player.name, [...(groups.get(player.name) ?? []), player.id]);
  const namesakes = [...groups.entries()].filter(([, ids]) => ids.length > 1);
  expect(namesakes).toHaveLength(38);
  for (const [name, ids] of namesakes) {
    const found = new Set(searchPlayerIdentities(directory, name).slice(0, 30).map(player => player.id));
    for (const id of ids) expect(found.has(id), `${name} ${id}`).toBe(true);
  }
});

it.each([["克莱比赛", 202691], ["林书豪比赛", 202391], ["vinsanity shot chart", 1713], ["chef curry stats", 201939]])("embedded legacy alias %s preserves the intended player before the cap", (query, id) => {
  expect(searchPlayerIdentities(directory, String(query))[0]?.id).toBe(id);
});
it("exact literal names outrank incidental embedded aliases, and multi-person phrases remain unambiguous", () => {
  const victor = directory.find(player => player.name === "Victor Alexander")!;
  expect(searchPlayerIdentities(directory, "Victor Alexander")[0]?.id).toBe(victor.id);
  expect(preferredAliasPlayerId("克莱 库里")).toBeNull();
  expect(preferredAliasPlayerId("林书豪 乔丹")).toBeNull();
});
