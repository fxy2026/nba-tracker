export default function CompareLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 bg-bg-card rounded animate-pulse" />
        <div className="h-7 w-48 bg-bg-card rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="h-12 bg-bg-card rounded-xl border border-border animate-pulse" />
        <div className="h-12 bg-bg-card rounded-xl border border-border animate-pulse" />
      </div>
    </div>
  );
}
