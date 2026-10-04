import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getHistoricalCareerArchive } from "./historical-career-archive";

const state = vi.hoisted(() => ({ index: 0, seasonType: "Regular Season", mode: "per-game" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [state.index++ === 0 ? state.seasonType : state.mode, vi.fn()] }));
import HistoricalPlayerCareer from "@/components/player/HistoricalPlayerCareer";

for (const fixture of [{ id: 76003, regular: 20, playoffs: 18 }, { id: 76375, regular: 14, playoffs: 13 }]) {
  describe.each(["en", "zh"] as const)(`early-era ${fixture.id} profile in %s`, locale => {
    it.each(["Regular Season", "Playoffs"] as const)("renders %s in both modes with unknown values and scoped provenance", async seasonType => {
      const data = (await getHistoricalCareerArchive(fixture.id))!;
      for (const mode of ["per-game", "totals"]) {
        Object.assign(state, { index: 0, seasonType, mode });
        const html = renderToStaticMarkup(createElement(HistoricalPlayerCareer, { data, locale }));
        expect(html.match(/scope="row"/g)).toHaveLength((seasonType === "Regular Season" ? fixture.regular : fixture.playoffs) + 1);
        expect(html).toContain('role="region"'); expect(html).toContain('tabindex="0"');
        expect(html).toContain(locale === "zh" ? "当时未统计" : "not recorded at the time");
        expect(html).toContain(locale === "zh" ? "约采集时间" : "Approximate collection time");
        expect(html).toContain("2026-10-04 03:36");
        expect(html).not.toContain(locale === "zh" ? "固定检索时间" : "Fixed retrieval time");
        expect(html).toContain(locale === "zh" ? "并非 NBA 官方核验" : "not an NBA-officially verified");
        expect(html).not.toContain("NaN"); expect(html).not.toMatch(/<details[^>]*open/);
        const footer = html.match(/<tfoot>[\s\S]*?<\/tfoot>/)![0];
        expect((footer.match(/>—<\/td>/g) || []).length).toBeGreaterThanOrEqual(6);
        if (fixture.id === 76003) {
          expect(html).toContain(seasonType === "Regular Season" ? "1239" : "196");
          expect(html).toContain(seasonType === "Regular Season" ? "929" : "169");
          expect(html).toContain(seasonType === "Regular Season" ? "787" : "158");
          expect(html).toContain(locale === "zh" ? "不除以全部生涯出场数" : "not treated as complete-career totals");
        } else {
          expect(html).toContain('title="Philadelphia Warriors">PHW<span class="sr-only">: Philadelphia Warriors</span>');
          expect(html).toContain("PHW: Philadelphia Warriors");
          expect(html).toContain("PHI: Philadelphia 76ers");
          expect(html).toContain(locale === "zh" ? "出场数只计算一次" : "counted once");
          expect(html).toContain(locale === "zh" ? "常规赛数字表未采用" : "regular-season numeric table is not used");
          expect(html).toContain(locale === "zh" ? "无已收录赛季" : "no recorded seasons");
          expect(html).not.toContain('href="/team/PHW"');
        }
      }
    });
  });
}
