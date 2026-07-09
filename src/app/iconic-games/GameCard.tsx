import Link from "next/link";
import Image from "next/image";
import { GitCompareArrows, Activity } from "lucide-react";
import { GAME_TAG_LABEL, type IconicGame } from "@/lib/iconicGames";
import { decadeOfYear } from "@/lib/decades";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl, teamLogoUrl } from "@/lib/teamUrls";
import { formatGameDate } from "@/lib/dates";

export default function GameCard({ game, isZh }: { game: IconicGame; isZh: boolean }) {
  const team = TEAM_META[game.team];
  const oppTeam = TEAM_META[game.opponent];
  const teamColor = team?.primaryColor || "#94A3B8";
  const title = isZh && game.titleZh ? game.titleZh : game.title;
  const story = isZh && game.storyZh ? game.storyZh : game.story;
  const isWin = game.result === "W";

  const dt = new Date(game.date + "T12:00:00");
  const dateLabel = formatGameDate(dt, isZh ? "zh" : "en", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div
      className="glass-tile relative overflow-hidden"
      data-game-card
      data-tags={(game.tags ?? []).join(" ")}
      data-decade={decadeOfYear(parseInt(game.date.slice(0, 4), 10))}
    >
      <div
        className="absolute inset-0 opacity-12 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 70%)` }}
      />

      <div className="relative p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary shrink-0 border border-border">
            <Image
              src={playerHeadshotUrl(game.personId, "260x190")}
              alt={game.name}
              width={56}
              height={56}
              unoptimized
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary leading-tight truncate">
              {title}
            </p>
            <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-medium">{game.name}</span>
              <span className="text-text-secondary/40">·</span>
              <span className="font-mono tabular-nums">{dateLabel}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-text-secondary">
              {team && (
                <Image src={teamLogoUrl(team.teamId)} alt="" width={12} height={12} unoptimized aria-hidden />
              )}
              <span className="font-mono">
                {game.team}
                <span className="text-text-secondary/40 mx-1">
                  {game.homeAway === "home" ? "vs" : "@"}
                </span>
                {game.opponent}
              </span>
              {oppTeam && (
                <Image src={teamLogoUrl(oppTeam.teamId)} alt="" width={12} height={12} unoptimized aria-hidden />
              )}
              <span className="text-text-secondary/40 mx-1">·</span>
              <span className={`font-bold font-mono tabular-nums ${isWin ? "text-success" : "text-danger"}`}>
                {game.result}
              </span>
              <span className="font-mono tabular-nums">{game.finalScore}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3 items-center mb-3">
          <div className="text-center">
            <p className="text-4xl font-light font-mono tabular-nums text-accent-amber leading-none">
              {game.pts}
            </p>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mt-0.5">PTS</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <StatPair label="REB" value={game.reb} />
            <StatPair label="AST" value={game.ast} />
            {game.stl !== undefined && <StatPair label="STL" value={game.stl} />}
            {game.blk !== undefined && <StatPair label="BLK" value={game.blk} />}
            {game.fg && <SplitPair label="FG" value={game.fg} />}
            {game.threeP && <SplitPair label="3P" value={game.threeP} />}
            {game.ft && <SplitPair label="FT" value={game.ft} />}
            {game.minutes !== undefined && <StatPair label="MIN" value={game.minutes} />}
          </div>
        </div>

        {game.tags && game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {game.tags.map((tag) => {
              const label = GAME_TAG_LABEL[tag];
              return (
                <span
                  key={tag}
                  className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/30"
                >
                  {isZh ? label.zh : label.en}
                </span>
              );
            })}
          </div>
        )}

        <p className="text-[12px] text-text-secondary leading-relaxed">
          {story}
        </p>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
          <Link
            href={`/compare?p1=${game.personId}`}
            className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <GitCompareArrows size={11} />
            {isZh ? "对比此球员" : "Compare player"}
          </Link>
          {game.gameId && (
            <Link
              href={`/game/${game.gameId}`}
              className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Activity size={11} />
              {isZh ? "完整 Box Score" : "Box score"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPair({ label, value }: { label: string; value: number }) {
  return (
    <span className="font-mono tabular-nums">
      <span className="text-text-primary font-semibold">{value}</span>
      <span className="text-text-secondary/60 text-[9px] uppercase tracking-[0.15em] ml-0.5">{label}</span>
    </span>
  );
}

function SplitPair({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-mono tabular-nums">
      <span className="text-text-secondary/60 text-[9px] uppercase tracking-[0.15em] mr-0.5">{label}</span>
      <span className="text-text-primary">{value}</span>
    </span>
  );
}
