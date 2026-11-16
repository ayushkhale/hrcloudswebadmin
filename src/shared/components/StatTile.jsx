// ─────────────────────────────────────────────────────────────────────────────
// StatTile.jsx — one number, and what it is a number of.
//
// Deliberately short on words. A tile is read in half a second, so it carries
// a figure, a two-or-three-word label, and nothing else. If a tile needs a
// sentence to be understood, the sentence belongs in the card below it.
// ─────────────────────────────────────────────────────────────────────────────

export default function StatTile({ icon: Icon, label, value, note, tone = "purple" }) {
  // Dark gets a translucent wash of the same hue rather than a second set of
  // colours: a flat `-900` swatch behind a `-300` icon looks painted on, and
  // one that lets the card through stays part of the card.
  const tones = {
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs dark:bg-night-850 dark:border-night-700 dark:shadow-none">
      {Icon && (
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${tones[tone] || tones.purple}`}>
          <Icon className="w-[1.1rem] h-[1.1rem]" />
        </span>
      )}
      <p className="text-2xl font-bold text-slate-800 tabular-nums leading-none dark:text-slate-50">{value}</p>
      <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wide dark:text-slate-500">{label}</p>
      {note && <p className="text-[11px] font-semibold text-slate-500 mt-1 dark:text-slate-400">{note}</p>}
    </div>
  );
}
