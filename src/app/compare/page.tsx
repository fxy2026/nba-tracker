import type { Metadata } from "next";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import CompareClient from "./CompareClient";

interface PageProps {
  searchParams: Promise<{ p1?: string; p2?: string; p3?: string }>;
}

function lookupName(id: string | undefined): string | null {
  if (!id) return null;
  if (id.includes("-")) {
    const s = ICONIC_SEASONS.find((x) => x.id === id);
    return s ? `${s.name} (${s.season})` : null;
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const legend = ALL_TIME_LEADERS.find((p) => p.personId === numId && !p.active);
  if (legend) return legend.name;
  // Active players aren't in any sync dataset on the server — fall back to
  // generic "Player N" rather than blocking on a BDL roundtrip for SEO meta.
  return null;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { p1, p2, p3 } = await searchParams;
  const n1 = lookupName(p1);
  const n2 = lookupName(p2);
  const n3 = lookupName(p3);

  // When both sides resolve, mint a per-comparison OG image so social shares
  // show the players + their numbers. p3 is forwarded as-is — the OG route
  // falls back to the 2-way card when it can't resolve it. Otherwise the
  // static /api/og/compare fallback (without p1/p2) returns a generic cover.
  const ogUrl = p1 && p2
    ? `/api/og/compare?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}${p3 ? `&p3=${encodeURIComponent(p3)}` : ""}`
    : `/api/og/compare`;

  const matchup = n1 && n2 ? (n3 ? `${n1} vs ${n2} vs ${n3}` : `${n1} vs ${n2}`) : null;
  const title = matchup ?? "Player Compare";
  const description = matchup
    ? `Side-by-side career stats, trophies, era context and radar overlay for ${matchup}.`
    : "Compare any two NBA players — active stars, retired legends, or peak iconic seasons.";

  return {
    title,
    description,
    alternates: { canonical: "/compare" },
    openGraph: {
      title,
      description,
      images: [ogUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default function ComparePage() {
  return <CompareClient />;
}
