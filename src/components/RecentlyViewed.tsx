"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, User, Users, Trophy } from "lucide-react";
import { getRecent, type RecentItem } from "@/lib/recentlyViewed";
import { useLocale } from "@/components/LocaleProvider";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import TeamLogo from "@/components/TeamLogo";
import { TEAM_META } from "@/lib/teams";

// Homepage component that surfaces a user's last 6-8 detail-page visits.
// Returns null on first visit (no history) — never shows an empty skeleton.
export default function RecentlyViewed() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getRecent(undefined, 8));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 mb-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 flex items-center gap-2">
          <Clock size={11} aria-hidden="true" />
          / {isZh ? "最近浏览" : "Recently viewed"}
        </p>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-mono tabular-nums text-text-secondary/60">{items.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {items.map((it) => {
          const href = it.kind === "player"
            ? `/player/${it.id}`
            : it.kind === "team"
            ? `/team/${it.id}`
            : `/game/${it.id}`;
          const KindIcon = it.kind === "player" ? User : it.kind === "team" ? Users : Trophy;

          return (
            <Link
              key={`${it.kind}-${it.id}`}
              href={href}
              className="glass-tile shrink-0 min-w-[140px] max-w-[220px] p-2.5 flex items-center gap-2 group cursor-pointer"
              aria-label={`${isZh ? "查看" : "View"} ${it.label}`}
            >
              {/* Avatar */}
              {it.kind === "player" ? (
                <PlayerHeadshot personId={Number(it.id)} name={it.label} size={32} />
              ) : it.kind === "team" && TEAM_META[it.id] ? (
                <TeamLogo teamId={TEAM_META[it.id].teamId} tricode={it.id} size={32} />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center shrink-0">
                  <KindIcon size={14} className="text-text-secondary" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-text-secondary/60">
                  {it.kind === "player" ? (isZh ? "球员" : "Player") : it.kind === "team" ? (isZh ? "球队" : "Team") : (isZh ? "比赛" : "Game")}
                </p>
                <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">{it.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
