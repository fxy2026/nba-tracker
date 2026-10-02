import { isValidElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import schedule from '@/data/schedule-2025-26.json';
import RecoveredPlayerBox from '@/app/game/[id]/_components/RecoveredPlayerBox';
const mocks=vi.hoisted(()=>({box:vi.fn(),pbp:vi.fn(),full:vi.fn()}));
vi.mock('@/lib/api',async original=>({...await original<typeof import('./api')>(),getBoxScore:mocks.box,getPlayerIndex:async()=>[],getFullSchedule:mocks.full}));
vi.mock('@/lib/game-play-by-play',()=>({getGamePlayByPlay:mocks.pbp}));
vi.mock('@/lib/locale',()=>({getLocale:async()=> 'en'}));
import Page from '@/app/game/[id]/page';
function recovered(node:ReactNode):unknown[]{if(Array.isArray(node))return node.flatMap(recovered);if(!isValidElement<{children?:ReactNode;box?:unknown}>(node))return[];return node.type===RecoveredPlayerBox?[node.props.box]:recovered(node.props.children);}
beforeEach(()=>{mocks.box.mockReset().mockResolvedValue(null);mocks.full.mockReset().mockResolvedValue(schedule.dates);mocks.pbp.mockReset().mockReturnValue(new Promise(()=>{}));});
it.each(['0022500961','0022500340','0042500404','0042500405','0042500301','0042500302','0042500304','0042500311','0042500312','0042500314','0042500315','0042500317'])('actual page restores snapshot when NBA box unavailable%s',async id=>{const result=recovered(await Page({params:Promise.resolve({id})}));expect(result).toHaveLength(1);expect(result[0]).toMatchObject({gameId:id,provider:'BigBallsData'});expect(mocks.pbp).not.toHaveBeenCalled();});
it('an unverified game is not filled with another verified snapshot',async()=>{expect(recovered(await Page({params:Promise.resolve({id:'0042500143'})}))).toHaveLength(0);});
it('existing NBA box stays preferred and retains its normal page',async()=>{const team={teamId:1610612765,teamTricode:'DET',teamName:'Pistons',teamCity:'Detroit',score:126,players:[],periods:[],statistics:{}};mocks.box.mockResolvedValue({gameId:'0022500961',gameCode:'20260313/MEMDET',gameStatus:3,gameStatusText:'Final',gameTimeUTC:'2026-03-13T23:30:00Z',arena:{arenaName:'Arena',arenaCity:'Detroit'},homeTeam:team,awayTeam:{...team,teamTricode:'MEM',score:110}});expect(recovered(await Page({params:Promise.resolve({id:'0022500961'})}))).toHaveLength(0);expect(mocks.full).not.toHaveBeenCalled();});
