import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";
import type { SalaryContract } from "@/lib/player-salary";

const state = vi.hoisted(() => ({ locale: "en", index: 0, loading: false, contracts: [] as SalaryContract[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: vi.fn(),
  useState: () => [state.index++ === 0 ? state.contracts : state.loading, vi.fn()],
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ t: state.locale === "zh" ? zh : en }) }));
import PlayerSalary from "./PlayerSalary";
const render = () => { state.index = 0; return renderToStaticMarkup(<PlayerSalary playerName="Arin Vale" teamAbbr="AAA" />); };
function rows(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(rows);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === "tr" && node.key !== null ? [node] : []), ...rows(node.props.children)];
}
beforeEach(() => { state.locale = "en"; state.loading = false; state.contracts = []; });

describe.each(["en", "zh"])("salary values in %s", locale => {
  it("renders localized unavailable fields alongside genuine zero, with a valid numeric season label", () => {
    state.locale = locale;
    state.contracts = [
      { season: 2025, base_salary: null, cap_hit: 0 },
      { season: 2024, base_salary: 0, cap_hit: null },
    ];
    const html = render();
    expect(html.match(new RegExp(locale === "zh" ? "暂无数据" : "Unavailable", "g"))).toHaveLength(2);
    expect(html.match(/\$0</g)).toHaveLength(2);
    expect(html).toMatch(new RegExp(`class="[^"]*text-text-secondary">${locale === "zh" ? "暂无数据" : "Unavailable"}</td>`));
    expect(html).toContain("2025-26"); expect(html).toContain("2024-25");
    expect(html).not.toMatch(/\$null|\$undefined|NaN|2025-251/);
  });
  it("preserves existing real-money formatting and hides an empty contract result", () => {
    state.locale = locale;
    expect(render()).toBe("");
    state.contracts = [{ season: 2025, base_salary: 12_000_000, cap_hit: 13_000 }];
    expect(render()).toContain("$12.0M"); expect(render()).toContain("$13K");
    state.contracts = [{ season: 2025, base_salary: 125, cap_hit: 0.5 }];
    expect(render()).toContain("$125"); expect(render()).toContain("$0.5");
  });
  it.each([undefined, "13000000", "", false, -1, NaN, Infinity, {}, []])("renders malformed legacy cached money %j as unavailable", amount => {
    state.locale = locale;
    state.contracts = [{ season: 2025, base_salary: amount, cap_hit: amount } as SalaryContract];
    const html = render();
    expect(html.match(new RegExp(locale === "zh" ? "暂无数据" : "Unavailable", "g"))).toHaveLength(2);
    expect(html).not.toContain("$");
  });
  it("keeps multiple real contracts in the same season under unique row keys", () => {
    state.locale = locale;
    state.contracts = [
      { season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000 },
      { season: 2025, base_salary: 14_000_000, cap_hit: 15_000_000 },
    ];
    state.index = 0;
    const contractRows = rows(PlayerSalary({ playerName: "Arin Vale", teamAbbr: "AAA" }));
    expect(contractRows.map(row => row.key)).toEqual(["2025:0", "2025:1"]);
    expect(render()).toContain("$12.0M"); expect(render()).toContain("$14.0M");
  });
});
