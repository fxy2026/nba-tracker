import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TeamCard } from "@/app/favorites/FavoritesDashboard";
import favoriteStyles from "@/app/favorites/favorites-mobile.module.css";
import TeamHero from "@/app/team/[tricode]/_components/TeamHero";
import TeamRoster from "@/app/team/[tricode]/_components/TeamRoster";
import TeamScheduleCard from "@/app/team/[tricode]/_components/TeamScheduleCard";
import teamStyles from "@/app/team/[tricode]/_components/team-mobile.module.css";
import ShareButton from "@/components/ShareButton";
import FavoriteButton from "@/components/FavoriteButton";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getTranslations } from "@/locales";
import { TEAM_META } from "./teams";
import { formatGameDate } from "./dates";
import type { DigestGame, TeamDigest } from "./follow-digest-types";
import type { PlayerInfo } from "./api";

type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return isValidElement<Props>(node) ? text(node.props.children) : "";
}
const game: DigestGame = { gameId: "0042500401", status: 3, dateUTC: "2026-06-05T00:30:00Z", calendarDate: "2026-06-04", season: "2025-26", home: true, opponentTricode: "OKC", opponentName: "Thunder", opponentTeamId: 1610612760, teamScore: 119, oppScore: 111, win: true };
const team: TeamDigest = { ...TEAM_META.MIN, wins: 49, losses: 33, recordSeason: "2025-26", conferenceRank: 6, streak: "W3", archived: true, lastGame: game, nextGame: null };
function card(lastGame: DigestGame | null, nextGame: DigestGame | null, isZh: boolean) {
  return TeamCard({ team: { ...team, lastGame, nextGame }, injuries: [], news: [], isZh, onRemove: () => {}, delay: 0 });
}
function gameRows(tree: ReactNode) {
  return nodes(tree).filter(node => typeof node.type === "function" && (node.props.kind === "last" || node.props.kind === "next"))
    .map(node => (node.type as (props: Props) => ReactElement<Props>)(node.props));
}
const heroProps = { team: TEAM_META.MIN, season: "2026-27", wins: 0, losses: 0, winPct: "0.0", w10: 0, l10: 0, playoffWins: 0, playoffLosses: 0, rosterCount: 16, confRank: 0, gamesPlayed: 0, ppg: "0.0", oppPpg: "0.0", homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, streakType: "", streakDisplay: "", longestWinStreak: 0, longestLossStreak: 0, updatedAt: null };
const player = (personId: number, firstName: string, lastName: string, pts: number): PlayerInfo => ({ personId, firstName, lastName, pts, slug: "fixture", teamId: 1610612749, teamAbbr: "MIL", teamCity: "Milwaukee", teamName: "Bucks", jersey: "34", position: "F", height: "6-11", weight: "243", college: "", country: "Greece", draftYear: 2013, draftRound: 1, draftNumber: 15, fromYear: "2013", toYear: "2026", reb: 12.3, ast: 6.1 });
const roster = [player(203507, "Giannis", "Antetokounmpo", 30.4), player(1630639, "Sandro", "Mamukelashvili", 12.5), player(1628988, "Shai", "Gilgeous-Alexander", 0)];

describe("favorites mobile game rows", () => {
  it.each(["en", "zh"] as const)("retains archive season/date, scores, opponent, W/L, postseason type and exact links in %s", locale => {
    const isZh = locale === "zh";
    for (const [gameId, expected] of [["0042500401", isZh ? "季后赛" : "Playoffs"], ["0052500101", isZh ? "附加赛" : "Play-In"], ["0022500001", ""]]) {
      for (const home of [true, false]) {
        for (const win of [true, false]) {
          const tree = card({ ...game, gameId, home, win }, null, isZh);
          const row = gameRows(tree)[0];
          expect(row.props.href).toBe(`/game/${gameId}`);
          const summary = nodes(row).find(node => node.props.className === favoriteStyles.gameSummary)!;
          const metadata = nodes(row).find(node => node.props.className === favoriteStyles.gameMetadata)!;
          expect(text(summary)).toContain("119-111");
          expect(text(summary)).toContain(`${home ? (isZh ? "对阵 " : "vs ") : "@ "}OKC`);
          expect(text(summary)).toContain(win ? (isZh ? "胜" : "W") : (isZh ? "负" : "L"));
          expect(text(metadata)).toBe(`${expected}2025-26 · 2026-06-04`);
          expect(text(summary)).not.toContain("2025-26");
          expect(text(summary)).not.toContain(expected || "2026-06-04");
          const html = renderToStaticMarkup(tree);
          expect(html).toContain(isZh ? "2025-26 存档" : "2025-26 archive");
          expect(html).toContain('href="/team/MIN"');
        }
      }
    }
  });

  it.each(["en", "zh"] as const)("keeps live scores with no W/L result, including play-in context in %s", locale => {
    const row = gameRows(card({ ...game, gameId: "0052500101", status: 2, teamScore: 0, oppScore: 0 }, null, locale === "zh"))[0];
    const summary = nodes(row).find(node => node.props.className === favoriteStyles.gameSummary)!;
    expect(text(summary)).toContain(locale === "zh" ? "进行中" : "Live");
    expect(text(summary)).toContain("0-0");
    expect(nodes(summary).some(node => typeof node.props.className === "string" && node.props.className.startsWith("font-mono font-bold"))).toBe(false);
    expect(text(row)).toContain(locale === "zh" ? "附加赛" : "Play-In");
    expect(row.props.href).toBe("/game/0052500101");
  });

  it.each(["en", "zh"] as const)("keeps upcoming rows unlinked and preserves localized date fallback and missing data in %s", locale => {
    const upcoming = { ...game, gameId: "0022600001", status: 1 as const, calendarDate: undefined, season: "2026-27", teamScore: undefined, oppScore: undefined, win: undefined };
    const row = gameRows(card(null, upcoming, locale === "zh"))[1];
    expect(row.type).toBe("div");
    expect(row.props.href).toBeUndefined();
    expect(text(row)).toContain(`2026-27 · ${formatGameDate(upcoming.dateUTC, locale, { month: "short", day: "numeric", weekday: "short" })}`);
    expect(text(row)).not.toContain("119");
    expect(text(row)).not.toContain("111");
    const missing = gameRows(card(null, null, locale === "zh"));
    expect(text(missing[0])).toContain(locale === "zh" ? "暂无比赛" : "No game yet");
    expect(text(missing[1])).toContain(locale === "zh" ? "暂无已知赛程" : "No scheduled game available");
    for (const empty of missing) expect(nodes(empty).some(node => String(node.props.className).includes(favoriteStyles.gameLabel))).toBe(true);
  });
});

describe("mobile team identity and scorers", () => {
  it.each(["en", "zh"] as const)("keeps the full team title, data, schedule, favorites and sharing contract in %s", locale => {
    const t = getTranslations(locale);
    for (const meta of [TEAM_META.MIN, TEAM_META.POR, TEAM_META.NOP]) {
      const tree = TeamHero({ ...heroProps, team: meta, t });
      const all = nodes(tree);
      const title = all.find(node => node.type === "h1")!;
      expect(text(title)).toBe(`${meta.city}${meta.name}`);
      expect(String(title.props.className)).toContain(teamStyles.heroTitle);
      const actions = all.find(node => String(node.props.className).includes(teamStyles.heroActions))!;
      expect(nodes(actions).find(node => node.props.href)?.props.href).toBe(`/schedule?team=${meta.tricode}`);
      const favorite = nodes(actions).find(node => node.type === FavoriteButton)!;
      expect(favorite.props).toMatchObject({ type: "team", id: meta.tricode });
      const share = nodes(actions).find(node => node.type === ShareButton)!;
      expect(share.props).toMatchObject({ subject: "team", text: `${meta.city} ${meta.name} · 2026-27 · ${t.teamPage.noRegularData} | NBA Tracker\nhttps://nba.xpy.me/team/${meta.tricode}` });
      const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}>{tree}</LocaleProvider>);
      expect(html).toContain(`aria-label="${t.share.shareTeam}"`);
      expect(html).toContain("min-h-[44px] min-w-[44px]");
      expect(html).not.toContain("0.0%");
    }
  });

  it.each(["en", "zh"] as const)("keeps complete long scorer names, exact IDs/order and real points in %s", locale => {
    const tree = TeamRoster({ roster, t: getTranslations(locale) });
    const all = nodes(tree);
    const cards = all.filter(node => String(node.props.className).includes(teamStyles.scorerCard));
    expect(cards).toHaveLength(3);
    cards.forEach((card, index) => {
      const p = roster[index];
      expect(card.props.href).toBe(`/player/${p.personId}`);
      expect(text(card)).toBe(`${p.firstName} ${p.lastName}${p.pts} PPG`);
      const name = nodes(card).find(node => String(node.props.className).includes(teamStyles.scorerName))!;
      expect(name.props.className).not.toMatch(/truncate|line-clamp|overflow-hidden/);
    });
    expect(all.filter(node => node.type === "tr")).toHaveLength(4);
    expect(all.filter(node => node.props.href === "/player/203507")).toHaveLength(2);
    expect(nodes(TeamRoster({ roster: roster.slice(0, 2), t: getTranslations(locale) })).filter(node => String(node.props.className).includes(teamStyles.scorerCard))).toHaveLength(0);
  });

  it.each(["en", "zh"] as const)("describes unavailable upcoming records without asserting no game is scheduled in %s", locale => {
    const t = getTranslations(locale);
    const empty = renderToStaticMarkup(createElement(TeamScheduleCard, { mode: "upcoming", t, games: [] }));
    expect(empty).toContain(locale === "zh" ? "暂无可用的后续赛程记录" : "No upcoming game records available");
    expect(empty).not.toContain("No upcoming games scheduled");
    const populated = renderToStaticMarkup(createElement(TeamScheduleCard, { mode: "upcoming", t, games: [{ gameId: "0022600001", date: "2026-10-20", opponent: "OKC", opponentId: 1610612760, home: false }] }));
    expect(populated).toContain("OKC"); expect(populated).toContain("10-20");
    expect(populated).not.toContain(t.teamPage.noUpcomingGames);
  });
});

it("confines team layout changes to mobile and restores the existing desktop favorites order", () => {
  const teamCss = readFileSync("src/app/team/[tricode]/_components/team-mobile.module.css", "utf8");
  const favoriteCss = readFileSync("src/app/favorites/favorites-mobile.module.css", "utf8");
  expect(teamCss.replace(/\/\*[\s\S]*?\*\//g, "").trim().startsWith("@media (max-width: 639px) {")).toBe(true);
  expect(teamCss).toContain("grid-template-columns: 48px minmax(0, 1fr)");
  expect(teamCss).toContain("grid-column: 1 / -1");
  expect(teamCss).not.toMatch(/font-size|font-stretch|transform:|scale\(/);
  const desktop = favoriteCss.split("@media")[0];
  expect(desktop).toMatch(/\.gameSummary,\s*\.gameMetadata\s*{\s*display: contents;/);
  expect(desktop).toMatch(/\.gameType\s*{\s*order: 1/);
  expect(desktop).toMatch(/\.gameScore,\s*\.gameOpponent\s*{\s*order: 2/);
  expect(desktop).toMatch(/\.gameDate\s*{\s*order: 3/);
  expect(favoriteCss).toMatch(/\.gameLabel\s*{\s*width: 72px/);
  expect(favoriteCss).not.toContain("padding-left:");
  expect(favoriteCss).toMatch(/\.gameSummary\s*{\s*gap: 6px/);
  expect(favoriteCss).toContain("overflow: visible");
  expect(favoriteCss).toContain("white-space: nowrap");
});
