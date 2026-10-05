"use client";

import dynamic from "next/dynamic";
import type { VerifiedShotChart } from "@/lib/court-shots";

const ShotChartExplorer = dynamic(() => import("@/components/ShotChartExplorer"), {
  loading: () => <div className="h-[28rem] rounded-2xl bg-bg-secondary skeleton-shimmer" />,
});

export default function VerifiedShotChartSection({ data, isZh }: { data: VerifiedShotChart | null; isZh: boolean }) {
  return (
    <section id="shot-chart" aria-labelledby="shot-chart-title" className="mt-6 glass-tile p-4 sm:p-6">
      <h2 id="shot-chart-title" className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        {isZh ? "投篮分布" : "Shot chart"}
      </h2>
      {data ? <ShotChartExplorer data={data} /> : (
        <p className="text-sm text-text-secondary py-5">
          {isZh
            ? "本场真实出手坐标暂不可用。球场图将在坐标数据完成核验后展示。"
            : "Verified shot locations are not available for this game yet. The court chart appears when its coordinate data has been verified."}
        </p>
      )}
    </section>
  );
}
