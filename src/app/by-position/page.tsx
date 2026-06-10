import type { Metadata } from "next";
import Link from "next/link";
import { Users, Globe, GraduationCap, Award, Crown } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Leaders By Position",
  description: "Top NBA players grouped by position — guards, forwards, and centers ranked by composite production.",
};

interface PosPlayer {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  position: string;
  height: string;
  pts: number;
  reb: number;
  ast: number;
}

interface PosGroup {
  label: string;
  labelZh: string;
  eyebrow: string;
  eyebrowZh: string;
  description: string;
  descriptionZh: string;
  color: string;
  matches: (pos: string) => boolean;
  emoji: string;
}

const GROUPS: PosGroup[] = [
  {
    label: "Guards",
    labelZh: "后卫",
    eyebrow: "Backcourt",
    eyebrowZh: "后场",
    description: "Point guards and shooting guards — playmakers and scorers",
    descriptionZh: "控卫和分卫 — 组织者与得分手",
    color: "#3B82F6",
    matches: (pos) => /G/.test(pos) && !/F/.test(pos),
    emoji: "🎯",
  },
  {
    label: "Wings",
    labelZh: "锋卫",
    eyebrow: "Hybrid",
    eyebrowZh: "混合位",
    description: "Combo guards/forwards — modern positionless do-it-alls",
    descriptionZh: "锋卫摇摆人 — 现代无位置全能",
    color: "#A855F7",
    matches: (pos) => /G/.test(pos) && /F/.test(pos),
    emoji: "🦅",
  },
  {
    label: "Forwards",
    labelZh: "前锋",
    eyebrow: "Frontcourt",
    eyebrowZh: "前场",
    description: "Small and power forwards — versatile two-way operators",
    descriptionZh: "小前锋与大前锋 — 多面攻防",
    color: "#22C55E",
    matches: (pos) => /F/.test(pos) && !/G/.test(pos) && !/C/.test(pos),
    emoji: "⚔️",
  },
  {
    label: "Big Men",
    labelZh: "大个子",
    eyebrow: "Paint",
    eyebrowZh: "内线",
    description: "Centers and forward-centers — interior anchors",
    descriptionZh: "中锋与大前锋 — 内线核心",
    color: "#F59E0B",
    matches: (pos) => /C/.test(pos),
    emoji: "🗼",
  },
];

function score(p: { pts: number; reb: number; ast: number }) {
  return p.pts + p.reb * 1.2 + p.ast * 1.5;
}

export default async function ByPositionPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球员" : "Players"} icon={Users} title={isZh ? "按位置榜" : "Leaders By Position"} />
        <EmptyState icon={Users} title={isZh ? "暂无数据" : "No data"} description={isZh ? "无法加载球员索引。" : "Could not load player index."} />
      </div>
    );
  }

  const byGroup = GROUPS.map((g) => {
    const list: PosPlayer[] = players
      .filter((p) => p.position && g.matches(p.position) && p.pts > 0)
      .map((p) => ({
        personId: p.personId,
        firstName: p.firstName,
        lastName: p.lastName,
        teamAbbr: p.teamAbbr,
        position: p.position,
        height: p.height,
        pts: p.pts,
        reb: p.reb,
        ast: p.ast,
      }))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);
    return { group: g, list };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球员" : "Players"}
        icon={Users}
        title={isZh ? "按位置榜" : "Leaders By Position"}
        subtitle={isZh ? "每个位置桶的现役前 10 球员 · 按 PPG + RPG×1.2 + APG×1.5 排序 · 数据来自 NBA 球员索引（上赛季场均）" : "Top 10 active players in each positional bucket · ranked by PPG + RPG×1.2 + APG×1.5 · stats from NBA player index (last season averages)"}
      />

      <div className="space-y-6">
        {byGroup.map(({ group, list }) => {
          if (list.length === 0) return null;
          return (
            <section key={group.label} className="glass-tile p-5 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1.5 opacity-80" style={{ background: group.color }} />
              <div className="relative">
                <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? group.eyebrowZh : group.eyebrow}</p>
                    <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2" style={{ color: group.color }}>
                      <span className="text-3xl">{group.emoji}</span>
                      {isZh ? group.labelZh : group.label}
                    </h2>
                    <p className="text-xs text-text-secondary mt-1">{isZh ? group.descriptionZh : group.description}</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary tabular-nums">
                    {list.length} {isZh ? "已排名" : "ranked"}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((p, i) => {
                    const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                      : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                      : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                      : "bg-bg-hover text-text-secondary";
                    return (
                      <Link
                        key={p.personId}
                        href={`/player/${p.personId}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-hover/60 transition-colors group cursor-pointer"
                      >
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                          {i + 1}
                        </span>
                        <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate text-sm">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                            {p.teamAbbr || "—"} · {p.position} · {p.height}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">P/R/A</p>
                            <p className="text-sm font-mono tabular-nums text-text-primary">
                              {p.pts.toFixed(1)}/{p.reb.toFixed(1)}/{p.ast.toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/by-country", label: isZh ? "国别分布" : "By Country", description: isZh ? "按国家分组" : "Players by country", icon: Globe },
          { href: "/by-college", label: isZh ? "按大学榜" : "By College", description: isZh ? "按大学分组" : "Players by college", icon: GraduationCap },
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份" : "Active players by draft year", icon: GraduationCap },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards Race", description: isZh ? "MVP / ROY / DPOY" : "MVP / ROY / DPOY tracker", icon: Award },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "历史数据领跑者" : "Career stat leaders", icon: Crown },
        ]}
      />
    </div>
  );
}
