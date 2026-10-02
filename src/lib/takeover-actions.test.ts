import {expect,it} from 'vitest';
import type {BoxScore} from './api';
import type {PlayAction} from '@/components/PlayByPlay';
import {validatedTakeoverActions,takeoverActionPoints} from './takeover-actions';
const action=(n:number,personId:number,type:string,home:number,away:number,extra:Partial<PlayAction>={}):PlayAction=>({actionNumber:n,period:1,clock:`PT10M${String(60-n).padStart(2,'0')}S`,actionType:type,shotResult:'Made',personId,teamTricode:personId===1?'DET':'MEM',playerNameI:personId===1?'A. Home':'B. Away',description:'score',subType:'',scoreHome:String(home),scoreAway:String(away),...extra});
const actions=[action(1,1,'2pt',2,0),action(2,2,'3pt',2,3),action(3,1,'freethrow',3,3)];
const box={gameId:'0022500961',gameStatus:2,homeTeam:{teamTricode:'DET',score:3,players:[{personId:1,played:'1',statistics:{points:3}}]},awayTeam:{teamTricode:'MEM',score:3,players:[{personId:2,played:'1',statistics:{points:3}}]}} as unknown as BoxScore;
it('retains complete1/2/3point actions without coordinates and orders an inserted event',()=>{expect(actions.map(takeoverActionPoints)).toEqual([2,3,1]);expect(validatedTakeoverActions([actions[2],actions[0],actions[1]],box)).toEqual(actions);});
it('same-clock free throws use action order and quarter boundaries keep cumulative score',()=>{const b=structuredClone(box);b.homeTeam.score=4;b.homeTeam.players[0].statistics.points=4;const rows=[...actions,action(4,1,'freethrow',4,3,{period:2,clock:'PT12M00.00S'})];expect(validatedTakeoverActions(rows,b)).toHaveLength(4);const same=actions.map(a=>({...a,clock:'PT10M00S'}));expect(validatedTakeoverActions([same[2],same[0],same[1]],box)).toEqual(same);});
it.each(['partial','duplicate','unknown-player','wrong-team','missing-score','wrong-running-score','bad-clock','negative-id','bad-period','negative-stats','box-mismatch','player-mismatch','unexplained-jump'])('withholds unsupported scoring series: %s',kind=>{
 const a=structuredClone(actions),b=structuredClone(box);
 if(kind==='partial')a.pop();if(kind==='duplicate')a.push({...a[0]});if(kind==='unknown-player')a[0].personId=99;if(kind==='wrong-team')a[0].teamTricode='LAL';if(kind==='missing-score')a[0].scoreHome='';if(kind==='wrong-running-score')a[0].scoreHome='20';if(kind==='bad-clock')a[0].clock='unknown';if(kind==='negative-id')a[0].actionNumber=-1;if(kind==='bad-period')a[0].period=1.2;if(kind==='negative-stats')b.homeTeam.players[0].statistics.points=-1;if(kind==='box-mismatch')b.homeTeam.score=4;if(kind==='player-mismatch')b.homeTeam.players[0].statistics.points=4;if(kind==='unexplained-jump')a.push(action(4,1,'timeout',8,3,{shotResult:undefined}));
 expect(validatedTakeoverActions(a,b)).toEqual([]);
});
it('empty feed stays unavailable and missed attempts do not add points',()=>{expect(validatedTakeoverActions([],box)).toEqual([]);const miss=action(4,1,'3pt',3,3,{shotResult:'Missed'});expect(takeoverActionPoints(miss)).toBe(0);expect(validatedTakeoverActions([...actions,miss],box)).toHaveLength(4);});

it('a live tie is valid but a tied final cannot establish a complete curve',()=>{expect(validatedTakeoverActions(actions,box)).toHaveLength(3);const final=structuredClone(box);final.gameStatus=3;expect(validatedTakeoverActions(actions,final)).toEqual([]);});
