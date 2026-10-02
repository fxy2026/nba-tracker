import { normalizeProviderPlayerStats } from './provider-player-normalizer';
import { parseRecoveryManifest } from './recovery-manifest';
import type {createRecoveryProviderClient}from'./recovery-provider-client';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
// Verify only the two already-reviewed fixtures. No snapshot/cursor writes.
export async function verifyKnownProviderSnapshots(raw:unknown,client:ReturnType<typeof createRecoveryProviderClient>){
 if(!object(raw))throw new Error('Invalid verification fixtures');
 const ids=['0022500961','0022500340'];let verifiedPlayers=0;
 for(const id of ids){
  const box=raw[id];if(!object(box)||!Array.isArray(box.players))throw new Error('Missing verification fixture');
  const manifest=parseRecoveryManifest({version:1,games:[{nbaGameId:id,providerMatchId:box.providerMatchId,season:box.season,gameDate:box.gameDate,home:{tricode:box.home,score:box.homeScore},away:{tricode:box.away,score:box.awayScore}}]});
  if(!manifest.ok)throw new Error('Invalid verification manifest');
  const game=manifest.manifest.games[0],response=await client.getStats(game.providerMatchId);
  if(!response.ok||!response.retrievedAt)throw new Error('Provider verification unavailable');
  const normalized=normalizeProviderPlayerStats(response.body,game,{requestedMatchId:response.requestedMatchId,retrievedAt:response.retrievedAt,retrievedAtPrecision:'exact'});
  if(!normalized.ok||normalized.snapshot.players.length!==box.players.length)throw new Error('Provider verification incomplete');
  for(const row of normalized.snapshot.players){
   const expected=box.players.find(p=>object(p)&&p.name===row.name);if(!object(expected))throw new Error('Provider verification identity mismatch');
   for(const key of ['points','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls','plusMinus','starter'] as const)if(row[key]!==expected[key])throw new Error('Provider verification stat mismatch');
   if(row.minutesRounded!==expected.minutes)throw new Error('Provider verification minutes mismatch');
   verifiedPlayers++;
  }
 }
 return {games:ids.length,players:verifiedPlayers,requests:client.requestsMade};
}
