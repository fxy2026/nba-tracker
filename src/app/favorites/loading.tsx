// Route-level skeleton shown during navigation into /favorites, before the
// client dashboard mounts and reads localStorage. Mirrors the card-grid layout
// of FavoritesDashboard so the transition feels seamless.
export default function FavoritesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb placeholder */}
      <div className="h-3 w-40 skeleton-shimmer rounded mb-4" />

      {/* PageHeader placeholder */}
      <div className="mb-6 space-y-2">
        <div className="h-2.5 w-16 skeleton-shimmer rounded" />
        <div className="h-8 w-44 skeleton-shimmer rounded" />
        <div className="h-3 w-72 max-w-full skeleton-shimmer rounded" />
      </div>

      {/* Toolbar chips */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="h-6 w-20 skeleton-shimmer rounded-full" />
        <div className="h-6 w-20 skeleton-shimmer rounded-full" />
        <div className="h-7 w-24 skeleton-shimmer rounded-lg ml-auto" />
      </div>

      {/* Team card grid */}
      <div className="h-5 w-40 skeleton-shimmer rounded mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-10">
        {[0, 1].map((i) => (
          <div key={i} className="glass-tile p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 skeleton-shimmer rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 skeleton-shimmer rounded" />
                <div className="h-5 w-32 skeleton-shimmer rounded" />
                <div className="h-3 w-24 skeleton-shimmer rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full skeleton-shimmer rounded" />
              <div className="h-3 w-3/4 skeleton-shimmer rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Player card grid */}
      <div className="h-5 w-40 skeleton-shimmer rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="glass-tile p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-[52px] h-[52px] skeleton-shimmer rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-28 skeleton-shimmer rounded" />
                <div className="h-3 w-20 skeleton-shimmer rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-1/2 skeleton-shimmer rounded" />
              <div className="h-6 w-full skeleton-shimmer rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
