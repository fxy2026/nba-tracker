// Keep route state to one unambiguous, supported four-digit calendar month.
const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;

export function selectedCalendarMonth(params: Pick<URLSearchParams, "getAll">, fallback: string): string {
  const months = params.getAll("month");
  return months.length === 1 && MONTH.test(months[0]) ? months[0] : fallback;
}

export function offsetCalendarMonth(month: string, offset: number): string | null {
  if (!MONTH.test(month) || !Number.isSafeInteger(offset)) return null;
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + offset;
  const nextYear = Math.floor(index / 12);
  if (nextYear < 1000 || nextYear > 9999) return null;
  return `${nextYear}-${String(index % 12 + 1).padStart(2, "0")}`;
}

export function calendarMonthHref(location: Pick<Location, "pathname" | "search" | "hash">, month: string): string | null {
  if (!MONTH.test(month)) return null;
  const params = new URLSearchParams(location.search);
  params.set("month", month);
  return `${location.pathname}?${params}${location.hash}`;
}
