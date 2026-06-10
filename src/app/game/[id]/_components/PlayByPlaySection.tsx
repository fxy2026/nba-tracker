import dynamic from "next/dynamic";
import type { PlayAction } from "@/components/PlayByPlay";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const PlayByPlay = dynamic(() => import("@/components/PlayByPlay"), { loading: ChartPlaceholder });

export default function PlayByPlaySection({ actions, isLive = false }: { actions: PlayAction[]; isLive?: boolean }) {
  if (actions.length === 0) return null;
  return <PlayByPlay actions={actions} isLive={isLive} />;
}
