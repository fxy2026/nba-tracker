import { describe, it, expect } from "vitest";
import { findTeamByDisplayName } from "./teams";

describe("findTeamByDisplayName", () => {
  it("matches Orlando Magic to ORL, not LAC via the 'la' substring in 'Orlando'", () => {
    expect(findTeamByDisplayName("Orlando Magic")?.tricode).toBe("ORL");
  });

  it("matches LA Clippers to LAC", () => {
    expect(findTeamByDisplayName("LA Clippers")?.tricode).toBe("LAC");
  });

  it("matches Los Angeles Lakers to LAL", () => {
    expect(findTeamByDisplayName("Los Angeles Lakers")?.tricode).toBe("LAL");
  });

  it("matches Golden State Warriors to GSW", () => {
    expect(findTeamByDisplayName("Golden State Warriors")?.tricode).toBe("GSW");
  });

  it("matches Charlotte Hornets to CHA, not BKN via the 'nets' substring in 'Hornets'", () => {
    expect(findTeamByDisplayName("Charlotte Hornets")?.tricode).toBe("CHA");
  });

  it("matches Brooklyn Nets to BKN", () => {
    expect(findTeamByDisplayName("Brooklyn Nets")?.tricode).toBe("BKN");
  });

  it("matches Philadelphia 76ers to PHI", () => {
    expect(findTeamByDisplayName("Philadelphia 76ers")?.tricode).toBe("PHI");
  });

  it("matches Portland Trail Blazers to POR", () => {
    expect(findTeamByDisplayName("Portland Trail Blazers")?.tricode).toBe("POR");
  });

  it("falls back to an unambiguous city when the nickname is absent", () => {
    expect(findTeamByDisplayName("Oklahoma City")?.tricode).toBe("OKC");
  });

  it("is case-insensitive", () => {
    expect(findTeamByDisplayName("boston celtics")?.tricode).toBe("BOS");
  });

  it("returns null for an unknown team", () => {
    expect(findTeamByDisplayName("Springfield Isotopes")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(findTeamByDisplayName("")).toBeNull();
  });
});
