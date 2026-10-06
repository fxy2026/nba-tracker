import type { ProviderBasicSnapshot, ProviderPlayerLine } from '@/lib/provider-player-normalizer';
import type { EspnPlayerBox, EspnPlayerLine } from '@/lib/espn-player-box';
const val=(v:number|null)=>v===null?'—':String(v);
const basicCells = (p: ProviderPlayerLine | EspnPlayerLine, splitRebounds = false) => [
 val(p.minutesRounded), val(p.points), val(p.rebounds),
 ...(splitRebounds ? [val(p.offensiveRebounds), val(p.defensiveRebounds)] : []),
 val(p.assists), `${val(p.fieldGoalsMade)}–${val(p.fieldGoalsAttempted)}`,
 `${val(p.threePointersMade)}–${val(p.threePointersAttempted)}`,
 `${val(p.freeThrowsMade)}–${val(p.freeThrowsAttempted)}`,
 val(p.steals), val(p.blocks), val(p.turnovers), val(p.fouls), val(p.plusMinus),
];
export default function ProviderPlayerBox({box,isZh}:{box:ProviderBasicSnapshot | EspnPlayerBox;isZh:boolean}){
 if (box.provider === 'ESPN') {
  return <section className="mt-6 glass-tile overflow-hidden" aria-label={isZh?'ESPN 已归档球员基础数据':'ESPN archived basic player stats'}>
   <div className="p-4 space-y-2"><h2 className="text-lg font-semibold">{isZh?'球员基础技术统计':'Basic player stats'}</h2>
    <p className="text-xs text-text-secondary">{isZh?'来源：':'Source: '}<a className="text-accent" href={box.source.url} target="_blank" rel="noopener noreferrer">ESPN</a>{isZh?'（已归档来源）':' (archived source)'}{` · ${box.game.season} · ${box.game.gameDate}`}</p>
    <p className="text-xs text-text-secondary">{isZh?'球队归属及基础数据来自 ESPN 已归档技术统计，未逐项核对 NBA 官方报告。球员姓名未与 NBA 球员编号映射。':'Team assignments and basic stats come from the archived ESPN box score; these rows were not individually verified against an official NBA report. Player names have not been mapped to NBA player IDs.'}</p>
    <p className="text-xs text-text-secondary">{isZh?'MIN ≈ 为数据源取整分钟数；缺失值以 — 显示。获取时间：':'MIN ≈ uses source-rounded minutes; missing values appear as —. Retrieved: '}{box.retrievedAt}</p>
    <p className="text-xs text-text-secondary">{isZh?`排除的数据源行：未出场（DNP）${box.excluded.dnp} 行；出场情况未核实的占位行 ${box.excluded.participationUnverified} 行。此表不代表完整的本场球员名单。`:`Excluded source rows: DNP ${box.excluded.dnp}; participation-unverified placeholders ${box.excluded.participationUnverified}. This table does not represent a complete game roster.`}</p>
   </div>
   <div role="region" tabIndex={0} aria-label={isZh?'ESPN 球员数据，可横向滚动':'ESPN player stats, scroll horizontally'} className="overflow-x-auto">
    <table className="w-full text-xs whitespace-nowrap tabular-nums"><caption className="sr-only">{isZh?'ESPN 已归档本场球员基础数据，含数据源球队归属':'ESPN archived game player statistics with source team assignments'}</caption>
     <thead><tr className="text-text-secondary border-y border-border">{[isZh?'球员':'Player',isZh?'球队':'Team',isZh?'首发':'Starter','MIN ≈','PTS','REB','OREB','DREB','AST','FG','3PT','FT','STL','BLK','TO','PF','+/−'].map((c,i)=><th scope="col" key={c} className={`p-3 ${i===0?'text-left sticky left-0 bg-bg-card':'text-right'}`}>{c}</th>)}</tr></thead>
     <tbody>{box.players.map(p=><tr key={p.espnAthleteId} className="border-b border-border/50"><th scope="row" className="p-3 text-left sticky left-0 bg-bg-card">{p.name}</th><td className="p-3 text-right">{p.team}</td><td className="p-3 text-right">{p.starter===null?'—':p.starter?(isZh?'是':'Yes'):(isZh?'否':'No')}</td>{basicCells(p,true).map((v,i)=><td key={i} className={`p-3 text-right ${i===1?'font-bold':''}`}>{v}</td>)}</tr>)}</tbody>
    </table>
   </div>
  </section>;
 }

 return <section className="mt-6 glass-tile overflow-hidden" aria-label={isZh?'补充球员数据，球队归属待核验':'Supplemental player stats, historical teams unassigned'}>
  <div className="p-4 space-y-2"><h2 className="text-lg font-semibold">{isZh?'球员基础技术统计':'Basic player stats'}</h2>
   <p className="text-xs text-text-secondary">{isZh?'来源：':'Source: '}<a className="text-accent" href="https://bigballsdata.com" target="_blank" rel="noopener noreferrer">BigBallsData</a>{` · ${box.game.season} · ${box.game.gameDate}`}</p>
   <p className="text-xs text-text-secondary">{isZh?'数据源未提供可靠的本场球队归属，以下合并展示双方球员，不使用现效力球队分组。合计得分与比赛比分一致，但这些行未逐项核对官方报告。':'Reliable historical team assignments were not supplied. Both teams’ players are combined below; current roster teams are not used. Combined points match the final score, but these rows were not individually checked against an official report.'}</p>
   <p className="text-xs text-text-secondary">{isZh?'分钟为数据源取整值，未补造缺失名单。获取时间：':'Minutes are rounded; missing roster entries are not fabricated. Retrieved: '}{box.retrievedAt}</p>
  </div>
  <div role="region" tabIndex={0} aria-label={isZh?'合并球员数据，可横向滚动':'Combined player stats, scroll horizontally'} className="overflow-x-auto">
   <table className="w-full text-xs whitespace-nowrap tabular-nums"><caption className="sr-only">{isZh?'本场双方球员基础数据':'Combined game player statistics'}</caption>
    <thead><tr className="text-text-secondary border-y border-border">{[isZh?'球员':'Player','MIN ≈','PTS','REB','AST','FG','3PT','FT','STL','BLK','TO','PF','+/−'].map((c,i)=><th scope="col" key={c} className={`p-3 ${i===0?'text-left sticky left-0 bg-bg-card':'text-right'}`}>{c}</th>)}</tr></thead>
    <tbody>{box.players.map(p=><tr key={p.name} className="border-b border-border/50"><th scope="row" className="p-3 text-left sticky left-0 bg-bg-card">{p.name}</th>{basicCells(p).map((v,i)=><td key={i} className={`p-3 text-right ${i===1?'font-bold':''}`}>{v}</td>)}</tr>)}</tbody>
   </table>
  </div>
 </section>;
}
