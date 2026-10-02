import { expect, it } from "vitest";
import { directoryStats } from "./player-directory";
it("missing stats never enter composite ranking as zero, but known PPG remains usable",()=>{const missing={pts:20,reb:null,ast:2};const zero={pts:0,reb:0,ast:0};const normal={pts:10,reb:5,ast:2};const result=directoryStats([missing,zero,normal]);expect(result.ranked).toEqual([normal,zero]);expect(result.unranked).toEqual([missing]);expect(result.avgPts).toBe(10);expect(result.bestPpg).toBe(20);});
it("empty or all-unknown populations have unavailable rather than zero summaries",()=>{for(const input of [[],[{pts:null,reb:undefined,ast:NaN}]])expect(directoryStats(input)).toMatchObject({ranked:[],avgPts:null,bestPpg:null});});
it("genuine zero averages remain zero and inputs stay unchanged",()=>{const rows=[{pts:0,reb:0,ast:0}];expect(directoryStats(rows)).toMatchObject({ranked:rows,unranked:[],avgPts:0,bestPpg:0});expect(rows).toHaveLength(1);});
it("invalid numbers cannot contaminate aggregate statistics",()=>{expect(directoryStats([{pts:-1,reb:0,ast:0},{pts:Infinity,reb:1,ast:1}])).toMatchObject({ranked:[],avgPts:null,bestPpg:null});});
