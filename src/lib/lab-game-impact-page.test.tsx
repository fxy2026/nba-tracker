import {isValidElement,type ReactNode} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({box:vi.fn(),schedule:vi.fn(),pbp:vi.fn(),locale:"en"}));
vi.mock('@/lib/api',()=>({getBoxScore:m.box,getFullSchedule:m.schedule,getScheduleAge:()=>null,toBeijingTime:()=>''}));
vi.mock('@/lib/game-play-by-play',()=>({getGamePlayByPlay:m.pbp}));
vi.mock('@/lib/locale',()=>({getLocale:async()=> m.locale}));
vi.mock('next/dynamic',()=>({default:()=>function DynamicChart(){return null;}}));
import Page from '@/app/lab/game-impact/page';
function nodes(node:ReactNode):React.ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return[];return[node as React.ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
const empty=()=>({actions:[],shots:[],scoringShots:[],scoreEvents:[]});
beforeEach(()=>{vi.clearAllMocks();m.locale="en";m.schedule.mockResolvedValue([]);m.pbp.mockResolvedValue(empty());m.box.mockResolvedValue(null);});
it.each(['bad','', ['0022500961','0022500340']])('invalid explicitid%s never requests upstream data',async id=>{const tree=await Page({searchParams:Promise.resolve({id})});expect(nodes(tree).some(n=>n.props.title==='Invalid game ID')).toBe(true);expect(m.box).not.toHaveBeenCalled();expect(m.schedule).not.toHaveBeenCalled();expect(m.pbp).not.toHaveBeenCalled();});
it('unavailable box links to existing game details without an unnecessaryPBPfetch',async()=>{const tree=await Page({searchParams:Promise.resolve({id:'0022500961'})});expect(nodes(tree).some(n=>n.props.title==='Detailed game data unavailable')).toBe(true);expect(nodes(tree).some(n=>(n.props.action as {href?:string})?.href==='/game/0022500961')).toBe(true);expect(m.pbp).not.toHaveBeenCalled();});
it('validated empty PBP safely withholds chart on an otherwise available game',async()=>{m.box.mockResolvedValue({gameId:'0022500961',gameTimeUTC:'2026-03-13T20:00:00Z',homeTeam:{teamTricode:'DET',score:126,players:[]},awayTeam:{teamTricode:'MEM',score:110,players:[]}});const tree=await Page({searchParams:Promise.resolve({id:'0022500961'})});expect(m.pbp).toHaveBeenCalledWith('0022500961');expect(nodes(tree).some(n=>n.props.title==='Scoring curve unavailable')).toBe(true);expect(nodes(tree).some(n=>Array.isArray(n.props.series))).toBe(false);});

// Synthetic mocked feed/box fixtures exercise the real reconciliation and page
// series builder. They are not verification against a real provider response.
const fixtureBox = () => ({
  gameId: '0022500961', gameStatus: 3, gameTimeUTC: '2026-03-13T20:00:00Z',
  homeTeam: { teamCity: 'Detroit', teamName: 'Pistons', teamTricode: 'DET', score: 4,
    players: [{ personId: 1, played: '1', statistics: { points: 4 } }] },
  awayTeam: { teamCity: 'Memphis', teamName: 'Grizzlies', teamTricode: 'MEM', score: 3,
    players: [{ personId: 2, played: '1', statistics: { points: 3 } }] },
});
const fixtureActions = () => [
  { actionNumber: 1, period: 1, clock: 'PT10M59S', actionType: '2pt', personId: 1, teamTricode: 'DET', playerNameI: 'A. Home', scoreHome: '2', scoreAway: '0' },
  { actionNumber: 2, period: 1, clock: 'PT10M58S', actionType: '3pt', personId: 2, teamTricode: 'MEM', playerNameI: 'B. Away', scoreHome: '2', scoreAway: '3' },
  { actionNumber: 3, period: 2, clock: 'PT12M00S', actionType: '2pt', personId: 1, teamTricode: 'DET', playerNameI: 'A. Home', scoreHome: '4', scoreAway: '3' },
].map(a => ({ ...a, shotResult: 'Made', description: 'Synthetic scoring fixture', subType: '' }));
const page = () => Page({ searchParams: Promise.resolve({ id: '0022500961' }) });
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
it.each(['en', 'zh'])('present but rejected feed uses accurate unavailable copy (%s)', async locale => {
  m.locale = locale;
  m.box.mockResolvedValue(fixtureBox());
  m.pbp.mockResolvedValue({ ...empty(), actions: fixtureActions().slice(0, 2) });
  const all = nodes(await page());
  const state = all.find(n => n.props.title === (locale === 'zh' ? '得分曲线暂不可用' : 'Scoring curve unavailable'));
  expect(state?.props.description).toContain(locale === 'zh' ? '无法核验完整得分曲线' : 'A complete scoring curve cannot be verified');
  expect(all.some(n => Array.isArray(n.props.series))).toBe(false);
  expect(all.some(n => n.props.href === '/game/0022500961')).toBe(true);
  expect(m.pbp).toHaveBeenCalledExactlyOnceWith('0022500961');
});
it.each(['en', 'zh'])('reconciled mocked page supplies complete chart series and mobile header (%s)', async locale => {
  m.locale = locale;
  m.box.mockResolvedValue(fixtureBox());
  const actions = fixtureActions();
  m.pbp.mockResolvedValue({ ...empty(), actions: [actions[2], actions[0], actions[1]] });
  const all = nodes(await page());
  const chart = all.find(n => Array.isArray(n.props.series));
  expect(chart?.props.steps).toBe(4);
  expect(chart?.props.series).toEqual([
    expect.objectContaining({ personId: 1, total: 4, points: [0, 2, 2, 4] }),
    expect.objectContaining({ personId: 2, total: 3, points: [0, 0, 3, 3] }),
  ]);
  expect(chart?.props.quarterStarts).toEqual([{ index: 3, label: locale === 'zh' ? '第2节' : 'Q2' }]);
  expect(all.some(n => n.props.title === 'Scoring curve unavailable' || n.props.title === '得分曲线暂不可用')).toBe(false);
  const header = all.find(n => n.props.href === '/game/0022500961' && String(n.props.className).includes('glass-tile'))!;
  const classes = String(header.props.className).split(' ');
  expect(classes).toEqual(expect.arrayContaining(['min-h-11', 'flex-col', 'items-start', 'sm:flex-row', 'sm:items-center', 'sm:justify-between']));
  expect(text(header)).toContain('Memphis Grizzlies 3 @ 4 Detroit Pistons');
  expect(text(header)).toContain(locale === 'zh' ? '完整比赛' : 'Full game');
  const matchup = nodes(header).find(n => n.type === 'p' && text(n).includes('Memphis Grizzlies'))!;
  expect(String(matchup.props.className).split(' ')).toEqual(expect.arrayContaining(['whitespace-normal', 'break-words', 'sm:truncate']));
  expect(String(matchup.props.className).split(' ')).not.toContain('truncate');
  expect(m.box).toHaveBeenCalledExactlyOnceWith('0022500961');
  expect(m.pbp).toHaveBeenCalledExactlyOnceWith('0022500961');
});
