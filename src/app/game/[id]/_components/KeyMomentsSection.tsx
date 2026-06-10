import KeyMoments from "@/components/KeyMoments";
import type { PlayAction } from "@/components/PlayByPlay";

export default function KeyMomentsSection({ actions }: { actions: PlayAction[] }) {
  if (actions.length === 0) return null;
  return <KeyMoments actions={actions} />;
}
