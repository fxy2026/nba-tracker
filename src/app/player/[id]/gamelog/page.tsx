import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows, User, Users } from "lucide-react";
import { getPlayerInfo, getPlayerHeadshotUrl } from "@/lib/api";
import { CURRENT_SEASON } from "@/lib/constants";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PlayerGameLog from "@/components/player/PlayerGameLog";
import { teamLogoUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) return {};
  const [player, locale] = await Promise.all([getPlayerInfo(personId), getLocale()]);
  if (!player) return {};
  const name = `${player.firstName} ${player.lastName}`;
  const isZh = locale === "zh";
  const title = isZh
    ? `${name} 比赛日志 — ${CURRENT_SEASON} 赛季逐场数据`
    : `${name} Game Log — ${CURRENT_SEASON} Season`;
  const desc = isZh
    ? `${name} ${CURRENT_SEASON} 赛季完整比赛日志：逐场得分、篮板、助攻、抢断、盖帽与月度拆分。`
    : `${name} full ${CURRENT_SEASON} game log: game-by-game points, rebounds, assists, steals, blocks plus monthly splits.`;
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

export default async function PlayerGameLogPage({ params }: PageProps) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  const [player, locale] = await Promise.all([getPlayerInfo(personId), getLocale()]);
  if (!player) notFound();

  const isZh = locale === "zh";
  const fullName = `${player.firstName} ${player.lastName}`;

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
            {isZh ? "比赛日志" : "Game log"} · {CURRENT_SEASON}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight truncate">
            {fullName}
          </h1>
          {player.teamAbbr && (
            <Link
              href={`/team/${player.teamAbbr}`}
              className="text-[11px] text-text-secondary hover:text-accent transition-colors font-medium cursor-pointer"
            >
              {player.teamCity} {player.teamName}
            </Link>
          )}
        </div>
        {player.teamId > 0 && (
          <Image
            src={teamLogoUrl(player.teamId)}
            alt={player.teamAbbr || ""}
            width={44}
            height={44}
            unoptimized
            className="opacity-70 shrink-0"
          />
        )}
      </div>

      {/* ─── Full season log + monthly splits (client fetch) ── */}
      <section className="mt-6">
        <PlayerGameLog playerId={personId} playerName={fullName} />
      </section>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: `/player/${personId}`, label: isZh ? "球员主页" : "Player profile", icon: User },
          ...(player.teamAbbr
            ? [{ href: `/team/${player.teamAbbr}`, label: isZh ? "球队主页" : "Team page", icon: Users }]
            : []),
          { href: `/compare?p1=${personId}`, label: isZh ? "对比球员" : "Compare with another", icon: GitCompareArrows },
        ]}
      />
    </div>
  );
}
