// ─────────────────────────────────────────────────────────────────────────────
// States.jsx — the two states that are not "loading" and not "here is the data".
//
// A screen has four states and all four are designed, never improvised:
//   loading  → a Skeleton shaped like the content
//   error    → ErrorState, which says what to do and offers the retry
//   empty    → EmptyState, which says what would put something here
//   data     → the screen
//
// "Nothing on file" and "couldn't load" are DIFFERENT FACTS. An empty state
// where a read actually failed invites someone to create a duplicate of a
// record that already exists. Never collapse the two.
// ─────────────────────────────────────────────────────────────────────────────
import { HiExclamationCircle, HiInbox, HiRefresh } from "react-icons/hi";

/** A read that failed. Always offers the way out, never a raw error code. */
export function ErrorState({ error, onRetry, fallback = "Couldn’t load this." }) {
  const message = typeof error === "string" ? error : error?.message || fallback;
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <span className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 dark:bg-rose-500/15 dark:text-rose-300">
        <HiExclamationCircle className="w-6 h-6" />
      </span>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{fallback}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed dark:text-slate-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors dark:bg-night-800 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700 dark:hover:text-slate-100"
        >
          <HiRefresh className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

/** A read that worked and found nothing. Says what would put something here. */
export function EmptyState({ icon: Icon = HiInbox, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 dark:bg-night-800 dark:text-slate-500">
        <Icon className="w-6 h-6" />
      </span>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
