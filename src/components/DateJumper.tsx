"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

// ET (NBA schedule timezone) "today" — keeps date input aligned with the schedule
// API regardless of where the user is (China, Europe, West Coast, etc.).
function etTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function DateJumper() {
  const router = useRouter();
  const { locale } = useLocale();
  const isZh = locale === "zh";
  return (
    <div className="mb-5 flex items-center gap-3">
      <label htmlFor="date-jump" className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">{isZh ? "跳转到日期" : "Jump to date"}</label>
      <input
        type="date"
        id="date-jump"
        defaultValue={etTodayStr()}
        onChange={(e) => { if (e.target.value) router.push(`/?date=${e.target.value}`); }}
        className="glass-tile px-3 py-1.5 text-sm font-mono tabular-nums text-text-primary focus:outline-none focus:border-accent cursor-pointer"
      />
    </div>
  );
}
