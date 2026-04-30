import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "历届总冠军",
  description: "NBA 历届总冠军、FMVP、夺冠历史回顾。",
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
