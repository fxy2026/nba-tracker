import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
const runtime=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,locale:'en'}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:(initial:unknown)=>{const i=runtime.cursor++;if(!(i in runtime.slots))runtime.slots[i]=typeof initial==='function'?initial():initial;return [runtime.slots[i],(value:unknown)=>{runtime.slots[i]=typeof value==='function'?value(runtime.slots[i]):value;}];},useEffect:()=>{},useCallback:(fn:unknown)=>fn,useRef:(value:unknown)=>({current:value})}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams()}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:runtime.locale,t:runtime.locale==='zh'?zh:en})}));
vi.mock('@/components/ToastProvider',()=>({useToast:()=>({toast:vi.fn()})}));
import CompareClient from '@/app/compare/CompareClient';
const archive={source:'bundled-archive',season:'2025-26',stale:true,retrievedAt:null};
const player={personId:2544,firstName:'LeBron',lastName:'James',teamAbbr:'LAL',teamName:'Lakers',teamCity:'Los Angeles',jersey:'23',position:'F',pts:20.9,reb:6.1,ast:7.2,indexProvenance:archive,accolades:{championships:4,mvps:4,finalsMvps:4,allStars:21,allNba:21}};
const kyrie={...player,personId:202681,firstName:'Kyrie',lastName:'Irving',pts:null,reb:null,ast:null,accolades:undefined};
const curry={...player,personId:201939,firstName:'Stephen',lastName:'Curry',pts:25,reb:4,ast:5};
const tree=()=>{runtime.cursor=0;return CompareClient();};
const html=()=>renderToStaticMarkup(tree());
function nodes(node:ReactNode):ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return [];return [node as ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
beforeEach(()=>{runtime.slots=[];runtime.cursor=0;runtime.locale='en';runtime.slots[4]=kyrie;runtime.slots[5]=player;});
it.each(['en','zh'])('actual pair render keeps missing stats unknown in %s',locale=>{runtime.locale=locale;const result=html();expect(result).toContain('Irving');expect(result).toContain('2025-26');expect(result).toContain('—');expect(result).not.toContain('NaN');expect(result).not.toContain('Infinity');expect(result).not.toContain('0.0');expect(result).not.toContain('3-0');});
it.each([null,undefined])('three-way missing averages %s cannot crash',missing=>{runtime.slots[4]={...kyrie,pts:missing,reb:missing,ast:missing};runtime.slots[6]=curry;expect(()=>html()).not.toThrow();expect(html()).toContain('—');expect(html()).not.toContain('NaN');});
it('partial record retains known values without invalid radar coordinates',()=>{runtime.slots[4]={...kyrie,pts:10,reb:null,ast:2};for(const third of [null,curry]){runtime.slots[6]=third;const result=html();expect(result).toContain('—');expect(result).not.toContain('NaN');expect(result).not.toContain('Infinity');}});
it('genuine all-zero pair remains numeric and never divides by zero',()=>{runtime.slots[4]={...kyrie,pts:0,reb:0,ast:0};runtime.slots[5]={...player,pts:0,reb:0,ast:0};const result=html();expect(result).toContain('0.0');expect(result).not.toContain('NaN');expect(result).not.toContain('Infinity');});
it('third-slot pick and remove callbacks return safely between real pair and triple layouts',()=>{let slot=nodes(tree()).find(n=>n.props.compact===true);expect(slot).toBeDefined();(slot!.props.onPick as (p:unknown)=>void)(curry);expect(runtime.slots[6]).toEqual(curry);expect(()=>html()).not.toThrow();slot=nodes(tree()).find(n=>n.props.compact===true);(slot!.props.onClear as ()=>void)();expect(runtime.slots[6]).toBeNull();expect(html()).toContain('Irving');});
it('normal complete records retain calculations and explicit-zero honors',()=>{runtime.slots[4]={...player,accolades:{championships:0,mvps:0,finalsMvps:0,allStars:0,allNba:0}};runtime.slots[5]=curry;const result=html();expect(result).toContain('39.0');expect(result).not.toContain('NaN');});
it('mixed declared seasons keep values but cannot claim a categorical winner',()=>{runtime.slots[4]={...player,indexProvenance:{...archive,season:'2024-25'}};runtime.slots[5]=curry;const result=html();expect(result).toContain('2024-25');expect(result).toContain('2025-26');expect(result).not.toContain('leads');expect(result).not.toContain('NaN');});
it.each(['en','zh'])('radar mobile controls retain real RS/PO switching and accessible labels in %s',locale=>{
 runtime.locale=locale;
 runtime.slots[4]={...player,playoffPpg:30,playoffRpg:10,playoffApg:8};
 runtime.slots[5]={...curry,playoffPpg:28,playoffRpg:5,playoffApg:6};
 const controls=nodes(tree()).filter(n=>n.type==='button');
 const regular=controls.find(n=>n.props['aria-label']===(locale==='zh'?'RS · 常规赛':'RS · Regular season'))!;
 const playoffs=controls.find(n=>n.props['aria-label']===(locale==='zh'?'PO · 季后赛':'PO · Playoffs'))!;
 const share=controls.find(n=>n.props['aria-label']===(locale==='zh'?'分享对比':'Share comparison'))!;
 for(const button of [regular,playoffs,share]){
  expect(button).toBeDefined();expect(button.props.className).toContain('min-h-[44px]');expect(button.props.className).toContain('min-w-[44px]');
 }
 expect(regular.props['aria-pressed']).toBe(true);
 expect(html()).toContain('PPG 20.9-25');
 (playoffs.props.onClick as ()=>void)();
 expect(html()).toContain('PPG 30-28');
 expect(nodes(tree()).find(n=>n.props['aria-label']===(locale==='zh'?'PO · 季后赛':'PO · Playoffs'))?.props['aria-pressed']).toBe(true);
 (regular.props.onClick as ()=>void)();
 expect(html()).toContain('PPG 20.9-25');
 expect(html()).toContain('text-[14px] sm:text-[10px]');
});
