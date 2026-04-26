export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse">
      {/* Date nav skeleton */}
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="w-14 h-14 bg-bg-card rounded-lg" />
        ))}
      </div>
      {/* Game cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-card rounded-xl border border-border p-4 h-36" />
        ))}
      </div>
    </div>
  );
}
