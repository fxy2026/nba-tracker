import type { Metadata, Viewport } from "next";
import { ViewTransition } from "react";
import { Fira_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import BackToTop from "@/components/BackToTop";
import { LocaleProvider } from "@/components/LocaleProvider";
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
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
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
  themeColor: "#0a0a0a",
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
    >
      <body className="min-h-full flex flex-col pb-14 sm:pb-0">
        <LocaleProvider initialLocale={locale}>
          {/* Skip to main content for accessibility */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg">
            {t.nav.skipToContent}
          </a>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "NBA Tracker",
                description: t.meta.siteDescription,
                applicationCategory: "SportsApplication",
                operatingSystem: "Any",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                author: { "@type": "Person", name: "FXY", url: "https://www.xpy.me" },
              }),
            }}
          />
          <Navbar />
          <main id="main-content" className="flex-1">
            <ViewTransition>{children}</ViewTransition>
          </main>
          <footer className="border-t border-border py-6 text-center text-xs text-text-secondary hidden sm:block">
            <span>{t.footer.madeWith}</span>
            <a href="https://www.xpy.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">FXY</a>
            <span> &middot; {t.footer.dataFrom}</span>
            <br />
            <span className="text-text-secondary/50 text-[10px]">
              {t.footer.openSource}<a href="https://github.com/fxy2026/nba-tracker" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{t.footer.github}</a>
              {" "}&middot;{" "}
              {t.footer.shortcuts}<kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[9px]">←→</kbd>{t.footer.dates}
              {" "}<kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[9px]">⌘K</kbd>{t.footer.searchKey}
              {" "}<kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[9px]">T</kbd>{t.footer.top}
            </span>
          </footer>
          <MobileNav />
          <BackToTop />
        </LocaleProvider>
      </body>
    </html>
  );
}
