import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import history from '../data/resolved-player-box-quarantine.json';
import oldHashes from './fixtures/recovered-before-identity-hashes.json';
import originalPartial from '../data/supplemented-player-box-originals/0042500164.json';
import schedule from '../data/schedule-2025-26.json';
import {validateRecoveredPlayerBox,type RecoveredPlayerBox as Box} from './recovered-player-box';
import {assertResolvedHistory,generateStoredArchives,readStoredArchives} from '../../scripts/recovery/snapshot-store';
import {isQuarantinedProviderIdentity} from './provider-identity-quarantine';
import RecoveredPlayerBox from '@/app/game/[id]/_components/RecoveredPlayerBox';
const boxes=archive as Record<string,Box>;
const ids=['0042500154','0042500155'] as const;
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const gameFor=(id:string)=>schedule.dates.flatMap(day=>day.games).find(game=>game.gameId===id)!;
it('all55 previously verified snapshots remain unchanged',()=>{expect(Object.keys(oldHashes)).toHaveLength(55);for(const[id,sha]of Object.entries(oldHashes))expect(hash(id==='0042500164'?originalPartial:boxes[id])).toBe(sha);});
it.each(ids)('%s preserves original rejected bytes and53 otherprovider fields across bothgames',id=>{
 const h=history[id];const source=readFileSync(`src/data/resolved-player-box-originals/${id}.json`);expect(createHash('sha256').update(source).digest('hex')).toBe(h.originalQuarantineMetadata.sourceFileSha256);const original=JSON.parse(source.toString());const box=validateRecoveredPlayerBox(boxes[id],gameFor(id));expect(box).not.toBeNull();
 expect(hash(box)).toBe(h.resolution.recoveredSnapshotSha256);expect(box!.players).toHaveLength(original.players.length);
 for(const entry of h.preservedRows){const row=box!.players[entry.sourceIndex];const {team,minutes,...rest}=row;expect(team).toBe(entry.team);expect(hash({...rest,team:null,minutesRounded:minutes})).toBe(entry.originalRowSha256);}
 const row=box!.players[h.resolution.replacement.sourceIndex];expect(row).toMatchObject({name:'Jrue Holiday',providerPlayerId:null,team:'POR',source:'NBA official final report',officialSource:{jerseyNumber:'5',position:'G',reportSha256:h.resolution.officialReportSha256}});expect(box!.players.some(player=>player.name==='Drew Doughty')).toBe(false);
 expect(original.players.some((player:{name:string})=>player.name==='Drew Doughty')).toBe(true);expect(h.resolution.identityAliasEstablished).toBe(false);
});
it('officialpoints20/8 and exactminutes remain independently sourced',()=>{const a=boxes[ids[0]].players.find(p=>p.source)!,b=boxes[ids[1]].players.find(p=>p.source)!;expect(a).toMatchObject({points:20,minutes:37,officialSource:{officialDuration:'36:57'}});expect(b).toMatchObject({points:8,minutes:40,officialSource:{officialDuration:'39:31'}});});
it.each([true,false])('mixed source and officialrow markers are visible without wrong names%s',isZh=>{for(const id of ids){const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box:boxes[id],isZh}));expect(html).toContain('Jrue Holiday');expect(html).toContain('‡');expect(html).toContain('BigBallsData');expect(html).toContain(isZh?'整条球员记录独立取自':'independently sourced');expect(html).not.toContain('Drew Doughty');expect(html.match(/<th scope="row"/g)).toHaveLength(boxes[id].players.length);}});
it.each(['provider-id','single-source','no-source','wrong-report','wrong-hash','duration','missing-proof','bad-source','bad-kind'])('mixed row cannot silently alias/providerattribute %s',kind=>{const raw=structuredClone(boxes[ids[0]]);const row=raw.players.find(p=>p.source)!;if(kind==='provider-id')row.providerPlayerId='bcc566fc-5452-4681-ab41-b042fae11e53';if(kind==='single-source')raw.provider='BigBallsData';if(kind==='no-source'){delete row.source;delete row.officialSource;}if(kind==='wrong-report')row.officialSource!.reportUrl=boxes[ids[1]].reportUrl;if(kind==='wrong-hash')row.officialSource!.reportSha256='bad';if(kind==='duration')row.officialSource!.officialDuration='10:00';if(kind==='missing-proof')delete row.officialSource;if(kind==='bad-source')Object.assign(row,{source:'provider-guessed'});if(kind==='bad-kind')Object.assign(row.officialSource!,{kind:'alias'});expect(validateRecoveredPlayerBox(raw,gameFor(raw.gameId))).toBeNull();});
it('future provideridentity stillblocked even ifrenamed; independently sourced nullIDdoesnot establishalias',()=>{expect(isQuarantinedProviderIdentity('bcc566fc-5452-4681-ab41-b042fae11e53','Jrue Holiday')).toBe(true);expect(isQuarantinedProviderIdentity('other','Drew Doughty')).toBe(true);expect(isQuarantinedProviderIdentity(null,'Jrue Holiday')).toBe(false);});
function root(){const dir=mkdtempSync(join(tmpdir(),'nba-resolved-'));for(const name of ['provider-player-boxes','recovered-player-boxes','quarantined-player-boxes','resolved-player-box-originals','supplemented-player-box-originals'])cpSync(`src/data/${name}`,join(dir,name),{recursive:true});for(const name of ['schedule-2025-26.json','player-box-quarantine.json','resolved-player-box-quarantine.json','supplemented-player-box-history.json'])cpSync(`src/data/${name}`,join(dir,name));return dir;}
it('clean build reads57active boxes without treating historical originals as duplicateowners',()=>{const dir=root();try{generateStoredArchives(dir);const data=readStoredArchives(dir);expect(Object.keys(data.verified)).toHaveLength(57);expect(data.quarantined).toEqual({});expect(data.generic).toEqual({});}finally{rmSync(dir,{recursive:true,force:true});}});
it.each(['original-bytes','resolution-hash','missing-verified','alias','wrong-report','preserved-row-proof'])('historyintegrity failsclosed%s',kind=>{const dir=root();try{const metadata=structuredClone(history);if(kind==='original-bytes')writeFileSync(join(dir,'resolved-player-box-originals/0042500154.json'),'{}');if(kind==='resolution-hash')metadata[ids[0]].resolution.recoveredSnapshotSha256='bad';if(kind==='alias')Object.assign(metadata[ids[0]].resolution,{identityAliasEstablished:true});if(kind==='wrong-report')metadata[ids[0]].resolution.officialReportUrl=metadata[ids[1]].resolution.officialReportUrl;if(kind==='preserved-row-proof')metadata[ids[0]].preservedRows[0].originalRowSha256='bad';writeFileSync(join(dir,'resolved-player-box-quarantine.json'),JSON.stringify(metadata));const verified={...boxes};if(kind==='missing-verified')delete verified[ids[0]];expect(()=>assertResolvedHistory(dir,verified)).toThrow();}finally{rmSync(dir,{recursive:true,force:true});}});
