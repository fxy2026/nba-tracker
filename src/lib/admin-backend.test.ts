import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminPasswordMatches, isAdminRequest, readAdminJson } from "./admin-auth";
import { POST as login } from "@/app/api/admin/route";
import { GET as stats } from "@/app/api/admin/stats/route";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getRecorded2025SeasonSchedule: vi.fn(), getBundledPlayerIndexSnapshot: vi.fn(),
  getFullSchedule: vi.fn(), getPlayerIndex: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/api", () => ({ getRecorded2025SeasonSchedule: mocks.getRecorded2025SeasonSchedule, getBundledPlayerIndexSnapshot: mocks.getBundledPlayerIndexSnapshot, getFullSchedule: mocks.getFullSchedule, getPlayerIndex: mocks.getPlayerIndex }));

function request(path: string, method = "GET", body?: unknown, authenticated = true) {
  const headers: Record<string, string> = {};
  if (authenticated) headers["x-admin-password"] = "test-admin-password";
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`https://example.com${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function privateResponse(response: Response) {
  expect(response.headers.get("cache-control")).toContain("private");
  expect(response.headers.get("cache-control")).toContain("no-store");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_PASSWORD", "test-admin-password");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network prohibited in unit tests"); }));
  mocks.getRecorded2025SeasonSchedule.mockReturnValue([{ games: [{ gameStatus: 3 }, { gameStatus: 1 }] }, { games: [{ gameStatus: 3 }] }]);
  mocks.getBundledPlayerIndexSnapshot.mockReturnValue({ players: [{}, {}, {}], provenance: { season: "2025-26", retrievedAt: null } });

});
afterEach(() => {
  expect(mocks.getFullSchedule).not.toHaveBeenCalled();
  expect(mocks.getPlayerIndex).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("shared admin authentication and bounded JSON", () => {
  it("requires an exact configured password and handles unequal lengths safely", () => {
    expect(adminPasswordMatches("test-admin-password")).toBe(true);
    for (const value of [null, undefined, 123, {}, "", " test-admin-password", "wrong", "x".repeat(4097)]) expect(adminPasswordMatches(value)).toBe(false);
    expect(isAdminRequest(request("/api/admin/stats"))).toBe(true);
    expect(isAdminRequest(request("/api/admin/stats", "GET", undefined, false))).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminPasswordMatches("test-admin-password")).toBe(false);
  });
  it("compares Unicode password bytes without trimming or normalizing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "测试 é");
    expect(adminPasswordMatches("测试 é")).toBe(true);
    expect(adminPasswordMatches("测试 e\u0301")).toBe(false);
  });
  it.each([null, [], "string", 42])("rejects non-object JSON %j", async body => {
    expect(await readAdminJson(request("/api/admin", "POST", body))).toMatchObject({ ok: false, status: 400 });
  });
  it("bounds actual bytes even without a declared length", async () => {
    const result = await readAdminJson(request("/api/admin", "POST", { password: "测试".repeat(2000) }));
    expect(result).toMatchObject({ ok: false, status: 413 });
  });
  it("rejects oversized declared bodies before reading", async () => {
    const req = request("/api/admin", "POST", {});
    req.headers.set("content-length", "9000");
    expect(await readAdminJson(req)).toMatchObject({ ok: false, status: 413 });
    expect(req.bodyUsed).toBe(false);
  });
  it("rejects malformed JSON, invalid UTF-8, and unsupported content types", async () => {
    const malformed = new NextRequest("https://example.com/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(await readAdminJson(malformed)).toMatchObject({ ok: false, status: 400 });
    const badBytes = new NextRequest("https://example.com/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0xff]) });
    expect(await readAdminJson(badBytes)).toMatchObject({ ok: false, status: 400 });
    const wrongType = request("/api/admin", "POST", {});
    wrongType.headers.set("content-type", "text/plain");
    expect(await readAdminJson(wrongType)).toMatchObject({ ok: false, status: 415 });
  });
  it("bounds a valid JSON stream that never closes even if cancellation stalls", async () => {
    vi.useFakeTimers();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"password":"test-admin-password"}')); },
      cancel: () => new Promise<void>(() => {}),
    });
    const req = new Request("https://example.com/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    const pending = readAdminJson(req);
    await vi.advanceTimersByTimeAsync(2001);
    expect(await pending).toMatchObject({ ok: false, status: 408 });
  });
  it("rejects an aborted body even when valid JSON was already buffered", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ start(reader) { reader.enqueue(new TextEncoder().encode('{"password":"test-admin-password"}')); } });
    const req = new Request("https://example.com/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: stream, signal: controller.signal, duplex: "half" } as RequestInit);
    const pending = readAdminJson(req);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, status: 408 });
  });
  it("rejects oversized streamed bytes without waiting for cancellation", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(9000)); },
      cancel: () => new Promise<void>(() => {}),
    });
    const req = new Request("https://example.com/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    expect(await readAdminJson(req)).toMatchObject({ ok: false, status: 413 });
  });
});

describe("admin login", () => {
  it.each([["test-admin-password", 200], ["wrong", 401], [123, 400], ["", 400]])("validates password %j", async (password, status) => {
    const response = await login(request("/api/admin", "POST", { password }, false));
    expect(response.status).toBe(status);
    privateResponse(response);
  });
  it("rejects extra keys and reports missing configuration", async () => {
    expect((await login(request("/api/admin", "POST", { password: "test-admin-password", extra: true }, false))).status).toBe(400);
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = await login(request("/api/admin", "POST", { password: "test-admin-password" }, false));
    expect(response.status).toBe(503);
    privateResponse(response);
  });
});

describe("admin operational statistics", () => {
  it("rejects unauthenticated reads before all data access", async () => {
    const response = await stats(request("/api/admin/stats", "GET", undefined, false));
    expect(response.status).toBe(401);
    privateResponse(response);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getRecorded2025SeasonSchedule).not.toHaveBeenCalled();
  });
  it("uses only local archives without legacy storage or replay fields", async () => {
    const response = await stats(request("/api/admin/stats"));
    const body = await response.json();
    expect(body.data).toMatchObject({ status: "available", source: "bundled-archive", recordedSeason: "2025-26", recordedGames: 3, completedRecordedGames: 2, recordedDates: 2, indexedPlayers: 3, playerIndexSeason: "2025-26", playerIndexFetchedAt: null });
    expect(body).not.toHaveProperty("replays");
    expect(body.environment).not.toHaveProperty("supabaseConfigured");
    expect(body.environment.adminConfigured).toBe(true);
    expect(mocks.createClient).not.toHaveBeenCalled();
    privateResponse(response);
  });
  it("isolates local data failures without manufacturing zeroes", async () => {
    mocks.getRecorded2025SeasonSchedule.mockImplementationOnce(() => { throw new Error("bad archive"); });
    expect((await (await stats(request("/api/admin/stats"))).json()).data).toMatchObject({ status: "unavailable", recordedGames: null, indexedPlayers: null });
  });
});
