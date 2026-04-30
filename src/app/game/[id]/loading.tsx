export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 skeleton-shimmer">
      <div className="h-4 w-24 bg-bg-card rounded mb-4" />
      {/* Scoreboard skeleton */}
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center gap-10 py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-bg-hover rounded-full" />
            <div className="h-4 w-20 bg-bg-hover rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-16 bg-bg-hover rounded" />
            <div className="h-6 w-4 bg-bg-hover rounded" />
            <div className="h-12 w-16 bg-bg-hover rounded" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-bg-hover rounded-full" />
            <div className="h-4 w-20 bg-bg-hover rounded" />
          </div>
        </div>
      </div>
      {/* Table skeleton */}
      <div className="mt-6 space-y-6">
        {[1, 2].map((t) => (
          <div key={t} className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="h-5 w-40 bg-bg-hover rounded" />
            </div>
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((r) => (
                <div key={r} className="h-8 bg-bg-hover/50 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
