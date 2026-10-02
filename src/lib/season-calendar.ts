import { currentSeason } from "./constants";

export interface RegularSeasonCalendar {
  start: string;
  end: string; // inclusive NBA Eastern calendar date
  sourceUrl: string;
}

// Published regular-season boundaries only. These are calendar dates, not
// evidence that game-level data is available, nor inferred playoff-end dates.
const calendars: Readonly<Record<string, RegularSeasonCalendar>> = {
  "2025-26": { start: "2025-10-21", end: "2026-04-12", sourceUrl: "https://pr.nba.com/2025-26-nba-regular-season-schedule/" },
  "2026-27": { start: "2026-10-20", end: "2027-04-11", sourceUrl: "https://pr.nba.com/2026-27-nba-regular-season-schedule/" },
};

export interface RegularSeasonProgress {
  season: string;
  calendar: RegularSeasonCalendar | null;
  phase: "upcoming" | "regular" | "complete" | "unknown";
  progress: number | null;
  daysLeft: number | null;
}
const easternDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

export function getRegularSeasonProgress(now: Date): RegularSeasonProgress {
  const season = currentSeason(now);
  const calendar = Object.prototype.hasOwnProperty.call(calendars, season) ? calendars[season] : null;
  if (!calendar) return { season, calendar: null, phase: "unknown", progress: null, daysLeft: null };
  const parts = easternDate.formatToParts(now);
  const date = ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
  const today = dayNumber(date), start = dayNumber(calendar.start), end = dayNumber(calendar.end);
  if (today < start) return { season, calendar, phase: "upcoming", progress: 0, daysLeft: start - today };
  if (today > end) return { season, calendar, phase: "complete", progress: 100, daysLeft: 0 };
  return { season, calendar, phase: "regular", progress: (today - start) / (end - start + 1) * 100, daysLeft: end - today + 1 };
}
