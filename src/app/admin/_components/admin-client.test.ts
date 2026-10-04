import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRequestError, createLatestRequest, readAdminResponse, fetchAdmin, ADMIN_REQUEST_TIMEOUT_MS } from "./admin-client";

describe("admin request lifecycle", () => {
  it("rejects old responses after a newer navigation or unmount, even when a fetch ignores abort", async () => {
    const gate = createLatestRequest();
    const first = gate.begin(); const second = gate.begin();
    expect(first.signal.aborted).toBe(true);
    expect(gate.current(first)).toBe(false); expect(gate.current(second)).toBe(true);
    gate.cancel(); expect(gate.current(second)).toBe(false);
    const remount = gate.begin(); expect(gate.current(second)).toBe(false); expect(gate.current(remount)).toBe(true);
  });
  it("accepts an actual successful empty response, not a failed response with an empty-looking body", async () => {
    await expect(readAdminResponse(new Response(JSON.stringify({ data: [] }), { status: 200 }))).resolves.toEqual({ data: [] });
    await expect(readAdminResponse(new Response(JSON.stringify({ data: [], error: "Storage unavailable" }), { status: 503 }))).rejects.toMatchObject({ status: 503, message: "Storage unavailable" });
  });
  it("preserves server authentication failures and rejects non-JSON successes", async () => {
    await expect(readAdminResponse(new Response(JSON.stringify({ error: "Wrong password" }), { status: 401 }))).rejects.toBeInstanceOf(AdminRequestError);
    await expect(readAdminResponse(new Response("<html>error</html>", { status: 200 }))).rejects.toThrow("Invalid server response");
  });
});


describe("bounded protected transport", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("times out a stalled fetch even if the transport ignores abort, and permits a new request", async () => {
    vi.useFakeTimers(); const fetchMock = vi.fn().mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    const first = fetchAdmin("/api/admin"); const assertion = expect(first).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(ADMIN_REQUEST_TIMEOUT_MS); await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(readAdminResponse(await fetchAdmin("/api/admin"))).resolves.toEqual({ success: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("also bounds a response body that stalls after headers arrive", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, arrayBuffer: () => new Promise(() => {}) }));
    const request = fetchAdmin("/api/admin/stats"); const assertion = expect(request).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(ADMIN_REQUEST_TIMEOUT_MS); await assertion; expect(vi.getTimerCount()).toBe(0);
  });
  it("immediately cancels a superseded or unmounted request and clears its deadline", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const controller = new AbortController(); const request = fetchAdmin("/api/admin/analytics", { signal: controller.signal });
    const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" }); controller.abort(); await assertion; expect(vi.getTimerCount()).toBe(0);
  });
});
