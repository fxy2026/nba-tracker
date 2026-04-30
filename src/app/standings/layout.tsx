import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "球队战绩",
  description: "NBA 东西部球队战绩排名、胜率、近期表现。",
};

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
