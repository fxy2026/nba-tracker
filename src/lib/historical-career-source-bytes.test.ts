import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getHistoricalCareerArchive, validateHistoricalCareerArchive, validateHistoricalCareerArchiveSource } from "./historical-career-archive";

const sha = (source: string | Uint8Array) => createHash("sha256").update(source).digest("hex");
const fixture = (id: number) => readFileSync(new URL(`../data/historical-career-archives/${id}-2026-10-04.json`, import.meta.url));

describe("original historical archive byte integrity", () => {
  it.each([[893, 28], [977, 35], [1495, 37], [76003, 38], [76375, 27], [406, 36], [77142, 26], [1449, 25]])("loads audited source bytes for %i", async (id, count) => {
    const source = fixture(id);
    const raw = JSON.parse(source.toString("utf8"));
    const data = validateHistoricalCareerArchiveSource(source, id, sha(source), sha(JSON.stringify(raw)));
    expect(data?.rows).toHaveLength(count);
    expect((await getHistoricalCareerArchive(id))?.rows).toEqual(data?.rows);
    expect(data?.rows.every(row => row.sourceStatus === "secondary_source")).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/evidenceSha256|sourceObservations|roundedSourceRatiosAndPerGame|publishedCareerTotals/);
  });
  it("rejects changed source bytes even when JSON meaning and canonical hash are unchanged", () => {
    const source = fixture(406);
    const canonical = sha(JSON.stringify(JSON.parse(source.toString("utf8"))));
    expect(validateHistoricalCareerArchiveSource(Buffer.concat([source, Buffer.from(" ")]), 406, sha(source), canonical)).toBeNull();
    expect(validateHistoricalCareerArchiveSource(source, 406, "untrusted", canonical)).toBeNull();
    expect(validateHistoricalCareerArchiveSource(source, 406, sha(source), "untrusted")).toBeNull();
    expect(validateHistoricalCareerArchiveSource(source, 977, sha(source), canonical)).toBeNull();
  });
  it("fails closed for malformed JSON or an invalid schema after byte verification", () => {
    const malformed = Buffer.from("{");
    expect(validateHistoricalCareerArchiveSource(malformed, 406, sha(malformed), "unused")).toBeNull();
    const invalid = Buffer.from('{"schemaVersion":2}');
    expect(validateHistoricalCareerArchiveSource(invalid, 406, sha(invalid), sha(invalid))).toBeNull();
  });
  it("bypasses compiler float rewriting without accepting altered audit observations", () => {
    const source = fixture(406);
    const original = JSON.parse(source.toString("utf8"));
    const expected = sha(JSON.stringify(original));
    const compiled = structuredClone(original);
    expect(compiled.validation.roundedSourceRatiosAndPerGame[14].fromReportedTotals).toBe(2.4074074074074074);
    compiled.validation.roundedSourceRatiosAndPerGame[14].fromReportedTotals = 2.407407407407407;
    expect(validateHistoricalCareerArchive(compiled, 406, expected)).toBeNull();
    expect(validateHistoricalCareerArchiveSource(source, 406, sha(source), expected)?.rows).toHaveLength(36);
    const altered = Buffer.from(JSON.stringify(compiled));
    expect(validateHistoricalCareerArchiveSource(altered, 406, sha(source), expected)).toBeNull();
  });
  it.each([0, -1, 999999, NaN, Infinity])("does not read an archive outside the explicit player allowlist: %s", async id => {
    expect(await getHistoricalCareerArchive(id)).toBeNull();
  });
});
