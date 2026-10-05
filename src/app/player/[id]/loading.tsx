export default function PlayerLoading() {
  return (
    <>
    <div className="sm:hidden px-4 py-6" aria-busy="true" aria-label="Loading player">
      <div className="h-5 w-20 rounded bg-bg-card skeleton-shimmer mb-5" />
      <div className="flex items-center gap-4">
        <div className="w-[88px] h-[88px] shrink-0 rounded-2xl bg-bg-secondary skeleton-shimmer" />
        <div className="flex-1 space-y-3"><div className="h-7 w-3/4 rounded bg-bg-secondary skeleton-shimmer" /><div className="h-4 w-1/2 rounded bg-bg-secondary skeleton-shimmer" /></div>
      </div>
      <div className="h-3 w-2/3 rounded bg-bg-card skeleton-shimmer mt-4" />
      <div className="grid grid-cols-5 gap-3 py-5 mt-3 border-b border-border">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 rounded bg-bg-secondary skeleton-shimmer" />)}</div>
      <div className="grid grid-cols-3 gap-2 mt-6">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-32 rounded-xl bg-bg-card skeleton-shimmer" />)}</div>
    </div>
    <div className="hidden sm:block max-w-4xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-bg-card rounded skeleton-shimmer" />
      <div className="glass-tile mt-4 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-32 rounded-full bg-bg-secondary skeleton-shimmer" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 bg-bg-secondary rounded skeleton-shimmer mx-auto sm:mx-0" />
              <div className="h-4 w-48 bg-bg-secondary rounded skeleton-shimmer mx-auto sm:mx-0" />
              <div className="h-4 w-36 bg-bg-secondary rounded skeleton-shimmer mx-auto sm:mx-0" />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-border">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-bg-secondary rounded-lg skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
