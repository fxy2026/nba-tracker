export default function PlayerLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-bg-card rounded animate-pulse" />
      <div className="bg-bg-card rounded-xl border border-border mt-4 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-32 rounded-full bg-bg-secondary animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 bg-bg-secondary rounded animate-pulse mx-auto sm:mx-0" />
              <div className="h-4 w-48 bg-bg-secondary rounded animate-pulse mx-auto sm:mx-0" />
              <div className="h-4 w-36 bg-bg-secondary rounded animate-pulse mx-auto sm:mx-0" />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-border">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-bg-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
