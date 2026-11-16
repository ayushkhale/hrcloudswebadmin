// ─────────────────────────────────────────────────────────────────────────────
// Card.jsx — the card shell and the one header every card wears.
//
// Same shell as HR Clouds Web, to the class: white, rounded-3xl, one hairline
// border, the faintest shadow. Two products that sit beside each other in the
// same browser should not disagree about what a card looks like.
//
// In the dark theme a card is one step LIGHTER than the page, never darker:
// paper on a desk, the same way round as in the light theme. The shadow is
// dropped there — a shadow is a lighting cue and does nothing on a dark
// surface but muddy the hairline that is actually doing the separating.
// ─────────────────────────────────────────────────────────────────────────────

export const CARD =
  "bg-white rounded-3xl p-6 shadow-xs border border-slate-100 dark:bg-night-850 dark:border-night-700 dark:shadow-none";

/** Title, one quiet line under it at most, one action on the right. */
export function CardHeader({ title, subtitle, action, icon: Icon, divider = false }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        divider ? "mb-5 pb-4 border-b border-slate-100 dark:border-night-700" : "mb-5"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 dark:bg-purple-500/15 dark:text-purple-300">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800 leading-tight dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-[11px] font-semibold text-slate-400 mt-1 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** `<Card>` for the common case where you don't need the class string. */
export default function Card({ className = "", children }) {
  return <section className={`${CARD} ${className}`}>{children}</section>;
}
