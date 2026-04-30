import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "球员搜索",
  description: "搜索 NBA 球员，查看详细数据与职业生涯统计。",
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
