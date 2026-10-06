import { dateInTz, localTz } from "./timezone";
import { createZonedCalendarDate } from "./zoned-calendar-date";

export interface LocalDay {
  date: string;
  timeZone: string;
}

// Find the next calendar boundary instead of adding 24 hours. This also covers
// 23/25-hour DST days and zones whose offset change skips local midnight.
export function nextLocalMidnight(now: Date, timeZone: string): number {
  const calendarDate = createZonedCalendarDate(timeZone);
  const today = calendarDate(now.toISOString());
  let low = now.getTime() + 1;
  let high = now.getTime() + 48 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDate(new Date(middle).toISOString()) <= today) low = middle + 1;
    else high = middle;
  }
  return low;
}

// One daily timer, with an immediate catch-up when a suspended/mobile tab
// returns. Re-resolve the browser zone on wake, since the device may have moved.
export function observeLocalDay(timeZone: string | undefined, onChange: (day: LocalDay) => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const synchronize = () => {
    const now = new Date(), zone = timeZone ?? localTz();
    onChange({ date: dateInTz(now, zone), timeZone: zone });
    clearTimeout(timer);
    timer = setTimeout(synchronize, Math.max(1, nextLocalMidnight(now, zone) - Date.now()));
  };
  const resume = () => {
    if (document.visibilityState !== "hidden") synchronize();
  };
  synchronize();
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("pageshow", resume);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
  };
}
