import{selectRecoveryTargets}from'./recovery-target-selection';
import{normalizeProviderPlayerStats,type ProviderBasicSnapshot}from'./provider-player-normalizer';
import type{createRecoveryProviderClient}from'./recovery-provider-client';
// Exact UUID matched by the strict two-date/team/final-score diagnostic in
// immutable run37011342891. This is game identity evidence, not player accuracy.
export const VERIFIED_FINALS_SAMPLE={nbaGameId:'0042500405',providerMatchId:'36043727-3dc2-4601-9138-5da8f10703c0'} as const;
export async function recoverFinalsSample(schedule:unknown,client:ReturnType<typeof createRecoveryProviderClient>,existing:ReadonlySet<string>,existingMatches:ReadonlyMap<string,string>=new Map()){
 const accepted:ProviderBasicSnapshot[]=[],rejected:{gameId:string;reason:string}[]=[];
 const id=VERIFIED_FINALS_SAMPLE.nbaGameId;
 const owner=existingMatches.get(VERIFIED_FINALS_SAMPLE.providerMatchId);
 if(owner&&owner!==id)throw new Error('Provider match identity already assigned');
 if(existing.has(id))return{accepted,rejected,requests:0,cursor:null};
 const target=selectRecoveryTargets(schedule,new Set(),null,20).find(game=>game.nbaGameId===id);
 if(!target||target.gameDate!=='2026-06-13'||target.home.tricode!=='SAS'||target.home.score!==90||target.away.tricode!=='NYK'||target.away.score!==94)throw new Error('Validated Finals identity changed or missing');
 const game={nbaGameId:target.nbaGameId,season:target.season,gameDate:target.gameDate,home:target.home,away:target.away,providerMatchId:VERIFIED_FINALS_SAMPLE.providerMatchId};
 const response=await client.getStats(game.providerMatchId);
 if(!response.ok||!response.retrievedAt)rejected.push({gameId:id,reason:`provider-stats-${response.reason??'unavailable'}`});
 else{
  const parsed=normalizeProviderPlayerStats(response.body,game,{requestedMatchId:response.requestedMatchId,retrievedAt:response.retrievedAt,retrievedAtPrecision:'exact'});
  if(parsed.ok)accepted.push(parsed.snapshot);else rejected.push({gameId:id,reason:parsed.reason});
 }
 return{accepted,rejected,requests:client.requestsMade,cursor:null};
}
