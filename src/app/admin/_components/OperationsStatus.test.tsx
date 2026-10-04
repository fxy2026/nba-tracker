import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OperationsContent, type OperationsReport } from "./OperationsStatus";

const fixture: OperationsReport = { generatedAt: "2026-10-04T08:00:00Z", data: { status: "available", source: "bundled-archive", recordedSeason: "2025-26", recordedGames: 1210, completedRecordedGames: 1100, recordedDates: 170, indexedPlayers: 610, playerIndexSeason: "2025-26", playerIndexFetchedAt: "2026-10-01T00:00:00Z" }, environment: { adminConfigured: true, deployment: "production" } };
it.each([false, true])("labels bundled coverage honestly rather than claiming live provider health, Chinese=%s", zh => {
  const html = renderToStaticMarkup(createElement(OperationsContent, { data: fixture, zh }));
  expect(html).toContain("2025-26"); expect(html).toContain("1,210"); expect(html).toContain("production");
  expect(html).toContain(zh ? "不代表上游接口实时可用" : "live availability of upstream services");
  expect(html).not.toMatch(/Supabase|Replay|录像|API Health/);
});
it("renders unavailable fields as dashes without inventing zeros or a passing health check", () => {
  const data: OperationsReport = { ...fixture, data: { ...fixture.data, status: "unavailable", recordedSeason: null, recordedGames: null, completedRecordedGames: null, recordedDates: null, indexedPlayers: null, playerIndexSeason: null } };
  const html = renderToStaticMarkup(createElement(OperationsContent, { data, zh: false }));
  expect(html.match(/>—</g)).toHaveLength(4); expect(html).not.toContain(">0<"); expect(html).toContain("Some local data unavailable");
});
