'use client';
import { useEffect, useRef, useState } from 'react';
import type { SeasonHeatmapDatasetMetadata, SeasonHeatmapResource } from '../SeasonHeatmapExplorer';
import RefinedShotExplorer, {type SpatialResource} from '../shot-map/RefinedShotExplorer';
import { retainSelection, startSeasonRequest } from '../shot-map/shot-map-request-state';
import { datasetKey } from '../season-heatmap/season-heatmap-display';
import { courtSeasonHeatmapUrl, decodeCourtSeasonHeatmapResource } from '@/lib/season-heatmap-request';
import { seasonShotMapUrl } from '@/lib/season-shot-map-request';
import { decodeSeasonShotMapResource } from '@/lib/season-shot-map-client';
import type { SeasonHeatmapArchiveResource } from '@/lib/season-heatmap-client';
import type { HeatmapIdentity } from '@/lib/season-heatmap';
interface PlayerSeasonHeatmapProps {
 player:{id:number;name:string;secondaryName?:string;teamLabel?:string};locale:'en'|'zh';datasets:readonly SeasonHeatmapDatasetMetadata[];
 initialSelection:HeatmapIdentity;initialResource:SeasonHeatmapArchiveResource;
}
export default function PlayerSeasonHeatmap(props:PlayerSeasonHeatmapProps) {return <HeatmapSession key={datasetKey(props.initialSelection)} {...props}/>;}
/** Selection-keyed resources prevent an older response from ever appearing under a newer label. */
function useSeasonResource<T extends SeasonHeatmapResource|SpatialResource>(identity:HeatmapIdentity,available:boolean,retry:number,url:(id:HeatmapIdentity)=>string,decode:(value:unknown,id:HeatmapIdentity)=>T,initial?:{key:string;resource:T}):T|{status:'loading'}|{status:'unavailable'}|{status:'error'} {
 const key=datasetKey(identity),cache=useRef(new Map<string,T>(initial?[[initial.key,initial.resource]]:[]));
 const [snapshot,setSnapshot]=useState<{key:string;resource:T|{status:'loading'}|{status:'error'}}>(()=>initial??{key,resource:{status:'loading'}});
 const previousRetry=useRef(retry),playerId=identity.playerId,season=identity.season,seasonType=identity.seasonType;
 useEffect(()=>{
  if(!available)return;
  const force=previousRetry.current!==retry; previousRetry.current=retry;
  const cached=cache.current.get(key);
  if(cached&&!force){setSnapshot({key,resource:cached});return;}
  return startSeasonRequest({playerId,season,seasonType},url,decode,resource=>{
   if(resource.status==='ready'||resource.status==='unavailable')retainSelection(cache.current,key,resource as T);
   setSnapshot({key,resource});
  },force);
 },[key,available,retry,url,decode,playerId,season,seasonType]);
 if(!available)return {status:'unavailable'};
 return snapshot.key===key?snapshot.resource:{status:'loading'};
}
function HeatmapSession({player,locale,datasets,initialSelection,initialResource}:PlayerSeasonHeatmapProps) {
 const [selection,setSelection]=useState<HeatmapIdentity>(initialSelection),[retry,setRetry]=useState(0);
 const key=datasetKey(selection),available=datasets.some(d=>d.playerId===player.id&&datasetKey(d)===key&&d.availability==='available');
 const aggregate=useSeasonResource(selection,available,retry,courtSeasonHeatmapUrl,decodeCourtSeasonHeatmapResource,{key:datasetKey(initialSelection),resource:decodeCourtSeasonHeatmapResource(initialResource,initialSelection)});
 const spatial=useSeasonResource(selection,available,retry,seasonShotMapUrl,decodeSeasonShotMapResource);
 return <RefinedShotExplorer player={player} locale={locale} datasets={datasets} selection={selection} aggregate={aggregate} spatial={spatial}
  onChoose={identity=>{if(identity.playerId===player.id)setSelection(identity);}} onRetry={()=>setRetry(value=>value+1)}/>;
}
