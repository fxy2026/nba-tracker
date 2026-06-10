import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { Activity, Target, BarChart3, GitCompare, Crown, Flame } from "lucide-react";
import { getPlayerInfo } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

// The interactive arc (career trend + season-scrubbed shot zones) fetches all
// of its data on the client through /api/player + /api/player-shots — the
// stats.nba.com career/shot endpoints block Vercel IPs server-side, exactly
// like the /player/[id] page. So we resolve only the player's NAME on the
// server (for metadata + header) and hand the heavy chart off to the client.
const CareerArc = nextDynamic(() => import("./CareerArc"));

// LeBron James — the default subject when no ?id is supplied.
const DEFAULT_ID = 2544;

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

interface ResolvedPlayer {
  personId: number;
  name: string;
  teamAbbr: string;
}

// Resolve a player's display name + most-associated team from the data we can
// read on the server: the active-player index (CDN) and the static all-time
// leaders table (covers retired legends the index omits). Falls back to a
// generic label so the page still renders for ids we can't name server-side —
// the client then fills in the real career data either way.
async function resolvePlayer(id: number): Promise<ResolvedPlayer> {
  const active = await getPlayerInfo(id).catch(() => null);
  if (active) {
    return {
      personId: id,
      name: `${active.firstName} ${active.lastName}`.trim(),
      teamAbbr: active.teamAbbr,
    };
  }
  const legend = ALL_TIME_LEADERS.find((p) => p.personId === id);
  if (legend) {
    return { personId: id, name: legend.name, teamAbbr: legend.team };
  }
  return { personId: id, name: "", teamAbbr: "" };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { id } = await searchParams;
  const personId = Number(id) || DEFAULT_ID;
  const [player, locale] = await Promise.all([resolvePlayer(personId), getLocale()]);
  const isZh = locale === "zh";
  const name = player.name || (isZh ? "球员" : "Player");

  const title = isZh ? `${name} · 生涯弧线` : `${name} — Career Arc`;
  const description = isZh
    ? `${name} 的逐赛季数据曲线（得分/篮板/助攻/命中率/出场时间）与可拖动的赛季投篮热区图，一图看尽生涯起伏。`
    : `${name}'s season-by-season stat trends (PPG / RPG / APG / FG% / MIN) and a draggable season shot-zone heatmap — the whole career arc in one view.`;

  return {
    title,
    description,
    alternates: { canonical: "/lab/career-arc" },
    openGraph: {
      title,
      description,
      images: player.personId ? [playerHeadshotUrl(player.personId)] : undefined,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CareerArcPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const personId = Number(id) || DEFAULT_ID;
  const [player, locale] = await Promise.all([resolvePlayer(personId), getLocale()]);
  const isZh = locale === "zh";

  const toolTitle = isZh ? "球员生涯弧线" : "Player Career Arc";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "数据实验室" : "Data Lab", href: "/lab" },
          { label: toolTitle },
        ]}
      />

      <PageHeader
        eyebrow={isZh ? "数据实验室" : "Data Lab"}
        icon={Activity}
        title={toolTitle}
        subtitle={
          isZh
            ? "逐赛季数据曲线 + 可拖动赛季的投篮热区，看清一名球员的成长、巅峰与衰退。"
            : "Season-by-season stat curves plus a draggable shot-zone heatmap — trace a player's rise, peak, and decline."
        }
      />

      <CareerArc
        playerId={player.personId}
        playerName={player.name}
        teamTricode={player.teamAbbr}
      />

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/lab", label: isZh ? "数据实验室" : "Data Lab", description: isZh ? "更多互动分析工具" : "More interactive analytics tools", icon: Activity },
          { href: `/player/${player.personId}`, label: isZh ? "球员档案" : "Player Profile", description: isZh ? "完整赛季数据与比赛日志" : "Full season stats & game logs", icon: Target },
          { href: "/compare", label: isZh ? "球员对比" : "Player Compare", description: isZh ? "并排比较两名球员" : "Two players side by side", icon: GitCompare },
          { href: "/stats", label: isZh ? "数据排行榜" : "Stat Leaderboards", description: isZh ? "本赛季各项数据领跑者" : "This season's category leaders", icon: BarChart3 },
          { href: "/all-time-leaders", label: isZh ? "历史巨星" : "All-Time Legends", description: isZh ? "历史得分/篮板/助攻榜" : "Career scoring, rebounding & assist kings", icon: Crown },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季最精彩对决" : "Season's standout matchups", icon: Flame },
        ]}
      />
    </div>
  );
}
