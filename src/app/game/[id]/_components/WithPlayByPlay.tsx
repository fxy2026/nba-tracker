import type { ReactNode } from "react";
import { EMPTY_PLAY_BY_PLAY, type GamePlayByPlay } from "@/lib/game-play-by-play";

// Each optional section consumes the same request behind its own Suspense
// boundary. A slow/failed advanced feed cannot hold the basic box score hostage.
export default async function WithPlayByPlay({ data, children }: {
  data: Promise<GamePlayByPlay>;
  children: (data: GamePlayByPlay) => ReactNode;
}) {
  return children(await data.catch(() => EMPTY_PLAY_BY_PLAY));
}
