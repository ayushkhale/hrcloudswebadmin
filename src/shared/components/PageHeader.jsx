// ─────────────────────────────────────────────────────────────────────────────
// PageHeader.jsx — the purple hero banner. Every screen in this console opens
// with it, at the SAME SIZE on every one of them. It is the first thing anyone
// sees, and a page whose banner is shorter reads as the lesser page.
//
// This is the same banner as HR Clouds Web's, deliberately: the gradient, the
// radius, the badge pill, the type scale. Someone who administers the platform
// also opens the product, and the two must look like one company built them.
//
// New header information goes INSIDE the banner, not above or below it.
//
// The dark theme takes the same gradient three stops deeper, and loses the
// white glow behind it. The light banner on a dark page is the brightest
// thing on screen by a wide margin — it stops reading as a heading and
// starts reading as a lamp, which is exactly what someone picking the dark
// theme at night was getting away from.
// ─────────────────────────────────────────────────────────────────────────────

export default function PageHeader({ badgeText, badgeIcon: BadgeIcon, title, subtitle, rightContent }) {
  return (
    <div className="bg-gradient-to-r from-[#5B21B6] via-[#6328D7] to-[#4C1D95] dark:from-[#2E1065] dark:via-[#3B1E7A] dark:to-[#1E0B3F] rounded-3xl p-4 sm:p-5 text-white relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs dark:shadow-none dark:border dark:border-purple-500/20">
      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 dark:opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="relative z-10 max-w-2xl space-y-1">
        {badgeText && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-semibold tracking-wide border border-white/20">
            {BadgeIcon && <BadgeIcon className="w-3 h-3 text-purple-200" />} {badgeText}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-purple-100/90 dark:text-purple-200/80 font-normal leading-relaxed">{subtitle}</p>
        )}
      </div>
      {rightContent && <div className="relative z-10 flex shrink-0 w-full sm:w-auto">{rightContent}</div>}
    </div>
  );
}
