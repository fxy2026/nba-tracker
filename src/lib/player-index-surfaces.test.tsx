// Server-component tests run outside the Next.js server-only resolver.
vi.mock("server-only", () => ({}));
import { currentSeason } from "./constants";
import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import type { PlayerIndexSnapshot } from "./api";
const { snapshot, locale } = vi.hoisted(() => ({ snapshot: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getPlayerIndexSnapshot: snapshot, getCurrentSeasonSchedule: async () => [], getScheduleAge: () => null }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(public element: ReactNode) {} } }));
const player = { personId: 1630173, firstName: "Precious", lastName: "Achiuwa", slug: "precious-achiuwa", teamId: 1610612758, teamAbbr: "SAC", teamCity: "Sacramento", teamName: "Kings", jersey: "9", position: "F", height: "6-8", weight: "243", college: "Memphis", country: "Nigeria", draftYear: 2020, draftRound: 1, draftNumber: 20, fromYear: "2020", toYear: "2025", pts: 10.1, reb: 6.7, ast: 1.4 };
const value: PlayerIndexSnapshot = { players: [player], provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } };
beforeEach(() => { snapshot.mockResolvedValue(value); locale.mockResolvedValue("en"); });
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return "";
}
function scripts(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(scripts);
  if (!isValidElement<{ children?: ReactNode; dangerouslySetInnerHTML?: { __html: string } }>(node)) return [];
  return [...(node.type === "script" && node.props.dangerouslySetInnerHTML ? [node.props.dangerouslySetInnerHTML.__html] : []), ...scripts(node.props.children)];
}
it.each(["en", "zh"])("team and player server trees expose archived season in %s", async language => {
  locale.mockResolvedValue(language);
  const { default: Team } = await import("@/app/team/[tricode]/page");
  const { default: Player, generateMetadata } = await import("@/app/player/[id]/page");
  const expected = language === "en" ? "2025-26 · archived snapshot" : "2025-26 · 存档快照";
  expect(text(await Team({ params: Promise.resolve({ tricode: "SAC" }) }))).toContain(expected);
  const tree = await Player({ params: Promise.resolve({ id: "1630173" }) });
  expect(text(tree)).toContain(expected);
  expect(scripts(tree).map(s => JSON.parse(s)).find(s => s["@type"] === "Person")).not.toHaveProperty("affiliation");
  const meta = await generateMetadata({ params: Promise.resolve({ id: "1630173" }) });
  expect(meta.description).toContain(expected); expect(meta.openGraph?.description).toContain(expected);
});
it("OG uses the same archive label and does not call toFixed on null stats", async () => {
  snapshot.mockResolvedValue({ ...value, players: [{ ...player, pts: null, reb: null, ast: null }] });
  const { default: Image } = await import("@/app/player/[id]/opengraph-image");
  const output = await Image({ params: Promise.resolve({ id: "1630173" }) });
  const content = text((output as unknown as { element: ReactNode }).element);
  expect(content).toContain("2025-26 · archived snapshot");
});
it("API preserves data fields and adds provenance without upstream duplication", async () => {
  const { GET } = await import("@/app/api/player-index/route"); const response = await GET(); const json = await response.json();
  expect(json.data[0]).toMatchObject({ personId: 1630173, pts: 10.1, teamAbbr: "SAC" });
  expect(json.provenance).toEqual(value.provenance); expect(response.headers.get("Cache-Control")).toContain("s-maxage=600");
});

it.each(["2025-26", null, "current"])("only current declared upstream season asserts JSONLD affiliation: %s", async season => {
  snapshot.mockResolvedValue({ ...value, provenance: { source: "nba-cdn", stale: false, season: season === "current" ? currentSeason() : season, retrievedAt: "2026-10-02T00:00:00Z" } });
  const { default: Player } = await import("@/app/player/[id]/page");
  const tree = await Player({ params: Promise.resolve({ id: "1630173" }) });
  const person = scripts(tree).map(s => JSON.parse(s)).find(s => s["@type"] === "Person");
  if (season === "current") expect(person.affiliation.name).toBe("Sacramento Kings");
  else expect(person).not.toHaveProperty("affiliation");
});
