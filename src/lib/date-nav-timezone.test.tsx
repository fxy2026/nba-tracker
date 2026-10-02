import{isValidElement,type ReactNode}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{beforeEach,afterEach,expect,it,vi}from'vitest';
import{getTranslations}from'@/locales';
const state=vi.hoisted(()=>({push:vi.fn(),locale:'en'}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:()=>[true,vi.fn()],useEffect:()=>{},useMemo:(fn:()=>unknown)=>fn(),useCallback:(fn:unknown)=>fn,useRef:()=>({current:null})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push})}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:state.locale,t:getTranslations(state.locale as 'en'|'zh')})}));
vi.mock('@/lib/timezone',async original=>({...await original<typeof import('./timezone')>(),localTz:()=> 'Asia/Shanghai'}));
import DateNav from '@/components/DateNav';
function buttons(node:ReactNode):Record<string,unknown>[] {if(Array.isArray(node))return node.flatMap(buttons);if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type==='button'?[node.props]:[]),...buttons(node.props.children as ReactNode)];}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-08T04:30:00Z'));state.push.mockReset();state.locale='en';});afterEach(()=>vi.useRealTimers());
it.each(['en','zh'])('explicit ET label and Today use selected zone, %s',locale=>{
 state.locale=locale;const tree=DateNav({selectedDate:'2026-03-08',timeZone:'America/New_York'});const html=renderToStaticMarkup(tree);expect(html).toContain('America/New_York');expect(html).toContain(locale==='zh'?'日期时区':'Date timezone');const today=buttons(tree).find(button=>button.children===(locale==='zh'?'今天':'Today'))!;expect(today).toBeDefined();(today.onClick as ()=>void)();expect(state.push).toHaveBeenCalledWith('/?date=2026-03-07&tz=America%2FNew_York',{scroll:false});
});
it('ordinary local Today navigation does not add a timezone preference',()=>{
 const tree=DateNav({selectedDate:'2026-03-07'});const today=buttons(tree).find(button=>button.children==='Today')!;(today.onClick as ()=>void)();expect(state.push).toHaveBeenCalledWith('/?date=2026-03-08',{scroll:false});
});
