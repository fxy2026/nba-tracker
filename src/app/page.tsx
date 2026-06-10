import type { Metadata } from "next";
import { formatDate } from "@/lib/api";
import HomeClient from "@/components/HomeClient";
import DailyIconicPick from "@/components/DailyIconicPick";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

// Dynamic page — reads searchParams for date navigation
export const dynamic = "force-dynamic";

// ?date= variants canonicalize to the bare homepage
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NBA Tracker",
  alternateName: "NBATracker",
  url: "https://nba.xpy.me",
  description:
    "Live NBA scores, player stats, schedules, standings, playoff brackets, awards races, and 35+ basketball analytics views. Independent fan project, not affiliated with the NBA.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://nba.xpy.me/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
  publisher: {
    "@type": "Organization",
    name: "NBA Tracker",
    url: "https://nba.xpy.me",
  },
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = formatDate(new Date());
  const initialDate = params.date || today;
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* JSON-LD structured data for Google rich snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <h1 className="sr-only">{t.meta.siteTitle}</h1>
      <HomeClient initialDate={initialDate} />
      <DailyIconicPick />
    </div>
  );
}
