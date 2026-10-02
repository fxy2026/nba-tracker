import React, { Suspense } from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PLAY_BY_PLAY, getGamePlayByPlay, normalizeGamePlayByPlay, type GamePlayByPlay } from "./game-play-by-play";
import { getBiggestRun, getQuarterMvp } from "./game-stats";
import WithPlayByPlay from "@/app/game/[id]/_components/WithPlayByPlay";

const id = "0022500961";
const action = { actionNumber: 1, period: 1, clock: "PT10M00.00S", actionType: "2pt", subType: "Layup", description: "Duren makes layup", personId: 1631105, playerNameI: "J. Duren", teamTricode: "DET", shotResult: "Made", scoreHome: "2", scoreAway: "0", x: 5.5, y: 50, shotDistance: 2 };
const payload = (actions: unknown) => ({ game: { gameId: id, actions } });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("optional play-by-play normalization", () => {
  it("preserves valid shots/text/scores, including real zero scores and distances", () => {
    const data = normalizeGamePlayByPlay(payload([{ ...action, shotDistance: 0 }]), id);
    expect(data.actions[0]).toMatchObject({ scoreAway: "0", shotDistance: 0 });
    expect(data.shots[0]).toMatchObject({ x: 5.5, y: 50, shotDistance: 0 });
    expect(data.scoreEvents).toEqual([{ period: 1, clock: action.clock, scoreHome: 2, scoreAway: 0 }]);
  });
  it.each([null, {}, "bad", [null], [action, null], [{ ...action, clock: {} }]])("rejects malformed action payload %j without throwing", (actions) => {
    expect(normalizeGamePlayByPlay(payload(actions), id)).toEqual(EMPTY_PLAY_BY_PLAY);
  });
  it("rejects a mismatched game instead of mixing data", () => {
    expect(normalizeGamePlayByPlay(payload([action]), "0022500962")).toEqual(EMPTY_PLAY_BY_PLAY);
  });
  it("retains text but withholds shot-derived modules for null coordinates", () => {
    const data = normalizeGamePlayByPlay(payload([action, { ...action, actionNumber: 2, x: null }]), id);
    expect(data.actions).toHaveLength(2);
    expect(data.shots).toEqual([]);
    expect(data.scoreEvents).toHaveLength(2);
  });
  it("keeps a valid field-goal chart and scoring events when free throws have no coordinates", () => {
    const ft = { ...action, actionNumber: 2, actionType: "freethrow", x: null, y: null, shotDistance: undefined };
    const data = normalizeGamePlayByPlay(payload([action, ft]), id);
    expect(data.actions).toHaveLength(2);
    expect(data.shots).toHaveLength(1);
    expect(data.scoringShots).toHaveLength(2);
    expect(data.scoringShots[1].shotDistance).toBeUndefined();
    expect(data.scoreEvents).toHaveLength(2);
  });
  it("counts free throws as one and long 2-point shots as two without coordinate inference", () => {
    const data = normalizeGamePlayByPlay(payload([
      { ...action, shotDistance: 24 },
      { ...action, actionNumber: 2, actionType: "freethrow", clock: "PT09M00.00S", x: null, y: null, shotDistance: undefined },
      { ...action, actionNumber: 3, actionType: "freethrow", clock: "PT08M00.00S", x: null, y: null, shotDistance: undefined },
    ]), id);
    expect(getBiggestRun(data.scoringShots)?.points).toBe(4);
    expect(getQuarterMvp(data.scoringShots)).toMatchObject({ pts: 2 });
  });
  it("rejects an asymmetric score pair rather than inventing a 20-0 lead", () => {
    expect(normalizeGamePlayByPlay(payload([{ ...action, scoreHome: "20", scoreAway: null }]), id)).toEqual(EMPTY_PLAY_BY_PLAY);
  });
  it("never turns missing/invalid scores into zero or malformed qualifiers into a crash", () => {
    const data = normalizeGamePlayByPlay(payload([{ ...action, scoreHome: "N/A", scoreAway: null, qualifiers: {}, descriptor: {}, shotDistance: null }]), id);
    expect(data.scoreEvents).toEqual([]);
    expect(data.shots).toEqual([]);
    expect(data.actions[0]).toMatchObject({ scoreHome: "", scoreAway: "" });
    expect(data.actions[0].qualifiers).toBeUndefined();
  });
  it.each(["http", "network", "json", "timeout"])("degrades %s to optional unavailable", async (failure) => {
    const fetcher = vi.fn();
    if (failure === "network" || failure === "timeout") fetcher.mockRejectedValue(new DOMException(failure, "TimeoutError"));
    else fetcher.mockResolvedValue({ ok: failure !== "http", json: async () => { throw new SyntaxError("invalid"); } });
    vi.stubGlobal("fetch", fetcher);
    await expect(getGamePlayByPlay(id)).resolves.toEqual(EMPTY_PLAY_BY_PLAY);
  });
});

describe("basic data streams independently", () => {
  it.each(["resolve", "reject"])("keeps basic box visible while PBP waits and after it %ss", async (outcome) => {
    let resolve!: (value: GamePlayByPlay) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<GamePlayByPlay>((yes, no) => { resolve = yes; reject = no; });
    const output = new PassThrough();
    let html = "";
    output.on("data", (chunk) => { html += chunk.toString(); });
    const done = new Promise<void>((yes, no) => { output.on("end", yes); output.on("error", no); });
    const errors: unknown[] = [];
    const stream = renderToPipeableStream(
      <main><h1>MEM 110 — DET 126</h1><table><tbody><tr><td>Duren 30 points</td></tr></tbody></table>
        <Suspense fallback={<p>Optional advanced data loading</p>}>
          <WithPlayByPlay data={pending}>{(data) => <p>{data.actions.length ? "Play-by-play ready" : "Advanced data unavailable"}</p>}</WithPlayByPlay>
        </Suspense>
      </main>,
      { onShellReady() { stream.pipe(output); }, onError(error) { errors.push(error); } },
    );
    await vi.waitFor(() => expect(html).toContain("Duren 30 points"));
    expect(html).toContain("Optional advanced data loading");
    expect(html).not.toContain("Play-by-play ready");
    if (outcome === "resolve") resolve(normalizeGamePlayByPlay(payload([action]), id));
    else reject(new Error("upstream failed"));
    await done;
    expect(errors).toEqual([]);
    expect(html).toContain(outcome === "resolve" ? "Play-by-play ready" : "Advanced data unavailable");
  });
});
