"use client";

import { useLocale } from "@/components/LocaleProvider";
import SearchInput from "@/components/SearchInput";

/** Always in the initial home shell; no directory data is sent to the browser. */
export default function HomePlayerSearch() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  return (
    <section aria-labelledby="home-player-search-heading" className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-5 sm:mb-6 sm:flex-row sm:items-center sm:gap-8 sm:pb-6">
      <div className="shrink-0">
        <h2 id="home-player-search-heading" className="text-xl font-semibold tracking-tight text-text-primary">
          {isZh ? "搜索球员" : "Player search"}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {isZh ? "从现役到历史，直达球员档案" : "Explore player profiles, past and present"}
        </p>
      </div>
      <div className="w-full min-w-0 sm:ml-auto sm:max-w-xl">
        <SearchInput variant="home" autoFocus={false} />
      </div>
    </section>
  );
}
