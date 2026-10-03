import dynamic from "next/dynamic";
import type { ShotAction } from "@/lib/api";
import type { Translations } from "@/locales";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const ShotChart = dynamic(() => import("@/components/ShotChart"), { loading: ChartPlaceholder });

export default function ShotChartSection({
  shots,
  homeTricode,
  awayTricode,
  allPlayers,
  t,
}: {
  shots: ShotAction[];
  homeTricode: string;
  awayTricode: string;
  allPlayers: { personId: number; nameI: string; teamTricode: string }[];
  t: Translations;
}) {
  return (
    <div className="glass-tile p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.shotChart}
      </h3>
      {shots.length > 0
        ? <ShotChart shots={shots} homeTricode={homeTricode} awayTricode={awayTricode} players={allPlayers} />
        : <p className="text-xs text-text-secondary py-4">{t.gameDetail.shotChart === "投篮图"
          ? "本场真实出手坐标暂不可用。"
          : "Verified shot locations are currently unavailable for this game."}</p>}
    </div>
  );
}
