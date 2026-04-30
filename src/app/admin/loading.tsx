export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-bg-card rounded-xl border border-border p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 skeleton-shimmer rounded-full" />
        </div>
        <div className="h-6 w-32 skeleton-shimmer rounded mx-auto mb-6" />
        <div className="h-12 skeleton-shimmer rounded-lg mb-4" />
        <div className="h-12 skeleton-shimmer rounded-lg" />
      </div>
    </div>
  );
}
