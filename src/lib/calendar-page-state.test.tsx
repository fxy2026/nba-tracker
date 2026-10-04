import {isValidElement,Suspense,type ReactElement,type ReactNode}from'react';
import {renderToStaticMarkup}from'react-dom/server';
import{beforeEach,afterEach,expect,it,vi}from'vitest';
import{getTranslations}from'@/locales';
const runtime=vi.hoisted(()=>({values:[] as unknown[],cursor:0,effects:[] as {run:()=>void|(()=>void);deps:unknown[]}[],locale:'en',zone:'UTC',url:'/calendar'}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:(initial:unknown)=>{const index=runtime.cursor++;if(!(index in runtime.values))runtime.values[index]=typeof initial==='function'?initial():initial;return[runtime.values[index],(value:unknown)=>runtime.values[index]=typeof value==='function'?value(runtime.values[index]):value];},useEffect:(run:()=>void|(()=>void),deps:unknown[])=>runtime.effects.push({run,deps})}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:runtime.locale,t:getTranslations(runtime.locale as 'en'|'zh')})}));
vi.mock('@/lib/timezone',()=>({localTz:()=>runtime.zone}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URL(runtime.url,'https://example.test').searchParams}));
vi.mock('@/components/RelatedPages',()=>({default:()=>null}));
import Page from '@/app/calendar/page';
function render(){runtime.cursor=0;runtime.effects=[];const page=Page();const child=page.type===Suspense?page.props.children as ReactElement:page;const tree=page.type===Suspense?(child.type as ()=>ReactElement)():page;return{tree,html:renderToStaticMarkup(tree)};}
function buttons(node:ReactNode):{[key:string]:unknown}[]{if(Array.isArray(node))return node.flatMap(buttons);if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type==='button'?[node.props]:[]),...buttons(node.props.children as ReactNode),...buttons(node.props.action as ReactNode)];}
const effect=()=>runtime.effects.find(e=>e.deps.length===6)!.run();
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const payload=(date:string)=>({data:[{date,gameCount:1,games:[{gameId:'0022500001',homeTricode:'BOS',awayTricode:'NYK',gameStatus:3,homeScore:100,awayScore:90}]}]});
beforeEach(()=>{runtime.values=[];runtime.locale='en';runtime.zone='UTC';runtime.url='/calendar';vi.stubGlobal('window',{get location(){return new URL(runtime.url,'https://example.test');},history:{replaceState:vi.fn((_data:unknown,_unused:string,url:string)=>{runtime.url=url;})}});vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-01T12:00Z'));vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it.each(['en','zh'])('native date links and month controls are labeled %s',async locale=>{
 runtime.locale=locale;vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>payload('2026-03-03')} as Response);
 render();runtime.effects[0].run();render();effect();await settle();const{html}=render();expect(html).toContain('2025-26');expect(html).toContain(locale==='zh'?'上个月':'Previous month');expect(html).toContain('href="/?date=2026-03-03"');expect(html).not.toContain(locale==='zh'?'全明星赛':'All-Star Break');
});
it('month changes immediately hide previous summary and late responses cannot overwrite newer month',async()=>{
 let finishOld!:(r:Response)=>void;vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>finishOld=resolve)).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-04-02')} as Response);
 render();runtime.effects[0].run();let view=render();const cleanup=effect();const next=buttons(view.tree).find(b=>b['aria-label']==='Next month')!;(next.onClick as ()=>void)();view=render();expect(view.html).not.toContain('2026-03-03');if(typeof cleanup==='function')cleanup();effect();await settle();finishOld({ok:true,json:async()=>payload('2026-03-03')} as Response);await settle();view=render();expect(view.html).toContain('2026-04-02');expect(view.html).not.toContain('2026-03-03');
});
it('failed next month never retains old counts and retry recovers same month',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-03-03')} as Response).mockResolvedValueOnce({ok:false} as Response).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-04-02')} as Response);
 render();runtime.effects[0].run();render();effect();await settle();let view=render();(buttons(view.tree).find(b=>b['aria-label']==='Next month')!.onClick as ()=>void)();render();effect();await settle();view=render();expect(view.html).toContain('role="alert"');expect(view.html).not.toContain('2026-03-03');(buttons(view.tree).find(b=>b.children==='Retry')!.onClick as ()=>void)();render();effect();await settle();expect(render().html).not.toContain('role="alert"');expect(render().html).toContain('2026-04-02');
});

function elements(node:ReactNode):Record<string,unknown>[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!isValidElement<Record<string,unknown>>(node))return[];
 return[node.props,...elements(node.props.children as ReactNode),...elements(node.props.action as ReactNode)];
}
it.each(['en','zh'])('compact %s calendar cells keep full date navigation and desktop game previews',async locale=>{
 runtime.locale=locale;
 const game=payload('2026-03-03').data[0].games[0];
 const games=Array.from({length:15},(_,index)=>({...game,gameId:String(225000001+index).padStart(10,'0')}));
 vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({data:[{date:'2026-03-03',gameCount:15,games}]})} as Response);
 render();runtime.effects[0].run();render();effect();await settle();
 const view=render();
 const link=elements(view.tree).find(node=>node.href==='/?date=2026-03-03')!;
 expect(link['aria-label']).toBe(`2026-03-03 · 15 ${locale==='zh'?'场已列比赛':'listed games'}`);
 expect(link.className).toContain('min-w-0');
 expect(link.className).toContain('text-center sm:text-left');
 const children=elements(link.children as ReactNode);
 const compact=children.find(node=>String(node.className).includes('sm:hidden'))!;
 expect(compact.className).toContain('whitespace-nowrap');
 expect(compact['aria-hidden']).toBe('true');
 expect(compact.children).toEqual([15,locale==='zh'?'场':'']);
 const desktop=children.find(node=>node.className==='hidden sm:block')!;
 const preview=renderToStaticMarkup(desktop.children as ReactNode);
 expect(preview).toContain('NYK');expect(preview).toContain('BOS');expect(preview).toContain('90');expect(preview).toContain('100');expect(preview).toContain('+13');
 expect(view.html).toContain(locale==='zh'?'点击日期查看当天全部比赛':'Tap a date for all games');
 for(const label of locale==='zh'?['上个月','下个月']:['Previous month','Next month']){
  const control=buttons(view.tree).find(button=>button['aria-label']===label)!;
  expect(control.className).toContain('min-h-[44px]');expect(control.className).toContain('min-w-[44px]');
 }
});
it.each(['en','zh'])('month navigation keeps Today reachable and restores the current month in %s',locale=>{
 runtime.locale=locale;
 let view=render();
 const next=buttons(view.tree).find(button=>button['aria-label']===(locale==='zh'?'下个月':'Next month'))!;
 (next.onClick as ()=>void)();view=render();
 expect(elements(view.tree).some(node=>String(node.className).includes('max-w-full flex-wrap'))).toBe(true);
 const today=buttons(view.tree).find(button=>button.children===(locale==='zh'?'今天':'Today'))!;
 expect(today).toBeDefined();expect(today.className).toContain('min-h-[44px]');
 (today.onClick as ()=>void)();view=render();
 expect(buttons(view.tree).some(button=>button.children===(locale==='zh'?'今天':'Today'))).toBe(false);
 expect(view.html).toContain(locale==='zh'?'2026年3月':'March 2026');
});


it.each(['en','zh'])('returning from a date restores the selected month from the history URL in %s',async locale=>{
 runtime.locale=locale;vi.setSystemTime(new Date('2026-10-04T12:00Z'));
 vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>payload('2026-11-02')} as Response);
 render();runtime.effects[0].run();let view=render();
 (buttons(view.tree).find(button=>button['aria-label']===(locale==='zh'?'下个月':'Next month'))!.onClick as ()=>void)();
 expect(runtime.url).toBe('/calendar?month=2026-11');
 const returnUrl=runtime.url;render();effect();await settle();view=render();
 expect(elements(view.tree).find(node=>node.href==='/?date=2026-11-02')).toBeDefined();
 runtime.url='/?date=2026-11-02';runtime.values=[]; // leave and discard the component
 runtime.url=returnUrl;render();runtime.effects[0].run();view=render();effect();await settle();
 expect(render().html).toContain(locale==='zh'?'2026年11月':'November 2026');
 expect(fetch).toHaveBeenLastCalledWith('/api/calendar?month=2026-11&tz=UTC',expect.objectContaining({signal:expect.any(AbortSignal)}));
});
it('deep links and reload retain the URL month across timezone hydration',()=>{
 runtime.url='/calendar?month=2026-11';runtime.zone='America/Los_Angeles';vi.setSystemTime(new Date('2026-03-01T00:30Z'));
 let view=render();expect(view.html).toContain('November 2026');runtime.effects[0].run();view=render();
 expect(view.html).toContain('November 2026');expect(view.html).toContain('America/Los_Angeles');
 runtime.values=[];render();runtime.effects[0].run();expect(render().html).toContain('November 2026');
});
it('rapid clicks replace the current entry using the latest URL while preserving unrelated query and hash',()=>{
 runtime.url='/calendar?lang=zh&tz=Asia%2FShanghai&tag=a&tag=b#schedule';
 render();runtime.effects[0].run();const view=render();
 const next=buttons(view.tree).find(button=>button['aria-label']==='Next month')!.onClick as ()=>void;
 next();next();next(); // same rendered handler, before another React render
 expect(runtime.url).toBe('/calendar?lang=zh&tz=Asia%2FShanghai&tag=a&tag=b&month=2026-06#schedule');
 expect(window.history.replaceState).toHaveBeenCalledTimes(3);
 expect(window.history.replaceState).toHaveBeenLastCalledWith(null,'',runtime.url);
 expect(render().html).toContain('June 2026');
});
it('Back and Forward URL changes are rendered without resetting or rewriting history',()=>{
 runtime.url='/calendar?month=2026-11';render();runtime.effects[0].run();expect(render().html).toContain('November 2026');
 runtime.url='/calendar?month=2025-12';expect(render().html).toContain('December 2025');
 runtime.url='/calendar?month=2026-11';expect(render().html).toContain('November 2026');
 expect(window.history.replaceState).not.toHaveBeenCalled();
});
it('Today replaces the selected month with the browser-timezone month and survives reload',()=>{
 runtime.url='/calendar?month=2026-11&lang=zh&tz=UTC#schedule';runtime.zone='America/Los_Angeles';vi.setSystemTime(new Date('2026-03-01T00:30Z'));
 render();runtime.effects[0].run();let view=render();
 (buttons(view.tree).find(button=>button.children==='Today')!.onClick as ()=>void)();
 expect(runtime.url).toBe('/calendar?month=2026-02&lang=zh&tz=UTC#schedule');
 expect(render().html).toContain('February 2026');
 runtime.values=[];render();runtime.effects[0].run();view=render();
 expect(view.html).toContain('February 2026');expect(buttons(view.tree).some(button=>button.children==='Today')).toBe(false);
});
it.each(['month=2026-13','month=2026-00','month=2026-2','month=0000-01','month=2026-11&month=2026-12','month=javascript%3Aalert(1)'])('invalid or duplicate query %s falls back to the local month',query=>{
 runtime.url=`/calendar?${query}`;runtime.zone='America/Los_Angeles';vi.setSystemTime(new Date('2026-03-01T00:30Z'));
 render();runtime.effects[0].run();expect(render().html).toContain('February 2026');
 expect(window.history.replaceState).not.toHaveBeenCalled();
});
it('query-only navigation hides old counts immediately and aborts its pending response',async()=>{
 let finishOld!:(r:Response)=>void;
 vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>finishOld=resolve)).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-12-02')} as Response);
 runtime.url='/calendar?month=2026-11';render();runtime.effects[0].run();render();const cleanup=effect();
 runtime.url='/calendar?month=2026-12';let view=render();expect(view.html).not.toContain('2026-11-02');
 if(typeof cleanup==='function')cleanup();effect();await settle();finishOld({ok:true,json:async()=>payload('2026-11-02')} as Response);await settle();
 view=render();expect(view.html).toContain('2026-12-02');expect(view.html).not.toContain('2026-11-02');
 expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
});
