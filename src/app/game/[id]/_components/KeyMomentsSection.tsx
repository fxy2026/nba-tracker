import KeyMoments from "@/components/KeyMoments";

export default function KeyMomentsSection({ actions }: { actions: Record<string, unknown>[] }) {
  if (actions.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <KeyMoments actions={actions as any} />;
}
