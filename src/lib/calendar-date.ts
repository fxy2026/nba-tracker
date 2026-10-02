// A date-only key is a calendar label, not a local-noon instant. Perform date
// arithmetic in UTC to avoid shifting keys in UTC+14 or across DST changes.
export function offsetCalendarDate(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date || !Number.isInteger(offset)) {
    throw new RangeError("Invalid calendar date or offset");
  }
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function calendarDateLabels(date: string, locale = "zh-CN") {
  const value = new Date(`${date}T00:00:00Z`);
  return {
    label: value.toLocaleDateString(locale, { timeZone: "UTC", month: "numeric", day: "numeric" }),
    weekday: value.toLocaleDateString(locale, { timeZone: "UTC", weekday: "short" }),
  };
}
