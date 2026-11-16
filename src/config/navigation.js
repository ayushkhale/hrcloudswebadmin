// ─────────────────────────────────────────────────────────────────────────────
// navigation.js — the console's sidebar, in one place.
//
// The sidebar label, the page <h1> and the top-bar title are the SAME string.
// The product holds that rule across its four workspaces; breaking it here
// would make the two feel like different software.
//
// `built: false` sections are deliberately listed before they exist. A platform
// console is judged on whether the operator can see the whole shape of their
// job, and a section that says what is coming — and points at the document that
// specifies it — is more honest than a sidebar that grows a surprise every
// sprint.
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Tags,
  LifeBuoy,
  Activity,
  ScrollText,
  SlidersHorizontal,
} from 'lucide-react'

export const NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    built: true,
    capability: 'orgs.read',
    summary: "The one screen that answers 'is the platform healthy, and is it growing'.",
  },
  {
    key: 'organisations',
    label: 'Organisations',
    icon: Building2,
    built: false,
    capability: 'orgs.read',
    plan: '§3.1',
    summary:
      'Every customer company on HR Clouds — who they are, how many people they have added, what they are paying and whether anything is wrong.',
    willDo: [
      'One row per organisation with headcount, plan, seat usage and health',
      'An organisation record: modules in use, setup progress, owner contacts',
      'Suspend, reinstate and delete, with a mandatory reason on the audit trail',
    ],
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    icon: CreditCard,
    built: false,
    capability: 'billing.read',
    plan: '§3.2',
    summary:
      'Money across every organisation: what renews, what failed, what is in grace and what was refunded.',
    willDo: [
      'Revenue, renewals and churn across the whole platform, not one tenant',
      'Failed-payment and grace-period queues that clear as they are worked',
      'Credit, extend, waive or refund a subscription, with the reason recorded',
    ],
  },
  {
    key: 'plans',
    label: 'Plans & Pricing',
    icon: Tags,
    built: false,
    capability: 'plans.manage',
    plan: '§3.3',
    summary:
      'The catalogue itself — the tiers, their seat caps, and which capabilities each one unlocks.',
    willDo: [
      "Edit a plan's price, seat caps, grace period and public visibility",
      'Private enterprise plans issued to one named organisation',
      'A capability matrix that is the source of truth the product reads from',
    ],
  },
  {
    key: 'support',
    label: 'Support',
    icon: LifeBuoy,
    built: false,
    capability: 'support.impersonate',
    plan: '§3.4',
    summary:
      'Seeing what a customer sees, safely, so a question can be answered in one call.',
    willDo: [
      'Time-boxed, consented, fully logged read-only sessions inside a workspace',
      "The exact reason for a failure, from the org's own error and job history",
      'Resend an invite or unlock an account without a database query',
    ],
  },
  {
    key: 'health',
    label: 'System Health',
    icon: Activity,
    built: false,
    capability: 'orgs.read',
    plan: '§3.5',
    summary:
      'Whether the background work every organisation depends on actually ran.',
    willDo: [
      'Payroll runs, attendance calculation, leave accruals and letters, per org',
      'Queue depth, failure rate, and the jobs that silently did nothing',
      'Integration state: biometric devices, Razorpay webhooks, S3 and push',
    ],
  },
  {
    key: 'audit',
    label: 'Audit Log',
    icon: ScrollText,
    built: false,
    capability: 'audit.read',
    plan: '§3.6',
    summary:
      'Every platform-level action, who took it, against which organisation and why.',
    willDo: [
      'An append-only record no platform role can edit or delete',
      "Filter by actor, organisation, action and date; export for a customer's auditor",
      'Impersonation sessions recorded in full, start to finish',
    ],
  },
  {
    key: 'settings',
    // "Settings", not "Platform Settings": inside the Control Plane everything
    // is platform-level, and the longer label truncated in the sidebar.
    label: 'Settings',
    icon: SlidersHorizontal,
    built: false,
    capability: 'platform.settings',
    plan: '§3.7',
    summary:
      'The switches that apply to everybody at once, and the people allowed to throw them.',
    willDo: [
      'Feature flags, rolled out to one org, a cohort, or the whole platform',
      'Platform staff accounts and the roles that come after Super Admin',
      'Announcement banners, maintenance windows and statutory defaults',
    ],
  },
]

export function navItem(key) {
  return NAV_ITEMS.find((item) => item.key === key) || NAV_ITEMS[0]
}
