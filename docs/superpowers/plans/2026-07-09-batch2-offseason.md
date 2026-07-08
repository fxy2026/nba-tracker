# Batch 2: Offseason Content Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fill the dead July home page and add an offseason content layer — FA transaction tracker depth, a /draft/2026 page, a 2025-26 season recap page, and a home offseason hero — plus a defensive gameId-prefix fix. All from data sources verified live on 2026-07-09.

**Architecture:** New pure libs (games predicates, transaction parsing, draft projection, season-recap aggregation) are TDD-tested; new server pages follow the momentum.tsx template and register in the three discovery surfaces; ESPN data is fetched server-side directly (mirroring injuries/page.tsx) with AbortSignal timeout + shape guard.

**Tech Stack:** Next.js 16 App Router (all routes dynamic SSR), React 19, TypeScript strict, vitest 4.

**Spec:** docs/superpowers/specs/2026-07-09-batch2-offseason-design.md

**Deferred (data unavailable — NOT in this plan):** team salary/cap sheet (BDL contracts need GOAT tier; local key is free → 401) and Summer League live scoreboard (CDN has not published 2026-27). See spec.

**Task dependency / build order (MUST respect):**
- T1, T2, T3, T4 are mutually independent and can land in any order.
- T5 (home hero) cross-links /draft/2026 (T3) and /season/2025-26 (T4) as plain hrefs — they compile but 404 until T3/T4 land. **Build T5 LAST.**
- T4 depends only on the STABLE games.ts exports isRegular/isPlayoff (unaffected by T1); no ordering dep on T1.
- Cross-task facts baked in by the authors (do NOT re-litigate): ESPN team/headshot images use a.espncdn.com → plain <img> + eslint-disable (not next/image, keeps lint 0/0 baseline); ESPN athlete.id ≠ NBA personId → name-match linking only; ESPN athlete.position is an object {id} resolved via positions[] map; server components fetch ESPN directly (not via own /api route — self-fetch needs absolute base URL, fragile on preview); T2 count chips are kind-based (ESPN type/player fields are always empty); /api/news ?limit only affects the no-q general feed (q-path stays 5-capped); T5 re-derives the champion locally rather than importing T4 season-recap.ts (compile independence).
- Edit anchors are snippets, not line numbers; if an anchor drifts, locate the equivalent code and adapt minimally.

---
### Task T1: games.ts prefix defense (isSummerLeague + isCup + isCountedSeason allowlist)

**Files:**
- Create: `src/lib/games.test.ts`
- Modify: `src/lib/games.ts`
- Test: `src/lib/games.test.ts`

Context: `src/lib/games.ts` currently defines `isCountedSeason(gameId) = !isPreseason(gameId) && !isAllStar(gameId)`. This wrongly returns `true` for Summer League gameIds (first 2 chars ∈ {13,14,15,16}) and NBA Cup finals (first 3 chars === "006"). Once the CDN publishes the 2026-27 slate, those would pollute every counted-season consumer (`getRecentForm` in this file, plus `src/lib/best-of-night.ts`, `src/lib/follow-digest.ts`, `src/app/records/page.tsx`). This task is pure defense: add `isSummerLeague` + `isCup` and rewrite `isCountedSeason` as an explicit allowlist. The current feed contains no 13-16/006 prefixes, so no runtime behavior changes today — this is verified below in Step 5.

- [ ] **Step 1: Write the failing test.** Create `src/lib/games.test.ts` with the full contents below. It covers every required prefix case (regular/playoff/playin → counted true; preseason/allstar → false; summer league → counted false + `isSummerLeague` true; cup → counted false + `isCup` true) plus the individual predicates. It imports `isCup` and `isSummerLeague`, which do not exist yet, so it must fail.

```ts
import { describe, it, expect } from "vitest";
import {
  isPreseason,
  isRegular,
  isAllStar,
  isPlayoff,
  isPlayIn,
  isCup,
  isSummerLeague,
  isCountedSeason,
} from "./games";

describe("gameId prefix predicates", () => {
  it("classifies each game type by prefix", () => {
    expect(isPreseason("0012500001")).toBe(true);
    expect(isRegular("0022500001")).toBe(true);
    expect(isAllStar("0032500001")).toBe(true);
    expect(isPlayoff("0042500405")).toBe(true);
    expect(isPlayIn("0052500001")).toBe(true);
    expect(isCup("0062500001")).toBe(true);
  });

  it("isSummerLeague matches the 13/14/15/16 slates", () => {
    expect(isSummerLeague("1322600001")).toBe(true);
    expect(isSummerLeague("1422600001")).toBe(true);
    expect(isSummerLeague("1522600001")).toBe(true);
    expect(isSummerLeague("1622600001")).toBe(true);
    expect(isSummerLeague("0022500001")).toBe(false);
    expect(isSummerLeague("1222600001")).toBe(false);
    expect(isSummerLeague("1722600001")).toBe(false);
  });

  it("isCup only matches the 006 in-season-tournament prefix", () => {
    expect(isCup("0062500001")).toBe(true);
    expect(isCup("0022500001")).toBe(false);
  });
});

describe("isCountedSeason allowlist", () => {
  it("counts regular season, playoffs, and play-in", () => {
    expect(isCountedSeason("0022500001")).toBe(true);
    expect(isCountedSeason("0042500405")).toBe(true);
    expect(isCountedSeason("0052500001")).toBe(true);
  });

  it("excludes preseason and all-star exhibitions", () => {
    expect(isCountedSeason("0012500001")).toBe(false);
    expect(isCountedSeason("0032500001")).toBe(false);
  });

  it("excludes summer league and NBA Cup slates", () => {
    expect(isCountedSeason("1522600001")).toBe(false);
    expect(isCountedSeason("0062500001")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** Run `npx vitest run src/lib/games.test.ts`. It must fail: `isCup` and `isSummerLeague` are not exported from `./games`, so they resolve to `undefined` and the calls throw `isCup is not a function` (and the `isCountedSeason` summer-league/cup assertions would also fail once reached). Confirm the failure references those symbols before proceeding.

- [ ] **Step 3: Add the two new predicates and rewrite `isCountedSeason`.** In `src/lib/games.ts`, replace this exact current block (lines 3–13):

```ts
// gameId prefix predicates — the NBA encodes game type in first 3 digits.
// 001 = preseason, 002 = regular season, 003 = all-star, 004 = playoffs, 005 = play-in
export function isPreseason(gameId: string): boolean { return gameId.startsWith("001"); }
export function isRegular(gameId: string): boolean { return gameId.startsWith("002"); }
export function isAllStar(gameId: string): boolean { return gameId.startsWith("003"); }
export function isPlayoff(gameId: string): boolean { return gameId.startsWith("004"); }
export function isPlayIn(gameId: string): boolean { return gameId.startsWith("005"); }
// Exclude exhibitions (preseason + all-star — both contain non-NBA teams)
export function isCountedSeason(gameId: string): boolean {
  return !isPreseason(gameId) && !isAllStar(gameId);
}
```

with this exact new block:

```ts
// gameId prefix predicates — the NBA encodes game type in the leading digits.
// 001 = preseason, 002 = regular season, 003 = all-star, 004 = playoffs,
// 005 = play-in, 006 = NBA Cup final; 13/14/15/16 = Summer League slates.
export function isPreseason(gameId: string): boolean { return gameId.startsWith("001"); }
export function isRegular(gameId: string): boolean { return gameId.startsWith("002"); }
export function isAllStar(gameId: string): boolean { return gameId.startsWith("003"); }
export function isPlayoff(gameId: string): boolean { return gameId.startsWith("004"); }
export function isPlayIn(gameId: string): boolean { return gameId.startsWith("005"); }
export function isCup(gameId: string): boolean { return gameId.startsWith("006"); }
export function isSummerLeague(gameId: string): boolean {
  const p = gameId.slice(0, 2);
  return p === "13" || p === "14" || p === "15" || p === "16";
}
// Allowlist, not denylist: only games that count toward standings/form. Anything
// not explicitly regular/playoff/play-in (preseason, all-star, Cup, Summer League)
// is excluded, so unseen future prefixes never leak into counted consumers.
export function isCountedSeason(gameId: string): boolean {
  return isRegular(gameId) || isPlayoff(gameId) || isPlayIn(gameId);
}
```

- [ ] **Step 4: Run the test, expect PASS.** Run `npx vitest run src/lib/games.test.ts`. All three `describe` blocks must pass. If any assertion fails, fix the predicate (not the test) and re-run.

- [ ] **Step 5: Regression-check consumers.** (a) Run `npx tsc --noEmit` and confirm zero new errors — the new exports are additive and `isCountedSeason` keeps its `(gameId: string) => boolean` signature. (b) The 4 consumers (`src/lib/games.ts` `getRecentForm`, `src/lib/best-of-night.ts:58`, `src/lib/follow-digest.ts:60/96/160`, `src/app/records/page.tsx:43`) all use `isCountedSeason` only to filter finished games; none depend on 006/13-16 returning `true`, and the live CDN feed carries no such prefixes, so results are byte-identical today (the fix only changes classification of not-yet-published Summer League / Cup games). (c) Run `npx vitest run src/lib/follow-digest.test.ts` to confirm the largest downstream consumer's suite still passes.

- [ ] **Step 6: Commit.** `git add src/lib/games.ts src/lib/games.test.ts && git commit -m "fix(games): exclude summer league + cup from counted-season allowlist"`. Do not push.

---

## T2. FA transactions depth + news feed

Extracts best-effort structured data (player names, action kind) from ESPN's prose-only transaction descriptions, exposes `?limit` + enrichment on both feed routes, and rebuilds the `/transactions` page with team-filter chips, team logos, parsed player links, and kind color coding. All four sub-tasks are independently committed.

**Context an implementer needs (verified against live ESPN + current source):**
- `/api/transactions` (ESPN `.../nba/transactions`) returns items shaped `{date(ISO), description(prose only), team{id,abbreviation,displayName,logos[]{href}}}`. `athletes` and `type` are **undefined** in the live payload — so the current route's `player` is always `""` and `type` is always the `"Transaction"` default. `?limit=N` caps at 500 (absurd N silently falls to 25). Team logo href example: `https://a.espncdn.com/i/teamlogos/nba/500/wsh.png`.
- `/api/news` (ESPN `.../nba/news`) items carry `categories[]{type,description,(teamId,abbreviation on team-type)}` where `type ∈ {league,topic,team,athlete,guid,...}`. Current route hard-slices to 5 and is consumed by `PlayerNews.tsx` + `FavoritesDashboard.tsx` (both pass `?q=`, expect ≤5) and `admin/page.tsx` (health probe). **Keep the query path capped at 5** so those consumers are unaffected.
- ESPN CDN host (`a.espncdn.com`) is NOT in `next.config.ts` `images.remotePatterns` (only `cdn.nba.com` is). Render logos with a plain `<img>` + the eslint-disable precedent used in `src/app/news/NewsFeed.tsx` line 149 and `src/components/player/PlayerNews.tsx` line 75.
- Name→personId: fetch `/api/player-index` (returns `{data:[{personId,firstName,lastName,...}]}`), build a `` `${firstName} ${lastName}` ``-lowercased map, match parsed names case-insensitively. No match → plain text (best-effort). Color tokens `accent`, `success`, `danger`, `warning`, `accent-amber` all exist in `globals.css`.

---

### Task T2a: create src/lib/transactions.ts (parseTransactionPlayers + classifyTransaction)

**Files:**
- Create: `src/lib/transactions.ts`
- Test: `src/lib/transactions.test.ts`

- [ ] **Step 1: Write the failing test.** Create `src/lib/transactions.test.ts` (samples are real prose pulled from the live ESPN feed 2026-07-09):
```ts
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
});
```

- [ ] **Step 2: Run the test, expect FAIL.** `npx vitest run src/lib/transactions.test.ts` — must fail to resolve `./transactions` (module does not exist yet). This confirms the test is wired before implementation.

- [ ] **Step 3: Implement `src/lib/transactions.ts`.** Create the file with exactly this content (the regex and the earliest-index rule are validated against the live feed — do not simplify):
```ts
// Best-effort parsing of ESPN transaction prose. ESPN supplies only a free-text
// `description` (no structured player/type fields), so we extract what we can and
// leave results empty on no match — never fabricated.

export type TransactionKind = "signed" | "traded" | "waived" | "claimed" | "other";

// A position token (C/G/F, two-letter PG/SG/SF/PF, optional plural "Gs"/"Fs")
// immediately followed by a 2+ word capitalized name. Each name token allows an
// internal capital (DeRozan/LaVine), apostrophe (Day'Ron) and hyphen
// (Finney-Smith), and ends on a lowercase letter so a trailing sentence period is
// never absorbed and the match cannot bleed into the next capitalized word.
const PLAYER_RE = /\b(?:PG|SG|SF|PF|C|G|F)s?\s+([A-Z][A-Za-z'-]*[a-z](?:\s+[A-Z][A-Za-z'-]*[a-z])+)/g;

export function parseTransactionPlayers(description: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of description.matchAll(PLAYER_RE)) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

// A description may describe several actions ("Signed ... Acquired ..."); we
// return the kind whose keyword appears EARLIEST in the text (the first/primary
// action), or "other" on no match.
const KIND_KEYWORDS: { kind: TransactionKind; patterns: string[] }[] = [
  { kind: "signed", patterns: ["sign"] },
  { kind: "traded", patterns: ["trad", "acquir"] },
  { kind: "waived", patterns: ["waiv"] },
  { kind: "claimed", patterns: ["claim"] },
];

export function classifyTransaction(description: string): TransactionKind {
  const lower = description.toLowerCase();
  let best: { kind: TransactionKind; index: number } | null = null;
  for (const { kind, patterns } of KIND_KEYWORDS) {
    for (const pattern of patterns) {
      const index = lower.indexOf(pattern);
      if (index === -1) continue;
      if (best === null || index < best.index) best = { kind, index };
    }
  }
  return best?.kind ?? "other";
}
```
Rule documented (per spec T2a): `classifyTransaction` returns the kind of the FIRST action — implemented as the keyword with the smallest character index in the lowercased description. So `"Signed ... Acquired ..."` → `"signed"`; `"Claimed ... off waivers"` → `"claimed"` (`claim` at index 0 beats `waiv` later).

- [ ] **Step 4: Run the test, expect PASS.** `npx vitest run src/lib/transactions.test.ts` — all cases green.

- [ ] **Step 5: Commit.** `git add src/lib/transactions.ts src/lib/transactions.test.ts && git commit -m "feat(transactions): best-effort player/kind parsing from ESPN prose"`

---

### Task T2b: /api/transactions — ?limit param + players/kind/teamLogo enrichment

**Files:**
- Modify: `src/app/api/transactions/route.ts`

- [ ] **Step 1: Replace the entire route file.** The current file (`export async function GET()` with hard `items.slice(0, 30)`, no `NextRequest`, no logos, no enrichment) is replaced wholesale. Overwrite `src/app/api/transactions/route.ts` with:
```ts
import { NextRequest, NextResponse } from "next/server";
import { parseTransactionPlayers, classifyTransaction } from "@/lib/transactions";

interface ESPNTransaction {
  date: string;
  team?: { displayName: string; abbreviation: string; logos?: { href?: string }[] };
  athletes?: { displayName: string }[];
  description: string;
  type?: { text: string };
}

interface CleanedTransaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
  players: string[];
  kind: string;
  teamLogo: string;
}

const DEFAULT_LIMIT = 150;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=${limit}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ transactions: [] }, { status: 502 });
    }

    const data = await res.json();
    // Shape guard (batch 1 C11c): an unexpected body must not be cached as "none".
    const items: unknown = data.transactions ?? data.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ transactions: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const transactions: CleanedTransaction[] = (items as ESPNTransaction[]).map((t) => {
      const description = t.description || "";
      return {
        date: t.date || "",
        team: t.team?.displayName || "Unknown",
        teamAbbr: t.team?.abbreviation || "",
        player: t.athletes?.[0]?.displayName || "",
        type: t.type?.text || "Transaction",
        description,
        players: parseTransactionPlayers(description),
        kind: classifyTransaction(description),
        teamLogo: t.team?.logos?.[0]?.href || "",
      };
    });

    return NextResponse.json(
      { transactions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json({ transactions: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
```
Preserved from the original: the `AbortController` + `setTimeout(5000)` timeout, `next: { revalidate: 1800 }`, the `s-maxage=1800` cache header, the `!res.ok → 502` guard, the catch → 500 no-store, and every existing `CleanedTransaction` field (`date/team/teamAbbr/player/type/description`) for back-compat. Added: `?limit` (default 150, cap 500), a `!Array.isArray` shape guard, and the `players/kind/teamLogo` enrichment (contract #3).

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 3: Note the manual dev-server check (do later, not now).** With `npm run dev` running: `curl "http://localhost:3000/api/transactions?limit=5"` returns ≤5 items each carrying `players`, `kind`, `teamLogo`; `curl "http://localhost:3000/api/transactions?limit=9999"` still succeeds (ESPN caps at 500) and items have populated `teamLogo` hrefs. (AdGuardHome on 127.0.0.1:3000 can cause spurious 401s locally — see spec.)

- [ ] **Step 4: Commit.** `git add src/app/api/transactions/route.ts && git commit -m "feat(transactions): ?limit param + players/kind/teamLogo enrichment"`

---

### Task T2c: /api/news — ?limit param + category passthrough

**Files:**
- Modify: `src/app/api/news/route.ts`

- [ ] **Step 1: Replace the entire route file.** Overwrite `src/app/api/news/route.ts` with:
```ts
import { NextRequest, NextResponse } from "next/server";

// ESPN's public undocumented API — free, no key needed
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

interface EspnCategory {
  type?: string;
  description?: string;
  teamId?: number;
  abbreviation?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const rawLimit = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    // Fetch general NBA news from ESPN (5s timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ESPN_NEWS}?limit=${limit}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 600 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.json({ data: [] });
    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    // Filter by player name if query provided
    let filtered = articles;
    if (query) {
      const q = query.toLowerCase();
      filtered = articles.filter((a: { headline?: string; description?: string }) => {
        const text = `${a.headline || ""} ${a.description || ""}`.toLowerCase();
        // Match any part of the name
        return q.split(" ").some((word: string) => word.length > 2 && text.includes(word));
      });
    }

    // Query path stays capped at 5 (PlayerNews/FavoritesDashboard tuned to it);
    // the general feed honors ?limit for the offseason hero and future consumers.
    const sliceCount = query ? 5 : limit;

    const result = filtered.slice(0, sliceCount).map((a: {
      headline?: string;
      description?: string;
      links?: { web?: { href?: string } };
      published?: string;
      images?: { url?: string }[];
      categories?: EspnCategory[];
    }) => ({
      headline: a.headline || "",
      description: a.description || "",
      link: a.links?.web?.href || "",
      published: a.published ? new Date(a.published).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) : "",
      image: a.images?.[0]?.url || "",
      categories: (a.categories || [])
        .filter((c) => c.type === "team" || c.type === "athlete" || c.type === "topic")
        .map((c) => ({ type: c.type || "", label: c.description || "", teamId: c.teamId, abbr: c.abbreviation })),
    }));

    return NextResponse.json({ data: result }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
```
Preserved: the `q` filter logic, the `published` zh-CN date formatting, all existing result fields (`headline/description/link/published/image`), `revalidate: 600`, the `s-maxage=600` header, and the query path's 5-item cap (so `PlayerNews.tsx`, `FavoritesDashboard.tsx` are unaffected). Added: `?limit` (default 30, cap 50), an `Array.isArray` guard on `data.articles`, and the additive `categories` field (team/athlete/topic only; `teamId`/`abbr` present on team-type). The original used `AbortController`+`setTimeout`; kept for consistency with the sibling routes.

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 3: Note the manual dev-server check (do later).** `curl "http://localhost:3000/api/news?limit=40"` returns up to 40 items each with a `categories` array; `curl "http://localhost:3000/api/news?q=lebron"` still returns ≤5 items (query path unchanged). Confirm `PlayerNews` on a player page and the favorites dashboard news column still render the same number of items.

- [ ] **Step 4: Commit.** `git add src/app/api/news/route.ts && git commit -m "feat(news): ?limit param + category passthrough"`

---

### Task T2d: /transactions page — team-filter chips + parsed player links + logos + kind colors

**Files:**
- Modify: `src/app/transactions/page.tsx`

- [ ] **Step 1: Replace the entire page file.** The current page groups `transactions` by date, computes stale `type`-based counts (ESPN no longer supplies `type`, so they were all "other"), and renders `t.player`/`t.type` (both now empty). Overwrite `src/app/transactions/page.tsx` with the full new client component below. It keeps the date-grouped timeline, relative-date labels, `EmptyState`, `Breadcrumbs`, `PageHeader`, and `RelatedPages` intact; adds team-filter chips, kind-based count chips (over the filtered set), team logos, and parsed player links; and is bilingual via `useLocale`.
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Activity, ListOrdered, Crown, Heart, Award, Newspaper } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/components/LocaleProvider";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

interface Transaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
  players: string[];
  kind: string;
  teamLogo: string;
}

interface PlayerIndexEntry {
  personId: number;
  firstName: string;
  lastName: string;
}

function getKindColor(kind: string) {
  switch (kind) {
    case "traded": return "bg-accent/15 text-accent";
    case "signed": return "bg-success/15 text-success";
    case "waived": return "bg-danger/15 text-danger";
    case "claimed": return "bg-warning/15 text-warning";
    default: return "bg-bg-hover text-text-secondary";
  }
}

function kindLabel(kind: string, isZh: boolean) {
  const map: Record<string, [string, string]> = {
    signed: ["签约", "Signed"],
    traded: ["交易", "Traded"],
    waived: ["裁掉", "Waived"],
    claimed: ["认领", "Claimed"],
    other: ["动态", "Move"],
  };
  const pair = map[kind] ?? map.other;
  return isZh ? pair[0] : pair[1];
}

export default function TransactionsPage() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [playerIndex, setPlayerIndex] = useState<PlayerIndexEntry[]>([]);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/transactions?limit=150", { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ transactions: [] })),
      fetch("/api/player-index", { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
    ])
      .then(([txData, piData]) => {
        const list: Transaction[] = (txData.transactions || []).map((t: Transaction) => ({
          ...t,
          players: t.players ?? [],
          kind: t.kind ?? "other",
          teamLogo: t.teamLogo ?? "",
        }));
        setTransactions(list);
        setPlayerIndex(piData.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const nameToId = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of playerIndex) m.set(`${p.firstName} ${p.lastName}`.toLowerCase().trim(), p.personId);
    return m;
  }, [playerIndex]);
  const resolvePlayerId = (name: string) => nameToId.get(name.toLowerCase().trim()) ?? null;

  const teamAbbrs = useMemo(
    () => [...new Set(transactions.map((t) => t.teamAbbr).filter(Boolean))].sort(),
    [transactions]
  );

  const visible = teamFilter ? transactions.filter((t) => t.teamAbbr === teamFilter) : transactions;

  // Group the (filtered) set by date
  const grouped = new Map<string, Transaction[]>();
  for (const t of visible) {
    const dateKey = t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date";
    const arr = grouped.get(dateKey) || [];
    arr.push(t);
    grouped.set(dateKey, arr);
  }

  const sortedDates = [...grouped.keys()].sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });

  const chipCls = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
      active ? "bg-accent text-white" : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "新闻" : "News" },
          { label: isZh ? "交易动态" : "Transactions" },
        ]}
      />
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        {isZh ? "返回首页" : "Back to home"}
      </Link>

      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={ArrowLeftRight}
        title={isZh ? "NBA 交易动态" : "NBA Transactions"}
        action={!loading && transactions.length > 0 ? (
          <span className="chip font-mono"><span className="tabular-nums">{transactions.length}</span> {isZh ? "条最新" : "recent"}</span>
        ) : undefined}
        className="mt-4"
      />

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-5 w-40 skeleton-shimmer rounded mb-2" />
              <div className="h-16 skeleton-shimmer rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Team filter — derived from unique teamAbbr present in the feed */}
      {!loading && teamAbbrs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "球队" : "Teams"}
          </span>
          <button onClick={() => setTeamFilter(null)} className={chipCls(!teamFilter)}>
            {isZh ? "全部" : "All"}
          </button>
          {teamAbbrs.map((abbr) => (
            <button
              key={abbr}
              onClick={() => setTeamFilter(teamFilter === abbr ? null : abbr)}
              className={`${chipCls(teamFilter === abbr)} font-mono`}
            >
              {abbr}
            </button>
          ))}
        </div>
      )}

      {/* Category counts — driven by parsed `kind` over the filtered set */}
      {!loading && visible.length > 0 && (() => {
        const counts: Record<string, number> = { traded: 0, signed: 0, waived: 0, claimed: 0, other: 0 };
        for (const t of visible) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
        const chips: { key: string; label: string; cls: string }[] = [
          { key: "traded", label: isZh ? "交易" : "trades", cls: "bg-accent/15 text-accent" },
          { key: "signed", label: isZh ? "签约" : "signings", cls: "bg-success/15 text-success" },
          { key: "waived", label: isZh ? "裁掉" : "waivers", cls: "bg-danger/15 text-danger" },
          { key: "claimed", label: isZh ? "认领" : "claims", cls: "bg-warning/15 text-warning" },
        ];
        return (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {chips.filter((c) => counts[c.key] > 0).map((c) => (
              <span key={c.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.cls}`}>
                <span className="tabular-nums">{counts[c.key]}</span> {c.label}
              </span>
            ))}
            <span className="text-[10px] text-text-secondary ml-1">{visible.length} {isZh ? "条" : "total"}</span>
          </div>
        );
      })()}

      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title={isZh ? "暂无最新交易动态" : "No recent transactions available"}
          description={isZh ? "稍后回来看看更新" : "Check back later for updates"}
          action={{ href: "/injuries", label: isZh ? "查看伤病" : "View injuries" }}
        />
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-8">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-bg-primary z-10" />

                <h2 className="text-sm font-semibold text-text-secondary mb-2">
                  {dateKey}
                  {(() => {
                    const d = new Date(dateKey);
                    if (isNaN(d.getTime())) return null;
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    let relative = "";
                    if (diffDays === 0) relative = "today";
                    else if (diffDays === 1) relative = "yesterday";
                    else if (diffDays > 1 && diffDays < 365) relative = `${diffDays} days ago`;
                    if (!relative) return null;
                    return <span className="text-xs text-text-secondary/70 font-normal ml-2">({relative})</span>;
                  })()}
                </h2>
                <div className="space-y-2">
                  {grouped.get(dateKey)!.map((t, idx) => (
                    <div key={`${dateKey}-${idx}`} className="glass-tile p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {t.teamLogo ? (
                          <span className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as PlayerNews */}
                            <img src={t.teamLogo} alt="" width={20} height={20} loading="lazy" className="w-5 h-5 object-contain" />
                          </span>
                        ) : null}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getKindColor(t.kind)}`}>
                          {kindLabel(t.kind, isZh)}
                        </span>
                        {t.teamAbbr ? (
                          <Link href={`/team/${t.teamAbbr}`} className="text-sm font-medium text-text-primary hover:text-accent transition-colors">{t.team}</Link>
                        ) : (
                          <span className="text-sm font-medium text-text-primary">{t.team}</span>
                        )}
                        {t.teamAbbr && (
                          <Link href={`/team/${t.teamAbbr}`} className="text-xs text-text-secondary hover:text-accent transition-colors">({t.teamAbbr})</Link>
                        )}
                      </div>
                      {t.players.length > 0 ? (
                        <p className="text-sm text-accent font-medium flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {t.players.map((name, i) => {
                            const pid = resolvePlayerId(name);
                            return pid ? (
                              <Link key={`${name}-${i}`} href={`/player/${pid}`} className="hover:underline">{name}</Link>
                            ) : (
                              <span key={`${name}-${i}`}>{name}</span>
                            );
                          })}
                        </p>
                      ) : t.player ? (
                        <p className="text-sm text-accent font-medium">{t.player}</p>
                      ) : null}
                      {t.description && (
                        <p className="text-xs text-text-secondary mt-1">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/news", label: isZh ? "联盟资讯" : "League news", icon: Newspaper },
          { href: "/injuries", label: isZh ? "伤病报告" : "Injuries", icon: Activity },
          { href: "/standings", label: isZh ? "排行榜" : "Standings", icon: ListOrdered },
          { href: "/history", label: isZh ? "历届冠军" : "Champions", icon: Crown },
          { href: "/favorites", label: isZh ? "我的收藏" : "My favorites", icon: Heart },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards race", icon: Award },
        ]}
      />
    </div>
  );
}
```
Notes on what changed vs. the original: dropped the unused `getTypeColor` (ESPN sends no `type`); the count chips now key off the parsed `kind` instead of the always-`"Transaction"` `type`; each tile now leads with a team logo `<img>`, shows a bilingual kind badge, and renders parsed `players[]` (linking to `/player/[personId]` when the name resolves in the player index, plain text otherwise). Hooks (`useState`/`useMemo`/`useEffect`) are all declared before the single `return` — no early returns, per the React 19 rule.

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 3: Note the manual dev-server check (do later).** Open `http://localhost:3000/transactions`: team chips render from the feed and clicking one filters both the count chips and the timeline; parsed player names appear as blue links (e.g. Giannis, DeMar DeRozan) where they resolve to an active player, plain text otherwise (rookies/two-way signees); team logos render beside the kind badge; toggle locale (zh/en) and confirm chip labels + "Teams/球队", "recent/条最新", kind labels all switch. Verify the offseason golden path (a populated FA feed) and that an empty feed still shows the `EmptyState`.

- [ ] **Step 4: Commit.** `git add src/app/transactions/page.tsx && git commit -m "feat(transactions): team filter chips + parsed player links + logos"`

---

## T3 — /draft/2026 selection page

> Data source: ESPN draft feed `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft?year=YYYY`. Live-probed 2026-07-09: `{picks:[60], teams:[30], positions:[3]}`. Key shape facts the code below depends on — do NOT re-derive:
> - `pick.teamId` and `team.id` are **strings** (`"27"`, `"1"`). Resolve `pick.teamId === team.id`.
> - `pick.athlete.position` is an **object** `{id:"7"}`, NOT a string. Resolve the id via the top-level `positions[]` map (`{id,abbreviation}` → `"3"→G, "7"→F, "9"→C`).
> - `pick.athlete.team.location` is the **college** (`"BYU"`, `"Tennessee"`).
> - Some athletes have **no `headshot`** (overalls 21,25,39,56,57,60 in 2026) — degrade to `""`.
> - ESPN `athlete.id` ≠ NBA `personId`. ESPN headshots live on `a.espncdn.com`, which is NOT in `next.config` `images.remotePatterns` (only `cdn.nba.com` is). Player→profile links are **name-match only** against the active player index; ESPN headshots MUST use a bare `<img>` with an eslint-disable (mirrors `src/app/news/NewsFeed.tsx`).
> - ESPN uses 6 team abbreviations that differ from our `TEAM_META` tricodes: `GS→GSW, NO→NOP, NY→NYK, SA→SAS, UTAH→UTA, WSH→WAS`. `espnAbbrToTricode()` (defined in T3a) normalizes them so logos/`/team/[tricode]` links resolve.

---

### Task T3a: `src/lib/draft.ts` — DraftPick projection (TDD)

**Files:**
- Create: `src/lib/draft.ts`
- Test: `src/lib/draft.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/draft.test.ts`.** Create the file with this exact content (fixture = 3 picks + 2 teams + positions map, covering teamId→abbr resolution, college/position lookup, and traded/unknown/missing-field degradation):
```ts
import { describe, it, expect } from "vitest";
import { projectDraft, espnAbbrToTricode } from "@/lib/draft";

const FIXTURE = {
  positions: [
    { id: "3", displayName: "Guard", abbreviation: "G" },
    { id: "7", displayName: "Forward", abbreviation: "F" },
    { id: "9", displayName: "Center", abbreviation: "C" },
  ],
  teams: [
    { id: "1", abbreviation: "ATL", displayName: "Atlanta Hawks" },
    { id: "9", abbreviation: "GS", displayName: "Golden State Warriors" },
  ],
  picks: [
    {
      pick: 1, overall: 1, round: 1, traded: false, teamId: "1",
      athlete: {
        displayName: "AJ Dybantsa",
        position: { id: "7" },
        team: { location: "BYU" },
        headshot: { href: "https://a.espncdn.com/headshots/aj.png" },
        link: "https://www.espn.com/nba/player/_/id/5142718/aj-dybantsa",
      },
    },
    {
      pick: 2, overall: 2, round: 1, traded: true, teamId: "9",
      athlete: {
        displayName: "Traded Guy",
        position: { id: "3" },
        team: { location: "Duke" },
      },
    },
    {
      pick: 28, overall: 58, round: 2, traded: false, teamId: "99",
      athlete: { displayName: "Late Pick" },
    },
  ],
};

describe("projectDraft", () => {
  it("resolves teamId -> teams[] abbreviation", () => {
    const picks = projectDraft(FIXTURE);
    expect(picks).toHaveLength(3);
    expect(picks[0].teamAbbr).toBe("ATL");
    expect(picks[1].teamAbbr).toBe("GS");
  });

  it("reads college from athlete.team.location and position from the positions map", () => {
    const [p1] = projectDraft(FIXTURE);
    expect(p1.college).toBe("BYU");
    expect(p1.position).toBe("F");
    expect(p1.playerName).toBe("AJ Dybantsa");
    expect(p1.headshot).toBe("https://a.espncdn.com/headshots/aj.png");
    expect(p1.espnLink).toContain("espn.com");
  });

  it("still projects a traded pick, degrading missing fields to empty strings", () => {
    const traded = projectDraft(FIXTURE)[1];
    expect(traded.overall).toBe(2);
    expect(traded.playerName).toBe("Traded Guy");
    expect(traded.position).toBe("G");
    expect(traded.headshot).toBe("");
    expect(traded.espnLink).toBe("");
  });

  it("degrades unknown teamId and missing athlete fields to empty strings", () => {
    const late = projectDraft(FIXTURE)[2];
    expect(late.overall).toBe(58);
    expect(late.teamId).toBe("99");
    expect(late.teamAbbr).toBe("");
    expect(late.position).toBe("");
    expect(late.college).toBe("");
    expect(late.headshot).toBe("");
  });

  it("returns [] for non-object or malformed input", () => {
    expect(projectDraft(null)).toEqual([]);
    expect(projectDraft({})).toEqual([]);
    expect(projectDraft({ picks: "nope" })).toEqual([]);
  });
});

describe("espnAbbrToTricode", () => {
  it("maps the 6 divergent ESPN abbreviations to our tricodes", () => {
    expect(espnAbbrToTricode("GS")).toBe("GSW");
    expect(espnAbbrToTricode("NO")).toBe("NOP");
    expect(espnAbbrToTricode("NY")).toBe("NYK");
    expect(espnAbbrToTricode("SA")).toBe("SAS");
    expect(espnAbbrToTricode("UTAH")).toBe("UTA");
    expect(espnAbbrToTricode("WSH")).toBe("WAS");
  });
  it("is identity for abbreviations that already match", () => {
    expect(espnAbbrToTricode("ATL")).toBe("ATL");
    expect(espnAbbrToTricode("BOS")).toBe("BOS");
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.** `npx vitest run src/lib/draft.test.ts` — it MUST fail (module `@/lib/draft` does not exist yet). Confirm the failure is "Failed to resolve import" / cannot find module, not a syntax error in the test.

- [ ] **Step 3: Implement `src/lib/draft.ts`.** Create the file with this exact content:
```ts
export interface DraftPick {
  overall: number;
  pick: number;
  round: number;
  playerName: string;
  position: string;
  college: string;
  teamAbbr: string;
  teamId: string;
  headshot: string;
  espnLink: string;
}

// ESPN uses 6 abbreviations that diverge from our TEAM_META tricodes; normalize
// them so draft picks resolve NBA logos and link to /team/[tricode].
const ESPN_ABBR_TO_TRICODE: Record<string, string> = {
  GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS",
};

export function espnAbbrToTricode(abbr: string): string {
  return ESPN_ABBR_TO_TRICODE[abbr] || abbr;
}

interface EspnDraftJson {
  positions?: { id?: string; abbreviation?: string }[];
  teams?: { id?: string; abbreviation?: string }[];
  picks?: {
    overall?: number;
    pick?: number;
    round?: number;
    teamId?: string;
    athlete?: {
      displayName?: string;
      position?: { id?: string };
      team?: { location?: string };
      headshot?: { href?: string };
      link?: string;
    };
  }[];
}

// Maps the raw ESPN draft feed to a flat DraftPick[]. Best-effort: every field
// degrades to "" / 0 rather than throwing, so a traded pick or an athlete
// missing a headshot still projects.
export function projectDraft(espnJson: unknown): DraftPick[] {
  const json = (espnJson ?? {}) as EspnDraftJson;
  const picks = Array.isArray(json.picks) ? json.picks : [];
  const teams = Array.isArray(json.teams) ? json.teams : [];
  const positions = Array.isArray(json.positions) ? json.positions : [];

  const abbrByTeamId = new Map<string, string>();
  for (const t of teams) {
    if (t && typeof t.id === "string") abbrByTeamId.set(t.id, t.abbreviation || "");
  }
  const abbrByPosId = new Map<string, string>();
  for (const p of positions) {
    if (p && typeof p.id === "string") abbrByPosId.set(p.id, p.abbreviation || "");
  }

  const out: DraftPick[] = [];
  for (const p of picks) {
    if (!p || typeof p !== "object") continue;
    const a = p.athlete;
    const teamId = typeof p.teamId === "string" ? p.teamId : "";
    const posId = a?.position?.id;
    out.push({
      overall: typeof p.overall === "number" ? p.overall : 0,
      pick: typeof p.pick === "number" ? p.pick : 0,
      round: typeof p.round === "number" ? p.round : 0,
      playerName: a?.displayName || "",
      position: (posId && abbrByPosId.get(posId)) || "",
      college: a?.team?.location || "",
      teamAbbr: abbrByTeamId.get(teamId) || "",
      teamId,
      headshot: a?.headshot?.href || "",
      espnLink: a?.link || "",
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test, expect PASS.** `npx vitest run src/lib/draft.test.ts` — all 7 assertions green.

- [ ] **Step 5: Commit.** `git add src/lib/draft.ts src/lib/draft.test.ts && git commit -m "feat(draft): DraftPick projection from ESPN draft feed"`

---

### Task T3b: `src/app/api/draft/route.ts` — ESPN draft proxy

**Files:**
- Create: `src/app/api/draft/route.ts`

- [ ] **Step 1: Create the route handler.** Create `src/app/api/draft/route.ts` with this exact content (mirrors the `src/app/api/injuries/route.ts` C11c pattern: UA header + 5s AbortSignal + shape guard that returns an error state with `no-store` so a bad ESPN body is never cached as an empty board; long `revalidate` since a completed draft is immutable):
```ts
import { NextRequest, NextResponse } from "next/server";
import { projectDraft, type DraftPick } from "@/lib/draft";

const ESPN_DRAFT = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft";

// Consumers key off picks[]; an unexpected ESPN body would otherwise be cached
// as "empty draft" for a day.
function isValidDraftFeed(json: unknown): json is { picks: unknown[] } {
  if (typeof json !== "object" || json === null) return false;
  return Array.isArray((json as { picks?: unknown }).picks);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("year");
  const year = /^\d{4}$/.test(raw || "") ? raw : "2026";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ESPN_DRAFT}?year=${year}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ picks: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const json = await res.json();
    if (!isValidDraftFeed(json)) {
      return NextResponse.json({ picks: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const picks: DraftPick[] = projectDraft(json);
    return NextResponse.json({ picks }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
    });
  } catch {
    return NextResponse.json({ picks: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
```

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 3: Note the manual dev-server check (do later, not now).** When the implementer later runs `npm run dev`, verify: `curl "http://localhost:3000/api/draft?year=2026"` returns `{"picks":[...]}` with 60 items whose first item has `overall:1, teamAbbr, position, college`; `curl "http://localhost:3000/api/draft?year=1800"` returns a valid (possibly empty) `{picks:[]}` not a crash. (If localhost returns 401, that is the local AdGuardHome on 127.0.0.1:3000 — use `127.0.0.1` vs `localhost` per the batch-plan-status note, not an app bug.)

- [ ] **Step 4: Commit.** `git add src/app/api/draft/route.ts && git commit -m "feat(api): /api/draft ESPN proxy with shape guard and day-long cache"`

---

### Task T3c: `src/app/draft/2026/page.tsx` — pick-by-pick page

**Files:**
- Create: `src/app/draft/2026/page.tsx`

- [ ] **Step 1: Create the page (server component, momentum template).** Create `src/app/draft/2026/page.tsx` with this exact content. Notes baked in: it fetches ESPN directly server-side (same pattern as `src/app/injuries/page.tsx`, which fetches ESPN in a local async fn rather than its own API route) and reuses the pure `projectDraft`; builds a `name→personId` map from the active player index for best-effort profile links (2026 rookies are absent from the index, so most render as ESPN headshot + external link — this is expected, not a bug); ESPN headshots use a bare `<img>` + eslint-disable because `a.espncdn.com` is not a `next/image` remote pattern.
```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, Crown, Sparkles, School, Users } from "lucide-react";
import { getPlayerIndex, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { projectDraft, espnAbbrToTricode, type DraftPick } from "@/lib/draft";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import PlayerHeadshot from "@/components/PlayerHeadshot";

const DRAFT_YEAR = 2026;

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "2026 NBA 选秀" : "2026 NBA Draft",
    description: isZh
      ? "2026 年 NBA 选秀逐顺位结果 —— 球队、位置、大学一览。"
      : "Every pick of the 2026 NBA Draft — round by round, with team, position, and college.",
    alternates: { canonical: "/draft/2026" },
  };
}

async function getDraft(year: number): Promise<DraftPick[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft?year=${year}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    if (typeof json !== "object" || json === null || !Array.isArray((json as { picks?: unknown }).picks)) return [];
    return projectDraft(json);
  } catch {
    return [];
  }
}

function teamOf(pick: DraftPick) {
  return TEAM_META[espnAbbrToTricode(pick.teamAbbr)] ?? null;
}

function PickHeadshot({ pick, personId, size = 28 }: { pick: DraftPick; personId?: number; size?: number }) {
  if (personId) return <PlayerHeadshot personId={personId} name={pick.playerName} size={size} />;
  if (pick.headshot) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as NewsFeed
      <img
        src={pick.headshot}
        alt={pick.playerName}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
        className="rounded-full object-cover object-top bg-bg-secondary shrink-0"
      />
    );
  }
  return (
    <div
      className="rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0"
      style={{ width: size, height: size }}
    >
      {pick.playerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
    </div>
  );
}

function PlayerCell({ pick, personId }: { pick: DraftPick; personId?: number }) {
  const inner = (
    <span className="flex items-center gap-2 min-w-0">
      <PickHeadshot pick={pick} personId={personId} size={28} />
      <span className="font-medium text-text-primary truncate">{pick.playerName || "—"}</span>
    </span>
  );
  if (personId) {
    return <Link href={`/player/${personId}`} className="hover:text-accent transition-colors">{inner}</Link>;
  }
  if (pick.espnLink) {
    return <a href={pick.espnLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{inner}</a>;
  }
  return inner;
}

export default async function DraftPage() {
  const isZh = (await getLocale()) === "zh";
  const [picks, players] = await Promise.all([
    getDraft(DRAFT_YEAR),
    getPlayerIndex().catch(() => []),
  ]);

  const nameToId = new Map<string, number>();
  for (const p of players) {
    nameToId.set(`${p.firstName} ${p.lastName}`.toLowerCase().trim(), p.personId);
  }
  const idFor = (name: string) => nameToId.get(name.toLowerCase().trim());

  const breadcrumbs = (
    <Breadcrumbs items={[{ label: isZh ? "选秀届" : "Draft", href: "/draft-classes" }, { label: isZh ? "2026 选秀" : "2026 Draft" }]} />
  );

  if (picks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "选秀" : "Draft"} icon={GraduationCap} title={isZh ? "2026 NBA 选秀" : "2026 NBA Draft"} />
        <EmptyState
          icon={GraduationCap}
          title={isZh ? "暂无选秀数据" : "No draft data"}
          description={isZh ? "无法加载选秀结果，请稍后再试。" : "Could not load the draft board. Check back later."}
        />
      </div>
    );
  }

  const sorted = [...picks].sort((a, b) => a.overall - b.overall);
  const topPick = sorted[0];
  const topId = topPick ? idFor(topPick.playerName) : undefined;
  const topTeam = topPick ? teamOf(topPick) : null;

  const byRound = new Map<number, DraftPick[]>();
  for (const p of sorted) {
    const arr = byRound.get(p.round) || [];
    arr.push(p);
    byRound.set(p.round, arr);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "选秀" : "Draft"}
        icon={GraduationCap}
        title={isZh ? "2026 NBA 选秀" : "2026 NBA Draft"}
        subtitle={isZh ? `逐顺位结果 · 共 ${sorted.length} 个签` : `Pick-by-pick results · ${sorted.length} selections`}
        updatedAt={getScheduleAge()}
      />

      {topPick && (
        <section className="glass-tile p-5 mb-6 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative flex items-center gap-4">
            <PickHeadshot pick={topPick} personId={topId} size={64} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 flex items-center gap-1.5">
                <Crown size={11} className="text-accent-amber" /> {isZh ? "状元签" : "First Overall"}
              </p>
              {topId ? (
                <Link href={`/player/${topId}`} className="text-2xl font-semibold text-text-primary hover:text-accent transition-colors">
                  {topPick.playerName}
                </Link>
              ) : (
                <p className="text-2xl font-semibold text-text-primary">{topPick.playerName || "—"}</p>
              )}
              <p className="text-xs text-text-secondary mt-1">
                {[topPick.position, topPick.college].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            {topTeam && (
              <Link href={`/team/${topTeam.tricode}`} className="shrink-0 flex flex-col items-center gap-1 group">
                <Image src={teamLogoUrl(topTeam.teamId)} alt={topTeam.tricode} width={48} height={48} unoptimized />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary group-hover:text-accent transition-colors">{topTeam.tricode}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {rounds.map(([round, list]) => (
          <section key={round} className="glass-tile overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <GraduationCap size={16} className="text-accent" />
              <h2 className="font-semibold text-sm">{isZh ? `第 ${round} 轮` : `Round ${round}`}</h2>
              <span className="text-[10px] font-mono text-text-secondary tabular-nums">· {list.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary text-xs">
                    <th className="text-center py-3 px-3 w-14">#</th>
                    <th className="text-left py-3 px-3">{isZh ? "球员" : "Player"}</th>
                    <th className="text-center py-3 px-2">{isZh ? "位置" : "Pos"}</th>
                    <th className="text-left py-3 px-3">{isZh ? "大学 / 来源" : "College / From"}</th>
                    <th className="text-center py-3 px-3">{isZh ? "球队" : "Team"}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const meta = teamOf(p);
                    const pid = idFor(p.playerName);
                    return (
                      <tr key={p.overall} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                        <td className="text-center py-2.5 px-3 font-mono tabular-nums text-text-secondary">{p.overall}</td>
                        <td className="py-2.5 px-3"><PlayerCell pick={p} personId={pid} /></td>
                        <td className="text-center py-2.5 px-2 text-text-secondary">{p.position || "-"}</td>
                        <td className="py-2.5 px-3 text-text-secondary truncate max-w-[160px]">{p.college || "-"}</td>
                        <td className="py-2.5 px-3">
                          {meta ? (
                            <Link href={`/team/${meta.tricode}`} className="flex items-center justify-center gap-1.5 hover:text-accent transition-colors">
                              <Image src={teamLogoUrl(meta.teamId)} alt={meta.tricode} width={22} height={22} unoptimized />
                              <span className="font-mono text-xs text-text-secondary">{meta.tricode}</span>
                            </Link>
                          ) : (
                            <span className="flex items-center justify-center font-mono text-xs text-text-secondary">{p.teamAbbr || "-"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "关于" : "About"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "数据来自 ESPN。球员链接仅在其已进入现役球员索引时可用 —— 否则显示 ESPN 头像与外部链接（ESPN 球员 ID 与 NBA personId 不通用，只能按姓名匹配）。"
            : "Data from ESPN. A player links to their profile only once they enter the active player index — otherwise the ESPN headshot and an external link are shown (ESPN athlete IDs are not NBA personIds, so linking is name-match only)."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "现役球员按选秀年份分组" : "Active players by draft year", icon: GraduationCap },
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本季顶级新秀" : "Top rookies this season", icon: Sparkles },
          { href: "/by-college", label: isZh ? "按大学榜" : "By College", description: isZh ? "NBA 输送名校" : "NBA pipeline schools", icon: School },
          { href: "/by-position", label: isZh ? "按位置榜" : "By Position", description: isZh ? "按位置分组领袖" : "Leaders by position", icon: Users },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "生涯数据领跑者" : "Career stat leaders", icon: Crown },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — expect 0 errors. (Async server component + async `PlayerHeadshot` client child are both valid here; repo already renders async server children like `GamePreview`.)

- [ ] **Step 3: Note the manual dev-server check (do later).** Under `npm run dev`, open `/draft/2026`: verify the top card shows the #1 overall pick (AJ Dybantsa in 2026) with position/college and drafting-team logo; both rounds render as tables with 60 total rows; team logos resolve for all 30 franchises including the 6 divergent abbrs (check a NO/NY/SA/UTAH/WSH/GS pick links to `/team/NOP` etc.); picks whose name matches an active player link to `/player/[id]` while rookies show the ESPN headshot with an external link; toggle locale and confirm zh/en strings both render. Do NOT add `export const revalidate` — the page is dynamic SSR by design.

- [ ] **Step 4: Commit.** `git add src/app/draft/2026/page.tsx && git commit -m "feat(draft): /draft/2026 pick-by-pick page"`

---

### Task T3d: register /draft/2026 + team picks panel

**Files:**
- Create: `src/app/team/[tricode]/_components/TeamDraftPicks.tsx`
- Modify: `src/lib/useMoreGroups.ts`
- Modify: `src/app/explore/page.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/draft-classes/page.tsx`
- Modify: `src/app/team/[tricode]/page.tsx`

- [ ] **Step 1: Register in the More menu (`src/lib/useMoreGroups.ts`).** `Sparkles` is already imported. In the Players group, find:
```tsx
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", icon: GraduationCap, keywords: "draft classes year" },
```
Replace with:
```tsx
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", icon: GraduationCap, keywords: "draft classes year" },
        { href: "/draft/2026", label: isZh ? "2026 选秀" : "2026 Draft", icon: Sparkles, keywords: "2026 draft picks board lottery" },
```

- [ ] **Step 2: Register in Explore (`src/app/explore/page.tsx`).** `Sparkles` is already imported. In the "Player Universe" category, find:
```tsx
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份分组球员" : "Players grouped by draft year", icon: GraduationCap },
```
Replace with:
```tsx
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份分组球员" : "Players grouped by draft year", icon: GraduationCap },
        { href: "/draft/2026", label: isZh ? "2026 选秀" : "2026 Draft", description: isZh ? "2026 年选秀逐顺位结果" : "Every pick of the 2026 Draft", icon: Sparkles },
```

- [ ] **Step 3: Register in the sitemap (`src/app/sitemap.ts`).** In the `playerHubs` array, find:
```tsx
    { url: `${BASE}/draft-classes`, changeFrequency: "monthly", priority: 0.5 },
```
Replace with:
```tsx
    { url: `${BASE}/draft-classes`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/draft/2026`, changeFrequency: "monthly", priority: 0.5 },
```

- [ ] **Step 4: Add the 2026 entry-link card to `src/app/draft-classes/page.tsx`.** First extend the lucide import. Find:
```tsx
import { GraduationCap, Activity, Users, Globe, Crown } from "lucide-react";
```
Replace with:
```tsx
import { GraduationCap, Activity, Users, Globe, Crown, Sparkles, ArrowRight } from "lucide-react";
```
Then insert the entry card between the `PageHeader` and the classes list — this is a standalone link into the new page, NOT merged into the active-player year grouping. Find:
```tsx
      />

      <div className="space-y-4">
```
Replace with:
```tsx
      />

      <Link
        href="/draft/2026"
        className="glass-tile p-5 mb-4 flex items-center gap-4 group cursor-pointer ring-1 ring-accent/20"
      >
        <div className="shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <Sparkles size={22} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "最新一届" : "Newest class"}</p>
          <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">{isZh ? "2026 选秀 · 逐顺位结果" : "2026 Draft · pick by pick"}</p>
          <p className="text-[11px] text-text-secondary leading-snug mt-0.5">{isZh ? "新秀尚未进入现役索引 —— 单独查看完整选秀结果。" : "Rookies aren't in the active index yet — see the full draft board."}</p>
        </div>
        <ArrowRight size={16} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>

      <div className="space-y-4">
```
(`Link` and `isZh` are already in scope in this file.)

- [ ] **Step 5: Create the team picks panel `src/app/team/[tricode]/_components/TeamDraftPicks.tsx`.** Self-contained async server component (TeamLegends-style): fetches the ESPN draft, filters to this franchise via `espnAbbrToTricode`, returns `null` when the team has no 2026 picks. Exact content:
```tsx
import Link from "next/link";
import { projectDraft, espnAbbrToTricode, type DraftPick } from "@/lib/draft";

const DRAFT_YEAR = 2026;

async function getTeamPicks(tricode: string): Promise<DraftPick[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft?year=${DRAFT_YEAR}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    if (typeof json !== "object" || json === null || !Array.isArray((json as { picks?: unknown }).picks)) return [];
    return projectDraft(json).filter((p) => espnAbbrToTricode(p.teamAbbr) === tricode);
  } catch {
    return [];
  }
}

export default async function TeamDraftPicks({ tricode, isZh }: { tricode: string; isZh: boolean }) {
  const picks = await getTeamPicks(tricode);
  if (picks.length === 0) return null;
  picks.sort((a, b) => a.overall - b.overall);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
          / {isZh ? "2026 选秀" : "2026 Draft Picks"}
        </h3>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-wrap gap-2">
        {picks.map((p) => (
          <Link
            key={p.overall}
            href="/draft/2026"
            className="glass-tile px-3 py-2 text-xs cursor-pointer hover:border-accent/40 transition-colors group inline-flex items-center gap-2"
          >
            <span className="font-mono tabular-nums text-accent">#{p.overall}</span>
            <span className="text-text-primary font-medium">{p.playerName || (isZh ? "待定" : "TBD")}</span>
            {p.position && <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{p.position}</span>}
            {p.college && <span className="text-text-secondary">{p.college}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount the panel in `src/app/team/[tricode]/page.tsx`.** Add the import — find:
```tsx
import TeamLegends from "./_components/TeamLegends";
```
Replace with:
```tsx
import TeamLegends from "./_components/TeamLegends";
import TeamDraftPicks from "./_components/TeamDraftPicks";
```
Then mount it right after `TeamRoster`. Find:
```tsx
      <TeamRoster roster={roster} t={t} />

      {/* Map current franchises to their historical aliases for the legacy
```
Replace with:
```tsx
      <TeamRoster roster={roster} t={t} />

      <TeamDraftPicks tricode={team.tricode} isZh={isZh} />

      {/* Map current franchises to their historical aliases for the legacy
```

- [ ] **Step 7: Typecheck.** `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 8: Note the manual dev-server check (do later).** Under `npm run dev`: (a) open `/explore` and the "More" command palette — both list "2026 Draft" / "2026 选秀" linking to `/draft/2026`; (b) open `/draft-classes` — the newest-class entry card sits above the year list and links out (not merged into a year group); (c) `curl "http://localhost:3000/sitemap.xml" | grep draft/2026` shows the URL; (d) open `/team/OKC` (a team known to hold 2026 picks per the probe — several teams have multiple; OKC/WAS/UTA are safe bets) and confirm the "2026 Draft Picks" chips appear after the roster and link to `/draft/2026`; open a team with no picks and confirm the panel renders nothing (no empty header).

- [ ] **Step 9: Commit.** `git add src/lib/useMoreGroups.ts src/app/explore/page.tsx src/app/sitemap.ts src/app/draft-classes/page.tsx src/app/team/[tricode]/_components/TeamDraftPicks.tsx "src/app/team/[tricode]/page.tsx" && git commit -m "feat(draft): register /draft/2026 in nav/explore/sitemap + team picks panel"`

---

## T4. 2025-26 Season Recap Page

New route `/season/2025-26` plus a testable pure-derivation module over the frozen `SEASON_SNAPSHOT`. Three sub-tasks, executed and committed in order (T4a → T4b → T4c): T4b imports T4a's exports; T4c links the route T4b creates.

**Live-probed facts (already verified against `src/data/season-2025-26-final.json`, trust these):**
- Finals games (`gameId` startsWith `"004"` AND `charAt(7) === "4"`) = exactly 5: `0042500401` NYK 105 @ SAS 95, `0042500402` NYK 105 @ SAS 104, `0042500403` SAS 115 @ NYK 111, `0042500404` SAS 106 @ NYK 107, `0042500405` NYK 94 @ SAS 90 → NYK wins 4, SAS wins 1 → champion **New York Knicks** (`NYK`, teamId `1610612752`), runner-up **San Antonio Spurs** (`SAS`, teamId `1610612759`), series `4-1`.
- Counted games (prefix `002` or `004`) = 1315. Extremes across them: highest team score `157`, lowest team score `66`, largest margin `55`, highest combined `302`, closest margins all `1`.
- `awards.json` 2025-26 rows are ALL `"TBD"` today → the awards section must render nothing (graceful).

---

### Task T4a: create `src/lib/season-recap.ts` (pure derivations) + tests

**Files:**
- Create: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/lib/season-recap.ts`
- Test: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/lib/season-recap.test.ts`

- [ ] **Step 1: Write the failing test first.** Create `src/lib/season-recap.test.ts` with this exact content (imports the REAL frozen snapshot):

```ts
import { describe, it, expect } from "vitest";
import { SEASON_SNAPSHOT } from "./season-snapshot";
import { finalsResult, seasonRecordExtremes, seasonBestGames } from "./season-recap";

describe("finalsResult", () => {
  const r = finalsResult(SEASON_SNAPSHOT);

  it("derives the 2025-26 champion and runner-up from the snapshot finals games", () => {
    expect(r.champion).toBe("New York Knicks");
    expect(r.runnerUp).toBe("San Antonio Spurs");
    expect(r.championTricode).toBe("NYK");
    expect(r.runnerUpTricode).toBe("SAS");
  });

  it("reports the series result and a 5-game list", () => {
    expect(r.seriesText).toBe("4-1");
    expect(r.games.length).toBe(5);
  });

  it("orders finals games chronologically", () => {
    const dates = r.games.map((g) => g.gameDate);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("seasonRecordExtremes", () => {
  const e = seasonRecordExtremes(SEASON_SNAPSHOT);

  it("counts regular + playoff games only", () => {
    expect(e.totalGames).toBeGreaterThan(1000);
  });

  it("finds a plausible highest team score", () => {
    expect(e.highestTeamScore).not.toBeNull();
    expect(e.highestTeamScore!.value).toBeGreaterThanOrEqual(150);
    expect(e.highestTeamScore!.value).toBeLessThanOrEqual(200);
  });

  it("finds a plausible lowest team score", () => {
    expect(e.lowestTeamScore!.value).toBeGreaterThanOrEqual(50);
    expect(e.lowestTeamScore!.value).toBeLessThanOrEqual(85);
  });

  it("finds a plausible largest margin and highest combined", () => {
    expect(e.largestMargin!.value).toBeGreaterThanOrEqual(30);
    expect(e.highestCombined!.value).toBeGreaterThanOrEqual(280);
  });
});

describe("seasonBestGames", () => {
  const b = seasonBestGames(SEASON_SNAPSHOT);

  it("returns up to 5 closest and 5 highest-scoring games", () => {
    expect(b.closest.length).toBe(5);
    expect(b.highestScoring.length).toBe(5);
  });

  it("closest games are ordered by ascending margin", () => {
    expect(b.closest[0].margin).toBeLessThanOrEqual(b.closest[4].margin);
    expect(b.closest[0].margin).toBeLessThanOrEqual(2);
  });

  it("highest-scoring games are ordered by descending total", () => {
    expect(b.highestScoring[0].total).toBeGreaterThanOrEqual(b.highestScoring[4].total);
    expect(b.highestScoring[0].total).toBeGreaterThanOrEqual(280);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL.** `npx vitest run src/lib/season-recap.test.ts` — it must fail to resolve `./season-recap` (module does not exist yet). This confirms the test drives the implementation.

- [ ] **Step 3: Implement `src/lib/season-recap.ts`.** Create the file with this exact content. It reuses the STABLE `isRegular`/`isPlayoff` predicates from `games.ts` (they exist today, independent of T1's additions), and mirrors the finals detection contract (`charAt(7) === "4"`).

```ts
import { SEASON_SNAPSHOT, type SeasonSnapshot, type SnapshotGame } from "./season-snapshot";
import { isRegular, isPlayoff } from "./games";

export interface RecapGame {
  gameId: string;
  gameDate: string;
  homeTricode: string;
  homeTeamId: number;
  homeScore: number;
  awayTricode: string;
  awayTeamId: number;
  awayScore: number;
  margin: number;
  total: number;
}

export interface ExtremeGame extends RecapGame {
  /** the metric value that makes this game the record holder */
  value: number;
}

export interface FinalsResult {
  champion: string;
  championTricode: string;
  championTeamId: number;
  runnerUp: string;
  runnerUpTricode: string;
  runnerUpTeamId: number;
  seriesText: string;
  games: RecapGame[];
}

export interface SeasonRecordExtremes {
  highestTeamScore: ExtremeGame | null;
  lowestTeamScore: ExtremeGame | null;
  largestMargin: ExtremeGame | null;
  highestCombined: ExtremeGame | null;
  totalGames: number;
}

export interface SeasonBestGames {
  closest: RecapGame[];
  highestScoring: RecapGame[];
}

function fullName(snapshot: SeasonSnapshot, tricode: string): string {
  const t = snapshot.teams.find((x) => x.tricode === tricode);
  return t ? `${t.teamCity} ${t.teamName}` : tricode;
}

function teamIdFor(snapshot: SeasonSnapshot, tricode: string): number {
  return snapshot.teams.find((x) => x.tricode === tricode)?.teamId ?? 0;
}

function toRecapGame(g: SnapshotGame): RecapGame {
  return {
    gameId: g.gameId,
    gameDate: g.gameDate,
    homeTricode: g.homeTricode,
    homeTeamId: g.homeTeamId,
    homeScore: g.homeScore,
    awayTricode: g.awayTricode,
    awayTeamId: g.awayTeamId,
    awayScore: g.awayScore,
    margin: Math.abs(g.homeScore - g.awayScore),
    total: g.homeScore + g.awayScore,
  };
}

// Round 4 of the playoffs = the Finals. NBA encodes the round in charAt(7).
function isFinalsGame(gameId: string): boolean {
  return isPlayoff(gameId) && gameId.charAt(7) === "4";
}

function countedGames(snapshot: SeasonSnapshot): RecapGame[] {
  return snapshot.finishedGames
    .filter((g) => isRegular(g.gameId) || isPlayoff(g.gameId))
    .map(toRecapGame);
}

export function finalsResult(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): FinalsResult {
  const games = snapshot.finishedGames
    .filter((g) => isFinalsGame(g.gameId))
    .map(toRecapGame)
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gameId.localeCompare(b.gameId));

  const wins: Record<string, number> = {};
  for (const g of games) {
    const winner = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
    wins[winner] = (wins[winner] || 0) + 1;
  }
  const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const championTricode = ranked[0]?.[0] ?? "";
  const runnerUpTricode = ranked[1]?.[0] ?? "";
  const championWins = ranked[0]?.[1] ?? 0;
  const runnerUpWins = ranked[1]?.[1] ?? 0;

  return {
    champion: championTricode ? fullName(snapshot, championTricode) : "",
    championTricode,
    championTeamId: teamIdFor(snapshot, championTricode),
    runnerUp: runnerUpTricode ? fullName(snapshot, runnerUpTricode) : "",
    runnerUpTricode,
    runnerUpTeamId: teamIdFor(snapshot, runnerUpTricode),
    seriesText: games.length > 0 ? `${championWins}-${runnerUpWins}` : "",
    games,
  };
}

export function seasonRecordExtremes(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): SeasonRecordExtremes {
  const games = countedGames(snapshot);
  if (games.length === 0) {
    return { highestTeamScore: null, lowestTeamScore: null, largestMargin: null, highestCombined: null, totalGames: 0 };
  }
  const withValue = (g: RecapGame, value: number): ExtremeGame => ({ ...g, value });
  let highest = withValue(games[0], Math.max(games[0].homeScore, games[0].awayScore));
  let lowest = withValue(games[0], Math.min(games[0].homeScore, games[0].awayScore));
  let margin = withValue(games[0], games[0].margin);
  let combined = withValue(games[0], games[0].total);
  for (const g of games) {
    const hi = Math.max(g.homeScore, g.awayScore);
    const lo = Math.min(g.homeScore, g.awayScore);
    if (hi > highest.value) highest = withValue(g, hi);
    if (lo < lowest.value) lowest = withValue(g, lo);
    if (g.margin > margin.value) margin = withValue(g, g.margin);
    if (g.total > combined.value) combined = withValue(g, g.total);
  }
  return { highestTeamScore: highest, lowestTeamScore: lowest, largestMargin: margin, highestCombined: combined, totalGames: games.length };
}

export function seasonBestGames(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): SeasonBestGames {
  const games = countedGames(snapshot);
  const closest = [...games].sort((a, b) => a.margin - b.margin || b.total - a.total).slice(0, 5);
  const highestScoring = [...games].sort((a, b) => b.total - a.total).slice(0, 5);
  return { closest, highestScoring };
}
```

- [ ] **Step 4: Run the test — expect PASS.** `npx vitest run src/lib/season-recap.test.ts` — all cases green (champion `New York Knicks`, series `4-1`, extremes in probed ranges 157/66/55/302, closest/highest lists of 5).

- [ ] **Step 5: Typecheck.** `npx tsc --noEmit` — 0 errors.

- [ ] **Step 6: Commit.**
```
git add src/lib/season-recap.ts src/lib/season-recap.test.ts
git commit -m "feat(recap): season-recap.ts pure derivations over the 2025-26 snapshot"
```

---

### Task T4b: create the `/season/2025-26` server page

**Files:**
- Create: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/app/season/2025-26/page.tsx`

- [ ] **Step 1: Create the page file.** Create `src/app/season/2025-26/page.tsx` (server component, momentum template: Breadcrumbs → PageHeader → content → RelatedPages). Do NOT add `export const revalidate` — this route stays dynamic SSR (`getLocale()` reads cookies). Full content:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Flame, Target, Crown, Award, BookOpen, History } from "lucide-react";
import { getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { teamLogoUrl } from "@/lib/teamUrls";
import { finalsResult, seasonRecordExtremes, seasonBestGames, type ExtremeGame, type RecapGame } from "@/lib/season-recap";
import awardsData from "@/data/awards.json";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "2025-26 赛季回顾" : "2025-26 Season Recap",
    description: isZh
      ? "2025-26 NBA 赛季回顾：总冠军、总决赛逐场比分、赛季之最与年度最佳比赛。"
      : "A recap of the 2025-26 NBA season — champion, Finals game-by-game, season extremes, and the year's best games.",
  };
}

interface AwardRow {
  season: string;
  player: string;
  team: string;
}

const AWARD_META = [
  { key: "mvp", en: "MVP", zh: "常规赛 MVP" },
  { key: "fmvp", en: "Finals MVP", zh: "总决赛 MVP" },
  { key: "dpoy", en: "Defensive Player", zh: "最佳防守球员" },
  { key: "roy", en: "Rookie of the Year", zh: "最佳新秀" },
  { key: "smoy", en: "Sixth Man", zh: "最佳第六人" },
  { key: "mip", en: "Most Improved", zh: "进步最快球员" },
] as const;

function isPlaceholder(v: string): boolean {
  const s = v.trim();
  return s === "" || s === "TBD" || s === "-";
}

function ExtremeTile({ game, eyebrow, label, color, badgePrefix = "" }: { game: ExtremeGame | null; eyebrow: string; label: string; color: string; badgePrefix?: string }) {
  if (!game) return null;
  return (
    <Link href={`/game/${game.gameId}`} className="glass-tile p-3 sm:p-4 flex flex-col gap-1.5 group cursor-pointer">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">/ {eyebrow}</p>
      <span className="text-2xl sm:text-3xl font-light font-mono tabular-nums leading-none" style={{ color }}>{badgePrefix}{game.value}</span>
      <p className="text-[11px] font-medium text-text-primary leading-tight">{label}</p>
      <div className="flex items-center gap-1 text-[10px] font-mono text-text-secondary mt-0.5">
        <span>{game.awayTricode} {game.awayScore}</span>
        <span className="text-text-secondary/40">@</span>
        <span>{game.homeTricode} {game.homeScore}</span>
      </div>
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{game.gameDate}</p>
    </Link>
  );
}

function BestRow({ game, badge, color }: { game: RecapGame; badge: string; color: string }) {
  const homeWon = game.homeScore > game.awayScore;
  return (
    <Link href={`/game/${game.gameId}`} className="glass-tile p-4 flex items-center gap-3 group cursor-pointer">
      <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55` }}>
        <span className="text-xl font-light font-mono tabular-nums" style={{ color }}>{badge}</span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Image src={teamLogoUrl(game.awayTeamId)} alt={game.awayTricode} width={26} height={26} unoptimized />
          <span className={`text-sm font-bold font-mono ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>{game.awayTricode}</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{game.awayScore}</span>
          <span className="text-text-secondary/40">·</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{game.homeScore}</span>
          <span className={`text-sm font-bold font-mono ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>{game.homeTricode}</span>
          <Image src={teamLogoUrl(game.homeTeamId)} alt={game.homeTricode} width={26} height={26} unoptimized />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary shrink-0">{game.gameDate}</p>
      </div>
    </Link>
  );
}

export default async function SeasonRecapPage() {
  const isZh = (await getLocale()) === "zh";
  const finals = finalsResult();
  const extremes = seasonRecordExtremes();
  const best = seasonBestGames();

  const awardTable = awardsData as Record<string, AwardRow[]>;
  const awards2526 = AWARD_META
    .map((m) => {
      const row = (awardTable[m.key] ?? []).find((r) => r.season === "2025-26");
      return row && !isPlaceholder(row.player)
        ? { key: m.key, en: m.en, zh: m.zh, player: row.player, team: row.team }
        : null;
    })
    .filter((a): a is { key: string; en: string; zh: string; player: string; team: string } => a !== null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "2025-26 赛季回顾" : "2025-26 Season Recap" }]} />
      <PageHeader
        eyebrow="2025-26"
        icon={Trophy}
        title={isZh ? "赛季回顾" : "Season Recap"}
        subtitle={finals.champion
          ? (isZh ? `${finals.champion} 夺冠 · 总决赛 ${finals.seriesText} 击败 ${finals.runnerUp}` : `${finals.champion} — ${finals.seriesText} in the Finals over the ${finals.runnerUp}`)
          : undefined}
        updatedAt={getScheduleAge()}
      />

      {finals.games.length > 0 && (
        <section className="glass-tile p-5 sm:p-6 mb-8 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative flex items-center gap-4">
            <Image src={teamLogoUrl(finals.championTeamId)} alt={finals.championTricode} width={64} height={64} unoptimized className="shrink-0" />
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber">{isZh ? "总冠军" : "Champion"}</p>
              <h2 className="text-xl font-semibold text-text-primary tracking-tight">{finals.champion}</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {isZh ? `总决赛 ${finals.seriesText} 击败 ${finals.runnerUp}` : `${finals.seriesText} in the Finals over the ${finals.runnerUp}`}
              </p>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
            {finals.games.map((g, i) => {
              const champHome = g.homeTricode === finals.championTricode;
              const champScore = champHome ? g.homeScore : g.awayScore;
              const oppScore = champHome ? g.awayScore : g.homeScore;
              const champWon = champScore > oppScore;
              return (
                <Link key={g.gameId} href={`/game/${g.gameId}`} className="glass-tile p-3 text-center group cursor-pointer">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? `第 ${i + 1} 场` : `Game ${i + 1}`}</p>
                  <p className={`text-lg font-light font-mono tabular-nums mt-1 ${champWon ? "text-accent-amber" : "text-text-secondary"}`}>{champScore}-{oppScore}</p>
                  <p className="text-[10px] font-mono text-text-secondary">{champWon ? (isZh ? "胜" : "W") : (isZh ? "负" : "L")} · {g.gameDate.slice(5)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "赛季之最" : "Season Extremes"}</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight mt-1">{isZh ? "单场纪录" : "Single-Game Records"}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ExtremeTile game={extremes.highestTeamScore} eyebrow={isZh ? "顶级得分" : "Top Score"} label={isZh ? "球队单场最高得分" : "Highest team score"} color="#FFD700" />
          <ExtremeTile game={extremes.highestCombined} eyebrow={isZh ? "对攻战" : "Shootout"} label={isZh ? "两队总得分最高" : "Highest combined"} color="#22C55E" />
          <ExtremeTile game={extremes.largestMargin} eyebrow={isZh ? "屠杀" : "Beatdown"} label={isZh ? "最大分差" : "Largest margin"} color="#F59E0B" badgePrefix="+" />
          <ExtremeTile game={extremes.lowestTeamScore} eyebrow={isZh ? "冷夜" : "Cold Night"} label={isZh ? "球队单场最低得分" : "Lowest team score"} color="#94A3B8" />
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "年度最佳" : "Best of the Year"}</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
            <Target size={16} className="text-danger" />
            {isZh ? "最焦灼的比赛" : "Closest Games"}
          </h2>
        </div>
        <div className="space-y-2">
          {best.closest.map((g) => (
            <BestRow key={g.gameId} game={g} badge={`+${g.margin}`} color="#DF1B41" />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <Flame size={16} className="text-success" />
            {isZh ? "最高得分之战" : "Highest-Scoring Games"}
          </h2>
        </div>
        <div className="space-y-2">
          {best.highestScoring.map((g) => (
            <BestRow key={g.gameId} game={g} badge={String(g.total)} color="#22C55E" />
          ))}
        </div>
      </section>

      {awards2526.length > 0 && (
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "年度奖项" : "Season Awards"}</p>
            <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
              <Award size={16} className="text-accent" />
              {isZh ? "个人奖项" : "Individual Hardware"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {awards2526.map((a) => (
              <div key={a.key} className="glass-tile p-3">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? a.zh : a.en}</p>
                <p className="text-sm font-semibold text-text-primary mt-1">{a.player}</p>
                {a.team !== "-" && <p className="text-[10px] font-mono text-text-secondary">{a.team}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/history", label: isZh ? "历届冠军" : "NBA Champions", description: isZh ? "历届总冠军与总决赛" : "Past champions and Finals", icon: History },
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", description: isZh ? "单场最高与最低" : "Single-game highs and lows", icon: BookOpen },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", description: isZh ? "生涯数据领跑者" : "Career stat leaders", icon: Crown },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季精彩对决" : "Top games of the season", icon: Flame },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` — 0 errors. (Watch points: the `as Record<string, AwardRow[]>` cast enables dynamic `m.key` indexing; the inline `type ExtremeGame, type RecapGame` import mirrors the existing pattern in `src/app/best-games/page.tsx`.)

- [ ] **Step 3: Manual dev-server check (record for the later UI pass, do NOT run the server now).** After all of T4 lands, run `npm run dev` and open `http://localhost:3000/season/2025-26`. Verify: (a) champion card shows the Knicks logo + "New York Knicks" + "总决赛 4-1 击败 San Antonio Spurs" + 5 Finals game tiles (`105-95`, `105-104`, `111-115` shown as L, `107-106`, `94-90`); (b) 4 extremes tiles with `157` / `302` / `+55` / `66`, each deep-linking to `/game/<id>`; (c) Closest Games list = 5 rows all `+1`; (d) Highest-Scoring list = 5 rows starting at `302`; (e) Awards section is ABSENT (awards.json 2025-26 all `TBD`); (f) flip the `locale` cookie to `en` and confirm English strings + metadata. Note: local AdGuardHome occupies `127.0.0.1:3000` — a stray 401 on localhost is that, not the app.

- [ ] **Step 4: Commit.**
```
git add "src/app/season/2025-26/page.tsx"
git commit -m "feat(recap): /season/2025-26 season recap page"
```

---

### Task T4c: register the route in the 3 discovery surfaces

**Files:**
- Modify: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/lib/useMoreGroups.ts`
- Modify: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/app/explore/page.tsx`
- Modify: `C:/Users/FXY/OneDrive/Desktop/Code/nba比分记录/nba-tracker/src/app/sitemap.ts`

- [ ] **Step 1: Add to the "More" nav group in `useMoreGroups.ts`.** `Trophy` is already imported at the top of this file. In the last group (title `"更多" / "More"`), find this exact pair:

```tsx
        { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", icon: CalendarDays, keywords: "on this day history" },
        { href: "/history", label: t.nav.champions, icon: History, keywords: "champions finals history" },
```

Replace it with (inserts one line between them):

```tsx
        { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", icon: CalendarDays, keywords: "on this day history" },
        { href: "/season/2025-26", label: isZh ? "赛季回顾" : "Season Recap", icon: Trophy, keywords: "season recap 2025-26 champion finals knicks" },
        { href: "/history", label: t.nav.champions, icon: History, keywords: "champions finals history" },
```

- [ ] **Step 2: Add to the "Game Archive" category in `explore/page.tsx`.** `Crown` is already imported at the top of this file. In the `比赛档案 / Game Archive` category, find this exact pair:

```tsx
        { href: "/history", label: isZh ? "总冠军" : "Champions", description: isZh ? "历届 NBA 总冠军与总决赛" : "Past NBA champions and Finals", icon: History },
        { href: "/h2h", label: isZh ? "历史交锋" : "Head to Head", description: isZh ? "任意两队的对战历史" : "Series history between any two teams", icon: Swords },
```

Replace it with:

```tsx
        { href: "/history", label: isZh ? "总冠军" : "Champions", description: isZh ? "历届 NBA 总冠军与总决赛" : "Past NBA champions and Finals", icon: History },
        { href: "/season/2025-26", label: isZh ? "赛季回顾" : "Season Recap", description: isZh ? "2025-26 冠军、总决赛与赛季之最" : "2025-26 champion, Finals, and season superlatives", icon: Crown },
        { href: "/h2h", label: isZh ? "历史交锋" : "Head to Head", description: isZh ? "任意两队的对战历史" : "Series history between any two teams", icon: Swords },
```

- [ ] **Step 3: Add to the `news` array in `sitemap.ts`.** Find this exact block:

```ts
    { url: `${BASE}/this-day`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/history`, changeFrequency: "yearly", priority: 0.4 },
  ];
```

Replace it with:

```ts
    { url: `${BASE}/this-day`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/history`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/season/2025-26`, changeFrequency: "monthly", priority: 0.5 },
  ];
```

- [ ] **Step 4: Typecheck.** `npx tsc --noEmit` — 0 errors.

- [ ] **Step 5: Manual dev-server check (record for the later UI pass).** In `npm run dev`: open the command palette / More menu and confirm "赛季回顾 / Season Recap" appears under More and navigates to `/season/2025-26`; open `/explore` and confirm the new card under "比赛档案 / Game Archive"; hit `/sitemap.xml` and confirm `https://nba.xpy.me/season/2025-26` is present.

- [ ] **Step 6: Commit.**
```
git add src/lib/useMoreGroups.ts "src/app/explore/page.tsx" src/app/sitemap.ts
git commit -m "feat(recap): register season recap in more-menu, explore, sitemap"
```

---

## T5. Offseason home hero

**Depends on T2/T3/T4 routes for its cross-links.** The hero links to `/transactions` (existing page), `/draft/2026` (created in T3), and `/season/2025-26` (created in T4). These are plain `<Link href>` / `<a href>` strings — they compile and render regardless of whether the target pages exist yet (they'd 404 at runtime only). Per the spec build order (T1→T2→T3→T4→T5), ship T5 last so all targets resolve. **T5 does NOT import from T4's `src/lib/season-recap.ts`** — the champion banner is derived locally from `SEASON_SNAPSHOT` so this task compiles and ships independently of T4's not-yet-defined `finalsResult` return shape.

**Design decisions (locked):**
- **Offseason predicate:** pure date-window rule, `now > PLAYOFFS_END && now < NEXT_SEASON_START_ESTIMATE`. This matches `SeasonProgress`'s `now > playoffsEnd` offseason branch but bounds the top end so the hero auto-hides once the estimated new season starts. Evaluated first, before any `await`, so in-season the component returns `null` with zero fetches and zero layout impact.
- **Countdown:** server-computed static text (`N days · est. late October`), NOT a live client ticker — chosen to keep `OffseasonHero` a pure server component (no `useState`/`useEffect`, no client-component split).
- **Data fetching:** ESPN transactions + news fetched directly server-side inside the component (same UA header + `AbortSignal` 5s timeout + `next.revalidate` + shape guard as `src/app/api/transactions/route.ts`), NOT via an internal HTTP call to our own `/api/*` route (that would need an absolute origin URL and is fragile). Each fetch is wrapped in try/catch returning `[]` — the section degrades gracefully (renders an empty-state line) and never throws the home page.
- **Images:** champion logo is `cdn.nba.com` → `next/image` (in `remotePatterns`, `unoptimized` like `momentum`/`BestOfNightCard`). Transaction team logos are ESPN `a.espncdn.com` (NOT in `remotePatterns`) → plain `<img>` with the same eslint-disable precedent as `src/app/news/NewsFeed.tsx:149`.

### Task T5a: add `NEXT_SEASON_START_ESTIMATE` constant

**Files:**
- Modify: `src/lib/constants.ts`
- Verify: `npx tsc --noEmit`

- [ ] **Step 1: Append the labeled estimate constant.** In `src/lib/constants.ts`, the file currently ends with:
  ```ts
  export const SEASON_START = "2025-10-21";
  export const SEASON_END = "2026-04-12";
  export const PLAYOFFS_END = "2026-06-21";
  ```
  Change to (add one constant + WHY comment after `PLAYOFFS_END`):
  ```ts
  export const SEASON_START = "2025-10-21";
  export const SEASON_END = "2026-04-12";
  export const PLAYOFFS_END = "2026-06-21";
  // Estimated 2026-27 tip-off — the CDN has not published the 2026-27 schedule
  // yet. Drives the offseason home-hero countdown and doubles as its upper
  // guard bound (the hero auto-hides once now passes this date). Update to the
  // real opening date once the schedule publishes; UI labels it "预计/est." until then.
  export const NEXT_SEASON_START_ESTIMATE = "2026-10-20";
  ```
- [ ] **Step 2: Typecheck.** Run `npx tsc --noEmit` — expect 0 errors (a new exported string constant cannot break types).
- [ ] **Step 3: Commit.** `git add src/lib/constants.ts && git commit -m "feat(home): add NEXT_SEASON_START_ESTIMATE offseason-countdown constant"`

### Task T5b: create `OffseasonHero` server component

**Files:**
- Create: `src/components/OffseasonHero.tsx`
- Verify: `npx tsc --noEmit`

This is an `async` server component with data fetches — not practically unit-testable, so there is no vitest file; verify via `tsc` + the T5c manual dev-server check. The only pure logic (`deriveChampion`) is validated implicitly by the manual check rendering "New York Knicks · Finals 4-1 def. San Antonio Spurs" (confirmed by a live probe of `SEASON_SNAPSHOT`: Finals games are gameId prefix `004` with round digit `charAt(7)==='4'`; NYK wins 4, SAS wins 1).

- [ ] **Step 1: Create the file with the full component.** Write `src/components/OffseasonHero.tsx` with exactly this content:
  ```tsx
  import Link from "next/link";
  import Image from "next/image";
  import { Trophy, CalendarClock, ArrowLeftRight, Newspaper, ArrowRight, Sparkles } from "lucide-react";
  import { getLocale } from "@/lib/locale";
  import { teamLogoUrl } from "@/lib/teamUrls";
  import { SEASON_SNAPSHOT, type SnapshotTeam } from "@/lib/season-snapshot";
  import { CURRENT_SEASON, PLAYOFFS_END, NEXT_SEASON_START_ESTIMATE } from "@/lib/constants";

  interface EspnTxn {
    date?: string;
    description?: string;
    team?: { abbreviation?: string; logos?: { href?: string }[] };
  }
  interface HeroTxn {
    date: string;
    teamAbbr: string;
    teamLogo: string;
    description: string;
  }
  interface HeroNews {
    headline: string;
    link: string;
    published: string;
  }

  // Mirrors the /api/transactions route fetch (UA header + 5s abort + revalidate
  // + shape guard); best-effort — any failure degrades to an empty section.
  async function fetchLatestTransactions(): Promise<HeroTxn[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=20",
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          next: { revalidate: 1800 },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const items: EspnTxn[] = data.transactions || data.items || [];
      if (!Array.isArray(items)) return [];
      return items.slice(0, 5).map((t) => ({
        date: t.date || "",
        teamAbbr: t.team?.abbreviation || "",
        teamLogo: t.team?.logos?.[0]?.href || "",
        description: t.description || "",
      }));
    } catch {
      return [];
    }
  }

  async function fetchTopNews(): Promise<HeroNews[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=10",
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          next: { revalidate: 1800 },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const articles: { headline?: string; links?: { web?: { href?: string } }; published?: string }[] =
        data.articles || [];
      if (!Array.isArray(articles)) return [];
      return articles.slice(0, 3).map((a) => ({
        headline: a.headline || "",
        link: a.links?.web?.href || "",
        published: a.published || "",
      }));
    } catch {
      return [];
    }
  }

  // Derive last season's champion from the frozen snapshot's Finals games
  // (playoff prefix "004", round digit "4") instead of importing T4's
  // season-recap lib, so this hero compiles and ships independently.
  function deriveChampion(): { champ: SnapshotTeam; runner: SnapshotTeam; seriesText: string } | null {
    const finals = SEASON_SNAPSHOT.finishedGames.filter(
      (g) => g.gameId.startsWith("004") && g.gameId.charAt(7) === "4"
    );
    if (finals.length === 0) return null;
    const wins: Record<string, number> = {};
    for (const g of finals) {
      const winner = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
      wins[winner] = (wins[winner] || 0) + 1;
    }
    const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    if (ranked.length < 2) return null;
    const champ = SEASON_SNAPSHOT.teams.find((t) => t.tricode === ranked[0][0]);
    const runner = SEASON_SNAPSHOT.teams.find((t) => t.tricode === ranked[1][0]);
    if (!champ || !runner) return null;
    return { champ, runner, seriesText: `${ranked[0][1]}-${ranked[1][1]}` };
  }

  export default async function OffseasonHero() {
    // Offseason predicate: strictly after last season's playoffs and before the
    // estimated next tip-off. Evaluated before any await, so in-season this
    // returns null with no fetch and no layout impact on the home page.
    const now = Date.now();
    const playoffsEnd = new Date(PLAYOFFS_END).getTime();
    const nextStart = new Date(NEXT_SEASON_START_ESTIMATE).getTime();
    if (!(now > playoffsEnd && now < nextStart)) return null;

    const isZh = (await getLocale()) === "zh";
    const [transactions, news] = await Promise.all([fetchLatestTransactions(), fetchTopNews()]);
    const finals = deriveChampion();
    const daysUntil = Math.max(0, Math.ceil((nextStart - now) / 86_400_000));

    const fmtDate = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString(isZh ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
    };

    return (
      <section className="mt-4 mb-2">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={12} className="text-accent-amber" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber">
            {isZh ? "休赛期" : "Offseason"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Champion banner + countdown */}
          <div className="space-y-3">
            {finals && (
              <Link
                href="/season/2025-26"
                className="glass-tile relative overflow-hidden p-4 flex items-center gap-3 group cursor-pointer hover:border-accent/40 transition-colors"
              >
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.5) 0%, transparent 70%)" }}
                />
                <Image
                  src={teamLogoUrl(finals.champ.teamId)}
                  alt={finals.champ.tricode}
                  width={48}
                  height={48}
                  unoptimized
                  className="relative shrink-0"
                />
                <div className="relative min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={11} className="text-accent-amber shrink-0" />
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber">
                      {CURRENT_SEASON} {isZh ? "总冠军" : "Champions"}
                    </span>
                  </div>
                  <p className="font-bold text-text-primary truncate mt-0.5">
                    {finals.champ.teamCity} {finals.champ.teamName}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-text-secondary">
                    {isZh ? "总决赛" : "Finals"} {finals.seriesText} {isZh ? "胜" : "def."}{" "}
                    {finals.runner.teamCity} {finals.runner.teamName}
                  </p>
                </div>
              </Link>
            )}

            <div className="glass-tile p-4 flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CalendarClock size={18} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                  {isZh ? "预计开赛" : "Est. tip-off"}
                </p>
                <p className="font-bold text-text-primary">
                  <span className="font-mono tabular-nums text-accent">{daysUntil}</span> {isZh ? "天" : "days"}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {isZh ? "预计 10 月下旬回归" : "est. late October"}
                </p>
              </div>
            </div>
          </div>

          {/* Latest transactions */}
          <Link
            href="/transactions"
            className="glass-tile p-4 group cursor-pointer hover:border-accent/40 transition-colors block"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <ArrowLeftRight size={12} className="text-accent" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                {isZh ? "最新交易" : "Latest moves"}
              </span>
              <ArrowRight
                size={12}
                className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all ml-auto"
              />
            </div>
            {transactions.length === 0 ? (
              <p className="text-[11px] text-text-secondary">
                {isZh ? "暂无交易数据" : "No transactions available"}
              </p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((tx, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {tx.teamLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as NewsFeed
                      <img
                        src={tx.teamLogo}
                        alt={tx.teamAbbr}
                        width={16}
                        height={16}
                        loading="lazy"
                        className="mt-0.5 shrink-0"
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                      {fmtDate(tx.date) && (
                        <span className="text-text-secondary/50 font-mono mr-1">{fmtDate(tx.date)}</span>
                      )}
                      {tx.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Link>

          {/* Top news + quick links */}
          <div className="space-y-3">
            <div className="glass-tile p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Newspaper size={12} className="text-accent" />
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                  {isZh ? "热点新闻" : "Headlines"}
                </span>
              </div>
              {news.length === 0 ? (
                <p className="text-[11px] text-text-secondary">{isZh ? "暂无新闻" : "No headlines available"}</p>
              ) : (
                <ul className="space-y-2">
                  {news.map((n, i) => (
                    <li key={i}>
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-text-secondary hover:text-accent transition-colors leading-snug line-clamp-2 block"
                      >
                        {n.headline}
                        {fmtDate(n.published) && (
                          <span className="text-text-secondary/50 font-mono ml-1">· {fmtDate(n.published)}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/draft/2026"
                className="glass-tile p-3 flex items-center gap-2 group cursor-pointer hover:border-accent/40 transition-colors"
              >
                <Sparkles size={14} className="text-accent shrink-0" />
                <span className="text-[11px] font-medium text-text-primary group-hover:text-accent transition-colors">
                  {isZh ? "2026 选秀" : "2026 Draft"}
                </span>
              </Link>
              <Link
                href="/season/2025-26"
                className="glass-tile p-3 flex items-center gap-2 group cursor-pointer hover:border-accent/40 transition-colors"
              >
                <Trophy size={14} className="text-accent shrink-0" />
                <span className="text-[11px] font-medium text-text-primary group-hover:text-accent transition-colors">
                  {isZh ? "赛季回顾" : "Season recap"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
  ```
- [ ] **Step 2: Typecheck.** Run `npx tsc --noEmit` — expect 0 errors. (The file is created but not yet mounted; an unused module compiles cleanly.)
- [ ] **Step 3: Commit.** `git add src/components/OffseasonHero.tsx && git commit -m "feat(home): offseason hero (champion banner, countdown, moves, news)"`

### Task T5c: mount `<OffseasonHero />` on the home page

**Files:**
- Modify: `src/app/page.tsx`
- Verify: `npx tsc --noEmit`; then manual dev-server check

- [ ] **Step 1: Add the import.** In `src/app/page.tsx`, the current import block (lines 1-8) is:
  ```tsx
  import type { Metadata } from "next";
  import { Suspense } from "react";
  import { formatDate, getTodayScoreboard, type ScheduleGame } from "@/lib/api";
  import HomeClient from "@/components/HomeClient";
  import DailyIconicPick from "@/components/DailyIconicPick";
  import BestOfNightCard from "@/components/BestOfNightCard";
  import { getLocale } from "@/lib/locale";
  import { getTranslations } from "@/locales";
  ```
  Add the `OffseasonHero` import after the `BestOfNightCard` line:
  ```tsx
  import type { Metadata } from "next";
  import { Suspense } from "react";
  import { formatDate, getTodayScoreboard, type ScheduleGame } from "@/lib/api";
  import HomeClient from "@/components/HomeClient";
  import DailyIconicPick from "@/components/DailyIconicPick";
  import BestOfNightCard from "@/components/BestOfNightCard";
  import OffseasonHero from "@/components/OffseasonHero";
  import { getLocale } from "@/lib/locale";
  import { getTranslations } from "@/locales";
  ```
  (`Suspense` is already imported on line 2 — do not re-add it.)
- [ ] **Step 2: Mount the hero above `<HomeClient>`, inside the container, after the sr-only h1.** The current render block is:
  ```tsx
      <h1 className="sr-only">{t.meta.siteTitle}</h1>
      <HomeClient initialDate={initialDate} initialGames={initialGames} initialIsToday={initialDate === today} />
  ```
  Change to (wrap in `Suspense fallback={null}`, mirroring the `BestOfNightCard` streaming pattern so ESPN fetches never block the shell):
  ```tsx
      <h1 className="sr-only">{t.meta.siteTitle}</h1>
      {/* Offseason-only hero. Self-guards to null in-season BEFORE any await, so
          the in-season home layout is byte-identical to before. Streams in above
          the scoreboard so its ESPN transaction/news fetches never block TTFB. */}
      <Suspense fallback={null}>
        <OffseasonHero />
      </Suspense>
      <HomeClient initialDate={initialDate} initialGames={initialGames} initialIsToday={initialDate === today} />
  ```
- [ ] **Step 2b: Confirm no in-season layout impact.** Reason through it (no code): `OffseasonHero` runs its date guard (`now > PLAYOFFS_END && now < NEXT_SEASON_START_ESTIMATE`) synchronously before any `await`, returning `null` in-season. The wrapping `<Suspense fallback={null}>` therefore resolves to `null` immediately with no fetch — the DOM above `<HomeClient>` is empty, exactly as before this change. No revalidate/caching change is introduced; the page remains `force-dynamic`.
- [ ] **Step 3: Typecheck.** Run `npx tsc --noEmit` — expect 0 errors.
- [ ] **Step 4: Manual dev-server check (offseason golden path — it IS offseason today, 2026-07-09).** Run `npm run dev` and open the home page at the URL Next prints. (Per the spec: `127.0.0.1:3000` is occupied by local AdGuardHome and may return a spurious 401 — if so, use the alternate host/port Next reports, not an app bug.) Verify the hero renders directly above the scoreboard, showing:
  - "休赛期 / Offseason" eyebrow with sparkle.
  - Champion banner: Knicks logo + "New York Knicks" + "总决赛 4-1 胜 / Finals 4-1 def. San Antonio Spurs", linking to `/season/2025-26`.
  - Countdown tile: "预计开赛 / Est. tip-off" + "N 天 / N days" (N ≈ days to 2026-10-20) + "预计 10 月下旬回归 / est. late October".
  - Latest-moves tile: up to 5 ESPN transactions, each with an ESPN team logo + description, the whole tile linking to `/transactions`.
  - Headlines tile: 3 ESPN news headlines opening in a new tab.
  - Quick-links: "2026 选秀 / 2026 Draft" → `/draft/2026`, "赛季回顾 / Season recap" → `/season/2025-26`.
  Toggle the locale cookie to confirm EN/ZH strings both render. If T3/T4 are not yet merged, `/draft/2026` and `/season/2025-26` will 404 — that is expected until those tasks land (the hero itself renders fine).
- [ ] **Step 5: Manual in-season no-op check (temporary).** Temporarily edit `src/lib/constants.ts` `NEXT_SEASON_START_ESTIMATE` to a past date (e.g. `"2026-06-30"`), reload the home page: the hero must disappear entirely and the scoreboard/`HomeClient` must be unchanged (no gap, no shift). Then **revert** the constant back to `"2026-10-20"` before committing.
- [ ] **Step 6: Commit.** `git add src/app/page.tsx && git commit -m "feat(home): mount offseason hero above the scoreboard"`
