export default function CalendarLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-bg-card rounded skeleton-shimmer" />
        <div className="h-9 w-40 bg-bg-card rounded skeleton-shimmer" />
      </div>
      <div className="glass-tile overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center py-2.5">
              <div className="h-4 w-6 mx-auto bg-bg-hover rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-b border-r border-border/50 p-2 h-20 skeleton-shimmer">
              <div className="h-4 w-4 rounded bg-bg-hover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
