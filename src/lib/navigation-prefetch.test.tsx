import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import en from '@/locales/en';
vi.mock('next/navigation',()=>({usePathname:()=> '/',useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:'en',t:en})}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:(initial:unknown)=>[typeof initial==='function'?initial():initial,vi.fn()],useEffect:()=>{},useRef:(value:unknown)=>({current:value}),useMemo:(fn:()=>unknown)=>fn()}));
import SpeculationRules from '@/components/SpeculationRules';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';
function nodes(node:ReactNode):ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return [];return [node as ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
it('speculation has no unconditional URL list while preserving existing intent and exclusions',()=>{
 const script=SpeculationRules();expect(script.props.type).toBe('speculationrules');const rules=JSON.parse(script.props.dangerouslySetInnerHTML.__html);
 expect(rules.prefetch).toEqual([{source:'document',where:{and:[{href_matches:'/*'},{not:{href_matches:'/admin*'}},{not:{href_matches:'/api/*'}},{not:{href_matches:'/game/*'}},{not:{href_matches:'/player/*'}},{not:{href_matches:'/team/*'}}]},eagerness:'moderate'}]);
 expect(rules.prerender).toEqual([{source:'document',where:{or:[{href_matches:'/game/*'},{href_matches:'/player/*'},{href_matches:'/team/*'}]},eagerness:'moderate'}]);
 expect(JSON.stringify(rules)).not.toContain('"urls"');
});
it('the five primary navigation links keep hrefs and no forced eager prefetch',()=>{
 const links=nodes(Navbar()).filter(node=>typeof node.props.href==='string');
 for(const href of ['/','/calendar','/stats','/standings','/news']){
  const primary=links.find(link=>link.key===href);expect(primary?.props.href).toBe(href);expect(primary?.props.prefetch).toBe(false);expect(primary?.props.onClick).toBeUndefined();expect(primary?.props.tabIndex).not.toBe(-1);
 }
 // Logo keeps its previous framework-default policy; this is not a global ban.
 const logo=links.find(link=>link.props.href==='/'&&link.key===null);expect(logo).toBeDefined();expect(logo?.props.prefetch).toBeUndefined();
});

it('the five permanent mobile links preserve destinations, labels and active navigation without prefetch',()=>{
 const links=nodes(MobileNav()).filter(node=>typeof node.props.href==='string');
 expect(links).toHaveLength(5);
 const expected=[['/',en.nav.today],['/calendar',en.nav.calendar],['/stats',en.nav.stats],['/news','News'],['/standings',en.nav.standings]];
 expected.forEach(([href,label],index)=>{
  const link=links[index];expect(link.props.href).toBe(href);expect(link.props.prefetch).toBe(false);
  expect(link.props.onClick).toBeUndefined();expect(link.props.tabIndex).not.toBe(-1);
  expect(link.props['aria-current']).toBe(href==='/'?'page':undefined);
  expect(nodes(link.props.children as ReactNode).some(node=>node.props.children===label)).toBe(true);
 });
});
