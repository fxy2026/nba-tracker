import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Crown } from "lucide-react";
import { getPlayerOfTheNight } from "@/lib/best-of-night";
import { gradeColorClass } from "@/lib/game-stats";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";

// Home page tile: the algorithmic Player of the Night, linking to the full
// top-10 at /best-of-night. Resilient by design — any fetch failure (cold
// schedule cache, CDN hiccup) renders nothing instead of erroring the home.
export default async function BestOfNightCard() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  let potn: Awaited<ReturnType<typeof getPlayerOfTheNight>> = null;
  try {
    potn = await getPlayerOfTheNight();
  } catch {
    return null;
  }
  if (!potn) return null;

  const p = potn.performer;
  const teamColor = TEAM_META[p.teamTricode]?.primaryColor || "#3B82F6";
  const [y, m, d] = potn.date.split("-").map(Number);
  const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mt-4">
      <Link
        href="/best-of-night"
        className="glass-tile relative overflow-hidden p-4 cursor-pointer hover:border-accent/40 transition-colors group block"
      >
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 70%)` }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={12} className="text-accent-amber" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber">
              {isZh ? "本日最佳" : "Player of the Night"}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-text-secondary/60">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary border border-border shrink-0">
              <Image
                src={playerHeadshotUrl(p.personId, "260x190")}
                alt={p.name}
                width={56}
                height={56}
                unoptimized
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text-primary truncate">{p.name}</p>
              <p className="text-[11px] font-mono tabular-nums text-text-secondary">
                <span className="text-accent-amber">{p.points} PTS</span>
                <span className="text-text-secondary/40 mx-1.5">·</span>
                <span>{p.rebounds} REB</span>
                <span className="text-text-secondary/40 mx-1.5">·</span>
                <span>{p.assists} AST</span>
                <span className="text-text-secondary/40 mx-1.5">·</span>
                <span className={p.won ? "text-success" : "text-danger"}>
                  {p.teamTricode} {p.teamScore}-{p.oppScore} {p.oppTricode}
                </span>
              </p>
            </div>
            <span
              className={`shrink-0 px-2 py-1 rounded-lg font-mono font-bold tabular-nums text-base ${gradeColorClass(p.grade)}`}
            >
              {p.grade.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary group-hover:text-accent transition-colors">
            {isZh ? "查看当晚十佳" : "See the night's top 10"}
            <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </Link>
    </div>
  );
}
