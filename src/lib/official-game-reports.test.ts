import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { getOfficialGameReport } from "./official-game-reports";
import OfficialGameReport from "@/app/game/[id]/_components/OfficialGameReport";

it.each([
  ["0022500340", "https://statsdmz.nba.com/pdfs/20251205/20251205_DENATL.pdf"],
  ["0022500961", "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf"],
])("links only the explicitly verified report for %s", (id, url) => {
  expect(getOfficialGameReport(id)).toBe(url);
  const html = renderToStaticMarkup(createElement(OfficialGameReport, { gameId: id, isZh: false }));
  expect(html).toContain(`href="${url}"`);
  expect(html).toContain("external PDF");
  expect(html).toContain('rel="noopener noreferrer"');
});
it.each(["0022500341", "9401810012", "__proto__"])("does not invent an external report for %s", (gameId) => {
  expect(getOfficialGameReport(gameId)).toBeNull();
  expect(renderToStaticMarkup(createElement(OfficialGameReport, { gameId, isZh: true }))).toBe("");
});
it("clearly identifies the external official PDF in Chinese", () => {
  expect(renderToStaticMarkup(createElement(OfficialGameReport, { gameId: "0022500340", isZh: true }))).toContain("NBA 官方技术统计报告（PDF，外部链接）");
});
