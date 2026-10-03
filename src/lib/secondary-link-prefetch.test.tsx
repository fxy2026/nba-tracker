import { isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import { TEAM_META } from "./teams";
import type { PlayerInfo } from "./api";

vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/api", () => ({
  getFullSchedule: async () => [],
  getScheduleCoverage: () => undefined,
}));
import SchedulePage from "@/app/schedule/page";
import SearchPage from "@/app/search/page";
import TeamRoster from "@/app/team/[tricode]/_components/TeamRoster";

type Props = { children?: ReactNode; href?: string; prefetch?: boolean; className?: string };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function links(node: ReactNode) { return nodes(node).filter(node => node.type === Link); }

it.each([undefined, "lal", "INVALID"])("all 31 schedule filters keep their hrefs and skip prefetch (filter=%s)", async team => {
  const page = await SchedulePage({ searchParams: Promise.resolve({ team }) });
  const filters = links(page);
  const teams = Object.values(TEAM_META).sort((a, b) => a.city.localeCompare(b.city));
  expect(filters).toHaveLength(31);
  expect(filters.map(link => link.props.href)).toEqual(["/schedule", ...teams.map(t => `/schedule?team=${t.tricode}`)]);
  expect(filters.map(link => link.props.children)).toEqual([getTranslations("en").schedulePage.all, ...teams.map(t => t.tricode)]);
  for (const link of filters) expect(link.props.prefetch).toBe(false);
  expect(filters.filter(link => link.props.className?.includes("chip-active")).map(link => link.props.href))
    .toEqual(team === "lal" ? ["/schedule?team=LAL"] : team ? [] : ["/schedule"]);
});

it.each([0, 1, 3, 15])("only full roster rows disable prefetch with %s players", count => {
  const roster = Array.from({ length: count }, (_, i) => ({
    personId: 100 + i, firstName: "Player", lastName: String(i), pts: 30 - i, reb: 5, ast: 4, jersey: String(i), position: "G",
  } as PlayerInfo));
  const rendered = links(TeamRoster({ roster, t: getTranslations("en") }));
  const featured = count >= 3 ? rendered.slice(0, 3) : [];
  const rows = count >= 3 ? rendered.slice(3) : rendered;
  expect(featured).toHaveLength(count >= 3 ? 3 : 0);
  expect(featured.map(link => link.props.href)).toEqual(count >= 3 ? ["/player/100", "/player/101", "/player/102"] : []);
  for (const link of featured) expect(link.props).not.toHaveProperty("prefetch");
  expect(rows.map(link => link.props.href)).toEqual(roster.map(p => `/player/${p.personId}`));
  for (const link of rows) expect(link.props.prefetch).toBe(false);
});

it("all eight popular players keep default prefetch", async () => {
  const popular = links(await SearchPage({ searchParams: Promise.resolve({}) }));
  expect(popular.map(link => link.props.href)).toEqual([2544, 201142, 201939, 203507, 203954, 1629029, 1628983, 203999].map(id => `/player/${id}`));
  for (const link of popular) expect(link.props).not.toHaveProperty("prefetch");
});
