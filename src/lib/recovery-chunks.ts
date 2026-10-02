import{selectRecoveryTargets}from'./recovery-target-selection';
import type{RecoveryListPage}from'./recovery-candidates';
import{runRecoveryBatch}from'./recovery-batch';
import type{ProviderBasicSnapshot}from'./provider-player-normalizer';
import type{createRecoveryProviderClient}from'./recovery-provider-client';
/** At most two20-target chunks share ONE client/deadline/request counter.
 * Classified failures are attempted only once per invocation; transport/budget
 * interruptions stop immediately and preserve the last classified cursor.
 */
export async function runRecoveryChunks(schedule:unknown,existing:ReadonlySet<string>,initialCursor:string|null,client:ReturnType<typeof createRecoveryProviderClient>,maxRequests:number,verifiedIds:ReadonlySet<string>,existingMatches:ReadonlyMap<string,string>,chunks=1){
 if(chunks!==1&&chunks!==2)throw new Error('Invalid recovery chunk count');
 const attempted=new Set(existing),matched=new Map(existingMatches),pages=new Map<string,RecoveryListPage>();
 const accepted:ProviderBasicSnapshot[]=[],rejected:{gameId:string;reason:string}[]=[];
 let cursor=initialCursor;
 for(let index=0;index<chunks;index++){
  if(client.requestsMade>=maxRequests)break;
  const targets=selectRecoveryTargets(schedule,attempted,cursor,20);
  if(!targets.length)break;
  const result=await runRecoveryBatch(targets,client,maxRequests,verifiedIds,matched,pages);
  for(const snapshot of result.accepted){accepted.push(snapshot);attempted.add(snapshot.game.nbaGameId);matched.set(snapshot.game.providerMatchId,snapshot.game.nbaGameId);}
  for(const row of result.rejected){rejected.push(row);attempted.add(row.gameId);}
  if(result.cursor)cursor=result.cursor;
  if(result.interrupted)break;
 }
 return{accepted,rejected,cursor,requests:client.requestsMade};
}
