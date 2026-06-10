import Link from "next/link";
import Image from "next/image";
import { Flame, GitCompareArrows, ArrowRight, Crown } from "lucide-react";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import { ICONIC_GAMES } from "@/lib/iconicGames";
import { SEASON_DECADES } from "@/lib/decades";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";

// Deterministic pick of the day. Hashing on the calendar date gives every
// visitor the same picks for the same day, so two friends loading the home
// page within the same UTC day see identical iconic-of-the-day surfaces —
// makes the "did you see today's matchup?" social moment work.
function pickFor(dateStr: string) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  const sIdx = Math.abs(hash) % ICONIC_SEASONS.length;
  const gIdx = Math.abs(hash >> 8) % ICONIC_GAMES.length;
  return { season: ICONIC_SEASONS[sIdx], game: ICONIC_GAMES[gIdx] };
}

export default async function DailyIconicPick() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const today = new Date().toISOString().slice(0, 10);
  const { season, game } = pickFor(today);

  const sTeam = TEAM_META[season.team];
  const gTeam = TEAM_META[game.team];

  return (
    <div className="mt-10 mb-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ 03</p>
        <h2 className="text-base font-semibold text-text-primary tracking-tight">
          {isZh ? "今日精选" : "Daily Pick"}
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber flex items-center gap-1">
          <Flame size={11} />
          {isZh ? "每日轮换" : "Rotates daily"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Iconic season pick */}
        <Link
          href={`/compare?p1=${encodeURIComponent(season.id)}`}
          className="glass-tile relative overflow-hidden p-4 cursor-pointer hover:border-accent/40 transition-colors group"
        >
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${sTeam?.primaryColor ?? "#94A3B8"}55 0%, transparent 70%)` }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={12} className="text-accent-amber" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber">
                {isZh ? "经典赛季" : "Iconic Season"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary border border-border shrink-0">
                <Image
                  src={playerHeadshotUrl(season.personId)}
                  alt={season.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text-primary truncate">{season.name}</p>
                <p className="text-[11px] font-mono tabular-nums text-text-secondary">
                  <span className="text-accent">{season.season}</span>
                  <span className="text-text-secondary/40 mx-1.5">·</span>
                  <span className="text-accent-amber">{season.ppg.toFixed(1)} PPG</span>
                  <span className="text-text-secondary/40 mx-1.5">·</span>
                  <span>{season.team}</span>
                </p>
              </div>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed mt-3 line-clamp-2">
              {isZh && season.storyZh ? season.storyZh : season.story}
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary group-hover:text-accent transition-colors">
              <GitCompareArrows size={11} />
              {isZh ? "对比此赛季" : "Launch comparison"}
              <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        {/* Iconic game pick */}
        <Link
          href={`/compare?p1=${game.personId}`}
          className="glass-tile relative overflow-hidden p-4 cursor-pointer hover:border-accent/40 transition-colors group"
        >
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${gTeam?.primaryColor ?? "#94A3B8"}55 0%, transparent 70%)` }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={12} className="text-accent" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">
                {isZh ? "经典之夜" : "Iconic Game"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary border border-border shrink-0">
                <Image
                  src={playerHeadshotUrl(game.personId)}
                  alt={game.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text-primary truncate">
                  {isZh && game.titleZh ? game.titleZh : game.title}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-text-secondary">
                  <span className="text-accent-amber">{game.pts} PTS</span>
                  <span className="text-text-secondary/40 mx-1.5">·</span>
                  <span>{game.name}</span>
                  <span className="text-text-secondary/40 mx-1.5">·</span>
                  <span>{game.date.slice(0, 4)}</span>
                </p>
              </div>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed mt-3 line-clamp-2">
              {isZh && game.storyZh ? game.storyZh : game.story}
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary group-hover:text-accent transition-colors">
              <GitCompareArrows size={11} />
              {isZh ? "对比此球员" : "Compare player"}
              <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      {/* Decade quick-nav — surfaces the per-decade landing pages from the home */}
      <div className="mt-3 flex items-center flex-wrap gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60 mr-1">
          {isZh ? "按年代浏览" : "Browse by decade"}
        </span>
        {SEASON_DECADES.map((d) => (
          <Link
            key={d}
            href={`/iconic-seasons/${d}`}
            className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border border-border bg-bg-secondary/40 text-text-secondary hover:border-accent/40 hover:text-text-primary cursor-pointer"
          >
            {d}
          </Link>
        ))}
      </div>
    </div>
  );
}
