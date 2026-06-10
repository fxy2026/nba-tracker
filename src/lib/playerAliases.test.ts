import { describe, it, expect } from "vitest";
import { PLAYER_ALIASES, expandQuery } from "./playerAliases";

describe("PLAYER_ALIASES hygiene", () => {
  // /api/search lowercases both query and haystack, so any uppercase key or
  // value is dead code that can never match.
  it("every alias key is fully lowercase", () => {
    for (const key of Object.keys(PLAYER_ALIASES)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it("every alias value is fully lowercase", () => {
    for (const value of Object.values(PLAYER_ALIASES)) {
      expect(value).toBe(value.toLowerCase());
    }
  });

  it("every alias value is non-empty", () => {
    for (const value of Object.values(PLAYER_ALIASES)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("expandQuery", () => {
  it("expands an exact English nickname", () => {
    expect(expandQuery("kobe")).toContain("bryant");
  });

  it("expands an exact Chinese nickname", () => {
    expect(expandQuery("字母哥")).toContain("antetokounmpo");
  });

  it("expands kawhi to leonard", () => {
    expect(expandQuery("kawhi")).toContain("leonard");
  });

  it("returns only the original term for an unknown query", () => {
    expect(expandQuery("xyzzy")).toEqual(["xyzzy"]);
  });

  it("always includes the original query first", () => {
    expect(expandQuery("mj")[0]).toBe("mj");
  });

  it("expands an alias embedded in a longer ASCII query", () => {
    expect(expandQuery("kd shot chart")).toContain("durant");
  });

  it("expands a CJK alias embedded in a longer CJK query", () => {
    expect(expandQuery("老詹比赛")).toContain("lebron james");
  });

  it("still expands the short key kd on its own", () => {
    expect(expandQuery("kd")).toContain("durant");
  });
});

describe("expandQuery — short ASCII keys must not pollute unrelated queries", () => {
  // Contract per finding: single-word ASCII keys ("ja", "ad", "ant") must
  // match whole whitespace tokens, not arbitrary substrings, otherwise a
  // search for one player surfaces an unrelated one.
  it("does not expand james to ja morant via the key 'ja'", () => {
    expect(expandQuery("james")).not.toContain("ja morant");
  });

  it("does not expand wade to anthony davis via the key 'ad'", () => {
    expect(expandQuery("wade")).not.toContain("anthony davis");
  });

  it("does not expand durant to anthony edwards via the key 'ant'", () => {
    expect(expandQuery("durant")).not.toContain("anthony edwards");
  });
});
