import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getScatterArchive } from "./scatter-archive-server";
import { getBundledPlayerIndexSnapshot } from "./api";

it("projects the exact bundled season, complete values and true zeros without upstream requests", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No upstream"));
  const archive = getScatterArchive();
  expect(archive.season).toBe("2025-26");
  expect(archive.total).toBe(587);
  expect(archive.rows).toHaveLength(582);
  expect(archive.omitted).toBe(5);
  expect(new Set(archive.rows.map(r => r.PLAYER_ID)).size).toBe(582);
  const source = getBundledPlayerIndexSnapshot().players;
  for (const row of archive.rows) {
    const p = source.find(p => p.personId === row.PLAYER_ID)!;
    expect([row.PTS, row.REB, row.AST]).toEqual([p.pts, p.reb, p.ast]);
    expect(Object.keys(row).sort()).toEqual(["AST", "PLAYER", "PLAYER_ID", "PTS", "REB", "TEAM"]);
    if (!p.teamId) expect(row.TEAM).toBe("");
  }
  expect(archive.rows.some(r => r.PTS === 0 || r.REB === 0 || r.AST === 0)).toBe(true);
  expect(JSON.parse(JSON.stringify(archive))).toEqual(archive);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
