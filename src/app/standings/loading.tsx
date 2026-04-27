export default function StandingsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="h-8 w-56 bg-bg-card rounded animate-pulse mb-2" />
      <div className="h-4 w-72 bg-bg-card rounded animate-pulse mb-6" />

      <div className="h-6 w-48 bg-bg-card rounded animate-pulse mb-3" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="h-4 w-20 bg-bg-hover rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-8 bg-bg-hover rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-6 w-48 bg-bg-card rounded animate-pulse mb-3" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="h-4 w-20 bg-bg-hover rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-8 bg-bg-hover rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
