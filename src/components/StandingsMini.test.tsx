import React, { type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const runtime = vi.hoisted(() => ({
  locale: "en" as "en" | "zh",
  states: [] as unknown[],
  index: 0,
}));

// Seed the already-loaded tile without making any standings API requests.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => [runtime.states[runtime.index++], vi.fn()],
}));
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale) }),
}));

import StandingsMini from "./StandingsMini";

beforeEach(() => {
  runtime.locale = "en";
  runtime.index = 0;
  runtime.states = [
    [{ tricode: "BOS", teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", wins: 3, losses: 1 }],
    [{ tricode: "OKC", teamId: 1610612760, teamName: "Thunder", teamCity: "Oklahoma City", wins: 4, losses: 0 }],
    null,
    false,
  ];
});

it.each(["en", "zh"] as const)("links the localized full standings CTA to standings in %s", locale => {
  runtime.locale = locale;
  const html = renderToStaticMarkup(<StandingsMini />);
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
    .map(([, href, label]) => ({ href, label }));

  expect(links).toContainEqual({ href: "/standings", label: getTranslations(locale).standingsMini.fullStandings });
  expect(links).not.toContainEqual(expect.objectContaining({ href: "/stats" }));
  expect(links).toContainEqual({ href: "/team/BOS", label: "BOS" });
  expect(links).toContainEqual({ href: "/team/OKC", label: "OKC" });
});
