import { describe, expect, it } from "vitest";
import PlayerSeasonHeatmap from "./PlayerSeasonHeatmap";
import type { HeatmapIdentity } from "@/lib/season-heatmap";

describe("committed profile shooting URL selection", () => {
  it("remounts the selection session for same-player query navigation and Back/Forward", () => {
    const a: HeatmapIdentity = { playerId: 977, season: "2015-16", seasonType: "Regular Season" };
    const b: HeatmapIdentity = { playerId: 977, season: "2009-10", seasonType: "Playoffs" };
    const render = (initialSelection: HeatmapIdentity) => PlayerSeasonHeatmap({ player: { id: 977, name: "Kobe Bryant" }, locale: "en", datasets: [], initialSelection, initialResource: { status: "unavailable" } });
    expect(render(a).key).toBe("977:2015-16:Regular Season");
    expect(render(b).key).toBe("977:2009-10:Playoffs");
    expect(render(a).key).toBe("977:2015-16:Regular Season");
    expect(render(b).props.initialSelection).toEqual(b);
  });
});
