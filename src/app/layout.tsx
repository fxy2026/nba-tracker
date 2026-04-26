import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA Tracker - Live Scores & Box Scores",
  description: "NBA basketball game scores, player stats, and box scores",
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
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-text-secondary">
          <span>NBA Tracker &middot; Made by </span>
          <a href="https://www.xpy.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">FXY</a>
          <span> &middot; Data from NBA.com &middot; Not affiliated with NBA</span>
        </footer>
      </body>
    </html>
  );
}
