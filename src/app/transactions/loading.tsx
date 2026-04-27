export default function TransactionsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-bg-card rounded animate-pulse mb-4" />
      <div className="h-8 w-48 bg-bg-card rounded animate-pulse mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 w-36 bg-bg-card rounded mb-2" />
            <div className="h-20 bg-bg-card rounded-xl border border-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
