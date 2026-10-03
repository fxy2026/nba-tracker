import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import type { ShotAction } from "./api";
import ShotChart from "@/components/ShotChart";

vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));

it("legacy live-chart summaries classify explicit 2PT/3PT values rather than distance", () => {
  const base: ShotAction = { personId: 1, playerNameI: "A. Player", teamTricode: "DET", period: 1, clock: "PT10M00.00S", actionType: "2pt", subType: "Jump Shot", shotResult: "Made", x: 25, y: 50, shotDistance: 24, description: "Long two" };
  const html = renderToStaticMarkup(<ShotChart shots={[base, { ...base, personId: 2, actionType: "3pt", shotDistance: 0, description: "Source distance unavailable" }]} homeTricode="DET" awayTricode="MEM" players={[]} />);
  expect(html).toContain("2PT: 1/1");
  expect(html).toContain("3PT: 1/1");
});
