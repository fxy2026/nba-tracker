import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import archive from "@/data/playerindex-2025-26.json";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn(async () => { throw new Error("offline provider"); });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("profile source selection", () => {
  it.each([
    [893, "Michael Jordan"], [977, "Kobe Bryant"], [1495, "Tim Duncan"],
    [76003, "Kareem Abdul-Jabbar"], [76375, "Wilt Chamberlain"],
    [406, "Shaquille O'Neal"], [77142, "Magic Johnson"], [1449, "Larry Bird"],
  ])("renders reviewed historical page and metadata %s without starting an upstream request", async (id, name) => {
    const { default: Page, generateMetadata } = await import("@/app/player/[id]/page");
    const props = { params: Promise.resolve({ id: String(id) }) };
    const [page, metadata] = await Promise.all([Page(props), generateMetadata(props)]);
    expect(page.props.player).toMatchObject({ id, name, sources: expect.arrayContaining(["all-time-registry"]) });
    expect(page.props.historicalCareer?.playerId).toBe(id);
    expect(metadata.alternates?.canonical).toBe(`/player/${id}`);
    expect(metadata.title).toBe(`${name} — NBA`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps the live index and provenance for current players", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => archive });
    const { getPlayerProfileContext } = await import("./player-profile-loader");
    const result = await getPlayerProfileContext("201939");
    expect(result?.identity.name).toBe("Stephen Curry");
    expect(result?.snapshot.provenance).toMatchObject({ source: "nba-cdn", stale: false, season: "2025-26" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("playerIndex.json");
    expect(fetchMock.mock.calls[0][1].next.revalidate).toBe(900);
  });
  it.each(["376", "999999999"])("does not infer a local-only route for non-cohort ID %s", async id => {
    const { getPlayerProfileContext } = await import("./player-profile-loader");
    const result = await getPlayerProfileContext(id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (id === "376") expect(result?.identity.name).toBe("Eric Montross");
    else expect(result).toBeNull();
  });
  it.each(["0", "0977", "977junk", "-1"])("rejects malformed ID %s without fetching", async id => {
    const { getPlayerProfileContext } = await import("./player-profile-loader");
    expect(await getPlayerProfileContext(id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
