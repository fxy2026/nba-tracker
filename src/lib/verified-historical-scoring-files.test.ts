import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { HISTORICAL_SCORING_GAME_ID, historicalScoringFiles } from "./verified-historical-scoring-allowlist";

vi.mock("node:fs", async original => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync), statSync: vi.fn(fs.statSync) };
});

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

async function loader() {
  const scoring = await import("./verified-historical-scoring");
  // Imports may perform their own work; assertions concern the scoring loader.
  vi.mocked(readFileSync).mockClear();
  vi.mocked(statSync).mockClear();
  return scoring.getVerifiedHistoricalScoring;
}

it("reads exactly the four pinned absolute paths and caches successful verification", async () => {
  const getScoring = await loader();
  const result = getScoring(HISTORICAL_SCORING_GAME_ID);
  expect(result?.events).toHaveLength(96);
  const paths = Object.values(historicalScoringFiles).map(file => [join(process.cwd(), file.path)]);
  expect(vi.mocked(statSync).mock.calls).toEqual(paths);
  expect(vi.mocked(readFileSync).mock.calls).toEqual(paths);
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)).toBe(result);
  expect(statSync).toHaveBeenCalledTimes(4);
  expect(readFileSync).toHaveBeenCalledTimes(4);
});

it.each(["../../0042500405", "__proto__", "0042500404", "", "0042500405/../0042500405"])(
  "rejects an unreviewed or unsafe ID before filesystem access: %s", async id => {
    const getScoring = await loader();
    expect(getScoring(id)).toBeNull();
    expect(statSync).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
  },
);

it("does not read an oversized file and does not cache failed verification", async () => {
  const getScoring = await loader();
  vi.mocked(statSync).mockImplementationOnce(() => ({ size: 200_001 }) as ReturnType<typeof statSync>);
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)).toBeNull();
  expect(readFileSync).not.toHaveBeenCalledWith(join(process.cwd(), historicalScoringFiles.facts.path));
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)?.events).toHaveLength(96);
});

it.each(["stat", "read"])("fails closed when a pinned file cannot be accessed (%s), then allows retry", async operation => {
  const getScoring = await loader();
  const fail = () => { throw new Error("Archive unavailable"); };
  if (operation === "stat") vi.mocked(statSync).mockImplementationOnce(fail);
  else vi.mocked(readFileSync).mockImplementationOnce(fail);
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)).toBeNull();
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)?.events).toHaveLength(96);
});

it("keeps raw-byte integrity checks on the resolved paths", async () => {
  const getScoring = await loader();
  vi.mocked(readFileSync).mockReturnValueOnce(Buffer.from('{"tampered":true}'));
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)).toBeNull();
  expect(getScoring(HISTORICAL_SCORING_GAME_ID)?.events).toHaveLength(96);
});
