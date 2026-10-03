import { expect, it, vi } from 'vitest';
import { createPlayerCareerLoader } from './player-career-cache';
import { normalizePlayerCareerData } from './player-career-data';
import archive from '@/data/player-career-archives/2544-2026-10-03.json';
const seed = normalizePlayerCareerData(archive.data)!;
const url = '/api/player?id=2544&context=2&name=LeBron+James&team=LAL';
const ok = (data: unknown) => ({ok:true,json:async()=>data}) as Response;
const live = {careerSeasons: seed.careerSeasons.map(row=>({...row,PTS:row.PTS+1}))};
it('reads seed before resolution without mutating cache; mount seed shares one request',async()=>{
 let finish!:(r:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(r=>{finish=r;}));const load=createPlayerCareerLoader(fetcher);
 expect(load.read(url,seed)).toEqual(seed);expect(load.read(url)).toBeNull();expect(fetcher).not.toHaveBeenCalled();
 load.seed(url,seed);const a=load(url);load.seed(url,seed);const b=load(url);
 expect(load.read(url)).toEqual(seed);expect(a).toBe(b);expect(fetcher).toHaveBeenCalledTimes(1);
 finish(ok(live));expect(await a).toEqual({data:live,unavailable:false,stale:false});
});
it('rejects wrong identity and never leaks across exact request URLs',()=>{
 const load=createPlayerCareerLoader(vi.fn());load.seed('/api/player?id=201939',seed);
 expect(load.read('/api/player?id=201939',seed)).toBeNull();load.seed(url,seed);
 expect(load.read('/api/player?id=2544&context=2')).toBeNull();
});
it.each(['failure','empty','truncated'])('preserves snapshot and provenance on %s, including seed arriving after request starts',async kind=>{
 let finish!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(r=>{finish=r;}));const load=createPlayerCareerLoader(fetcher);
 const pending=load(url);load.seed(url,seed);
 finish(kind==='failure'?{ok:false,status:503} as Response:ok({careerSeasons:kind==='empty'?[]:seed.careerSeasons.slice(1)}));
 expect(await pending).toEqual({data:seed,unavailable:true,stale:true});
 load.seed(url,seed);await load(url,true);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('complete live replaces entire snapshot and wins over subsequent seed',async()=>{
 const fetcher=vi.fn().mockResolvedValue(ok(live));const load=createPlayerCareerLoader(fetcher);load.seed(url,seed);
 await load(url);load.seed(url,seed);expect(load.read(url,seed)).toEqual(live);
 expect(load.read(url)).not.toHaveProperty('provenance');await load(url);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('seed can replace cached empty data but cannot erase failure cooldown',async()=>{
 let time=1;const fetcher=vi.fn().mockResolvedValueOnce(ok({careerSeasons:[]})).mockResolvedValueOnce({ok:false,status:503});
 const load=createPlayerCareerLoader(fetcher,()=>time);await load(url);load.seed(url,seed);expect(load.read(url)).toEqual(seed);
 await load(url);time+=1;load.seed(url,seed);await load(url);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('unarchived loader retains the existing successful-empty behavior',async()=>{
 const load=createPlayerCareerLoader(vi.fn().mockResolvedValue(ok({careerSeasons:[]})));
 expect(load.read('/api/player?id=42')).toBeNull();expect(await load('/api/player?id=42')).toEqual({data:{careerSeasons:[]},unavailable:false,stale:false});
});
it('rejects malformed and nonarchive seeds',()=>{
 const load=createPlayerCareerLoader(vi.fn());
 for(const bad of [live,{...seed,stale:undefined},{...seed,careerSeasons:[]}, {...seed,careerSeasons:[{...seed.careerSeasons[0],PTS:null}]}]){
  load.seed(url,bad as never);expect(load.read(url,bad as never)).toBeNull();
 }
});
it('seeding after an earlier unavailable response preserves its existing cooldown',async()=>{
 let time=1;const fetcher=vi.fn().mockResolvedValue({ok:false,status:503});const load=createPlayerCareerLoader(fetcher,()=>time);
 await load(url);time+=1;load.seed(url,seed);expect(load.read(url)).toEqual(seed);await load(url);expect(fetcher).toHaveBeenCalledTimes(1);
 time+=30_000;await load(url);expect(fetcher).toHaveBeenCalledTimes(2);
});
