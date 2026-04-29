import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Comparison",
  description: "Compare NBA players side by side — PPG, RPG, APG and more.",
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
