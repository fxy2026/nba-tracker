import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ locale: "en", tab: "players" }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => [runtime.tab, (tab: string) => { runtime.tab = tab; }],
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
import StatsPage from "@/app/stats/page";

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}

beforeEach(() => { runtime.locale = "en"; runtime.tab = "players"; });

it.each(["en", "zh"])("keeps all four %s stats selectors usable with a mobile grid and unchanged selection", locale => {
  runtime.locale = locale;
  const all = nodes(StatsPage());
  const controls = all.filter(node => node.type === "button");
  expect(controls).toHaveLength(4);
  expect(all.find(node => String(node.props.className).includes("grid-cols-2"))?.props.className)
    .toContain("w-full sm:flex sm:w-fit");
  const labels = locale === "zh" ? ["球员榜", "球队排名", "奖项", "MVP 榜"] : ["Player Leaders", "Team Standings", "Awards", "MVP Ladder"];
  controls.forEach((button, index) => {
    expect(button.props.className).toContain("min-h-[44px]");
    expect(button.props.className).toContain("whitespace-nowrap");
    expect(button.props.children).toContain(labels[index]);
    const icon = nodes(button.props.children as ReactNode)[0];
    expect(icon.props.className).toBe("shrink-0");
    (button.props.onClick as () => void)();
    expect(runtime.tab).toBe(["players", "teams", "awards", "mvp"][index]);
    const selected = nodes(StatsPage()).filter(node => node.type === "button" && node.props["aria-pressed"]);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.children).toContain(labels[index]);
  });
});
