import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlayerMobileSummary, { type MobileProfileMetric } from "./PlayerMobileSummary";
import PlayerMobileIdentity from "./PlayerMobileIdentity";

vi.mock("@/components/FavoriteButton", () => ({ default: () => <button>Favorite</button> }));
vi.mock("@/components/ShareButton", () => ({ default: () => <button>Share</button> }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: ({ name }: { name: string }) => <div>{name}</div> }));
const metrics: MobileProfileMetric[] = [
  { label: "Points", abbreviation: "PTS", value: 20.9, context: { rank: 34, percentile: 94, cohortSize: 578, sampleAvg: 8.2, delta: 154.878 } },
  { label: "Rebounds", abbreviation: "REB", value: 0, context: null },
  { label: "Assists", abbreviation: "AST", value: null, context: null },
];
const render = (locale: "en" | "zh" = "en") => renderToStaticMarkup(<PlayerMobileSummary playerId={2544} locale={locale} source="2025-26 · archived snapshot" metrics={metrics} />);

describe("compact phone player presentation", () => {
  it("shows the three numbers immediately and distinguishes recorded zero from missing averages", () => {
    const html = render();
    const primary = html.slice(html.indexOf("<dl"), html.indexOf("</dl>") + 5);
    expect(primary.match(/<dt>/g)).toHaveLength(3);
    expect(primary).toContain("20.9</dd>"); expect(primary).toContain("0.0</dd>"); expect(primary).toContain("—</dd>");
    expect(primary).not.toContain("578"); expect(primary).not.toContain("Sample avg");
    expect(html.indexOf("20.9</dd>")).toBeLessThan(html.indexOf("<details"));
    expect(html).not.toContain("NaN"); expect(html).not.toContain("Infinity");
  });
  it.each(["en", "zh"] as const)("keeps complete source and comparison facts in one native disclosure (%s)", locale => {
    const html = render(locale);
    expect(html.match(/<details\b/g)).toHaveLength(1);
    expect(html).not.toContain("<details open");
    const disclosure = html.slice(html.indexOf("<details"), html.indexOf("</details>") + 10);
    expect(disclosure).toContain("2025-26 · archived snapshot");
    for (const text of locale === "en" ? ["Team affiliation and averages reflect this snapshot", "#34 of 578", "8.2", "P94", "+155%", "no games-played or minutes minimum", "Ties share rank and P"] : ["球队归属和场均数据以该快照为准", "578 人中第 34", "样本均值", "8.2", "P94", "+155%", "不设出场数或上场时间门槛", "同值并列"]) expect(disclosure).toContain(text);
    expect(html).toContain('href="/compare?p1=2544"');
    expect(html).not.toContain("in NBA"); expect(html).not.toContain("league avg");
  });
  it("keeps real team and snapshot labels while archive identities have no fabricated team", () => {
    const active = renderToStaticMarkup(<PlayerMobileIdentity id={2544} name="LeBron James" subtitle="Los Angeles Lakers" teamId={1610612747} teamHref="/team/LAL" facts={["F", "#23", "6-9"]} source="2025-26 · archived snapshot" locale="en" />);
    expect(active).toContain('href="/team/LAL"'); expect(active).toContain("Los Angeles Lakers"); expect(active).toContain("2025-26 · archived snapshot"); expect(active).toContain("#23");
    const archived = renderToStaticMarkup(<PlayerMobileIdentity id={781} name="Eric Piatkowski" subtitle="Recorded player identity" source="NBA official all-time player registry" locale="en" />);
    expect(archived).not.toContain('href="/team/'); expect(archived).not.toContain("#23"); expect(archived).toContain("NBA official all-time player registry");
  });
  it("contains all phone layout changes in the phone breakpoint and avoids duplicating a data owner", () => {
    const mobile = readFileSync(new URL("./player-mobile.module.css", import.meta.url), "utf8");
    expect(mobile.slice(0, mobile.indexOf("@media"))).toContain(".summary { display: none; }");
    expect(mobile).toContain("@media (max-width: 639px)");
    expect(mobile).toContain(".overview > :not(.summary) { display: none; }");
    expect(mobile).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(mobile).toContain("min-height: 44px");
    const summary = readFileSync(new URL("./PlayerMobileSummary.tsx", import.meta.url), "utf8");
    expect(summary).not.toContain('"use client"'); expect(summary).not.toContain("usePlayerCareer"); expect(summary).not.toContain("CountUpNumber");
    const shot = readFileSync(new URL("../shot-map/shot-map.module.css", import.meta.url), "utf8");
    const playerTreatment = shot.slice(shot.indexOf("/* Compact player-panel treatment"));
    expect(playerTreatment).toContain("@media (max-width: 639px)");
    expect(playerTreatment).toContain(":global([data-player-panel]) .explorer");
    expect(playerTreatment).toContain("vector-effect:non-scaling-stroke");
    expect(playerTreatment).toContain("font-size:clamp(22px, 7vw, 27px)");
    expect(mobile).toContain("@media (max-width: 379px)");
    const source = readFileSync(new URL("../shot-map/ShotMapCourt.tsx", import.meta.url), "utf8");
    expect(source).toContain("fillOpacity={max?bin.fga/max:0}");
  });
});
