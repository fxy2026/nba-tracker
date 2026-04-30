import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "交易动态",
  description: "NBA 最新交易、签约、裁员动态。",
};

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
