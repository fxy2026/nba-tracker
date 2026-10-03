import type { HeatmapIdentity } from '@/lib/season-heatmap';
export type LoadState = {status:'ready';data:unknown}|{status:'loading'}|{status:'unavailable'}|{status:'error'};
export const SELECTION_CACHE_LIMIT=8;
export function retainSelection<T>(cache:Map<string,T>,key:string,value:T):void {
 cache.delete(key);cache.set(key,value);
 while(cache.size>SELECTION_CACHE_LIMIT)cache.delete(cache.keys().next().value!);
}
/** A cancellation closes the callback before aborting, even for transports that ignore AbortSignal. */
export function startSeasonRequest<T extends LoadState>(identity:HeatmapIdentity,url:(id:HeatmapIdentity)=>string,decode:(value:unknown,id:HeatmapIdentity)=>T,onUpdate:(value:T|{status:'loading'}|{status:'error'})=>void,force=false):()=>void {
 let live=true;const controller=new AbortController();
 onUpdate({status:'loading'});
 const timer=setTimeout(()=>{if(live){live=false;onUpdate({status:'error'});controller.abort();}},8000);
 void (async()=>{
  try {
   const response=await fetch(url(identity),{signal:controller.signal,cache:force?'no-store':'default'});
   const decoded=decode(await response.json(),identity);
   if(!live)return;
   onUpdate((response.ok&&decoded.status==='ready')||(response.status===404&&decoded.status==='unavailable')?decoded:{status:'error'});
  }catch{if(live)onUpdate({status:'error'});}
  finally{clearTimeout(timer);live=false;}
 })();
 return ()=>{live=false;clearTimeout(timer);controller.abort();};
}
