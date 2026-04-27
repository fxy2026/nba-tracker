import type { Metadata } from "next";
import { ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";

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
  title: "NBA Tracker - Live Scores & Box Scores",
  description: "NBA basketball game scores, player stats, and box scores",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NBA Tracker",
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
        <Navbar />
        <main className="flex-1">
          <ViewTransition>{children}</ViewTransition>
        </main>
        <footer className="border-t border-border py-6 text-center text-xs text-text-secondary hidden sm:block">
          <span>NBA Tracker &middot; Made by </span>
          <a href="https://www.xpy.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">FXY</a>
          <span> &middot; Data from NBA.com &middot; Not affiliated with NBA</span>
        </footer>
        <MobileNav />
      </body>
    </html>
  );
}
