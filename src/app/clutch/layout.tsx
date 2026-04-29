import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playoff Performers",
  description: "NBA 季后赛表现最佳球员，效率、得分、助攻排行榜。",
};

export default function ClutchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
