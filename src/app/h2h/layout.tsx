import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "历史交锋",
  description: "NBA 球队历史交锋记录、胜负对比、近期战绩分析。",
};

export default function H2HLayout({ children }: { children: React.ReactNode }) {
  return children;
}
