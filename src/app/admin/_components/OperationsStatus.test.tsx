import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OperationsContent, type OperationsReport } from "./OperationsStatus";
import { getAdminArchiveCoverage } from "@/lib/admin-archive-coverage";

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
  expect(html.match(/>—</g)).toHaveLength(8); expect(html).not.toContain(">0<"); expect(html).toContain("Some local data unavailable");
});


it.each([false, true])("separates source-aware coverage and provenance dates, Chinese=%s", zh => {
  const data = { ...fixture, coverage: getAdminArchiveCoverage() };
  const html = renderToStaticMarkup(createElement(OperationsContent, { data, zh }));
  for (const count of ["5,238", "2,840", "6,328,070", "20,421", "252", "133", "119", "64"]) expect(html).toContain(count);
  expect(html).toContain(zh ? "NBA 官方身份快照" : "Official identity snapshot");
  expect(html).toContain(zh ? "NBA.com 已审核生涯" : "NBA.com-reviewed careers");
  expect(html).toContain(zh ? "次级来源已审核生涯" : "Secondary-source careers");
  expect(html).toContain(zh ? "完整生涯统计未经 NBA 官方核验" : "full career totals are not NBA-verified");
  expect(html).toContain(zh ? "元数据本地核验日期" : "Metadata locally verified");
  expect(html).toContain(zh ? "原始来源采集日期未记录" : "Original source capture date unrecorded");
  expect(html).toContain(zh ? "隔离记录未计入" : "quarantined rows excluded");
  expect(html).toContain(zh ? "2 个包存在对照值差异" : "2 packs have control mismatches");
  expect(html).toContain("2026-10-03"); expect(html).toContain("2026-10-04");
  expect(html).not.toContain("08:00:00");
  expect(html).toContain(zh ? "不能相加作为球员总数" : "player counts cannot be added together");
});

it("keeps other sections visible when one metadata section is unavailable", () => {
  const coverage = getAdminArchiveCoverage();
  coverage.nbaCareers = { status: "unavailable", data: null };
  const html = renderToStaticMarkup(createElement(OperationsContent, { data: { ...fixture, coverage }, zh: false }));
  expect(html).toContain("5,238"); expect(html).toContain("2,840"); expect(html).toContain("6,328,070");
  expect(html).toContain("Coverage metadata unavailable"); expect(html.match(/>—</g)).toHaveLength(1);
  expect(html).not.toContain("64 regular-season rows");
});
