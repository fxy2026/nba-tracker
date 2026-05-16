"use client";

import { useCountUp } from "@/lib/useCountUp";

interface Props {
  value: number;
  decimals?: number;
  durationMs?: number;
  className?: string;
  /** Strip trailing ".0" for whole numbers when decimals=1 */
  stripTrailingZero?: boolean;
  prefix?: string;
  suffix?: string;
}

export default function CountUpNumber({
  value,
  decimals = 0,
  durationMs = 900,
  className = "",
  stripTrailingZero = false,
  prefix = "",
  suffix = "",
}: Props) {
  const v = useCountUp(value, durationMs);
  let formatted = v.toFixed(decimals);
  if (stripTrailingZero && decimals === 1) formatted = formatted.replace(/\.0$/, "");
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}
