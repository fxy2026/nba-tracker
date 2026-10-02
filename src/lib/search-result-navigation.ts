export interface SearchResultDestination {
  personId: number;
  isLegend?: boolean;
  isIconicSeason?: boolean;
  iconicId?: string;
}

// Match the destinations already used by all-time leaders and SeasonCard.
// One function keeps pointer and keyboard navigation on the same source.
export function searchResultHref(result: SearchResultDestination): string {
  if (!Number.isSafeInteger(result.personId) || result.personId <= 0) return "/search";
  if (result.isIconicSeason) {
    const id = result.iconicId;
    if (typeof id === "string" && /^\d+-\d{4}$/.test(id) && id.split("-")[0] === String(result.personId)) {
      return `/compare?p1=${encodeURIComponent(id)}`;
    }
    return "/iconic-seasons";
  }
  return result.isLegend ? `/legends/${result.personId}` : `/player/${result.personId}`;
}
