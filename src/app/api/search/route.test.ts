import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { snapshot } = vi.hoisted(()=>({snapshot:vi.fn()}));
vi.mock('@/lib/api',()=>({getPlayerIndexSnapshot:snapshot}));
import { GET } from './route';
const player={personId:202681,firstName:'Kyrie',lastName:'Irving',teamAbbr:'DAL',teamId:1,teamName:'Mavericks',teamCity:'Dallas',jersey:'11',position:'G',pts:null,reb:null,ast:null};
const archive={source:'bundled-archive',season:'2025-26',stale:true,retrievedAt:null};
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();snapshot.mockResolvedValue({players:[player],provenance:archive});});
afterEach(()=>vi.useRealTimers());
it.each(['q=Kyrie','id=202681'])('index metadata survives %s lookup without invented null stats',async(query)=>{
 const response=await GET(new Request(`https://site.test/api/search?${query}`));const json=await response.json();const row=Array.isArray(json.data)?json.data[0]:json.data;
 expect(row).toMatchObject({personId:202681,pts:null,reb:null,ast:null,indexProvenance:archive});expect(snapshot).toHaveBeenCalledTimes(1);
});
it.each([{source:'nba-cdn',season:'2026-27',stale:false,retrievedAt:'2026-10-01T12:00:00Z'},{source:'nba-cdn',season:null,stale:true,retrievedAt:null}])('source declared season preserved %j',async(provenance)=>{snapshot.mockResolvedValue({players:[{...player,pts:0,reb:0,ast:0}],provenance});const json=await(await GET(new Request('https://site.test/api/search?id=202681'))).json();expect(json.data).toMatchObject({pts:0,reb:0,ast:0,indexProvenance:provenance});});
it('curated career and iconic records keep their distinct scope without an index request',async()=>{
 const legend=await(await GET(new Request('https://site.test/api/search?id=893'))).json();expect(legend.data.isLegend).toBe(true);expect(legend.data.indexProvenance).toBeUndefined();
 const iconic=await(await GET(new Request('https://site.test/api/search?id=2544-2015'))).json();expect(iconic.data.isIconicSeason).toBe(true);expect(iconic.data.season).toBe('2015-16');expect(snapshot).not.toHaveBeenCalled();
});
it('missing lookup remains null and failure does not fabricate averages',async()=>{snapshot.mockRejectedValue(new Error('offline'));const json=await(await GET(new Request('https://site.test/api/search?id=202681'))).json();expect(json.data).toBeNull();});
