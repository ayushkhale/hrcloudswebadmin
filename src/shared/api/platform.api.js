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
import { SAMPLE_ORGANISATIONS, SAMPLE_SIGNUPS } from "../../data/sample";
import { daysUntil } from "../utils/format";

/** A trial this close to its end is worth a human looking at it. */
const TRIAL_WARNING_DAYS = 7;

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

export const platformAPI = { getOverview, listOrganisations };
