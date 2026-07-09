"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Heart, Users, User, Copy, Check, Search, ListOrdered, Compass,
  ArrowUpRight, AlertTriangle, Newspaper, X, CalendarDays, Clock,
} from "lucide-react";
import {
  getFavoriteTeams, getFavoritePlayers, toggleFavoriteTeam, toggleFavoritePlayer,
} from "@/lib/favorites";
import { TEAM_META, findTeamByDisplayName } from "@/lib/teams";
import { isPlayoff, isPlayIn } from "@/lib/games";
import TeamLogo from "@/components/TeamLogo";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { useLocale } from "@/components/LocaleProvider";
import { formatGameDate } from "@/lib/dates";
import type {
  FollowDigest, TeamDigest, PlayerDigest, DigestGame,
} from "@/lib/follow-digest-types";

// ── ESPN injuries shape (mirrors /api/injuries + the /injuries page) ──────────
interface InjuryItem {
  status?: string;
  athlete?: { displayName?: string };
}
interface InjuryTeam {
  displayName?: string;
  injuries?: InjuryItem[];
}
// ── /api/news item shape (the 5-item slice the route returns) ─────────────────
interface NewsItem {
  headline: string;
  link: string;
  published: string;
}

function injurySeverity(status: string | undefined): "out" | "soft" | "other" {
  const s = (status || "").toLowerCase();
  if (s.includes("out")) return "out";
  if (s.includes("doubtful") || s.includes("day-to-day") || s.includes("questionable")) return "soft";
  return "other";
}

// "YYYY..." UTC string → localized "Mon D" + weekday, in the user's locale.
function fmtGameDate(iso: string, isZh: boolean): string {
  return formatGameDate(iso, isZh ? "zh" : "en", {
    month: "short", day: "numeric", weekday: "short",
  });
}

export default function FavoritesDashboard() {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  // ── mounted gate: localStorage is unknowable during SSR (mirrors DateNav) ──
  const [mounted, setMounted] = useState(false);
  const [favTeams, setFavTeams] = useState<string[]>([]);
  const [favPlayers, setFavPlayers] = useState<number[]>([]);

  const [digest, setDigest] = useState<FollowDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  // tricode → injuries[], tricode → latest 1-2 headlines
  const [injuriesByTeam, setInjuriesByTeam] = useState<Record<string, InjuryItem[]>>({});
  const [newsByTeam, setNewsByTeam] = useState<Record<string, NewsItem[]>>({});
  // Teams whose news we've already fan-out'd this session, so a single unfollow
  // (which re-runs the favTeams effect) doesn't re-request every remaining team.
  const newsFetched = useRef(new Set<string>());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // one-shot post-hydration flag + initial favorites read
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage unknowable during SSR; mirrors DateNav/OnlineStatus
    setMounted(true);
    setFavTeams(getFavoriteTeams());
    setFavPlayers(getFavoritePlayers());
  }, []);

  const hasAny = favTeams.length > 0 || favPlayers.length > 0;

  // ── Fetch the personalized digest whenever the follow lists change ─────────
  useEffect(() => {
    if (!mounted) return;
    if (favTeams.length === 0 && favPlayers.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDigest(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setErrored(false);

    const params = new URLSearchParams();
    if (favTeams.length) params.set("teams", favTeams.join(","));
    if (favPlayers.length) params.set("players", favPlayers.join(","));

    fetch(`/api/follow-digest?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("digest failed"))))
      .then((data: FollowDigest) => {
        if (controller.signal.aborted) return;
        setDigest({ teams: data.teams ?? [], players: data.players ?? [] });
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setErrored(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [mounted, favTeams, favPlayers]);

  // ── Side fetch: injuries + news, keyed to followed teams. Tasteful extras,
  //    so failures stay silent and never block the core digest render. ───────
  useEffect(() => {
    if (!mounted || favTeams.length === 0) return;
    const controller = new AbortController();
    const followed = new Set(favTeams);

    // Injuries: one league-wide call, bucketed to followed teams.
    fetch("/api/injuries", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data?: InjuryTeam[] }) => {
        if (controller.signal.aborted) return;
        const byTeam: Record<string, InjuryItem[]> = {};
        for (const team of json.data ?? []) {
          const tri = findTeamByDisplayName(team.displayName ?? "")?.tricode;
          if (tri && followed.has(tri) && team.injuries?.length) {
            byTeam[tri] = team.injuries;
          }
        }
        setInjuriesByTeam(byTeam);
      })
      .catch(() => {});

    // News: per-team query against the existing /api/news (name-filtered).
    // Query by the unambiguous nickname only ("Lakers"), NOT "Los Angeles
    // Lakers" — the route OR-matches query words, so a city like "Los Angeles"
    // would surface Clippers / generic-LA headlines on the Lakers card.
    for (const tri of favTeams) {
      if (newsFetched.current.has(tri)) continue; // already fetched this session
      const meta = TEAM_META[tri];
      if (!meta) continue;
      newsFetched.current.add(tri); // mark BEFORE fetch so effect re-runs skip it
      const q = meta.name;
      fetch(`/api/news?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json: { data?: NewsItem[] }) => {
          if (controller.signal.aborted) return;
          const items = (json.data ?? []).filter((n) => n.headline && n.link).slice(0, 2);
          if (items.length) setNewsByTeam((prev) => ({ ...prev, [tri]: items }));
        })
        .catch(() => {
          newsFetched.current.delete(tri); // allow retry if aborted/failed
        });
    }

    return () => controller.abort();
  }, [mounted, favTeams]);

  const removeTeam = useCallback((tricode: string) => {
    setFavTeams(toggleFavoriteTeam(tricode).slice());
    // Optimistic splice so removal is instant — the remaining cards' data is
    // unchanged by dropping one follow, so we don't wait on the background refetch.
    setDigest((d) => (d ? { ...d, teams: d.teams.filter((t) => t.tricode !== tricode) } : d));
  }, []);
  const removePlayer = useCallback((id: number) => {
    setFavPlayers(toggleFavoritePlayer(id).slice());
    setDigest((d) => (d ? { ...d, players: d.players.filter((p) => p.personId !== id) } : d));
  }, []);

  // ── Export-to-text (carried over from the old page) ────────────────────────
  const exportList = useCallback(() => {
    const lines: string[] = [isZh ? "我的 NBA 关注" : "My NBA Favorites", ""];
    if (digest?.teams.length) {
      lines.push(isZh ? "球队:" : "Teams:");
      for (const team of digest.teams) {
        lines.push(`  - ${team.city} ${team.name} (${team.wins}-${team.losses})`);
      }
      lines.push("");
    }
    if (digest?.players.length) {
      lines.push(isZh ? "球员:" : "Players:");
      for (const p of digest.players) {
        const pName = p.name || (isZh ? `球员 #${p.personId}` : `Player #${p.personId}`);
        lines.push(p.teamTricode ? `  - ${pName} (${p.teamTricode})` : `  - ${pName}`);
      }
    }
    navigator.clipboard?.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [digest, isZh]);

  // ── Pre-mount + loading: stable skeleton so SSR HTML matches first paint ──
  if (!mounted) return <DashboardSkeleton />;

  // hasAny is localStorage-derived (reliable past the mounted gate) and gates
  // the fetch; a zero-follow user goes straight to EmptyFeed with no skeleton flash.
  if (!hasAny) return <EmptyFeed isZh={isZh} />;

  return (
    <div>
      {/* Toolbar: counts + export. Gated on the RESOLVED digest (not localStorage)
          so a stale/unknown tricode can't show "1 team" above the empty state. */}
      {!loading && !errored && digest && (digest.teams.length > 0 || digest.players.length > 0) && (
        <div className="flex items-center gap-2.5 mb-6 flex-wrap">
          {digest.teams.length > 0 && (
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] px-2.5 py-1 rounded-full bg-accent/15 text-accent font-semibold tabular-nums">
              {digest.teams.length} {isZh ? "支球队" : digest.teams.length === 1 ? "team" : "teams"}
            </span>
          )}
          {digest.players.length > 0 && (
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] px-2.5 py-1 rounded-full bg-accent-amber/15 text-accent-amber font-semibold tabular-nums">
              {digest.players.length} {isZh ? "位球员" : digest.players.length === 1 ? "player" : "players"}
            </span>
          )}
          <button
            onClick={exportList}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            {copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制清单" : "Copy list")}
          </button>
        </div>
      )}

      {/* Skeleton only blocks on the very first load; during a refetch (e.g. after
          an unfollow) the stale digest below stays mounted instead of blanking. */}
      {loading && !digest && <DashboardSkeleton />}

      {errored && !digest && (
        <div className="glass-tile p-8 text-center">
          <AlertTriangle size={28} className="mx-auto text-accent-amber mb-3" />
          <p className="text-sm text-text-primary font-medium">
            {isZh ? "动态加载失败" : "Couldn't load your feed"}
          </p>
          <p className="text-xs text-text-secondary mt-1.5">
            {isZh ? "请稍后再试,你的关注仍然安全保存。" : "Please try again — your follows are still saved."}
          </p>
        </div>
      )}

      {!errored && digest && (
        <div className="space-y-10">
          {/* TEAMS */}
          {digest.teams.length > 0 && (
            <section>
              <SectionHeader
                index="01"
                icon={Users}
                title={isZh ? "我关注的球队" : "Teams I follow"}
                count={digest.teams.length}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {digest.teams.map((team, i) => (
                  <TeamCard
                    key={team.tricode}
                    team={team}
                    injuries={injuriesByTeam[team.tricode]}
                    news={newsByTeam[team.tricode]}
                    isZh={isZh}
                    onRemove={() => removeTeam(team.tricode)}
                    delay={i * 50}
                  />
                ))}
              </div>
            </section>
          )}

          {/* PLAYERS */}
          {digest.players.length > 0 && (
            <section>
              <SectionHeader
                index={digest.teams.length > 0 ? "02" : "01"}
                icon={User}
                title={isZh ? "我关注的球员" : "Players I follow"}
                count={digest.players.length}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {digest.players.map((p, i) => (
                  <PlayerCard
                    key={p.personId}
                    player={p}
                    isZh={isZh}
                    onRemove={() => removePlayer(p.personId)}
                    delay={i * 50}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Followed but the digest returned nothing resolvable (e.g. unknown
              tricodes) — keep the door open instead of showing a blank page. */}
          {digest.teams.length === 0 && digest.players.length === 0 && (
            <EmptyFeed isZh={isZh} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — mirrors the editorial "/ 01" style used across the site.
function SectionHeader({ index, icon: Icon, title, count }: {
  index: string; icon: typeof Users; title: string; count: number;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {index}</p>
        <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-0.5">
          <Icon size={15} className="text-accent-amber" />
          {title}
        </h2>
      </div>
      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-secondary tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM CARD — logo + city/name anchor, record + conf rank + streak pill,
// Last / Next sub-rows, plus a compact injuries + news footer.
function TeamCard({ team, injuries, news, isZh, onRemove, delay }: {
  team: TeamDigest;
  injuries: InjuryItem[] | undefined;
  news: NewsItem[] | undefined;
  isZh: boolean;
  onRemove: () => void;
  delay: number;
}) {
  const color = team.primaryColor || "#3B82F6";
  const outCount = (injuries ?? []).filter((i) => injurySeverity(i.status) === "out").length;
  const softCount = (injuries ?? []).filter((i) => injurySeverity(i.status) === "soft").length;
  const totalInj = injuries?.length ?? 0;
  const streakKind = team.streak ? team.streak[0] : "";

  return (
    <div
      className="glass-tile relative overflow-hidden p-4 sm:p-5 bento-rise flex flex-col"
      style={{ ["--team-color" as string]: color, animationDelay: `${delay}ms` }}
    >
      {/* team-color accent: left bar + faint corner wash */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.14] pointer-events-none"
        style={{ background: `radial-gradient(ellipse 55% 50% at 0% 0%, ${color} 0%, transparent 65%)` }}
        aria-hidden
      />

      {/* Header: logo + name anchor + remove */}
      <div className="relative flex items-start gap-3">
        <Link href={`/team/${team.tricode}`} className="shrink-0">
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/team/${team.tricode}`} className="group block">
            <p className="text-xs text-text-secondary leading-none">{team.city}</p>
            <h3 className="text-lg font-bold text-text-primary leading-tight group-hover:text-accent transition-colors truncate">
              {team.name}
            </h3>
          </Link>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-mono tabular-nums text-sm">
              <span className="text-success font-semibold">{team.wins}</span>
              <span className="text-text-secondary/40 mx-0.5">–</span>
              <span className="text-danger font-semibold">{team.losses}</span>
            </span>
            {team.archived && (
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">
                {isZh ? "上赛季" : "Last season"}
              </span>
            )}
            {team.conferenceRank != null && (
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary">
                #{team.conferenceRank} {team.conference}
              </span>
            )}
            {team.streak && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                streakKind === "W" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}>
                {team.streak}
              </span>
            )}
          </div>
        </div>
        <RemoveButton onRemove={onRemove} label={isZh ? "取消关注" : "Unfollow"} />
      </div>

      {/* Last / Next rows */}
      <div className="relative mt-4 space-y-1.5">
        <GameRow label={isZh ? "上一战" : "Last"} game={team.lastGame} isZh={isZh} kind="last" />
        <GameRow label={isZh ? "下一场" : "Next"} game={team.nextGame} isZh={isZh} kind="next" />
      </div>

      {/* Injuries + News footer */}
      {(totalInj > 0 || (news && news.length > 0)) && (
        <div className="relative mt-4 pt-3 border-t border-border/60 space-y-2">
          {totalInj > 0 && (
            <Link
              href={`/injuries?team=${encodeURIComponent(`${team.city} ${team.name}`.toLowerCase())}`}
              className="flex items-center gap-2 group"
            >
              <AlertTriangle size={13} className="text-accent-amber shrink-0" />
              <span className="text-[11px] text-text-secondary group-hover:text-accent transition-colors">
                {isZh ? "伤停" : "Injuries"}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
                {outCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-danger/15 text-danger font-semibold">
                    {outCount} {isZh ? "缺阵" : "OUT"}
                  </span>
                )}
                {softCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-semibold">
                    {softCount} {isZh ? "存疑" : "GTD"}
                  </span>
                )}
                {outCount === 0 && softCount === 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary font-semibold">
                    {totalInj}
                  </span>
                )}
              </span>
              <ArrowUpRight size={12} className="ml-auto text-text-secondary/50 group-hover:text-accent transition-colors" />
            </Link>
          )}
          {news?.map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <Newspaper size={13} className="text-accent-amber shrink-0 mt-0.5" />
              <span className="text-[11px] leading-snug text-text-secondary group-hover:text-accent transition-colors line-clamp-1 flex-1">
                {n.headline}
              </span>
              <ArrowUpRight size={12} className="shrink-0 mt-0.5 text-text-secondary/50 group-hover:text-accent transition-colors" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// One Last/Next row inside a team card.
function GameRow({ label, game, isZh, kind }: {
  label: string; game: DigestGame | null; isZh: boolean; kind: "last" | "next";
}) {
  const RowIcon = kind === "last" ? Clock : CalendarDays;

  if (!game) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono uppercase tracking-[0.12em] text-text-secondary/60 w-12 shrink-0">{label}</span>
        <span className="text-text-secondary/70 italic">
          {kind === "next" ? (isZh ? "休赛期" : "Offseason") : (isZh ? "暂无比赛" : "No game yet")}
        </span>
      </div>
    );
  }

  const oppPrefix = game.home ? (isZh ? "对阵 " : "vs ") : "@ ";
  const date = fmtGameDate(game.dateUTC, isZh);
  // A live game can be the "last" game — don't label its in-progress score W/L.
  const live = kind === "last" && game.status === 2;
  // Postseason results: tag the row so a reg.-season streak shown beside a
  // playoff/play-in loss isn't read as a contradiction.
  const playoff = isPlayoff(game.gameId);
  const playIn = isPlayIn(game.gameId);

  const inner = (
    <>
      <span className="font-mono uppercase tracking-[0.12em] text-text-secondary/60 w-12 shrink-0">{label}</span>
      <RowIcon size={12} className="text-text-secondary/50 shrink-0" />
      {live ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-success/15 text-success shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          {isZh ? "进行中" : "Live"}
        </span>
      ) : (
        kind === "last" && game.win !== undefined && (
          <span className={`font-mono font-bold ${game.win ? "text-success" : "text-danger"}`}>
            {game.win ? (isZh ? "胜" : "W") : (isZh ? "负" : "L")}
          </span>
        )
      )}
      {(playoff || playIn) && (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-mono font-semibold uppercase tracking-[0.08em] shrink-0">
          {playIn ? (isZh ? "附加赛" : "Play-In") : (isZh ? "季后赛" : "Playoffs")}
        </span>
      )}
      {kind === "last" && game.teamScore != null && game.oppScore != null && (
        <span className="font-mono tabular-nums text-text-primary">
          {game.teamScore}<span className="text-text-secondary/40 mx-0.5">-</span>{game.oppScore}
        </span>
      )}
      <span className="text-text-secondary truncate">
        {oppPrefix}{game.opponentTricode}
      </span>
      <span className="ml-auto text-text-secondary/60 font-mono shrink-0">{date}</span>
    </>
  );

  // Finished/live games link to the box score; upcoming games stay static.
  if (kind === "last") {
    return (
      <Link
        href={`/game/${game.gameId}`}
        className="flex items-center gap-2 text-[11px] group hover:bg-bg-hover/60 rounded-md -mx-1 px-1 py-0.5 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-2 text-[11px] py-0.5">{inner}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER CARD — headshot + name/team anchor, last-game stat line,
// season averages, their team's next game.
function PlayerCard({ player, isZh, onRemove, delay }: {
  player: PlayerDigest; isZh: boolean; onRemove: () => void; delay: number;
}) {
  const meta = TEAM_META[player.teamTricode];
  const color = meta?.primaryColor || "#3B82F6";
  const line = player.lastLine;
  // The backend emits "" for a personId not in the active CDN player index
  // (retired / two-way / pre-trade). Show a stable placeholder, not a bare id.
  const displayName = player.name || (isZh ? `球员 #${player.personId}` : `Player #${player.personId}`);
  const unresolved = !player.name;

  return (
    <div
      className="glass-tile relative overflow-hidden p-4 sm:p-5 bento-rise flex flex-col"
      style={{ ["--team-color" as string]: color, animationDelay: `${delay}ms` }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{ background: `radial-gradient(ellipse 55% 50% at 0% 0%, ${color} 0%, transparent 65%)` }}
        aria-hidden
      />

      {/* Header */}
      <div className="relative flex items-start gap-3">
        <Link href={`/player/${player.personId}`} className="shrink-0">
          <PlayerHeadshot personId={player.personId} name={displayName} size={52} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/player/${player.personId}`} className="group block">
            <h3 className="text-base font-bold text-text-primary leading-tight group-hover:text-accent transition-colors truncate">
              {displayName}
            </h3>
          </Link>
          {unresolved ? (
            <span className="inline-block mt-0.5 text-[11px] text-text-secondary/70 italic">
              {isZh ? "暂不可用" : "No longer available"}
            </span>
          ) : (
            <Link
              href={`/team/${player.teamTricode}`}
              className="inline-flex items-center gap-1.5 mt-0.5 text-[11px] text-text-secondary hover:text-accent transition-colors"
            >
              <TeamLogo teamId={player.teamId} tricode={player.teamTricode} size={14} />
              {meta ? `${meta.city} ${meta.name}` : player.teamTricode}
            </Link>
          )}
        </div>
        <RemoveButton onRemove={onRemove} label={isZh ? "取消关注" : "Unfollow"} />
      </div>

      {/* Last-game stat line */}
      <div className="relative mt-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mb-1.5">
          {isZh ? "最近一战" : "Last game"}
        </p>
        {line ? (
          <Link
            href={`/game/${line.gameId}`}
            className="block group hover:bg-bg-hover/60 rounded-lg -mx-1.5 px-1.5 py-1.5 transition-colors"
          >
            <div className="flex items-center gap-2 text-[11px] mb-2">
              <span className={`font-mono font-bold ${line.win ? "text-success" : "text-danger"}`}>
                {line.win ? (isZh ? "胜" : "W") : (isZh ? "负" : "L")}
              </span>
              <span className="text-text-secondary">
                {line.home ? (isZh ? "对阵 " : "vs ") : "@ "}{line.opponentTricode}
              </span>
              <span className="text-text-secondary/60 font-mono">· {line.min}{isZh ? "分钟" : " MIN"}</span>
              <span className="ml-auto text-text-secondary/60 font-mono">{fmtGameDate(line.dateUTC, isZh)}</span>
              <ArrowUpRight size={12} className="text-text-secondary/50 group-hover:text-accent transition-colors" />
            </div>
            <div className="flex items-baseline gap-3 font-mono tabular-nums">
              <Stat value={line.pts} label="PTS" accent />
              <Stat value={line.reb} label="REB" />
              <Stat value={line.ast} label="AST" />
              {line.stl > 0 && <Stat value={line.stl} label="STL" />}
              {line.blk > 0 && <Stat value={line.blk} label="BLK" />}
              <span className="text-[10px] text-text-secondary/70 ml-auto self-end">
                {line.fgm}/{line.fga} FG · {line.tpm}/{line.tpa} 3P
              </span>
            </div>
          </Link>
        ) : (
          <p className="text-[11px] text-text-secondary/70 italic">
            {isZh ? "暂无比赛数据" : "No recent game data"}
          </p>
        )}
      </div>

      {/* Season averages + next game footer */}
      <div className="relative mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap text-[11px]">
        {player.seasonAvg ? (
          <span className="flex items-center gap-2 font-mono tabular-nums text-text-secondary">
            <span className="uppercase tracking-[0.12em] text-text-secondary/60">{isZh ? "赛季场均" : "Season"}</span>
            <span className="text-text-primary font-semibold">{player.seasonAvg.pts.toFixed(1)}</span>
            <span className="text-text-secondary/40">/</span>
            <span className="text-text-primary font-semibold">{player.seasonAvg.reb.toFixed(1)}</span>
            <span className="text-text-secondary/40">/</span>
            <span className="text-text-primary font-semibold">{player.seasonAvg.ast.toFixed(1)}</span>
          </span>
        ) : <span />}
        {player.nextGame ? (
          <span className="flex items-center gap-1.5 text-text-secondary font-mono">
            <CalendarDays size={12} className="text-text-secondary/50" />
            {isZh ? "下一场" : "Next"} {player.nextGame.home ? (isZh ? "对阵 " : "vs ") : "@ "}
            {player.nextGame.opponentTricode}
            <span className="text-text-secondary/60">{fmtGameDate(player.nextGame.dateUTC, isZh)}</span>
          </span>
        ) : (
          <span className="text-text-secondary/60 font-mono">{isZh ? "休赛期" : "Offseason"}</span>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <span className="flex items-baseline gap-0.5">
      <span className={`text-xl font-light leading-none ${accent ? "text-accent-amber" : "text-text-primary"}`}>
        {value}
      </span>
      <span className="text-[9px] text-text-secondary uppercase tracking-[0.1em]">{label}</span>
    </span>
  );
}

function RemoveButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <button
      onClick={onRemove}
      className="shrink-0 -mr-1 -mt-1 p-2 rounded-lg text-text-secondary/50 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
      title={label}
      aria-label={label}
    >
      <X size={15} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — inviting, with three CTAs.
function EmptyFeed({ isZh }: { isZh: boolean }) {
  return (
    <div className="glass-tile p-10 sm:p-14 text-center bento-rise relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
          <Heart size={26} className="text-accent" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          {isZh ? "打造你的专属动态" : "Build your personal feed"}
        </h2>
        <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
          {isZh
            ? "关注你喜爱的球队和球员,这里会实时汇总他们的最近一战、下一场、连胜连败、伤停与最新资讯。"
            : "Follow the teams and players you love — this page will track their last result, next game, streaks, injuries and the latest news, live."}
        </p>
        <div className="flex items-center justify-center gap-2.5 mt-6 flex-wrap">
          <Link
            href="/standings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            <ListOrdered size={15} />
            {isZh ? "浏览球队" : "Browse teams"}
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary hover:border-accent/50 hover:text-accent transition-colors"
          >
            <Search size={15} />
            {isZh ? "查找球员" : "Find players"}
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary hover:border-accent/50 hover:text-accent transition-colors"
          >
            <Compass size={15} />
            {isZh ? "探索" : "Explore"}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — glass-tile cards with skeleton-shimmer, matching the real grid.
function DashboardSkeleton() {
  return (
    <div className="space-y-10" aria-hidden>
      <section>
        <div className="h-5 w-40 skeleton-shimmer rounded mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="glass-tile p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 skeleton-shimmer rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 skeleton-shimmer rounded" />
                  <div className="h-5 w-32 skeleton-shimmer rounded" />
                  <div className="h-3 w-24 skeleton-shimmer rounded" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full skeleton-shimmer rounded" />
                <div className="h-3 w-3/4 skeleton-shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="h-5 w-40 skeleton-shimmer rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="glass-tile p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="w-[52px] h-[52px] skeleton-shimmer rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-28 skeleton-shimmer rounded" />
                  <div className="h-3 w-20 skeleton-shimmer rounded" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-1/2 skeleton-shimmer rounded" />
                <div className="h-6 w-full skeleton-shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
