import { describe, expect, it } from "vitest";
import { resolveRecoveryCandidate, type RecoveryTarget } from "./recovery-candidates";

const target: RecoveryTarget = { nbaGameId: "0022500340", season: "2025-26", gameDate: "2025-12-05", home: { tricode: "ATL", score: 133 }, away: { tricode: "DEN", score: 134 }, lookupDates: ["2025-12-05"] };
// Relevant-field projection of the actual credential-free excerpt supplied for
// schema inspection. Original total30 is intentionally preserved: NOT complete.
const actualExcerpt = {
  data: [{ id: "a8da9b0f-573e-4b78-9cf4-7f2838449969", sport: "basketball", league: "NBA", home: { name: "Atlanta Hawks", short_name: "ATL" }, away: { name: "Denver Nuggets", short_name: "DEN" }, kickoff_utc: "2025-12-05T19:30:00.000Z", status: "finished", score: { home: 133, away: 134 } }],
  meta: { date_window: { date: "2025-12-05", timezone: "UTC", start_utc: "2025-12-05T00:00:00.000Z", end_utc: "2025-12-06T00:00:00.000Z" } },
  pagination: { total: 30, limit: 100, offset: 0 },
};
// SYNTHETIC complete envelope derived from the observed row. This is a fixture,
// not evidence that a complete live list was fetched or uniqueness proven live.
const fullBody = () => ({ ...structuredClone(actualExcerpt), pagination: { total: 1, limit: 100, offset: 0 } });
const page = () => ({ requestedDate: "2025-12-05", body: fullBody() });
const pageFor = (date: string) => {
  const p = page(); p.requestedDate = date; p.body.meta.date_window.date = date;
  p.body.meta.date_window.start_utc = `${date}T00:00:00.000Z`;
  p.body.meta.date_window.end_utc = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString();
  return p;
};
const fail = (t: unknown, p: unknown, reason?: string) => {
  const r = resolveRecoveryCandidate(t, p); expect(r.ok).toBe(false); expect(r).not.toHaveProperty("game");
  if (!r.ok && reason) expect(r.reason).toBe(reason);
};

describe("offline provider candidate resolution", () => {
  it("rejects the actual truncated excerpt despite its exact matching row", () => fail(target, [{ requestedDate: target.gameDate, body: actualExcerpt }], "incomplete-or-mismatched-list-page"));
  it("resolves a SYNTHETIC complete page derived from the actual row", () => {
    const identity = { nbaGameId: target.nbaGameId, season: target.season, gameDate: target.gameDate, home: target.home, away: target.away };
    expect(resolveRecoveryCandidate(target, [page()])).toEqual({ ok: true, game: { ...identity, providerMatchId: actualExcerpt.data[0].id } });
  });
  it("ignores provider time-of-day and preserves the authoritative target date", () => {
    const p = page(); p.body.data[0].kickoff_utc = "2025-12-05T01:00:00Z";
    const r = resolveRecoveryCandidate(target, [p]); expect(r.ok).toBe(true);
    if (r.ok) expect(r.game.gameDate).toBe("2025-12-05");
  });
  it("finds an adjacent-date candidate only after both complete pages are supplied", () => {
    const t = { ...target, lookupDates: ["2025-12-05", "2025-12-06"] };
    const first = page(); first.body.data = []; first.body.pagination.total = 0;
    const second = pageFor("2025-12-06"); second.body.data[0].kickoff_utc = "2025-12-06T00:30:00Z";
    expect(resolveRecoveryCandidate(t, [first, second]).ok).toBe(true);
    fail(t, [second], "incomplete-date-pages");
  });
  it("deduplicates consistent UUIDs across two adjacent pages without guessing a tip-off", () => {
    const t = { ...target, lookupDates: ["2025-12-05", "2025-12-06"] };
    const second = pageFor("2025-12-06"); second.body.data[0].id = second.body.data[0].id.toUpperCase(); second.body.data[0].kickoff_utc = "2025-12-05T22:00:00Z";
    expect(resolveRecoveryCandidate(t, [page(), second]).ok).toBe(true);
  });
  it("rejects contradictory identities for one UUID even with another valid match", () => {
    const t = { ...target, lookupDates: ["2025-12-05", "2025-12-06"] };
    const second = pageFor("2025-12-06"); second.body.data[0].score.home = 132;
    fail(t, [page(), second], "contradictory-match-uuid");
  });
  it("never chooses the first of two otherwise matching UUIDs", () => {
    const p = page(); p.body.data.push({ ...structuredClone(p.body.data[0]), id: "5ce3b301-7023-433a-b8d1-ce8ee1b306be" }); p.body.pagination.total = 2;
    fail(target, [p], "ambiguous-matching-games");
  });
  it("rejects repeated UUIDs within a single page instead of treating them as pagination proof", () => {
    const p = page(); p.body.data.push(structuredClone(p.body.data[0])); p.body.pagination.total = 2;
    fail(target, [p], "duplicate-match-uuid-within-page");
  });
  it.each([
    { score: { home: 132, away: 134 } }, { home: { name: "Boston Celtics", short_name: "BOS" } }, { status: "scheduled" },
    { league: "Other league" }, { sport: "soccer" },
  ])("does not match changed score/team/status/league/sport %#", change => {
    const p = page(); Object.assign(p.body.data[0], change); fail(target, [p], "no-matching-finished-game");
  });
  it("does not confuse home and away or accept name/known-shortcode contradictions", () => {
    const p = page(); [p.body.data[0].home, p.body.data[0].away] = [p.body.data[0].away, p.body.data[0].home];
    fail(target, [p], "no-matching-finished-game");
    const q = page(); q.body.data[0].home.short_name = "DEN"; fail(target, [q], "invalid-team-identity");
  });
  it("uses exact canonical full names with explicit LA Clippers equivalence", () => {
    for (const name of ["LA Clippers", "Los Angeles Clippers"]) {
      const p = page(); p.body.data[0].home = { name, short_name: "LAC" };
      expect(resolveRecoveryCandidate({ ...target, home: { ...target.home, tricode: "LAC" } }, [p]).ok).toBe(true);
    }
    const p = page(); p.body.data[0].home = { name: "Hawks", short_name: "ATL" }; fail(target, [p], "invalid-team-identity");
  });
  it("allows documented shortcode aliases but does not derive identity from a shortcode", () => {
    for (const [name, code, tricode] of [["Golden State Warriors", "GS", "GSW"], ["New Orleans Pelicans", "NO", "NOP"], ["New York Knicks", "NY", "NYK"], ["San Antonio Spurs", "SA", "SAS"], ["Utah Jazz", "UTAH", "UTA"], ["Washington Wizards", "WSH", "WAS"]]) {
      const p = page(); p.body.data[0].home = { name, short_name: code };
      expect(resolveRecoveryCandidate({ ...target, home: { ...target.home, tricode } }, [p]).ok).toBe(true);
    }
    const p = page(); p.body.data[0].home.name = "Unknown"; fail(target, [p], "invalid-team-identity");
  });
  it("ignores schema-valid unrelated rows but rejects malformed rows alongside a match", () => {
    const p = page(); p.body.data.push({ ...structuredClone(p.body.data[0]), id: "5ce3b301-7023-433a-b8d1-ce8ee1b306be", league: "WNBA", home: { name: "Other home", short_name: "H" }, away: { name: "Other away", short_name: "A" } }); p.body.pagination.total = 2;
    expect(resolveRecoveryCandidate(target, [p]).ok).toBe(true);
    Reflect.set(p.body.data[1], "score", []); fail(target, [p], "malformed-match-row");
  });

  it.each([
    { total: 2 }, { offset: 1 }, { total: "1" }, { total: -1 }, { total: 101 }, { limit: 0 }, { limit: 101 }, { limit: 0.5 },
  ])("rejects truncation or malformed pagination %#", change => { const p = page(); Object.assign(p.body.pagination, change); fail(target, [p], "incomplete-or-mismatched-list-page"); });
  it.each([
    { date: "2025-12-06" }, { timezone: "America/New_York" }, { start_utc: "2025-12-05T01:00:00Z" }, { end_utc: "2025-12-07T00:00:00Z" },
  ])("rejects contradictory date-window metadata %#", change => { const p = page(); Object.assign(p.body.meta.date_window, change); fail(target, [p]); });
  it.each(["bad", "2025-02-30T19:30:00Z", "2025-12-07T19:30:00Z", "2025-12-05T19:30:00+00:00"])("rejects invalid/outside kickoff date %s", kickoff => { const p = page(); p.body.data[0].kickoff_utc = kickoff; fail(target, [p], "invalid-or-outside-lookup-kickoff-date"); });
  it.each([
    { id: "bad" }, { home: [] }, { away: null }, { score: [] }, { score: { home: "133", away: 134 } },
    { score: { home: NaN, away: 134 } }, { score: { home: 133, away: 133 } }, { score: { home: null, away: null } },
    { league: [] }, { status: null }, { home: { name: "Atlanta Hawks" } },
  ])("rejects malformed candidate fields %#", change => { const p = page(); Object.assign(p.body.data[0], change); fail(target, [p]); });
  it.each([null, [], { data: [] }, { ...fullBody(), data: {} }, { ...fullBody(), meta: [] }, { ...fullBody(), pagination: [] }])("rejects malformed envelopes %#", body => fail(target, [{ requestedDate: target.gameDate, body }]));
  it.each([null, {}, [], [null]])("rejects unknown page collections %#", pages => fail(target, pages));
  it("rejects duplicate/unrequested pages and missing complete pages", () => {
    const t = { ...target, lookupDates: ["2025-12-05", "2025-12-06"] };
    fail(t, [page(), page()], "unexpected-or-duplicate-date-page");
    fail(target, [pageFor("2025-12-06")], "unexpected-or-duplicate-date-page");
    fail(t, [page()], "incomplete-date-pages");
  });
  it.each([[], ["2025-12-05", "2025-12-05"], ["2025-12-06"], ["2025-12-05", "2025-12-07"], ["2025-12-05", "2025-12-04", "2025-12-06"], ["bad"], "2025-12-05"])("rejects invalid target lookup dates %#", lookupDates => fail({ ...target, lookupDates }, [page()]));
  it.each([{ nbaGameId: "bad" }, { season: "2024-25" }, { gameDate: "2025-02-30" }, { home: { tricode: "XXX", score: 133 } }, { providerMatchId: actualExcerpt.data[0].id }])("validates final NBA target identity before resolving %#", change => fail({ ...target, ...change }, [page()]));
  it("does not mutate inputs or return an aliased target", () => {
    const t = structuredClone(target); const p = page(); const before = structuredClone({ t, p }); const r = resolveRecoveryCandidate(t, [p]);
    expect({ t, p }).toEqual(before); if (!r.ok) throw new Error(r.reason); r.game.home.score = 1; expect(t.home.score).toBe(133);
  });
});
