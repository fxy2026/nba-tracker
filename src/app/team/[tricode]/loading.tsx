export default function TeamLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="h-4 w-32 bg-bg-card rounded skeleton-shimmer" />
      <div className="glass-tile mt-4 p-6">
        <div className="flex items-center gap-5">
          <div className="w-[72px] h-[72px] rounded-lg bg-bg-secondary skeleton-shimmer" />
          <div className="space-y-2">
            <div className="h-8 w-56 bg-bg-secondary rounded skeleton-shimmer" />
            <div className="h-4 w-40 bg-bg-secondary rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-secondary rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="h-64 glass-tile skeleton-shimmer" />
        <div className="h-64 glass-tile skeleton-shimmer" />
      </div>
    </div>
  );
}
