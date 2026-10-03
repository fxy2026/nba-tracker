import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { schedule, locale } = vi.hoisted(() => ({ schedule: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: schedule }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/TeamLogo", () => ({ default: () => null }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));
vi.mock("@/components/Breadcrumbs", () => ({ default: () => null }));
vi.mock("@/components/RelatedPages", () => ({ default: () => null }));
import Page from "@/app/h2h/page";

const finalGame = {
  gameId: "0022600001", gameStatus: 3,
  homeTeam: { teamTricode: "LAL", teamId: 1610612747, score: 101 },
  awayTeam: { teamTricode: "BOS", teamId: 1610612738, score: 99 },
};
type Params = { t1?: string | string[]; t2?: string | string[] };
const render = async (params: Params) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
beforeEach(() => {
  schedule.mockReset().mockResolvedValue([{ gameDate: "10/21/2026 00:00:00", games: [finalGame] }]);
  locale.mockReset().mockResolvedValue("en");
});

describe("actual H2H page selection boundaries", () => {
  it.each([
    { t1: ["LAL", "BOS"], t2: "NYK" },
    { t1: "LAL", t2: ["BOS", "NYK"] },
    { t1: ["LAL"], t2: "BOS" },
    { t1: "", t2: "BOS" },
    { t1: "   ", t2: "BOS" },
    { t1: "INVALID", t2: "BOS" },
    { t1: "__proto__", t2: "BOS" },
    { t1: "constructor", t2: "BOS" },
    { t1: "toString", t2: "BOS" },
  ])("renders recoverable guidance without fetching for %j", async params => {
    const html = await render(params);
    expect(html).toContain('role="status"');
    expect(html).toContain("Invalid team selection");
    expect(html).toContain('/h2h?t1=LAL');
    expect(schedule).not.toHaveBeenCalled();
  });

  it("omitted selections are ordinary initial state", async () => {
    const html = await render({});
    expect(html).not.toContain('role="status"');
    expect(html).toContain('/h2h?t1=LAL');
    expect(schedule).not.toHaveBeenCalled();
  });

  it.each(["en", "zh"])("identical teams get localized recovery and disabled duplicate choices (%s)", async lang => {
    locale.mockResolvedValue(lang);
    const html = await render({ t1: "bos", t2: "BOS" });
    expect(html).toContain(lang === "zh" ? "请选择两支不同的球队" : "Please select two different teams");
    expect((html.match(/<button[^>]*disabled=""/g) ?? [])).toHaveLength(2);
    expect(html).not.toContain('href="/h2h?t1=BOS&amp;t2=BOS"');
    expect(html).toContain('href="/h2h?t1=LAL&amp;t2=BOS"');
    expect(schedule).not.toHaveBeenCalled();
  });

  it("normalizes lowercase/whitespace, preserves final results and valid selection URLs", async () => {
    const html = await render({ t1: " lal ", t2: "bos" });
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(html).not.toContain('role="status"');
    expect(html).toContain('href="/game/0022600001"');
    expect(html).toContain("101");
    expect(html).toContain("99");
    expect(html).toContain('href="/h2h?t1=NYK&amp;t2=BOS"');
    expect(html).toContain('href="/h2h?t2=NYK&amp;t1=LAL"');
    expect(html).not.toContain('href="/h2h?t1=BOS&amp;t2=BOS"');
    expect(html).not.toContain('href="/h2h?t2=LAL&amp;t1=LAL"');
    expect((html.match(/<button[^>]*disabled=""/g) ?? [])).toHaveLength(2);
  });

  it("invalid Chinese input shows Chinese guidance", async () => {
    locale.mockResolvedValue("zh");
    expect(await render({ t1: ["BOS", "LAL"] })).toContain("球队选择无效");
  });
});
