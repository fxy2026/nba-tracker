import { beforeEach, expect, it, vi } from "vitest";
import { resolveArchiveGameId } from "./archive-game-alias";
import schedule from "@/data/schedule-2025-26.json";
const mocks = vi.hoisted(() => ({ box: vi.fn(), schedule: vi.fn(), redirect: vi.fn((url: string): never => { throw new Error(`permanent:${url}`); }) }));
vi.mock("next/navigation", () => ({ permanentRedirect: mocks.redirect }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getBoxScore: mocks.box, getFullSchedule: mocks.schedule }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
beforeEach(() => { vi.clearAllMocks(); mocks.box.mockResolvedValue(null); mocks.schedule.mockResolvedValue(schedule.dates); });

it.each(["0042500173", "0022500989", "9401810012", "__proto__", "unknown"])("leaves unlisted identity %s untouched", id => {
  expect(resolveArchiveGameId(id)).toBe(id);
});
it("the actual legacy game page permanently redirects before requesting any game data", async () => {
  const { default: Page } = await import("@/app/game/[id]/page");
  await expect(Page({ params: Promise.resolve({ id: "9401869400" }) })).rejects.toThrow("permanent:/game/0042500173");
  expect(mocks.redirect).toHaveBeenCalledWith("/game/0042500173");
  expect(mocks.box).not.toHaveBeenCalled();
  expect(mocks.schedule).not.toHaveBeenCalled();
});
it("metadata resolves the alias to the canonical playoff ID and source", async () => {
  const { generateMetadata } = await import("@/app/game/[id]/page");
  const metadata = await generateMetadata({ params: Promise.resolve({ id: "9401869400" }) });
  expect(mocks.box).toHaveBeenCalledWith("0042500173");
  expect(metadata.alternates?.canonical).toBe("/game/0042500173");
  expect(metadata.title).toBe("LAL vs HOU");
});
