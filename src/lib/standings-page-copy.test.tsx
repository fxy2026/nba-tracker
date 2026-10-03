import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
import { currentSeason } from "./constants";
import { scheduleForSeason } from "./games";
import type { ScheduleDate, ScheduleGame } from "./api";

const { schedule, locale } = vi.hoisted(() => ({ schedule: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: schedule, getScheduleAge: () => null }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function game(gameId: string, gameStatus = 3, homeScore = 110, awayScore = 100): ScheduleGame {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  return {
    gameId, gameStatus, gameStatusText: "Final", gameCode: "", gameDateTimeUTC: "2026-10-21T00:00:00Z",
    homeTeam: { ...team, teamId: 1610612738, teamTricode: "BOS", score: homeScore },
    awayTeam: { ...team, teamId: 1610612752, teamTricode: "NYK", score: awayScore },
  };
}
function dates(...games: ScheduleGame[]): ScheduleDate[] {
  return [{ gameDate: "10/21/2026 00:00:00", games }];
}
async function render() {
  const { default: Page } = await import("@/app/standings/page");
  return renderToStaticMarkup(await Page());
}

beforeEach(() => {
  schedule.mockReset();
  locale.mockResolvedValue("en");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("standings season and empty-state provenance", () => {
  it.each(["en", "zh"])("labels the requested season without inferring game absence in %s", async language => {
    locale.mockResolvedValue(language);
    schedule.mockResolvedValue([]);
    const html = await render();
    expect(schedule).toHaveBeenCalledExactlyOnceWith("2026-27");
    expect(html).toContain(language === "zh" ? "2026-27 · 常规赛" : "2026-27 · Regular season");
    expect(html).toContain(language === "zh"
      ? "当前没有可用于计算 2026-27 赛季排名的已结束常规赛记录。"
      : "No usable completed regular-season records are available for 2026-27.");
    expect(html).not.toMatch(/<table|role="alert"|2025-26|season has not started|赛季尚未开始|0 games|0 场比赛/);
  });

  it.each(["en", "zh"])("distinguishes only a known rejected schedule request in %s", async language => {
    locale.mockResolvedValue(language);
    schedule.mockRejectedValue(new Error("Upstream unavailable"));
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain(language === "zh" ? "暂时无法加载排名" : "Unable to load standings");
    expect(html).toContain(language === "zh"
      ? "未能加载 2026-27 赛季赛程，请稍后重试。"
      : "We couldn&#x27;t load the schedule for 2026-27. Try again later.");
    expect(html).not.toMatch(/No usable completed|当前没有可用于计算|Upstream unavailable|<table/);
  });

  it("keeps archive-only data empty and preserves the regular-season/final/valid-score filters", async () => {
    const archive = dates(game("0022500001"));
    const unsupported = dates(game("0012600001"), game("0042600001"), game("0062600001"), game("0022600001", 1), game("0022600002", 3, 0, 0));
    schedule.mockImplementation((season: string) => Promise.resolve(scheduleForSeason([...archive, ...unsupported], season)));
    expect(await render()).toContain("No usable completed regular-season records are available for 2026-27.");
  });

  it("keeps populated current-season tables and export with identical results when archive data is present", async () => {
    const current = dates(game("0022600001"));
    const archive = dates(game("0022500001", 3, 150, 149));
    schedule.mockImplementation((season: string) => Promise.resolve(scheduleForSeason(current, season)));
    const clean = await render();
    schedule.mockImplementation((season: string) => Promise.resolve(scheduleForSeason([...archive, ...current], season)));
    const mixed = await render();
    expect(mixed).toBe(clean);
    expect(mixed.match(/<table/g)).toHaveLength(2);
    expect(mixed).toContain("2026-27 · Regular season");
    expect(mixed).toContain(getTranslations("en").export.exportBtn);
    expect(mixed).toContain("BOS");
    expect(mixed).toContain("W1");
    expect(mixed).not.toMatch(/No standings data|Unable to load standings|2025-26/);
  });

  it("uses the existing October UTC rollover for both query and label", async () => {
    schedule.mockResolvedValue([]);
    vi.setSystemTime(new Date("2026-09-30T23:59:59Z"));
    expect(await render()).toContain("2025-26 · Regular season");
    expect(schedule).toHaveBeenLastCalledWith("2025-26");
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    expect(await render()).toContain("2026-27 · Regular season");
    expect(schedule).toHaveBeenLastCalledWith(currentSeason());
  });
});

it("uses historical tense for Kareem's unchanged scoring record fact", () => {
  const source = readFileSync("src/components/GamesList.tsx", "utf8");
  expect(source).toContain("Kareem Abdul-Jabbar held the all-time regular season scoring record with 38,387 points (surpassed by LeBron in 2023).");
  expect(source).not.toContain("Kareem Abdul-Jabbar holds");
});
