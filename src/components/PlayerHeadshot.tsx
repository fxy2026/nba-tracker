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

  if (error) {
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
        src={playerHeadshotUrl(personId)}
        alt={name}
        width={size}
        height={size}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
});
