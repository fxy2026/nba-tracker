export default function InjuriesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-bg-card rounded animate-pulse" />
      <div className="flex items-center gap-3 mt-4 mb-6">
        <div className="w-10 h-10 bg-bg-card rounded-lg animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-40 bg-bg-card rounded animate-pulse" />
          <div className="h-3 w-56 bg-bg-card rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="h-4 w-36 bg-bg-secondary rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-8 bg-bg-secondary rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
