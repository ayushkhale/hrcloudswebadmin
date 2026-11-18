// ─────────────────────────────────────────────────────────────────────────────
// ListControls.jsx — the search box, the filter row and the pager, for every
// list screen in this console.
//
// Both list screens (staff and organisations) search and filter on the SERVER
// and page on the server, so these are dumb controls over a query the screen
// owns. They do not hold state and they do not filter anything themselves —
// filtering a page of twenty rows in the browser is how a console starts
// lying about how many customers match a search.
// ─────────────────────────────────────────────────────────────────────────────
import { HiChevronLeft, HiChevronRight, HiSearch, HiX } from "react-icons/hi";

/** The search field. Debouncing belongs to the screen that owns the query. */
export function SearchField({ value, onChange, placeholder = "Search", label }) {
  return (
    <div className="relative flex-1 min-w-0">
      <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none dark:text-slate-500" />
      <input
        type="search"
        value={value}
        aria-label={label || placeholder}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-purple-400 transition-colors dark:bg-night-850 dark:border-night-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-500/60"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <HiX className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * One row of mutually exclusive filters, each carrying its own count.
 *
 * The counts are on the chips deliberately — house rule §5. A legend or a
 * filter row that fits on screen prints its numbers, so nobody clicks through
 * four filters to find out how many organisations are suspended.
 *
 * `options` is `[{ value, label, count }]`. A `count` of null prints nothing
 * rather than a zero, because "we didn't count" and "there are none" are
 * different facts.
 */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = (value || "") === (opt.value || "");
        return (
          <button
            key={opt.value || "all"}
            type="button"
            onClick={() => onChange(opt.value || "")}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              active
                ? "bg-purple-600 border-purple-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:bg-night-850 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-800 dark:hover:text-slate-100"
            }`}
          >
            {opt.label}
            {opt.count !== null && opt.count !== undefined && (
              <span className={`tabular-nums ${active ? "text-purple-200" : "text-slate-400 dark:text-slate-500"}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The pager. Says which rows you are looking at out of how many, because
 * "Page 2 of 7" on its own never answers the question somebody actually has.
 */
export function Pager({ page, totalPages, total, shown, onPage, noun = "rows" }) {
  if (!total) return null;
  const from = (page - 1) * (shown || 0) + 1;
  const to = from + (shown || 0) - 1;

  return (
    <div className="flex items-center justify-between gap-4 pt-4 mt-1 border-t border-slate-100 dark:border-night-700">
      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
        {shown > 0 ? `${from}–${to} of ${total.toLocaleString("en-IN")} ${noun}` : `${total.toLocaleString("en-IN")} ${noun}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <PagerButton onClick={() => onPage(page - 1)} disabled={page <= 1} label="Previous page">
            <HiChevronLeft className="w-4 h-4" />
          </PagerButton>
          <span className="text-[11px] font-bold text-slate-500 px-1 tabular-nums dark:text-slate-400">
            {page} / {totalPages}
          </span>
          <PagerButton onClick={() => onPage(page + 1)} disabled={page >= totalPages} label="Next page">
            <HiChevronRight className="w-4 h-4" />
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function PagerButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:bg-night-850 dark:border-night-600 dark:text-slate-400 dark:hover:bg-night-800 dark:hover:text-slate-100"
    >
      {children}
    </button>
  );
}

/** The one button style the list screens use for their primary action. */
export function PrimaryButton({ icon: Icon, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold shadow-sm shadow-purple-200 transition-colors disabled:opacity-60 dark:shadow-none ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

/** The quieter sibling, for a second action beside the primary one. */
export function GhostButton({ icon: Icon, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 text-xs font-bold transition-colors disabled:opacity-60 dark:bg-night-850 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-800 dark:hover:text-slate-100 ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}
