"use client";

import { useState, memo } from "react";
import Image from "next/image";
import { playerHeadshotUrl } from "@/lib/teamUrls";

interface Props {
  personId: number;
  name: string;
  size?: number;
}

export default memo(function PlayerHeadshot({ personId, name, size = 28 }: Props) {
  const [error, setError] = useState(false);

  // personId 0/missing = retired legend without an NBA-hosted headshot
  // (NBA CDN would serve a generic silhouette, not the player's face).
  // Skip the fetch and render initials directly.
  if (error || !personId) {
    return (
      <div
        className="rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0"
        style={{ width: size, height: size }}
      >
        {name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
      </div>
    );
  }

  return (
    <div className="rounded-full overflow-hidden bg-bg-secondary shrink-0" style={{ width: size, height: size }}>
      <Image
        src={playerHeadshotUrl(personId, "260x190")}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="w-full h-full object-cover object-top"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
});
