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
import { useToast } from "@/components/ToastProvider";

interface FavoriteButtonProps {
  type: "team" | "player";
  id: string | number;
  className?: string;
}

export default function FavoriteButton({ type, id, className = "" }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);
  const { t } = useLocale();
  const { toast } = useToast();

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
    let nowFav: boolean;
    if (type === "team") {
      const updated = toggleFavoriteTeam(id as string);
      nowFav = updated.includes(id as string);
      setIsFav(nowFav);
    } else {
      const updated = toggleFavoritePlayer(id as number);
      nowFav = updated.includes(id as number);
      setIsFav(nowFav);
    }
    toast(nowFav ? t.favorite.added : t.favorite.removed);
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center min-h-[44px] min-w-[44px] ${
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
