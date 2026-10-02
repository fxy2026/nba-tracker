// Server-only data boundary: never import this archive from client components.
import snapshots from "@/data/recovered-player-boxes.json";
import type { ScheduleGame } from "./api";
import { validateRecoveredPlayerBox } from "./recovered-player-box";

export function getRecoveredPlayerBox(game: ScheduleGame) {
  if (!Object.hasOwn(snapshots, game.gameId)) return null;
  return validateRecoveredPlayerBox(snapshots[game.gameId as keyof typeof snapshots], game);
}
