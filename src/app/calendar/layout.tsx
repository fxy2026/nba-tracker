import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "赛程日历",
  description: "NBA 赛季月历视图，每天比赛一目了然。",
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
