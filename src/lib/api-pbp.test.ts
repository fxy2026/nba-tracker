import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Api = typeof import("./api");

function pbpResponse(count: number, gameId = "0022500901"): Response {
  const actions = Array.from({ length: count }, (_, i) => ({
    actionNumber: i + 1,
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
  return new Response(JSON.stringify({ game: { gameId, actions } }));
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
    fetchMock.mockImplementation(async (url: string) => pbpResponse(2, url.match(/playbyplay_(\d+)\.json/)![1]));
    const first = await api.getPlayByPlay("0042500401", { final: true });
    const second = await api.getPlayByPlay("0042500401", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 86400 } });
  });

  it("refetches live games on every call", async () => {
    fetchMock.mockImplementation(async (url: string) => pbpResponse(1, url.match(/playbyplay_(\d+)\.json/)![1]));
    await api.getPlayByPlay("0022500900");
    await api.getPlayByPlay("0022500900");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 60 } });
  });

  it("upgrades a live entry to final on a later hinted call", async () => {
    fetchMock.mockImplementation(async (url: string) => pbpResponse(1, url.match(/playbyplay_(\d+)\.json/)![1]));
    await api.getPlayByPlay("0022500902");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upgraded = await api.getPlayByPlay("0022500902", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(upgraded).toHaveLength(1);
    const pinned = await api.getPlayByPlay("0022500902", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pinned).toEqual(upgraded);
  });

  it("does not pin an empty payload as final", async () => {
    fetchMock.mockImplementation(async (url: string) => pbpResponse(0, url.match(/playbyplay_(\d+)\.json/)![1]));
    const first = await api.getPlayByPlay("0022500903", { final: true });
    expect(first).toEqual([]);
    await api.getPlayByPlay("0022500903", { final: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
  it.each(['empty','malformed','wrong-game','missing-position','negative-distance','invalid-player','http','json','network'])('retains live last-good rows across %s without claiming availability',async failure=>{
    const id='0022500901';fetchMock.mockResolvedValueOnce(pbpResponse(1,id));const first=await api.getPlayByPlaySnapshot(id);
    if(failure==='empty')fetchMock.mockResolvedValueOnce(pbpResponse(0,id));
    if(failure==='malformed')fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({game:{gameId:id,actions:[{}]}})));
    if(failure==='wrong-game')fetchMock.mockResolvedValueOnce(pbpResponse(1,'0022500999'));
    if(failure==='missing-position'){const payload=await pbpResponse(1,id).json();payload.game.actions[0].x=null;fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload)));}
    if(failure==='negative-distance'||failure==='invalid-player'){const payload=await pbpResponse(1,id).json();payload.game.actions[0][failure==='negative-distance'?'shotDistance':'personId']=-1;fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload)));}
    if(failure==='http')fetchMock.mockResolvedValueOnce(new Response('',{status:403}));
    if(failure==='json')fetchMock.mockResolvedValueOnce(new Response('{broken'));
    if(failure==='network')fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await api.getPlayByPlaySnapshot(id)).toEqual({shots:first.shots,available:false,stale:true});
    fetchMock.mockResolvedValueOnce(pbpResponse(2,id));expect(await api.getPlayByPlaySnapshot(id)).toMatchObject({available:true,stale:false,shots:expect.any(Array)});
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('valid non-shot actions are legitimate zero shots, not failure',async()=>{
    fetchMock.mockResolvedValue(new Response(JSON.stringify({game:{gameId:'0022500901',actions:[{actionNumber:1,period:1,clock:'PT12M00.00S',actionType:'period',description:'Period begins'}]}})));
    expect(await api.getPlayByPlaySnapshot('0022500901')).toEqual({shots:[],available:true,stale:false});
  });
  it('unavailable initial source and wrong identity cannot create good cached data',async()=>{
    fetchMock.mockResolvedValueOnce(pbpResponse(1,'0022500999')).mockResolvedValueOnce(new Response('',{status:403}));
    expect(await api.getPlayByPlaySnapshot('0022500901')).toEqual({shots:[],available:false,stale:false});
    expect(await api.getPlayByPlaySnapshot('0022500901')).toEqual({shots:[],available:false,stale:false});
  });
  it('free throws without coordinates do not poison valid field-goal shots',async()=>{
    const payload=await pbpResponse(1).json();payload.game.actions.push({actionNumber:2,period:1,clock:'PT09M00.00S',actionType:'freethrow',description:'Free throw',shotResult:'Made',personId:1000,teamTricode:'BOS'});
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));const result=await api.getPlayByPlaySnapshot('0022500901');expect(result.available).toBe(true);expect(result.shots).toHaveLength(1);
  });

  it('a response body that finishes after abort cannot overwrite last-good shots',async()=>{
    const id='0022500901';fetchMock.mockResolvedValueOnce(pbpResponse(1,id));const first=await api.getPlayByPlaySnapshot(id);
    const controller=new AbortController();const timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
    const body=await pbpResponse(2,id).json();fetchMock.mockResolvedValueOnce({ok:true,json:async()=>{controller.abort();return body;}});
    expect(await api.getPlayByPlaySnapshot(id)).toEqual({shots:first.shots,available:false,stale:true});timeout.mockRestore();
  });

});
