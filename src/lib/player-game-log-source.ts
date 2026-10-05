import { withEspnPlayerLogGamePages } from "./player-game-log-links";
import { OFFICIAL_PLAYER_IDENTITIES } from "./official-player-registry";
import { parseEspnPlayerGameLog } from "./espn-player-game-log";
import type { PlayerGameLogData } from "./player-game-log-data";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const identities = new Map(OFFICIAL_PLAYER_IDENTITIES.map(row => [row.id, row]));
/** Reviewed public ESPN athlete profiles match NBA name + debut year. */
export const REVIEWED_ESPN_PLAYER_IDS: Readonly<Record<number, string>> = Object.freeze({ 2544: "1966", 201939: "3975", 893: "1035", 977: "110" });
const resolved = new Map<number, { id: string; expires: number }>();
export const PLAYER_LOG_MAX_BYTES = 2 * 1024 * 1024;
export async function readBoundedEspnJson(response: Response, signal: AbortSignal): Promise<unknown | null> {
  if (!response.ok || signal.aborted || Number(response.headers.get("content-length")) > PLAYER_LOG_MAX_BYTES || !response.body) return null;
  const reader = response.body.getReader();
  let stop: () => void = () => {};
  const aborted = new Promise<null>(resolve => { stop = () => resolve(null); signal.addEventListener("abort", stop, { once: true }); });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await Promise.race([reader.read(), aborted]);
      if (chunk === null || signal.aborted) return null;
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > PLAYER_LOG_MAX_BYTES) return null;
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return null; }
  finally {
    signal.removeEventListener("abort", stop);
    void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* A non-cooperative pending read is ignored. */ }
  }
}
export async function fetchPublicLogJson(url: string, parentSignal: AbortSignal): Promise<unknown | null> {
  if (parentSignal.aborted) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const signal = AbortSignal.any([parentSignal, controller.signal]);
  let stop: () => void = () => {};
  const aborted = new Promise<null>(resolve => { stop = () => resolve(null); signal.addEventListener("abort", stop, { once: true }); });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, { signal, redirect: "error", headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
      return readBoundedEspnJson(response, signal);
    })(), aborted]);
  } catch { return null; }
  finally { clearTimeout(timer); signal.removeEventListener("abort", stop); controller.abort(); }
}
/** A name alone is insufficient: duplicate NBA names must resolve by debut year. */
export function espnSearchCandidates(raw: unknown, name: string): string[] | null {
  if (!object(raw) || !Array.isArray(raw.results)) return null;
  const ids = new Set<string>();
  for (const group of raw.results) {
    if (!object(group) || group.type !== "player") continue;
    if (!Array.isArray(group.contents)) return null;
    for (const candidate of group.contents) {
      if (!object(candidate) || typeof candidate.displayName !== "string" || fold(candidate.displayName) !== fold(name) || candidate.defaultLeagueSlug !== "nba" || candidate.sport !== "basketball") continue;
      const match = typeof candidate.uid === "string" ? /^s:40~l:46~a:(\d+)$/.exec(candidate.uid) : null;
      if (match) ids.add(match[1]);
    }
  }
  return [...ids];
}
export function espnProfileMatches(raw: unknown, espnId: string, nbaName: string, debutYear: number): boolean {
  if (!object(raw) || !object(raw.athlete)) return false;
  const row = raw.athlete;
  return row.id === espnId && row.uid === `s:40~l:46~a:${espnId}` && row.type === "basketball" && typeof row.fullName === "string" && fold(row.fullName) === fold(nbaName) && row.debutYear === debutYear;
}
export async function resolveEspnLogPlayer(playerId: number, signal: AbortSignal): Promise<string | null> {
  if (Object.hasOwn(REVIEWED_ESPN_PLAYER_IDS, playerId)) return REVIEWED_ESPN_PLAYER_IDS[playerId];
  const identity = identities.get(playerId);
  if (!identity?.sourceYears) return null;
  const saved = resolved.get(playerId);
  if (saved && saved.expires > Date.now()) return saved.id;
  const task = (async () => {
    const raw = await fetchPublicLogJson(`https://site.api.espn.com/apis/search/v2?${new URLSearchParams({ query: identity.name, type: "player", limit: "50" })}`, signal);
    const candidates = espnSearchCandidates(raw, identity.name);
    // Bound fanout; ambiguity or overly broad responses are unavailable.
    if (!candidates?.length || candidates.length > 5 || signal.aborted) return null;
    const matches = await Promise.all(candidates.map(async id => espnProfileMatches(await fetchPublicLogJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`, signal), id, identity.name, identity.sourceYears!.from) ? id : null));
    const verified = matches.filter((id): id is string => id !== null);
    if (verified.length !== 1 || signal.aborted) return null;
    resolved.set(playerId, { id: verified[0], expires: Date.now() + 86400000 });
    return verified[0];
  })();
  return task;
}
export async function fetchEspnPlayerGameLog(identity: Pick<PlayerGameLogData, "playerId" | "season" | "seasonType">, signal: AbortSignal) {
  const espnId = await resolveEspnLogPlayer(identity.playerId, signal);
  if (!espnId || signal.aborted) return null;
  const raw = await fetchPublicLogJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/gamelog?season=${Number(identity.season.slice(0, 4)) + 1}`, signal);
  if (signal.aborted) return null;
  const data = parseEspnPlayerGameLog(raw, identity, espnId, new Date().toISOString());
  return data ? withEspnPlayerLogGamePages(data, raw) : null;
}
