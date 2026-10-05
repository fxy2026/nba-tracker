import type { PlayAction } from "@/components/PlayByPlay";
import type { ShotAction, ScoringShot } from "./nba-contracts";

export interface GamePlayByPlay {
  actions: PlayAction[];
  shots: ShotAction[];
  scoringShots: ScoringShot[];
  scoreEvents: { period: number; clock: string; scoreHome: number; scoreAway: number }[];
}
export const EMPTY_PLAY_BY_PLAY: GamePlayByPlay = { actions: [], shots: [], scoringShots: [], scoreEvents: [] };
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown) => typeof v === "string" ? v : "";
const score = (v: unknown): string => typeof v === "string" && /^\d+$/.test(v) ? v : "";

export function normalizeGamePlayByPlay(payload: unknown, gameId: string): GamePlayByPlay {
  if (!object(payload) || !object(payload.game) || payload.game.gameId !== gameId || !Array.isArray(payload.game.actions)) return EMPTY_PLAY_BY_PLAY;
  const actions: PlayAction[] = [];
  const shots: ShotAction[] = [];
  const scoringShots: ScoringShot[] = [];
  let complete = true;
  let spatialComplete = true;
  for (const raw of payload.game.actions) {
    if (!object(raw) || !finite(raw.actionNumber) || !finite(raw.period) || raw.period < 1 ||
        typeof raw.clock !== "string" || typeof raw.actionType !== "string" || typeof raw.description !== "string") {
      complete = false;
      continue;
    }
    const action: PlayAction = {
      actionNumber: raw.actionNumber, period: raw.period, clock: raw.clock,
      actionType: raw.actionType, description: raw.description,
      teamTricode: text(raw.teamTricode), subType: text(raw.subType),
      // Non-player events have no player identity; 0 is the existing sentinel.
      personId: finite(raw.personId) ? raw.personId : 0, playerNameI: text(raw.playerNameI),
      scoreHome: score(raw.scoreHome), scoreAway: score(raw.scoreAway),
      shotResult: raw.shotResult === "Made" || raw.shotResult === "Missed" ? raw.shotResult : undefined,
      isFieldGoal: finite(raw.isFieldGoal) ? raw.isFieldGoal : undefined,
      descriptor: typeof raw.descriptor === "string" ? raw.descriptor : undefined,
      qualifiers: Array.isArray(raw.qualifiers) ? raw.qualifiers.filter((q): q is string => q === "fastbreak" || q === "2ndchance") : undefined,
      assistPlayerNameInitial: typeof raw.assistPlayerNameInitial === "string" ? raw.assistPlayerNameInitial : undefined,
      shotDistance: finite(raw.shotDistance) ? raw.shotDistance : undefined,
    };
    // One-sided scores cannot be passed to consumers that default blanks to 0.
    if ((action.scoreHome === "") !== (action.scoreAway === "")) return EMPTY_PLAY_BY_PLAY;
    actions.push(action);
    if (action.shotResult) {
      if (!["2pt", "3pt", "freethrow"].includes(action.actionType) || !finite(raw.personId) || !action.teamTricode) return EMPTY_PLAY_BY_PLAY;
      scoringShots.push({ ...action, shotResult: action.shotResult,
        x: finite(raw.x) ? raw.x : undefined, y: finite(raw.y) ? raw.y : undefined });
      // Free throws carry scoring information, not field-goal locations.
      if (action.actionType === "freethrow") continue;
      // Missing spatial data must never become a shot at (0, 0). Withhold the
      // shot-derived modules if incomplete, rather than summarize a subset.
      if (!finite(raw.x) || !finite(raw.y) || !finite(raw.shotDistance) || !finite(raw.personId)) {
        spatialComplete = false;
      } else {
        shots.push({ ...action, shotResult: action.shotResult, x: raw.x, y: raw.y, shotDistance: raw.shotDistance });
      }
    }
  }
  // Malformed rows can hide a scoring event; don't present derived runs or a
  // misleading partial timeline. A wholly valid text feed can lack positions.
  if (!complete) return EMPTY_PLAY_BY_PLAY;
  return {
    actions,
    scoringShots,
    shots: spatialComplete ? shots : [],
    scoreEvents: actions.filter((a) => a.scoreHome !== "" && a.scoreAway !== "").map((a) => ({
      period: a.period, clock: a.clock, scoreHome: Number(a.scoreHome), scoreAway: Number(a.scoreAway),
    })),
  };
}

export async function getGamePlayByPlay(gameId: string): Promise<GamePlayByPlay> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const stopped = new Promise<GamePlayByPlay>((resolve) => {
      timer = setTimeout(() => { controller.abort(); resolve(EMPTY_PLAY_BY_PLAY); }, 8000);
    });
    const work = (async () => {
      const response = await fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://www.nba.com/" },
        next: { revalidate: 60 }, signal: controller.signal,
      });
      if (!response.ok) return EMPTY_PLAY_BY_PLAY;
      const raw: unknown = await response.json();
      return controller.signal.aborted ? EMPTY_PLAY_BY_PLAY : normalizeGamePlayByPlay(raw, gameId);
    })();
    return await Promise.race([work, stopped]);
  } catch { return EMPTY_PLAY_BY_PLAY; }
  finally { clearTimeout(timer); }
}
