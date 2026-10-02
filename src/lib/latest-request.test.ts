import { describe, it, expect } from "vitest";
import { createLatestRequestGate } from "./latest-request";

describe("latest request guard", () => {
  it("aborts an old date or refresh request when a new request starts", () => {
    const gate = createLatestRequestGate();
    const old = gate.begin();
    const latest = gate.begin();
    expect(old.signal.aborted).toBe(true);
    expect(old.isCurrent()).toBe(false);
    expect(latest.isCurrent()).toBe(true);
  });
  it("prevents a slow JSON response overwriting the newest response", async () => {
    const gate = createLatestRequestGate();
    const old = gate.begin();
    let resolve!: (value: string) => void;
    const json = new Promise<string>((done) => { resolve = done; });
    let displayed = "initial";
    const pending = (async () => {
      const value = await json;
      if (old.isCurrent()) displayed = value;
    })();
    const latest = gate.begin();
    if (latest.isCurrent()) displayed = "new date";
    resolve("old date");
    await pending;
    expect(displayed).toBe("new date");
  });
  it("invalidates pending errors/loading updates after unmount or date cleanup", () => {
    const gate = createLatestRequestGate();
    const request = gate.begin();
    gate.cancel();
    expect(request.signal.aborted).toBe(true);
    expect(request.isCurrent()).toBe(false);
    gate.cancel();
    expect(gate.begin().isCurrent()).toBe(true);
  });
});
