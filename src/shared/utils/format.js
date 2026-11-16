// ─────────────────────────────────────────────────────────────────────────────
// format.js — the only place a number or date becomes text.
//
// House rule carried over from HR Clouds Web: NEVER RENDER A DASH. Something
// unknown reads "N/A"; a measured zero reads "0". The two are different facts
// and a dash tells you neither.
// ─────────────────────────────────────────────────────────────────────────────

/** Anything we don't know. One spelling, everywhere. */
export const NA = "N/A";

/** `displayValue(x)` → the value, or N/A. Never a dash, never "null". */
export function displayValue(value, fallback = NA) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

/** 1 234 → "1,234". Indian grouping, because the customers are Indian. */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return NA;
  return Number(n).toLocaleString("en-IN");
}

/**
 * Money, as finance reads it on a dashboard: ₹4.2L, ₹1.3Cr. The exact rupee
 * belongs on an invoice, not on a tile somebody glances at.
 */
export function formatMoney(amount, { exact = false } = {}) {
  const n = Number(amount);
  if (amount === null || amount === undefined || Number.isNaN(n)) return NA;
  if (exact) return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** "12 Mar 2026". The year is always there — a console shows old records. */
export function formatDate(value) {
  if (!value) return NA;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * How long ago, in the words someone would actually use. A console is read at
 * a glance: "2 days ago" lands faster than a timestamp you have to subtract.
 */
export function timeAgo(value) {
  if (!value) return NA;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return NA;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** Days from today until `value`; negative means it already passed. */
export function daysUntil(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / 86400000);
}

/** Two initials for an organisation with no logo. Never hand-roll this again. */
export function initialsOf(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
