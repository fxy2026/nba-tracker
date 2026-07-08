import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, Crown, Sparkles, School, Users } from "lucide-react";
import { getPlayerIndex, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { projectDraft, espnAbbrToTricode, type DraftPick } from "@/lib/draft";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import PlayerHeadshot from "@/components/PlayerHeadshot";

const DRAFT_YEAR = 2026;

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "2026 NBA 选秀" : "2026 NBA Draft",
    description: isZh
      ? "2026 年 NBA 选秀逐顺位结果 —— 球队、位置、大学一览。"
      : "Every pick of the 2026 NBA Draft — round by round, with team, position, and college.",
    alternates: { canonical: "/draft/2026" },
  };
}

async function getDraft(year: number): Promise<DraftPick[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft?year=${year}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    if (typeof json !== "object" || json === null || !Array.isArray((json as { picks?: unknown }).picks)) return [];
    return projectDraft(json);
  } catch {
    return [];
  }
}

function teamOf(pick: DraftPick) {
  return TEAM_META[espnAbbrToTricode(pick.teamAbbr)] ?? null;
}

function PickHeadshot({ pick, personId, size = 28 }: { pick: DraftPick; personId?: number; size?: number }) {
  if (personId) return <PlayerHeadshot personId={personId} name={pick.playerName} size={size} />;
  if (pick.headshot) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as NewsFeed
      <img
        src={pick.headshot}
        alt={pick.playerName}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
        className="rounded-full object-cover object-top bg-bg-secondary shrink-0"
      />
    );
  }
  return (
    <div
      className="rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0"
      style={{ width: size, height: size }}
    >
      {pick.playerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
    </div>
  );
}

function PlayerCell({ pick, personId }: { pick: DraftPick; personId?: number }) {
  const inner = (
    <span className="flex items-center gap-2 min-w-0">
      <PickHeadshot pick={pick} personId={personId} size={28} />
      <span className="font-medium text-text-primary truncate">{pick.playerName || "—"}</span>
    </span>
  );
  if (personId) {
    return <Link href={`/player/${personId}`} className="hover:text-accent transition-colors">{inner}</Link>;
  }
  if (pick.espnLink) {
    return <a href={pick.espnLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{inner}</a>;
  }
  return inner;
}

export default async function DraftPage() {
  const isZh = (await getLocale()) === "zh";
  const [picks, players] = await Promise.all([
    getDraft(DRAFT_YEAR),
    getPlayerIndex().catch(() => []),
  ]);

  const nameToId = new Map<string, number>();
  for (const p of players) {
    nameToId.set(`${p.firstName} ${p.lastName}`.toLowerCase().trim(), p.personId);
  }
  const idFor = (name: string) => nameToId.get(name.toLowerCase().trim());

  const breadcrumbs = (
    <Breadcrumbs items={[{ label: isZh ? "选秀届" : "Draft", href: "/draft-classes" }, { label: isZh ? "2026 选秀" : "2026 Draft" }]} />
  );

  if (picks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "选秀" : "Draft"} icon={GraduationCap} title={isZh ? "2026 NBA 选秀" : "2026 NBA Draft"} />
        <EmptyState
          icon={GraduationCap}
          title={isZh ? "暂无选秀数据" : "No draft data"}
          description={isZh ? "无法加载选秀结果，请稍后再试。" : "Could not load the draft board. Check back later."}
        />
      </div>
    );
  }

  const sorted = [...picks].sort((a, b) => a.overall - b.overall);
  const topPick = sorted[0];
  const topId = topPick ? idFor(topPick.playerName) : undefined;
  const topTeam = topPick ? teamOf(topPick) : null;

  const byRound = new Map<number, DraftPick[]>();
  for (const p of sorted) {
    const arr = byRound.get(p.round) || [];
    arr.push(p);
    byRound.set(p.round, arr);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "选秀" : "Draft"}
        icon={GraduationCap}
        title={isZh ? "2026 NBA 选秀" : "2026 NBA Draft"}
        subtitle={isZh ? `逐顺位结果 · 共 ${sorted.length} 个签` : `Pick-by-pick results · ${sorted.length} selections`}
        updatedAt={getScheduleAge()}
      />

      {topPick && (
        <section className="glass-tile p-5 mb-6 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative flex items-center gap-4">
            <PickHeadshot pick={topPick} personId={topId} size={64} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 flex items-center gap-1.5">
                <Crown size={11} className="text-accent-amber" /> {isZh ? "状元签" : "First Overall"}
              </p>
              {topId ? (
                <Link href={`/player/${topId}`} className="text-2xl font-semibold text-text-primary hover:text-accent transition-colors">
                  {topPick.playerName}
                </Link>
              ) : (
                <p className="text-2xl font-semibold text-text-primary">{topPick.playerName || "—"}</p>
              )}
              <p className="text-xs text-text-secondary mt-1">
                {[topPick.position, topPick.college].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            {topTeam && (
              <Link href={`/team/${topTeam.tricode}`} className="shrink-0 flex flex-col items-center gap-1 group">
                <Image src={teamLogoUrl(topTeam.teamId)} alt={topTeam.tricode} width={48} height={48} unoptimized />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary group-hover:text-accent transition-colors">{topTeam.tricode}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {rounds.map(([round, list]) => (
          <section key={round} className="glass-tile overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <GraduationCap size={16} className="text-accent" />
              <h2 className="font-semibold text-sm">{isZh ? `第 ${round} 轮` : `Round ${round}`}</h2>
              <span className="text-[10px] font-mono text-text-secondary tabular-nums">· {list.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary text-xs">
                    <th className="text-center py-3 px-3 w-14">#</th>
                    <th className="text-left py-3 px-3">{isZh ? "球员" : "Player"}</th>
                    <th className="text-center py-3 px-2">{isZh ? "位置" : "Pos"}</th>
                    <th className="text-left py-3 px-3">{isZh ? "大学 / 来源" : "College / From"}</th>
                    <th className="text-center py-3 px-3">{isZh ? "球队" : "Team"}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const meta = teamOf(p);
                    const pid = idFor(p.playerName);
                    return (
                      <tr key={p.overall} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                        <td className="text-center py-2.5 px-3 font-mono tabular-nums text-text-secondary">{p.overall}</td>
                        <td className="py-2.5 px-3"><PlayerCell pick={p} personId={pid} /></td>
                        <td className="text-center py-2.5 px-2 text-text-secondary">{p.position || "-"}</td>
                        <td className="py-2.5 px-3 text-text-secondary truncate max-w-[160px]">{p.college || "-"}</td>
                        <td className="py-2.5 px-3">
                          {meta ? (
                            <Link href={`/team/${meta.tricode}`} className="flex items-center justify-center gap-1.5 hover:text-accent transition-colors">
                              <Image src={teamLogoUrl(meta.teamId)} alt={meta.tricode} width={22} height={22} unoptimized />
                              <span className="font-mono text-xs text-text-secondary">{meta.tricode}</span>
                            </Link>
                          ) : (
                            <span className="flex items-center justify-center font-mono text-xs text-text-secondary">{p.teamAbbr || "-"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "关于" : "About"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "数据来自 ESPN。球员链接仅在其已进入现役球员索引时可用 —— 否则显示 ESPN 头像与外部链接（ESPN 球员 ID 与 NBA personId 不通用，只能按姓名匹配）。"
            : "Data from ESPN. A player links to their profile only once they enter the active player index — otherwise the ESPN headshot and an external link are shown (ESPN athlete IDs are not NBA personIds, so linking is name-match only)."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "现役球员按选秀年份分组" : "Active players by draft year", icon: GraduationCap },
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本季顶级新秀" : "Top rookies this season", icon: Sparkles },
          { href: "/by-college", label: isZh ? "按大学榜" : "By College", description: isZh ? "NBA 输送名校" : "NBA pipeline schools", icon: School },
          { href: "/by-position", label: isZh ? "按位置榜" : "By Position", description: isZh ? "按位置分组领袖" : "Leaders by position", icon: Users },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "生涯数据领跑者" : "Career stat leaders", icon: Crown },
        ]}
      />
    </div>
  );
}
