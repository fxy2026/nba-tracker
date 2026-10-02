export type DirectorySearchParams = Record<string, string | string[] | undefined>;
export type DirectoryPageProps = { searchParams?: Promise<DirectorySearchParams> };
export type DirectoryFilter = { value: string | null; invalid: boolean };

function positionKey(value: string): string | null {
  const parts = value.trim().toUpperCase().split("-");
  return parts.length <= 2 && parts.every(part => /^[GFC]$/.test(part)) && new Set(parts).size === parts.length
    ? parts.sort().join("-") : null;
}

// Only values represented by this snapshot can select rows. Repeated/unknown
// parameters fall back to browsing, without reflecting arbitrary query text.
export function directoryFilter(raw: string | string[] | undefined, available: string[], position = false): DirectoryFilter {
  if (raw === undefined) return { value: null, invalid: false };
  if (typeof raw !== "string" || !raw.trim() || raw.length > 100) return { value: null, invalid: true };
  const key = position ? positionKey(raw.trim()) : raw.trim();
  const value = key === null ? undefined : available.find(value => (position ? positionKey(value) : value) === key);
  return { value: value ?? null, invalid: value === undefined };
}

export function matchesDirectoryPosition(value: string, selected: string): boolean {
  const key = positionKey(value);
  return key !== null && key === positionKey(selected);
}
