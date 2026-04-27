"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import {
  getFavoriteTeams,
  toggleFavoriteTeam,
  getFavoritePlayers,
  toggleFavoritePlayer,
} from "@/lib/favorites";

interface FavoriteButtonProps {
  type: "team" | "player";
  id: string | number;
}

export default function FavoriteButton({ type, id }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (type === "team") {
      setIsFav(getFavoriteTeams().includes(id as string));
    } else {
      setIsFav(getFavoritePlayers().includes(id as number));
    }
  }, [type, id]);

  const handleToggle = () => {
    if (type === "team") {
      const updated = toggleFavoriteTeam(id as string);
      setIsFav(updated.includes(id as string));
    } else {
      const updated = toggleFavoritePlayer(id as number);
      setIsFav(updated.includes(id as number));
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-1.5 rounded-lg transition-colors ${
        isFav
          ? "text-red-500 hover:text-red-400"
          : "text-text-secondary hover:text-red-400"
      }`}
      title={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart size={20} fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}
