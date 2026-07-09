"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Activity, ListOrdered, Crown, Heart, Award, Newspaper } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/components/LocaleProvider";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { espnAbbrToTricode } from "@/lib/draft";
import { formatGameDate } from "@/lib/dates";

interface Transaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
  players: string[];
  kind: string;
  teamLogo: string;
}

interface PlayerIndexEntry {
  personId: number;
  firstName: string;
  lastName: string;
}

function getKindColor(kind: string) {
  switch (kind) {
    case "traded": return "bg-accent/15 text-accent";
    case "signed": return "bg-success/15 text-success";
    case "waived": return "bg-danger/15 text-danger";
    case "claimed": return "bg-warning/15 text-warning";
    default: return "bg-bg-hover text-text-secondary";
  }
}

function kindLabel(kind: string, isZh: boolean) {
  const map: Record<string, [string, string]> = {
    signed: ["签约", "Signed"],
    traded: ["交易", "Traded"],
    waived: ["裁掉", "Waived"],
    claimed: ["认领", "Claimed"],
    other: ["动态", "Move"],
  };
  const pair = map[kind] ?? map.other;
  return isZh ? pair[0] : pair[1];
}

export default function TransactionsPage() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [playerIndex, setPlayerIndex] = useState<PlayerIndexEntry[]>([]);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/transactions?limit=150", { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ transactions: [] })),
      fetch("/api/player-index", { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
    ])
      .then(([txData, piData]) => {
        const list: Transaction[] = (txData.transactions || []).map((t: Transaction) => ({
          ...t,
          players: t.players ?? [],
          kind: t.kind ?? "other",
          teamLogo: t.teamLogo ?? "",
        }));
        setTransactions(list);
        setPlayerIndex(piData.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const nameToId = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of playerIndex) m.set(`${p.firstName} ${p.lastName}`.toLowerCase().trim(), p.personId);
    return m;
  }, [playerIndex]);
  const resolvePlayerId = (name: string) => nameToId.get(name.toLowerCase().trim()) ?? null;

  const teamAbbrs = useMemo(
    () => [...new Set(transactions.map((t) => t.teamAbbr).filter(Boolean))].sort(),
    [transactions]
  );

  const visible = teamFilter ? transactions.filter((t) => t.teamAbbr === teamFilter) : transactions;

  // Group the (filtered) set by date
  const grouped = new Map<string, Transaction[]>();
  for (const t of visible) {
    const dateKey = t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date";
    const arr = grouped.get(dateKey) || [];
    arr.push(t);
    grouped.set(dateKey, arr);
  }

  const sortedDates = [...grouped.keys()].sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });

  const chipCls = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
      active ? "bg-accent text-white" : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "新闻" : "News" },
          { label: isZh ? "交易动态" : "Transactions" },
        ]}
      />
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        {isZh ? "返回首页" : "Back to home"}
      </Link>

      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={ArrowLeftRight}
        title={isZh ? "NBA 交易动态" : "NBA Transactions"}
        action={!loading && transactions.length > 0 ? (
          <span className="chip font-mono"><span className="tabular-nums">{transactions.length}</span> {isZh ? "条最新" : "recent"}</span>
        ) : undefined}
        className="mt-4"
      />

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-5 w-40 skeleton-shimmer rounded mb-2" />
              <div className="h-16 skeleton-shimmer rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Team filter — derived from unique teamAbbr present in the feed */}
      {!loading && teamAbbrs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "球队" : "Teams"}
          </span>
          <button onClick={() => setTeamFilter(null)} className={chipCls(!teamFilter)}>
            {isZh ? "全部" : "All"}
          </button>
          {teamAbbrs.map((abbr) => (
            <button
              key={abbr}
              onClick={() => setTeamFilter(teamFilter === abbr ? null : abbr)}
              className={`${chipCls(teamFilter === abbr)} font-mono`}
            >
              {abbr}
            </button>
          ))}
        </div>
      )}

      {/* Category counts — driven by parsed `kind` over the filtered set */}
      {!loading && visible.length > 0 && (() => {
        const counts: Record<string, number> = { traded: 0, signed: 0, waived: 0, claimed: 0, other: 0 };
        for (const t of visible) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
        const chips: { key: string; label: string; cls: string }[] = [
          { key: "traded", label: isZh ? "交易" : "trades", cls: "bg-accent/15 text-accent" },
          { key: "signed", label: isZh ? "签约" : "signings", cls: "bg-success/15 text-success" },
          { key: "waived", label: isZh ? "裁掉" : "waivers", cls: "bg-danger/15 text-danger" },
          { key: "claimed", label: isZh ? "认领" : "claims", cls: "bg-warning/15 text-warning" },
        ];
        return (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {chips.filter((c) => counts[c.key] > 0).map((c) => (
              <span key={c.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.cls}`}>
                <span className="tabular-nums">{counts[c.key]}</span> {c.label}
              </span>
            ))}
            <span className="text-[10px] text-text-secondary ml-1">{visible.length} {isZh ? "条" : "total"}</span>
          </div>
        );
      })()}

      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title={isZh ? "暂无最新交易动态" : "No recent transactions available"}
          description={isZh ? "稍后回来看看更新" : "Check back later for updates"}
          action={{ href: "/injuries", label: isZh ? "查看伤病" : "View injuries" }}
        />
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-8">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-bg-primary z-10" />

                <h2 className="text-sm font-semibold text-text-secondary mb-2">
                  {(() => {
                    const d = new Date(dateKey);
                    if (isNaN(d.getTime())) return dateKey;
                    return formatGameDate(d, isZh ? "zh" : "en", { month: "long", day: "numeric", year: "numeric" });
                  })()}
                  {(() => {
                    const d = new Date(dateKey);
                    if (isNaN(d.getTime())) return null;
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    let relative = "";
                    if (diffDays === 0) relative = isZh ? "今天" : "today";
                    else if (diffDays === 1) relative = isZh ? "昨天" : "yesterday";
                    else if (diffDays > 1 && diffDays < 365) relative = isZh ? `${diffDays} 天前` : `${diffDays} days ago`;
                    if (!relative) return null;
                    return <span className="text-xs text-text-secondary/70 font-normal ml-2">({relative})</span>;
                  })()}
                </h2>
                <div className="space-y-2">
                  {grouped.get(dateKey)!.map((t, idx) => (
                    <div key={`${dateKey}-${idx}`} className="glass-tile p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {t.teamLogo ? (
                          <span className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as PlayerNews */}
                            <img src={t.teamLogo} alt="" width={20} height={20} loading="lazy" className="w-5 h-5 object-contain" />
                          </span>
                        ) : null}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getKindColor(t.kind)}`}>
                          {kindLabel(t.kind, isZh)}
                        </span>
                        {t.teamAbbr ? (
                          <Link href={`/team/${espnAbbrToTricode(t.teamAbbr)}`} className="text-sm font-medium text-text-primary hover:text-accent transition-colors">{t.team}</Link>
                        ) : (
                          <span className="text-sm font-medium text-text-primary">{t.team}</span>
                        )}
                        {t.teamAbbr && (
                          <Link href={`/team/${espnAbbrToTricode(t.teamAbbr)}`} className="text-xs text-text-secondary hover:text-accent transition-colors">({t.teamAbbr})</Link>
                        )}
                      </div>
                      {t.players.length > 0 ? (
                        <p className="text-sm text-accent font-medium flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {t.players.map((name, i) => {
                            const pid = resolvePlayerId(name);
                            return pid ? (
                              <Link key={`${name}-${i}`} href={`/player/${pid}`} className="hover:underline">{name}</Link>
                            ) : (
                              <span key={`${name}-${i}`}>{name}</span>
                            );
                          })}
                        </p>
                      ) : t.player ? (
                        <p className="text-sm text-accent font-medium">{t.player}</p>
                      ) : null}
                      {t.description && (
                        <p className="text-xs text-text-secondary mt-1">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/news", label: isZh ? "联盟资讯" : "League news", icon: Newspaper },
          { href: "/injuries", label: isZh ? "伤病报告" : "Injuries", icon: Activity },
          { href: "/standings", label: isZh ? "排行榜" : "Standings", icon: ListOrdered },
          { href: "/history", label: isZh ? "历届冠军" : "Champions", icon: Crown },
          { href: "/favorites", label: isZh ? "我的收藏" : "My favorites", icon: Heart },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards race", icon: Award },
        ]}
      />
    </div>
  );
}
