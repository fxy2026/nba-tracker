import{readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync}from'node:fs';
import{createHash}from'node:crypto';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{isValidElement,type ReactNode}from'react';
import{beforeEach,expect,it,vi}from'vitest';
import metadata from'../data/player-box-quarantine.json';
import active from'../data/provider-player-boxes.json';
import verified from'../data/recovered-player-boxes.json';
import schedule from'../data/schedule-2025-26.json';
import{isPlayerBoxQuarantined}from'./player-box-quarantine';
import{getProviderPlayerBox}from'./provider-player-archive';
import{readQuarantinedSnapshots,buildStoredSnapshotIndex}from'../../scripts/recovery/snapshot-store';
import type{ScheduleGame}from'./api';
const mock=vi.hoisted(()=>({locale:'en'}));
vi.mock('@/lib/api',async original=>({...await original<typeof import('./api')>(),getBoxScore:async()=>null,getPlayerIndex:async()=>[],getFullSchedule:async()=>schedule.dates}));
vi.mock('@/lib/locale',()=>({getLocale:async()=>mock.locale}));
import Page from'@/app/game/[id]/page';
import ProviderPlayerBox from'@/app/game/[id]/_components/ProviderPlayerBox';
function text(node:ReactNode):string{if(Array.isArray(node))return node.map(text).join('');if(typeof node==='string'||typeof node==='number')return String(node);return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):'';}
function contains(node:ReactNode,type:unknown):boolean{if(Array.isArray(node))return node.some(child=>contains(child,type));return isValidElement<{children?:ReactNode}>(node)&&(node.type===type||contains(node.props.children,type));}
beforeEach(()=>mock.locale='en');
it.each(['0042500154','0042500155'] as const)('quarantined original %s stays byte-identical and out of rendering',id=>{
 const source=readFileSync(`src/data/quarantined-player-boxes/${id}.json`);expect(createHash('sha256').update(source).digest('hex')).toBe(metadata[id].sourceFileSha256);const box=JSON.parse(source.toString());expect(box.players.some((p:{name:string})=>p.name==='Drew Doughty')).toBe(true);expect(box.players.some((p:{name:string})=>p.name==='Jrue Holiday')).toBe(false);expect(Object.hasOwn(active,id)).toBe(false);expect(isPlayerBoxQuarantined(id)).toBe(true);const game=schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)! as ScheduleGame;expect(getProviderPlayerBox(game)).toBeNull();
});
it.each(['en','zh'])('actual game fallback says identity review, with no wrong player table %s',async locale=>{
 mock.locale=locale;const page=await Page({params:Promise.resolve({id:'0042500155'})});expect(contains(page,ProviderPlayerBox)).toBe(false);expect(text(page)).toContain(locale==='zh'?'身份核验问题':'player identity issue');expect(text(page)).not.toContain('Drew Doughty');
});
it('automatic recovery protects quarantined game IDs and UUIDs',()=>{
 const blocked=readQuarantinedSnapshots('src/data/quarantined-player-boxes','src/data/player-box-quarantine.json');const index=buildStoredSnapshotIndex(active,verified,blocked);for(const[id,box]of Object.entries(blocked)){expect(index.existing.has(id)).toBe(true);expect(index.protectedIds.has(id)).toBe(true);expect(index.existingMatches.get(box.game.providerMatchId)).toBe(id);}
 expect(()=>buildStoredSnapshotIndex({...active,...blocked},verified,blocked)).toThrow();
 const sample=structuredClone(Object.values(active)[0]);sample.game.providerMatchId=Object.values(blocked)[0].game.providerMatchId;expect(()=>buildStoredSnapshotIndex({[sample.game.nbaGameId]:sample},verified,blocked)).toThrow();
});
it('tampered quarantine bytes fail validation instead of silently releasing them',()=>{
 const root=mkdtempSync(join(tmpdir(),'nba-quarantine-test-'));try{const dir=join(root,'boxes');mkdirSync(dir);const id='0042500155';const box=JSON.parse(readFileSync(`src/data/quarantined-player-boxes/${id}.json`,'utf8'));box.players.find((p:{name:string})=>p.name==='Drew Doughty').name='Jrue Holiday';writeFileSync(join(dir,`${id}.json`),JSON.stringify(box));const meta=join(root,'meta.json');writeFileSync(meta,JSON.stringify({[id]:metadata[id]}));expect(()=>readQuarantinedSnapshots(dir,meta)).toThrow();}finally{rmSync(root,{recursive:true,force:true});}
});
it('unknown and prototype IDs cannot accidentally match quarantine',()=>{expect(isPlayerBoxQuarantined('0022500340')).toBe(false);expect(isPlayerBoxQuarantined('__proto__')).toBe(false);});
it('small incoming identity registry exactly matches reviewed original evidence',async()=>{
 const {QUARANTINED_PROVIDER_IDENTITIES}=await import('./provider-identity-quarantine');
 for(const entry of Object.values(metadata))for(const id of entry.unsupportedProviderPlayerIds)expect(QUARANTINED_PROVIDER_IDENTITIES.some(row=>row.providerPlayerId===id)).toBe(true);
 for(const entry of Object.values(metadata))for(const name of entry.unsupportedProviderNames)expect(QUARANTINED_PROVIDER_IDENTITIES.some(row=>row.providerName===name)).toBe(true);
 expect(QUARANTINED_PROVIDER_IDENTITIES).toHaveLength(new Set(Object.values(metadata).flatMap(row=>row.unsupportedProviderPlayerIds)).size);
});
