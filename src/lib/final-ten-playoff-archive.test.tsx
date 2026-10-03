import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import schedule from '../data/schedule-2025-26.json';
import oldHashes from './fixtures/recovered-before-final-ten-hashes.json';
import {validateRecoveredPlayerBox,type RecoveredPlayerBox as Box} from './recovered-player-box';
import {readStoredArchives,buildStoredSnapshotIndex} from '../../scripts/recovery/snapshot-store';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const ids=['0042500173','0042500131','0042500161','0042500121','0042500171','0042500111','0042500141','0042500101','0042500151','0042500122'];
const boxes=archive as Record<string,Box>;
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
it('keeps all77 earlier verified boxes exactly unchanged',()=>{expect(Object.keys(oldHashes)).toHaveLength(77);for(const[id,sha]of Object.entries(oldHashes))expect(hash(boxes[id])).toBe(sha);});
it('stores10 independently sourced complete official boxes220played rows without provider IDs',()=>{
 expect(ids.flatMap(id=>boxes[id].players)).toHaveLength(220);
 for(const id of ids){const b=boxes[id];expect(validateRecoveredPlayerBox(b,schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)!)).not.toBeNull();expect(b.provider).toBe('NBA official final report');expect(b.providerMatchId).toBeNull();expect(b.players.every(p=>p.providerPlayerId===null&&p.source==='NBA official final report')).toBe(true);}
});
it('protects official game IDs without inventing provider match ownership',()=>{
 const stored=readStoredArchives();const index=buildStoredSnapshotIndex(stored.generic,stored.verified,stored.quarantined);
 for(const id of ids)expect(index.existing.has(id)).toBe(true);
});
it.each([true,false])('renders exact source and clock minutes without provider or identity-correction claims %s',isZh=>{
 const box=boxes['0042500173'];const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));
 expect(html.match(/<table/g)).toHaveLength(2);expect(html.match(/<th scope="row"/g)).toHaveLength(21);expect(html).toContain('00:01');expect(html).not.toContain('BigBallsData');expect(html).not.toContain('MIN ≈');expect(html).toContain(isZh?'NBA 官方赛后报告':'NBA official final report');
});

it('covers every canonical final playoff game exactly once after the identity correction',()=>{const games=schedule.dates.flatMap(d=>d.games).filter(g=>g.gameId.startsWith('00425')&&g.gameStatus===3);expect(games).toHaveLength(85);expect(new Set(games.map(g=>g.gameId)).size).toBe(85);for(const game of games)expect(validateRecoveredPlayerBox(boxes[game.gameId],game)).not.toBeNull();expect(schedule.dates.flatMap(d=>d.games).some(g=>g.gameId==='9401869400')).toBe(false);expect(schedule.dates.flatMap(d=>d.games).find(g=>g.gameId==='0022500989')).toMatchObject({gameCode:'20260316/LALHOU'});});
