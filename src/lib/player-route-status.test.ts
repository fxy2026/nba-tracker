import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ index: vi.fn() }));
vi.mock("@/lib/api", () => ({ getPlayerIndexSnapshot: state.index }));
import { proxy } from "@/proxy";
import { localPlayerRouteStatus } from "./player-route-status";
beforeEach(() => { state.index.mockReset(); state.index.mockResolvedValue({ players: [] }); });
describe("canonical profile HTTP status before streaming", () => {
  it.each([201939, 977, 901, 76681, 77016, 1642850])("known ID %s bypasses upstream and retains locale routing", async id => {
    const response = await proxy(new NextRequest(`https://nba.xpy.me/player/${id}`, { headers: { "accept-language": "zh-CN" } }));
    expect(response.status).toBe(200); expect(response.cookies.get("locale")?.value).toBe("zh"); expect(state.index).not.toHaveBeenCalled();
  });
  it.each(["0", "0977", "977junk", "-1"])("malformed ID %s is HTTP404 without upstream lookup", async id => {
    const response = await proxy(new NextRequest(`https://nba.xpy.me/player/${id}`)); expect(response.status).toBe(404); expect(await response.text()).toContain("Player not found"); expect(state.index).not.toHaveBeenCalled();
  });
  it("valid unknown IDs return HTTP404 but a newly indexed player is not blocked by the pinned registry", async () => {
    expect((await proxy(new NextRequest("https://nba.xpy.me/player/999999999"))).status).toBe(404);
    state.index.mockResolvedValueOnce({ players: [{ personId: 999999999 }] });
    expect((await proxy(new NextRequest("https://nba.xpy.me/player/999999999"))).status).toBe(200);
  });
  it("unrelated routes and nested player tools are unchanged", async () => {
    for (const path of ["/", "/search", "/player/201939/gamelog", "/api/players/search"]) { expect(localPlayerRouteStatus(path)).toBeNull(); expect((await proxy(new NextRequest(`https://nba.xpy.me${path}`, { headers: { cookie: "locale=en" } }))).status).toBe(200); }
    expect(state.index).not.toHaveBeenCalled();
  });
});
