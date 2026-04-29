import type { Metadata } from "next";
import { ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import BackToTop from "@/components/BackToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "NBA Tracker — 实时比分 · 球员数据 · 赛程日历",
    template: "%s | NBA Tracker",
  },
  description: "NBA 实时比分、Box Score、投篮图、球员数据、伤病报告、交易动态，一站式篮球数据追踪。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NBA Tracker",
  },
  openGraph: {
    title: "NBA Tracker — 实时比分 · 球员数据 · 赛程日历",
    description: "NBA 实时比分、Box Score、投篮图、球员数据、伤病报告、交易动态，一站式篮球数据追踪。",
    siteName: "NBA Tracker",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "NBA Tracker",
    description: "NBA 实时比分与球员数据追踪",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-14 sm:pb-0">
        {/* Skip to main content for accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "NBA Tracker",
              description: "NBA 实时比分、Box Score、投篮图、球员数据、伤病报告、交易动态",
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
          <span>NBA Tracker &middot; Made with &#10084; by </span>
          <a href="https://www.xpy.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">FXY</a>
          <span> &middot; Data from NBA.com &middot; Not affiliated with NBA</span>
          <br />
          <span className="text-text-secondary/50 text-[10px]">
            Open source on <a href="https://github.com/fxy2026/nba-tracker" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GitHub</a>
          </span>
        </footer>
        <MobileNav />
        <BackToTop />
      </body>
    </html>
  );
}
