// ─────────────────────────────────────────────────────────────────────────────
// Pill.jsx — a small bordered label, in a tone from `config/platformMeta`.
//
// `StatusPill` is for one thing: an organisation's status, which has its own
// closed vocabulary in the dictionary. This is for the other half dozen
// closed vocabularies the platform plane has — a subscription's state, a
// staff member's state, an access tier — where the LABEL and TONE are decided
// in config and the pill only draws them.
//
// Deliberately takes a tone class string rather than a tone name. The maps in
// platformMeta already resolved it, and a second lookup table here is a second
// opinion about what colour "payment overdue" is.
// ─────────────────────────────────────────────────────────────────────────────
import { PILL_TONE } from "../../config/platformMeta";

export default function Pill({ label, tone = PILL_TONE.off, icon: Icon, title, className = "" }) {
  return (
    <span
      title={title || undefined}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${tone} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

/**
 * A quiet, uncoloured tag. For a fact that is neither good nor bad and should
 * not compete with the pills that are — "Granted", "Annual", "System role".
 */
export function Tag({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 whitespace-nowrap dark:bg-night-800 dark:border-night-700 dark:text-slate-400 ${className}`}
    >
      {children}
    </span>
  );
}
