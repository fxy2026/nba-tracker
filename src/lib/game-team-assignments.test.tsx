import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "../../docs/evidence/game-team-assignments/manifest.json";
import schedule from "@/data/schedule-2025-26.json";
import recovered from "@/data/recovered-player-boxes.json";
import provider from "@/data/provider-player-boxes.json";
import { validateRecoveredPlayerBox, type RecoveredPlayerBox as Box } from "./recovered-player-box";
import { validateProviderPlayerSnapshot } from "./provider-player-snapshot";
import { getRecoveredPlayerBox } from "./recovered-player-box-archive";
import { getProviderPlayerBox } from "./provider-player-archive";
import RecoveredPlayerBox from "@/app/game/[id]/_components/RecoveredPlayerBox";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const games = schedule.dates.flatMap(day => day.games);
const entries = Object.entries(manifest.games);
const boxes = recovered as Record<string, Box>;
const gameFor = (id: string) => games.find(game => game.gameId === id)!;

it("preserves all 87 prior verified files and all 31 original provider snapshots byte-for-byte", () => {
  expect(Object.entries(manifest.priorVerifiedFiles)).toHaveLength(87);
  for (const [file, expected] of Object.entries(manifest.priorVerifiedFiles)) {
    expect(hash(readFileSync(`src/data/recovered-player-boxes/${file}`)), file).toBe(expected);
  }
  expect(entries).toHaveLength(31);
  expect(entries.reduce((sum, [, evidence]) => sum + evidence.playerCount, 0)).toBe(645);
  for (const [id, evidence] of entries) {
    const bytes = readFileSync(evidence.originalProviderFile);
    expect(hash(bytes), id).toBe(evidence.originalProviderSha256);
    const original = validateProviderPlayerSnapshot(JSON.parse(bytes.toString()))!;
    expect(original).not.toBeNull();
    expect(original.game.nbaGameId).toBe(id);
    expect(original.players).toHaveLength(evidence.playerCount);
    expect(original.players.every(player => player.team === null)).toBe(true);
  }
});

it("promotes exactly the documented 31 games without overlapping active archive identities", () => {
  const files = readdirSync("src/data/recovered-player-boxes").filter(file => file.endsWith(".json"));
  const reviewedFiles = [...Object.keys(manifest.priorVerifiedFiles), ...entries.map(([id]) => `${id}.json`)];
  expect(files).toEqual(expect.arrayContaining(reviewedFiles));
  for (const [id] of entries) expect(Object.hasOwn(provider, id)).toBe(false);
  expect(reviewedFiles.reduce((sum, file) => sum + boxes[file.slice(0, -5)].players.length, 0)).toBe(2607);
});

describe.each(entries)("game-time team evidence for %s", (id, evidence) => {
  it("binds official source, schedule, all played rows and per-team totals", () => {
    const raw = boxes[id];
    expect(hash(readFileSync(`src/data/recovered-player-boxes/${id}.json`))).toBe(evidence.officialSnapshotSha256);
    const box = validateRecoveredPlayerBox(raw, gameFor(id))!;
    expect(box).not.toBeNull();
    expect(box).toMatchObject({ provider: "NBA official final report", providerMatchId: null,
      gameDate: evidence.gameDate, home: evidence.home, away: evidence.away,
      homeScore: evidence.homeScore, awayScore: evidence.awayScore });
    const pdf = evidence.sourceFiles.find(source => source.kind === "pdf")!;
    const page = evidence.sourceFiles.find(source => source.kind === "nba-page")!;
    expect(box.reportUrl).toBe(pdf.url);
    expect(box.retrievedAt).toBe(pdf.retrievedAt);
    expect(box.officialReport).toMatchObject({ reportSha256: pdf.sha256, page: 1, verifiedOn: "2026-10-05" });
    expect(page.url).toContain(`-${id}/box-score`);
    expect(pdf.status).toBe(200); expect(page.status).toBe(200);
    expect(box.players).toHaveLength(evidence.playerCount);
    expect(new Set(box.players.map(player => player.name)).size).toBe(box.players.length);
    const names = evidence.nameToTeam as Record<string, string>;
    for (const player of box.players) {
      expect(player.team).toBe(names[player.name]);
      expect(player.providerPlayerId).toBeNull();
      expect(player).not.toHaveProperty("personId");
      expect(player.source).toBe("NBA official final report");
      expect(player.officialSource).toMatchObject({ reportUrl: pdf.url, reportSha256: pdf.sha256, page: 1 });
      expect(player.officialSource!.officialDuration).toMatch(/^\d{2}:[0-5]\d$/);
    }
    for (const team of [box.home, box.away]) {
      const rows = box.players.filter(player => player.team === team);
      expect(rows.filter(player => player.starter)).toHaveLength(5);
      expect(rows.reduce((sum, player) => sum + player.points, 0)).toBe(team === box.home ? box.homeScore : box.awayScore);
    }
    expect(getRecoveredPlayerBox(gameFor(id))).toEqual(box);
    expect(getProviderPlayerBox(gameFor(id))).toBeNull();
  });
  it("rejects a mismatched historical side or final score rather than filling with roster data", () => {
    const wrong = structuredClone(boxes[id]);
    wrong.players[0].team = "XXX";
    expect(validateRecoveredPlayerBox(wrong, gameFor(id))).toBeNull();
    const game = structuredClone(gameFor(id));
    game.homeTeam.score++;
    expect(getRecoveredPlayerBox(game)).toBeNull();
  });
});

it.each([true, false])("renders all 645 players once in the correct two-team table, zh=%s", isZh => {
  for (const [id] of entries) {
    const box = boxes[id];
    const html = renderToStaticMarkup(createElement(RecoveredPlayerBox, { box, isZh }));
    expect(html.match(/<table\b/g)).toHaveLength(2);
    expect(html.match(/<th scope="row"/g)).toHaveLength(box.players.length);
    const tables = html.match(/<table[\s\S]*?<\/table>/g)!;
    for (const [index, team] of [box.away, box.home].entries()) {
      expect(tables[index]).toContain(`${team} ${isZh ? "本场球员技术统计" : "game player box score"}`);
      for (const player of box.players.filter(player => player.team === team)) {
        const escapedName = renderToStaticMarkup(createElement("span", null, player.name)).slice(6, -7);
        expect(tables[index]).toContain(escapedName);
        expect(tables[1 - index]).not.toContain(escapedName);
      }
    }
    expect(html).not.toMatch(/球队归属待核验|historical teams unassigned|BigBallsData|MIN ≈/);
    expect(html).toContain(box.reportUrl);
  }
});

it("keeps the two PDF minute values and the genuine half-minute provider difference explicit", () => {
  expect(boxes["0022501176"].players.find(player => player.name === "Sandro Mamukelashvili")?.officialSource?.officialDuration).toBe("25:00");
  expect(boxes["0022501192"].players.find(player => player.name === "Scottie Barnes")?.officialSource?.officialDuration).toBe("32:00");
  expect(manifest.nbaWebDurationExceptions).toHaveLength(2);
  const tre = boxes["0022501171"].players.find(player => player.name === "Tre Mann")!;
  expect(tre).toMatchObject({ team: "CHA", minutes: 4, officialSource: { officialDuration: "03:30" } });
  const original = JSON.parse(readFileSync(manifest.games["0022501171"].originalProviderFile, "utf8"));
  expect(original.players.find((player: { name: string }) => player.name === "Tre Mann").minutesRounded).toBe(3);
});
