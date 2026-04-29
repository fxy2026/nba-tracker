import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stats & Leaders",
  description: "NBA 得分王、篮板王、助攻王排行榜，球队排名与历年奖项一览。",
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
