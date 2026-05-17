import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA Awards Race · MVP, ROY, DPOY, 6MOY, MIP",
  description: "Live tracking of every major NBA individual award — MVP, Rookie of the Year, Defensive Player of the Year, Sixth Man of the Year, Most Improved Player — with composite scoring derived from the official NBA player index.",
  openGraph: {
    title: "NBA Awards Race",
    description: "MVP, ROY, DPOY, 6MOY, MIP tracker · auto-updated leaderboards",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
