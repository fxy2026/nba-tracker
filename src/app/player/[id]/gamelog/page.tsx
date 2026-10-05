import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows, User, Users } from "lucide-react";
import { getPlayerHeadshotUrl } from "@/lib/api";
import { getPlayerProfileContext } from "@/lib/player-profile-loader";
import { getPlayerGameLogProfile } from "@/lib/player-game-log-profile";
import { parsePlayerId } from "@/lib/player-identity";
import type { PlayerProfileQuery } from "@/lib/player-profile-navigation";
import { playerIndexLabel } from "@/lib/player-index-provenance";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PlayerGameLog from "@/components/player/PlayerGameLog";
import { teamLogoUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<PlayerProfileQuery>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const personId = parsePlayerId(id);
  if (personId === null) return {};
  const [profile, locale] = await Promise.all([getPlayerProfileContext(id), getLocale()]);
  if (!profile) return {};
  const name = profile.identity.name;
  const isZh = locale === "zh";
  const title = isZh ? `${name} 比赛日志 — 已收录赛季逐场数据` : `${name} Game Log — Recorded Seasons`;
  const desc = isZh ? `${name} 已收录赛季的逐场得分、篮板、助攻、投篮、抢断、盖帽与月度拆分；来源和缺失范围分别标注。` : `${name} recorded game logs, shooting, rebounds, assists and monthly splits with source and coverage labels.`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/player/${id}/gamelog` },
    openGraph: {
      title,
      description: desc,
      images: [getPlayerHeadshotUrl(personId)],
    },
  };
}

export default async function PlayerGameLogPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const personId = parsePlayerId(id);
  if (personId === null) notFound();
  const [profile, locale] = await Promise.all([getPlayerProfileContext(id), getLocale()]);
  if (!profile) notFound();
  const { snapshot, identity } = profile;
  const player = snapshot.players.find(p => p.personId === personId);
  const gameLog = await getPlayerGameLogProfile(personId, identity.sourceYears, player ? snapshot.provenance.season : undefined);
  const query = await searchParams ?? {};
  const isZh = locale === "zh";
  const fullName = identity.name;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "球员" : "Players", href: "/search" },
          { label: fullName, href: `/player/${personId}` },
          { label: isZh ? "比赛日志" : "Game Log" },
        ]}
      />

      <div className="mt-2">
        <Link
          href={`/player/${personId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.15em] rounded-md bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <ArrowLeft size={12} />
          {isZh ? "返回球员主页" : "Back to player profile"}
        </Link>
      </div>

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="mt-6 glass-tile p-5 flex items-center gap-4">
        <PlayerHeadshot personId={personId} name={fullName} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-accent-amber">
            {isZh ? "比赛日志" : "Game log"} · {isZh ? "已收录赛季" : "Recorded seasons"}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight truncate">
            {fullName}
          </h1>
          {player?.teamAbbr && (
            <Link
              href={`/team/${player?.teamAbbr}`}
              className="text-[11px] text-text-secondary hover:text-accent transition-colors font-medium cursor-pointer"
            >
              {player?.teamCity} {player?.teamName}
            </Link>
          )}
          {(player?.teamAbbr || (player?.teamId ?? 0) > 0) && (
            <p className="mt-1 text-[11px] text-text-secondary">
              {isZh ? "球队归属：" : "Team affiliation: "}{playerIndexLabel(snapshot.provenance, locale)}
            </p>
          )}
        </div>
        {(player?.teamId ?? 0) > 0 && (
          <Image
            src={teamLogoUrl((player?.teamId ?? 0))}
            alt={player?.teamAbbr || ""}
            width={44}
            height={44}
            unoptimized
            className="opacity-70 shrink-0"
          />
        )}
      </div>

      {/* ─── Full season log + monthly splits (client fetch) ── */}
      <section className="mt-6">
        <PlayerGameLog playerId={personId} playerName={fullName} {...gameLog} initialSearch={new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString()} />
      </section>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: `/player/${personId}`, label: isZh ? "球员主页" : "Player profile", icon: User },
          ...(player?.teamAbbr
            ? [{ href: `/team/${player?.teamAbbr}`, label: isZh ? "球队主页" : "Team page", icon: Users }]
            : []),
          { href: `/compare?p1=${personId}`, label: isZh ? "对比球员" : "Compare with another", icon: GitCompareArrows },
        ]}
      />
    </div>
  );
}
