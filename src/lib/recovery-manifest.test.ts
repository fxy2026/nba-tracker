import { describe, expect, it, vi } from "vitest";
import { parseRecoveryManifest, type RecoveryManifest, type RecoveryManifestGame } from "./recovery-manifest";

const memDet: RecoveryManifestGame = {
  nbaGameId: "0022500961", providerMatchId: "5ce3b301-7023-433a-b8d1-ce8ee1b306be", season: "2025-26", gameDate: "2026-03-13",
  home: { tricode: "DET", score: 126 }, away: { tricode: "MEM", score: 110 },
};
const denAtl: RecoveryManifestGame = {
  nbaGameId: "0022500340", providerMatchId: "a8da9b0f-573e-4b78-9cf4-7f2838449969", season: "2025-26", gameDate: "2025-12-05",
  home: { tricode: "ATL", score: 133 }, away: { tricode: "DEN", score: 134 },
};
const manifest = (): RecoveryManifest => ({ version: 1, games: [structuredClone(memDet), structuredClone(denAtl)] });
const one = (changes: Record<string, unknown> = {}) => ({ version: 1, games: [{ ...structuredClone(memDet), ...changes }] });
const rejected = (value: unknown, part?: string) => {
  const result = parseRecoveryManifest(value);
  expect(result.ok).toBe(false);
  if (!result.ok) { expect(result.errors.length).toBeGreaterThan(0); if (part) expect(result.errors.join(" ")).toContain(part); }
  expect(result).not.toHaveProperty("manifest");
};

describe("offline recovery manifest validation", () => {
  it("accepts the two verified sample identities without mutating or aliasing input", () => {
    const input = manifest(); const before = structuredClone(input); const result = parseRecoveryManifest(input);
    expect(result).toEqual({ ok: true, manifest: before }); expect(input).toEqual(before);
    if (result.ok) { result.manifest.games[0].home.score = 1; expect(input.games[0].home.score).toBe(126); }
  });

  it.each([null, undefined, true, 1, "{}", [], {}, { version: 1 }, { version: 2, games: [memDet] }, { version: "1", games: [memDet] }, { version: 1, games: [] }, { version: 1, games: {} }])("rejects invalid root or empty manifest %#", input => rejected(input));
  it("rejects more than100 entries and accepts exactly100 unique entries", () => {
    const games = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(memDet), nbaGameId: `00225${String(i + 1).padStart(5, "0")}`, providerMatchId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
    expect(parseRecoveryManifest({ version: 1, games }).ok).toBe(true);
    rejected({ version: 1, games: [...games, memDet] }, "1 to 100");
  });

  it.each(["22500961", "00225009610", "002250096x", " 0022500961", "0022500961\n", "0002500961", "0072500961", "1322500961", 22500961])("rejects noncanonical NBA ID %j", nbaGameId => rejected(one({ nbaGameId }), "nbaGameId"));
  it.each(["2025-27", "2025-2026", "25-26", "2025-26 ", "2024-25", "0000-01", "9999-00", 2025])("rejects invalid or mismatched season %j", season => rejected(one({ season }), "season"));
  it("accepts century rollover with matching NBA year digits", () => {
    expect(parseRecoveryManifest(one({ nbaGameId: "0029900961", season: "2099-00", gameDate: "2100-01-01" })).ok).toBe(true);
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "2026-01-32", "2026-3-13", "2026-03-13T00:00:00Z", "2024-03-13", "2027-03-13", "0000-01-01", "2026-03-13 ", 20260313])("rejects invalid or out-of-season calendar date %j", gameDate => rejected(one({ gameDate }), "gameDate"));
  it("checks leap days with Gregorian century rules without reading the clock", () => {
    expect(parseRecoveryManifest(one({ nbaGameId: "0022300961", season: "2023-24", gameDate: "2024-02-29" })).ok).toBe(true);
    expect(parseRecoveryManifest(one({ nbaGameId: "0029900961", season: "1999-00", gameDate: "2000-02-29" })).ok).toBe(true);
    rejected(one({ nbaGameId: "0029900961", season: "2099-00", gameDate: "2100-02-29" }), "gameDate");
  });

  it.each(["", "5ce3b3017023433ab8d1ce8ee1b306be", "5ce3b301-7023-033a-b8d1-ce8ee1b306be", "5ce3b301-7023-433a-78d1-ce8ee1b306be", "00000000-0000-0000-0000-000000000000", "5ce3b301-7023-433a-b8d1-ce8ee1b306bg", "5ce3b301-7023-433a-b8d1-ce8ee1b306be ", 1])("rejects invalid provider UUID %j", providerMatchId => rejected(one({ providerMatchId }), "providerMatchId"));
  it("normalizes UUID case and detects case-insensitive duplicates", () => {
    const result = parseRecoveryManifest(one({ providerMatchId: memDet.providerMatchId.toUpperCase() }));
    if (!result.ok) throw new Error(result.errors.join(" "));
    expect(result.manifest.games[0].providerMatchId).toBe(memDet.providerMatchId);
    rejected({ version: 1, games: [memDet, { ...denAtl, providerMatchId: memDet.providerMatchId.toUpperCase() }] }, "providerMatchId is duplicated");
  });
  it("rejects repeated NBA IDs independently of provider IDs", () => rejected({ version: 1, games: [memDet, { ...denAtl, nbaGameId: memDet.nbaGameId }] }, "nbaGameId is duplicated"));

  it.each(["XXX", "det", "DET ", "__proto__", "constructor", "toString", null])("rejects unknown/prototype team %j", tricode => rejected(one({ home: { tricode, score: 126 } }), "tricode"));
  it("requires distinct teams", () => rejected(one({ away: { tricode: "DET", score: 110 } }), "different home and away"));
  it.each([NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "126", null])("rejects unsafe final score %j", score => rejected(one({ home: { tricode: "DET", score } }), "score"));
  it("allows genuine zero but rejects tied final scores", () => {
    expect(parseRecoveryManifest(one({ home: { tricode: "DET", score: 0 } })).ok).toBe(true);
    rejected(one({ home: { tricode: "DET", score: 110 } }), "unequal final scores");
  });

  it("rejects unknown keys at every level, including JSON prototype keys", () => {
    rejected({ ...manifest(), apiKey: "not-a-key" }, "required fields");
    rejected(one({ endpoint: "https://example.invalid" }), "required fields");
    rejected(one({ home: { tricode: "DET", score: 126, extra: true } }), "required fields");
    rejected(JSON.parse('{"version":1,"games":[],"__proto__":{"polluted":true}}'), "required fields");
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
  it("does not inherit fields from prototypes or accept class instances", () => {
    rejected(Object.create(manifest()), "plain object");
    rejected({ version: 1, games: [Object.create(memDet)] }, "plain object");
    rejected(one({ home: Object.assign(Object.create({ tricode: "DET" }), { score: 126 }) }), "plain object");
    rejected(new Date(0), "plain object");
  });
  it("never invokes accessors for manifest, game, team, or array values", () => {
    const get = vi.fn(() => { throw new Error("Accessor executed"); });
    const root = manifest(); Object.defineProperty(root, "games", { get }); rejected(root, "own data field");
    const game = structuredClone(memDet); Object.defineProperty(game, "nbaGameId", { get }); rejected({ version: 1, games: [game] }, "own data field");
    const home = { tricode: "DET", score: 126 }; Object.defineProperty(home, "score", { get }); rejected(one({ home }), "own data field");
    const games = [memDet]; Object.defineProperty(games, "0", { get }); rejected({ version: 1, games }, "own data entry");
    expect(get).not.toHaveBeenCalled();
  });
  it("rejects sparse arrays, array extras, symbol keys, and revoked proxies without throwing", () => {
    rejected({ version: 1, games: Array(1) }, "dense data array");
    const games = [memDet]; Reflect.set(games, "unexpected", true); rejected({ version: 1, games }, "dense data array");
    const raw = manifest(); Reflect.set(raw, Symbol("extra"), true); rejected(raw, "required fields");
    const proxy = Proxy.revocable({}, {}); proxy.revoke(); rejected(proxy.proxy, "ordinary JSON data");
  });
});
