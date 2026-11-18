// ─────────────────────────────────────────────────────────────────────────────
// platform.api.js — everything the console asks about organisations.
//
// ONE READ PER SCREEN. The Overview page makes a single call and gets back
// every number it draws. It does not fetch organisations, then revenue, then
// a chart series: three reads of the same table is three chances to show a
// screen that disagrees with itself, and three spinners where one would do.
// If a new card needs a new figure, add the figure to `getOverview`'s answer
// — do not add a second call beside it.
//
// The platform plane is not on the backend yet, so each read has a sample
// branch behind `ENV.USE_SAMPLE_DATA`. The paths below are the contract being
// proposed, written down so the server team has something exact to build.
// ─────────────────────────────────────────────────────────────────────────────
import { request, qs } from "./client";
import { ENV } from "../../config/env";
import { SAMPLE_ACTOR, SAMPLE_ORGANISATIONS, SAMPLE_SIGNUPS } from "../../data/sample";
import { daysUntil } from "../utils/format";

/** A trial this close to its end is worth a human looking at it. */
const TRIAL_WARNING_DAYS = 7;

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * `GET /platform/me` (#281) — who is signed in, and what they may see.
 *
 * This is the console's bootstrap AND its access check in one call, and it is
 * the only thing that may decide either. The token's `role` claim is not an
 * answer: the server re-reads the actual grant from the database on every
 * platform request, so a staff member who was demoted ninety seconds ago is
 * refused on their next call rather than when their token expires in three
 * days. That is the whole point of calling this on every app start.
 *
 * A failure here is not one case but four, and they are handled by the
 * caller, not swallowed here — see `AuthContext`:
 *   403 PLATFORM_ACCESS_REQUIRED → not staff; this console is not for them
 *   403 PLATFORM_ACCESS_REVOKED  → was staff; sign out
 *   500 / 503                    → the guard failed closed; retry, don't sign out
 *   401                          → ordinary expiry, handled in the client
 */
export async function getMe({ signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request("/platform/me", { signal });
    return normaliseActor(res?.data ?? res);
  }
  return settle(normaliseActor(SAMPLE_ACTOR), 350);
}

/**
 * One actor shape, whichever of the two documented ones arrives.
 *
 * The dated change record and the Phase 1 analysis both specify the name
 * fields FLAT on `data` (`first_name`, `display_name`, `avatar_url`). The
 * integration guide's §6.1 example nests the same fields under `profile` and
 * adds a `status`. Both are written as authoritative and they contradict each
 * other, so this reads either and hands the rest of the console one shape.
 *
 * Every name field is nullable by contract — a staff member created by the
 * bootstrap CLI has no profile row at all — so `name` falls back to the
 * identifier they signed in with rather than rendering an empty header.
 */
function normaliseActor(data) {
  if (!data) return null;
  const profile = data.profile || data;
  const displayName = profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return {
    id: data.id,
    identifier: data.identifier,
    identifierType: data.identifier_type || null,
    // Never an empty string: the top bar prints this, and a blank name there
    // reads as a broken page rather than as a missing profile row.
    name: displayName || data.identifier || null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
    avatarUrl: profile.avatar_url ?? null,
    // The gate. Everything the console shows or hides hangs off this one word.
    tier: data.tier,
    // Display only — never branch on `role.key`, which from Phase 2 can be a
    // custom key this build has never seen.
    role: data.role ? { key: data.role.key, name: data.role.name, priority: data.role.priority } : null,
    status: data.status ?? null,
    lastLoginAt: data.last_login_at ?? null,
  };
}

/** Sample reads resolve on a short delay, so loading states are real in dev. */
const settle = (value, ms = 450) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

/**
 * Everything the Overview screen draws, from one read.
 *
 * Shape (and the endpoint that will serve it): `GET /platform/overview`
 *   totals        — the five tiles across the top
 *   signups       — organisations per month, last 12 months
 *   planMix       — how many organisations sit on each tier
 *   biggest       — the largest organisations, by people
 *   attention     — organisations a person should look at today
 */
export async function getOverview({ signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) return request("/platform/overview", { signal });
  return settle(buildOverview(SAMPLE_ORGANISATIONS, SAMPLE_SIGNUPS));
}

/**
 * The organisations list. `GET /platform/organisations`
 * Paged on the server; the console never pulls the whole table to filter it
 * in the browser, because the whole table is the one thing that always grows.
 */
export async function listOrganisations({ query, status, plan, page = 1, signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    return request(`/platform/organisations${qs({ query, status, plan, page })}`, { signal });
  }
  const needle = (query || "").trim().toLowerCase();
  const rows = SAMPLE_ORGANISATIONS.filter((org) => {
    if (status && org.status !== status) return false;
    if (plan && org.plan !== plan) return false;
    if (needle && !`${org.name} ${org.city} ${org.industry}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  return settle({ rows, page, total: rows.length });
}

// ─── Derivation ──────────────────────────────────────────────────────────────
// The server will do this. It lives here, beside the sample branch, so the
// moment the endpoint exists this whole section is deleted rather than
// untangled from a screen.

function buildOverview(orgs, signups) {
  const live = orgs.filter((o) => o.status !== "cancelled");

  const totals = {
    organisations: live.length,
    // Everybody on every payroll on the platform. This is the number that
    // says how big HR Clouds actually is.
    people: live.reduce((sum, o) => sum + o.employees, 0),
    mrr: live.reduce((sum, o) => sum + o.mrr, 0),
    onTrial: live.filter((o) => o.status === "trial").length,
    // Counted, not estimated: an organisation whose payment is late or whose
    // account is switched off.
    atRisk: live.filter((o) => o.status === "in_grace" || o.status === "suspended").length,
  };

  const planMix = ["Free", "Starter", "Growth"].map((tier) => ({
    tier,
    organisations: live.filter((o) => tierOf(o.plan) === tier).length,
  }));

  const biggest = [...live].sort((a, b) => b.employees - a.employees).slice(0, 6);

  // Three reasons an organisation lands here, in the order a person cares:
  // the money stopped, the account is off, or a trial is about to lapse.
  const attention = live
    .map((org) => {
      if (org.status === "in_grace") return { org, reason: "Payment overdue", urgency: 0 };
      if (org.status === "suspended") return { org, reason: "Account suspended", urgency: 1 };
      const left = org.trialEnds ? daysUntil(org.trialEnds) : null;
      if (left !== null && left <= TRIAL_WARNING_DAYS) {
        return { org, reason: left <= 0 ? "Trial has ended" : `Trial ends in ${left} day${left === 1 ? "" : "s"}`, urgency: 2 };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.urgency - b.urgency);

  return { totals, signups, planMix, biggest, attention };
}

const tierOf = (code) => (code === "free" ? "Free" : code.startsWith("starter") ? "Starter" : "Growth");

export const platformAPI = { getMe, getOverview, listOrganisations };
