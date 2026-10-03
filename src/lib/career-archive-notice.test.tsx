import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import CareerArchiveNotice from "@/app/lab/career-arc/CareerArchiveNotice";
import type { ArchivedCareerProvenance } from "@/lib/player-career-provenance";
import snapshot from "@/data/player-career-archives/2544-2026-10-03.json";

const provenance = snapshot.data.provenance as ArchivedCareerProvenance;
it.each([false, true])("native disclosure keeps full provenance with compact visible state; zh=%s", isZh => {
  for (const checkingLive of [true, false]) {
    const onRetry = vi.fn();
    const element = CareerArchiveNotice({ provenance, isZh, checkingLive, onRetry });
    const html = renderToStaticMarkup(createElement(CareerArchiveNotice, { provenance, isZh, checkingLive, onRetry }));
    const disclosure = html.match(/<details\b[\s\S]*?<\/details>/)?.[0] ?? "";
    const visible = html.replace(disclosure, "");
    expect(visible).toContain(isZh ? "NBA.com 存档快照" : "Archived NBA.com snapshot");
    expect(visible).toContain(provenance.coverage.firstSeason);
    expect(visible).toContain(provenance.coverage.lastSeason);
    expect(visible).toContain(`${provenance.coverage.seasonCount} ${isZh ? "个常规赛赛季" : "regular seasons"}`);
    expect(visible).toContain(checkingLive ? (isZh ? "正在检查实时来源" : "Checking live sources") : (isZh ? "实时更新不可用或历史不完整" : "Live refresh unavailable or history incomplete"));
    expect(visible).not.toContain(provenance.capturedAt);
    expect(disclosure).toContain(provenance.capturedAt);
    expect(disclosure).toContain("https://www.nba.com/stats/player/2544/career");
    expect(disclosure).toContain(isZh ? `${provenance.coverage.rowCount} 行` : `${provenance.coverage.rowCount} rows`);
    expect(disclosure).toContain(isZh ? "可能缺少后续更新" : "may miss later updates");
    expect(disclosure).toContain(isZh ? "不是数据源的最后更新时间" : "last-update time");
    expect(disclosure).toMatch(/<details[^>]*><summary class="min-h-11/);
    expect(disclosure).not.toMatch(/<details[^>]*\bopen/);
    expect(html).toMatch(/<button[^>]*class="min-h-11 min-w-11/);
    if (checkingLive) expect(html).toContain('disabled=""');
    else expect(html).not.toContain('disabled=""');
    // Retry remains the exact hook callback; the native disabled button owns pending suppression.
    const button = element.props.children[3].props.children[1];
    expect(button.props.onClick).toBe(onRetry);
    expect(button.props.disabled).toBe(checkingLive);
    if (!checkingLive) { button.props.onClick(); expect(onRetry).toHaveBeenCalledOnce(); }
  }
});
