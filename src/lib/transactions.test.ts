import { describe, it, expect } from "vitest";
import { parseTransactionPlayers, classifyTransaction } from "./transactions";

describe("parseTransactionPlayers", () => {
  it("extracts multiple position-prefixed names in document order", () => {
    expect(
      parseTransactionPlayers(
        "Signed C Felix Okpara to a two-way contract. Acquired C Deandre Ayton from Los Angeles Lakers."
      )
    ).toEqual(["Felix Okpara", "Deandre Ayton"]);
  });

  it("handles plural position tokens, hyphens, and stops at sentence boundaries", () => {
    expect(
      parseTransactionPlayers(
        "Signed Gs Michael Ajayi and Kylan Boswell to two-way contracts. Waived F Tosan Evbuomwan. Acquired F Dorian Finney-Smith and three second-round picks from Houston."
      )
    ).toEqual(["Michael Ajayi", "Tosan Evbuomwan", "Dorian Finney-Smith"]);
  });

  it("handles camelCase and apostrophe names", () => {
    expect(parseTransactionPlayers("Waived G DeMar DeRozan.")).toEqual(["DeMar DeRozan"]);
    expect(parseTransactionPlayers("Signed C Day'Ron Sharpe to a contract.")).toEqual(["Day'Ron Sharpe"]);
    expect(
      parseTransactionPlayers("Acquired G De'Aaron Fox and G Zach LaVine from Chicago.")
    ).toEqual(["De'Aaron Fox", "Zach LaVine"]);
  });

  it("dedupes and returns [] when no position-prefixed name is present", () => {
    expect(parseTransactionPlayers("Acquired draft considerations from Atlanta Hawks.")).toEqual([]);
    expect(parseTransactionPlayers("")).toEqual([]);
  });

  it("drops affiliate/team noise phrases and never fabricates players", () => {
    expect(parseTransactionPlayers("Assigned G John Doe to G League Ignite.")).toEqual(["John Doe"]);
  });
});

describe("classifyTransaction", () => {
  it("returns the kind of the EARLIEST action keyword (first/primary action)", () => {
    expect(
      classifyTransaction(
        "Signed C Felix Okpara to a two-way contract. Acquired C Deandre Ayton from Los Angeles Lakers."
      )
    ).toBe("signed");
  });

  it("classifies trades from trade/acquire", () => {
    expect(
      classifyTransaction("Acquired draft considerations from Atlanta Hawks for G Aaron Wiggins.")
    ).toBe("traded");
    expect(classifyTransaction("Traded G Jaden Hardy to Washington.")).toBe("traded");
  });

  it("classifies waivers, claims, and signings", () => {
    expect(classifyTransaction("Waived G DeMar DeRozan.")).toBe("waived");
    expect(classifyTransaction("Claimed G Justin Champagnie off waivers.")).toBe("claimed");
    expect(classifyTransaction("Re-signed F Precious Achiuwa to a contract.")).toBe("signed");
  });

  it("returns 'other' on no keyword match", () => {
    expect(classifyTransaction("Exercised team option.")).toBe("other");
    expect(classifyTransaction("")).toBe("other");
  });

  it("matches keywords on word boundaries so G-League moves are not signings", () => {
    expect(classifyTransaction("Assigned G John Doe to the G League affiliate.")).toBe("other");
    expect(classifyTransaction("Reassigned F Jane Roe to the G League affiliate.")).toBe("other");
  });
});
