/** Narrow chart input. A verified archive does not impersonate a CDN BoxScore
 * or generic PlayAction, and has no authority to enable other derived modules. */
export interface TakeoverScoringEvent {
  personId: number;
  playerName: string;
  teamTricode: string;
  period: number;
  points: 1 | 2 | 3;
}
export interface TakeoverScorer {
  personId: number;
  name: string;
  teamTricode: string;
  total: number;
  points: number[];
}
export function buildTakeoverSeries(events: readonly TakeoverScoringEvent[], isZh: boolean) {
  const players = new Map<number, TakeoverScorer>();
  const quarterStarts: { index: number; label: string }[] = [];
  let seenPeriod = 0;
  for (const [index, event] of events.entries()) {
    const step = index + 1;
    if (event.period > seenPeriod) {
      seenPeriod = event.period;
      if (event.period >= 2) quarterStarts.push({ index: step, label: event.period <= 4
        ? (isZh ? `第${event.period}节` : `Q${event.period}`)
        : (isZh ? `加时${event.period - 4}` : `OT${event.period - 4}`) });
    }
    let player = players.get(event.personId);
    if (!player) {
      player = { personId: event.personId, name: event.playerName, teamTricode: event.teamTricode, total: 0, points: new Array(step).fill(0) };
      players.set(event.personId, player);
    }
    player.total += event.points;
    for (const tracked of players.values()) tracked.points.push(tracked.total);
  }
  return { scorers: [...players.values()].sort((a, b) => b.total - a.total).slice(0, 6), quarterStarts, steps: events.length + 1 };
}
