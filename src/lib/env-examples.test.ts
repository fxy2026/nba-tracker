import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read only these tracked, credential-free templates, never actual .env files.
const examplePaths = [".env.example", ".env.local.example"] as const;
const expectedAssignments = [
  "BALLDONTLIE_API_KEY=",
  "NEXT_PUBLIC_SUPABASE_URL=",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
  "ADMIN_PASSWORD=",
  "NEXT_PUBLIC_SITE_URL=",
];

describe("optional environment examples", () => {
  it.each(examplePaths)("keeps %s blank and limited to supported keys", path => {
    const example = readFileSync(path, "utf8");
    const assignments = example.split(/\r?\n/).map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
    expect(assignments).toEqual(expectedAssignments);
    expect(example).not.toContain("NEXT_PUBLIC_BALLDONTLIE_API_KEY");
    expect(example).toMatch(/main browsing pages start without API keys or a database/i);
  });

  it.each(examplePaths)("labels %s salary and legacy replay settings accurately", path => {
    const example = readFileSync(path, "utf8");
    expect(example).toMatch(/optional, server-only BallDontLie key for \/api\/salary/i);
    expect(example).toMatch(/optional legacy replay storage compatibility only/i);
    expect(example).toMatch(/public replay pages and admin replay management UI have been retired/i);
    expect(example).not.toMatch(/needed for replay links feature|for \/admin replay management page|public API key for client-side game search/i);
  });

  it("keeps both tracked templates consistent", () => {
    expect(readFileSync(examplePaths[0], "utf8")).toBe(readFileSync(examplePaths[1], "utf8"));
  });
});
