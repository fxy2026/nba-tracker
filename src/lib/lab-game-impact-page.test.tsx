import {isValidElement,type ReactNode} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({box:vi.fn(),schedule:vi.fn(),pbp:vi.fn()}));
vi.mock('@/lib/api',()=>({getBoxScore:m.box,getFullSchedule:m.schedule,getScheduleAge:()=>null,toBeijingTime:()=>''}));
vi.mock('@/lib/game-play-by-play',()=>({getGamePlayByPlay:m.pbp}));
vi.mock('@/lib/locale',()=>({getLocale:async()=> 'en'}));
vi.mock('next/dynamic',()=>({default:()=>function DynamicChart(){return null;}}));
import Page from '@/app/lab/game-impact/page';
function nodes(node:ReactNode):React.ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return[];return[node as React.ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
const empty=()=>({actions:[],shots:[],scoringShots:[],scoreEvents:[]});
beforeEach(()=>{vi.clearAllMocks();m.schedule.mockResolvedValue([]);m.pbp.mockResolvedValue(empty());m.box.mockResolvedValue(null);});
it.each(['bad','', ['0022500961','0022500340']])('invalid explicitid%s never requests upstream data',async id=>{const tree=await Page({searchParams:Promise.resolve({id})});expect(nodes(tree).some(n=>n.props.title==='Invalid game ID')).toBe(true);expect(m.box).not.toHaveBeenCalled();expect(m.schedule).not.toHaveBeenCalled();expect(m.pbp).not.toHaveBeenCalled();});
it('unavailable box links to existing game details without an unnecessaryPBPfetch',async()=>{const tree=await Page({searchParams:Promise.resolve({id:'0022500961'})});expect(nodes(tree).some(n=>n.props.title==='Detailed game data unavailable')).toBe(true);expect(nodes(tree).some(n=>(n.props.action as {href?:string})?.href==='/game/0022500961')).toBe(true);expect(m.pbp).not.toHaveBeenCalled();});
it('validated empty PBP safely withholds chart on an otherwise available game',async()=>{m.box.mockResolvedValue({gameId:'0022500961',gameTimeUTC:'2026-03-13T20:00:00Z',homeTeam:{teamTricode:'DET',score:126,players:[]},awayTeam:{teamTricode:'MEM',score:110,players:[]}});const tree=await Page({searchParams:Promise.resolve({id:'0022500961'})});expect(m.pbp).toHaveBeenCalledWith('0022500961');expect(nodes(tree).some(n=>n.props.title==='No play-by-play for this game')).toBe(true);expect(nodes(tree).some(n=>Array.isArray(n.props.series))).toBe(false);});
