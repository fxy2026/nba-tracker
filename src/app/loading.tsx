export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Date nav skeleton */}
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="w-14 h-14 skeleton-shimmer rounded-lg" />
        ))}
      </div>
      {/* Standings mini skeleton */}
      <div className="skeleton-shimmer rounded-xl border border-border p-3 mt-4 h-28" />
      {/* Game cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 h-[180px]">
            <div className="skeleton-shimmer h-4 w-16 rounded mb-3" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="skeleton-shimmer w-8 h-8 rounded-full" />
                  <div className="skeleton-shimmer h-4 w-32 rounded" />
                </div>
                <div className="skeleton-shimmer h-6 w-8 rounded" />
              </div>
              <div className="border-t border-border/50" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="skeleton-shimmer w-8 h-8 rounded-full" />
                  <div className="skeleton-shimmer h-4 w-32 rounded" />
                </div>
                <div className="skeleton-shimmer h-6 w-8 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
