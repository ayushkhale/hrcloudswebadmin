// ─────────────────────────────────────────────────────────────────────────────
// StatusPill.jsx — an organisation's state, drawn the one way.
//
// The label comes from the dictionary and the colour from one map beside it,
// so a status can never be spelled two ways or wear two colours on two
// screens. Purple-only palette: violet is good, indigo is informational,
// fuchsia is waiting on somebody, rose is broken. No greens, no ambers.
// ─────────────────────────────────────────────────────────────────────────────
import { ORG_STATUS_TONE, orgStatusLabel } from "../../config/dictionary";

export default function StatusPill({ status, className = "" }) {
  const tone = ORG_STATUS_TONE[status] || ORG_STATUS_TONE.cancelled;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${tone} ${className}`}
    >
      {orgStatusLabel(status)}
    </span>
  );
}

/**
 * The square an organisation wears where a logo would go. Initials, in the
 * brand's purple. Never hand-roll this — a second copy drifts the moment one
 * of them gets a rounded corner.
 */
export function OrgMark({ name, size = "md" }) {
  const dims = size === "sm" ? "w-8 h-8 text-[10px] rounded-lg" : "w-10 h-10 text-xs rounded-xl";
  const initials = (() => {
    const words = (name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  })();
  return (
    <span
      className={`${dims} shrink-0 bg-purple-50 text-purple-700 font-bold flex items-center justify-center border border-purple-100 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-500/25`}
    >
      {initials}
    </span>
  );
}
