export default function FavoritesLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 skeleton-shimmer rounded" />
        <div className="h-7 w-32 skeleton-shimmer rounded" />
      </div>
      <div className="skeleton-shimmer rounded-xl h-12 mb-4" />
      <div className="skeleton-shimmer rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-28 skeleton-shimmer rounded" />
        </div>
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="w-8 h-8 skeleton-shimmer rounded-full" />
              <div className="h-4 w-40 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
