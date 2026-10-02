import Link from "next/link";
import { playerIndexLabel, type PlayerIndexProvenance } from "@/lib/player-index-provenance";

export function PlayerDirectorySource({ provenance, locale }: { provenance: PlayerIndexProvenance | null; locale: string }) {
  const zh = locale === "zh";
  return <p className="text-xs text-text-secondary mb-6">
    {provenance ? playerIndexLabel(provenance, locale) : (zh ? "球员来源暂不可用" : "Player source unavailable")}
    {zh ? " · 名单、球队与场均以该快照为准" : " · Players, teams and averages reflect this snapshot"}
  </p>;
}

export function UnrankedDirectoryPlayers({ players, locale }: { players: { personId: number; firstName: string; lastName: string }[]; locale: string }) {
  if (!players.length) return null;
  return <details className="mt-3 text-xs text-text-secondary">
    <summary>{locale === "zh" ? `场均数据不完整，未参与排名（${players.length}）` : `Incomplete averages, unranked (${players.length})`}</summary>
    <div className="flex flex-wrap gap-3 mt-2">{players.map(player => <Link key={player.personId} href={`/player/${player.personId}`} className="hover:text-accent">{player.firstName} {player.lastName}</Link>)}</div>
  </details>;
}
