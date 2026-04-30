export default function HistoryLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-5 h-5 skeleton-shimmer rounded" />
        <div className="h-6 w-56 skeleton-shimmer rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
        ))}
      </div>
      <div className="skeleton-shimmer rounded-xl h-[500px]" />
    </div>
  );
}
