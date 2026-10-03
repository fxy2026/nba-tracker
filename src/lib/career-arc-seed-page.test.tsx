import { expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
const api=vi.hoisted(()=>({info:vi.fn().mockResolvedValue(null)}));
vi.mock('@/lib/api',()=>({getPlayerInfo:api.info}));
vi.mock('@/lib/locale',()=>({getLocale:async()=> 'en'}));
vi.mock('next/dynamic',()=>({default:()=>function CareerArc(){return null;}}));
import Page,{generateMetadata} from '@/app/lab/career-arc/page';
function find(node:ReactNode): Record<string,unknown>|null {
 if(!isValidElement(node))return null;
 const p=node.props as Record<string,unknown>;if('initialCareer' in p)return p;
 for(const child of Array.isArray(p.children)?p.children:[p.children]){const result=find(child as ReactNode);if(result)return result;}
 return null;
}
it.each([2544,203999,201939,203507])('selected reviewed player %s avoids upstream identity wait for page and metadata',async id=>{
 api.info.mockClear();const params={searchParams:Promise.resolve({id:String(id)})};
 const page=await Page(params);const selected=find(page)!;const seed=selected.initialCareer as {provenance:{providerPlayerId:string};stale:boolean};
 expect(selected.playerId).toBe(id);expect(seed.provenance.providerPlayerId).toBe(String(id));expect(seed.stale).toBe(true);
 expect((await generateMetadata(params)).title).toContain(String(selected.playerName));expect(api.info).not.toHaveBeenCalled();
});
it('unarchived player preserves upstream identity lookup and has no seed',async()=>{
 api.info.mockClear();api.info.mockResolvedValueOnce({firstName:'Other',lastName:'Player',teamAbbr:'BOS'});
 const selected=find(await Page({searchParams:Promise.resolve({id:'42'})}))!;
 expect(api.info).toHaveBeenCalledWith(42);expect(selected.initialCareer).toBeUndefined();expect(selected.playerName).toBe('Other Player');
});
