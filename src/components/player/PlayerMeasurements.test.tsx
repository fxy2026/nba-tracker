import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";

// Deterministic offline hook/commit harness, including render before effect cleanup.
const runtime = vi.hoisted(() => ({ index: 0, slots: [] as unknown[], effects: [] as (() => void)[], writes: 0, locale: "en" }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = typeof initial === "function" ? initial() : initial;
    return [runtime.slots[index], (value: unknown) => {
      runtime.writes++;
      runtime.slots[index] = typeof value === "function" ? value(runtime.slots[index]) : value;
    }];
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = runtime.index++;
    const old = runtime.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) runtime.effects.push(() => {
      old?.cleanup?.(); runtime.slots[index] = { deps, run, cleanup: run() };
    });
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ t: runtime.locale === "zh" ? zh : en }) }));
import PlayerMeasurements from "./PlayerMeasurements";

type Props = ComponentProps<typeof PlayerMeasurements>;
const first: Props = { playerId: 201939, draftYear: 2009 };
const second: Props = { playerId: 201935, draftYear: 2009 };
const headers = ["PLAYER_ID", "WINGSPAN", "STANDING_REACH", "BODY_FAT_PCT", "HAND_LENGTH", "HAND_WIDTH", "HEIGHT_WO_SHOES"];
const row = (id: number, wingspan: number) => [id, wingspan, 97, 5.7, 8.5, 9, 74.25];
const payload = (id = first.playerId, wingspan = 75.5) => ({ resultSets: [{ headers, rowSet: [row(42, 91), row(id, wingspan)] }] });
const commit = () => runtime.effects.splice(0).forEach(run => run());
function render(props = first, commitEffects = true) {
  runtime.index = 0;
  const tree = PlayerMeasurements(props);
  if (commitEffects) commit();
  return renderToStaticMarkup(tree);
}
function unmount() { runtime.slots.forEach(slot => (slot as { cleanup?: () => void } | undefined)?.cleanup?.()); }
function restartEffects() {
  for (const slot of runtime.slots) {
    const effect = slot as { run?: () => void | (() => void); cleanup?: () => void } | undefined;
    if (effect?.run) { effect.cleanup?.(); effect.cleanup = effect.run() || undefined; }
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const response = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) }) as Response;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let calls: { url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }[];
beforeEach(() => {
  runtime.index = 0; runtime.slots = []; runtime.effects = []; runtime.writes = 0; runtime.locale = "en"; calls = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("combine identity and request lifecycle", () => {
  it("passes the resolved player ID from the profile page", () => {
    const page = readFileSync(new URL("../../app/player/[id]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("<PlayerOptionalDetails playerId={personId} draftYear={player.draftYear} playerName={fullName} teamAbbr={player.teamAbbr} />");
    const details = readFileSync(new URL("./PlayerOptionalDetails.tsx", import.meta.url), "utf8");
    expect(details).toContain("<PlayerMeasurements playerId={playerId} draftYear={draftYear} />");
  });
  it("requests the class once and renders only the matching player's measurements", async () => {
    expect(render()).toBe("");
    expect(calls[0].url).toBe("/api/stats?endpoint=draftcombineplayeranthro&LeagueID=00&SeasonYear=2009");
    calls[0].reply.resolve(response(payload())); await settle();
    const html = render(); expect(html).toContain("75.5&quot;"); expect(html).toContain("5.7%"); expect(html).not.toContain("91&quot;");
    expect(html).toContain(en.playerMeasurements.disclaimer); expect(calls).toHaveLength(1);
  });
  it("renders missing measurements as unknown without invented zero values", async () => {
    render(); const data = payload(); data.resultSets[0].rowSet = [[first.playerId, 75.5, null, 0, "8.5", Infinity, null] as unknown as number[]];
    calls[0].reply.resolve(response(data)); await settle();
    const html = render(); expect(html).toContain("75.5&quot;"); expect(html.match(/>—</g)).toHaveLength(5);
    expect(html).not.toMatch(/>0[%&]|NaN|Infinity/);
  });
  it("immediately hides old data on same-year navigation before effect cleanup runs", async () => {
    render(); calls[0].reply.resolve(response(payload())); await settle(); expect(render()).toContain("75.5&quot;");
    expect(render(second, false)).toBe(""); expect(calls).toHaveLength(1);
    commit(); expect(calls[0].signal.aborted).toBe(true); expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(calls[0].url);
    calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle();
    expect(render(second)).toContain("82&quot;"); expect(render(second)).not.toContain("75.5&quot;");
  });
  it("does not restore old A measurements on A → B → A while B is pending", async () => {
    render(); calls[0].reply.resolve(response(payload())); await settle(); expect(render()).toContain("75.5&quot;");
    expect(render(second)).toBe(""); expect(render(first)).toBe(""); expect(calls).toHaveLength(3);
    calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle(); expect(render(first)).toBe("");
    calls[2].reply.resolve(response(payload(first.playerId, 76))); await settle(); expect(render(first)).toContain("76&quot;");
  });
  it("clears old data when the year changes or disappears", async () => {
    render(); calls[0].reply.resolve(response(payload())); await settle(); expect(render()).not.toBe("");
    const newer = { ...first, draftYear: 2010 }; expect(render(newer)).toBe(""); expect(calls[1].url).toContain("SeasonYear=2010");
    calls[1].reply.resolve(response(payload(first.playerId, 76))); await settle(); expect(render(newer)).toContain("76&quot;");
    expect(render({ ...first, draftYear: null })).toBe(""); expect(calls).toHaveLength(2); expect(calls[1].signal.aborted).toBe(true);
  });
  it("ignores a late old response after a new player has loaded", async () => {
    render(); render(second); calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle();
    const writes = runtime.writes; calls[0].reply.resolve(response(payload())); await settle();
    expect(runtime.writes).toBe(writes); expect(render(second)).toContain("82&quot;");
  });
  it("ignores a late old JSON body after a new player has loaded", async () => {
    const body = deferred(); render(); calls[0].reply.resolve(response(body.promise)); await settle();
    render(second); calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle();
    const writes = runtime.writes; body.resolve(payload()); await settle();
    expect(runtime.writes).toBe(writes); expect(render(second)).toContain("82&quot;");
  });
  it.each(["HTTP", "network", "JSON"])("a stale %s failure cannot mutate newer loading or ready state", async failure => {
    const body = deferred(); render();
    if (failure === "JSON") { calls[0].reply.resolve(response(body.promise)); await settle(); }
    render(second); const writes = runtime.writes;
    if (failure === "HTTP") calls[0].reply.resolve(response(null, false));
    else if (failure === "network") calls[0].reply.reject(new Error("late network error"));
    else body.reject(new Error("late body error"));
    await settle(); expect(runtime.writes).toBe(writes); expect(render(second)).toBe("");
    calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle(); expect(render(second)).toContain("82&quot;");
  });
  it.each(["HTTP", "network", "JSON", "unmatched", "duplicate", "malformed"])("a current %s result never retains another player's measurements", async outcome => {
    render(); calls[0].reply.resolve(response(payload())); await settle(); expect(render()).not.toBe(""); render(second);
    if (outcome === "HTTP") calls[1].reply.resolve(response(null, false));
    else if (outcome === "network") calls[1].reply.reject(new Error("offline"));
    else if (outcome === "JSON") calls[1].reply.resolve({ ok: true, json: async () => { throw new Error("invalid JSON"); } } as unknown as Response);
    else if (outcome === "unmatched") calls[1].reply.resolve(response(payload()));
    else if (outcome === "duplicate") { const data = payload(second.playerId); data.resultSets[0].rowSet.push(row(second.playerId, 82)); calls[1].reply.resolve(response(data)); }
    else calls[1].reply.resolve(response({ resultSets: [{ headers: null, rowSet: [row(second.playerId, 82)] }] }));
    await settle(); expect(render(second)).toBe("");
  });
  it("a late non-OK response cannot clear another player's ready measurements", async () => {
    render(); render(second); calls[1].reply.resolve(response(payload(second.playerId, 82))); await settle();
    const writes = runtime.writes; calls[0].reply.resolve(response(null, false)); await settle();
    expect(runtime.writes).toBe(writes); expect(render(second)).toContain("82&quot;");
  });
  it("aborts on unmount and ignores a late body without writing state", async () => {
    const body = deferred(); render(); calls[0].reply.resolve(response(body.promise)); await settle();
    unmount(); const writes = runtime.writes; expect(calls[0].signal.aborted).toBe(true);
    body.resolve(payload()); await settle(); expect(runtime.writes).toBe(writes);
  });
  it("survives Strict Mode cleanup/restart without accepting the first request", async () => {
    render(); restartEffects(); expect(calls).toHaveLength(2); expect(calls[0].signal.aborted).toBe(true);
    calls[1].reply.resolve(response(payload(first.playerId, 76))); await settle();
    const writes = runtime.writes; calls[0].reply.resolve(response(payload())); await settle();
    expect(runtime.writes).toBe(writes); expect(render()).toContain("76&quot;");
  });
  it.each([{ playerId: NaN, draftYear: 2009 }, { playerId: 0, draftYear: 2009 }, { playerId: 1, draftYear: null }, { playerId: 1, draftYear: NaN }, { playerId: 1, draftYear: 2009.5 }])("skips requests for invalid identity/year %j", props => {
    expect(render(props)).toBe(""); expect(calls).toHaveLength(0);
  });
  it("both locales describe verified individual matching without claiming a computed class average", async () => {
    expect(en.playerMeasurements.disclaimer).not.toMatch(/class average/i); expect(zh.playerMeasurements.disclaimer).not.toContain("平均");
    runtime.locale = "zh"; render(); calls[0].reply.resolve(response(payload())); await settle(); expect(render()).toContain(zh.playerMeasurements.disclaimer);
  });
});
