import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { getAccolades } from "./playerAccolades";
const { snapshot, locale }=vi.hoisted(()=>({snapshot:vi.fn(),locale:vi.fn()}));
vi.mock("@/lib/api",async original=>({...await original<typeof import("./api")>(),getPlayerIndexSnapshot:snapshot}));
vi.mock("@/lib/locale",()=>({getLocale:locale}));
const base={personId:2544,firstName:"Sample",lastName:"Veteran",slug:"sample",teamId:1610612747,teamAbbr:"LAL",teamCity:"Los Angeles",teamName:"Lakers",jersey:"23",position:"F",height:"6-9",weight:"250",college:"",country:"USA",draftYear:2003,draftRound:1,draftNumber:1,fromYear:"2003",toYear:"2025",pts:30,reb:8,ast:7};
beforeEach(()=>locale.mockResolvedValue("en"));
function nodes(node:ReactNode): React.ReactElement<Record<string,unknown>>[]{
 if(Array.isArray(node))return node.flatMap(nodes);
 if(!isValidElement<{children?:ReactNode}>(node))return [];
 return [node as React.ReactElement<Record<string,unknown>>,...nodes(node.props.children)];
}
function text(node:ReactNode):string{
 if(Array.isArray(node))return node.map(text).join("");
 if(typeof node==="string"||typeof node==="number")return String(node);
 return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):"";
}
async function page(position:string,pts:unknown=30,language="en"){
 locale.mockResolvedValue(language);snapshot.mockResolvedValue({players:[{...base,position,pts}],provenance:{source:"bundled-archive",season:"2025-26",stale:true,retrievedAt:null}});
 const {default:Page}=await import("@/app/player/[id]/page");return Page({params:Promise.resolve({id:"2544"})});
}
it.each(["C","G","F"])("does not fabricate shooting breakdown for position %s",async position=>{
 const tree=await page(position);expect(text(tree)).toContain("This source does not provide");
 const all=nodes(tree);expect(all.some(e=>typeof e.type==="function"&&e.type.name==="ScoringDnaTile")).toBe(false);
 expect(all.some(e=>typeof e.props.title==="string"&&/^(2PT|3PT|FT): ~/.test(String(e.props.title)))).toBe(false);
});
it("a high-PPG veteran does not generate lifetime totals or a decade scoring claim",async()=>{
 const tree=await page("F");const content=text(tree);
 for(const claim of ["Career Milestones","Estimated Total","career points","Decade-long","48,300"])expect(content).not.toContain(claim);
 const all=nodes(tree);expect(all.some(e=>typeof e.type==="function"&&e.type.name==="CountUpNumber"&&e.props.value===30)).toBe(true);
 expect(content).toContain("2025-26 · archived snapshot");
 // Existing honors input remains untouched; this tests preservation, not truth of the curated counts.
 expect(all.some(e=>e.props.playerId===2544&&JSON.stringify(e.props.accolades)===JSON.stringify(getAccolades(2544)))).toBe(true);
});
it.each([null,0])("null/zero PPG %s does not invent split or totals in either locale",async pts=>{
 for(const language of ["en","zh"]){const tree=await page("G",pts,language);const content=text(tree);
 expect(content).toContain(language==="zh"?"此数据源未提供两分、三分和罚球得分构成":"This source does not provide");
 expect(content).not.toContain("Career Milestones");expect(content).not.toContain("生涯里程碑");expect(content).not.toContain("估算总得分");
 if(pts===0)expect(nodes(tree).some(e=>typeof e.type==="function"&&e.type.name==="CountUpNumber"&&e.props.value===0)).toBe(true);
 }
});
