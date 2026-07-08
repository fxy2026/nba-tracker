import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Api = typeof import("./api");

function pbpResponse(count: number): Response {
  const actions = Array.from({ length: count }, (_, i) => ({
    personId: 1000 + i,
    playerNameI: `P. Player${i}`,
    teamTricode: "BOS",
    period: 1,
    clock: "PT10M00.00S",
    actionType: "2pt",
    subType: "Jump Shot",
    shotResult: "Made",
    x: 25,
    y: 30,
    shotDistance: 12,
    description: `shot ${i}`,
  }));
  return new Response(JSON.stringify({ game: { gameId: "test", actions } }));
}

describe("getPlayByPlay caching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let api: Api;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    api = await import("./api");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves final games from cache — two sequential calls, one fetch", async () => {
    fetchMock.mockImplementation(async () => pbpResponse(2));
    const first = await api.getPlayByPlay("0042500401", { final: true });
    const second = await api.getPlayByPlay("0042500401", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 86400 } });
  });

  it("refetches live games on every call", async () => {
    fetchMock.mockImplementation(async () => pbpResponse(1));
    await api.getPlayByPlay("0022500900");
    await api.getPlayByPlay("0022500900");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 60 } });
  });

  it("dedupes concurrent calls into a single fetch", async () => {
    const resolvers: Array<(r: Response) => void> = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => { resolvers.push(resolve); })
    );
    const p1 = api.getPlayByPlay("0022500901", { final: true });
    const p2 = api.getPlayByPlay("0022500901", { final: true });
    for (const r of resolvers) r(pbpResponse(1));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
    expect(r1).toHaveLength(1);
  });
});
