import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";
const state=vi.hoisted(()=>({locale:'en',result:{} as Record<string,unknown>}));
vi.mock('@/lib/usePlayerCareer',()=>({usePlayerCareer:()=>state.result}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:state.locale,t:state.locale==='zh'?zh:en})}));
vi.mock('@/components/player/PlayerRankBadges',()=>({default:()=>null}));
import PlayerStatsBundle from '@/components/player/PlayerStatsBundle';
const row={SEASON_ID:'2025-26',TEAM_ABBREVIATION:'LAL',GP:70,MIN:30,PTS:20,REB:5,AST:6,STL:1,BLK:0,FG_PCT:.5,FG3_PCT:null,FT_PCT:.8};
const render=()=>renderToStaticMarkup(createElement(PlayerStatsBundle,{playerId:2544,playerName:'LeBron James',teamTricode:'LAL'}));
it.each(['en','zh'])('unavailable exposes retry rather than disappearing, %s',locale=>{state.locale=locale;state.result={data:null,loading:false,error:true,stale:false,retry:vi.fn()};const html=render();expect(html).toContain(locale==='zh'?'重试':'Retry');expect(html).toContain('nba.com/player/2544');});
it.each(['en','zh'])('valid empty has explicit source-empty status, %s',locale=>{state.locale=locale;state.result={data:{careerSeasons:[]},loading:false,error:false,stale:false,retry:vi.fn()};expect(render()).toContain(locale==='zh'?'数据源已响应':'The source responded');});
it.each(['en','zh'])('failed refresh retains career table and labels stale, %s',locale=>{state.locale=locale;state.result={data:{careerSeasons:[row]},loading:false,error:true,stale:true,retry:vi.fn()};const html=render();expect(html).toContain('2025-26');expect(html).toContain('20.0');expect(html).toContain(locale==='zh'?'保留上次成功加载':'last successfully loaded');});
it.each(['en','zh'])('career percentages are unavailable without the direct aggregate, never GP-weighted %s',locale=>{
 state.locale=locale;state.result={data:{careerSeasons:[{...row,SEASON_ID:'2024-25',FG_PCT:.5,FGA:20},{...row,FG_PCT:.4,FGA:10}]},loading:false,error:false,stale:false,retry:vi.fn()};const html=render();const career=html.match(/<tr class="border-t-2[^>]*>[\s\S]*?<\/tr>/)![0];expect(career).not.toContain('%');expect(html).toContain('50.0%');expect(html).toContain('40.0%');expect(html).not.toContain('45.0%');expect(html).toContain(locale==='zh'?'不按比赛场数平均':'not game-weighted');
});
it.each(['en','zh'])('direct career percentages and TOT arithmetic remain useful %s',locale=>{
 state.locale=locale;state.result={data:{careerSeasons:[{...row,GP:60},{...row,TEAM_ABBREVIATION:'NYK',GP:40},{...row,TEAM_ABBREVIATION:'TOT',GP:100}],careerShooting:{source:'nba-career-totals',FG_PCT:.467,FG3_PCT:0,FT_PCT:null}},loading:false,error:false,stale:false,retry:vi.fn()};const html=render();const career=html.match(/<tr class="border-t-2[^>]*>[\s\S]*?<\/tr>/)![0];expect(career).toContain('46.7%');expect(career).toContain('0.0%');expect(career).toContain('>100</td>');expect(career).not.toContain('>200</td>');expect(html).toContain('TOT');expect(html).toContain('NYK');
});
