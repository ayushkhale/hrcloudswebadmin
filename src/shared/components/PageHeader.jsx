// ─────────────────────────────────────────────────────────────────────────────
// PageHeader.jsx — the purple hero banner. The DASHBOARD opens with it, and
// nothing else does. It is the first thing anyone sees on signing in.
//
// This is the same banner as HR Clouds Web's, deliberately: the gradient, the
// radius, the badge pill, the type scale. Someone who administers the platform
// also opens the product, and the two must look like one company built them.
//
// It used to top every screen here. It no longer does, for the reason HR
// Clouds Web found first: a band of saturated purple across every roster and
// record pushes the real work below the fold and spends the house colour on
// furniture, until nothing reads as purple any more (user decision,
// 18 Nov 2026). Working screens use `ScreenHeader` — keep the two in step
// with the web app's pair of the same names.
//
// The dark theme takes the same gradient three stops deeper, and loses the
// white glow behind it. The light banner on a dark page is the brightest
// thing on screen by a wide margin — it stops reading as a heading and
// starts reading as a lamp, which is exactly what someone picking the dark
// theme at night was getting away from.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The artwork every banner carries, unless a screen passes its own.
 *
 * It is a default rather than something each screen opts into, because the
 * banner is one component and it should not be possible for two screens to
 * disagree about whether it has art in it. `art={null}` opts a screen out;
 * nothing does today.
 */
const DEFAULT_ART = "/header-art.png";

export default function PageHeader({ badgeText, badgeIcon: BadgeIcon, title, subtitle, rightContent, art = DEFAULT_ART }) {
  return (
    // `min-h` rather than padding alone: a banner with one short title and no
    // right-hand button would otherwise collapse to half the height of the
    // one beside it in the next screen, and the whole point of this component
    // is that every page opens at the same size.
    <div className="bg-gradient-to-r from-[#5B21B6] via-[#6328D7] to-[#4C1D95] dark:from-[#2E1065] dark:via-[#3B1E7A] dark:to-[#1E0B3F] rounded-3xl px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9 min-h-[9rem] sm:min-h-[11rem] text-white relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs dark:shadow-none dark:border dark:border-purple-500/20">
      {/* Artwork sits in the BOTTOM-RIGHT CORNER, under the glow and the
          text. It is a corner ornament, not a backdrop: it takes about a
          quarter of the width, tucks into the corner it is anchored to, and
          never competes with the title for the eye.

          The source PNG is purple geometry on a solid WHITE field, which is
          what the filter is for: `invert` + `hue-rotate` flips the white to
          near-black while returning the shapes to purple, and
          `mix-blend-screen` then drops everything near-black into the
          gradient. The white field disappears, the shapes stay, and there is
          no rectangle edge to hide. Dropped in flat it is a white box on a
          purple banner; with `multiply` instead, the shapes can only ever go
          darker than the gradient and the art reads as a stain.

          The radial `mask-image`, anchored to the same bottom-right corner,
          dissolves the art's top and left edges into the gradient. Without it
          the PNG's own straight edges cut two lines across the banner and it
          reads as a picture pasted into a box.

          Hidden below `sm`: at phone width the banner is barely taller than
          its own text, and art behind two lines of white type is just a
          contrast problem. */}
      {art && (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          className="hidden sm:block absolute right-0 bottom-0 w-[26%] lg:w-[23%] pointer-events-none select-none [filter:invert(1)_hue-rotate(180deg)] mix-blend-screen opacity-90 dark:opacity-70 [mask-image:radial-gradient(130%_130%_at_bottom_right,black_45%,transparent_85%)]"
        />
      )}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 dark:opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="relative z-10 max-w-2xl space-y-1.5">
        {badgeText && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-semibold tracking-wide border border-white/20">
            {BadgeIcon && <BadgeIcon className="w-3 h-3 text-purple-200" />} {badgeText}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-purple-100/90 dark:text-purple-200/80 font-normal leading-relaxed">{subtitle}</p>
        )}
      </div>
      {rightContent && <div className="relative z-10 flex shrink-0 w-full sm:w-auto">{rightContent}</div>}
    </div>
  );
}
