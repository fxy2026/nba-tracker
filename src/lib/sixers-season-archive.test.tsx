import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import catalog from "@/data/sixers-2024-25/catalog.json";
import currentBoxManifest from "@/data/espn-player-boxes/manifest.json";
import { getSixersArchiveGame, getSixersArchivePlayerBox, getSixersSeasonArchive, validateSixersSeasonArchive } from "./sixers-season-archive";
import { decodeEspnPlayerBox, readEspnPlayerBoxEntry, ESPN_BOX_DECODED_LIMIT } from "./espn-player-box-archive";
import { parseEspnPlayerBox, validateEspnPlayerBox, type EspnPlayerBox } from "./espn-player-box";
import ProviderPlayerBox from "@/app/game/[id]/_components/ProviderPlayerBox";
import SixersSeasonArchive from "@/app/team/[tricode]/_components/SixersSeasonArchive";

const mocks = vi.hoisted(() => ({ box: vi.fn(), full: vi.fn(), index: vi.fn(), snapshot: vi.fn(), current: vi.fn(), pbp: vi.fn() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getBoxScore: mocks.box, getFullSchedule: mocks.full,
  getPlayerIndex: mocks.index, getPlayerIndexSnapshot: mocks.snapshot, getCurrentSeasonSchedule: mocks.current }));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(public element: ReactNode) {} } }));
import GamePage, { generateMetadata as gameMetadata } from "@/app/game/[id]/page";
import TeamPage, { generateMetadata as teamMetadata } from "@/app/team/[tricode]/page";
import GameShareImage from "@/app/game/[id]/opengraph-image";
import TeamShareImage from "@/app/team/[tricode]/opengraph-image";

const archive = getSixersSeasonArchive()!;
const regular = () => archive.games.filter(g => g.phase === "regular");
const bytes = (id: string) => readFileSync(`src/data/sixers-2024-25/${id}.json.gz`);
const rawBox = (id = "0022400322") => JSON.parse(gunzipSync(bytes(id)).toString()) as EspnPlayerBox;
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
beforeEach(() => {
  Object.values(mocks).forEach(fn => fn.mockReset().mockImplementation(() => { throw new Error("Historical route called a current/live provider"); }));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  Object.values(mocks).forEach(fn => expect(fn).not.toHaveBeenCalled());
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

it("contains 88 unique results and 82 genuine NBA game identities, with six source-only preseason games", () => {
  expect(archive).not.toBeNull(); expect(archive.games).toHaveLength(88); expect(regular()).toHaveLength(82);
  expect(new Set(archive.games.map(g => g.eventId)).size).toBe(88);
  expect(new Set(regular().map(g => g.nbaGameId)).size).toBe(82);
  expect(archive.games.filter(g => g.phase === "preseason").every(g => g.nbaGameId === null && g.boxEntry === null && g.identityEvidence === null)).toBe(true);
  expect(readdirSync("src/data/sixers-2024-25").filter(n => n.endsWith(".gz")).sort()).toEqual(regular().map(g => `${g.nbaGameId}.json.gz`).sort());
  expect(regular().filter(g => (g.home.tricode === "PHI" ? g.home.score > g.away.score : g.away.score > g.home.score))).toHaveLength(24);
});
it("binds all 1,712 played rows to source hashes and both teams’ final scores", async () => {
  const boxes = await Promise.all(regular().map(g => getSixersArchivePlayerBox(g.nbaGameId!)));
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes.flatMap(b => b!.players)).toHaveLength(1712);
  expect(boxes.flatMap(b => b!.players).filter(p => p.minutesRounded === 0)).toHaveLength(7);
  expect(boxes.flatMap(b => b!.players).every(p => p.nbaPlayerId === null && p.minutesRounded !== null)).toBe(true);
  expect(boxes.reduce((sum, b) => sum + b!.excluded.dnp, 0)).toBe(399);
  expect(boxes.reduce((sum, b) => sum + b!.excluded.participationUnverified, 0)).toBe(6);
  for (const row of regular()) {
    const box = await getSixersArchivePlayerBox(row.nbaGameId!);
    expect(hash(bytes(row.nbaGameId!))).toBe(row.boxEntry!.compressedSha256);
    expect(box!.source.rawSha256).toBe(row.source.rawSha256);
    expect(box!.game.gameDate).toBe(row.date);
    expect(box!.game.season).toBe("2024-25");
    for (const side of ["home", "away"] as const) expect(box!.players.filter(p => p.team === row[side].tricode).reduce((sum, p) => sum + p.points, 0)).toBe(row[side].score);
  }
});
it("records the original crosswalk omission and the explicit final-period correction", () => {
  const row = regular().find(g => g.eventId === "401704888")!;
  expect(row.nbaGameId).toBe("0022400322"); expect(row.date).toBe("2024-12-04");
  expect(row.identityEvidence!.method).toBe("crosswalk-omission-verified-final-period");
  expect(row.identityEvidence!.finalPeriod).toEqual({ period: 4, actionId: 476, homeScore: 102, awayScore: 106 });
  expect(row.source.rawSha256).toBe("5cb1858f9b6a0535da5646d67de97171ee3669c8de1225e3ca0315eca20c1bf1");
});
it.each(["../0022400322", "401704888", "0022409999", "0022500004", "0042400004", "__proto__"])("does not invent an archived route for %s", async id => {
  expect(getSixersArchiveGame(id)).toBeNull(); expect(await getSixersArchivePlayerBox(id)).toBeNull();
});
it.each(["duplicate", "team", "season", "type", "date", "unmapped-id", "nba-id", "source-url", "source-hash", "final-score", "extra", "filename", "oversize"])("catalog fails closed on %s", kind => {
  const raw = structuredClone(catalog), row = raw.games.find(g => g.nbaGameId)!;
  if (kind === "duplicate") raw.games[0] = structuredClone(row);
  if (kind === "team") row.home.teamId = 1610612747;
  if (kind === "season") raw.season = "2025-26";
  if (kind === "type") row.phase = "preseason";
  if (kind === "date") row.date = "2024-02-30";
  if (kind === "unmapped-id") raw.games.find(g => g.phase === "preseason")!.nbaGameId = "0022409999";
  if (kind === "nba-id") row.nbaGameId = "401704888";
  if (kind === "source-url") row.source.url = "https://example.com";
  if (kind === "source-hash") row.source.rawSha256 = "0".repeat(64);
  if (kind === "final-score") row.identityEvidence!.finalPeriod.homeScore++;
  if (kind === "extra") Reflect.set(row, "currentRoster", []);
  if (kind === "filename") row.boxEntry!.file = "../schedule-2025-26.json";
  if (kind === "oversize") row.boxEntry!.uncompressedBytes = ESPN_BOX_DECODED_LIMIT + 1;
  expect(validateSixersSeasonArchive(raw)).toBeNull();
});
it.each(["wrong-year", "wrong-id", "wrong-score", "malformed-minutes", "extra-field"])("historical player-box projection rejects %s", kind => {
  const box = rawBox(), game = getSixersArchiveGame(box.game.nbaGameId)!;
  if (kind === "wrong-year") box.game.season = "2025-26";
  if (kind === "wrong-id") box.game.nbaGameId = "0022400004";
  if (kind === "wrong-score") box.players[0].points++;
  if (kind === "malformed-minutes") box.players[0].minutesRounded = null;
  if (kind === "extra-field") Reflect.set(box, "roster", []);
  expect(validateEspnPlayerBox(box, game)).toBeNull();
});
// Reconstructed source envelope, solely for parser mutation tests; not independent source evidence.
function sourceFixture(box = rawBox()) {
  const event = box.game.espnEventId;
  const keys = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "freeThrowsMade-freeThrowsAttempted", "rebounds", "assists", "turnovers", "steals", "blocks", "offensiveRebounds", "defensiveRebounds", "fouls", "plusMinus"];
  return { header: { id: event, uid: `s:40~l:46~e:${event}`, league: { id: "46", uid: "s:40~l:46", slug: "nba" }, season: { year: 2025, type: 2 }, competitions: [{ id: event, uid: `s:40~l:46~e:${event}~c:${event}`, date: box.game.gameTimeUTC, boxscoreSource: "full", status: { type: { completed: true, state: "post" } }, competitors: (["home", "away"] as const).map(side => { const t = box.game[side]; return { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}`, homeAway: side, score: String(t.score), team: { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}` } }; }) }] },
    boxscore: { players: (["home", "away"] as const).map(side => { const t = box.game[side]; return { team: { id: t.espnTeamId, uid: `s:40~l:46~t:${t.espnTeamId}` }, statistics: [{ keys, athletes: box.players.filter(p => p.team === t.tricode).map(p => ({ athlete: { id: p.espnAthleteId, uid: `s:40~l:46~a:${p.espnAthleteId}`, displayName: p.name }, didNotPlay: false, starter: p.starter ?? false, stats: [p.minutesRounded, p.points, `${p.fieldGoalsMade}-${p.fieldGoalsAttempted}`, `${p.threePointersMade}-${p.threePointersAttempted}`, `${p.freeThrowsMade}-${p.freeThrowsAttempted}`, p.rebounds, p.assists, p.turnovers, p.steals, p.blocks, p.offensiveRebounds, p.defensiveRebounds, p.fouls, p.plusMinus].map(String) })) }] }; }) } };
}
it("parses the 2024-25 source season and rejects other years and phases", () => {
  const box = rawBox(), source = sourceFixture(), game = getSixersArchiveGame(box.game.nbaGameId)!;
  const capture = { eventId: box.game.espnEventId, retrievedAt: box.retrievedAt, rawSha256: box.source.rawSha256 };
  expect(parseEspnPlayerBox(source, game, capture)?.players).toEqual(expect.arrayContaining(box.players));
  source.header.season.year = 2026; expect(parseEspnPlayerBox(source, game, capture)).toBeNull();
  source.header.season.year = 2025; source.header.season.type = 3; expect(parseEspnPlayerBox(source, game, capture)).toBeNull();
});
it.each(["hash", "gzip-limit", "wrong-game"])("bounded historical decoder rejects %s", kind => {
  const entry = { ...regular()[0].boxEntry! }, game = getSixersArchiveGame(entry.gameId)!;
  let data = bytes(entry.gameId);
  if (kind === "hash") data = Buffer.from(data.map((b, i) => i === 15 ? b ^ 1 : b));
  if (kind === "gzip-limit") { const decoded = Buffer.alloc(ESPN_BOX_DECODED_LIMIT + 1); data = gzipSync(decoded); entry.bytes = data.length; entry.compressedSha256 = hash(data); entry.sha256 = hash(decoded); entry.uncompressedBytes = ESPN_BOX_DECODED_LIMIT; }
  if (kind === "wrong-game") game.homeTeam.score++;
  expect(decodeEspnPlayerBox(data, entry, game)).toBeNull();
});
it("does not accept a caller-supplied archive root", async () => {
  const row = regular()[0];
  expect(await readEspnPlayerBoxEntry(row.boxEntry!, getSixersArchiveGame(row.nbaGameId!)!, "../../../../tmp" as "sixers-2024-25")).toBeNull();
});
function boxes(node: ReactNode): unknown[] {
  if (Array.isArray(node)) return node.flatMap(boxes);
  if (!isValidElement<{ children?: ReactNode; box?: unknown }>(node)) return [];
  return [...(node.type === ProviderPlayerBox ? [node.props.box] : []), ...boxes(node.props.children)];
}
it("all 82 internal routes resolve ESPN boxes without live box, current schedule, roster or PBP calls", async () => {
  for (const row of regular()) {
    const page = await GamePage({ params: Promise.resolve({ id: row.nbaGameId! }) });
    expect(boxes(page)).toEqual([await getSixersArchivePlayerBox(row.nbaGameId!)]);
  }
});
it("historical team page and metadata have the correct season and no current-data dependency", async () => {
  const params = Promise.resolve({ tricode: "PHI" }), searchParams = Promise.resolve({ season: "2024-25" });
  const page = await TeamPage({ params, searchParams });
  const html = renderToStaticMarkup(page);
  expect(html).toContain("2024–25"); expect(html).toContain("24–58");
  expect(html).not.toContain("Roster and averages"); expect(html).not.toContain("/player/");
  const team = await teamMetadata({ params, searchParams });
  expect(team.alternates?.canonical).toBe("/team/PHI?season=2024-25");
  expect(team.openGraph?.title).toContain("2024–25"); expect(team.twitter?.title).toContain("2024–25");
  const metadata = await gameMetadata({ params: Promise.resolve({ id: "0022400322" }) });
  expect(metadata.title).toContain("ORL 106 @ PHI 102"); expect(metadata.title).toContain("2024–25");
  expect(metadata.openGraph?.title).toContain("2024–25"); expect(metadata.twitter?.title).toContain("2024–25");
});
it("share images stay offline and avoid mixing the current record into historical links", async () => {
  const image = async (value: unknown) => renderToStaticMarkup((await value as { element: ReactNode }).element);
  const team = await image(TeamShareImage({ params: Promise.resolve({ tricode: "PHI" }) }));
  expect(team).toContain("Philadelphia 76ers"); expect(team).not.toMatch(/202[456]–|202[456]-|Wins|Losses|<img/);
  const game = await image(GameShareImage({ params: Promise.resolve({ id: "0022400322" }) }));
  expect(game).toContain("2024–25"); expect(game).toContain("ORL 106 @ PHI 102"); expect(game).not.toContain("<img");
});
it.each([false, true])("renders 88 source results, exactly 82 internal links and clear season boundaries; zh=%s", isZh => {
  const html = renderToStaticMarkup(createElement(SixersSeasonArchive, { archive, isZh }));
  expect(html.match(/href="\/game\/00224\d{5}"/g)).toHaveLength(82);
  expect(html.match(/href="https:\/\/www.espn.com\/nba\/boxscore/g)).toHaveLength(88);
  expect(html).toContain("/team/PHI?season=2024-25"); expect(html).toContain('aria-current="page"');
  expect(html).toContain(isZh ? "NBA 比赛编号未映射" : "NBA game ID not mapped");
  expect(html).toContain(isZh ? "季前赛结果已收录" : "Preseason results are included");
  expect(html).not.toContain("/game/401"); expect(html).not.toContain("/player/");
});
it("traces exactly the bounded historical projections without shipping raw collections", () => {
  const config = readFileSync("next.config.ts", "utf8");
  expect(config).toContain('"/game/*": ["./src/data/espn-player-boxes/*.gz", "./src/data/sixers-2024-25/*.gz"]');
  expect(config).not.toContain("sixers-data-collection"); expect(config).not.toContain("nbastatsv3");
  expect(readFileSync("src/lib/sixers-season-archive.ts", "utf8")).toContain('import "server-only"');
  const reader = readFileSync("src/lib/espn-player-box-archive.ts", "utf8");
  expect(reader).toContain('join(process.cwd(), "src/data/espn-player-boxes", entry.file)');
  expect(reader).toContain('join(process.cwd(), "src/data/sixers-2024-25", entry.file)');
  expect(reader).not.toContain('join(process.cwd(), "src/data", archive');
});

// Run after `npm run build` with VERIFY_SIXERS_ARCHIVE_TRACE=1. Ordinary unit
// tests must not inspect absent or stale build artifacts from a previous tree.
it.runIf(process.env.VERIFY_SIXERS_ARCHIVE_TRACE === "1")("production traces contain only the two bounded gzip catalogs and no unrelated archives", () => {
  const expected = new Set([
    ...currentBoxManifest.map(row => `src/data/espn-player-boxes/${row.file}`),
    ...regular().map(row => `src/data/sixers-2024-25/${row.boxEntry!.file}`),
  ]);
  const unrelated = /(?:^|\/)(?:historical-shot-archive|historical-shot-spatial|historical-career-archives|player-game-log-archives|sixers-data-collection|lebron-data-collection)(?:\/|$)/;
  for (const route of ["game/[id]/page", "team/[tricode]/page", "game/[id]/opengraph-image/route", "team/[tricode]/opengraph-image/route"]) {
    const tracePath = resolve(`.next/server/app/${route}.js.nft.json`);
    const trace = JSON.parse(readFileSync(tracePath, "utf8")) as { files: string[] };
    const files = [...new Set(trace.files.map(file => relative(process.cwd(), resolve(dirname(tracePath), file)).replaceAll("\\", "/")))];
    expect(files.filter(file => unrelated.test(file)), `${route}: unrelated historical archives`).toEqual([]);
    const compressed = files.filter(file => file.startsWith("src/data/") && file.endsWith(".gz"));
    expect(compressed.filter(file => !expected.has(file)), `${route}: unexpected compressed data`).toEqual([]);
    if (route === "game/[id]/page") expect([...compressed].sort()).toEqual([...expected].sort());
  }
});
