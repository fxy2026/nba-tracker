"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Activity, ListOrdered, Crown, Heart, Award } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/components/LocaleProvider";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

interface Transaction {
  date: string;
  team: string;
  teamAbbr: string;
  player: string;
  type: string;
  description: string;
}

export default function TransactionsPage() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/transactions", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Group by date
  const grouped = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const dateKey = t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date";
    const arr = grouped.get(dateKey) || [];
    arr.push(t);
    grouped.set(dateKey, arr);
  }

  // Sort dates descending
  const sortedDates = [...grouped.keys()].sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });

  function getTypeColor(type: string) {
    const lower = type.toLowerCase();
    if (lower.includes("trade")) return "bg-accent/15 text-accent";
    if (lower.includes("sign")) return "bg-success/15 text-success";
    if (lower.includes("waiv")) return "bg-danger/15 text-danger";
    return "bg-bg-hover text-text-secondary";
  }

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

      {/* Feature 12: Transaction category counts */}
      {!loading && transactions.length > 0 && (() => {
        let trades = 0, signings = 0, waivers = 0, others = 0;
        for (const t of transactions) {
          const lower = t.type.toLowerCase();
          if (lower.includes("trade")) trades++;
          else if (lower.includes("sign")) signings++;
          else if (lower.includes("waiv")) waivers++;
          else others++;
        }
        return (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {trades > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">{trades} trade{trades !== 1 ? "s" : ""}</span>
            )}
            {signings > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">{signings} signing{signings !== 1 ? "s" : ""}</span>
            )}
            {waivers > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 text-danger font-medium">{waivers} waiver{waivers !== 1 ? "s" : ""}</span>
            )}
            {others > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-bg-hover text-text-secondary font-medium">{others} other{others !== 1 ? "s" : ""}</span>
            )}
            <span className="text-[10px] text-text-secondary ml-1">{transactions.length} total</span>
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
                  {dateKey}
                  {(() => {
                    const d = new Date(dateKey);
                    if (isNaN(d.getTime())) return null;
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    let relative = "";
                    if (diffDays === 0) relative = "today";
                    else if (diffDays === 1) relative = "yesterday";
                    else if (diffDays > 1 && diffDays < 365) relative = `${diffDays} days ago`;
                    if (!relative) return null;
                    return <span className="text-xs text-text-secondary/70 font-normal ml-2">({relative})</span>;
                  })()}
                </h2>
                <div className="space-y-2">
                  {grouped.get(dateKey)!.map((t, idx) => (
                    <div
                      key={`${dateKey}-${idx}`}
                      className="glass-tile p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getTypeColor(t.type)}`}>
                          {t.type}
                        </span>
                        {t.teamAbbr ? (
                          <Link href={`/team/${t.teamAbbr}`} className="text-sm font-medium text-text-primary hover:text-accent transition-colors">{t.team}</Link>
                        ) : (
                          <span className="text-sm font-medium text-text-primary">{t.team}</span>
                        )}
                        {t.teamAbbr && (
                          <Link href={`/team/${t.teamAbbr}`} className="text-xs text-text-secondary hover:text-accent transition-colors">({t.teamAbbr})</Link>
                        )}
                      </div>
                      {t.player && (
                        <p className="text-sm text-accent font-medium">{t.player}</p>
                      )}
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
