import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { EraContext, type PlayerData } from '@/app/compare/CompareClient';
const player={personId:2544,firstName:'LeBron',lastName:'James',teamAbbr:'CLE',teamName:'Cavaliers',teamCity:'Cleveland',jersey:'23',position:'F',pts:25.3,reb:7.4,ast:6.8,isIconicSeason:true,season:'2015-16',seasonYear:2015} satisfies PlayerData;
it.each([false,true])('exact-season league benchmark has no fabricated team-share claim, zh=%s',isZh=>{const html=renderToStaticMarkup(createElement(EraContext,{p1:player,p2:player,isZh}));expect(html).toContain(isZh?'联盟球队场均得分':'League team PPG');expect(html).toContain('102.7');expect(html).toContain('2015-16');expect(html).toContain('25.3');expect(html).not.toContain('% of team output');expect(html).not.toContain('占球队得分');});
it('nearest-year lookup is not silently used as exact benchmark',()=>{const missing={...player,seasonYear:2012,season:'2012-13'};expect(renderToStaticMarkup(createElement(EraContext,{p1:missing,p2:missing,isZh:false}))).toBe('');});
it('one missing year does not suppress the other exact benchmark',()=>{const html=renderToStaticMarkup(createElement(EraContext,{p1:{...player,seasonYear:2012},p2:player,isZh:false}));expect(html.match(/League team PPG/g)).toHaveLength(1);});
it.each([null,undefined,0])('player PPG %s remains unknown or actual zero without invented ratio',pts=>{const html=renderToStaticMarkup(createElement(EraContext,{p1:{...player,pts},p2:player,isZh:false}));expect(html).toContain(pts===0?'0.0':'—');expect(html).not.toContain('%');expect(html).not.toMatch(/NaN|Infinity/);});
