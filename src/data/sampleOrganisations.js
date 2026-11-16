// ─────────────────────────────────────────────────────────────────────────────
// sampleOrganisations.js — stand-in data for the Overview, kept in ONE file.
//
// There is no platform-plane API yet. Every HR Clouds endpoint today is
// tenant-scoped: `/api/v1/organizations/*` answers for the caller's OWN
// organisation, and billing is `hr`-only within one org. A console that sees
// across organisations needs `/api/v1/platform/*` to exist first — the shape it
// should have is specified in docs/CONTROL_PLANE_VISION.md §4.
//
// So this file lets the console be designed and reviewed now, and be deleted in
// one move later. Each record is deliberately the shape the platform API should
// return, so swapping the import for a fetch is the only change the Overview
// needs. The screen labels it as sample data — never quietly present invented
// numbers as real ones.
// ─────────────────────────────────────────────────────────────────────────────

/** The real catalogue — plan ids and seat caps from the product features guide §15. */
export const PLANS = {
  free: { label: 'Free', seats: { employee: 10, manager: 2, hr: 1 } },
  starter_monthly: { label: 'Starter · Monthly', seats: { employee: 20, manager: 5, hr: 2 } },
  starter_yearly: { label: 'Starter · Yearly', seats: { employee: 20, manager: 5, hr: 2 } },
  growth_monthly: { label: 'Growth · Monthly', seats: { employee: 300, manager: 10, hr: 5 } },
  growth_yearly: { label: 'Growth · Yearly', seats: { employee: 300, manager: 10, hr: 5 } },
  internal_unlimited: {
    label: 'Internal · Unlimited',
    seats: { employee: null, manager: null, hr: null },
  },
}

/**
 * One row per customer organisation.
 *
 * `state` is the subscription lifecycle state, which is what an operator
 * actually triages by: `active`, `grace` (payment failed, 3-day window),
 * `trial` (on Free), `cancelling` (runs to period end) and `suspended`.
 * `setupPercent` is the org's own readiness checklist — a paying customer
 * stuck at 30% is a churn risk long before they stop paying.
 */
export const SAMPLE_ORGANISATIONS = [
  {
    id: 'org_01',
    name: 'Nimbus Logistics',
    industry: 'Logistics & field services',
    plan: 'growth_yearly',
    state: 'active',
    members: { employee: 184, manager: 9, hr: 3 },
    setupPercent: 100,
    joined: '14 Feb 2026',
  },
  {
    id: 'org_02',
    name: 'Aperture Consulting',
    industry: 'IT consulting',
    plan: 'growth_monthly',
    state: 'grace',
    members: { employee: 71, manager: 6, hr: 2 },
    setupPercent: 100,
    joined: '02 Apr 2026',
  },
  {
    id: 'org_03',
    name: 'Harbour Foods',
    industry: 'Manufacturing',
    plan: 'starter_yearly',
    state: 'active',
    members: { employee: 19, manager: 4, hr: 2 },
    setupPercent: 86,
    joined: '21 Jun 2026',
  },
  {
    id: 'org_04',
    name: 'Lumen Design Studio',
    industry: 'Creative services',
    plan: 'starter_monthly',
    state: 'cancelling',
    members: { employee: 12, manager: 2, hr: 1 },
    setupPercent: 64,
    joined: '09 Jul 2026',
  },
  {
    id: 'org_05',
    name: 'Verity Clinics',
    industry: 'Healthcare',
    plan: 'growth_monthly',
    state: 'active',
    members: { employee: 142, manager: 8, hr: 4 },
    setupPercent: 92,
    joined: '28 Mar 2026',
  },
  {
    id: 'org_06',
    name: 'Steppe Agritech',
    industry: 'Agriculture',
    plan: 'free',
    state: 'trial',
    members: { employee: 8, manager: 2, hr: 1 },
    setupPercent: 31,
    joined: '12 Oct 2026',
  },
  {
    id: 'org_07',
    name: 'Castellan Security',
    industry: 'Facility services',
    plan: 'growth_yearly',
    state: 'active',
    members: { employee: 268, manager: 10, hr: 5 },
    setupPercent: 100,
    joined: '30 Jan 2026',
  },
  {
    id: 'org_08',
    name: 'Pellet & Co',
    industry: 'Retail',
    plan: 'starter_monthly',
    state: 'suspended',
    members: { employee: 16, manager: 3, hr: 1 },
    setupPercent: 78,
    joined: '16 May 2026',
  },
]

/* ─── Derivations the platform API should do server-side ─────────────────── */

export const totalMembers = (org) =>
  org.members.employee + org.members.manager + org.members.hr

/**
 * How full the organisation's employee seat allowance is, 0–1.
 * `null` for an unlimited plan — not 0, and never a dash on screen.
 */
export function seatUsage(org) {
  const cap = PLANS[org.plan]?.seats.employee
  if (cap == null) return null
  return org.members.employee / cap
}

/** The platform totals the Overview tiles show. */
export function platformTotals(orgs) {
  return {
    organisations: orgs.length,
    members: orgs.reduce((sum, org) => sum + totalMembers(org), 0),
    atRisk: orgs.filter((org) => ['grace', 'cancelling', 'suspended'].includes(org.state))
      .length,
    nearSeatCap: orgs.filter((org) => {
      const usage = seatUsage(org)
      return usage != null && usage >= 0.85
    }).length,
  }
}
