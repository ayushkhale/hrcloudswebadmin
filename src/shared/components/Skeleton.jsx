// ─────────────────────────────────────────────────────────────────────────────
// Skeleton.jsx — the loading state, and the only one.
//
// HOUSE RULE: never show a blank page, a bare spinner or a white card while
// data loads. Every screen that fetches renders a skeleton shaped like the
// thing that is coming, so the page does not jump when it arrives.
//
// A skeleton is part of building a screen, not a follow-up somebody asks for.
// If you add a card, add its skeleton in the same commit.
//
// In the dark theme a bar is LIGHTER than the card it sits on, because a
// darker one reads as a hole cut in the card rather than as content on its
// way. Both are translucent, so a bar works on a card and on the page.
// ─────────────────────────────────────────────────────────────────────────────

/** One grey bar. Everything else here is built out of these. */
export function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-slate-200/70 rounded-lg animate-pulse dark:bg-slate-100/10 ${className}`}
    />
  );
}

/** A run of text lines, the last one short — the way a paragraph really ends. */
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** The five figures across the top of the Overview. */
export function SkeletonTiles({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs dark:bg-night-850 dark:border-night-700 dark:shadow-none">
          <Skeleton className="h-9 w-9 rounded-xl mb-4" />
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A card with a heading and a block of content under it. */
export function SkeletonCard({ height = "h-56" }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs dark:bg-night-850 dark:border-night-700 dark:shadow-none">
      <Skeleton className="h-5 w-40 mb-2" />
      <Skeleton className="h-3 w-56 mb-6" />
      <Skeleton className={`w-full ${height} rounded-2xl`} />
    </div>
  );
}

/** Rows in a list, each with an avatar square and two lines beside it. */
export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
