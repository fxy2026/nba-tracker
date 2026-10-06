import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "@/data/espn-player-boxes/manifest.json";
import schedule from "@/data/schedule-2025-26.json";
import recovered from "@/data/recovered-player-boxes.json";
import generic from "@/data/provider-player-boxes.json";
import { parseEspnPlayerBox, validateEspnPlayerBox, type EspnPlayerBox, type EspnBoxIdentity } from "./espn-player-box";
import { decodeEspnPlayerBox, getEspnPlayerBox, ESPN_BOX_DECODED_LIMIT } from "./espn-player-box-archive";
import * as espnArchive from "./espn-player-box-archive";
import ProviderPlayerBox from "@/app/game/[id]/_components/ProviderPlayerBox";
import RecoveredPlayerBox from "@/app/game/[id]/_components/RecoveredPlayerBox";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ box: vi.fn(), index: vi.fn(), full: vi.fn(), pbp: vi.fn() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getBoxScore: mocks.box, getPlayerIndex: mocks.index, getFullSchedule: mocks.full }));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import GamePage from "@/app/game/[id]/page";

const game = (id: string) => schedule.dates.flatMap(day => day.games).find(row => row.gameId === id)! as EspnBoxIdentity;
const bytes = (id: string) => readFileSync(`src/data/espn-player-boxes/${id}.json.gz`);
const rawBox = (id = "0022500083") => JSON.parse(gunzipSync(bytes(id)).toString("utf8")) as EspnPlayerBox;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fields = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "freeThrowsMade-freeThrowsAttempted", "rebounds", "assists", "turnovers", "steals", "blocks", "offensiveRebounds", "defensiveRebounds", "fouls", "plusMinus"];
// Deliberately reconstructed test envelope for parser mutation tests. It is
// not presented as a source capture or evidence of independent row accuracy.
function sourceFixture(box = rawBox()) {
  const eid = box.game.espnEventId;
  return {
    header: { id: eid, uid: `s:40~l:46~e:${eid}`, league: { id: "46", uid: "s:40~l:46", slug: "nba" }, season: { year: 2026, type: 2 },
      competitions: [{ id: eid, uid: `s:40~l:46~e:${eid}~c:${eid}`, date: box.game.gameTimeUTC, boxscoreSource: "full", status: { type: { completed: true, state: "post" } },
        competitors: (["home", "away"] as const).map(side => { const t = box.game[side]; return { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}`, homeAway: side, score: String(t.score), team: { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}` } }; }) }] },
    boxscore: { players: (["home", "away"] as const).map(side => { const t = box.game[side]; return { team: { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}` }, statistics: [{ keys: fields,
      athletes: box.players.filter(p => p.team === t.tricode).map(p => ({ athlete: { id: p.espnAthleteId, uid: `s:40~l:46~a:${p.espnAthleteId}`, displayName: p.name }, didNotPlay: false, starter: p.starter ?? false,
        stats: [p.minutesRounded, p.points, `${p.fieldGoalsMade}-${p.fieldGoalsAttempted}`, `${p.threePointersMade}-${p.threePointersAttempted}`, `${p.freeThrowsMade}-${p.freeThrowsAttempted}`, p.rebounds, p.assists, p.turnovers, p.steals, p.blocks, p.offensiveRebounds, p.defensiveRebounds, p.fouls, p.plusMinus].map(String) })) }] }; }) },
  };
}
const parse = (source: unknown, box = rawBox()) => parseEspnPlayerBox(source, game(box.game.nbaGameId), { eventId: box.game.espnEventId, retrievedAt: box.retrievedAt, rawSha256: box.source.rawSha256 });
beforeEach(() => {
  mocks.box.mockReset().mockResolvedValue(null);
  mocks.full.mockReset().mockResolvedValue(schedule.dates);
  mocks.index.mockReset().mockReturnValue(new Promise(() => {}));
  mocks.pbp.mockReset().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected provider request"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("records exactly 79 previously unreviewed regular games and preserves stronger stores", async () => {
  expect(manifest).toHaveLength(79);
  expect(new Set(manifest.map(e => e.gameId)).size).toBe(79);
  expect(new Set(manifest.map(e => e.eventId)).size).toBe(79);
  const expected = schedule.dates.flatMap(day => day.games).filter(g => g.gameId.startsWith("00225")
    && [g.homeTeam.teamId, g.awayTeam.teamId].includes(1610612755) && !Object.hasOwn(recovered, g.gameId)).map(g => g.gameId).sort();
  expect(manifest.map(e => e.gameId).sort()).toEqual(expected);
  const boxes = await Promise.all(manifest.map(e => getEspnPlayerBox(game(e.gameId))));
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes.reduce((sum, b) => sum + b!.players.length, 0)).toBe(1690);
  expect(boxes.reduce((sum, b) => sum + b!.excluded.dnp, 0)).toBe(398);
  expect(boxes.reduce((sum, b) => sum + b!.excluded.participationUnverified, 0)).toBe(1);
  expect(boxes.flatMap(b => b!.players).filter(p => p.minutesRounded === 0)).toHaveLength(5);
  expect(boxes.flatMap(b => b!.players).every(p => p.nbaPlayerId === null)).toBe(true);
  expect(manifest.reduce((sum, e) => sum + e.bytes, 0)).toBe(130645);
  for (const e of manifest) {
    expect(Object.hasOwn(recovered, e.gameId)).toBe(false);
    expect(digest(bytes(e.gameId))).toBe(e.compressedSha256);
  }
  expect(manifest.filter(e => Object.hasOwn(generic, e.gameId)).map(e => e.gameId).sort()).toEqual(["0022501131", "0022501146"]);
});

describe("strict source and projection validation", () => {
  it("accepts game-time teams and keeps a populated reason from overriding an actual appearance", () => {
    const source = sourceFixture();
    Object.assign(source.boxscore.players[0].statistics[0].athletes[0], { reason: "COACH'S DECISION" });
    expect(parse(source)?.players).toEqual(expect.arrayContaining(rawBox().players));
  });
  it.each(["event", "league", "season", "phase", "time", "orientation", "team", "score", "final", "uid", "duplicate", "dnp-contradiction"])("rejects source %s mismatch", kind => {
    const source = sourceFixture(), c = source.header.competitions[0], p = source.boxscore.players[0].statistics[0].athletes[0];
    if (kind === "event") source.header.id = "999";
    if (kind === "league") source.header.league.slug = "wnba";
    if (kind === "season") source.header.season.year = 2025;
    if (kind === "phase") source.header.season.type = 3;
    if (kind === "time") c.date = "2025-10-22T23:31:00Z";
    if (kind === "orientation") c.competitors[0].homeAway = "away";
    if (kind === "team") c.competitors[0].team.id = "13";
    if (kind === "score") c.competitors[0].score = "999";
    if (kind === "final") c.status.type.completed = false;
    if (kind === "uid") p.athlete.uid = "s:40~l:46~a:999";
    if (kind === "duplicate") source.boxscore.players[0].statistics[0].athletes.push(p);
    if (kind === "dnp-contradiction") p.didNotPlay = true;
    expect(parse(source)).toBeNull();
  });
  it("separates genuine DNP from missing-minute placeholders without counting either as played", () => {
    const source = sourceFixture(), table = source.boxscore.players[0].statistics[0];
    const row = { ...table.athletes[0], athlete: { id: "9999991", uid: "s:40~l:46~a:9999991", displayName: "Source DNP" }, didNotPlay: true, stats: [] };
    table.athletes.push(row, { ...row, athlete: { id: "9999992", uid: "s:40~l:46~a:9999992", displayName: "Unconfirmed" }, didNotPlay: false, stats: fields.map(key => key === "minutes" ? "--" : key.includes("-") ? "0-0" : "0") });
    expect(parse(source)?.excluded).toEqual({ dnp: 1, participationUnverified: 1 });
    expect(parse(source)?.players).toHaveLength(rawBox().players.length);
    table.athletes.at(-1)!.stats[1] = "2";
    expect(parse(source)).toBeNull();
  });
  it.each(["identity", "date", "phase", "team-id", "athlete-namespace", "duplicate", "points", "shooting", "rebounds", "negative", "nan", "extra-pbp", "array-team"])("rejects projection %s corruption", kind => {
    const box = rawBox(), p = box.players[0];
    if (kind === "identity") box.game.nbaGameId = "0022509999";
    if (kind === "date") box.game.gameDate = "2025-10-23";
    if (kind === "phase") Reflect.set(box.game, "seasonType", "Playoffs");
    if (kind === "team-id") box.game.home.teamId = 1610612747;
    if (kind === "athlete-namespace") Reflect.set(p, "nbaPlayerId", Number(p.espnAthleteId));
    if (kind === "duplicate") box.players.push(p);
    if (kind === "points") p.points++;
    if (kind === "shooting") p.fieldGoalsMade = 999;
    if (kind === "rebounds") p.rebounds = 999;
    if (kind === "negative") p.assists = -1;
    if (kind === "nan") p.minutesRounded = NaN;
    if (kind === "extra-pbp") Reflect.set(box, "plays", []);
    if (kind === "array-team") { const zero = box.players.find(row => row.points === 0)!; Reflect.set(zero, "team", [zero.team]); }
    expect(validateEspnPlayerBox(box, game("0022500083"))).toBeNull();
  });
  it("retains unavailable optional fields as null and literal played zeros", () => {
    const box = rawBox(); box.players[0].assists = null;
    expect(validateEspnPlayerBox(box, game("0022500083"))?.players[0].assists).toBeNull();
    const placeholder = rawBox("0022500874");
    expect(placeholder.excluded.participationUnverified).toBe(1);
    expect(placeholder.players.some(p => p.name === "Dalano Banton")).toBe(false);
  });
  it.each(["2026-10-06T11:00:00", "2026-02-30T11:00:00Z"])("rejects unzoned or invalid calendar capture time %s", retrievedAt => {
    const box = rawBox(); box.retrievedAt = retrievedAt;
    expect(validateEspnPlayerBox(box, game("0022500083"))).toBeNull();
    expect(parseEspnPlayerBox(sourceFixture(), game("0022500083"), { eventId: box.game.espnEventId, rawSha256: box.source.rawSha256, retrievedAt })).toBeNull();
  });
});

it.each(["hash", "filename", "event", "raw-source", "compressed-limit", "gzip-limit", "invalid-json"])("bounded archive decoder rejects %s", kind => {
  const entry = { ...manifest.find(e => e.gameId === "0022500083")! };
  let buffer = bytes(entry.gameId);
  if (kind === "hash") buffer = Buffer.from(buffer.map((byte, i) => i === 15 ? byte ^ 1 : byte));
  if (kind === "filename") entry.file = "../../schedule-2025-26.json";
  if (kind === "event") entry.eventId = "999999";
  if (kind === "raw-source") entry.sourceRawSha256 = "0".repeat(64);
  if (kind === "compressed-limit") entry.bytes = 65537;
  if (kind === "gzip-limit" || kind === "invalid-json") {
    const decoded = Buffer.from(kind === "gzip-limit" ? " ".repeat(ESPN_BOX_DECODED_LIMIT + 1) : "{broken");
    buffer = gzipSync(decoded); entry.bytes = buffer.length; entry.compressedSha256 = digest(buffer); entry.sha256 = digest(decoded);
    entry.uncompressedBytes = kind === "gzip-limit" ? ESPN_BOX_DECODED_LIMIT : decoded.length;
  }
  expect(decodeEspnPlayerBox(buffer, entry, game("0022500083"))).toBeNull();
});

function boxes(node: ReactNode, component: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(child => boxes(child, component));
  if (!isValidElement<{ children?: ReactNode; box?: unknown }>(node)) return [];
  return [...(node.type === component ? [node.props.box] : []), ...boxes(node.props.children, component)];
}
it.each(["0022500083", "0022501131", "0022501146"])("existing final route %s displays ESPN without current-roster or PBP dependencies", async id => {
  const page = await GamePage({ params: Promise.resolve({ id }) });
  expect(boxes(page, ProviderPlayerBox)).toEqual([await getEspnPlayerBox(game(id))]);
  expect(mocks.index).not.toHaveBeenCalled(); expect(mocks.pbp).not.toHaveBeenCalled();
});
it("retains reviewed boxes and the live NBA source as higher priorities", async () => {
  const page = await GamePage({ params: Promise.resolve({ id: "0022501169" }) });
  expect(boxes(page, RecoveredPlayerBox)).toHaveLength(1); expect(boxes(page, ProviderPlayerBox)).toHaveLength(0);
  const g = game("0022500083"), t = { ...g.homeTeam, players: [], periods: [], statistics: {} };
  mocks.box.mockResolvedValue({ gameId: g.gameId, gameCode: g.gameCode, gameTimeUTC: g.gameDateTimeUTC, gameStatus: 3, gameStatusText: "Final", arena: { arenaName: "Arena", arenaCity: "Boston" }, homeTeam: t, awayTeam: { ...t, ...g.awayTeam } });
  mocks.full.mockClear();
  const live = await GamePage({ params: Promise.resolve({ id: g.gameId }) });
  expect(boxes(live, ProviderPlayerBox)).toHaveLength(0); expect(mocks.full).not.toHaveBeenCalled();
});
it.each(["0022501131", "0022501146"])("retains the original generic fallback when ESPN is unavailable for %s", async id => {
  vi.spyOn(espnArchive, "getEspnPlayerBox").mockResolvedValue(null);
  const page = await GamePage({ params: Promise.resolve({ id }) });
  expect(boxes(page, ProviderPlayerBox)).toEqual([generic[id as keyof typeof generic]]);
  expect(mocks.index).not.toHaveBeenCalled(); expect(mocks.pbp).not.toHaveBeenCalled();
});
it.each([true, false])("renders ESPN source, real game-time teams and no fabricated NBA player links; zh=%s", isZh => {
  const html = renderToStaticMarkup(createElement(ProviderPlayerBox, { box: rawBox("0022500874"), isZh }));
  expect(html).toContain("ESPN"); expect(html).toContain("PHI"); expect(html).toContain("MIN ≈");
  expect(html).toContain(rawBox("0022500874").source.url); expect(html).not.toContain("/player/");
  expect(html).not.toContain("Dalano Banton"); expect(html).not.toContain("BigBallsData");
  expect(html).toContain(isZh ? "未核实" : "unverified");
});
it("traces only the compact server archive on existing game routes", () => {
  const config = readFileSync("next.config.ts", "utf8");
  expect(config).toContain('"/game/*": ["./src/data/espn-player-boxes/*.gz"]');
  expect(config).not.toContain("sixers-data-collection");
  expect(readFileSync("src/lib/espn-player-box-archive.ts", "utf8")).toContain('import "server-only"');
});

it("keeps the ESPN archive outside every client module's transitive runtime imports", () => {
  const root = resolve("src"), target = join(root, "lib/espn-player-box-archive.ts");
  const modules = new Map<string, { client: boolean; imports: string[] }>();
  function scan(directory: string) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, item.name);
      if (item.isDirectory()) { scan(file); continue; }
      if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true), imports: string[] = [];
      const client = ast.statements.some(s => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === "use client");
      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const clause = node.importClause, names = clause?.namedBindings;
          const onlyNamedTypes = names && ts.isNamedImports(names) && names.elements.length > 0 && names.elements.every(e => e.isTypeOnly);
          if (!clause?.isTypeOnly && (clause?.name || !onlyNamedTypes)) imports.push(node.moduleSpecifier.text);
        }
        if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require") && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
        ts.forEachChild(node, visit);
      }
      visit(ast); modules.set(file, { client, imports });
    }
  }
  scan(root);
  function reaches(file: string, seen = new Set<string>()): boolean {
    if (file === target) return true;
    if (seen.has(file)) return false;
    seen.add(file);
    return (modules.get(file)?.imports ?? []).some(specifier => {
      const base = specifier.startsWith("@/") ? join(root, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(file), specifier) : null;
      if (!base) return false;
      const imported = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find(path => modules.has(path));
      return imported ? reaches(imported, seen) : false;
    });
  }
  expect([...modules].filter(([file, row]) => row.client && reaches(file)).map(([file]) => file)).toEqual([]);
  expect(readFileSync("next.config.ts", "utf8")).not.toContain("server-only/empty");
});
