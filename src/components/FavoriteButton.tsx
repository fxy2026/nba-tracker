"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import {
  getFavoriteTeams,
  toggleFavoriteTeam,
  getFavoritePlayers,
  toggleFavoritePlayer,
} from "@/lib/favorites";
import { useLocale } from "@/components/LocaleProvider";

interface FavoriteButtonProps {
  type: "team" | "player";
  id: string | number;
  className?: string;
}

export default function FavoriteButton({ type, id, className = "" }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);
  const { t } = useLocale();

  // Hydration: sync isFav from localStorage on mount and on prop change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFav(
      type === "team"
        ? getFavoriteTeams().includes(id as string)
        : getFavoritePlayers().includes(id as number)
    );
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
      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
        isFav
          ? "text-danger hover:opacity-80"
          : "text-text-secondary hover:text-danger"
      } ${className}`}
      title={isFav ? t.favorite.remove : t.favorite.add}
      aria-label={isFav ? t.favorite.remove : t.favorite.add}
    >
      <Heart size={20} fill={isFav ? "currentColor" : "none"} className={isFav ? "animate-count" : ""} />
    </button>
  );
}
