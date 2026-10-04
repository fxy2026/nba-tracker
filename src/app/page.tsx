import { selectedDateFromUrl } from "@/lib/schedule-navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDate } from "@/lib/api";
import HomeGames, { HomeGamesLoading } from "@/components/HomeGames";
import HomePlayerSearch from "@/components/HomePlayerSearch";
import DailyIconicPick from "@/components/DailyIconicPick";
import BestOfNightCard from "@/components/BestOfNightCard";
import OffseasonHero from "@/components/OffseasonHero";
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
  const initialDate = selectedDateFromUrl(params.date ?? null, today);
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
      <HomePlayerSearch />
      <Suspense fallback={<HomeGamesLoading locale={locale} />}>
        <HomeGames
          initialDate={initialDate}
          initialIsToday={initialDate === today}
          afterGames={
            // Keep the selected games first in the DOM on every date/timezone.
            // The server-only hero still self-guards to null in-season and streams
            // without blocking the shell on transaction/news fetches.
            <Suspense fallback={null}>
              <OffseasonHero />
            </Suspense>
          }
        />
      </Suspense>
      {/* Daily-changing "best of last night" precedes the evergreen iconic pick
          so the top of the page stays fresh content a returner checks daily.
          Streams in after the shell — schedule/box-score fetches never block. */}
      <Suspense fallback={null}>
        <BestOfNightCard />
      </Suspense>
      <DailyIconicPick />
    </div>
  );
}
