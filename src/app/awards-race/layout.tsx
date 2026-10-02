import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA Awards Race · MVP, ROY, DPOY, 6MOY, MIP",
  description: "Site-computed MVP, DPOY and ROY rankings with disclosed data coverage. Sixth Man and Most Improved rankings remain unavailable until the necessary season data is supported.",
  openGraph: {
    title: "NBA Awards Race",
    description: "MVP, DPOY and ROY site rankings with transparent 6MOY and MIP data requirements.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
