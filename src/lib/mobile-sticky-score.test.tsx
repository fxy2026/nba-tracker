import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ visible: false, effect: undefined as undefined | (() => void | (() => void)), portal: vi.fn() }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useState: () => [state.visible, (next: boolean) => { state.visible = next; }],
  useEffect: (effect: () => void | (() => void)) => { state.effect = effect; },
}));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode, target: unknown) => { state.portal(target); return node; } }));
import GameStickyScore from '@/app/game/[id]/_components/GameStickyScore';
const props = {awayTricode:'NYK',awayScore:94,awayTeamId:1610612752,homeTricode:'SAS',homeScore:90,homeTeamId:1610612759,statusText:'Final',isLive:false};
let callback: (entries: {isIntersecting:boolean;boundingClientRect:{top:number}}[]) => void;
const disconnect = vi.fn();
const sentinel = {};
function text(node: ReactNode): string {
 if(Array.isArray(node)) return node.map(text).join(' ');
 if(typeof node==='string'||typeof node==='number')return String(node);
 return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):'';
}
beforeEach(() => {
 state.visible=false;state.portal.mockClear();disconnect.mockReset();
 vi.stubGlobal('document',{body:{},getElementById:()=>sentinel});
 vi.stubGlobal('IntersectionObserver',class { constructor(fn:typeof callback){callback=fn;} observe=vi.fn();disconnect=disconnect; });
});
afterEach(()=>vi.unstubAllGlobals());
it('portals actual sticky scores only after the hero scrolls above, and cleans up',()=>{
 expect(GameStickyScore(props)).toBeNull();
 const cleanup=state.effect!();
 callback([{isIntersecting:false,boundingClientRect:{top:500}}]);expect(GameStickyScore(props)).toBeNull();
 callback([{isIntersecting:false,boundingClientRect:{top:-1}}]);
 const result=GameStickyScore(props);
 expect(state.portal).toHaveBeenCalledWith(document.body);
 expect(text(result)).toContain('NYK');expect(text(result)).toContain('94');expect(text(result)).toContain('90');
 expect(result).toMatchObject({props:{className:expect.stringContaining('site-sticky-offset')}});
 callback([{isIntersecting:true,boundingClientRect:{top:0}}]);expect(GameStickyScore(props)).toBeNull();
 cleanup?.();expect(disconnect).toHaveBeenCalledTimes(1);
});
