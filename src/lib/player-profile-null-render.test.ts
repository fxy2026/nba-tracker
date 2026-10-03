// Server-component tests run outside the Next.js server-only resolver.
vi.mock("server-only", () => ({}));
import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import archive from "@/data/playerindex-2025-26.json";
import type { PlayerInfo } from "./api";
const { snapshot, locale }=vi.hoisted(()=>({snapshot:vi.fn(),locale:vi.fn()}));
vi.mock("@/lib/api",async original=>({...await original<typeof import("./api")>(),getPlayerIndexSnapshot:snapshot}));
vi.mock("@/lib/locale",()=>({getLocale:locale}));
const base={personId:1,firstName:"Test",lastName:"Player",slug:"test",teamId:1610612738,teamAbbr:"BOS",teamCity:"Boston",teamName:"Celtics",jersey:"1",position:"F",height:"6-8",weight:"200",college:"",country:"",draftYear:null,draftRound:null,draftNumber:null,fromYear:"2025",toYear:"2025",pts:10,reb:5,ast:2};
const provenance={source:"bundled-archive",season:"2025-26",stale:true,retrievedAt:null};
beforeEach(()=>locale.mockResolvedValue("en"));
function elements(node:ReactNode): React.ReactElement<Record<string,unknown>>[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!isValidElement<{children?:ReactNode}>(node))return [];
 return [node as React.ReactElement<Record<string,unknown>>,...elements(node.props.children)];
}
function text(node:ReactNode):string{
 if(Array.isArray(node))return node.map(text).join("");
 if(typeof node==="string"||typeof node==="number")return String(node);
 return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):"";
}
async function page(player:unknown,peers:unknown[]=[],language="en"){
 locale.mockResolvedValue(language);snapshot.mockResolvedValue({players:[player,...peers],provenance});
 const {default:Page}=await import("@/app/player/[id]/page");
 return Page({params:Promise.resolve({id:String((player as PlayerInfo).personId)})});
}
it.each([1630169,202681,203081,1642850,1627832])("preserves actual archived player %s with unknown averages",async id=>{
 const row=archive.resultSets[0].rowSet.find(r=>r[0]===id)!;
 const tree=await page({...base,personId:id,firstName:row[2],lastName:row[1],pts:row[22],reb:row[23],ast:row[24]});
 expect(text(tree)).toContain(String(row[1]));expect(text(tree)).toContain("vs league avg —");expect(text(tree)).toContain("No eligible complete");expect(text(tree)).not.toContain("#0");
 const tiles=elements(tree).filter(e=>typeof e.type==="function"&&e.type.name==="DataStatTile");
 expect(tiles).toHaveLength(2);for(const tile of tiles){expect(tile.props.value).toBeNull();expect(tile.props.ctx).toBeNull();expect(renderToStaticMarkup(tile)).toContain("—");}
});
it.each([null,undefined])("partial missing averages %s suppress both similarity calculations",async missing=>{
 const tree=await page({...base,reb:missing},[{...base,personId:2}]);
 expect(text(tree)).toContain("No eligible complete");expect(text(tree)).not.toContain("Statistical Peers");
 const comparisons=elements(tree).filter(e=>typeof e.props.href==="string"&&String(e.props.href).includes("p2="));expect(comparisons).toHaveLength(0);
});
it("real zero renders as zero, not missing, without inventing ranking eligibility",async()=>{
 const tree=await page({...base,pts:0,reb:0,ast:0});const nodes=elements(tree);
 const counts=nodes.filter(e=>typeof e.type==="function"&&e.type.name==="CountUpNumber");expect(counts.some(e=>e.props.value===0)).toBe(true);
 for(const tile of nodes.filter(e=>typeof e.type==="function"&&e.type.name==="DataStatTile")){expect(tile.props.value).toBe(0);expect(renderToStaticMarkup(tile)).toContain('>0</span>');}
});
it("valid profile calculations retain complete peers and exclude incomplete peer records",async()=>{
 const tree=await page(base,[{...base,personId:2,firstName:"Valid"},{...base,personId:3,firstName:"Missing",ast:null}]);
 const peers=elements(tree).filter(e=>typeof e.props.href==="string"&&String(e.props.href).includes("p2="));
 expect(peers.some(e=>new URL(String(e.props.href),"https://example.test").searchParams.get("p2")==="2")).toBe(true);expect(peers.some(e=>new URL(String(e.props.href),"https://example.test").searchParams.get("p2")==="3")).toBe(false);
 expect(text(tree)).not.toContain("NaN");expect(text(tree)).toContain("vs league avg 10.0");
});
it("Chinese unknown-profile copy preserves snapshot provenance",async()=>{
 const tree=await page({...base,pts:null,reb:null,ast:null},[],"zh");expect(text(tree)).toContain("暂无符合条件的完整");expect(text(tree)).toContain("2025-26 · 存档快照");
});

it("player and indexed-range navigation remounts the heatmap selection", async () => {
 const heatmap = async (player: unknown) => elements(await page(player)).find(e => e.props.fromYear !== undefined && e.props.toYear !== undefined)!;
 const first = await heatmap({...base, personId:2544, fromYear:"2003", toYear:"2025"});
 const retired = await heatmap({...base, personId:977, fromYear:"1996", toYear:"2015"});
 const refreshed = await heatmap({...base, personId:2544, fromYear:"2003", toYear:"2026"});
 expect(first.key).toBe("2544:2003:2025");
 expect(retired.key).toBe("977:1996:2015");
 expect(refreshed.key).toBe("2544:2003:2026");
});
it.each([['en','Jokić'],['zh','Dončić']])('profile comparison CTAs use the exact player ID, not a name query %s',async(language,lastName)=>{
 const tree=await page({...base,personId:203999,lastName},[],language);
 const comparisons=elements(tree).filter(e=>typeof e.props.href==='string'&&String(e.props.href).startsWith('/compare'));
 expect(comparisons.length).toBeGreaterThanOrEqual(2);
 expect(comparisons.filter(link=>new URL(String(link.props.href),'https://example.test').searchParams.get('p1')==='203999').length).toBeGreaterThanOrEqual(2);
 for(const link of comparisons){const url=new URL(String(link.props.href),'https://example.test');expect(url.searchParams.get('q1')).toBeNull();expect(url.searchParams.get('p1')).toMatch(/^203999(?:-\d{4})?$/);}
});
