import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "伤病报告",
  description: "NBA 全联盟伤病名单，实时更新球员伤停状态。",
};

export default function InjuriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
