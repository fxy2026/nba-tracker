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

it.each(['en', 'zh'])('shows NBA source and clearly scoped API retrieval time, %s', locale => {
  state.locale = locale;
  state.result = { data: { careerSeasons: [row], provenance: {
    source: 'nba-stats', providerPlayerId: '2544', scope: 'regular-season', retrievalKind: 'api-response', retrievedAt: '2026-10-03T02:00:00.000Z',
  } }, loading: false, error: false, stale: false, retry: vi.fn() };
  const html = render();
  expect(html).toContain('stats.nba.com/stats/playercareerstats?PlayerID=2544&amp;PerMode=PerGame');
  expect(html).toContain('NBA Stats');
  expect(html).toContain('dateTime="2026-10-03T02:00:00.000Z"');
  expect(html).toContain('2026-10-03 02:00:00 UTC');
  expect(html).toContain(locale === 'zh' ? '本 API 获取时间' : 'Retrieved by this API');
  expect(html).toContain(locale === 'zh' ? '获取时可能使用缓存' : 'Retrieval may use cached data');
  expect(html).toContain(locale === 'zh' ? '不代表赛季或比赛日期' : 'not a season/game date');
  expect(html).not.toMatch(/verified|已核实|独立核验/i);
});

it.each(['en', 'zh'])('labels ESPN fallback accurately for both rows and empty responses, %s', locale => {
  state.locale = locale;
  for (const careerSeasons of [[row], []]) {
    state.result = { data: { careerSeasons, provenance: {
      source: 'espn', providerPlayerId: '1966', scope: 'regular-season', retrievalKind: 'api-response', retrievedAt: '2026-10-03T02:00:00.000Z',
    } }, loading: false, error: false, stale: false, retry: vi.fn() };
    const html = render();
    expect(html).toContain('site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/1966/stats');
    expect(html).toContain(locale === 'zh' ? 'ESPN（备用来源）' : 'ESPN (fallback)');
    expect(html).not.toContain('NBA Stats');
    if (!careerSeasons.length) expect(html).toContain(locale === 'zh' ? '数据源已响应' : 'The source responded');
  }
});

it.each(['en', 'zh'])('retained rows keep the original source and timestamp beside the stale warning, %s', locale => {
  state.locale = locale;
  state.result = { data: { careerSeasons: [row], provenance: {
    source: 'espn', providerPlayerId: '1966', scope: 'regular-season', retrievalKind: 'api-response', retrievedAt: '2026-09-01T01:02:03.000Z',
  } }, loading: false, error: true, stale: true, retry: vi.fn() };
  const html = render();
  expect(html).toContain(locale === 'zh' ? '保留上次成功加载' : 'last successfully loaded');
  expect(html).toContain('ESPN');
  expect(html).toContain('2026-09-01 01:02:03 UTC');
  expect(html).toContain('2025-26');
});

it.each(['en', 'zh'])('does not guess provenance for legacy rows, even with an NBA shooting aggregate, %s', locale => {
  state.locale = locale;
  state.result = { data: { careerSeasons: [row], careerShooting: { source: 'nba-career-totals', FG_PCT: .5, FG3_PCT: null, FT_PCT: .8 } }, loading: false, error: false, stale: false, retry: vi.fn() };
  const html = render();
  expect(html).toContain(locale === 'zh' ? '未附来源及获取时间' : 'Source and retrieval time are unavailable');
  expect(html).not.toContain('NBA Stats');
  expect(html).not.toContain('<time');
});

it.each(['en', 'zh'])('keeps retained empty attribution visible after a failed refresh, %s', locale => {
  state.locale = locale;
  state.result = { data: { careerSeasons: [], provenance: {
    source: 'espn', providerPlayerId: '1966', scope: 'regular-season', retrievalKind: 'api-response', retrievedAt: '2026-09-01T01:02:03.000Z',
  } }, loading: false, error: true, stale: true, retry: vi.fn() };
  const html = render();
  expect(html).toContain('ESPN');
  expect(html).toContain('2026-09-01 01:02:03 UTC');
  expect(html).toContain(locale === 'zh' ? '重试' : 'Retry');
  expect(html).not.toContain(locale === 'zh' ? '数据源已响应' : 'The source responded');
});

import archivedLeBron from '@/data/player-career-archives/2544-2026-10-03.json';
import archivedCurry from '@/data/player-career-archives/201939-2026-10-03.json';
import archivedGiannis from '@/data/player-career-archives/203507-2026-10-03.json';
it.each([
  ['en', archivedCurry, 'GSW'], ['zh', archivedCurry, 'GSW'],
  ['en', archivedGiannis, 'MIL'], ['zh', archivedGiannis, 'MIL'],
] as const)('renders the reviewed career snapshot for $1.player.name in $0', (locale, record, team) => {
  state.locale = locale;
  state.result = { data: record.data, loading: false, error: false, stale: true, retry: vi.fn() };
  const html = renderToStaticMarkup(createElement(PlayerStatsBundle, {
    playerId: Number(record.player.nbaId), playerName: record.player.name, teamTricode: team,
  }));
  const coverage = record.data.provenance.coverage;
  expect(html).toContain(record.source.url);
  expect(html).toContain(`dateTime="${record.data.provenance.capturedAt}"`);
  expect(html).toContain(coverage.firstSeason); expect(html).toContain(coverage.lastSeason);
  expect(html).toContain(locale === 'zh' ? `${coverage.seasonCount} 个赛季` : `${coverage.seasonCount} seasons`);
  expect(html).toContain(locale === 'zh' ? '可能缺少后续更新' : 'may miss later updates');
  expect(html).not.toContain(locale === 'zh' ? '本 API 获取时间：' : 'Retrieved by this API:');
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match => match[0]);
  const seasons = rows.filter(row => /<td[^>]*>\d{4}-\d{2}(?:<\/td>|<span)/.test(row));
  expect(seasons).toHaveLength(coverage.rowCount);
  for (const row of seasons) expect(row).toContain(`>${team}</td>`);
  const career = html.match(/<tr class="border-t-2[^>]*>[\s\S]*?<\/tr>/)![0];
  const overall = record.data.careerAverage;
  for (const value of [String(overall.GP), overall.MIN.toFixed(1), overall.PTS.toFixed(1), overall.AST.toFixed(1)]) {
    expect(career).toContain(`>${value}</td>`);
  }
});
it.each(['en', 'zh'])('renders dated archive coverage, fixed capture time and direct Overall values honestly, %s', locale => {
  state.locale = locale;
  state.result = { data: archivedLeBron.data, loading: false, error: true, stale: true, retry: vi.fn() };
  const html = render();
  expect(html).toContain('https://www.nba.com/stats/player/2544/career');
  expect(html).toContain('2003-04'); expect(html).toContain('2025-26');
  expect(html).toContain('dateTime="2026-10-03T03:05:29.326Z"');
  expect(html).toContain('2026-10-03 03:05:29 UTC');
  expect(html).toContain(locale === 'zh' ? '23 个赛季' : '23 seasons');
  expect(html).toContain(locale === 'zh' ? '可能缺少后续更新' : 'may miss later updates');
  expect(html).toContain(locale === 'zh' ? '不是本 API 获取时间' : 'not API retrieval');
  expect(html).toContain(locale === 'zh' ? 'Overall 行' : 'Overall row directly');
  expect(html).not.toContain(locale === 'zh' ? '本 API 获取时间：' : 'Retrieved by this API:');
  expect(html).not.toMatch(/verified|已核实|独立核验/i);
  const career = html.match(/<tr class="border-t-2[^>]*>[\s\S]*?<\/tr>/)![0];
  for (const value of ['1622', '37.6', '26.8', '7.5', '50.7%', '34.8%', '73.7%']) expect(career).toContain(`>${value}</td>`);
});

import PlayerAdvancedStats from '@/components/player/PlayerAdvancedStats';
it.each(['en', 'zh'])('labels supplementary advanced metrics with archived season coverage, %s', locale => {
  state.locale = locale;
  state.result = { data: archivedLeBron.data, loading: false, error: true, stale: true, retry: vi.fn() };
  const html = renderToStaticMarkup(createElement(PlayerAdvancedStats, { playerId: 2544 }));
  expect(html).toContain('2025-26');
  expect(html).toContain(locale === 'zh' ? '已存档快照' : 'dated archive');
  expect(html).toContain(locale === 'zh' ? '可能缺少后续更新' : 'later updates may be missing');
});
