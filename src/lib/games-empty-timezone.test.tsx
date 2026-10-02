import {createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{expect,it,vi}from'vitest';
import{getTranslations}from'@/locales';
const state=vi.hoisted(()=>({locale:'en'}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:state.locale,t:getTranslations(state.locale as 'en'|'zh')})}));
import GamesList from '@/components/GamesList';
it.each(['en','zh'])('previous-day empty link preserves selected timezone with accurate label %s',locale=>{
 state.locale=locale;const html=renderToStaticMarkup(createElement(GamesList,{selectedDate:'2026-03-08',initialGames:[],isToday:true,timeZone:'America/New_York'}));expect(html).toContain('/?date=2026-03-07&amp;tz=America%2FNew_York');expect(html).toContain(locale==='zh'?'前一天的比赛':'Previous day’s games');
});
