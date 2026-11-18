// ─────────────────────────────────────────────────────────────────────────────
// ScreenHeader.jsx — the heading an ordinary working screen opens with.
//
// ─── WHY THIS EXISTS BESIDE PageHeader ─────────────────────────────────────
// `PageHeader` is the signature purple hero, and it stays exactly that: the
// thing the DASHBOARD opens with, and nothing else. A band of saturated purple
// across every roster and record pushes the real work below the fold and
// spends the house colour on furniture, until nothing reads as purple any
// more (user decision, 18 Nov 2026).
//
// ─── THE SHAPE IS HR CLOUDS WEB'S, TO THE CLASS ────────────────────────────
// Its working screens — Team, Invites — open with exactly this: no card, no
// tinted tile, just the title, one line under it, and the screen's action on
// the right of the same row. Copied rather than invented, so a person who
// administers the platform and also opens the product meets one heading and
// not two. If the web app's changes, change this with it.
//
// ─── THE RIGHT-HAND SIDE ───────────────────────────────────────────────────
// It holds the ONE thing this screen is for — grant access, add an
// organisation — and anything that acts on the screen as a whole. Row actions
// belong on their rows. The button is a normal `PrimaryButton` or
// `GhostButton`: there is no dark banner behind it any more, so nothing here
// uses the white-on-purple variant.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]     one sentence, what the screen is for
 * @param {React.ReactNode} [props.badge]        live state beside the title (a pill)
 * @param {React.ReactNode} [props.rightContent] the screen's action
 */
export default function ScreenHeader({ title, subtitle, badge, rightContent }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-slate-500 leading-relaxed mt-1 max-w-2xl dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {/* `self-start` on a phone so a full-width button doesn't stretch to the
          height of a two-line subtitle beside it. */}
      {rightContent && <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto">{rightContent}</div>}
    </div>
  );
}
