import type { Metadata, Viewport } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import BackToTop from "@/components/BackToTop";
import SiteFooter from "@/components/SiteFooter";
import InstallPrompt from "@/components/InstallPrompt";
import OnlineStatus from "@/components/OnlineStatus";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";
import SwRegister from "@/components/SwRegister";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ToastProvider } from "@/components/ToastProvider";
import ThemeScript from "@/components/ThemeScript";
import SpeculationRules from "@/components/SpeculationRules";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

const firaSans = Fira_Sans({
  variable: "--font-geist-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-geist-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: {
      default: t.meta.siteTitle,
      template: t.meta.siteTitleTemplate,
    },
    description: t.meta.siteDescription,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "NBA Tracker",
    },
    openGraph: {
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      siteName: "NBA Tracker",
      url: "https://nba.xpy.me",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      alternateLocale: locale === "zh" ? ["en_US"] : ["zh_CN"],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "NBA Tracker",
      description: t.meta.twitterDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
    metadataBase: new URL("https://nba.xpy.me"),
    alternates: {
      canonical: "/",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // System-aware theme color — ThemeScript can still override at first paint
  // (per stored preference), but this is the right default before its JS runs.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060912" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <SpeculationRules />
        {/* Warm up the connection to cdn.nba.com before the first <img>
            request — team logos and player headshots ship from here on
            every page, so preconnect shaves ~100-300ms TTFB on first paint. */}
        <link rel="preconnect" href="https://cdn.nba.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.nba.com" />
      </head>
      <body className="min-h-full flex flex-col pb-14 sm:pb-0">
        {/* Scroll-driven progress indicator — pure CSS, no JS listener */}
        <div className="scroll-progress-rail" aria-hidden="true" />
        <LocaleProvider initialLocale={locale}>
          <ToastProvider>
          {/* Skip to main content for accessibility */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg">
            {t.nav.skipToContent}
          </a>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "WebApplication",
                  name: "NBA Tracker",
                  description: t.meta.siteDescription,
                  applicationCategory: "SportsApplication",
                  operatingSystem: "Any",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                  author: { "@type": "Person", name: "FXY", url: "https://www.xpy.me" },
                },
                // WebSite + SearchAction — eligible for the Google "sitelinks
                // search box" treatment in SERP, letting users search the
                // site directly from search results.
                {
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "NBA Tracker",
                  url: "https://nba.xpy.me",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://nba.xpy.me/search?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ]),
            }}
          />
          <Navbar />
          <main id="main-content" className="flex-1 relative">
            {/* Global aurora mesh — visible behind every page, gives glass tiles something to refract.
                Perf: changed from `fixed` (composites with every scroll on slow GPUs) to a static
                absolute element scoped to top 70vh so the browser can paint it once and forget. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[70vh] bg-mesh-aurora pointer-events-none -z-10"
              style={{ willChange: "auto" }}
            />
            {children}
          </main>
          <SiteFooter />
          <MobileNav />
          <BackToTop />
          <InstallPrompt />
          <OnlineStatus />
          <WebVitalsReporter />
          <CloudflareAnalytics />
          <SwRegister />
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
