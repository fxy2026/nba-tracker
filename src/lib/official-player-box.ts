import { TEAM_META } from './teams';
import type { RecoveredPlayerBox, RecoveredScheduleIdentity } from './recovered-player-box';

export const OFFICIAL_BOX_COUNT_FIELDS = ['points','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls'] as const;
type CountField = typeof OFFICIAL_BOX_COUNT_FIELDS[number];
export type OfficialReportTeamTotals = Record<CountField, number> & {
  plusMinus: number;
  playedPlayerCount: number;
  officialDuration: string;
  /** Sum of printed player seconds minus the printed team total. This records
   * a verified report-internal residual; it never changes a player's duration. */
  durationResidualSeconds: number;
};
export interface OfficialPlayerBoxEvidence {
  kind: 'complete-official-player-box';
  reportUrl: string;
  reportSha256: string;
  page: number;
  verifiedOn: string;
  home: OfficialReportTeamTotals;
  away: OfficialReportTeamTotals;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  && Reflect.ownKeys(v).every(key => typeof key === 'string' && 'value' in Object.getOwnPropertyDescriptor(v,key)!);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const duration = (v: unknown, team = false): number | null => {
  if (typeof v !== 'string' || !(team ? /^\d{3}:[0-5]\d$/ : /^\d{2}:[0-5]\d$/).test(v)) return null;
  const [minutes,seconds] = v.split(':').map(Number); return minutes * 60 + seconds;
};
const topKeys = ['gameId','gameDate','season','provider','providerMatchId','retrievedAt','reportUrl','home','away','homeScore','awayScore','players','officialReport'];
const rowKeys = ['name','team','minutes','source','officialSource','providerPlayerId','plusMinus','starter',...OFFICIAL_BOX_COUNT_FIELDS];
const sourceKeys = ['kind','reportUrl','reportSha256','page','verifiedOn','jerseyNumber','position','officialDuration'];

/** Complete manually reviewed report rows only. No provider match/player UUID,
 * NBA person ID, DNP row, partial provider coverage or inferred stat is accepted.
 * The supplied counts/totals are report evidence, not proof of PDF authenticity;
 * importing a new report still requires independent source review. */
export function validateOfficialPlayerBox(raw: unknown, game: RecoveredScheduleIdentity): RecoveredPlayerBox | null {
  try {
    if (!record(raw) || !exact(raw,topKeys) || raw.provider !== 'NBA official final report' || raw.providerMatchId !== null
      || typeof raw.gameId !== 'string' || !/^00[245]\d{7}$/.test(raw.gameId) || raw.gameId !== game.gameId || game.gameStatus !== 3
      || !date(raw.gameDate) || typeof raw.season !== 'string' || !/^20\d{2}-\d{2}$/.test(raw.season)
      || raw.season.slice(5) !== String((Number(raw.season.slice(0,4))+1)%100).padStart(2,'0') || raw.gameId.slice(3,5) !== raw.season.slice(2,4)
      || ![Number(raw.season.slice(0,4)),Number(raw.season.slice(0,4))+1].includes(Number(raw.gameDate.slice(0,4)))
      || typeof raw.home !== 'string' || typeof raw.away !== 'string' || !Object.hasOwn(TEAM_META,raw.home) || !Object.hasOwn(TEAM_META,raw.away) || raw.home === raw.away
      || raw.home !== game.homeTeam.teamTricode || raw.away !== game.awayTeam.teamTricode
      || game.homeTeam.teamId !== TEAM_META[raw.home].teamId || game.awayTeam.teamId !== TEAM_META[raw.away].teamId
      || !count(raw.homeScore) || !count(raw.awayScore) || raw.homeScore === raw.awayScore || raw.homeScore !== game.homeTeam.score || raw.awayScore !== game.awayTeam.score
      || game.gameCode !== `${raw.gameDate.replaceAll('-','')}/${raw.away}${raw.home}`
      || typeof raw.retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw.retrievedAt) || !Number.isFinite(Date.parse(raw.retrievedAt)) || !date(raw.retrievedAt.slice(0,10))
      || !Array.isArray(raw.players) || Object.getPrototypeOf(raw.players) !== Array.prototype || raw.players.length < 10 || raw.players.length > 50
      || Reflect.ownKeys(raw.players).length !== raw.players.length+1 || !record(raw.officialReport)) return null;
    const report = raw.officialReport, stamp = raw.gameDate.replaceAll('-','');
    if (!exact(report,['kind','reportUrl','reportSha256','page','verifiedOn','home','away']) || report.kind !== 'complete-official-player-box'
      || report.reportUrl !== raw.reportUrl || ![`${stamp}_${raw.away}${raw.home}.pdf`,`${stamp}_${raw.away}${raw.home}_book.pdf`].some(file => raw.reportUrl === `https://statsdmz.nba.com/pdfs/${stamp}/${file}`)
      || typeof report.reportSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(report.reportSha256)
      || !count(report.page) || report.page < 1 || report.page > 100 || !date(report.verifiedOn)
      || report.verifiedOn < raw.gameDate || raw.retrievedAt.slice(0,10) < raw.gameDate) return null;
    const names = new Set<string>();
    for (let i=0;i<raw.players.length;i++) {
      const entry = Object.getOwnPropertyDescriptor(raw.players,String(i));
      if (!entry || !('value' in entry) || !record(entry.value)) return null;
      const p = entry.value, source = p.officialSource;
      if (!exact(p,rowKeys) || typeof p.name !== 'string' || !p.name.trim() || p.name !== p.name.trim() || p.name.length > 100 || /[\u0000-\u001f\u007f]/.test(p.name)
        || names.has(p.name.toLowerCase()) || (p.team !== raw.home && p.team !== raw.away)
        || p.providerPlayerId !== null || p.source !== 'NBA official final report' || !count(p.minutes)
        || !OFFICIAL_BOX_COUNT_FIELDS.every(key=>count(p[key])) || !integer(p.plusMinus) || typeof p.starter !== 'boolean'
        || !record(source) || !exact(source,sourceKeys) || source.kind !== 'independent-official-player-record'
        || source.reportUrl !== report.reportUrl || source.reportSha256 !== report.reportSha256 || source.page !== report.page || source.verifiedOn !== report.verifiedOn
        || typeof source.jerseyNumber !== 'string' || !/^\d{1,2}$/.test(source.jerseyNumber)
        || (p.starter ? !['F','C','G'].includes(source.position as string) : source.position !== null)) return null;
      const seconds = duration(source.officialDuration);
      if (seconds === null || p.minutes !== Math.round(seconds/60)) return null;
      const n=p as Record<CountField,number>;
      if (n.fieldGoalsMade>n.fieldGoalsAttempted || n.threePointersMade>n.threePointersAttempted || n.freeThrowsMade>n.freeThrowsAttempted
        || n.threePointersMade>n.fieldGoalsMade || n.threePointersAttempted>n.fieldGoalsAttempted
        || n.fieldGoalsMade-n.threePointersMade>n.fieldGoalsAttempted-n.threePointersAttempted
        || n.points!==2*n.fieldGoalsMade+n.threePointersMade+n.freeThrowsMade || n.rebounds!==n.offensiveRebounds+n.defensiveRebounds) return null;
      names.add(p.name.toLowerCase());
    }
    let teamDuration: number | null = null;
    for (const side of ['home','away'] as const) {
      const total=report[side], rows=raw.players.filter(p=>p.team===raw[side]);
      if (!record(total) || !exact(total,[...OFFICIAL_BOX_COUNT_FIELDS,'plusMinus','playedPlayerCount','officialDuration','durationResidualSeconds'])
        || !OFFICIAL_BOX_COUNT_FIELDS.every(key=>count(total[key])) || !integer(total.plusMinus) || !count(total.playedPlayerCount)
        || total.playedPlayerCount!==rows.length || rows.length<5 || rows.length>25 || rows.filter(p=>p.starter).length!==5
        || !integer(total.durationResidualSeconds) || Math.abs(total.durationResidualSeconds)>5) return null;
      const seconds=duration(total.officialDuration,true);
      if (seconds===null || seconds<14400 || (seconds-14400)%1500!==0 || (teamDuration!==null&&teamDuration!==seconds)) return null;
      teamDuration=seconds;
      if(rows.some(p=>duration(p.officialSource.officialDuration)!>seconds/5))return null;
      if (rows.reduce((sum,p)=>sum+duration(p.officialSource.officialDuration)!,0)!==seconds+total.durationResidualSeconds) return null;
      if (OFFICIAL_BOX_COUNT_FIELDS.some(key=>{const sum=rows.reduce((sum,p)=>sum+p[key],0);return !Number.isSafeInteger(sum)||sum!==total[key];})) return null;
      const margin=side==='home'?raw.homeScore-raw.awayScore:raw.awayScore-raw.homeScore;
      if (!Number.isSafeInteger(5*margin) || total.points!==(side==='home'?raw.homeScore:raw.awayScore) || total.plusMinus!==margin || rows.reduce((sum,p)=>sum+p.plusMinus,0)!==5*margin) return null;
    }
    return raw as unknown as RecoveredPlayerBox;
  } catch { return null; }
}
