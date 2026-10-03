import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import schedule from '../data/schedule-2025-26.json';
import oldHashes from './fixtures/recovered-before-official-nine-hashes.json';
import {validateRecoveredPlayerBox,type RecoveredPlayerBox as Box} from './recovered-player-box';
import {readStoredArchives,buildStoredSnapshotIndex} from '../../scripts/recovery/snapshot-store';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const ids=['0042500316','0042500303','0042500313','0042500211','0042500166','0042500165','0042500163','0042500153','0042500152'];
const boxes=archive as Record<string,Box>;
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
it('keeps all68 earlier verified boxes exactly unchanged',()=>{expect(Object.keys(oldHashes)).toHaveLength(68);for(const[id,sha]of Object.entries(oldHashes))expect(hash(boxes[id])).toBe(sha);});
it('stores9 independently sourced complete official boxes212played rows without provider IDs',()=>{
 expect(ids.flatMap(id=>boxes[id].players)).toHaveLength(212);
 for(const id of ids){const b=boxes[id];expect(validateRecoveredPlayerBox(b,schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)!)).not.toBeNull();expect(b.provider).toBe('NBA official final report');expect(b.providerMatchId).toBeNull();expect(b.players.every(p=>p.providerPlayerId===null&&p.source==='NBA official final report')).toBe(true);}
});
it('protects official game IDs without inventing provider match ownership',()=>{
 const stored=readStoredArchives();const index=buildStoredSnapshotIndex(stored.generic,stored.verified,stored.quarantined);
 for(const id of ids)expect(index.existing.has(id)).toBe(true);
});
it.each([true,false])('renders exact source and clock minutes without provider or identity-correction claims %s',isZh=>{
 const box=boxes['0042500316'];const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));
 expect(html.match(/<table/g)).toHaveLength(2);expect(html.match(/<th scope="row"/g)).toHaveLength(28);expect(html).toContain('22:31');expect(html).not.toContain('BigBallsData');expect(html).not.toContain('MIN ≈');expect(html).toContain(isZh?'NBA 官方赛后报告':'NBA official final report');
});
