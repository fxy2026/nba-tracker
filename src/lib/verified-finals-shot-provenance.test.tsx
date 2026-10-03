import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import { LocaleProvider } from "@/components/LocaleProvider";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
import { reviewedShotGames } from "./verified-shot-chart-allowlist";

const cases = [
  { id: "0042500401", total: 183, code: "20260603/NYKSAS", utc: "2026-06-04T00:30:00Z", captured: "2026-10-03T07:37:53.735101+00:00" },
  { id: "0042500402", total: 167, code: "20260605/NYKSAS", utc: "2026-06-06T00:30:00Z", captured: "2026-10-03T07:38:00.990946+00:00" },
  { id: "0042500403", total: 172, code: "20260608/SASNYK", utc: "2026-06-09T00:30:00Z", captured: "2026-10-03T07:38:09.681788+00:00" },
  { id: "0042500404", total: 164, code: "20260610/SASNYK", utc: "2026-06-11T00:30:00Z", captured: "2026-10-03T07:38:19.677708+00:00" },
] as const;
const games = schedule.dates.flatMap(date => date.games);

describe("Finals G1–G4 explicit provenance and unchanged comparison presentation", () => {
  it.each(cases)("pins independently reviewed identities, source times, and evidence hashes for $id", ({ id, total, code, utc, captured }) => {
    const game = games.find(game => game.gameId === id)!;
    const data = getVerifiedShotChart(game)!;
    const pin = reviewedShotGames[id];
    const bytes = readFileSync(`src/data/verified-shot-charts/${id}.json`);
    const evidence = JSON.parse(readFileSync(`docs/evidence/verified-shot-charts/${id}.json`, "utf8"));
    const facts = JSON.parse(bytes.toString());
    expect(game.gameCode).toBe(code);
    expect(game.gameDateTimeUTC).toBe(utc);
    expect(data.source.retrievedAt).toBe(captured);
    expect(data.source.url).toBe(evidence.review.sourceCapture.url);
    expect(evidence.sourceManifestSha256).toBe("50f72ecece3c15b9e3cba302a96696d4ea237b905cb5a880196ae6c91006f024");
    expect(evidence.review.candidateFileSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(evidence.review.canonicalFactsSha256).toBe(pin.factsSha256);
    expect(evidence.review.shotCount).toBe(total);
    expect(evidence.review.fieldGoalRowsExactlyPreservedIncludingTypesAndOrder).toBe(true);
    expect(evidence.review.officialRosterRowsVerified).toBe(30);
    expect(evidence.review.shotIdentityVerifiedFromOfficialBoxAndActionNames).toBe(true);
    expect(facts.players).toHaveLength(30);
    expect(pin.home.periods).toHaveLength(4);
    expect(pin.away.periods).toHaveLength(4);
    expect(JSON.stringify(data)).not.toMatch(/minutes|description|shotDistance|actionId|scoreHome|scoreAway|officialPersonId|providerPlayerId/);
    expect(evidence.integrationGates.join(" ")).toContain("true precision is not independently established");
  });
  it.each(cases.flatMap(item => (["en", "zh"] as const).map(locale => ({ ...item, locale }))))("renders every exact source shot and truthful controls for $id ($locale)", ({ id, total, locale }) => {
    const data = getVerifiedShotChart(games.find(game => game.gameId === id)!)!;
    const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><ShotChartExplorer data={data} /></LocaleProvider>);
    expect((html.match(/data-shot-id=/g) || []).length).toBe(total);
    expect(html).toContain(`${total}/${total}`);
    expect(html).toContain('data-court-focus="full"');
    expect(html).toContain('data-court-state="flat"');
    expect(html).not.toContain("<canvas");
    expect(data.shots.every(shot => shot.period <= 4)).toBe(true);
    expect(html).toContain(data.source.url);
    expect(html).toContain(locale === "en" ? "not actual attacking direction" : "不代表比赛实际进攻方向");
    expect(html).toContain(locale === "en" ? "not ball flight" : "不代表篮球飞行轨迹");
    for (const team of [data.away, data.home]) expect(html).toContain(`aria-label="${team.teamTricode} ${locale === "en" ? "Player" : "球员"}"`);
  });
  it("retains Sochan's source 2:60 alongside PDF 03:00 as equivalent duration, never a literal-match claim", () => {
    const evidence = JSON.parse(readFileSync("docs/evidence/verified-shot-charts/0042500404.json", "utf8"));
    const text = JSON.stringify(evidence.review.pdfMinuteRepresentationCaveats);
    expect(text).toContain("2:60");
    expect(text).toContain("03:00");
    expect(text).toContain("180");
    expect(evidence.caveats.join(" ")).toContain("Game 3 Jeremy Sochan was a NYK appearance lasting ten seconds");
    const docs = readFileSync("docs/verified-shot-charts.md", "utf8");
    expect(docs).toContain("not independent proof of exact basket-level precision");
    expect(docs).toContain("silently normalize");
  });
});
