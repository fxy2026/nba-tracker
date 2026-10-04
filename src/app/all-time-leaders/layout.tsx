import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All-Time NBA Leaders · Career PPG, RPG, APG",
  description: "Curated static NBA career reference: up to 25 included records per category, with career averages, available totals and recorded year spans. No automatic updates or verified statistics as-of date.",
  openGraph: {
    title: "All-Time NBA Leaders",
    description: "Curated static career averages, available totals and recorded year spans; rankings cover included records only.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
