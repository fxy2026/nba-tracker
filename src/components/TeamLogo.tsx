"use client";

import { useState } from "react";

interface TeamLogoProps {
  teamId?: number;
  tricode: string;
  size?: number;
}

export default function TeamLogo({ teamId, tricode, size = 40 }: TeamLogoProps) {
  const [error, setError] = useState(false);

  const url = teamId
    ? `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
    : "";

  if (!url || error) {
    return (
      <div
        className="bg-bg-hover rounded-lg flex items-center justify-center text-xs font-bold text-text-secondary"
        style={{ width: size, height: size }}
      >
        {tricode}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={tricode}
      width={size}
      height={size}
      className="object-contain"
      onError={() => setError(true)}
    />
  );
}
