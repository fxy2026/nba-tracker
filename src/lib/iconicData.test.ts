import { describe, it, expect } from "vitest";
import { ICONIC_SEASONS } from "./iconicSeasons";
import { ICONIC_GAMES } from "./iconicGames";
import {
  DECADE_SLUGS,
  GAME_DECADES,
  SEASON_DECADES,
  decadeOfYear,
  gamesForDecade,
  seasonsForDecade,
} from "./decades";

const seasonLabel = (startYear: number) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

const parseSplit = (raw: string) => {
  const m = raw.match(/^(\d+)\/(\d+)$/);
  return m ? { made: Number(m[1]), att: Number(m[2]) } : null;
};

describe("ICONIC_SEASONS invariants", () => {
  it("has globally unique ids", () => {
    const ids = ICONIC_SEASONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encodes every id as `${personId}-${seasonYear}`", () => {
    for (const s of ICONIC_SEASONS) {
      expect(s.id, `${s.name} ${s.season}`).toBe(`${s.personId}-${s.seasonYear}`);
    }
  });

  it("uses positive integer personIds", () => {
    for (const s of ICONIC_SEASONS) {
      expect(Number.isInteger(s.personId), s.id).toBe(true);
      expect(s.personId, s.id).toBeGreaterThan(0);
    }
  });

  it("keeps the season display string consistent with seasonYear", () => {
    for (const s of ICONIC_SEASONS) {
      expect(s.season, s.id).toBe(seasonLabel(s.seasonYear));
    }
  });

  it("buckets every seasonYear into a known decade slug", () => {
    for (const s of ICONIC_SEASONS) {
      expect(DECADE_SLUGS, s.id).toContain(decadeOfYear(s.seasonYear));
    }
  });

  it("stores shooting percentages as decimals in (0, 1)", () => {
    for (const s of ICONIC_SEASONS) {
      for (const pct of [s.fgPct, s.tpPct, s.ftPct]) {
        if (pct === undefined) continue;
        expect(pct, s.id).toBeGreaterThan(0);
        expect(pct, s.id).toBeLessThan(1);
      }
    }
  });

  it("keeps ppg within all-time bounds (Wilt's 50.4 is the ceiling)", () => {
    for (const s of ICONIC_SEASONS) {
      expect(s.ppg, s.id).toBeGreaterThan(0);
      expect(s.ppg, s.id).toBeLessThanOrEqual(50.4);
    }
  });
});

describe("ICONIC_GAMES invariants", () => {
  it("has globally unique ids", () => {
    const ids = ICONIC_GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses valid ISO dates that bucket into a known decade slug", () => {
    for (const g of ICONIC_GAMES) {
      expect(g.date, g.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(g.date).getTime()), g.id).toBe(false);
      expect(DECADE_SLUGS, g.id).toContain(decadeOfYear(parseInt(g.date.slice(0, 4), 10)));
    }
  });

  it("keeps the season label consistent with the game date", () => {
    for (const g of ICONIC_GAMES) {
      expect(g.season, g.id).toMatch(/^\d{4}-\d{2}$/);
      const start = parseInt(g.season.slice(0, 4), 10);
      expect(g.season, g.id).toBe(seasonLabel(start));
      expect([start, start + 1], g.id).toContain(parseInt(g.date.slice(0, 4), 10));
    }
  });

  it("writes finalScore team-score-first, consistent with result", () => {
    for (const g of ICONIC_GAMES) {
      const m = g.finalScore.match(/^(\d+)-(\d+)$/);
      expect(m, `${g.id}: ${g.finalScore}`).not.toBeNull();
      const own = Number(m![1]);
      const opp = Number(m![2]);
      expect(own, g.id).not.toBe(opp);
      expect(g.result, g.id).toBe(own > opp ? "W" : "L");
    }
  });

  it("never records more makes than attempts in a shooting split", () => {
    for (const g of ICONIC_GAMES) {
      for (const raw of [g.fg, g.threeP, g.ft]) {
        if (raw === undefined) continue;
        const split = parseSplit(raw);
        expect(split, `${g.id}: ${raw}`).not.toBeNull();
        expect(split!.att, `${g.id}: ${raw}`).toBeGreaterThan(0);
        expect(split!.made, `${g.id}: ${raw}`).toBeLessThanOrEqual(split!.att);
      }
    }
  });

  it("decomposes pts as 2*FGM + 3PM + FTM whenever fg and ft are recorded", () => {
    // A missing threeP counts as 0 makes here, so entries whose 3P line is
    // unknown (rather than zero) must omit fg/ft entirely — like
    // tmac-13-in-33 — or the card shows a box line that cannot reproduce
    // its own headline number.
    for (const g of ICONIC_GAMES) {
      if (!g.fg || !g.ft) continue;
      const fgm = parseSplit(g.fg)!.made;
      const ftm = parseSplit(g.ft)!.made;
      const tpm = g.threeP ? parseSplit(g.threeP)!.made : 0;
      expect(g.pts, g.id).toBe(2 * fgm + tpm + ftm);
    }
  });

  it("uses positive integer personIds", () => {
    for (const g of ICONIC_GAMES) {
      expect(Number.isInteger(g.personId), g.id).toBe(true);
      expect(g.personId, g.id).toBeGreaterThan(0);
    }
  });
});

describe("decade taxonomy", () => {
  it("advertises only game decades with entries, and the buckets cover every game", () => {
    expect(GAME_DECADES.length).toBeGreaterThan(0);
    let covered = 0;
    for (const d of GAME_DECADES) {
      const games = gamesForDecade(d);
      expect(games.length, d).toBeGreaterThan(0);
      covered += games.length;
    }
    expect(covered).toBe(ICONIC_GAMES.length);
  });

  it("advertises only season decades with entries, and the buckets cover every season", () => {
    expect(SEASON_DECADES.length).toBeGreaterThan(0);
    let covered = 0;
    for (const d of SEASON_DECADES) {
      const seasons = seasonsForDecade(d);
      expect(seasons.length, d).toBeGreaterThan(0);
      covered += seasons.length;
    }
    expect(covered).toBe(ICONIC_SEASONS.length);
  });
});
