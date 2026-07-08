# Batch 1: Data-Layer Hardening + Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defuse the two season-rollover time bombs, fix the two live bugs (/injuries team mismatch, /history TBD champions), eliminate three performance sinks (player-page 4s stall, player-shots PBP re-downloads, 11MB schedule cold-start tax), and add timeout/breaker/poisoning/rate-limit protection across the external-API layer.

**Architecture:** Pure derivations replace hardcoded season constants; a committed end-of-season snapshot JSON backstops the single-season CDN feed; a shared stats.nba.com proxy module (headers + blackhole breaker) replaces four copy-pasted implementations; the 11MB schedule moves behind a slim self-proxy route (<2MB response, edge + data-cache eligible) with the raw fetch as fallback. All changes preserve existing public signatures (getFullSchedule, CURRENT_SEASON, response shapes).

**Tech Stack:** Next.js 16.2.4 App Router (all routes dynamic SSR), React 19.2.4, TypeScript 5 strict, vitest 4.

**Spec:** docs/superpowers/specs/2026-07-08-batch1-hardening-design.md

**Task dependency order (MUST be respected):**
- A1, B4, C8, C10, C11a-c, E — independent.
- A3 before D1/D2 (both touch src/lib/api.ts schedule path; D was drafted against post-A3 code).
- C7 before C9 (C9's getPlayByPlay anchor reflects post-C7 code).
- A2a before A2b/A2c and before B5 (they consume the snapshot JSON).
- C6a before C6b before C6c (statsProxy → migrate → behavior change). C6d independent of C6a-c.
- Edit anchors are code snippets, not line numbers: if an anchor no longer matches exactly, locate the equivalent post-predecessor code and adapt minimally — do not skip the edit.

---

### Task A1: 赛季派生化 — derive CURRENT_SEASON from the clock

**Files:**
- Modify: `src/lib/constants.ts`
- Test (Create): `src/lib/constants.test.ts`
- Read-only verification (NO edits): `src/app/awards-race/AwardsRaceClient.tsx`, `src/components/SeasonProgress.tsx`

Context: `src/lib/constants.ts` is currently 5 lines with a hardcoded `CURRENT_SEASON = "2025-26"` that goes stale on 2026-10-01. This task makes it derived. SHARED CONTRACT — other task groups import these exact names: `currentSeason(date?: Date): string` and `CURRENT_SEASON: string`. Do not rename, do not change the signature.

- [ ] **Step 1: Write the failing test.** Create `src/lib/constants.test.ts` with exactly:

```ts
import { describe, it, expect } from "vitest";
import { currentSeason, CURRENT_SEASON } from "./constants";

describe("currentSeason", () => {
  it("returns 2025-26 on the last day of September 2026 (UTC)", () => {
    expect(currentSeason(new Date("2026-09-30T23:59:59Z"))).toBe("2025-26");
  });

  it("rolls over to 2026-27 on October 1, 2026 (UTC)", () => {
    expect(currentSeason(new Date("2026-10-01T00:00:00Z"))).toBe("2026-27");
  });

  it("returns the in-progress season in January", () => {
    expect(currentSeason(new Date("2026-01-15T12:00:00Z"))).toBe("2025-26");
  });

  it("returns the in-progress season in June (playoffs window)", () => {
    expect(currentSeason(new Date("2026-06-15T12:00:00Z"))).toBe("2025-26");
  });

  it("returns the just-finished season in July (offseason)", () => {
    expect(currentSeason(new Date("2026-07-08T12:00:00Z"))).toBe("2025-26");
  });

  it("pads the ending year to two digits", () => {
    expect(currentSeason(new Date("2029-11-01T00:00:00Z"))).toBe("2029-30");
  });

  it("CURRENT_SEASON is derived and formatted YYYY-YY", () => {
    expect(CURRENT_SEASON).toBe(currentSeason());
    expect(CURRENT_SEASON).toMatch(/^\d{4}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run src/lib/constants.test.ts`. Expected failure: the import of `currentSeason` fails because `src/lib/constants.ts` does not export it yet.

- [ ] **Step 3: Implement.** Replace the ENTIRE contents of `src/lib/constants.ts`. Current contents (all 5 lines):

```ts
// Central season configuration — update here each new season
export const CURRENT_SEASON = "2025-26";
export const SEASON_START = "2025-10-21";
export const SEASON_END = "2026-04-12";
export const PLAYOFFS_END = "2026-06-21";
```

New contents:

```ts
// CURRENT_SEASON is derived from the clock (UTC): Oct 1 rolls to the new season;
// Jul-Sep still return the just-finished season, because offseason queries against
// leagueleaders/playergamelog must target the completed season.
// SEASON_START / SEASON_END / PLAYOFFS_END are display-only fallbacks (SeasonProgress
// phase bar) — still updated by hand once per season.
export function currentSeason(date: Date = new Date()): string {
  const startYear = date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYY}`;
}
export const CURRENT_SEASON = currentSeason();
export const SEASON_START = "2025-10-21";
export const SEASON_END = "2026-04-12";
export const PLAYOFFS_END = "2026-06-21";
```

Note: today (July 2026) `currentSeason()` returns `"2025-26"` — identical to the old literal, so the ~25 existing importers of `CURRENT_SEASON` see zero behavioral change.

- [ ] **Step 4: Run the test — expect PASS.** Run `npx vitest run src/lib/constants.test.ts`. All 7 tests pass.

- [ ] **Step 5: Verify AwardsRaceClient needs NO edit.** Run `grep -n "CURRENT_SEASON_START_YEAR" src/app/awards-race/AwardsRaceClient.tsx`. Expected output includes the definition:

```ts
const CURRENT_SEASON_START_YEAR = parseInt(CURRENT_SEASON.split("-")[0], 10);
```

This already derives the rookie-class year from `CURRENT_SEASON` (used at lines ~193-194 for `fromYear`/`toYear`/`draftYear` rookie eligibility). Now that `CURRENT_SEASON` itself is clock-derived, this constant rolls over automatically on Oct 1 (`"2026-27"` → `2026`). Do NOT modify this file — the spec item is satisfied by the constants.ts change alone.

- [ ] **Step 6: Verify SeasonProgress stays constants-based (accepted limitation).** Confirm `src/components/SeasonProgress.tsx` still compiles unchanged: run `npx tsc --noEmit` (expect 0 errors). Do NOT modify `SeasonProgress.tsx`: it takes no props (`<SeasonProgress />` in `src/components/HomeClient.tsx`) and no schedule data is plumbed to it, so switching it to real first/last game dates would require new data plumbing — deliberately out of scope (YAGNI). Accepted limitation: after Oct 2026 the header will read "2026-27 Season · Offseason" until `SEASON_START`/`SEASON_END`/`PLAYOFFS_END` are hand-bumped for the new season; the comment added in Step 3 documents that these three constants remain a once-per-season manual update.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts
git commit -m "fix(constants): derive CURRENT_SEASON from the clock — no manual rollover bump"
```

---

### Task A3: 缓存投毒防护 — empty-payload guards for api.ts module caches

**Files:**
- Modify: `src/lib/api.ts`
- Test (Create): `src/lib/api-cache-guards.test.ts`

Context: `src/lib/api.ts` keeps two module-level caches. (1) `scheduleCache` — `fetchScheduleBlocking` and `fetchScheduleInBackground` currently commit whatever parses, so a 200 response with an empty/reshaped body poisons the cache with `[]` for the lambda's lifetime (and a background refresh can overwrite good stale data with `[]`). (2) `playerIndexCache` — `getPlayerIndex` uses `if (playerIndexCache)` which is truthy for `[]`, and `fetchPlayerIndex` calls `rs.rowSet.map(...)` without guarding a missing `rowSet` (uncaught TypeError). Keep edits MINIMAL and anchored to the exact snippets below — Task D restructures this file's schedule path afterward and depends on these anchors being the only changes.

- [ ] **Step 1: Write the failing test.** Create `src/lib/api-cache-guards.test.ts` with exactly:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const goodSchedule = {
  leagueSchedule: {
    gameDates: [{ gameDate: "10/21/2025 00:00:00", games: [] }],
  },
};

const goodPlayerRow: (string | number | null)[] = [
  1629029, "Doncic", "Luka", "luka-doncic", 1610612747, null, null,
  "Los Angeles", "Lakers", "LAL", "77", "F-G", "6-6", "230",
  "Real Madrid", "Slovenia", 2018, 1, 3, null, "2018", "2025",
  28.2, 8.3, 7.8,
];

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

async function loadApi() {
  return import("./api");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schedule cache poisoning guards", () => {
  it("does not commit the schedule cache when gameDates is empty", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getFullSchedule();
    expect(first).toEqual([]);
    expect(api.getScheduleAge()).toBeNull();

    const second = await api.getFullSchedule();
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches a non-empty schedule and serves it without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await api.getFullSchedule();
    const again = await api.getFullSchedule();
    expect(again).toHaveLength(1);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("background refresh keeps stale data when the new payload is empty", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(goodSchedule))
      .mockResolvedValueOnce(jsonResponse({ leagueSchedule: { gameDates: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await api.getFullSchedule();

    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3 * 60 * 60 * 1000);
    const stale = await api.getFullSchedule();
    expect(stale).toHaveLength(1);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    nowSpy.mockRestore();

    const after = await api.getFullSchedule();
    expect(after).toHaveLength(1);
  });
});

describe("player index cache poisoning guards", () => {
  it("does not cache an empty player index", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [] }] }))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    expect(await api.getPlayerIndex()).toEqual([]);
    const second = await api.getPlayerIndex();
    expect(second).toHaveLength(1);
    expect(second[0].personId).toBe(1629029);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns [] when rowSet is missing instead of throwing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ headers: ["PERSON_ID"] }] }))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await expect(api.getPlayerIndex()).resolves.toEqual([]);
    const second = await api.getPlayerIndex();
    expect(second).toHaveLength(1);
  });

  it("returns [] on a 200 empty body and refetches next call", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    expect(await api.getPlayerIndex()).toEqual([]);
    expect(await api.getPlayerIndex()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches a normal player index payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getPlayerIndex();
    expect(first[0]).toMatchObject({ personId: 1629029, firstName: "Luka", lastName: "Doncic", teamAbbr: "LAL" });
    await api.getPlayerIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

Notes on the fixtures: `goodPlayerRow` matches the positional indices `fetchPlayerIndex` reads (r[0] personId, r[1] lastName, r[2] firstName, r[3] slug, r[4] teamId, r[7] teamCity, r[8] teamName, r[9] teamAbbr, r[10] jersey ... r[24] ast; indices 5, 6, 19 unused). `vi.resetModules()` + dynamic `import("./api")` per test is REQUIRED because api.ts holds module-level state (`scheduleCache`, `playerIndexCache`, inflight promises). The `Date.now` spy makes the seeded schedule cache look older than the 2h `SCHEDULE_TTL` so `getFullSchedule` takes the background-refresh branch; the stubbed fetch resolves `ok: true` so `fetchWithRetry` performs no retries and no timers hang.

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run src/lib/api-cache-guards.test.ts`. Expected: 4 of 8 tests fail — "does not commit the schedule cache..." (getScheduleAge is non-null, only 1 fetch made), "background refresh keeps stale data..." (final result is `[]`), "does not cache an empty player index" (second call returns `[]` from the truthy-`[]` cache, only 1 fetch), "returns [] when rowSet is missing..." (promise rejects with TypeError). The other 4 pass already (they are regression coverage for behavior that must not change).

- [ ] **Step 3: Guard fetchScheduleBlocking.** In `src/lib/api.ts`, inside `fetchScheduleBlocking`, replace:

```ts
    const data = await res.json();
    const dates = data.leagueSchedule?.gameDates || [];
    scheduleCache = { data: dates, ts: Date.now() };
    return dates;
```

with:

```ts
    const data = await res.json();
    const dates: ScheduleDate[] = data.leagueSchedule?.gameDates || [];
    if (dates.length === 0) {
      console.error("schedule fetch returned no gameDates — keeping previous cache");
      return scheduleCache?.data || [];
    }
    scheduleCache = { data: dates, ts: Date.now() };
    return dates;
```

- [ ] **Step 4: Guard fetchScheduleInBackground.** In the same file, inside `fetchScheduleInBackground`, replace:

```ts
    .then((data) => {
      if (data) {
        const dates = data.leagueSchedule?.gameDates || [];
        scheduleCache = { data: dates, ts: Date.now() };
      }
    })
```

with:

```ts
    .then((data) => {
      const dates: ScheduleDate[] = data?.leagueSchedule?.gameDates || [];
      if (dates.length > 0) {
        scheduleCache = { data: dates, ts: Date.now() };
      }
    })
```

- [ ] **Step 5: Fix the truthy-[] check in getPlayerIndex.** In the same file, inside `getPlayerIndex`, replace:

```ts
  if (playerIndexCache) return playerIndexCache;
```

with:

```ts
  if (playerIndexCache && playerIndexCache.length > 0) return playerIndexCache;
```

- [ ] **Step 6: Guard fetchPlayerIndex.** In the same file, inside `fetchPlayerIndex`, make two replacements. First, replace:

```ts
    const rs = data.resultSets?.[0];
    if (!rs) return [];
```

with:

```ts
    const rs = data.resultSets?.[0];
    if (!rs?.rowSet) return [];
```

Second, replace (near the end of the function, just before the `finally` block):

```ts
    playerIndexCache = players;
    return players;
```

with:

```ts
    if (players.length > 0) playerIndexCache = players;
    return players;
```

- [ ] **Step 7: Run the test — expect PASS.** Run `npx vitest run src/lib/api-cache-guards.test.ts`. All 8 tests pass.

- [ ] **Step 8: Full verification.** Run `npx vitest run` (whole suite green, including any tests added by Task A1) and `npx tsc --noEmit` (0 errors). No manual browser check needed — happy-path behavior is byte-identical; the guards only change what happens on empty/degenerate upstream payloads.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/api.ts src/lib/api-cache-guards.test.ts
git commit -m "fix(api): guard schedule/player-index caches against empty-payload poisoning"
```

---

## A2 — Feed 翻页防护 + 赛末快照 (season-final snapshot + rollover fallbacks)

**Context for the implementer.** The CDN schedule feed `scheduleLeagueV2.json` is a single-season document. When NBA rolls it to 2026-27 (historically mid-August), every consumer that aggregates finished games — `/api/standings` and the follow digest included — goes empty until October. These three tasks (1) freeze the 2025-26 end-of-season data into a bundled JSON while the feed still carries it, (2) make `/api/standings` fall back to that snapshot, (3) make the follow digest fall back to it. **Execute in order: A2a → A2b → A2c** (A2b creates `src/lib/season-snapshot.ts` from the JSON that A2a generates; A2c imports from A2b's module).

Environment facts you can rely on: Node v24 (global `fetch`, top-level `await` in `.mjs`), `tsconfig.json` has `resolveJsonModule: true` and the `@/* → ./src/*` path alias, `vitest.config.ts` resolves the same `@` alias and includes `src/**/*.test.ts`, and `src/data/` already exists (holds `awards.json`) and is not gitignored.

### Task A2a: Season-final snapshot script + generated data file

**Files:**
- Create: `scripts/snapshot-season.mjs`
- Create (generated by running the script): `src/data/season-2025-26-final.json`

- [ ] **Step 1: Write the snapshot script.** Create `scripts/snapshot-season.mjs` with exactly this content (headers mirror `HEADERS` in `src/lib/api.ts`; the regular-season W/L aggregation mirrors `computeStandings` in `src/app/api/standings/route.ts` — status 3 + gameId prefix `"002"`, sorted by win% desc; `finishedGames` keeps ALL finished games including playoffs/play-in/preseason, chronological, with the feed's `"MM/DD/YYYY 00:00:00"` date normalized to `YYYY-MM-DD`):

```js
// One-shot freeze of the 2025-26 season before the CDN schedule doc rolls to
// 2026-27 (historically mid-August). Output feeds /api/standings and the
// follow digest as offseason fallback data. Run: node scripts/snapshot-season.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FEED = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
};
const EXPECTED_SEASON_YEAR = "2025";
const SEASON = "2025-26";

function fail(msg) {
  console.error(`snapshot-season: ${msg}`);
  process.exit(1);
}

function isoDate(gameDate) {
  const [month, day, year] = gameDate.split(" ")[0].split("/");
  return `${year}-${month}-${day}`;
}

const res = await fetch(FEED, { headers: HEADERS });
if (!res.ok) fail(`feed fetch failed: HTTP ${res.status}`);
const data = await res.json();

const league = data.leagueSchedule;
if (!league) fail("feed has no leagueSchedule");
if (league.seasonYear !== EXPECTED_SEASON_YEAR) {
  fail(
    `seasonYear is "${league.seasonYear}", expected "${EXPECTED_SEASON_YEAR}" — the feed already rolled over, this snapshot can no longer be taken`,
  );
}

const teamMap = new Map();
const finishedGames = [];

for (const gd of league.gameDates ?? []) {
  for (const g of gd.games ?? []) {
    if (g.gameStatus !== 3) continue;
    finishedGames.push({
      gameId: g.gameId,
      gameDate: isoDate(gd.gameDate),
      homeTricode: g.homeTeam.teamTricode,
      homeTeamId: g.homeTeam.teamId,
      homeScore: g.homeTeam.score,
      awayTricode: g.awayTeam.teamTricode,
      awayTeamId: g.awayTeam.teamId,
      awayScore: g.awayTeam.score,
    });
    if (!g.gameId.startsWith("002")) continue;
    for (const side of [g.homeTeam, g.awayTeam]) {
      if (!teamMap.has(side.teamTricode)) {
        teamMap.set(side.teamTricode, {
          tricode: side.teamTricode,
          teamId: side.teamId,
          teamName: side.teamName,
          teamCity: side.teamCity,
          wins: 0,
          losses: 0,
        });
      }
    }
    const home = teamMap.get(g.homeTeam.teamTricode);
    const away = teamMap.get(g.awayTeam.teamTricode);
    if (g.homeTeam.score > g.awayTeam.score) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
  }
}

if (finishedGames.length === 0) fail("zero finished games in the feed — nothing to snapshot");

finishedGames.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
const teams = [...teamMap.values()].sort((a, b) => {
  const wa = a.wins / (a.wins + a.losses || 1);
  const wb = b.wins / (b.wins + b.losses || 1);
  return wb - wa;
});

const snapshot = { season: SEASON, generatedAt: new Date().toISOString(), teams, finishedGames };

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "season-2025-26-final.json",
);
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");

const count = (prefix) => finishedGames.filter((g) => g.gameId.startsWith(prefix)).length;
console.log(`wrote ${outPath}`);
console.log(`teams: ${teams.length}`);
console.log(
  `finished games: ${finishedGames.length} (regular ${count("002")}, playoffs ${count("004")}, play-in ${count("005")}, preseason ${count("001")}, all-star ${count("003")})`,
);
console.log(`top of table: ${teams[0].tricode} ${teams[0].wins}-${teams[0].losses}`);
const lastGame = finishedGames[finishedGames.length - 1];
console.log(`last game: ${lastGame.gameId} on ${lastGame.gameDate} (${lastGame.awayTricode} @ ${lastGame.homeTricode})`);
```

- [ ] **Step 2: Run the script and eyeball the summary.** Run:
```
node scripts/snapshot-season.mjs
```
Expect it to exit 0 and print a summary. Eyeball-verify: `teams: 30`; `regular 1230` (30 teams × 82 games ÷ 2 — if slightly under 1230, check whether games were cancelled before proceeding, but do not "fix" the number); `playoffs` is a positive number in the ~80–105 range; the `last game` line shows a June 2026 date with a `004`-prefixed gameId (the Finals). If the script exits non-zero with the seasonYear message, STOP — the feed already rolled over and this whole task is moot; report back instead of proceeding.

- [ ] **Step 3: Spot-check the generated JSON.** Run:
```
node -e "const s=require('./src/data/season-2025-26-final.json');console.log('season',s.season,'teams',s.teams.length,'every-82',s.teams.every(t=>t.wins+t.losses===82),'chrono',s.finishedGames.every((g,i,a)=>i===0||a[i-1].gameDate<=g.gameDate),'date-shape',/^\d{4}-\d{2}-\d{2}$/.test(s.finishedGames[0].gameDate))"
```
Expect: `season 2025-26 teams 30 every-82 true chrono true date-shape true`.

- [ ] **Step 4: Commit.**
```
git add scripts/snapshot-season.mjs src/data/season-2025-26-final.json
git commit -m "chore(data): freeze 2025-26 season-final snapshot + generator script"
```

### Task A2b: /api/standings snapshot fallback + archived badge on its consumers

**Files:**
- Create: `src/lib/season-snapshot.ts`
- Test: `src/lib/season-snapshot.test.ts`
- Modify: `src/app/api/standings/route.ts`
- Modify: `src/components/StandingsMini.tsx`
- Modify: `src/components/stats/TeamStandings.tsx`

Note: `src/app/standings/page.tsx` does NOT consume `/api/standings` — it computes rows directly via `computeStandingsRows(schedule)` and already renders a bilingual `EmptyState` when there are zero rows, so it needs no change in this task. The route's real consumers (found via grep) are `StandingsMini.tsx` (home page tile) and `stats/TeamStandings.tsx` (/stats tab); those two get the archived pill.

- [ ] **Step 1: Write the failing test.** Create `src/lib/season-snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { standingsPayload, type SeasonSnapshot, type SnapshotTeam } from "./season-snapshot";

const SNAPSHOT: SeasonSnapshot = {
  season: "2025-26",
  generatedAt: "2026-07-08T00:00:00.000Z",
  teams: [
    { tricode: "OKC", teamId: 1610612760, teamName: "Thunder", teamCity: "Oklahoma City", wins: 68, losses: 14 },
    { tricode: "BOS", teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", wins: 61, losses: 21 },
  ],
  finishedGames: [],
};

describe("standingsPayload", () => {
  it("passes live standings through with no archive markers", () => {
    const live: SnapshotTeam[] = [
      { tricode: "DEN", teamId: 1610612743, teamName: "Nuggets", teamCity: "Denver", wins: 1, losses: 0 },
    ];
    const payload = standingsPayload(live, SNAPSHOT);
    expect(payload).toEqual({ data: live });
    expect("archived" in payload).toBe(false);
    expect("season" in payload).toBe(false);
  });

  it("serves snapshot teams with archived + season when live is empty", () => {
    const payload = standingsPayload([], SNAPSHOT);
    expect(payload).toEqual({ data: SNAPSHOT.teams, archived: true, season: "2025-26" });
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL** (module does not exist yet):
```
npx vitest run src/lib/season-snapshot.test.ts
```

- [ ] **Step 3: Create the snapshot lib.** Create `src/lib/season-snapshot.ts`:

```ts
// Frozen 2025-26 end-of-season data, generated by scripts/snapshot-season.mjs
// while the single-season CDN schedule doc still carried 2025-26. Served as
// fallback by /api/standings and the follow digest during the offseason
// window after the feed rolls to the new season (zero finished games).
import snapshotJson from "@/data/season-2025-26-final.json";

export interface SnapshotTeam {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
}

export interface SnapshotGame {
  gameId: string;
  /** ET calendar date, YYYY-MM-DD */
  gameDate: string;
  homeTricode: string;
  homeTeamId: number;
  homeScore: number;
  awayTricode: string;
  awayTeamId: number;
  awayScore: number;
}

export interface SeasonSnapshot {
  season: string;
  generatedAt: string;
  /** sorted by win% desc — same order /api/standings emits */
  teams: SnapshotTeam[];
  /** ALL finished games incl. playoffs, chronological */
  finishedGames: SnapshotGame[];
}

export const SEASON_SNAPSHOT: SeasonSnapshot = snapshotJson;

export interface StandingsPayload {
  data: SnapshotTeam[];
  archived?: boolean;
  season?: string;
}

/** Live standings pass through untouched; an empty table (rolled-over feed)
 *  swaps in the archived snapshot, flagged so the UI can label it. */
export function standingsPayload(
  live: SnapshotTeam[],
  snapshot: SeasonSnapshot = SEASON_SNAPSHOT,
): StandingsPayload {
  if (live.length > 0) return { data: live };
  return { data: snapshot.teams, archived: true, season: snapshot.season };
}
```

- [ ] **Step 4: Run the test — expect PASS:**
```
npx vitest run src/lib/season-snapshot.test.ts
```

- [ ] **Step 5: Wire the fallback into the route.** In `src/app/api/standings/route.ts`, make three edits. First the imports — replace:
```ts
import { NextResponse } from "next/server";
import { getFullSchedule } from "@/lib/api";
import { isRegular } from "@/lib/games";
```
with:
```ts
import { NextResponse } from "next/server";
import { getFullSchedule } from "@/lib/api";
import { isRegular } from "@/lib/games";
import { standingsPayload } from "@/lib/season-snapshot";
```
Then the cache-hit response (the fallback must apply here too, otherwise a cached empty result serves `{ data: [] }` for 5 minutes) — replace:
```ts
      return NextResponse.json({ data: standingsCache.data }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
```
with:
```ts
      return NextResponse.json(standingsPayload(standingsCache.data), {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
```
Then the fresh-compute response — replace:
```ts
    standingsCache = { data: teams, ts: Date.now() };
    return NextResponse.json({ data: teams }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
```
with:
```ts
    standingsCache = { data: teams, ts: Date.now() };
    return NextResponse.json(standingsPayload(teams), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
```
(`TeamRecord` in the route is structurally identical to `SnapshotTeam`, so this typechecks as-is. The normal path still serializes to exactly `{ data: [...] }` — no new keys.)

- [ ] **Step 6: Archived pill on StandingsMini (home tile).** In `src/components/StandingsMini.tsx`, replace:
```tsx
export default function StandingsMini() {
  const { t } = useLocale();
  const [east, setEast] = useState<TeamRecord[]>([]);
  const [west, setWest] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
```
with:
```tsx
export default function StandingsMini() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [east, setEast] = useState<TeamRecord[]>([]);
  const [west, setWest] = useState<TeamRecord[]>([]);
  const [archivedSeason, setArchivedSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
```
Then in the fetch handler, replace:
```tsx
      .then((json) => {
        const teams: TeamRecord[] = json.data || [];
```
with:
```tsx
      .then((json) => {
        const teams: TeamRecord[] = json.data || [];
        if (json.archived && json.season) setArchivedSeason(String(json.season));
```
Then in the loaded render, replace:
```tsx
  return (
    <div className="glass-tile p-4 h-full">
      <div className="grid grid-cols-2 gap-4">
        <ConferenceColumn title={t.standingsMini.east} teams={east} />
```
with:
```tsx
  return (
    <div className="glass-tile p-4 h-full">
      {archivedSeason && (
        <p className="mb-2 text-center">
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">
            {archivedSeason} {isZh ? "赛季最终" : "Final"}
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <ConferenceColumn title={t.standingsMini.east} teams={east} />
```

- [ ] **Step 7: Archived pill on TeamStandings (/stats tab).** In `src/components/stats/TeamStandings.tsx`, replace:
```tsx
export default function TeamStandings() {
  const { t } = useLocale();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [conf, setConf] = useState<"all" | "east" | "west">("all");
```
with:
```tsx
export default function TeamStandings() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [archivedSeason, setArchivedSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conf, setConf] = useState<"all" | "east" | "west">("all");
```
Then replace:
```tsx
        const json = await res.json();
        if (!controller.signal.aborted) setTeams(json.data || []);
```
with:
```tsx
        const json = await res.json();
        if (!controller.signal.aborted) {
          setTeams(json.data || []);
          if (json.archived && json.season) setArchivedSeason(String(json.season));
        }
```
Then add the pill beside the conference filter buttons — replace:
```tsx
            </button>
          ))}
        </div>
      </div>
```
with:
```tsx
            </button>
          ))}
        </div>
        {archivedSeason && (
          <span className="self-center text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded-full bg-accent-amber/15 text-accent-amber">
            {archivedSeason} {isZh ? "赛季最终" : "Final"}
          </span>
        )}
      </div>
```

- [ ] **Step 8: Verify.** Run:
```
npx tsc --noEmit
npx vitest run src/lib/season-snapshot.test.ts
```
Expect 0 type errors and green tests. Manual check to do later (dev server): home page standings tile and /stats → standings tab render exactly as before with NO pill (the feed still has finished games today — the pill only appears after the feed rolls over; the fallback branch itself is covered by the unit test).

- [ ] **Step 9: Commit.**
```
git add src/lib/season-snapshot.ts src/lib/season-snapshot.test.ts src/app/api/standings/route.ts src/components/StandingsMini.tsx src/components/stats/TeamStandings.tsx
git commit -m "feat(standings): serve 2025-26 season-final snapshot when the feed has no finished games"
```

### Task A2c: Follow-digest snapshot fallback + "上赛季 / last season" labels

**Files:**
- Modify: `src/lib/follow-digest-types.ts`
- Modify: `src/lib/follow-digest.ts`
- Test: `src/lib/follow-digest.test.ts` (create)
- Modify: `src/app/favorites/FavoritesDashboard.tsx`
- Modify: `src/components/FollowStrip.tsx`

Design notes baked into the code below: `buildTeamDigests` gains a third optional parameter `snapshot` defaulting to `SEASON_SNAPSHOT` (dependency injection for tests; the `/api/follow-digest/route.ts` call site `buildTeamDigests(schedule, teamCodes)` needs NO change). The fallback triggers per team when `!row && !last` — because `computeStandingsRows` pads all 30 teams with 0-0 rows once ANY team has a finished regular-season game, this condition is only true league-wide when the feed has zero finished games (the rollover window), which is exactly the spec's trigger; early-season teams that simply haven't played yet keep today's live 0-0 behavior. `nextGame` always stays on the live feed.

- [ ] **Step 1: Write the failing test.** Create `src/lib/follow-digest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTeamDigests } from "./follow-digest";
import type { ScheduleDate, ScheduleGame } from "./api";
import type { SeasonSnapshot } from "./season-snapshot";

function side(tricode: string, teamId: number, score: number): ScheduleGame["homeTeam"] {
  return {
    teamId,
    teamTricode: tricode,
    teamName: tricode,
    teamCity: tricode,
    teamSlug: tricode.toLowerCase(),
    score,
    wins: 0,
    losses: 0,
    seed: 0,
  };
}

function game(o: {
  gameId: string;
  status: number;
  utc: string;
  home: [string, number, number];
  away: [string, number, number];
}): ScheduleGame {
  return {
    gameId: o.gameId,
    gameStatus: o.status,
    gameStatusText: o.status === 3 ? "Final" : o.status === 2 ? "Q1" : "7:00 pm ET",
    gameCode: "",
    gameDateTimeUTC: o.utc,
    homeTeam: side(o.home[0], o.home[1], o.home[2]),
    awayTeam: side(o.away[0], o.away[1], o.away[2]),
  };
}

const SNAPSHOT: SeasonSnapshot = {
  season: "2025-26",
  generatedAt: "2026-07-01T00:00:00.000Z",
  teams: [
    { tricode: "BOS", teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", wins: 61, losses: 21 },
    { tricode: "LAL", teamId: 1610612747, teamName: "Lakers", teamCity: "Los Angeles", wins: 50, losses: 32 },
  ],
  finishedGames: [
    { gameId: "0022500001", gameDate: "2025-10-21", homeTricode: "BOS", homeTeamId: 1610612738, homeScore: 120, awayTricode: "NYK", awayTeamId: 1610612752, awayScore: 110 },
    { gameId: "0042500401", gameDate: "2026-06-10", homeTricode: "LAL", homeTeamId: 1610612747, homeScore: 98, awayTricode: "BOS", awayTeamId: 1610612738, awayScore: 104 },
  ],
};

// A rolled-over feed: next season's scheduled games only, zero finished.
const flippedFeed: ScheduleDate[] = [
  {
    gameDate: "10/20/2026 00:00:00",
    games: [
      game({ gameId: "0022600001", status: 1, utc: "2026-10-21T00:00:00Z", home: ["BOS", 1610612738, 0], away: ["NYK", 1610612752, 0] }),
    ],
  },
];

describe("buildTeamDigests snapshot fallback", () => {
  it("falls back to snapshot record + last game when the feed has zero finished games", () => {
    const [bos] = buildTeamDigests(flippedFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBe(true);
    expect(bos.wins).toBe(61);
    expect(bos.losses).toBe(21);
    expect(bos.lastGame).toEqual({
      gameId: "0042500401",
      status: 3,
      dateUTC: "2026-06-10T12:00:00Z",
      home: false,
      opponentTricode: "LAL",
      opponentName: "Lakers",
      opponentTeamId: 1610612747,
      teamScore: 104,
      oppScore: 98,
      win: true,
    });
  });

  it("keeps nextGame on the live feed while archived", () => {
    const [bos] = buildTeamDigests(flippedFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBe(true);
    expect(bos.nextGame?.gameId).toBe("0022600001");
    expect(bos.nextGame?.opponentTricode).toBe("NYK");
  });

  it("stays live with no archived flag once the feed has finished games", () => {
    const liveFeed: ScheduleDate[] = [
      {
        gameDate: "10/20/2026 00:00:00",
        games: [
          game({ gameId: "0022600001", status: 3, utc: "2026-10-21T00:00:00Z", home: ["BOS", 1610612738, 112], away: ["NYK", 1610612752, 105] }),
        ],
      },
    ];
    const [bos] = buildTeamDigests(liveFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBeUndefined();
    expect(bos.wins).toBe(1);
    expect(bos.losses).toBe(0);
    expect(bos.lastGame?.gameId).toBe("0022600001");
  });

  it("degrades to 0-0 without archived when the team is missing from the snapshot", () => {
    const [orl] = buildTeamDigests([], ["ORL"], SNAPSHOT);
    expect(orl.archived).toBeUndefined();
    expect(orl.wins).toBe(0);
    expect(orl.losses).toBe(0);
    expect(orl.lastGame).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL** (current `buildTeamDigests` ignores the third argument, so `wins` comes back 0 and `archived` is never set):
```
npx vitest run src/lib/follow-digest.test.ts
```

- [ ] **Step 3: Extend the TeamDigest type.** In `src/lib/follow-digest-types.ts`, replace:
```ts
  /** e.g. "W3" / "L2" / "" */
  streak: string;
  lastGame: DigestGame | null;
  nextGame: DigestGame | null;
}
```
with:
```ts
  /** e.g. "W3" / "L2" / "" */
  streak: string;
  lastGame: DigestGame | null;
  nextGame: DigestGame | null;
  /** record/lastGame come from the archived season-final snapshot (the feed
   *  rolled to a new season with zero finished games) — UI labels these
   *  "上赛季 / last season" so they aren't read as current-season data */
  archived?: boolean;
}
```

- [ ] **Step 4: Add the snapshot fallback to the digest builder.** In `src/lib/follow-digest.ts`, first extend the imports — replace:
```ts
import { isCountedSeason } from "@/lib/games";
import { minutesFromIso } from "@/lib/game-stats";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";
```
with:
```ts
import { isCountedSeason } from "@/lib/games";
import { minutesFromIso } from "@/lib/game-stats";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";
import { SEASON_SNAPSHOT, type SeasonSnapshot, type SnapshotGame } from "@/lib/season-snapshot";
```
Then replace the entire `buildTeamDigests` function (from its doc comment `/**\n * Build a TeamDigest for each followed tricode from the cached schedule.` through its closing `return digests;\n}`) with:
```ts
/**
 * Most recent archived game involving the team, mapped into the DigestGame
 * shape. Snapshot finishedGames are chronological, so scan from the end.
 */
function snapshotLastGame(games: SnapshotGame[], tricode: string): DigestGame | null {
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (!isCountedSeason(g.gameId)) continue;
    const isHome = g.homeTricode === tricode;
    if (!isHome && g.awayTricode !== tricode) continue;
    const oppTricode = isHome ? g.awayTricode : g.homeTricode;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    return {
      gameId: g.gameId,
      status: 3,
      // Noon UTC keeps the snapshot's ET calendar date intact when clients
      // render it in any timezone from UTC-11 to UTC+11 (dates, not tip times).
      dateUTC: `${g.gameDate}T12:00:00Z`,
      home: isHome,
      opponentTricode: oppTricode,
      opponentName: TEAM_META[oppTricode]?.name ?? oppTricode,
      opponentTeamId: isHome ? g.awayTeamId : g.homeTeamId,
      teamScore,
      oppScore,
      win: teamScore > oppScore,
    };
  }
  return null;
}

/**
 * Build a TeamDigest for each followed tricode from the cached schedule.
 * record/streak/rank come from computeStandingsRows so they match /standings;
 * lastGame is the most recent finished/live game, nextGame the soonest upcoming
 * (null in the offseason). Unknown tricodes are skipped. When the feed has zero
 * finished/live games for the team (offseason rollover: the CDN doc only holds
 * the new season), record + lastGame fall back to the season-final snapshot and
 * the digest is marked archived; nextGame stays live — a rolled feed
 * legitimately carries next season's scheduled games.
 */
export function buildTeamDigests(
  schedule: ScheduleDate[],
  tricodes: string[],
  snapshot: SeasonSnapshot | null = SEASON_SNAPSHOT,
): TeamDigest[] {
  const rows = computeStandingsRows(schedule);
  const byTricode = new Map(rows.map((r) => [r.tricode, r]));
  const ranks = conferenceRanks(rows);

  const digests: TeamDigest[] = [];
  const seen = new Set<string>();
  for (const raw of tricodes) {
    const tricode = raw.trim().toUpperCase();
    const meta = TEAM_META[tricode];
    if (!meta || seen.has(tricode)) continue; // unknown or duplicate
    seen.add(tricode);

    const row = byTricode.get(tricode);
    const { last, next } = findTeamGames(schedule, tricode);
    const snapTeam =
      !row && !last && snapshot
        ? (snapshot.teams.find((t) => t.tricode === tricode) ?? null)
        : null;

    const digest: TeamDigest = {
      tricode,
      teamId: meta.teamId,
      city: meta.city,
      name: meta.name,
      primaryColor: meta.primaryColor,
      conference: meta.conference,
      wins: row?.wins ?? snapTeam?.wins ?? 0,
      losses: row?.losses ?? snapTeam?.losses ?? 0,
      conferenceRank: ranks.get(tricode) ?? null,
      streak: row?.streak ?? "",
      lastGame: last ?? (snapTeam && snapshot ? snapshotLastGame(snapshot.finishedGames, tricode) : null),
      nextGame: next,
    };
    if (snapTeam) digest.archived = true;
    digests.push(digest);
  }
  return digests;
}
```
(For reference, the old function being replaced starts with `export function buildTeamDigests(schedule: ScheduleDate[], tricodes: string[]): TeamDigest[] {` and its old doc comment ends with `Unknown tricodes are skipped.\n */` — everything between that comment's opening and the function's closing brace goes away in favor of the block above. Do not touch `teamNextGame` or anything after it.)

- [ ] **Step 5: Run the test — expect PASS:**
```
npx vitest run src/lib/follow-digest.test.ts
```

- [ ] **Step 6: "last season" label in FavoritesDashboard.** In `src/app/favorites/FavoritesDashboard.tsx` (inside `TeamCard`), replace:
```tsx
            <span className="font-mono tabular-nums text-sm">
              <span className="text-success font-semibold">{team.wins}</span>
              <span className="text-text-secondary/40 mx-0.5">–</span>
              <span className="text-danger font-semibold">{team.losses}</span>
            </span>
            {team.conferenceRank != null && (
```
with:
```tsx
            <span className="font-mono tabular-nums text-sm">
              <span className="text-success font-semibold">{team.wins}</span>
              <span className="text-text-secondary/40 mx-0.5">–</span>
              <span className="text-danger font-semibold">{team.losses}</span>
            </span>
            {team.archived && (
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">
                {isZh ? "上赛季" : "Last season"}
              </span>
            )}
            {team.conferenceRank != null && (
```

- [ ] **Step 7: "last season" label in FollowStrip.** In `src/components/FollowStrip.tsx` (inside `TeamCard`), replace:
```tsx
          <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-text-secondary/80">
            <span>{record}</span>
            {team.conferenceRank !== null && (
```
with:
```tsx
          <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-text-secondary/80">
            <span>{record}</span>
            {team.archived && (
              <>
                <span className="text-text-secondary/40">·</span>
                <span className="text-accent-amber uppercase">{isZh ? "上赛季" : "last season"}</span>
              </>
            )}
            {team.conferenceRank !== null && (
```

- [ ] **Step 8: Verify.** Run:
```
npx tsc --noEmit
npx vitest run
```
Expect 0 type errors and the full suite green (shot-zones, game-stats, season-snapshot, follow-digest). Manual check to do later (dev server): home Following strip and /favorites render exactly as before with NO "上赛季" label — the feed still carries 2025-26 finished games today, so the archived branch is unreachable live and is covered by the unit tests instead.

- [ ] **Step 9: Commit.**
```
git add src/lib/follow-digest.ts src/lib/follow-digest.test.ts src/lib/follow-digest-types.ts src/app/favorites/FavoritesDashboard.tsx src/components/FollowStrip.tsx
git commit -m "feat(follow): archived-season fallback for team digests when the feed rolls over"
```

---

### Task B4: /injuries 球队匹配 — extract shared `findTeamByDisplayName`, fix Orlando→LAC bug

**Files:**
- Test: `src/lib/teams.test.ts` (create)
- Modify: `src/lib/teams.ts`
- Modify: `src/app/injuries/page.tsx`
- Modify: `src/app/favorites/FavoritesDashboard.tsx`

Context: `src/app/injuries/page.tsx` has a buggy `findTeamMeta` that matches by naive `city` substring — `"Orlando".toLowerCase().includes("la")` hits LAC (city `"LA"`), so Magic injuries render under the Clippers logo. `src/app/favorites/FavoritesDashboard.tsx` already carries the fixed logic (`tricodeForInjuryTeam`, commit c99d4b1): nickname-first match, city fallback only when `city.length > 3`. This task lifts the fixed logic into `src/lib/teams.ts` as the shared contract function `findTeamByDisplayName` (returns `TeamMeta | null` — NOT a tricode string) and points both consumers at it.

- [ ] **Step 1: Write the failing test.** Create `src/lib/teams.test.ts` with exactly:

```ts
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
```

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run src/lib/teams.test.ts`. It must fail (the named export `findTeamByDisplayName` does not exist in `src/lib/teams.ts` yet). Do not proceed until you have seen it fail.

- [ ] **Step 3: Implement `findTeamByDisplayName` in `src/lib/teams.ts`.** The file currently ends with the closing `};` of the `TEAM_META` record (last entry is `WAS: { teamId: 1610612764, ... }`). Append after that closing `};`:

```ts
// Nickname first: NBA nicknames are unique league-wide. City is only a
// fallback, and never the 2-char "LA" — "Or-la-ndo" must not match the Clippers.
export function findTeamByDisplayName(displayName: string): TeamMeta | null {
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  for (const meta of Object.values(TEAM_META)) {
    if (lower.includes(meta.name.toLowerCase())) return meta;
  }
  for (const meta of Object.values(TEAM_META)) {
    if (meta.city.length > 3 && lower.includes(meta.city.toLowerCase())) return meta;
  }
  return null;
}
```

Note this is a SHARED CONTRACT (other task groups import this exact name/signature) — do not rename, do not change the return type to a tricode string.

- [ ] **Step 4: Run the test — expect PASS.** Run `npx vitest run src/lib/teams.test.ts`. All 8 tests must pass.

- [ ] **Step 5: Refactor `src/app/injuries/page.tsx` to use the shared function.** Two edits:

(a) Replace the import line:
```ts
import { TEAM_META } from "@/lib/teams";
```
with:
```ts
import { findTeamByDisplayName } from "@/lib/teams";
```
(`TEAM_META` is used nowhere else in this file — only inside the function deleted next.)

(b) Delete the entire local `findTeamMeta` function (it sits between the `getInjuries` function and `getStatusColor`):
```ts
function findTeamMeta(displayName: string) {
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  for (const meta of Object.values(TEAM_META)) {
    if (lower.includes(meta.name.toLowerCase()) || lower.includes(meta.city.toLowerCase())) {
      return meta;
    }
  }
  return null;
}
```

(c) In the JSX (inside the `teams.map` team-header block), replace the call site:
```ts
                    const meta = findTeamMeta(team.displayName || "");
```
with:
```ts
                    const meta = findTeamByDisplayName(team.displayName || "");
```

- [ ] **Step 6: Refactor `src/app/favorites/FavoritesDashboard.tsx` to drop its local copy.** Three edits:

(a) Replace the import line:
```ts
import { TEAM_META } from "@/lib/teams";
```
with:
```ts
import { TEAM_META, findTeamByDisplayName } from "@/lib/teams";
```
(Keep `TEAM_META` — it is still used further down for the per-team news fetch: `const meta = TEAM_META[tri];`.)

(b) Delete the local function AND its 4-line leading comment block (sits between the `NewsItem` interface and `injurySeverity`):
```ts
// Match an ESPN injuries-team displayName ("Boston Celtics") to a tricode by
// the NBA nickname first — nicknames are unique league-wide, so this avoids the
// bare 2-char "LA" city substring matching "Orlando" (or-LA-ndo). City is only a
// fallback for displayNames missing the nickname, and never the 2-char "LA".
function tricodeForInjuryTeam(displayName: string | undefined): string | null {
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  // Nickname match (unique: Clippers / Lakers / Magic are all distinct).
  for (const meta of Object.values(TEAM_META)) {
    if (lower.includes(meta.name.toLowerCase())) return meta.tricode;
  }
  // City fallback only when the city token is unambiguous (excludes "LA").
  for (const meta of Object.values(TEAM_META)) {
    if (meta.city.length > 3 && lower.includes(meta.city.toLowerCase())) return meta.tricode;
  }
  return null;
}
```

(c) In the injuries side-fetch effect (inside `for (const team of json.data ?? [])`), replace the call site:
```ts
          const tri = tricodeForInjuryTeam(team.displayName);
```
with:
```ts
          const tri = findTeamByDisplayName(team.displayName ?? "")?.tricode;
```
(The following line `if (tri && followed.has(tri) && team.injuries?.length)` already narrows `string | undefined` — no other change needed.)

- [ ] **Step 7: Verify types and full test file.** Run `npx tsc --noEmit` (expect 0 errors) and `npx vitest run src/lib/teams.test.ts` (expect all green). Manual check to do later during batch verification: open `/injuries` in the dev server and confirm the Orlando Magic section shows the Magic logo (blue "ORL" logo, teamId 1610612753), not the Clippers logo; `/favorites` injury chips still bucket to the right followed teams.

- [ ] **Step 8: Commit.**
```bash
git add src/lib/teams.ts src/lib/teams.test.ts src/app/injuries/page.tsx src/app/favorites/FavoritesDashboard.tsx
git commit -m "fix(injuries): shared nickname-first team matcher — magic no longer filed under LAC"
```

---

### Task B5: /history 冠军 TBD — fill 2025 + 2026 Finals rows

**Files:**
- Modify: `src/app/history/page.tsx`

**DEPENDS ON: Task A2a** — `src/data/season-2025-26-final.json` must already exist (contract #3 shape: `finishedGames` entries carry `gameId`, `gameDate`, `homeTricode`, `homeScore`, `awayTricode`, `awayScore`; `teams` entries carry `tricode`, `teamCity`, `teamName`). Do not start this task before A2a is committed.

Context: the `champions` array at the top of `src/app/history/page.tsx` is a static curated table; its 2026 and 2025 rows are all-`"TBD"`. The 2025 row (2024-25 season) is known and hardcoded below. The 2026 row (2025-26 season) CANNOT be written into this plan ahead of time — you must derive champion/runner-up/series from the season snapshot at implementation time (verify-then-hardcode; runtime derivation is overkill for one static row). The 2026 FMVP has no data source anywhere in the project — it stays as the em-dash string `"—"` for the user to fill manually.

- [ ] **Step 1: Derive the 2026 Finals result from the snapshot.** NBA gameId convention: 10 digits, `004` prefix = playoffs, and the digit at index 7 is the playoff round (`4` = Finals). Run from the project root:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && node -e "
const s = require('./src/data/season-2025-26-final.json');
const finals = s.finishedGames.filter(g => g.gameId.startsWith('004') && g.gameId.charAt(7) === '4');
if (finals.length === 0) { console.log('NO FINALS GAMES IN SNAPSHOT'); process.exit(0); }
const wins = {};
for (const g of finals) {
  const w = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
  wins[w] = (wins[w] || 0) + 1;
}
const [champTri, champWins] = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
const loserTri = [...new Set(finals.flatMap(g => [g.homeTricode, g.awayTricode]))].find(t => t !== champTri);
const full = tri => { const t = s.teams.find(x => x.tricode === tri); return t ? t.teamCity + ' ' + t.teamName : tri; };
console.log('finals games:', finals.map(g => g.gameDate + ' ' + g.awayTricode + ' ' + g.awayScore + ' @ ' + g.homeTricode + ' ' + g.homeScore).join(' | '));
console.log('champion:', full(champTri));
console.log('runnerUp:', full(loserTri));
console.log('series: 4-' + (wins[loserTri] || 0));
if (champWins !== 4) console.log('WARNING: winner has ' + champWins + ' wins, expected 4 — snapshot may be incomplete');
"
```

Sanity-check the output before using it: 4-7 finals games; the champion has exactly 4 wins; the last finals game's date is the latest date among all `004` games. Record the three values: champion full name, runner-up full name, series string (`4-0` … `4-3`).

If the script prints `NO FINALS GAMES IN SNAPSHOT` or the 4-wins check fails: STOP, leave the 2026 row as `"TBD"`, still fill the 2025 row (step 2's second line only), and flag the problem in your completion notes — do not guess Finals results.

- [ ] **Step 2: Fill both rows in `src/app/history/page.tsx`.** Replace the first two entries of the `champions` array. Current code:

```ts
const champions = [
  { year: 2026, champion: "TBD", fmvp: "TBD", runnerUp: "TBD", series: "TBD" },
  { year: 2025, champion: "TBD", fmvp: "TBD", runnerUp: "TBD", series: "TBD" },
```

New code — the three `<...>` tokens are the ONLY permitted placeholders in this plan (the task's values are unknowable at plan-writing time); substitute them with step 1's verified output before saving:

```ts
const champions = [
  { year: 2026, champion: "<CHAMPION FULL NAME>", fmvp: "—", runnerUp: "<RUNNER-UP FULL NAME>", series: "<SERIES e.g. 4-2>" },
  { year: 2025, champion: "Oklahoma City Thunder", fmvp: "Shai Gilgeous-Alexander", runnerUp: "Indiana Pacers", series: "4-3" },
```

The 2025 row is fixed known data (2024-25 season: Thunder beat Pacers 4-3, FMVP Shai Gilgeous-Alexander) — write it exactly as shown. The `"—"` FMVP renders as-is in the table and is safe against the page's aggregation logic: `fmvpCounts` counts it once, and both the multi-FMVP chips and the `(Nx)` row badge require a count `>= 2`, so a single `"—"` never surfaces there. It is a deliberate placeholder for the user to fill by hand — FMVP has no automated data source.

- [ ] **Step 3: Verify.** Run `npx tsc --noEmit` — expect 0 errors. Manual check to do later during batch verification: open `/history` in the dev server and confirm (a) the 2026 and 2025 rows are no longer dimmed (the `opacity-50` style is keyed to `champion === "TBD"`), (b) the Game-7 quick-fact count increased by at least one (2025's `4-3`), (c) OKC (and the 2026 champion) appear in the "Championships by Franchise" bars, (d) the FMVP cell for 2026 shows a bare `—`.

- [ ] **Step 4: Commit.**
```bash
git add src/app/history/page.tsx
git commit -m "fix(history): fill 2025 + 2026 finals rows from snapshot, drop TBD placeholders"
```

---

## C6 — 球员页 4 秒白等 + 重复请求 (stats proxy consolidation, playergamelog removal, client dedup)

Task order is strict: **C6a → C6b → C6c → C6d**. C6b imports the module created in C6a; C6c edits the file state produced by C6b; C6d relies on C6c's response shape.

Background (why): stats.nba.com blackholes several endpoints from Vercel IPs — requests hang until aborted. `/api/stats` and `/api/matchups` each carry a private copy of a "blackhole breaker" that fails fast for 15 min after a timeout; `/api/player` and `/api/player-shots` have no breaker at all (player-shots' historical path has no timeout at all). `/api/player` also still queries `playergamelog`, which never succeeds in prod, adding a fixed 4 s stall. And the player page fires the same `/api/player` request twice (PlayerStatsBundle + PlayerAdvancedStats).

### Task C6a: Extract shared stats.nba.com proxy (`statsProxy.ts`) with blackhole breaker

**Files:**
- Create: `src/lib/statsProxy.ts`
- Test: `src/lib/statsProxy.test.ts`

- [ ] **Step 1: Read the reference implementation.** Read `src/app/api/stats/route.ts` in full — lines 3–14 (base URL + 9-header browser-spoof block) and lines 48–117 (breaker registry + fetch/probe/arm logic) are what you are extracting. Do not modify it in this task.

- [ ] **Step 2: Write the failing test.** Create `src/lib/statsProxy.test.ts` with exactly this content. Note the technique: `AbortSignal.timeout` is not affected by vitest fake timers, so we spy on it and assert the millisecond argument it was called with; fake timers exist only to control `Date.now()` for the 15-min TTL; `vi.resetModules()` gives each test a fresh module-level breaker Map.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

async function freshFetchStats() {
  vi.resetModules();
  const mod = await import("./statsProxy");
  return mod.fetchStats;
}

const URL_A = "https://stats.nba.com/stats/playerawards?PlayerID=2544";
const ok = () => new Response("{}", { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const timeoutArgs = () => vi.mocked(AbortSignal.timeout).mock.calls.map((c) => c[0]);

describe("fetchStats", () => {
  it("returns the upstream response on success without arming the breaker", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockResolvedValue(ok());
    const res = await fetchStats(URL_A, { key: "playerawards" });
    expect(res?.ok).toBe(true);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 8000]);
  });

  it("uses the caller's timeoutMs when the breaker is closed", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockResolvedValue(ok());
    await fetchStats(URL_A, { key: "shotchartdetail", timeoutMs: 20000 });
    expect(timeoutArgs()).toEqual([20000]);
  });

  it("arms the breaker on failure: next call within the TTL probes at 1500ms", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValue(new Error("aborted"));
    expect(await fetchStats(URL_A, { key: "playerawards" })).toBeNull();
    expect(await fetchStats(URL_A, { key: "playerawards", timeoutMs: 6000 })).toBeNull();
    expect(timeoutArgs()).toEqual([8000, 1500]);
  });

  it("a successful open-breaker probe clears the breaker", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock
      .mockRejectedValueOnce(new Error("aborted"))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok());
    await fetchStats(URL_A, { key: "playerawards" });
    const probe = await fetchStats(URL_A, { key: "playerawards" });
    expect(probe?.ok).toBe(true);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 1500, 8000]);
  });

  it("a failed open-breaker probe does NOT extend the deadline", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValue(new Error("aborted"));
    await fetchStats(URL_A, { key: "playerawards" });
    vi.setSystemTime(14 * 60 * 1000);
    await fetchStats(URL_A, { key: "playerawards" });
    vi.setSystemTime(15 * 60 * 1000 + 1);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 1500, 8000]);
  });

  it("breaker state is tracked per key", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValueOnce(new Error("aborted")).mockResolvedValueOnce(ok());
    await fetchStats(URL_A, { key: "playerawards" });
    await fetchStats(URL_A, { key: "leaguedashteamstats" });
    expect(timeoutArgs()).toEqual([8000, 8000]);
  });
});
```

  The "does NOT extend" test works because: the failure at t=0 arms the breaker until t=900000 ms; the probe at t=840000 must not move that deadline, so at t=900001 the breaker is closed again and the full 8000 ms timeout is used. If the probe HAD extended the deadline, the third call would probe at 1500 and the assertion would fail.

- [ ] **Step 3: Run the test — expect FAIL** (module does not exist yet): `npx vitest run src/lib/statsProxy.test.ts`

- [ ] **Step 4: Create `src/lib/statsProxy.ts`** with exactly this content (headers block and breaker comments ported verbatim from `src/app/api/stats/route.ts`):

```ts
export const STATS_BASE = "https://stats.nba.com/stats";

export const STATS_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

// stats.nba.com blackholes some endpoints for datacenter IPs (the request
// hangs until our abort). After a timeout, fail fast for 15 min instead of
// burning a full-timeout serverless invocation per visitor. Per warm
// instance — good enough.
const BLACKHOLED_UNTIL = new Map<string, number>();
const BLACKHOLE_TTL_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 1500;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_REVALIDATE = 300;

export async function fetchStats(
  url: string,
  opts: { key: string; timeoutMs?: number; revalidate?: number },
): Promise<Response | null> {
  const { key, timeoutMs = DEFAULT_TIMEOUT_MS, revalidate = DEFAULT_REVALIDATE } = opts;

  // When the breaker is open we still attempt the fetch, but with a short
  // timeout: Next's data-cache hits return in milliseconds and succeed, while
  // upstream misses fail fast instead of being denied cheap cached responses.
  const blockedUntil = BLACKHOLED_UNTIL.get(key);
  const breakerOpen = !!blockedUntil && Date.now() < blockedUntil;
  const fetchTimeout = breakerOpen ? PROBE_TIMEOUT_MS : timeoutMs;

  try {
    const res = await fetch(url, {
      headers: STATS_HEADERS,
      next: { revalidate },
      signal: AbortSignal.timeout(fetchTimeout),
    });
    BLACKHOLED_UNTIL.delete(key);
    return res;
  } catch {
    // Only a full-timeout failure arms/extends the breaker — the short probe
    // must leave the existing deadline so the breaker still half-opens on time.
    if (!breakerOpen) BLACKHOLED_UNTIL.set(key, Date.now() + BLACKHOLE_TTL_MS);
    return null;
  }
}
```

  Intentional behavior nuance (do not "fix" it): the key is deleted on ANY resolved response, including non-ok — the breaker only guards against hangs, and any resolved response proves the endpoint answers.

- [ ] **Step 5: Run the test — expect PASS** (6 tests): `npx vitest run src/lib/statsProxy.test.ts`

- [ ] **Step 6: Type-check:** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 7: Commit:**
```
git add src/lib/statsProxy.ts src/lib/statsProxy.test.ts
git commit -m "refactor(api): extract shared stats.nba.com proxy + blackhole breaker to statsProxy"
```

### Task C6b: Migrate all four stats.nba.com proxy routes to `statsProxy`

**Files:**
- Modify: `src/app/api/stats/route.ts`
- Modify: `src/app/api/matchups/route.ts`
- Modify: `src/app/api/player/route.ts`
- Modify: `src/app/api/player-shots/route.ts`

This task is a pure refactor: all four routes keep their response shapes, status codes, cache headers, whitelist, per-endpoint timeout/revalidate values, and limit-slimming EXACTLY. New behavior gained for free: `/api/player` and `/api/player-shots` join the shared breaker (they had none), and `/api/player-shots`' historical path gains a timeout (it previously hung until the lambda was killed). Breaker state is now shared across routes per key — e.g. `"playergamelog"` armed by `/api/player` also fast-fails `/api/player-shots`' historical path; that is desired (same upstream blackhole).

- [ ] **Step 1: Read all four route files** (`src/app/api/stats/route.ts`, `src/app/api/matchups/route.ts`, `src/app/api/player/route.ts`, `src/app/api/player-shots/route.ts`) so subsequent Write/Edit calls succeed.

- [ ] **Step 2: Rewrite `src/app/api/stats/route.ts`** (Write, full replacement — the local header block, `STATS_BASE`, breaker registry, and try/catch move into the lib):

```ts
import { NextRequest, NextResponse } from "next/server";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Proxy for stats.nba.com — avoids CORS issues, adds timeout + security
const ALLOWED_ENDPOINTS = new Set([
  "leagueleaders", "playercareerstats", "playergamelog",
  "draftcombineplayeranthro", "commonplayerinfo",
  "shotchartdetail", "leaguedashteamstats", "playerawards",
]);

// Vercel kills functions at 10s by default — these upstreams are slower cold
export const maxDuration = 30;

// shotchartdetail is a genuinely large payload that's reachable but slow.
// playerawards/leaguedashteamstats are blackholed from Vercel IPs and never
// succeed in prod — keep their timeout short so the client fetch fails fast and
// the UI's fallback (static honor wall / schedule-only team boards) appears
// quickly instead of after a 20s hang.
const TIMEOUT_MS: Record<string, number> = {
  shotchartdetail: 20000,
  playerawards: 6000,
  leaguedashteamstats: 6000,
};
const DEFAULT_TIMEOUT = 8000;

// Draft combine anthro data for a past draft year never changes — long TTL
const REVALIDATE: Record<string, number> = {
  draftcombineplayeranthro: 86400,
  // league-wide team averages move slowly — hourly is plenty
  leaguedashteamstats: 3600,
  // career awards change at most a few times per year — daily is plenty
  playerawards: 86400,
};
const DEFAULT_REVALIDATE = 300;

function respond(data: unknown, limit: number, revalidate: number) {
  if (Number.isInteger(limit) && limit > 0) {
    const d = data as { resultSet?: { rowSet?: unknown[][] }; resultSets?: { rowSet?: unknown[][] }[] };
    const rs = d.resultSet ?? d.resultSets?.[0];
    if (rs?.rowSet) rs.rowSet = rs.rowSet.slice(0, limit);
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}` },
  });
}

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  // Whitelist endpoints to prevent open proxy abuse
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: "endpoint not allowed" }, { status: 403 });
  }

  // "limit" is ours, not stats.nba.com's — keep it out of the upstream URL
  // so it doesn't fragment the data-cache key per limit value.
  const limit = Number(request.nextUrl.searchParams.get("limit"));

  // Build query string from remaining params
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "endpoint" && k !== "limit") params.set(k, v);
  });

  const url = `${STATS_BASE}/${endpoint}?${params.toString()}`;
  const revalidate = REVALIDATE[endpoint] ?? DEFAULT_REVALIDATE;

  const res = await fetchStats(url, {
    key: endpoint,
    timeoutMs: TIMEOUT_MS[endpoint] || DEFAULT_TIMEOUT,
    revalidate,
  });
  if (!res) {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `NBA API returned ${res.status}` },
      { status: res.status }
    );
  }
  try {
    return respond(await res.json(), limit, revalidate);
  } catch {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
```

- [ ] **Step 3: Migrate `src/app/api/matchups/route.ts`** with three Edits. `MatchupDefenderRow`/`MatchupsPayload` exports, `num`, `parseMatchups`, and `respondWith` are UNCHANGED (they are imported by `src/app/game/[id]/_components/MatchupSection.tsx` — do not remove the exports).

  Edit 1 — replace:
```ts
import { NextRequest, NextResponse } from "next/server";

// Dedicated proxy for stats.nba.com boxscorematchupsv3 (who-guarded-whom
// tracking data on finished games). Kept separate from /api/stats because the
// response is a nested v3 document (not headers/rowSet), so it gets parsed and
// slimmed server-side instead of being passed through raw (~10x smaller).
const UPSTREAM = "https://stats.nba.com/stats/boxscorematchupsv3";
const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};
```
  with:
```ts
import { NextRequest, NextResponse } from "next/server";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Dedicated proxy for stats.nba.com boxscorematchupsv3 (who-guarded-whom
// tracking data on finished games). Kept separate from /api/stats because the
// response is a nested v3 document (not headers/rowSet), so it gets parsed and
// slimmed server-side instead of being passed through raw (~10x smaller).
const UPSTREAM = `${STATS_BASE}/boxscorematchupsv3`;
```

  Edit 2 — replace:
```ts
const UPSTREAM_REVALIDATE = 900;

// stats.nba.com blackholes this endpoint for some datacenter IPs (hangs until
// our abort). After a timeout, fail fast for 15 min per warm instance instead
// of burning a 20s invocation per visitor.
let blackholedUntil = 0;
const BLACKHOLE_TTL_MS = 15 * 60 * 1000;
```
  with:
```ts
const UPSTREAM_REVALIDATE = 900;
```

  Edit 3 — replace the GET body from the breaker comment to the end of the function:
```ts
  // When the breaker is open we still attempt the fetch, but with a short
  // timeout: Next's data-cache hits return in milliseconds and succeed, while
  // upstream misses fail fast instead of being denied cheap cached responses.
  const breakerOpen = Date.now() < blackholedUntil;
  const fetchTimeout = breakerOpen ? 1500 : TIMEOUT_MS;

  try {
    const res = await fetch(`${UPSTREAM}?GameID=${gameId}`, {
      headers: HEADERS,
      next: { revalidate: UPSTREAM_REVALIDATE },
      signal: AbortSignal.timeout(fetchTimeout),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `NBA API returned ${res.status}` }, { status: res.status });
    }
    blackholedUntil = 0;
    const players = parseMatchups(await res.json());
    if (!players) {
      return NextResponse.json({ error: "unexpected upstream shape" }, { status: 502 });
    }
    return respondWith(gameId, players);
  } catch {
    // Only a full-timeout failure arms the breaker — the short probe must
    // leave the existing deadline so the breaker still half-opens on time.
    if (!breakerOpen) blackholedUntil = Date.now() + BLACKHOLE_TTL_MS;
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
```
  with:
```ts
  const res = await fetchStats(`${UPSTREAM}?GameID=${gameId}`, {
    key: "boxscorematchupsv3",
    timeoutMs: TIMEOUT_MS,
    revalidate: UPSTREAM_REVALIDATE,
  });
  if (!res) {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `NBA API returned ${res.status}` }, { status: res.status });
  }
  let players: Record<string, MatchupDefenderRow[]> | null;
  try {
    players = parseMatchups(await res.json());
  } catch {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
  if (!players) {
    return NextResponse.json({ error: "unexpected upstream shape" }, { status: 502 });
  }
  return respondWith(gameId, players);
}
```

- [ ] **Step 4: Rewrite `src/app/api/player/route.ts`** (Write, full replacement). Behavior-preserving: both upstream calls remain (playergamelog is deleted in C6c, not here), same 4000 ms timeout as the old `fetchSafe`, same revalidate values (3600 career / 300 gamelog), same response shape and Cache-Control:

```ts
import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { CURRENT_SEASON } from "@/lib/constants";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Map a stats.nba.com resultSet (parallel arrays: headers + rowSet) into objects.
function parseResultSet(rs: { headers: string[]; rowSet: unknown[][] } | undefined, limit?: number): Record<string, unknown>[] | null {
  if (!rs?.rowSet) return null;
  const { headers, rowSet } = rs;
  const rows = limit ? rowSet.slice(0, limit) : rowSet;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    return obj;
  });
}

// Try NBA Stats API (may be blocked on some hosts)
async function fetchFromNBAStats(playerId: string) {
  const [careerRes, gameLogRes] = await Promise.all([
    fetchStats(`${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600 }),
    fetchStats(`${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${CURRENT_SEASON}&SeasonType=Regular+Season`, { key: "playergamelog", timeoutMs: 4000, revalidate: 300 }),
  ]);

  // Use `unknown[]` so the ESPN fallback in the caller can substitute its own shape.
  let careerSeasons: unknown[] | null = null;
  let recentGames: unknown[] | null = null;

  if (careerRes?.ok) {
    try {
      const data = await careerRes.json();
      const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
      careerSeasons = parseResultSet(rs);
    } catch { /* ignore */ }
  }

  if (gameLogRes?.ok) {
    try {
      const data = await gameLogRes.json();
      recentGames = parseResultSet(data.resultSets?.[0], 10);
    } catch { /* ignore */ }
  }

  return { careerSeasons, recentGames };
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  const playerName = request.nextUrl.searchParams.get("name");
  const teamTricode = request.nextUrl.searchParams.get("team");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // 1) Try NBA Stats API first (fast when not blocked)
  let result = await fetchFromNBAStats(playerId);

  // 2) If NBA Stats failed, fallback to ESPN
  if (!result.careerSeasons && playerName && teamTricode) {
    try {
      const espnId = await findESPNId(playerName, teamTricode);
      if (espnId) {
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          result = { careerSeasons: espnResult.careerSeasons, recentGames: result.recentGames };
        }
      }
    } catch { /* ESPN also failed */ }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
```

- [ ] **Step 5: Migrate `src/app/api/player-shots/route.ts`** with two Edits.

  Edit 1 — replace:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";
import { isRegular as isRegularGame, isPlayoff as isPlayoffGame } from "@/lib/games";
```
  with:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";
import { isRegular as isRegularGame, isPlayoff as isPlayoffGame } from "@/lib/games";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
```

  Edit 2 — inside `getGameIdsFromStatsNba`, replace:
```ts
  const gameIds: string[] = [];
  for (const st of types) {
    const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=${encodeURIComponent(season)}&SeasonType=${encodeURIComponent(st)}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json",
          Referer: "https://www.nba.com/",
          Origin: "https://www.nba.com",
        },
        // stats.nba.com data is stable for past seasons — cache 24h
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const rs = data.resultSets?.[0];
      if (!rs?.rowSet) continue;
      const gi = rs.headers.indexOf("Game_ID");
      if (gi < 0) continue;
      for (const row of rs.rowSet) {
        if (row[gi]) gameIds.push(row[gi] as string);
      }
    } catch {
      // network or parse error — try next season type
    }
  }
  return gameIds;
```
  with:
```ts
  const gameIds: string[] = [];
  for (const st of types) {
    const url = `${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${encodeURIComponent(season)}&SeasonType=${encodeURIComponent(st)}`;
    // stats.nba.com data is stable for past seasons — cache 24h
    const res = await fetchStats(url, { key: "playergamelog", revalidate: 86400 });
    if (!res?.ok) continue;
    try {
      const data = await res.json();
      const rs = data.resultSets?.[0];
      if (!rs?.rowSet) continue;
      const gi = rs.headers.indexOf("Game_ID");
      if (gi < 0) continue;
      for (const row of rs.rowSet) {
        if (row[gi]) gameIds.push(row[gi] as string);
      }
    } catch {
      // parse error — try next season type
    }
  }
  return gameIds;
```

- [ ] **Step 6: Verify:** `npx tsc --noEmit` (expect 0 errors) and `npx vitest run` (all suites green). Manual checks to note for later (dev server, not now): `/api/stats?endpoint=leagueleaders&LeagueID=00&PerMode=PerGame&Scope=S&Season=2025-26&SeasonType=Regular+Season&StatCategory=PTS&limit=5` returns a 5-row rowSet; a finished-game page's matchup section still renders; `/lab/career-arc` still loads career rows.

- [ ] **Step 7: Commit:**
```
git add src/app/api/stats/route.ts src/app/api/matchups/route.ts src/app/api/player/route.ts src/app/api/player-shots/route.ts
git commit -m "refactor(api): migrate stats/matchups/player/player-shots proxies to statsProxy"
```

### Task C6c: `/api/player` stops querying blackholed `playergamelog`; delete dead `parseLatestPlayerLine`

**Files:**
- Modify: `src/app/api/player/route.ts` (state as written in Task C6b Step 4)
- Modify: `src/lib/follow-digest.ts`

Why this is safe for the UI: `playergamelog` is blackholed from Vercel IPs and has never succeeded in prod, so `/api/player` already returns `recentGames: null` there. `src/components/player/PlayerStatsBundle.tsx` does `setGames(data.recentGames || [])`, and with `games = []` its scoring-trend chart (requires `games.length >= 3`) and recent-games table (requires `games.length > 0`) silently hide while the career table still renders — that IS the fallback production users see today. The other `/api/player` consumers (`PlayerAdvancedStats`, `src/app/lab/career-arc/CareerArc.tsx`) never read `recentGames`. No client change is needed.

- [ ] **Step 1: Read** `src/app/api/player/route.ts` and `src/lib/follow-digest.ts`.

- [ ] **Step 2: Verify `parseLatestPlayerLine` is dead code.** Run:
```
grep -rn "parseLatestPlayerLine\|gameDateMs\|PARSE_MONTHS" src/
```
  Expect matches ONLY inside `src/lib/follow-digest.ts` (the definitions themselves plus their internal uses). If any other file matches, STOP and report instead of deleting.

- [ ] **Step 3: Edit `src/app/api/player/route.ts`** — four Edits against the C6b state.

  Edit 1 (imports + maxDuration; `CURRENT_SEASON` becomes unused) — replace:
```ts
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { CURRENT_SEASON } from "@/lib/constants";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
```
  with:
```ts
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Worst case is serial: a 4s stats.nba.com timeout, then the ESPN fallback
// chain (5s roster lookup + 5s stats) — Vercel's 10s default kills that.
export const maxDuration = 15;
```

  Edit 2 (drop the now-unused `limit` param) — replace:
```ts
function parseResultSet(rs: { headers: string[]; rowSet: unknown[][] } | undefined, limit?: number): Record<string, unknown>[] | null {
  if (!rs?.rowSet) return null;
  const { headers, rowSet } = rs;
  const rows = limit ? rowSet.slice(0, limit) : rowSet;
  return rows.map((row) => {
```
  with:
```ts
function parseResultSet(rs: { headers: string[]; rowSet: unknown[][] } | undefined): Record<string, unknown>[] | null {
  if (!rs?.rowSet) return null;
  const { headers, rowSet } = rs;
  return rowSet.map((row) => {
```

  Edit 3 (delete the playergamelog half) — replace the whole `fetchFromNBAStats` function:
```ts
// Try NBA Stats API (may be blocked on some hosts)
async function fetchFromNBAStats(playerId: string) {
  const [careerRes, gameLogRes] = await Promise.all([
    fetchStats(`${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600 }),
    fetchStats(`${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${CURRENT_SEASON}&SeasonType=Regular+Season`, { key: "playergamelog", timeoutMs: 4000, revalidate: 300 }),
  ]);

  // Use `unknown[]` so the ESPN fallback in the caller can substitute its own shape.
  let careerSeasons: unknown[] | null = null;
  let recentGames: unknown[] | null = null;

  if (careerRes?.ok) {
    try {
      const data = await careerRes.json();
      const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
      careerSeasons = parseResultSet(rs);
    } catch { /* ignore */ }
  }

  if (gameLogRes?.ok) {
    try {
      const data = await gameLogRes.json();
      recentGames = parseResultSet(data.resultSets?.[0], 10);
    } catch { /* ignore */ }
  }

  return { careerSeasons, recentGames };
}
```
  with:
```ts
// Try NBA Stats API (may be blocked on some hosts)
async function fetchCareerSeasons(playerId: string): Promise<unknown[] | null> {
  const res = await fetchStats(
    `${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`,
    { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600 },
  );
  if (!res?.ok) return null;
  try {
    const data = await res.json();
    const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
    return parseResultSet(rs);
  } catch {
    return null;
  }
}
```

  Edit 4 (GET body) — replace:
```ts
  // 1) Try NBA Stats API first (fast when not blocked)
  let result = await fetchFromNBAStats(playerId);

  // 2) If NBA Stats failed, fallback to ESPN
  if (!result.careerSeasons && playerName && teamTricode) {
    try {
      const espnId = await findESPNId(playerName, teamTricode);
      if (espnId) {
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          result = { careerSeasons: espnResult.careerSeasons, recentGames: result.recentGames };
        }
      }
    } catch { /* ESPN also failed */ }
  }

  return NextResponse.json(result, {
```
  with:
```ts
  // 1) Try NBA Stats API first (fast when not blocked)
  let careerSeasons: unknown[] | null = await fetchCareerSeasons(playerId);

  // 2) If NBA Stats failed, fallback to ESPN
  if (!careerSeasons && playerName && teamTricode) {
    try {
      const espnId = await findESPNId(playerName, teamTricode);
      if (espnId) {
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          careerSeasons = espnResult.careerSeasons;
        }
      }
    } catch { /* ESPN also failed */ }
  }

  // recentGames stays in the response shape for existing consumers but is
  // always null: playergamelog is blackholed from Vercel and never succeeded
  // in prod, so clients already render their no-recent-games fallback.
  return NextResponse.json({ careerSeasons, recentGames: null }, {
```

- [ ] **Step 4: Delete the dead parser from `src/lib/follow-digest.ts`.** Two Edits.

  Edit 1 (module header no longer true) — replace:
```ts
// Data layer for the personalized "follow" digest. Pure, schedule-driven team
// helpers (no external calls) plus playergamelog parsing helpers shared by the
// /api/follow-digest route. Numbers mirror /standings (computeStandingsRows +
```
  with:
```ts
// Data layer for the personalized "follow" digest. Pure, schedule-driven team
// helpers (no external calls). Numbers mirror /standings (computeStandingsRows +
```

  Edit 2 — delete everything from the section divider line
```ts
// ── playergamelog parsing ──────────────────────────────────────────────────
```
  through the end of the file (the section contains only the `PARSE_MONTHS` const, the `gameDateMs` function, and the `parseLatestPlayerLine` export — all private to this dead path; the file then ends with the closing `}` of `teamNextGame` followed by a blank line). Also remove the now-trailing blank line so the file ends right after `teamNextGame`'s closing brace.

- [ ] **Step 5: Verify deletion:** run `grep -rn "parseLatestPlayerLine" src/` — expect ZERO matches. Then `npx tsc --noEmit` (0 errors) and `npx vitest run` (green).

- [ ] **Step 6: Commit:**
```
git add src/app/api/player/route.ts src/lib/follow-digest.ts
git commit -m "perf(player): drop blackholed playergamelog from /api/player, delete dead parser"
```

### Task C6d: Client-side dedup — shared `usePlayerCareer` hook

**Files:**
- Create: `src/lib/usePlayerCareer.ts`
- Modify: `src/components/player/PlayerStatsBundle.tsx`
- Modify: `src/components/player/PlayerAdvancedStats.tsx`

Both components are rendered side by side on `src/app/player/[id]/page.tsx` (lines ~480–481) with identical props, so they build the identical `/api/player?...` URL — a module-level `Map<url, Promise>` makes the second mount reuse the first fetch. `src/app/lab/career-arc/CareerArc.tsx` also calls `/api/player` but on its own page; leave it alone.

- [ ] **Step 1: Read** `src/components/player/PlayerStatsBundle.tsx` and `src/components/player/PlayerAdvancedStats.tsx`.

- [ ] **Step 2: Create `src/lib/usePlayerCareer.ts`** with exactly this content (mirrors the `"use client"` hook convention of `src/lib/useCountUp.ts`; the row types are lifted from the two components' current local interfaces — `FGA/FG3A/FTA` are the extra columns only `computeAdvanced` reads, present in both the stats.nba.com and ESPN-fallback shapes):

```ts
"use client";

import { useEffect, useState } from "react";

// Career row from /api/player's careerSeasons — the SeasonTotalsRegularSeason
// result set, or the ESPN fallback (same field names). Shooting-volume
// columns can be absent on very old seasons, so they stay optional.
export interface CareerSeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  FGA?: number | null;
  FG3A?: number | null;
  FTA?: number | null;
}

export interface PlayerGameLogRow {
  Game_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  PLUS_MINUS: number;
}

export interface PlayerCareerData {
  careerSeasons: CareerSeasonRow[];
  recentGames: PlayerGameLogRow[];
}

// Module-level promise cache: PlayerStatsBundle and PlayerAdvancedStats mount
// on the same page and would otherwise issue duplicate /api/player requests.
const careerCache = new Map<string, Promise<PlayerCareerData>>();

function fetchPlayerCareer(url: string): Promise<PlayerCareerData> {
  const cached = careerCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`player api ${res.status}`);
    const raw = (await res.json()) as {
      careerSeasons?: CareerSeasonRow[] | null;
      recentGames?: PlayerGameLogRow[] | null;
    };
    return { careerSeasons: raw.careerSeasons ?? [], recentGames: raw.recentGames ?? [] };
  })();
  // a rejected promise must not poison the cache — the next mount retries
  p.catch(() => careerCache.delete(url));
  careerCache.set(url, p);
  return p;
}

export function usePlayerCareer(personId: number, name: string, teamAbbr: string): {
  data: PlayerCareerData | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [data, setData] = useState<PlayerCareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const qs = new URLSearchParams({ id: String(personId) });
  if (name) qs.set("name", name);
  if (teamAbbr) qs.set("team", teamAbbr);
  const url = `/api/player?${qs}`;

  // Loading state reset on url/retry change — intentional dep-change refetch pattern.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    fetchPlayerCareer(url).then(
      (d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, retryKey]);

  const retry = () => {
    careerCache.delete(url);
    setRetryKey((k) => k + 1);
  };

  return { data, loading, error, retry };
}
```

- [ ] **Step 3: Refactor `src/components/player/PlayerStatsBundle.tsx`** — seven Edits.

  Edit 1 — replace:
```ts
import { useEffect, useState, memo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import type { Translations } from "@/locales/types";
```
  with:
```ts
import { useState, memo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import { usePlayerCareer, type CareerSeasonRow, type PlayerGameLogRow } from "@/lib/usePlayerCareer";
import type { Translations } from "@/locales/types";
```

  Edit 2 — delete the two local interfaces by replacing:
```ts
interface SeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
}

interface GameLogRow {
  Game_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  PLUS_MINUS: number;
}

interface Props {
```
  with:
```ts
interface Props {
```

  Edit 3 — replace the state + fetch effect block (component head through the effect's closing line):
```ts
export default function PlayerStatsBundle({ playerId, playerName, teamTricode }: Props) {
  const { t, locale } = useLocale();
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);
  const [games, setGames] = useState<GameLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Loading state reset on playerId/retry change — intentional dep-change refetch pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);

    (async () => {
      try {
        const qs = new URLSearchParams({ id: String(playerId) });
        if (playerName) qs.set("name", playerName);
        if (teamTricode) qs.set("team", teamTricode);
        const res = await fetch(`/api/player?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { if (timedOut || !controller.signal.aborted) { setError(true); setLoading(false); } return; }
        const data = await res.json();
        if (!controller.signal.aborted) {
          setSeasons(data.careerSeasons || []);
          setGames(data.recentGames || []);
        }
      } catch {
        if (timedOut || !controller.signal.aborted) setError(true);
      }
      if (timedOut || !controller.signal.aborted) setLoading(false);
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [playerId, playerName, teamTricode, retryKey]);
```
  with:
```ts
export default function PlayerStatsBundle({ playerId, playerName, teamTricode }: Props) {
  const { t, locale } = useLocale();
  const { data, loading, error, retry } = usePlayerCareer(playerId, playerName ?? "", teamTricode ?? "");
  const seasons = data?.careerSeasons ?? null;
  const games = data?.recentGames ?? null;
```

  Edit 4 — in the error card, replace:
```tsx
          <button onClick={() => setRetryKey((k) => k + 1)} className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors">
```
  with:
```tsx
          <button onClick={retry} className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors">
```

  Edit 5 — replace:
```ts
function CareerSection({ seasons, t, isZh }: { seasons: SeasonRow[]; t: Translations; isZh: boolean }) {
```
  with:
```ts
function CareerSection({ seasons, t, isZh }: { seasons: CareerSeasonRow[]; t: Translations; isZh: boolean }) {
```

  Edit 6 — replace:
```ts
const GameTrendChart = memo(function GameTrendChart({ games, t }: { games: GameLogRow[]; t: Translations }) {
```
  with:
```ts
const GameTrendChart = memo(function GameTrendChart({ games, t }: { games: PlayerGameLogRow[]; t: Translations }) {
```

  Edit 7 — replace:
```ts
function CareerStatsTable({ seasons, t, headerExtra }: { seasons: SeasonRow[]; t: Translations; headerExtra?: ReactNode }) {
```
  with:
```ts
function CareerStatsTable({ seasons, t, headerExtra }: { seasons: CareerSeasonRow[]; t: Translations; headerExtra?: ReactNode }) {
```

  (No other changes: the loading skeleton, error card links, `if (!seasons?.length && !games?.length) return null;` guard, and all rendering stay byte-identical. `CareerSeasonRow[]` remains assignable to `PlayerCareerChart`'s `CareerChartSeason[]` prop since `number` is assignable to `number | null`.)

- [ ] **Step 4: Rewrite `src/components/player/PlayerAdvancedStats.tsx`** (Write, full replacement — the JSX below the guards is unchanged from the current file):

```tsx
"use client";

import { TrendingUp } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { usePlayerCareer, type CareerSeasonRow } from "@/lib/usePlayerCareer";

interface AdvancedData {
  TS_PCT: number | null;
  EFG_PCT: number | null;
  USG_PCT: number | null;
}

function computeAdvanced(seasons: CareerSeasonRow[]): AdvancedData | null {
  if (seasons.length === 0) return null;
  const latest = seasons[seasons.length - 1];
  const pts = latest.PTS;
  const fga = latest.FGA;
  const fta = latest.FTA;
  const fgPct = latest.FG_PCT;
  const fg3Pct = latest.FG3_PCT;
  const fg3a = latest.FG3A;
  let tsPct: number | null = null;
  if (fga != null && fta != null && pts != null && (fga + 0.44 * fta) > 0) {
    tsPct = pts / (2 * (fga + 0.44 * fta));
  }
  let efgPct: number | null = null;
  if (fgPct != null && fg3Pct != null && fga != null && fg3a != null && fga > 0) {
    const fgm = fgPct * fga;
    const fg3m = fg3Pct * fg3a;
    efgPct = (fgm + 0.5 * fg3m) / fga;
  }
  return { TS_PCT: tsPct, EFG_PCT: efgPct, USG_PCT: null };
}

export default function PlayerAdvancedStats({ playerId, playerName, teamTricode }: { playerId: number; playerName?: string; teamTricode?: string }) {
  const { t } = useLocale();
  const { data, loading, error } = usePlayerCareer(playerId, playerName ?? "", teamTricode ?? "");
  const stats = data ? computeAdvanced(data.careerSeasons) : null;

  if (loading) {
    return (
      <div className="h-20 bg-bg-secondary/60 rounded-lg skeleton-shimmer" />
    );
  }

  // If failed, just hide — advanced stats are supplementary
  if (error) return null;

  if (!stats || (stats.TS_PCT == null && stats.EFG_PCT == null)) return null;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Advanced</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <TrendingUp size={14} className="text-accent-amber" />
          {t.playerAdvanced.title}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.TS_PCT != null && (
          <div className="glass-tile p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.tsPct}</p>
            <p className="text-2xl font-light font-mono tabular-nums mt-1 text-accent">{(stats.TS_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.trueShooting}</p>
            {stats.TS_PCT >= 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">{t.playerAdvanced.elite}</span>}
            {stats.TS_PCT >= 0.55 && stats.TS_PCT < 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold mt-1 inline-block">{t.playerAdvanced.aboveAvg}</span>}
          </div>
        )}
        {stats.EFG_PCT != null && (
          <div className="glass-tile p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.efgPct}</p>
            <p className="text-2xl font-light font-mono tabular-nums mt-1 text-text-primary">{(stats.EFG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.effectiveFg}</p>
            {stats.EFG_PCT >= 0.55 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">{t.playerAdvanced.elite}</span>}
          </div>
        )}
        {stats.USG_PCT != null && (
          <div className="glass-tile p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.usgPct}</p>
            <p className="text-2xl font-light font-mono tabular-nums mt-1 text-text-primary">{(stats.USG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.usageRate}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify:** `npx tsc --noEmit` — expect 0 errors. Then `npx vitest run` — green. Manual check to record for later (dev server, not now): open `http://localhost:3000/player/2544`, DevTools Network filtered to `api/player` — the page must show the career season-by-season table AND the Advanced stat tiles with exactly ONE `/api/player` request (the module-level promise cache also absorbs React StrictMode's double-effect in dev). Blocking that request in DevTools must surface PlayerStatsBundle's fallback card, and its retry button must re-issue the fetch.

- [ ] **Step 6: Commit:**
```
git add src/lib/usePlayerCareer.ts src/components/player/PlayerStatsBundle.tsx src/components/player/PlayerAdvancedStats.tsx
git commit -m "perf(player): dedupe duplicate /api/player fetches via shared usePlayerCareer hook"
```

---

## Group C (part 2): player-shots PBP cache, live-page refresh rate, CDN fetch timeouts

> Ordering constraint: **Task C7 must be completed before Task C9** — both modify `getPlayByPlay` in `src/lib/api.ts`, and C9's edit anchors quote the post-C7 code. Task C8 is independent.

### Task C7: player-shots stops re-downloading final-game play-by-play

**Context:** `getPlayByPlay`'s cache pin currently checks `boxScoreCache.get(gameId)?.gameStatus === 3`, but `/api/player-shots` never fetches box scores, so the pin never fires and every request re-downloads up to 30 full PBP files. The PBP payload itself carries **no** `gameStatus` (its `game` object is only `{ gameId, actions }`), so finality comes from a caller hint: `/api/player-shots` only ever aggregates finished games (its schedule path filters `gameStatus !== 3`; its historical stats.nba.com path is past seasons only), so it always passes `final: true`.

**Files:**
- Test: Create `src/lib/api-pbp.test.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/app/api/player-shots/route.ts`

- [ ] **Step 1: Write the failing test file.** Create `src/lib/api-pbp.test.ts` with exactly this content:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Api = typeof import("./api");

function pbpResponse(count: number): Response {
  const actions = Array.from({ length: count }, (_, i) => ({
    personId: 1000 + i,
    playerNameI: `P. Player${i}`,
    teamTricode: "BOS",
    period: 1,
    clock: "PT10M00.00S",
    actionType: "2pt",
    subType: "Jump Shot",
    shotResult: "Made",
    x: 25,
    y: 30,
    shotDistance: 12,
    description: `shot ${i}`,
  }));
  return new Response(JSON.stringify({ game: { gameId: "test", actions } }));
}

describe("getPlayByPlay caching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let api: Api;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    api = await import("./api");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves final games from cache — two sequential calls, one fetch", async () => {
    fetchMock.mockImplementation(async () => pbpResponse(2));
    const first = await api.getPlayByPlay("0042500401", { final: true });
    const second = await api.getPlayByPlay("0042500401", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 86400 } });
  });

  it("refetches live games on every call", async () => {
    fetchMock.mockImplementation(async () => pbpResponse(1));
    await api.getPlayByPlay("0022500900");
    await api.getPlayByPlay("0022500900");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 60 } });
  });

  it("dedupes concurrent calls into a single fetch", async () => {
    const resolvers: Array<(r: Response) => void> = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => { resolvers.push(resolve); })
    );
    const p1 = api.getPlayByPlay("0022500901", { final: true });
    const p2 = api.getPlayByPlay("0022500901", { final: true });
    for (const r of resolvers) r(pbpResponse(1));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
    expect(r1).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && npx vitest run src/lib/api-pbp.test.ts
```

Expected: tests 1 and 3 FAIL (current code fetches twice on the second sequential call and does not dedup concurrent calls); test 2 ("refetches live games") already passes. Do not proceed if tests 1 and 3 pass — that means the code was already changed.

- [ ] **Step 3: Change the pbpCache entry shape.** In `src/lib/api.ts`, find:

```ts
const boxScoreCache = new Map<string, BoxScore>();
const pbpCache = new Map<string, ShotAction[]>();
```

Replace with:

```ts
const boxScoreCache = new Map<string, BoxScore>();
const pbpCache = new Map<string, { shots: ShotAction[]; final: boolean }>();
```

- [ ] **Step 4: Rewrite getPlayByPlay with final-flag pinning + inflight dedup.** In `src/lib/api.ts`, find this entire block:

```ts
// Get play-by-play (for shot chart)
export async function getPlayByPlay(gameId: string): Promise<ShotAction[]> {
  const cached = pbpCache.get(gameId);
  // Final-game check piggybacks on box score cache (cheap lookup).
  if (cached && boxScoreCache.get(gameId)?.gameStatus === 3) return cached;
  const res = await fetch(
    `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
    { headers: HEADERS, next: { revalidate: 60 } }
  );
  if (!res.ok) return cached ?? [];
  const data = await res.json();
  const shots = extractShots(data.game?.actions || []);
  lruSet(pbpCache, gameId, shots);
  return shots;
}
```

Replace with:

```ts
// Collapse concurrent PBP fetches of the same gameId (player-shots fires
// batches of 5 that can overlap across requests). Mirrors boxScoreInflight.
const pbpInflight = new Map<string, Promise<ShotAction[]>>();

// Get play-by-play (for shot chart).
// The PBP payload carries no gameStatus (its game object is just
// { gameId, actions }), so finality must come from the caller:
// /api/player-shots aggregates finished games only and passes final: true,
// which pins the cache entry and stretches the fetch revalidate to 24h
// (final PBP is immutable).
export async function getPlayByPlay(
  gameId: string,
  opts?: { final?: boolean }
): Promise<ShotAction[]> {
  const cached = pbpCache.get(gameId);
  if (cached?.final) return cached.shots;
  const existing = pbpInflight.get(gameId);
  if (existing) return existing;
  const final = opts?.final === true;
  const p = (async (): Promise<ShotAction[]> => {
    const res = await fetch(
      `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
      { headers: HEADERS, next: { revalidate: final ? 86400 : 60 } }
    );
    if (!res.ok) return cached?.shots ?? [];
    const data = await res.json();
    const shots = extractShots(data.game?.actions || []);
    lruSet(pbpCache, gameId, { shots, final });
    return shots;
  })();
  pbpInflight.set(gameId, p);
  try {
    return await p;
  } finally {
    pbpInflight.delete(gameId);
  }
}
```

- [ ] **Step 5: Run the test — expect PASS.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && npx vitest run src/lib/api-pbp.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 6: Pass the final hint from /api/player-shots.** In `src/app/api/player-shots/route.ts`, find:

```ts
      const results = await Promise.all(
        batch.map((gid) => getPlayByPlay(gid).catch(() => []))
      );
```

Replace with:

```ts
      // Every gameId here is a finished game (the schedule path filters
      // gameStatus===3; the historical path is past seasons only), so the
      // PBP cache entry can be pinned as final.
      const results = await Promise.all(
        batch.map((gid) => getPlayByPlay(gid, { final: true }).catch(() => []))
      );
```

- [ ] **Step 7: Verify types and full suite.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && npx tsc --noEmit && npx vitest run
```

Expected: 0 type errors, all tests green. Manual check later (needs network to cdn.nba.com): hit `/api/player-shots?playerId=<id>&team=<tricode>` twice on a dev server and confirm the second response is markedly faster (server log shows no repeated PBP downloads).

- [ ] **Step 8: Commit.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && git add src/lib/api.ts src/lib/api-pbp.test.ts src/app/api/player-shots/route.ts && git commit -m "perf(api): final-aware pbp cache + inflight dedup — player-shots stops re-downloading pbp"
```

---

### Task C8: game page auto-refresh 15s → 30s

**Context:** The box score upstream fetch TTL is 30s (`next: { revalidate: 30 }` in `getBoxScore`), so a 15s client refresh can never see new data on half its ticks — it only burns lambda invocations and bandwidth. Note: the constant is in **seconds** (a 1000ms `setInterval` decrements it), not milliseconds.

**Files:**
- Modify: `src/components/GameAutoRefresh.tsx`

- [ ] **Step 1: Change the interval constant.** In `src/components/GameAutoRefresh.tsx`, find:

```ts
const INTERVAL = 15;
```

Replace with:

```ts
const INTERVAL = 30;
```

(All other uses — countdown init, `remainingRef` resets, the manual-refresh button — read this constant, so nothing else changes.)

- [ ] **Step 2: Verify.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && npx tsc --noEmit
```

Expected: 0 errors. Manual check later: no live games in July — per the design doc this ships on code review alone; when games resume, a live game page should show the countdown badge starting at `(30s)` and `router.refresh()` firing every 30s.

- [ ] **Step 3: Commit.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && git add src/components/GameAutoRefresh.tsx && git commit -m "perf(live): game auto-refresh 15s to 30s — matches box-score upstream ttl"
```

---

### Task C9: 8s abort timeouts on CDN fetches + /api/games ET path degrades instead of 500

> **Depends on Task C7** — the `getPlayByPlay` snippet quoted below is the post-C7 version. Do not start this task until C7 is committed.

**Context:** Four cdn.nba.com fetch sites have no timeout — a hung connection stalls the page/route until the lambda dies. `AbortSignal.timeout(8000)` converts hangs into catchable errors (available in Node 18+, already typed by the project's `"dom"` TS lib — no config change). Do NOT touch the schedule fetches (`fetchScheduleBlocking` / `fetchScheduleInBackground`) — they go through `fetchWithRetry` and are handled elsewhere. Separately, `/api/games`'s ET path calls `getTodayScoreboard()` unwrapped, so one transient error 500s the whole endpoint, while the tz path in the same file already degrades with `.catch(() => [])`.

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/app/api/games/route.ts`

- [ ] **Step 1: Timeout on getTodayScoreboard.** In `src/lib/api.ts`, find:

```ts
  const res = await fetch(
    `${CDN_BASE}/liveData/scoreboard/todaysScoreboard_00.json`,
    { headers: HEADERS, next: { revalidate: 30 } }
  );
```

Replace with:

```ts
  const res = await fetch(
    `${CDN_BASE}/liveData/scoreboard/todaysScoreboard_00.json`,
    { headers: HEADERS, next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) }
  );
```

- [ ] **Step 2: Timeout on getBoxScore.** In `src/lib/api.ts`, find:

```ts
    const res = await fetch(
      `${CDN_BASE}/liveData/boxscore/boxscore_${gameId}.json`,
      { headers: HEADERS, next: { revalidate: 30 } }
    );
```

Replace with:

```ts
    const res = await fetch(
      `${CDN_BASE}/liveData/boxscore/boxscore_${gameId}.json`,
      { headers: HEADERS, next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) }
    );
```

- [ ] **Step 3: Timeout on getPlayByPlay (post-C7 code).** In `src/lib/api.ts`, find:

```ts
    const res = await fetch(
      `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
      { headers: HEADERS, next: { revalidate: final ? 86400 : 60 } }
    );
```

Replace with:

```ts
    const res = await fetch(
      `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
      {
        headers: HEADERS,
        next: { revalidate: final ? 86400 : 60 },
        signal: AbortSignal.timeout(8000),
      }
    );
```

- [ ] **Step 4: Timeout on fetchPlayerIndex.** In `src/lib/api.ts`, find:

```ts
    const res = await fetch(
      `${CDN_BASE}/staticData/playerIndex.json`,
      { headers: HEADERS, next: { revalidate: 86400 } }
    );
```

Replace with:

```ts
    const res = await fetch(
      `${CDN_BASE}/staticData/playerIndex.json`,
      { headers: HEADERS, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
    );
```

- [ ] **Step 5: Degrade the /api/games ET path.** In `src/app/api/games/route.ts`, find (this is the ET path inside the `} else if (isToday) {` branch — the tz path a few lines above already has `.catch(() => [])`, leave it alone):

```ts
      // ET path — original behavior
      const liveGames = await getTodayScoreboard();
```

Replace with:

```ts
      // ET path — original behavior. Degrades to an empty scoreboard on a
      // transient CDN error instead of 500ing the endpoint (mirrors the tz path).
      const liveGames = await getTodayScoreboard().catch(() => []);
```

No response-header change is needed: on failure this now flows into the normal 200 response, and the `isToday` branch already emits the short `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`, so an error-empty result cannot get pinned long at the CDN.

- [ ] **Step 6: Verify types and full suite.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && npx tsc --noEmit && npx vitest run
```

Expected: 0 type errors; all tests green (the C7 fetch stub ignores the init object, so the added `signal` keys do not affect it). Manual check later: on a dev server with cdn.nba.com unreachable, `GET /api/games?date=<today's ET date>` returns HTTP 200 with `{"data":[]}` instead of 500.

- [ ] **Step 7: Commit.** Run:

```bash
cd "C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker" && git add src/lib/api.ts src/app/api/games/route.ts && git commit -m "fix(api): 8s cdn fetch timeouts, games et path degrades to empty instead of 500"
```

---

# Group C-hardening: C10 BDL rate-limit + C11 small wins

All paths are relative to the repo root `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker`. Run every command from the repo root.

### Task C10: /api/salary — BDL negative cache, contracts timeout, maxDuration

BallDontLie failures (429s, outages) currently return `{ data: [] }` with NO cache header, so every visitor re-burns API quota. Add a module-level negative cache honoring `Retry-After`, a timeout on the contracts fetch (the search fetch already has one), and a `maxDuration` export (precedent: `src/app/api/stats/route.ts` line 24 has `export const maxDuration = 30;`).

**Files:**
- Modify: `src/app/api/salary/route.ts`

- [ ] **Step 1: Read the current route.** Read `src/app/api/salary/route.ts` (75 lines). Confirm it matches the snippets quoted below before editing (the file has two BDL fetches: `/players?search=` with an AbortController timeout, and `/contracts/teams?team_id=` with none).

- [ ] **Step 2: Add negative-cache registry, failure helper, and maxDuration.** Replace:
```ts
const BDL_BASE = "https://api.balldontlie.io/v1";
```
with:
```ts
const BDL_BASE = "https://api.balldontlie.io/v1";

export const maxDuration = 10;

const bdlRetryAt = new Map<string, number>();
const FAIL_HEADERS = { "Cache-Control": "public, s-maxage=60" };

function retryDelayMs(res: Response): number {
  // Retry-After may be an HTTP-date or garbage — Number() yields NaN then; cap at 1h.
  const secs = Number(res.headers.get("Retry-After"));
  return Number.isFinite(secs) && secs > 0 && secs <= 3600 ? secs * 1000 : 60_000;
}

function bdlFailure(key: string, res: Response): NextResponse {
  bdlRetryAt.set(key, Date.now() + retryDelayMs(res));
  return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
}
```

- [ ] **Step 3: Short-circuit on an open player-key deadline.** Replace:
```ts
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ data: [] });
  }

  try {
```
with:
```ts
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ data: [] });
  }

  const searchKey = `player:${playerName}`;
  if ((bdlRetryAt.get(searchKey) ?? 0) > Date.now()) {
    return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
  }

  try {
```

- [ ] **Step 4: Arm the negative cache on search failure.** Replace:
```ts
    if (!searchRes.ok) return NextResponse.json({ data: [] });
```
with:
```ts
    if (!searchRes.ok) return bdlFailure(searchKey, searchRes);
```
(Note: this line is unique — the later `if (!contractRes.ok)` line has different text and is handled in Step 5.)

- [ ] **Step 5: Team-key short-circuit + contracts timeout + failure arming.** Replace:
```ts
    const teamId = match.team?.id;
    if (!teamId) return NextResponse.json({ data: [] });

    const contractRes = await fetch(
      `${BDL_BASE}/contracts/teams?team_id=${teamId}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
      }
    );
    if (!contractRes.ok) return NextResponse.json({ data: [] });
```
with:
```ts
    const teamId = match.team?.id;
    if (!teamId) return NextResponse.json({ data: [] });

    const teamKey = `team:${teamId}`;
    if ((bdlRetryAt.get(teamKey) ?? 0) > Date.now()) {
      return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
    }

    const contractController = new AbortController();
    const contractTimeout = setTimeout(() => contractController.abort(), 5000);
    const contractRes = await fetch(
      `${BDL_BASE}/contracts/teams?team_id=${teamId}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
        signal: contractController.signal,
      }
    );
    clearTimeout(contractTimeout);
    if (!contractRes.ok) return bdlFailure(teamKey, contractRes);
```

- [ ] **Step 6: Cache-header the catch path too.** Replace:
```ts
  } catch {
    return NextResponse.json({ data: [] });
  }
```
with:
```ts
  } catch {
    return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
  }
```

- [ ] **Step 7: Verify.** Run `npx tsc --noEmit` — expect 0 errors. (Manual check later, hard to trigger locally: with a bogus `BALLDONTLIE_API_KEY`, hit `/api/salary?player=LeBron James&team=LAL` twice — second response must return instantly (short-circuit) and both must carry `Cache-Control: public, s-maxage=60`.)

- [ ] **Step 8: Commit.**
```
git add src/app/api/salary/route.ts
git commit -m "fix(api): salary route BDL negative cache, contracts timeout, maxDuration"
```

### Task C11a: Compare page headshots — request the 260x190 variant

`playerHeadshotUrl(personId, dimensions)` (`src/lib/teamUrls.ts` line 6) defaults to `"1040x760"`. CompareClient renders headshots at 64px/80px but falls through to the default at both call sites, pulling multi-MB PNGs per comparison. Precedent commit: `3cea497 perf(images): small headshots use the 260x190 variant (~10x smaller)`.

**Files:**
- Modify: `src/app/compare/CompareClient.tsx`

- [ ] **Step 1: Read the two call sites.** In `src/app/compare/CompareClient.tsx`, locate the two `playerHeadshotUrl(` calls (currently lines 160 and 598; the `headshotUrl` helper defined at 598 feeds the `<Image>` tags near lines 745/771). Confirm the snippets below match.

- [ ] **Step 2: Fix the comparison-card avatar.** Replace:
```tsx
              <Image src={playerHeadshotUrl(p.personId)} alt={`${p.firstName} ${p.lastName}`} width={64} height={64} unoptimized className="w-full h-full object-cover object-top" />
```
with:
```tsx
              <Image src={playerHeadshotUrl(p.personId, "260x190")} alt={`${p.firstName} ${p.lastName}`} width={64} height={64} unoptimized className="w-full h-full object-cover object-top" />
```

- [ ] **Step 3: Fix the headshotUrl helper.** Replace:
```tsx
  const headshotUrl = (id: number) => playerHeadshotUrl(id);
```
with:
```tsx
  const headshotUrl = (id: number) => playerHeadshotUrl(id, "260x190");
```

- [ ] **Step 4: Verify.** Run `npx tsc --noEmit` — expect 0 errors. (Manual check later: on `/compare`, DevTools Network tab shows headshot requests to `.../260x190/<id>.png`, not `1040x760`.)

- [ ] **Step 5: Commit.**
```
git add src/app/compare/CompareClient.tsx
git commit -m "perf(images): compare page headshots use the 260x190 variant"
```

### Task C11b: Service worker — cap the CACHE_IMAGES bucket at 300 entries

`public/sw.js` caches every cdn.nba.com image and `/_next/image` response into `CACHE_IMAGES` with no bound (browsing stats/player pages accumulates hundreds of headshots). The pages bucket already has a FIFO trim (MAX_PAGES = 30, inside the navigation handler) — mirror that pattern. Also bump `CACHE_VERSION` so the new logic starts from clean buckets (the `activate` handler purges every `nba-tracker-*` cache not ending in the current version).

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Read the file.** Read `public/sw.js` (144 lines). Note the existing trim pattern in the navigation handler (`const MAX_PAGES = 30;` inside `caches.open(CACHE_PAGES).then(async (cache) => ...)`) and the image bucket handler at the bottom.

- [ ] **Step 2: Bump the cache version.** Replace:
```js
const CACHE_VERSION = "v2";
```
with:
```js
const CACHE_VERSION = "v3";
```

- [ ] **Step 3: Add the FIFO trim to the images bucket.** In the `bucketName === CACHE_IMAGES` branch, replace:
```js
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_IMAGES).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached); // if network fails, fall back to cache
```
with:
```js
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_IMAGES).then(async (cache) => {
              await cache.put(req, copy);
              const keys = await cache.keys();
              const MAX_IMAGES = 300;
              if (keys.length > MAX_IMAGES) {
                for (const k of keys.slice(0, keys.length - MAX_IMAGES)) {
                  await cache.delete(k);
                }
              }
            }).catch(() => { /* QuotaExceeded etc. — caching is best-effort */ });
          }
          return res;
        }).catch(() => cached); // if network fails, fall back to cache
```

- [ ] **Step 4: Verify.** `public/sw.js` is plain JS outside the TypeScript program, so `tsc` does not cover it. Run `node --check public/sw.js` — expect no output (syntax OK) — then re-read the diff carefully: the trim must run AFTER `cache.put`, `Cache.keys()` insertion order makes oldest-first deletion a valid FIFO, and the outer `.catch(() => cached)` on `fetchPromise` must remain untouched. (Manual check later, in a browser against the dev/prod build: DevTools > Application > Service Workers > Update; confirm cache storage now lists only `nba-tracker-*-v3` buckets and the old `-v2` ones are gone.)

- [ ] **Step 5: Commit.**
```
git add public/sw.js
git commit -m "perf(pwa): cap CACHE_IMAGES at 300 entries, bump cache version to v3"
```

### Task C11c: ESPN payload guards — injuries shape validation + no fake-zero career rows

Two independent guards, one commit.

Guard 1: `/api/injuries` currently does `json.injuries || []` — any unexpected ESPN body (error object, redirect HTML parsed as `{}`) gets cached as an empty list for 30 minutes with `s-maxage=1800`. Consumers of this route: `src/app/favorites/FavoritesDashboard.tsx` (line 143) and the admin health check. The load-bearing keys per team entry (from the `TeamInjury`/`InjuryItem` interfaces in `src/app/injuries/page.tsx` lines 12-33, which model the same feed) are `displayName` (string — used for team matching) and `injuries` (array of objects with optional `id`/`status`/`date`/`athlete.displayName`/`athlete.position.abbreviation`/`shortComment`).

Guard 2: `getESPNCareerStats` in `src/lib/espn.ts` builds season rows with `parseFloat(get(v, "GP") || "0")` — if ESPN renames a stat label, `labels.indexOf(label)` returns -1, `get` returns null, and every stat silently becomes 0 (fake all-zero seasons corrupt career charts and advanced-stat math). Return `null` for such rows and filter them out.

**Files:**
- Modify: `src/app/api/injuries/route.ts`
- Modify: `src/lib/espn.ts`

- [ ] **Step 1: Read all three files.** Read `src/app/api/injuries/route.ts` (31 lines), `src/lib/espn.ts` (106 lines), and `src/app/api/player/route.ts` (the ESPN fallback at lines 76-86). Confirm the snippets below match.

- [ ] **Step 2: Add the feed shape guard to the injuries route.** In `src/app/api/injuries/route.ts`, replace:
```ts
const ESPN_INJURIES =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";
```
with:
```ts
const ESPN_INJURIES =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";

interface ESPNInjuryTeam {
  displayName: string;
  injuries: unknown[];
}

// Consumers key off team displayName + the injuries array; an unexpected ESPN
// body would otherwise be cached as "no injuries" for 30 minutes.
function isValidInjuryFeed(json: unknown): json is { injuries: ESPNInjuryTeam[] } {
  if (typeof json !== "object" || json === null) return false;
  const teams = (json as { injuries?: unknown }).injuries;
  if (!Array.isArray(teams)) return false;
  return teams.every((team) => {
    if (typeof team !== "object" || team === null) return false;
    const t = team as { displayName?: unknown; injuries?: unknown };
    return typeof t.displayName === "string"
      && Array.isArray(t.injuries)
      && t.injuries.every((i) => typeof i === "object" && i !== null);
  });
}
```

- [ ] **Step 3: Return 502 no-store on shape mismatch instead of caching an empty array.** In the same file, replace:
```ts
    const json = await res.json();
    // ESPN returns { injuries: [...teams], season: {...} }
    return NextResponse.json({ data: json.injuries || [] }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
```
with:
```ts
    const json = await res.json();
    if (!isValidInjuryFeed(json)) {
      return NextResponse.json({ data: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ data: json.injuries }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
```
(A JSON parse failure in `res.json()` is already handled by the existing surrounding `catch`, which returns 500 with no-store — leave it as is.)

- [ ] **Step 4: Null-out ESPN career rows with missing labels.** In `src/lib/espn.ts`, replace the entire `careerSeasons` construction:
```ts
  const careerSeasons: ESPNSeasonStats[] = cat.statistics.map(s => {
    const v = s.stats;
    const parseSplit = (raw: string | null) => {
      if (!raw) return { m: 0, a: 0 };
      const [m, a] = raw.split("-").map(Number);
      return { m: m || 0, a: a || 0 };
    };
    const fg = parseSplit(get(v, "FG"));
    const fg3 = parseSplit(get(v, "3PT"));
    const ft = parseSplit(get(v, "FT"));

    return {
      SEASON_ID: s.season?.displayName || "",
      TEAM_ABBREVIATION: (s.teamSlug || "").replace(/-/g, " ").split(" ").map(w => w[0]?.toUpperCase() || "").join(""),
      GP: parseFloat(get(v, "GP") || "0"),
      MIN: parseFloat(get(v, "MIN") || "0"),
      PTS: parseFloat(get(v, "PTS") || "0"),
      REB: parseFloat(get(v, "REB") || "0"),
      AST: parseFloat(get(v, "AST") || "0"),
      STL: parseFloat(get(v, "STL") || "0"),
      BLK: parseFloat(get(v, "BLK") || "0"),
      FG_PCT: parseFloat(get(v, "FG%") || "0") / 100,
      FG3_PCT: parseFloat(get(v, "3P%") || "0") / 100,
      FT_PCT: parseFloat(get(v, "FT%") || "0") / 100,
      FGA: fg.a,
      FG3A: fg3.a,
      FTA: ft.a,
    };
  });
```
with:
```ts
  const careerSeasons = cat.statistics
    .map((s): ESPNSeasonStats | null => {
      const v = s.stats;
      const num = (label: string): number | null => {
        const raw = get(v, label);
        if (raw == null || raw === "") return null;
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : null;
      };
      const parseSplit = (raw: string | null) => {
        if (!raw) return { m: 0, a: 0 };
        const [m, a] = raw.split("-").map(Number);
        return { m: m || 0, a: a || 0 };
      };
      const gp = num("GP");
      const min = num("MIN");
      const pts = num("PTS");
      const reb = num("REB");
      const ast = num("AST");
      const stl = num("STL");
      const blk = num("BLK");
      const fgPct = num("FG%");
      const fg3Pct = num("3P%");
      const ftPct = num("FT%");
      // A missing label means ESPN changed the payload — a fake all-zero season
      // row would silently corrupt career charts and advanced-stat math.
      if (gp === null || min === null || pts === null || reb === null || ast === null
        || stl === null || blk === null || fgPct === null || fg3Pct === null || ftPct === null) {
        return null;
      }
      const fg = parseSplit(get(v, "FG"));
      const fg3 = parseSplit(get(v, "3PT"));
      const ft = parseSplit(get(v, "FT"));

      return {
        SEASON_ID: s.season?.displayName || "",
        TEAM_ABBREVIATION: (s.teamSlug || "").replace(/-/g, " ").split(" ").map(w => w[0]?.toUpperCase() || "").join(""),
        GP: gp,
        MIN: min,
        PTS: pts,
        REB: reb,
        AST: ast,
        STL: stl,
        BLK: blk,
        FG_PCT: fgPct / 100,
        FG3_PCT: fg3Pct / 100,
        FT_PCT: ftPct / 100,
        FGA: fg.a,
        FG3A: fg3.a,
        FTA: ft.a,
      };
    })
    .filter((row): row is ESPNSeasonStats => row !== null);
```
(The final `return { careerSeasons, recentGames: null };` stays unchanged — `careerSeasons` is still typed `ESPNSeasonStats[]` after the filter.)

- [ ] **Step 5: Confirm null rows degrade gracefully downstream — no code change.** In `src/app/api/player/route.ts`, verify the ESPN fallback already guards on the filtered array:
```ts
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          result = { careerSeasons: espnResult.careerSeasons, recentGames: result.recentGames };
        }
```
When every row is filtered out, `careerSeasons` is `[]`, the substitution is skipped, and the response keeps `careerSeasons: null`; client consumers (`PlayerStatsBundle.tsx` line 72, `PlayerAdvancedStats.tsx` line 58, `lab/career-arc/CareerArc.tsx` line 99) all do `data.careerSeasons || []`. Nothing to edit — this step is a read-only confirmation; if the quoted code does not match, STOP and re-read before proceeding.

- [ ] **Step 6: Verify.** Run `npx tsc --noEmit` — expect 0 errors. (Manual check later: `/favorites` with a followed team still shows the injuries card; `/api/injuries` returns `{ data: [...] }` with team objects.)

- [ ] **Step 7: Commit.**
```
git add src/app/api/injuries/route.ts src/lib/espn.ts
git commit -m "fix(api): ESPN shape guards — injuries 502 on mismatch, no fake-zero career rows"
```

---

## Task Group D — Schedule 瘦身基建 (slim schedule infrastructure)

**Background for the implementer (zero context needed beyond this):** `src/lib/api.ts` downloads an 11MB `scheduleLeagueV2.json` feed from cdn.nba.com. The `next: { revalidate: 7200 }` hint on that fetch is a no-op — the body exceeds the ~2MB Vercel data-cache entry limit — so every cold lambda pays the full 11MB download+parse before first byte on 15+ pages. The fix: (D1) project the raw feed down to the declared `ScheduleGame` fields immediately after parse, (D2) serve the now-sub-2MB projection from a new `/api/schedule-slim` route that IS data-cache eligible, and rewire `getFullSchedule()` to fetch that route with the raw CDN path as fallback, (D3) move the season-rank lookup on the game page (the highest-traffic route) out of its critical `Promise.all` into a streamed Suspense child.

**Ordering constraint:** D1 → D2 → D3, strictly. D2 edits code D1 creates; D3 relies on D2 making `getFullSchedule` cheap.

**A3 interaction (same file):** Task A3 (another group) adds cache-poisoning guards to `fetchScheduleBlocking`/`fetchScheduleInBackground` in `src/lib/api.ts` — "only commit non-empty `gameDates`; keep stale cache on failure". If A3 landed before you, those two function bodies will differ slightly from the "current code" quoted below. **Replace the entire function bodies regardless** (anchor on the function signature lines, which A3 does not change). The new code below preserves A3's guard semantics — the non-empty check lives inside `getRawScheduleDates`, and the stale-cache fallback stays in `fetchScheduleBlocking`.

---

### Task D1: Project the schedule feed to declared fields; expose raw fetch + seasonYear

**Files:**
- Modify: `src/lib/api.ts`
- Test: `src/lib/api-slim.test.ts` (create)

- [ ] **Step 1: Read the current schedule machinery.** Read `src/lib/api.ts` — the `ScheduleGame`/`ScheduleDate` interfaces (~lines 139–180) and the schedule cache block (`scheduleCache` / `getFullSchedule` / `fetchScheduleBlocking` / `fetchScheduleInBackground`, ~lines 199–283). Note that `fetchWithRetry` already exists in this file — reuse it, do not redefine it.

- [ ] **Step 2: Write the failing test.** Create `src/lib/api-slim.test.ts` with exactly:

```ts
import { describe, it, expect } from "vitest";
import {
  projectScheduleGame,
  projectScheduleDates,
  type RawScheduleGame,
  type RawScheduleTeam,
  type RawScheduleDate,
} from "./api";

function rawTeam(tricode: string, id: number, extra: Record<string, unknown> = {}): RawScheduleTeam {
  return {
    teamId: id,
    teamTricode: tricode,
    teamName: "Team",
    teamCity: "City",
    teamSlug: "team",
    score: 112,
    wins: 50,
    losses: 32,
    seed: 3,
    ...extra,
  };
}

function rawGame(extra: Partial<RawScheduleGame> = {}): RawScheduleGame {
  return {
    gameId: "0022500001",
    gameStatus: 3,
    gameStatusText: "Final",
    gameCode: "20251021/GSWLAL",
    gameDateTimeUTC: "2025-10-22T02:00:00Z",
    homeTeam: rawTeam("LAL", 1610612747, { inBonus: null, timeoutsRemaining: 2 }),
    awayTeam: rawTeam("GSW", 1610612744),
    seriesText: "",
    ifNecessary: false,
    broadcasters: { nationalBroadcasters: [{ broadcasterDisplay: "ESPN" }] },
    gameLabel: "",
    gameSubLabel: "",
    seriesGameNumber: "",
    weekNumber: 5,
    postponedStatus: "A",
    gameSubtype: "",
    ...extra,
  };
}

describe("projectScheduleGame", () => {
  it("keeps exactly the declared ScheduleGame keys and drops raw-feed noise", () => {
    const out = projectScheduleGame(rawGame());
    expect(Object.keys(out).sort()).toEqual(
      ["awayTeam", "gameCode", "gameDateTimeUTC", "gameId", "gameStatus", "gameStatusText", "homeTeam", "ifNecessary", "seriesText"].sort()
    );
    expect(Object.keys(out.homeTeam).sort()).toEqual(
      ["losses", "score", "seed", "teamCity", "teamId", "teamName", "teamSlug", "teamTricode", "wins"].sort()
    );
  });

  it("preserves team periods when present and omits the key when absent", () => {
    const g = rawGame();
    g.homeTeam.periods = [{ period: 1, periodType: "REGULAR", score: 28 }];
    const out = projectScheduleGame(g);
    expect(out.homeTeam.periods).toEqual([{ period: 1, periodType: "REGULAR", score: 28 }]);
    expect("periods" in out.awayTeam).toBe(false);
  });

  it("projects pointsLeaders entries down to the declared PointsLeader keys", () => {
    const out = projectScheduleGame(
      rawGame({
        pointsLeaders: [
          { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32, teamName: "Lakers", teamCity: "Los Angeles" },
        ],
      })
    );
    expect(out.pointsLeaders).toEqual([
      { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32 },
    ]);
  });

  it("passes through declared optional arena fields for pre-game previews", () => {
    const out = projectScheduleGame(rawGame({ arenaName: "Crypto.com Arena", arenaCity: "Los Angeles" }));
    expect(out.arenaName).toBe("Crypto.com Arena");
    expect(out.arenaCity).toBe("Los Angeles");
  });
});

describe("projectScheduleDates", () => {
  it("maps gameDate + games and drops date-level extras", () => {
    const out = projectScheduleDates([
      { gameDate: "10/21/2025 00:00:00", games: [rawGame()], leagueId: "00" },
    ]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(["gameDate", "games"]);
    expect(out[0].games[0].gameId).toBe("0022500001");
  });

  it("keeps a full 1300-game season under 2MB when serialized", () => {
    const dates: RawScheduleDate[] = Array.from({ length: 163 }, (_, d) => ({
      gameDate: "10/21/2025 00:00:00",
      games: Array.from({ length: 8 }, (_, i) =>
        rawGame({
          gameId: `00225${String(d * 8 + i).padStart(5, "0")}`,
          pointsLeaders: [
            { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32 },
          ],
        })
      ),
    }));
    const projected = projectScheduleDates(dates);
    expect(projected.reduce((n, gd) => n + gd.games.length, 0)).toBe(1304);
    expect(JSON.stringify(projected).length).toBeLessThan(2 * 1024 * 1024);
  });
});
```

- [ ] **Step 3: Run the test — expect FAIL.** `npx vitest run src/lib/api-slim.test.ts` — fails because `projectScheduleGame` etc. don't exist yet.

- [ ] **Step 4: Declare the arena fields on `ScheduleGame`.** In `src/lib/api.ts`, find (end of the `ScheduleGame` interface):

```ts
  seriesText?: string;
  ifNecessary?: boolean;
  // Today's games (live scoreboard): per-team featured leaders w/ PTS+REB+AST.
  gameLeaders?: { homeLeaders?: GameLeader; awayLeaders?: GameLeader };
  // Past finished games (schedule cache): game-high scorer(s), points only.
  pointsLeaders?: PointsLeader[];
}
```

Replace with:

```ts
  seriesText?: string;
  ifNecessary?: boolean;
  // Today's games (live scoreboard): per-team featured leaders w/ PTS+REB+AST.
  gameLeaders?: { homeLeaders?: GameLeader; awayLeaders?: GameLeader };
  // Past finished games (schedule cache): game-high scorer(s), points only.
  pointsLeaders?: PointsLeader[];
  // Declared (not just cast-through) because the game-page pre-game preview
  // renders the venue — the slim projection would otherwise drop it.
  arenaName?: string;
  arenaCity?: string;
}
```

- [ ] **Step 5: Add the projection functions.** In `src/lib/api.ts`, find:

```ts
export interface ScheduleDate {
  gameDate: string;
  games: ScheduleGame[];
}
```

Insert immediately AFTER it:

```ts
// Raw feed rows are the declared shape plus dozens of undeclared keys
// (broadcasters, gameLabel, weekNumber, ...) — modeled as open records so
// projection call sites and test fixtures need no casts.
export type RawScheduleTeam = ScheduleGame["homeTeam"] & Record<string, unknown>;
export type RawScheduleGame = Omit<ScheduleGame, "homeTeam" | "awayTeam" | "pointsLeaders"> & {
  homeTeam: RawScheduleTeam;
  awayTeam: RawScheduleTeam;
  pointsLeaders?: (PointsLeader & Record<string, unknown>)[];
} & Record<string, unknown>;
export interface RawScheduleDate {
  gameDate: string;
  games: RawScheduleGame[];
  [key: string]: unknown;
}

function projectScheduleTeam(t: RawScheduleTeam): ScheduleGame["homeTeam"] {
  return {
    teamId: t.teamId,
    teamTricode: t.teamTricode,
    teamName: t.teamName,
    teamCity: t.teamCity,
    teamSlug: t.teamSlug,
    score: t.score,
    wins: t.wins,
    losses: t.losses,
    seed: t.seed,
    ...(t.periods !== undefined ? { periods: t.periods } : {}),
  };
}

export function projectScheduleGame(raw: RawScheduleGame): ScheduleGame {
  return {
    gameId: raw.gameId,
    gameStatus: raw.gameStatus,
    gameStatusText: raw.gameStatusText,
    gameCode: raw.gameCode,
    gameDateTimeUTC: raw.gameDateTimeUTC,
    homeTeam: projectScheduleTeam(raw.homeTeam),
    awayTeam: projectScheduleTeam(raw.awayTeam),
    ...(raw.seriesText !== undefined ? { seriesText: raw.seriesText } : {}),
    ...(raw.ifNecessary !== undefined ? { ifNecessary: raw.ifNecessary } : {}),
    ...(raw.gameLeaders !== undefined ? { gameLeaders: raw.gameLeaders } : {}),
    ...(raw.pointsLeaders !== undefined
      ? {
          pointsLeaders: raw.pointsLeaders.map((p) => ({
            personId: p.personId,
            firstName: p.firstName,
            lastName: p.lastName,
            teamId: p.teamId,
            teamTricode: p.teamTricode,
            points: p.points,
          })),
        }
      : {}),
    ...(raw.arenaName !== undefined ? { arenaName: raw.arenaName } : {}),
    ...(raw.arenaCity !== undefined ? { arenaCity: raw.arenaCity } : {}),
  };
}

export function projectScheduleDates(rawDates: RawScheduleDate[]): ScheduleDate[] {
  return rawDates.map((d) => ({ gameDate: d.gameDate, games: d.games.map(projectScheduleGame) }));
}
```

- [ ] **Step 6: Run the test — expect PASS.** `npx vitest run src/lib/api-slim.test.ts`.

- [ ] **Step 7: Add `scheduleSeasonYear` tracking.** In `src/lib/api.ts`, find:

```ts
let scheduleInflight: Promise<ScheduleDate[]> | null = null;
let scheduleRevalidating = false;
```

Replace with:

```ts
let scheduleInflight: Promise<ScheduleDate[]> | null = null;
let scheduleRevalidating = false;
let scheduleSeasonYear: string | null = null;

// Start year of the season the cached feed covers, e.g. "2025". The feed
// reports "2025-26"; normalized to the 4-digit start year so rollover
// checks are simple string compares.
export function getScheduleSeasonYear(): string | null {
  return scheduleSeasonYear;
}
```

- [ ] **Step 8: Add `getRawScheduleDates`.** In `src/lib/api.ts`, find the end of `fetchWithRetry`:

```ts
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }
  throw lastErr;
}
```

Insert immediately AFTER it:

```ts
// Direct download of the 11MB scheduleLeagueV2 feed, projected down to the
// declared ScheduleGame fields immediately after parse. cache: "no-store" is
// intentional — an 11MB body exceeds the data-cache entry limit, so the old
// revalidate hint never cached anything and only misled readers. Used ONLY
// by /api/schedule-slim and as the fallback when that route fails.
export async function getRawScheduleDates(): Promise<{ seasonYear: string; dates: ScheduleDate[] }> {
  const res = await fetchWithRetry(
    `${CDN_BASE}/staticData/scheduleLeagueV2.json`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`schedule fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  const rawDates: RawScheduleDate[] = data.leagueSchedule?.gameDates || [];
  const seasonYear = String(data.leagueSchedule?.seasonYear ?? "").slice(0, 4);
  const dates = projectScheduleDates(rawDates);
  if (dates.length > 0) {
    scheduleCache = { data: dates, ts: Date.now() };
    scheduleSeasonYear = seasonYear;
  }
  return { seasonYear, dates };
}
```

- [ ] **Step 9: Rework the two internal fetchers onto the raw path.** In `src/lib/api.ts`, replace the ENTIRE bodies of `fetchScheduleBlocking` and `fetchScheduleInBackground` (anchor on the signature lines `async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {` and `function fetchScheduleInBackground() {`; see the A3 caveat in the group header — the pre-A3 bodies are:

```ts
async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const res = await fetchWithRetry(
      `${CDN_BASE}/staticData/scheduleLeagueV2.json`,
      { headers: HEADERS, next: { revalidate: 7200 } }
    );
    if (!res.ok) {
      console.error(`schedule fetch failed: HTTP ${res.status}`);
      return scheduleCache?.data || [];
    }
    const data = await res.json();
    const dates = data.leagueSchedule?.gameDates || [];
    scheduleCache = { data: dates, ts: Date.now() };
    return dates;
  } catch (err) {
    console.error("schedule fetch error:", err);
    return scheduleCache?.data || [];
  } finally {
    scheduleInflight = null;
  }
}

function fetchScheduleInBackground() {
  fetchWithRetry(`${CDN_BASE}/staticData/scheduleLeagueV2.json`, { headers: HEADERS, next: { revalidate: 7200 } })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data) {
        const dates = data.leagueSchedule?.gameDates || [];
        scheduleCache = { data: dates, ts: Date.now() };
      }
    })
    .catch((err) => console.error("schedule revalidate error:", err))
    .finally(() => { scheduleRevalidating = false; });
}
```

— possibly with A3's non-empty guards added). New code for both functions:

```ts
async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const { dates } = await getRawScheduleDates();
    return dates.length > 0 ? dates : scheduleCache?.data || [];
  } catch (err) {
    console.error("schedule fetch error:", err);
    return scheduleCache?.data || [];
  } finally {
    scheduleInflight = null;
  }
}

function fetchScheduleInBackground() {
  getRawScheduleDates()
    .catch((err) => console.error("schedule revalidate error:", err))
    .finally(() => { scheduleRevalidating = false; });
}
```

(The non-empty commit guard and cache write now live inside `getRawScheduleDates` — A3's semantics are preserved: empty or failed fetches never overwrite a good stale cache. `getFullSchedule` and `getScheduleAge` are NOT modified in this task.)

- [ ] **Step 10: Verify.** `npx tsc --noEmit` (expect 0 errors) and `npx vitest run` (all green — the full suite, not just the new file).

- [ ] **Step 11: Commit.**
```
git add src/lib/api.ts src/lib/api-slim.test.ts
git commit -m "perf(schedule): project 11MB feed to declared fields, expose raw fetch + seasonYear"
```

---

### Task D2: `/api/schedule-slim` route + rewire `getFullSchedule` through it

**Files:**
- Create: `src/app/api/schedule-slim/route.ts`
- Modify: `src/lib/api.ts`, `.env.example`

**CAUTION — recursion:** the route must ONLY call the raw/cached-feed path (`getCachedScheduleFeed` → `getRawScheduleDates`). It must NEVER call `getFullSchedule`, because after this task `getFullSchedule` fetches this route over HTTP — that would be infinite recursion. Similarly, the route-side cold path uses its own inflight promise (`rawFeedInflight`), distinct from `scheduleInflight`: on a single-process server (dev), `getFullSchedule`'s inflight awaits the route's HTTP response, and if the route handler awaited that same promise it would deadlock.

- [ ] **Step 1: Skim the Next 16 route-handler doc.** Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (this project's Next fork has breaking changes; per AGENTS.md, verify before writing route code). Confirm: GET route handlers are dynamic by default (no config export needed), and `NextResponse.json(body, { headers })` is the response idiom (matches existing routes like `src/app/api/standings/route.ts`).

- [ ] **Step 2: Add `internalBaseUrl` + `getCachedScheduleFeed` to `src/lib/api.ts`.** Find (added in D1):

```ts
export function getScheduleSeasonYear(): string | null {
  return scheduleSeasonYear;
}
```

Insert immediately AFTER it:

```ts
// Absolute origin for server-side self-fetches. No env pattern existed before
// this (sitemap/robots hardcode the prod domain): NEXT_PUBLIC_SITE_URL wins so
// prod self-fetches share the public CDN cache; VERCEL_PROJECT_PRODUCTION_URL
// covers Vercel with zero config; localhost covers dev and `next build`.
function internalBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

// Feed accessor for /api/schedule-slim ONLY. Uses its own inflight promise —
// getFullSchedule awaits this route over HTTP, so sharing scheduleInflight
// would deadlock the route against its own caller on a single-process server.
let rawFeedInflight: Promise<{ seasonYear: string; dates: ScheduleDate[] }> | null = null;

export async function getCachedScheduleFeed(): Promise<{ seasonYear: string; dates: ScheduleDate[] }> {
  if (scheduleCache) {
    if (Date.now() - scheduleCache.ts > SCHEDULE_TTL && !scheduleRevalidating) {
      scheduleRevalidating = true;
      getRawScheduleDates()
        .catch((err) => console.error("schedule revalidate error:", err))
        .finally(() => { scheduleRevalidating = false; });
    }
    return { seasonYear: scheduleSeasonYear ?? "", dates: scheduleCache.data };
  }
  if (!rawFeedInflight) {
    rawFeedInflight = (async () => {
      try {
        return await getRawScheduleDates();
      } catch (err) {
        console.error("schedule fetch error:", err);
        return { seasonYear: scheduleSeasonYear ?? "", dates: scheduleCache?.data ?? [] };
      } finally {
        rawFeedInflight = null;
      }
    })();
  }
  return rawFeedInflight;
}
```

Note: this references `SCHEDULE_TTL`, `scheduleCache`, `scheduleRevalidating` — all declared ABOVE this insertion point in the current file order? No — they are declared in the block that contains `getScheduleSeasonYear`, which is fine (module-level `let`/`const` in the same file; `SCHEDULE_TTL` is a `const` declared before this point). Verify with tsc in Step 6.

- [ ] **Step 3: Create the route.** Create `src/app/api/schedule-slim/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCachedScheduleFeed } from "@/lib/api";

// Serves the projected (sub-2MB) schedule so pages can pull it through the
// Next data cache instead of every lambda downloading the 11MB CDN feed.
// MUST NOT call getFullSchedule — that function fetches this route.
export async function GET() {
  const feed = await getCachedScheduleFeed();
  if (feed.dates.length === 0) {
    // Never let an empty answer stick in the CDN for 2h — callers fall back
    // to the direct CDN fetch on non-200.
    return NextResponse.json(feed, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400" },
  });
}
```

- [ ] **Step 4: Rewire the consumer path in `src/lib/api.ts`.** Replace the two functions produced by D1 Step 9. Find:

```ts
async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const { dates } = await getRawScheduleDates();
    return dates.length > 0 ? dates : scheduleCache?.data || [];
  } catch (err) {
    console.error("schedule fetch error:", err);
    return scheduleCache?.data || [];
  } finally {
    scheduleInflight = null;
  }
}

function fetchScheduleInBackground() {
  getRawScheduleDates()
    .catch((err) => console.error("schedule revalidate error:", err))
    .finally(() => { scheduleRevalidating = false; });
}
```

Replace with:

```ts
// Consumer path: prefer the slim route — its <2MB response is eligible for
// the shared Next data cache, so warm regions skip the 11MB download
// entirely. Any failure (preview-deploy protection, build-time self-fetch,
// route 503) falls back to the direct CDN fetch — never worse than before.
async function fetchSlimRouteOnce(): Promise<ScheduleDate[] | null> {
  try {
    const res = await fetch(`${internalBaseUrl()}/api/schedule-slim`, { next: { revalidate: 7200 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { seasonYear?: string; dates?: ScheduleDate[] };
    if (!Array.isArray(body.dates) || body.dates.length === 0) return null;
    scheduleCache = { data: body.dates, ts: Date.now() };
    if (body.seasonYear) scheduleSeasonYear = body.seasonYear;
    return body.dates;
  } catch {
    return null;
  }
}

async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const viaRoute = await fetchSlimRouteOnce();
    if (viaRoute) return viaRoute;
    const { dates } = await getRawScheduleDates();
    return dates.length > 0 ? dates : scheduleCache?.data || [];
  } catch (err) {
    console.error("schedule fetch error:", err);
    return scheduleCache?.data || [];
  } finally {
    scheduleInflight = null;
  }
}

function fetchScheduleInBackground() {
  (async () => {
    const viaRoute = await fetchSlimRouteOnce();
    if (!viaRoute) await getRawScheduleDates();
  })()
    .catch((err) => console.error("schedule revalidate error:", err))
    .finally(() => { scheduleRevalidating = false; });
}
```

`getFullSchedule()` itself is untouched — its signature and cache-hit/SWR/inflight logic already delegate to these two functions. `getScheduleAge()` semantics are preserved: `scheduleCache.ts` is refreshed on every successful commit, whichever path fed it.

- [ ] **Step 5: Document the new env var.** In `.env.example`, append at the end of the file:

```
# Absolute site origin for server-side self-fetches (optional — defaults to
# the Vercel production URL, or http://localhost:3000 in dev)
NEXT_PUBLIC_SITE_URL=
```

- [ ] **Step 6: Verify.** `npx tsc --noEmit` (0 errors), `npx vitest run` (all green).

- [ ] **Step 7: Manual check.** Run `npm run dev`, then:
  - `curl -s http://localhost:3000/api/schedule-slim | head -c 300` — expect JSON starting `{"seasonYear":"2025","dates":[{"gameDate":...` (seasonYear is the normalized 4-digit start year).
  - Load `/`, `/standings`, `/power-rankings` in a browser — all render with data.
  - Load a pre-game `/game/<id>` if any scheduled game exists (offseason: any gameStatus 1 game from the feed) — the venue line in the preview still renders (arena fields survived projection).

- [ ] **Step 8: Commit.**
```
git add src/lib/api.ts src/app/api/schedule-slim/route.ts .env.example
git commit -m "perf(schedule): cacheable /api/schedule-slim route; getFullSchedule rides the data cache"
```

---

### Task D3: Stream the game-page season-rank badge off the critical path

**Files:**
- Create: `src/app/game/[id]/_components/SeasonRankBadge.tsx`
- Modify: `src/app/game/[id]/page.tsx`, `src/app/game/[id]/_components/GameHeadlines.tsx`

**Context:** `src/app/game/[id]/page.tsx` awaits `getSeasonRank(id)` inside its critical `Promise.all`; `getSeasonRank` (in `src/lib/season-ranks.ts`) walks the entire schedule via `getFullSchedule()`, so on a cold lambda the page's first byte waits on the schedule. The rank renders as small badge chips inside `GameHeadlines`. Move the fetch into an async server component streamed via `<Suspense fallback={null}>`, preserving the badge markup exactly. `generateMetadata`'s `getFullSchedule().catch(() => [])` fallback stays as-is (now cheap via D2).

- [ ] **Step 1: Create `SeasonRankBadge.tsx`.** Create `src/app/game/[id]/_components/SeasonRankBadge.tsx` (the badge logic and markup are ported verbatim from the current `GameHeadlines.tsx`):

```tsx
import { getSeasonRank } from "@/lib/season-ranks";
import type { Translations } from "@/locales";

// Only surface ranks within top 10 — past that "the 47th-closest game" is noise.
const RANK_THRESHOLD = 10;

export default async function SeasonRankBadge({ gameId, t }: { gameId: string; t: Translations }) {
  const seasonRank = await getSeasonRank(gameId).catch(() => null);
  if (!seasonRank) return null;

  // Pick at most two notable ranks. A close game can't also be a blowout, so
  // those two are mutually exclusive by construction; scoring rank is orthogonal.
  type Badge = { kind: "scoring" | "blowout" | "close"; rank: number; tone: string };
  const badges: Badge[] = [];
  if (seasonRank.totalPointsRank <= RANK_THRESHOLD) {
    badges.push({ kind: "scoring", rank: seasonRank.totalPointsRank, tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  }
  if (seasonRank.marginRank <= RANK_THRESHOLD) {
    badges.push({ kind: "blowout", rank: seasonRank.marginRank, tone: "bg-danger/10 text-danger border-danger/30" });
  } else if (seasonRank.closeRank <= RANK_THRESHOLD) {
    badges.push({ kind: "close", rank: seasonRank.closeRank, tone: "bg-success/10 text-success border-success/30" });
  }
  if (badges.length === 0) return null;

  const badgeLabel = (kind: Badge["kind"]) =>
    kind === "scoring" ? t.gameDetail.seasonRankScoring
      : kind === "blowout" ? t.gameDetail.seasonRankBlowout
      : t.gameDetail.seasonRankClose;

  return (
    <>
      {badges.map((b) => (
        <div
          key={b.kind}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${b.tone}`}
        >
          <span className="font-bold tabular-nums">#{b.rank}</span>
          <span>{badgeLabel(b.kind)} {t.gameDetail.seasonRankOf}</span>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Convert `GameHeadlines` to a badge slot — imports.** In `src/app/game/[id]/_components/GameHeadlines.tsx`, find:

```ts
import type { BoxScoreTeam, ShotAction } from "@/lib/api";
import type { SeasonRank } from "@/lib/season-ranks";
```

Replace with:

```ts
import type { ReactNode } from "react";
import type { BoxScoreTeam, ShotAction } from "@/lib/api";
```

- [ ] **Step 3: `GameHeadlines` — props.** In the same file, find:

```ts
// Only surface ranks within top 10 — past that "the 47th-closest game" is noise.
const RANK_THRESHOLD = 10;

export default function GameHeadlines({
  homeTeam,
  awayTeam,
  shots,
  seasonRank,
  t,
}: {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
  shots: ShotAction[];
  seasonRank: SeasonRank | null;
  t: Translations;
}) {
```

Replace with:

```ts
export default function GameHeadlines({
  homeTeam,
  awayTeam,
  shots,
  seasonRankBadges,
  t,
}: {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
  shots: ShotAction[];
  seasonRankBadges?: ReactNode;
  t: Translations;
}) {
```

- [ ] **Step 4: `GameHeadlines` — delete the moved badge logic.** In the same file, find and DELETE this entire block (it now lives in `SeasonRankBadge.tsx`):

```ts
  // Pick at most two notable ranks. A close game can't also be a blowout, so
  // those two are mutually exclusive by construction; scoring rank is orthogonal.
  type Badge = { kind: "scoring" | "blowout" | "close"; rank: number; tone: string };
  const badges: Badge[] = [];
  if (seasonRank) {
    if (seasonRank.totalPointsRank <= RANK_THRESHOLD) {
      badges.push({ kind: "scoring", rank: seasonRank.totalPointsRank, tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
    }
    if (seasonRank.marginRank <= RANK_THRESHOLD) {
      badges.push({ kind: "blowout", rank: seasonRank.marginRank, tone: "bg-danger/10 text-danger border-danger/30" });
    } else if (seasonRank.closeRank <= RANK_THRESHOLD) {
      badges.push({ kind: "close", rank: seasonRank.closeRank, tone: "bg-success/10 text-success border-success/30" });
    }
  }
  const badgeLabel = (kind: Badge["kind"]) =>
    kind === "scoring" ? t.gameDetail.seasonRankScoring
      : kind === "blowout" ? t.gameDetail.seasonRankBlowout
      : t.gameDetail.seasonRankClose;
```

- [ ] **Step 5: `GameHeadlines` — render the slot.** In the same file, find:

```tsx
        {badges.map((b) => (
          <div
            key={b.kind}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${b.tone}`}
          >
            <span className="font-bold tabular-nums">#{b.rank}</span>
            <span>{badgeLabel(b.kind)} {t.gameDetail.seasonRankOf}</span>
          </div>
        ))}
```

Replace with:

```tsx
        {seasonRankBadges}
```

(The Suspense-streamed badges land in exactly the same position inside the `flex flex-wrap items-center gap-2 mb-3` row, after the pace chip.)

- [ ] **Step 6: `page.tsx` — imports.** In `src/app/game/[id]/page.tsx`, find and DELETE:

```ts
import { getSeasonRank } from "@/lib/season-ranks";
```

Then find:

```ts
import GameHeadlines from "./_components/GameHeadlines";
```

Replace with:

```ts
import GameHeadlines from "./_components/GameHeadlines";
import SeasonRankBadge from "./_components/SeasonRankBadge";
```

- [ ] **Step 7: `page.tsx` — shrink the critical `Promise.all`.** Find:

```ts
  // Box score + player index + raw PBP + season-wide rank in parallel.
  // PBP comes straight from cdn.nba.com (the only place exposing score events
  // with clocks); shots are derived from the same payload — one download, not
  // two. Season rank reads the schedule cache only — no extra fetch.
  const [boxScore, playerIndex, pbpActions, seasonRank] = await Promise.all([
    getBoxScore(id),
    getPlayerIndex().catch(() => []),
    fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${id}.json`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://www.nba.com/" },
      next: { revalidate: 60 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.game?.actions || [])
      .catch(() => []),
    getSeasonRank(id).catch(() => null),
  ]);
```

Replace with:

```ts
  // Box score + player index + raw PBP in parallel.
  // PBP comes straight from cdn.nba.com (the only place exposing score events
  // with clocks); shots are derived from the same payload — one download, not
  // two. Season rank streams later via <SeasonRankBadge> — it walks the full
  // schedule and must not block first byte.
  const [boxScore, playerIndex, pbpActions] = await Promise.all([
    getBoxScore(id),
    getPlayerIndex().catch(() => []),
    fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${id}.json`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://www.nba.com/" },
      next: { revalidate: 60 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.game?.actions || [])
      .catch(() => []),
  ]);
```

- [ ] **Step 8: `page.tsx` — pass the streamed slot.** Find:

```tsx
      {/* Leaders/headlines render for live games too — seasonRank is final-only
          (mid-game season ranks would mislead), so suppress it when not final. */}
      {isLiveOrFinal && (
        <GameHeadlines homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} shots={shots} seasonRank={isFinal ? seasonRank : null} t={t} />
      )}
```

Replace with:

```tsx
      {/* Leaders/headlines render for live games too — season rank is final-only
          (mid-game season ranks would mislead), so suppress it when not final. */}
      {isLiveOrFinal && (
        <GameHeadlines
          homeTeam={boxScore.homeTeam}
          awayTeam={boxScore.awayTeam}
          shots={shots}
          seasonRankBadges={
            isFinal ? (
              <Suspense fallback={null}>
                <SeasonRankBadge gameId={id} t={t} />
              </Suspense>
            ) : null
          }
          t={t}
        />
      )}
```

(`Suspense` is already imported at the top of `page.tsx` — do not re-import.)

- [ ] **Step 9: Verify.** `npx tsc --noEmit` (0 errors), `npx vitest run` (green). Manual: `npm run dev`, open a FINISHED game's `/game/<id>` (pick any gameId from `/standings`-era data or the home page's past dates, e.g. via `/?date=2026-06-19`) — the Game Summary tile renders immediately, and for a game with a top-10 total/margin/closeness a `#N` badge chip appears next to the pace chip (may pop in a beat later — that's the stream working). Confirm no hydration warnings in the terminal.

- [ ] **Step 10: Commit.**
```
git add "src/app/game/[id]/page.tsx" "src/app/game/[id]/_components/GameHeadlines.tsx" "src/app/game/[id]/_components/SeasonRankBadge.tsx"
git commit -m "perf(game): stream season-rank badges via Suspense off the critical path"
```

---

### Task E: 字体裁剪 (font weight audit)

**Files:**
- Modify: `src/app/layout.tsx` (comment only, expected outcome)

**Context:** `src/app/layout.tsx` loads Fira Sans weights 300/400/500/600/700 (`--font-geist-sans`, mapped to `font-sans`/body in `globals.css` lines 133/148) and Fira Code 300/500/600/700 (`--font-geist-mono`, mapped to `font-mono`, line 176 — with an existing audit comment explaining why 400 was dropped). The task: delete only truly-unused weights. **The audit was already executed on 2026-07-08 with the real commands and counts below — the result is that EVERY loaded weight of both faces is in active use, so the honest outcome is "no safe cut": document the audit in layout.tsx and change nothing else.** Re-run the commands to confirm nothing drifted; only if a weight shows ZERO usages do you take the conditional cut branch in Step 3.

- [ ] **Step 1: Re-run the usage audit.** From the repo root, run and compare against these reference counts (small drift is fine; a drop to zero is what matters):

```
grep -rn "font-light" src | wc -l          # ref: 106 total
grep -rn "font-light" src | grep -v "font-mono" | wc -l   # ref: 5  → Fira Sans 300 IS used
grep -rn "font-medium" src | wc -l         # ref: 219 (only 15 co-occur with font-mono) → Sans 500 used
grep -rn "font-semibold" src | wc -l       # ref: 160 (9 mono) → Sans 600 used
grep -rn "font-bold" src | wc -l           # ref: 329 (115 mono) → Sans 700 used
grep -rn "font-light" src | grep "font-mono" | wc -l      # ref: 101 → Fira Code 300 used
grep -rn "font-medium" src | grep "font-mono" | wc -l     # ref: 15  → Fira Code 500 used
grep -rn "font-semibold" src | grep "font-mono" | wc -l   # ref: 9   → Fira Code 600 used
grep -rn "font-bold" src | grep "font-mono" | wc -l       # ref: 115 → Fira Code 700 used
grep -rhoE 'fontWeight: ?[^,}]+' src | sort | uniq -c     # ref: 700×19, 800×12, 200×7, 300×9, 600×2, 500×1, 400×1, "bold"×1
grep -n "font-weight" src/app/globals.css                  # ref: h1 { font-weight: 600 } + a font-weight: 500 rule
```

Interpretation notes (as found on 2026-07-08): Fira Sans 400 is the body default (`globals.css` line 148) — always used. The 5 non-mono `font-light` hits are real sans usages (big stat numerals in `src/components/TodayStars.tsx`, `src/app/streaks/page.tsx`, `src/app/favorites/FavoritesDashboard.tsx`, `src/app/by-country/page.tsx`). The mono co-occurrence counts are lower bounds (weight utilities also inherit into `font-mono` subtrees), but a lower bound > 0 already proves the weight is needed. The inline `fontWeight: 800/200` hits live in SVG chart text and OG-image routes — OG images load their own fonts, and 200/800 were never in the next/font config, so they are pre-existing synthetic renders, NOT a reason to keep or cut anything here.

- [ ] **Step 2: Confirm the verdict.** Every loaded weight of both faces has non-zero usage → per the design spec (`docs/superpowers/specs/2026-07-08-batch1-hardening-design.md` §E), the correct outcome is **no cut — document and skip**. Do NOT remove any weight to force a byte win; dropping any of them would trigger synthetic faux-weight rendering.

- [ ] **Step 3: Document the audit in `layout.tsx`.** In `src/app/layout.tsx`, find:

```ts
const firaSans = Fira_Sans({
  variable: "--font-geist-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
```

Replace with:

```ts
// Audit 2026-07-08 (batch-1 font trim): every loaded weight has real sans
// usage — 300 on big stat numerals (TodayStars/streaks/by-country), 400 as
// the body default, 500 via 200+ font-medium, 600 via font-semibold plus the
// globals.css h1 rule, 700 via 300+ font-bold. Nothing safe to cut. The
// fontWeight 200/800 in SVG charts and OG images render synthetic/own fonts
// and were never served from here.
const firaSans = Fira_Sans({
  variable: "--font-geist-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
```

**Conditional branch — only if Step 1 showed a weight at ZERO usages** (both the class greps AND globals.css AND non-OG inline fontWeight): remove just that weight string from the corresponding `weight: [...]` array (adjusting the comment to say which weight was cut and why), then `npm run dev` and compare home page, a finished `/game/<id>`, and `/stats` tables against production side-by-side. Rollback trigger: any text that previously used the cut weight now renders synthetically thickened/thinned (faux-bold looks smeared, especially on the mono tabular numbers) — restore the weight and fall back to the comment-only outcome.

- [ ] **Step 4: Verify.** `npx tsc --noEmit` (0 errors). No visual check needed for the comment-only outcome (zero functional change); if the conditional cut branch was taken, do the before/after browser comparison described above before committing.

- [ ] **Step 5: Commit.**
```
git add src/app/layout.tsx
git commit -m "chore(fonts): document sans weight audit - all five loaded weights in use"
```

(If the conditional cut branch was taken instead, use: `perf(fonts): drop unused Fira <Sans|Code> <weight> weight after usage audit`.)
