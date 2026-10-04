/** One formatter per operation, with no global timezone/data cache. Create it
 * lazily so an empty or already-returned branch never starts validating a zone. */
export function createZonedCalendarDate(timeZone: string): (utc: string) => string {
  let formatter: Intl.DateTimeFormat | undefined;
  return (utc: string) => {
    formatter ??= new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = formatter.formatToParts(new Date(utc));
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
  };
}
