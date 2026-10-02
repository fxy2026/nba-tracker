import { describe, expect, it, vi } from "vitest";
import actualOneRowExcerpt from "./fixtures/bigballs-actual-excerpt.json";
import { diagnoseRecoveryMetadata } from "./recovery-metadata-diagnostic";

// Synthetic metadata cases, not captured failed playoff response bodies.
function syntheticEnvelope() {
  return {
    data: { players: [{}], team_stats: [{}, {}] },
    meta: { available: true, players_available: true, team_stats_available: true, withheld: { players: 0, team_stats: 0 } },
  };
}

describe("content-free recovery metadata diagnostics", () => {
  it("describes synthetic passing metadata without claiming complete player data", () => {
    expect(diagnoseRecoveryMetadata(syntheticEnvelope())).toEqual({
      version: 1, envelope: "object", data: "object", meta: "object",
      flags: { available: "true", players_available: "true", team_stats_available: "true" },
      withheld: { kind: "object", players: { kind: "number", count: 0 }, team_stats: { kind: "number", count: 0 } },
      arrays: { players: { kind: "array", count: 1 }, team_stats: { kind: "array", count: 2 } },
      metadataGateFailures: [], planErrorCodes: [],
    });
  });

  it("reports only structure from the actual intentionally truncated one-row excerpt", () => {
    // This real excerpt is not one of the seven unavailable playoff bodies.
    const result = diagnoseRecoveryMetadata(actualOneRowExcerpt.response);
    expect(result.metadataGateFailures).toEqual([]);
    expect(result.arrays).toEqual({ players: { kind: "array", count: 1 }, team_stats: { kind: "array", count: 1 } });
    expect(JSON.stringify(result)).not.toMatch(/Jalen|Duren|Memphis|Detroit|https|43ce53a8|points|assists/);
    expect(result).not.toHaveProperty("ok");
  });

  it.each([
    [undefined, "undefined"], [null, "null"], [[], "array"], ["do not print", "string"],
    [12, "number"], [false, "boolean"], [Symbol("secret"), "invalid"], [BigInt(12), "invalid"], [() => "secret", "invalid"],
  ])("classifies malformed envelope types without returning values (%s)", (value, expectedKind) => {
    const result = diagnoseRecoveryMetadata(value);
    expect(result.envelope).toBe(expectedKind);
    expect(result.metadataGateFailures).toEqual(["malformed-envelope"]);
    expect(result.flags.available).toBe("missing");
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it.each(["data", "meta"] as const)("reports missing and malformed %s", field => {
    const raw = syntheticEnvelope();
    Reflect.deleteProperty(raw, field);
    expect(diagnoseRecoveryMetadata(raw)[field]).toBe("missing");
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toContain(`malformed-${field}`);
    Reflect.set(raw, field, []);
    expect(diagnoseRecoveryMetadata(raw)[field]).toBe("array");
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toContain(`malformed-${field}`);
  });

  it.each(["available", "players_available", "team_stats_available"] as const)("distinguishes all four states of %s", field => {
    const raw = syntheticEnvelope();
    expect(diagnoseRecoveryMetadata(raw).flags[field]).toBe("true");
    Reflect.set(raw.meta, field, false);
    expect(diagnoseRecoveryMetadata(raw).flags[field]).toBe("false");
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toContain(`flag-${field}-false`);
    Reflect.deleteProperty(raw.meta, field);
    expect(diagnoseRecoveryMetadata(raw).flags[field]).toBe("missing");
    for (const invalid of [null, undefined, "true", "false", 0, 1, {}, []]) {
      Reflect.set(raw.meta, field, invalid);
      expect(diagnoseRecoveryMetadata(raw).flags[field]).toBe("invalid");
      expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toContain(`flag-${field}-missing-or-invalid`);
    }
  });

  it.each(["players", "team_stats"] as const)("reports withheld %s numbers without coercion or treating fractional counts as valid", field => {
    const raw = syntheticEnvelope();
    for (const value of [0, 1, 0.5, Number.MAX_VALUE]) {
      Reflect.set(raw.meta.withheld, field, value);
      const result = diagnoseRecoveryMetadata(raw);
      expect(result.withheld[field]).toEqual({ kind: "number", count: value });
      if (value === 0 || (field === "team_stats" && Number.isSafeInteger(value))) expect(result.metadataGateFailures).toEqual([]);
      else expect(result.metadataGateFailures).toContain(`withheld-${field}-${Number.isSafeInteger(value) ? "positive" : "missing-or-invalid"}`);
    }
    for (const value of [-1, NaN, Infinity, -Infinity, "0", null, undefined, {}, []]) {
      Reflect.set(raw.meta.withheld, field, value);
      const result = diagnoseRecoveryMetadata(raw);
      expect(result.withheld[field].count).toBeNull();
      expect(result.metadataGateFailures).toContain(`withheld-${field}-missing-or-invalid`);
    }
    Reflect.deleteProperty(raw.meta.withheld, field);
    expect(diagnoseRecoveryMetadata(raw).withheld[field]).toEqual({ kind: "missing", count: null });
  });

  it("keeps a synthetic withheld team count of three informational while player withholding fails", () => {
    const raw = syntheticEnvelope();
    raw.meta.withheld.team_stats = 3;
    expect(diagnoseRecoveryMetadata(raw).withheld.team_stats).toEqual({ kind: "number", count: 3 });
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toEqual([]);
    raw.meta.withheld.players = 1;
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toEqual(["withheld-players-positive"]);
  });

  it.each([null, [], "private text", undefined])("withheld malformed container remains content-free (%s)", value => {
    const raw = syntheticEnvelope();
    Reflect.set(raw.meta, "withheld", value);
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toContain("withheld-missing-or-malformed");
    expect(diagnoseRecoveryMetadata(raw).withheld.players.count).toBeNull();
  });

  it("distinguishes an absent withheld object", () => {
    const raw = syntheticEnvelope();
    Reflect.deleteProperty(raw.meta, "withheld");
    expect(diagnoseRecoveryMetadata(raw).withheld.kind).toBe("missing");
    expect(diagnoseRecoveryMetadata(raw).metadataGateFailures).toEqual(["withheld-missing-or-malformed"]);
  });

  it.each(["players", "team_stats"] as const)("counts %s array length without reading rows", field => {
    const raw = syntheticEnvelope();
    const getter = vi.fn(() => { throw new Error("must not read row"); });
    const rows: unknown[] = new Array(100_000);
    Object.defineProperty(rows, 0, { get: getter });
    Reflect.set(raw.data, field, rows);
    expect(diagnoseRecoveryMetadata(raw).arrays[field]).toEqual({ kind: "array", count: 100_000 });
    expect(getter).not.toHaveBeenCalled();
    for (const value of [{ length: 4 }, "secret", null, undefined]) {
      Reflect.set(raw.data, field, value);
      expect(diagnoseRecoveryMetadata(raw).arrays[field].count).toBeNull();
    }
    Reflect.deleteProperty(raw.data, field);
    expect(diagnoseRecoveryMetadata(raw).arrays[field]).toEqual({ kind: "missing", count: null });
    Reflect.set(raw.data, field, []);
    expect(diagnoseRecoveryMetadata(raw).arrays[field]).toEqual({ kind: "array", count: 0 });
  });

  it("emits only exact allowlisted codes at fixed code locations, bounded and deduplicated", () => {
    const raw = { ...syntheticEnvelope(), code: "history_not_included", error: { code: "plan_required", message: "never print this" } };
    expect(diagnoseRecoveryMetadata(raw).planErrorCodes).toEqual(["history_not_included", "plan_required"]);
    Reflect.set(raw.meta, "code", "plan_required");
    Reflect.set(raw.meta, "error", { code: "history_not_included" });
    expect(diagnoseRecoveryMetadata(raw).planErrorCodes).toHaveLength(2);
    for (const code of ["PLAN_REQUIRED", " plan_required", "plan_required: secret", "unknown", { toString: () => "plan_required" }]) {
      expect(diagnoseRecoveryMetadata({ error: { code } }).planErrorCodes).toEqual([]);
    }
    expect(diagnoseRecoveryMetadata({ message: "plan_required", nested: { error: { code: "plan_required" } } }).planErrorCodes).toEqual([]);
  });

  it("does not execute accessors or include inherited metadata", () => {
    const read = vi.fn(() => { throw new Error("private getter message"); });
    const raw = syntheticEnvelope();
    Object.defineProperty(raw.meta, "available", { get: read });
    Object.defineProperty(raw.data, "players", { get: read });
    Object.defineProperty(raw, "error", { get: read });
    const result = diagnoseRecoveryMetadata(raw);
    expect(result.flags.available).toBe("invalid");
    expect(result.arrays.players).toEqual({ kind: "invalid", count: null });
    expect(result.planErrorCodes).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(diagnoseRecoveryMetadata(Object.create(syntheticEnvelope())).data).toBe("missing");
  });

  it("handles throwing/revoked proxies without exposing exception messages", () => {
    const throwing = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("secret"); } });
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    for (const raw of [throwing, revocable.proxy]) {
      const result = diagnoseRecoveryMetadata(raw);
      expect(JSON.stringify(result)).not.toContain("secret");
      expect(result.metadataGateFailures.length).toBeGreaterThan(0);
    }
  });

  it("has bounded content-free output and leaves input unchanged", () => {
    const secret = "CANARY_PRIVATE_VALUE".repeat(10_000);
    const raw = { ...syntheticEnvelope(), [secret]: secret, error: { code: secret, message: secret }, headers: { Authorization: secret }, url: secret };
    raw.data.players = [{ name: secret, stats: { secret }, toJSON: () => secret }];
    const before = JSON.stringify(raw);
    const serialized = JSON.stringify(diagnoseRecoveryMetadata(raw));
    expect(serialized.length).toBeLessThan(1500);
    expect(serialized).not.toMatch(/CANARY|Authorization|name|stats.*secret|url|headers/);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
