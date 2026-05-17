import dynamic from "next/dynamic";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const PlayByPlay = dynamic(() => import("@/components/PlayByPlay"), { loading: ChartPlaceholder });

export default function PlayByPlaySection({ actions }: { actions: Record<string, unknown>[] }) {
  if (actions.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PlayByPlay actions={actions as any} />;
}
