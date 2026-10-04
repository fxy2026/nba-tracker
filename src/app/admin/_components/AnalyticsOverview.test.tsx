import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import styles from "../admin.module.css";
import type { VisitorAnalytics } from "./AnalyticsOverview";
import { AnalyticsContent, AnalyticsSkeleton, chartPoints, validAnalytics } from "./AnalyticsOverview";

export function analyticsFixture(overrides: Partial<VisitorAnalytics> = {}): VisitorAnalytics {
  return {
    status: "ready", timezone: "Asia/Shanghai", metric: "daily-browser", collectedSince: "2026-10-03T18:00:00Z", generatedAt: "2026-10-04T08:00:00Z", range: { days: 7, from: "2026-09-28", to: "2026-10-04" },
    today: { pageViews: 12, visitors: null, identifiedPageViews: 0, missingIdentityPageViews: 12 },
    period: { pageViews: 12, visitorDays: null, avgDailyVisitors: null, identifiedPageViews: 0, missingIdentityPageViews: 12, observedDays: 1 },
    series: [{ date: "2026-10-04", pageViews: 12, visitors: null, identifiedPageViews: 0, missingIdentityPageViews: 12 }],
    pages: [{ path: "/player/[id]", pageViews: 12 }], referrers: [{ source: "internal", pageViews: 12 }], devices: [{ device: "mobile", pageViews: 12 }], limited: false,
    ...overrides,
  };
}
const render = (data: VisitorAnalytics, zh = false) => renderToStaticMarkup(createElement(AnalyticsContent, { data, zh, onRetry: () => {} }));

describe("honest historical analytics presentation", () => {
  it.each([false, true])("shows actual page views with UV unavailable and consent/coverage semantics, Chinese=%s", zh => {
    const html = render(analyticsFixture(), zh);
    expect(html).toContain("12"); expect(html.match(/>—</g)).toHaveLength(3); // Two KPI values and the daily row.
    expect(html).toContain(zh ? "明确同意" : "explicitly opted-in"); expect(html).toContain("0%.");
    expect(html).toContain(zh ? "已开始采集的 1 天" : "1 observed days");
    expect(html).toContain(zh ? "屏幕尺寸" : "Screen sizes"); expect(html).toContain("/player/[id]");
    expect(html).not.toContain("unique visitors");
  });
  it.each(["unconfigured", "unavailable"] as const)("uses dashes and an explicit %s state, never fabricated zeros or trends", status => {
    const data = analyticsFixture({ status, collectedSince: null, today: null, period: null, series: null, pages: null, referrers: null, devices: null });
    const html = render(data); expect(html.match(/>—</g)).toHaveLength(4);
    expect(html).toContain(status === "unconfigured" ? "isn&#x27;t configured" : "temporarily unavailable");
    expect(html).not.toContain("<svg viewBox=\"0 0 776"); expect(html).not.toContain(">0<");
  });
  it.each([false, true])("explains non-ready analytics before unknown metrics, Chinese=%s", zh => {
    for (const status of ["unconfigured", "unavailable"] as const) {
      const html = render(analyticsFixture({ status, collectedSince: null, today: null, period: null, series: null, pages: null, devices: null, referrers: null }), zh);
      const metricsStart = html.indexOf(`class="${styles.metrics}"`);
      expect(html).toMatch(new RegExp(`^<div class="${styles.status}" role="${status === "unavailable" ? "alert" : "status"}">`));
      expect(metricsStart).toBeGreaterThan(html.indexOf(zh ? "重新检查" : "Check again"));
      expect(html.match(/>—</g)).toHaveLength(4);
      expect(html).not.toContain(zh ? "这段时间没有保存的旧版页面浏览记录" : "No legacy page views are stored for this period");
    }
  });
  it.each([false, true])("keeps unknown collection history distinct from a verified empty store, Chinese=%s", zh => {
    for (const status of ["unconfigured", "unavailable"] as const) {
      const html = render(analyticsFixture({ status, collectedSince: null, today: null, period: null, series: null, pages: null, referrers: null, devices: null }), zh);
      expect(html).toContain(zh ? "采集历史暂不可用" : "Collection history unavailable");
      expect(html).not.toContain(zh ? "尚无历史采集记录" : "No collection history yet");
    }
    const ready = render(analyticsFixture({ collectedSince: null }), zh);
    expect(ready).toContain(zh ? "尚无历史采集记录" : "No collection history yet");
  });
  it("shows zero only for actual empty persisted results", () => {
    const empty = analyticsFixture({ collectedSince: null, today: { pageViews: 0, visitors: null, identifiedPageViews: 0, missingIdentityPageViews: 0 }, period: { pageViews: 0, visitorDays: null, avgDailyVisitors: null, observedDays: 0, identifiedPageViews: 0, missingIdentityPageViews: 0 }, series: [], pages: [], devices: [], referrers: [] });
    const html = render(empty); expect(html.startsWith(`<div class="${styles.metrics}">`)).toBe(true); expect(html).not.toContain(`class="${styles.status}"`); expect(html.match(/>0</g)).toHaveLength(2); expect(html).toContain("No legacy page views are stored"); expect(html).not.toContain(">0%.");
  });
  it("exposes daily exact values, partial collection coverage and cap warning", () => {
    const data = analyticsFixture({ limited: true, today: { pageViews: 12, visitors: 2, identifiedPageViews: 4, missingIdentityPageViews: 8 }, period: { pageViews: 12, visitorDays: 2, avgDailyVisitors: 2, identifiedPageViews: 4, missingIdentityPageViews: 8, observedDays: 1 }, series: [{ date: "2026-10-04", pageViews: 12, visitors: 2, identifiedPageViews: 4, missingIdentityPageViews: 8 }] });
    const html = render(data); expect(html).toContain("33%."); expect(html).toContain("daily collection limit"); expect(html).toContain("View daily data"); expect(html).toContain("<td>2</td>"); expect(html).toContain("Shanghai time");
  });
  it("rejects malformed successful payloads rather than coercing missing and negative counts to zero", () => {
    expect(validAnalytics(analyticsFixture())).toBe(true);
    expect(validAnalytics(analyticsFixture({ today: null }))).toBe(false);
    expect(validAnalytics(analyticsFixture({ period: { ...analyticsFixture().period!, pageViews: -1 } }))).toBe(false);
    expect(validAnalytics({ ...analyticsFixture(), series: [{ date: "2026-10-04", pageViews: 2 }] } as VisitorAnalytics)).toBe(false);
  });
  it("does not create zero-valued points for missing UV or invent pre-collection dates", () => {
    const chart = chartPoints(analyticsFixture().series!);
    expect(chart.points).toHaveLength(1); expect(chart.points[0].visitorY).toBeNull(); expect(chart.points[0].x).toBe(398);
  });
  it("renders an accessible loading state without numeric fixtures", () => {
    const html = renderToStaticMarkup(createElement(AnalyticsSkeleton, { zh: false }));
    expect(html).toContain('role="status"'); expect(html).toContain("Loading analytics"); expect(html).not.toContain("1,234");
  });
});
