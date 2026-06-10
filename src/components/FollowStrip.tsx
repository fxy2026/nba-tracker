"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { getFavoriteTeams } from "@/lib/favorites";
import { localTz } from "@/lib/timezone";
import TeamLogo from "@/components/TeamLogo";
import type { FollowDigest, TeamDigest, DigestGame } from "@/lib/follow-digest-types";

// The HOME "你的关注 / Following" strip — teams only, light and glanceable.
// Reads localStorage favorites only AFTER a post-mount flag flips (SSR-safe:
// favorites are unknowable during the server render — mirrors the gate in
// DateNav/OnlineStatus). Renders NOTHING for users without follows so it never
// pushes the scoreboard down or causes a hydration mismatch.
export default function FollowStrip() {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag: favorites live in localStorage, unknowable during SSR
  useEffect(() => setMounted(true), []);

  const [favTeams, setFavTeams] = useState<string[]>([]);
  const [digest, setDigest] = useState<FollowDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Read favorites + fetch the digest only once we're past hydration.
  useEffect(() => {
    if (!mounted) return;
    const teams = getFavoriteTeams();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount localStorage read, intentionally deferred from first paint
    setFavTeams(teams);
    if (teams.length === 0) return;

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/follow-digest?teams=${encodeURIComponent(teams.join(","))}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("follow-digest failed");
        return res.json();
      })
      .then((data: FollowDigest) => {
        setDigest(data);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [mounted]);

  // SSR + first client paint + users with no followed teams: render nothing so
  // the scoreboard stays at the top and the HTML matches across hydration.
  if (!mounted || favTeams.length === 0) return null;
  // A failed fetch on the home strip stays silent — the favorites dashboard is
  // the place to surface errors; here we just don't crowd the scoreboard.
  if (error) return null;

  const teams = digest?.teams ?? [];

  return (
    <section className="mt-4 mb-1 animate-fade-in" aria-label={isZh ? "你的关注" : "Following"}>
      {/* Eyebrow + heading — matches the editorial section headers used across
          the home page (RecentlyViewed / League Pulse). */}
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 flex items-center gap-2">
          <Star size={11} aria-hidden="true" className="fill-accent-amber text-accent-amber" />
          / {isZh ? "你的关注" : "Following"}
        </p>
        <span className="h-px flex-1 bg-border" />
        {favTeams.length > 0 && (
          <Link
            href="/favorites"
            className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 hover:text-accent transition-colors flex items-center gap-0.5"
          >
            {isZh ? "全部" : "All"}
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Horizontally-scrollable on mobile, wrap-grid on wider screens. One row
          height — the strip never dominates the page. */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
        {loading
          ? favTeams.map((tri) => <TeamCardSkeleton key={tri} />)
          : teams.map((team) => <TeamCard key={team.tricode} team={team} isZh={isZh} />)}
      </div>
    </section>
  );
}

function TeamCardSkeleton() {
  return (
    <div className="glass-tile shrink-0 snap-start w-[230px] sm:w-auto p-3.5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="skeleton-shimmer w-9 h-9 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton-shimmer h-3.5 w-24 rounded" />
          <div className="skeleton-shimmer h-2.5 w-16 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-3/4 rounded" />
      </div>
    </div>
  );
}

function TeamCard({ team, isZh }: { team: TeamDigest; isZh: boolean }) {
  const record = `${team.wins}-${team.losses}`;
  // streak is "W3" / "L2" / "" — tint it by direction for at-a-glance read.
  const streakWin = team.streak.startsWith("W");
  const streakLoss = team.streak.startsWith("L");

  return (
    <Link
      href={`/team/${team.tricode}`}
      className="glass-tile group relative shrink-0 snap-start w-[230px] sm:w-auto p-3.5 pl-4 cursor-pointer overflow-hidden block"
      style={{
        // Faint team-color wash from the left so each card reads as "its" team
        // without overpowering the glass surface.
        background: `linear-gradient(90deg, ${team.primaryColor}1A 0%, transparent 55%)`,
      }}
      aria-label={`${team.city} ${team.name}`}
    >
      {/* Thin team-color accent bar pinned to the left edge. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: team.primaryColor }}
      />

      {/* Anchor row — logo + name + record/rank/streak */}
      <div className="flex items-center gap-2.5 mb-3">
        <TeamLogo teamId={team.teamId} tricode={team.tricode} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
              {team.tricode}
            </span>
            <span className="text-[11px] text-text-secondary truncate">{team.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-text-secondary/80">
            <span>{record}</span>
            {team.conferenceRank !== null && (
              <>
                <span className="text-text-secondary/40">·</span>
                <span>
                  {team.conference === "East" ? (isZh ? "东" : "E") : isZh ? "西" : "W"}
                  {team.conferenceRank}
                </span>
              </>
            )}
            {team.streak && (
              <>
                <span className="text-text-secondary/40">·</span>
                <span
                  className={
                    streakWin
                      ? "text-success"
                      : streakLoss
                      ? "text-danger"
                      : "text-text-secondary"
                  }
                >
                  {team.streak}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Last + next as labeled sub-rows */}
      <div className="space-y-1.5">
        <LastRow game={team.lastGame} isZh={isZh} />
        <NextRow game={team.nextGame} isZh={isZh} />
      </div>
    </Link>
  );
}

function LastRow({ game, isZh }: { game: DigestGame | null; isZh: boolean }) {
  const label = isZh ? "上场" : "Last";
  if (!game || game.teamScore === undefined || game.oppScore === undefined) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <RowLabel>{label}</RowLabel>
        <span className="text-text-secondary/60">{isZh ? "暂无" : "—"}</span>
      </div>
    );
  }
  const won = game.win === true;
  const live = game.status === 2;
  return (
    <div className="flex items-center gap-2 text-[11px] min-w-0">
      <RowLabel>{label}</RowLabel>
      {/* Colored W/L pill — success on a win, danger on a loss. Live games show
          a pulsing "LIVE" pill instead so an in-progress score isn't mislabeled. */}
      {live ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-success/15 text-success shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          {isZh ? "进行中" : "Live"}
        </span>
      ) : (
        <span
          className={`inline-flex items-center justify-center w-4 h-4 rounded-md text-[9px] font-bold shrink-0 ${
            won ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
          }`}
        >
          {won ? (isZh ? "胜" : "W") : isZh ? "负" : "L"}
        </span>
      )}
      <span className="font-mono tabular-nums text-text-primary shrink-0">
        {game.teamScore}-{game.oppScore}
      </span>
      <span className="text-text-secondary truncate">
        {game.home ? (isZh ? "对" : "vs") : "@"} {game.opponentTricode}
      </span>
    </div>
  );
}

function NextRow({ game, isZh }: { game: DigestGame | null; isZh: boolean }) {
  const label = isZh ? "下场" : "Next";
  if (!game) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <RowLabel>{label}</RowLabel>
        <span className="text-text-secondary/60">{isZh ? "赛季结束" : "Offseason"}</span>
      </div>
    );
  }
  const weekday = new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", {
    timeZone: localTz(),
    weekday: "short",
  }).format(new Date(game.dateUTC));
  return (
    <div className="flex items-center gap-2 text-[11px] min-w-0">
      <RowLabel>{label}</RowLabel>
      <span className="text-text-secondary truncate">
        <span className="text-text-primary font-medium">{weekday}</span>{" "}
        {game.home ? (isZh ? "对" : "vs") : "@"} {game.opponentTricode}
      </span>
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/50 w-7 shrink-0">
      {children}
    </span>
  );
}
