/**
 * components/ui/LoadingSkeleton.jsx
 *
 * Animated skeleton loaders to replace content while data is loading.
 * Using CSS animation (pulse) — no JS timer needed.
 *
 * Components exported:
 *   <SkeletonLine width="w-3/4" />              → text line placeholder
 *   <SkeletonCard />                            → group/expense card placeholder
 *   <SkeletonGroupGrid count={6} />             → grid of 6 group card skeletons
 *   <SkeletonMemberRow />                       → member timeline row placeholder
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4' }) {
  return <div className={`skeleton ${width} ${height} rounded`} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-2/3" height="h-4" />
          <SkeletonLine width="w-1/2" height="h-3" />
        </div>
      </div>
      <SkeletonLine width="w-full" height="h-3" />
      <SkeletonLine width="w-4/5" height="h-3" />
      <div className="flex gap-2 pt-1">
        <div className="skeleton w-16 h-6 rounded-full" />
        <div className="skeleton w-20 h-6 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonGroupGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonMemberRow() {
  return (
    <div className="flex items-center gap-4 animate-pulse">
      <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
      <div className="w-28 flex-shrink-0 space-y-1">
        <SkeletonLine width="w-full" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-2" />
      </div>
      <div className="flex-1 skeleton h-6 rounded-full" />
      <div className="skeleton w-24 h-3 rounded" />
    </div>
  );
}
