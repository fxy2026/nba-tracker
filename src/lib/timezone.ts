// Resolve the browser's IANA timezone, with a fallback for environments
// where Intl is unavailable.
export function localTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

// "YYYY-MM-DD" of `d` in the given IANA timezone. If no tz, uses local.
export function dateInTz(d: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz ?? localTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Today in the user's local timezone, as "YYYY-MM-DD".
export function localToday(): string {
  return dateInTz(new Date());
}
