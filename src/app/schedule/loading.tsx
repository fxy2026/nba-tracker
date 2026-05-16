export default function ScheduleLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="h-7 w-32 bg-bg-card rounded skeleton-shimmer mb-6" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-5 w-48 bg-bg-card rounded skeleton-shimmer mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-24 glass-tile skeleton-shimmer" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
