"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Users, User } from "lucide-react";
import { getFavoriteTeams, getFavoritePlayers, toggleFavoriteTeam, toggleFavoritePlayer } from "@/lib/favorites";
import { TEAM_META } from "@/lib/teams";

interface PlayerInfo {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
}

export default function FavoritesPage() {
  const [favTeams, setFavTeams] = useState<string[]>([]);
  const [favPlayers, setFavPlayers] = useState<number[]>([]);
  const [playerDetails, setPlayerDetails] = useState<Map<number, PlayerInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teams = getFavoriteTeams();
    const players = getFavoritePlayers();
    setFavTeams(teams);
    setFavPlayers(players);

    // Fetch player details if any favorites
    if (players.length > 0) {
      fetch("/api/search?q=")
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
        <Heart size={24} className="text-red-500" fill="currentColor" />
        <h1 className="text-2xl font-bold">Favorites</h1>
      </div>

      {!hasAny && !loading && (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <Heart size={48} className="mx-auto text-text-secondary mb-4" />
          <p className="text-lg text-text-secondary">No favorites yet</p>
          <p className="text-sm text-text-secondary mt-2">
            Add teams and players to your favorites by tapping the heart icon on their pages.
          </p>
        </div>
      )}

      {/* Favorite Teams */}
      {favTeams.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">Favorite Teams</h2>
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
                  <button
                    onClick={() => removeTeam(tricode)}
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-400 transition-colors"
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
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <User size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">Favorite Players</h2>
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
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-400 transition-colors"
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
