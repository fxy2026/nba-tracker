import type { Metadata } from "next";
import Link from "next/link";
import { Info, ExternalLink, Mail, Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "About NBA Tracker",
  description: "About NBA Tracker — an independent, open-source NBA statistics dashboard built by a basketball fan. Not affiliated with the NBA. Data sourced from official NBA public APIs.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="About"
        icon={Info}
        title="About NBA Tracker"
        subtitle="An independent, fan-built dashboard for everything NBA"
      />

      <div className="space-y-5">
        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Trophy size={16} className="text-accent-amber" />
            What this is
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            NBA Tracker is a personal project that surfaces live scores, league standings,
            player and team statistics, playoff brackets, awards races, and 30+ other views
            on the current NBA season. Everything is computed from the league&apos;s public
            data feeds — no scraping of editorial content or paid content. The goal is a
            clean, dense, fast UI that benchmarks against major sports sites.
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2">Data sources</h2>
          <ul className="text-sm text-text-secondary leading-relaxed space-y-1.5 list-disc list-inside">
            <li>
              <span className="font-mono text-text-primary">cdn.nba.com</span> — the NBA&apos;s
              public static data CDN: schedule, live scoreboard, box scores, play-by-play, player index, team logos.
            </li>
            <li>
              Aggregate analytics (power rankings, streaks, momentum, tier list, etc) are
              derived in this project — not provided by the NBA.
            </li>
          </ul>
        </section>

        <section className="glass-tile p-5 ring-1 ring-accent-amber/30 bg-accent-amber/[0.03]">
          <h2 className="text-base font-semibold text-accent-amber mb-2">Disclaimer</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            NBA Tracker is <strong>not affiliated with, endorsed by, or sponsored by</strong> the National
            Basketball Association (NBA) or any of its teams. The NBA name, team names, logos, and
            related marks are trademarks of NBA Properties, Inc. and the respective teams. This site
            is a free, ad-free fan project provided as-is for informational and entertainment purposes only.
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2">Technology</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4.
            Server components for SSR data fetching, client components for interactivity,
            deployed on Vercel. Source data is fetched server-side and cached aggressively
            to minimize load on the NBA CDN.
          </p>
        </section>

        <section className="glass-tile p-5">
          <h2 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Mail size={16} className="text-accent" />
            Contact
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Found a bug or have a feature request? The project is open to feedback. Reach out via the
            GitHub repository:
            {" "}
            <a
              href="https://github.com/fxy2026/nba-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <ExternalLink size={14} /> github.com/fxy2026/nba-tracker
            </a>
          </p>
        </section>

        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-sm text-text-secondary hover:text-accent transition-colors font-mono uppercase tracking-[0.15em]"
          >
            ← Back to today&apos;s games
          </Link>
        </div>
      </div>
    </div>
  );
}
