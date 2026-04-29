export default function H2HLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="skeleton-shimmer h-8 w-48 rounded mb-2" />
      <div className="skeleton-shimmer h-4 w-72 rounded mb-6" />
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="flex-1 w-full flex flex-wrap gap-1.5 justify-center">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-7 w-14 rounded-lg" />
          ))}
        </div>
        <div className="skeleton-shimmer h-6 w-8 rounded" />
        <div className="flex-1 w-full flex flex-wrap gap-1.5 justify-center">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-7 w-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
