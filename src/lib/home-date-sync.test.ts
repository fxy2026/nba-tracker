import { beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
const state = vi.hoisted(() => ({ date: null as string | null, tz: null as string | null, effects: [] as { run: () => void; deps?: unknown[] }[], setDate: vi.fn(), push: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [initial, typeof initial === "string" ? state.setDate : vi.fn()],
  useEffect: (run: () => void, deps?: unknown[]) => state.effects.push({ run, deps }),
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: (key:string) => key === "tz" ? state.tz : state.date }), useRouter: () => ({ push: state.push }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/lib/timezone", () => ({ localTz: () => "UTC", dateInTz: () => "2026-10-02" }));
import HomeClient from "@/components/HomeClient";
beforeEach(() => { state.effects = []; state.tz=null; state.setDate.mockClear(); });
it("wires the real HomeClient URL dependency for explicit dates and Back/Forward to bare Home", () => {
  for (const date of ["2026-06-14", "2026-10-04", "2026-06-14", null]) {
    state.date = date; state.effects = [];
    HomeClient({ initialDate: "2026-10-02", initialIsToday: true });
    const sync = state.effects.find((effect) => effect.deps?.length === 2 && effect.deps[0] === date);
    expect(sync).toBeDefined(); sync!.run();
    expect(state.setDate).toHaveBeenLastCalledWith(date ?? "2026-10-02");
  }
});

it('explicit timezone follows URL changes and scopes both date and game navigation',()=>{
 for(const tz of ['America/New_York','Asia/Shanghai','invalid-zone',null]){
  state.date='2026-03-01';state.tz=tz;state.effects=[];
  const tree=HomeClient({initialDate:'2026-03-01',initialIsToday:false,initialGames:[]});
  const chosen=tz==='invalid-zone'||tz===null?undefined:tz;
  const sync=state.effects.find(effect=>effect.deps?.length===2&&effect.deps[0]===state.date);expect(sync?.deps?.[1]).toBe(chosen);
  const children=tree.props.children;const games=children.find((child:unknown)=>child&&typeof child==='object'&&'props'in child&&(child.props as Record<string,unknown>).isToday!==undefined);expect(games.props.timeZone).toBe(chosen);if(chosen&&chosen!=='America/New_York')expect(games.props.initialGames).toBeUndefined();
 }
});
