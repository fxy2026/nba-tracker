export default function NewsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-bg-card rounded skeleton-shimmer" />
      <div className="flex items-center gap-3 mt-4 mb-6">
        <div className="w-10 h-10 bg-bg-card rounded-lg skeleton-shimmer" />
        <div className="space-y-2">
          <div className="h-7 w-40 bg-bg-card rounded skeleton-shimmer" />
          <div className="h-3 w-56 bg-bg-card rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-16 bg-bg-card rounded-full skeleton-shimmer" />
        ))}
      </div>
      <div className="glass-tile overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-28 bg-bg-secondary rounded skeleton-shimmer" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              <div className="w-20 h-14 sm:w-24 sm:h-16 bg-bg-secondary rounded-lg skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-24 bg-bg-secondary rounded skeleton-shimmer" />
                <div className="h-4 w-3/4 bg-bg-secondary rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 bg-bg-secondary rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
