// ─────────────────────────────────────────────────────────────────────────────
// brand.js — every user-visible product string with a single source.
//
// The product these organisations subscribe to is "HR Clouds" (two words,
// capital C). This console is the "Control Plane". No screen types either name
// inline, so a rename is a change to this file and nothing else — which is how
// the old "SupAdmin" wording ended up in six places at once.
//
// ROLES: one role ships today, `super-admin`. The console is written for more.
// Gates go through `can(role, capability)`, never `role === "super-admin"`, so
// adding Support or Finance Ops later is a change to CAPABILITIES and nothing
// else. See docs/CONTROL_PLANE_VISION.md §6.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  product: 'HR Clouds',
  console: 'Control Plane',
  full: 'HR Clouds Control Plane',
  tagline: 'Smart HR. Simplified.',
  purpose: 'The platform console above every customer organisation.',
  supportEmail: 'support@hrclouds.in',
}

/** What the product calls the things this console governs. */
export const TERMS = {
  org: 'Organisation',
  orgPlural: 'Organisations',
  member: 'Member',
  memberPlural: 'Members',
  seat: 'Seat',
  seatPlural: 'Seats',
}

export const PLATFORM_ROLES = {
  'super-admin': {
    label: 'Super Admin',
    blurb: 'Full access to every organisation, subscription and platform control.',
  },
}

/**
 * Capabilities, not roles, gate the UI. A role that lacks one sees the control
 * ABSENT, never disabled and never 403-ing on press.
 */
export const CAPABILITIES = {
  'super-admin': [
    'orgs.read',
    'orgs.suspend',
    'billing.read',
    'billing.override',
    'plans.manage',
    'support.impersonate',
    'platform.settings',
    'audit.read',
  ],
}

/** Normalize any role string the API sends ("Super Admin", "SUPER_ADMIN"). */
export function normalizeRole(role) {
  return (role || '').toString().trim().toLowerCase().replace(/[\s_]+/g, '-')
}

/** Display name for a role, whatever casing arrived. */
export function roleLabel(role) {
  const key = normalizeRole(role)
  return (
    PLATFORM_ROLES[key]?.label ||
    (key ? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '')
  )
}

/** Does this role hold this capability? Unknown role → no. */
export function can(role, capability) {
  return (CAPABILITIES[normalizeRole(role)] || []).includes(capability)
}
