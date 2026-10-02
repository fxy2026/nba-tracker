import { beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
const state = vi.hoisted(() => ({ date: null as string | null, effects: [] as { run: () => void; deps?: unknown[] }[], setDate: vi.fn(), push: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [initial, typeof initial === "string" ? state.setDate : vi.fn()],
  useEffect: (run: () => void, deps?: unknown[]) => state.effects.push({ run, deps }),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => state.date }), useRouter: () => ({ push: state.push }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/lib/timezone", () => ({ localTz: () => "UTC", dateInTz: () => "2026-10-02" }));
import HomeClient from "@/components/HomeClient";
beforeEach(() => { state.effects = []; state.setDate.mockClear(); });
it("wires the real HomeClient URL dependency for explicit dates and Back/Forward to bare Home", () => {
  for (const date of ["2026-06-14", "2026-10-04", "2026-06-14", null]) {
    state.date = date; state.effects = [];
    HomeClient({ initialDate: "2026-10-02", initialIsToday: true });
    const sync = state.effects.find((effect) => effect.deps?.length === 1 && effect.deps[0] === date);
    expect(sync).toBeDefined(); sync!.run();
    expect(state.setDate).toHaveBeenLastCalledWith(date ?? "2026-10-02");
  }
});
