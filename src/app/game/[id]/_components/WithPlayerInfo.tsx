import type { ReactNode } from "react";
import type { PlayerInfo } from "@/lib/api";

// All metadata consumers share the page's already-started, failure-handled
// promise. Await it only inside their Suspense boundaries, never on the hero path.
export default async function WithPlayerInfo({ data, children }: {
  data: Promise<Map<number, PlayerInfo>>;
  children: (playerInfoMap: Map<number, PlayerInfo>) => ReactNode;
}) {
  return children(await data);
}
