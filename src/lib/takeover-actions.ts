import type {BoxScore} from './api';
import type {PlayAction} from '@/components/PlayByPlay';
import {chronologicalActions,readScorePair} from './scoring-runs';
export function takeoverActionPoints(action:PlayAction):number{
 if(action.shotResult!=='Made')return 0;
 return action.actionType==='3pt'?3:action.actionType==='2pt'?2:action.actionType==='freethrow'?1:0;
}
/** A complete scoring curve must reconcile to the independently loaded box. */
export function validatedTakeoverActions(actions:PlayAction[],box:BoxScore):PlayAction[]{
 if(!actions.length || box.homeTeam.teamTricode===box.awayTeam.teamTricode || ![box.homeTeam.score,box.awayTeam.score].every(score=>Number.isSafeInteger(score)&&score>=0) || (box.gameStatus===3&&box.homeTeam.score===box.awayTeam.score))return[];
 const numbers=new Set<number>();
 for(const action of actions){
  const clock=/^PT(\d+)M(\d+(?:\.\d+)?)S$/.exec(action.clock);
  if(!Number.isSafeInteger(action.actionNumber)||action.actionNumber<0||numbers.has(action.actionNumber)||!Number.isSafeInteger(action.period)||action.period<1||!clock)return[];
  const mins=Number(clock[1]),seconds=Number(clock[2]);
  if(seconds>=60||mins*60+seconds>(action.period>4?300:720))return[];
  numbers.add(action.actionNumber);
 }
 const players=new Map<number,{team:string;points:number}>();
 for(const team of [box.homeTeam,box.awayTeam])for(const player of team.players){
  if(!Number.isSafeInteger(player.personId)||player.personId<=0||players.has(player.personId)||!Number.isSafeInteger(player.statistics.points)||player.statistics.points<0||!["0","1"].includes(player.played)||(player.played==="0"&&player.statistics.points!==0))return[];
  players.set(player.personId,{team:team.teamTricode,points:player.statistics.points});
 }
 const ordered=chronologicalActions(actions);const tally=new Map<number,number>();let home=0,away=0;
 for(const action of ordered){
  const points=takeoverActionPoints(action);
  if(points){
   const player=players.get(action.personId);
   if(!player||player.team!==action.teamTricode)return[];
   tally.set(action.personId,(tally.get(action.personId)??0)+points);
   if(action.teamTricode===box.homeTeam.teamTricode)home+=points;
   else if(action.teamTricode===box.awayTeam.teamTricode)away+=points;
   else return[];
  }
  const score=readScorePair(action);
  if((points&&!score)||(score&&(score.scoreHome!==home||score.scoreAway!==away)))return[];
 }
 if(home!==box.homeTeam.score||away!==box.awayTeam.score)return[];
 for(const[id,player]of players)if((tally.get(id)??0)!==player.points)return[];
 return ordered;
}
