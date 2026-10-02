// Small review metadata only; the original rejected player rows are never
// imported by rendering code. A source-specific issue does not block a valid
// official NBA box score if that independent source becomes available.
import reviews from '@/data/player-box-quarantine.json';
export function isPlayerBoxQuarantined(gameId:string):boolean {
 return Object.hasOwn(reviews,gameId);
}
