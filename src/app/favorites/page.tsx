"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Users, User, Copy, Check } from "lucide-react";
import { getFavoriteTeams, getFavoritePlayers, toggleFavoriteTeam, toggleFavoritePlayer } from "@/lib/favorites";
import { TEAM_META } from "@/lib/teams";
import { useLocale } from "@/components/LocaleProvider";

interface PlayerInfo {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
}

export default function FavoritesPage() {
  const { t } = useLocale();
  const [favTeams, setFavTeams] = useState<string[]>([]);
  const [favPlayers, setFavPlayers] = useState<number[]>([]);
  const [playerDetails, setPlayerDetails] = useState<Map<number, PlayerInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Hydration: localStorage favorites + optional async detail fetch.
  useEffect(() => {
    const controller = new AbortController();
    const teams = getFavoriteTeams();
    const players = getFavoritePlayers();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavTeams(teams);
    setFavPlayers(players);

    if (players.length > 0) {
      fetch("/api/search?q=", { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const map = new Map<number, PlayerInfo>();
            for (const p of data) {
              if (players.includes(p.personId)) {
                map.set(p.personId, p);
              }
            }
            setPlayerDetails(map);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => controller.abort();
  }, []);

  const removeTeam = (tricode: string) => {
    const updated = toggleFavoriteTeam(tricode);
    setFavTeams(updated);
  };

  const removePlayer = (id: number) => {
    const updated = toggleFavoritePlayer(id);
    setFavPlayers(updated);
  };

  const hasAny = favTeams.length > 0 || favPlayers.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Heart size={24} className="text-danger" fill="currentColor" />
        <h1 className="text-2xl font-bold">{t.favoritesPage.title}</h1>
        {hasAny && (
          <button
            onClick={() => {
              const lines: string[] = ["My NBA Favorites", ""];
              if (favTeams.length > 0) {
                lines.push("Teams:");
                for (const tc of favTeams) {
                  const t = TEAM_META[tc];
                  lines.push(t ? `  - ${t.city} ${t.name}` : `  - ${tc}`);
                }
                lines.push("");
              }
              if (favPlayers.length > 0) {
                lines.push("Players:");
                for (const pid of favPlayers) {
                  const p = playerDetails.get(pid);
                  lines.push(p ? `  - ${p.firstName} ${p.lastName} (${p.teamAbbr})` : `  - Player #${pid}`);
                }
              }
              navigator.clipboard.writeText(lines.join("\n")).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? t.common.copied : t.favoritesPage.exportBtn}
          </button>
        )}
      </div>

      {/* Quick stats */}
      {hasAny && !loading && (
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">
            {favTeams.length} {favTeams.length !== 1 ? t.common.teams : t.common.team}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 text-danger font-medium">
            {favPlayers.length} {favPlayers.length !== 1 ? t.common.players : t.common.player}
          </span>
        </div>
      )}

      {!hasAny && !loading && (
        <div className="glass-tile p-12 text-center">
          <Heart size={48} className="mx-auto text-text-secondary/30 mb-4" />
          <p className="text-lg font-medium text-text-primary">{t.favoritesPage.noFavorites}</p>
          <p className="text-sm text-text-secondary mt-2 mb-6">
            {t.favoritesPage.noFavoritesHint}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/search" className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors">
              {t.favoritesPage.findPlayers}
            </Link>
            <Link href="/stats" className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary hover:bg-bg-hover transition-colors">
              {t.favoritesPage.browseTeams}
            </Link>
          </div>
        </div>
      )}

      {/* Favorite Teams */}
      {favTeams.length > 0 && (
        <div className="glass-tile overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.favoritesPage.favoriteTeams}</h2>
          </div>
          <div className="divide-y divide-border/50">
            {favTeams.map((tricode) => {
              const team = TEAM_META[tricode];
              if (!team) return null;
              return (
                <div key={tricode} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors">
                  <Image
                    src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
                    alt={tricode}
                    width={32}
                    height={32}
                    unoptimized
                  />
                  <Link href={`/team/${tricode}`} className="flex-1 font-medium text-text-primary hover:text-accent transition-colors">
                    {team.city} {team.name}
                  </Link>
                  <Link href={`/schedule?team=${tricode}`} className="text-[10px] px-2 py-1 rounded bg-bg-hover text-text-secondary hover:text-accent transition-colors">
                    {t.nav.schedule}
                  </Link>
                  <button
                    onClick={() => removeTeam(tricode)}
                    className="p-1.5 rounded-lg text-danger hover:text-danger transition-colors"
                    title="Remove from favorites"
                  >
                    <Heart size={16} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorite Players */}
      {favPlayers.length > 0 && (
        <div className="glass-tile overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <User size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.favoritesPage.favoritePlayers}</h2>
          </div>
          <div className="divide-y divide-border/50">
            {favPlayers.map((playerId) => {
              const player = playerDetails.get(playerId);
              return (
                <div key={playerId} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors">
                  <Image
                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`}
                    alt={player ? `${player.firstName} ${player.lastName}` : `Player ${playerId}`}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                  <Link
                    href={`/player/${playerId}`}
                    className="flex-1 font-medium text-text-primary hover:text-accent transition-colors"
                  >
                    {player ? `${player.firstName} ${player.lastName}` : `Player #${playerId}`}
                    {player?.teamAbbr && (
                      <span className="text-xs text-text-secondary ml-2">{player.teamAbbr}</span>
                    )}
                  </Link>
                  <button
                    onClick={() => removePlayer(playerId)}
                    className="p-1.5 rounded-lg text-danger hover:text-danger transition-colors"
                    title="Remove from favorites"
                  >
                    <Heart size={16} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
