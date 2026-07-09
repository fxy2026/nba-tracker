import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDate, getTodayScoreboard, type ScheduleGame } from "@/lib/api";
import HomeClient from "@/components/HomeClient";
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

// SSR only the small ET-today scoreboard so the home page paints real GameCards
// instead of a skeleton. Mirrors /api/games's ET-today branch (route.ts:74-90).
// Note: this is ET-today; a Beijing user's local "today" may differ — HomeClient
// re-fetches client-side to correct the tz, but US/aligned users get a warm paint.
// Non-today dates are deliberately NOT SSR'd: getGamesByDate would pull the full
// ~11MB schedule and block TTFB/LCP on cold lambdas for every ?date= entry, so
// dated views fall through to GamesList's own client fetch instead.
async function getInitialGames(): Promise<ScheduleGame[]> {
  try {
    const liveGames = await getTodayScoreboard();
    return liveGames.map((g) => ({
      gameId: g.gameId,
      gameCode: g.gameCode,
      gameStatus: g.gameStatus,
      gameStatusText: g.gameStatusText,
      gameDateTimeUTC: g.gameTimeUTC,
      homeTeam: { ...g.homeTeam, teamSlug: "", wins: g.homeTeam.wins || 0, losses: g.homeTeam.losses || 0, seed: g.homeTeam.seed || 0 },
      awayTeam: { ...g.awayTeam, teamSlug: "", wins: g.awayTeam.wins || 0, losses: g.awayTeam.losses || 0, seed: g.awayTeam.seed || 0 },
      seriesText: g.seriesText,
      gameLeaders: g.gameLeaders,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = formatDate(new Date());
  const initialDate = params.date || today;
  // Only SSR the small today scoreboard; non-today dates short-circuit to null so
  // the 11MB getFullSchedule never blocks the shell (GamesList client-fetches the
  // dated view from /api/games instead).
  const ssrGames = initialDate === today ? await getInitialGames() : null;
  // Empty array == fetch failure or genuinely no SSR data → pass undefined so
  // GamesList falls back to its client fetch + skeleton rather than flashing an
  // empty state. A populated set skips both the skeleton and the initial round-trip.
  const initialGames = ssrGames && ssrGames.length > 0 ? ssrGames : undefined;
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
      {/* Offseason-only hero. Self-guards to null in-season BEFORE any await, so
          the in-season home layout is byte-identical to before. Streams in above
          the scoreboard so its ESPN transaction/news fetches never block TTFB. */}
      <Suspense fallback={null}>
        <OffseasonHero />
      </Suspense>
      <HomeClient initialDate={initialDate} initialGames={initialGames} initialIsToday={initialDate === today} />
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
