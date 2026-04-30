import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "赛程表",
  description: "NBA 完整赛程安排，按日期查看所有比赛。",
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
