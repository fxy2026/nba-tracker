export default function ClutchLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 skeleton-shimmer rounded-lg" />
        <div>
          <div className="h-6 w-48 skeleton-shimmer rounded mb-1" />
          <div className="h-4 w-64 skeleton-shimmer rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
        ))}
      </div>
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 skeleton-shimmer rounded-lg" />
        ))}
      </div>
      <div className="skeleton-shimmer rounded-xl h-96" />
    </div>
  );
}
