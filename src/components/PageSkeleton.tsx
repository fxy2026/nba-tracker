/**
 * Shared loading skeleton — used by every new feature page's loading.tsx
 * to avoid the blank-flash during route transitions.
 *
 * Visual: PageHeader skeleton (eyebrow + title + subtitle), then a flexible
 * row count of glass-tile placeholders.
 */
export default function PageSkeleton({
  maxWidth = "max-w-5xl",
  rows = 6,
  variant = "list",
}: {
  maxWidth?: "max-w-3xl" | "max-w-4xl" | "max-w-5xl" | "max-w-6xl" | "max-w-7xl";
  rows?: number;
  variant?: "list" | "grid";
}) {
  return (
    <div className={`${maxWidth} mx-auto px-4 py-6`}>
      {/* PageHeader skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-2xl skeleton-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 skeleton-shimmer rounded" />
            <div className="h-7 w-48 skeleton-shimmer rounded" />
          </div>
        </div>
        <div className="h-3 w-72 skeleton-shimmer rounded ml-12" />
      </div>

      {/* Body */}
      {variant === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="glass-tile h-32 skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="glass-tile h-14 skeleton-shimmer" />
          ))}
        </div>
      )}
    </div>
  );
}
