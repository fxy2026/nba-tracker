export default function StatsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 bg-bg-card rounded skeleton-shimmer" />
        <div className="h-7 w-40 bg-bg-card rounded skeleton-shimmer" />
      </div>
      <div className="h-10 w-80 bg-bg-card rounded-xl skeleton-shimmer mb-6" />
      <div className="bg-bg-card rounded-xl border border-border p-4">
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 bg-bg-secondary rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
