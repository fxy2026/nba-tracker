export default function SearchLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 bg-bg-card rounded skeleton-shimmer" />
        <div className="h-7 w-36 bg-bg-card rounded skeleton-shimmer" />
      </div>
      <div className="h-12 w-full bg-bg-card rounded-xl border border-border skeleton-shimmer" />
    </div>
  );
}
