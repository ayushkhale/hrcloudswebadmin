// ─────────────────────────────────────────────────────────────────────────────
// samplePlatform.js — stand-in rows for the platform endpoints that DO exist
// on the backend (#281–#295), written in the server's own shape.
//
// Separate from sample.js on purpose. That file holds the Overview's invented
// numbers, for an endpoint nobody has built. This one mirrors a contract that
// is already specified to the field, so it is snake_case, nested, and nullable
// everywhere the API says a null is possible.
//
// The awkward rows here are the point. A sample file full of tidy records
// tests nothing but the happy path, so these deliberately include: a staff
// member with no profile row, an account suspended while its membership is
// still active, a role that was retired but still has holders, an
// organisation with no HR contact, a plan with no seat ceiling, a headcount
// that failed to COUNT (null, not zero), and a detail panel that did not load.
// Every one of those is a case the API docs call out and a screen must survive.
//
// Reachable only from the api layer. A screen that imports this is a bug.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const ahead = (days) => new Date(Date.now() + days * DAY).toISOString();

const SUPER = "8f2c1d4a-57c6-4a1b-9f3e-6c2b8d4a1e55";

/** #286 — the role catalog. Flat and unpaginated, inactive roles included. */
export const SAMPLE_PLATFORM_ROLES = [
  { id: "rl_1", key: "super-admin", name: "Super Admin", description: "Everything, including what a customer pays", priority: 100, tier: "SUPER_ADMIN", is_system_role: true, is_assignable: false, is_active: true, assigned_count: 2, assignable_via_api: false },
  // `is_assignable: false` on the seeded admin role, yet it IS the common
  // invite target — which is exactly why a picker filters on
  // `assignable_via_api` instead. Kept faithful so that bug can't come back.
  { id: "rl_2", key: "admin", name: "Admin", description: "Runs the customer base day to day", priority: 80, tier: "ADMIN", is_system_role: true, is_assignable: false, is_active: true, assigned_count: 3, assignable_via_api: true },
  { id: "rl_3", key: "worker", name: "Worker", description: "Support desk and read-only diagnostics", priority: 70, tier: "WORKER", is_system_role: true, is_assignable: true, is_active: true, assigned_count: 2, assignable_via_api: true },
  { id: "rl_4", key: "support-lead", name: "Support Lead", description: "Runs the support desk", priority: 75, tier: "WORKER", is_system_role: false, is_assignable: true, is_active: true, assigned_count: 1, assignable_via_api: true },
  { id: "rl_5", key: "billing-ops", name: "Billing Ops", description: "Retired, folded into Admin", priority: 85, tier: "ADMIN", is_system_role: false, is_assignable: true, is_active: false, assigned_count: 1, assignable_via_api: false },
];

/** #282 — the staff directory. */
export const SAMPLE_PLATFORM_STAFF = [
  // Bootstrapped by the CLI: no profile row, and no `assigned_by`.
  { user_id: SUPER, email: "admin@hrclouds.in", identifier_type: "email", first_name: null, last_name: null, display_name: null, role: { key: "super-admin", name: "Super Admin", priority: 100, is_active: true }, tier: "SUPER_ADMIN", is_active: true, status: "active", invitation_pending: false, assigned_at: ago(540), assigned_by: null, last_login_at: ago(0.8), created_at: ago(540) },
  { user_id: "a1b2c3d4-0001-4a1b-9f3e-6c2b8d4a1e01", email: "sarah.ops@hrclouds.in", identifier_type: "email", first_name: "Sarah", last_name: "Jenkins", display_name: "Sarah Jenkins", role: { key: "admin", name: "Admin", priority: 80, is_active: true }, tier: "ADMIN", is_active: true, status: "active", invitation_pending: false, assigned_at: ago(78), assigned_by: SUPER, last_login_at: ago(2.1), created_at: ago(78) },
  { user_id: "a1b2c3d4-0002-4a1b-9f3e-6c2b8d4a1e02", email: "dev.patel@hrclouds.in", identifier_type: "email", first_name: "Dev", last_name: "Patel", display_name: "Dev Patel", role: { key: "support-lead", name: "Support Lead", priority: 75, is_active: true }, tier: "WORKER", is_active: true, status: "active", invitation_pending: false, assigned_at: ago(31), assigned_by: SUPER, last_login_at: ago(0.3), created_at: ago(31) },
  // Invited, never signed in.
  { user_id: "a1b2c3d4-0003-4a1b-9f3e-6c2b8d4a1e03", email: "alex.support@hrclouds.in", identifier_type: "email", first_name: "Alex", last_name: "Rivera", display_name: "Alex Rivera", role: { key: "worker", name: "Worker", priority: 70, is_active: true }, tier: "WORKER", is_active: true, status: "pending_verification", invitation_pending: true, assigned_at: ago(1.2), assigned_by: "a1b2c3d4-0001-4a1b-9f3e-6c2b8d4a1e01", last_login_at: null, created_at: ago(1.2) },
  // Membership active, ACCOUNT suspended. The server refuses on either, so a
  // console showing only one flag cannot explain why this person is locked out.
  { user_id: "a1b2c3d4-0004-4a1b-9f3e-6c2b8d4a1e04", email: "priya.n@hrclouds.in", identifier_type: "email", first_name: "Priya", last_name: "Nair", display_name: "Priya Nair", role: { key: "admin", name: "Admin", priority: 80, is_active: true }, tier: "ADMIN", is_active: true, status: "suspended", invitation_pending: false, assigned_at: ago(190), assigned_by: SUPER, last_login_at: ago(26), created_at: ago(190) },
  // Membership revoked, holding a role that has since been retired.
  { user_id: "a1b2c3d4-0005-4a1b-9f3e-6c2b8d4a1e05", email: "mohan.r@hrclouds.in", identifier_type: "email", first_name: "Mohan", last_name: "Rao", display_name: "Mohan Rao", role: { key: "billing-ops", name: "Billing Ops", priority: 85, is_active: false }, tier: "ADMIN", is_active: false, status: "active", invitation_pending: false, assigned_at: ago(310), assigned_by: SUPER, last_login_at: ago(88), created_at: ago(310) },
  { user_id: "a1b2c3d4-0006-4a1b-9f3e-6c2b8d4a1e06", email: "ops.lead@hrclouds.in", identifier_type: "email", first_name: "Ananya", last_name: "Iyer", display_name: "Ananya Iyer", role: { key: "super-admin", name: "Super Admin", priority: 100, is_active: true }, tier: "SUPER_ADMIN", is_active: true, status: "active", invitation_pending: false, assigned_at: ago(420), assigned_by: SUPER, last_login_at: ago(0.1), created_at: ago(420) },
  { user_id: "a1b2c3d4-0007-4a1b-9f3e-6c2b8d4a1e07", email: "kiran.d@hrclouds.in", identifier_type: "email", first_name: "Kiran", last_name: "Desai", display_name: "Kiran Desai", role: { key: "worker", name: "Worker", priority: 70, is_active: true }, tier: "WORKER", is_active: true, status: "active", invitation_pending: false, assigned_at: ago(14), assigned_by: "a1b2c3d4-0001-4a1b-9f3e-6c2b8d4a1e01", last_login_at: ago(1.1), created_at: ago(14) },
];

/** The plan catalogue a grant form picks from. */
export const SAMPLE_PLANS = [
  { code: "free", name: "Free", amount: "0.00", currency: "INR", billing_cycle: "monthly", max_employees: 10, is_active: true, is_private: false },
  { code: "starter_monthly", name: "Starter Plan", amount: "990.00", currency: "INR", billing_cycle: "monthly", max_employees: 20, is_active: true, is_private: false },
  { code: "starter_yearly", name: "Starter Plan (Annual)", amount: "9900.00", currency: "INR", billing_cycle: "yearly", max_employees: 20, is_active: true, is_private: false },
  { code: "growth_monthly", name: "Growth Plan", amount: "4990.00", currency: "INR", billing_cycle: "monthly", max_employees: 100, is_active: true, is_private: false },
  { code: "growth_yearly", name: "Growth Plan (Annual)", amount: "49900.00", currency: "INR", billing_cycle: "yearly", max_employees: 100, is_active: true, is_private: false },
  // A private plan is grantable — that is what a private plan is for.
  { code: "enterprise_custom", name: "Enterprise (Custom)", amount: "0.00", currency: "INR", billing_cycle: "yearly", max_employees: null, is_active: true, is_private: true },
];

/**
 * #289 — the organisation directory.
 *
 * Note which statuses exist: `active`, `inactive`, `suspended`. There is no
 * "trial" and no "grace" ORGANISATION status — those belong to the
 * subscription, and conflating the two is how a console ends up telling an
 * operator that a paying customer is suspended.
 */
export const SAMPLE_ORGS = [
  { id: "550e8400-0001-4a1b-9f3e-000000000001", name: "Nimbus Logistics", key: "nimbus-log", status: "active", created_at: ago(410), industry: "Logistics", size: "201-500", city: "Pune", state: "Maharashtra",
    plan: { code: "growth_yearly", name: "Growth Plan (Annual)", max_employees: 250, current_period_end: ahead(142), subscription_status: "active", is_override: false },
    usage: { active_employees: 212, seat_limit: 250, quota_utilization_percent: 84.8 },
    primary_contact: { name: "Rajesh Sharma", email: "hr@nimbus.example", identifier: "hr@nimbus.example", identifier_type: "email", phone: "+91 98765 43210" } },

  // Phone-identified HR: `email` is null. Keying the contact off `email`
  // alone would hide a real person from the operator.
  { id: "550e8400-0002-4a1b-9f3e-000000000002", name: "Kettle and Co Foods", key: "kettle-co", status: "active", created_at: ago(96), industry: "Food and Beverage", size: "11-50", city: "Bengaluru", state: "Karnataka",
    plan: { code: "starter_monthly", name: "Starter Plan", max_employees: 20, current_period_end: ahead(12), subscription_status: "active", is_override: false },
    usage: { active_employees: 17, seat_limit: 20, quota_utilization_percent: 85.0 },
    primary_contact: { name: "Meera Joshi", email: null, identifier: "+919812345678", identifier_type: "phone", phone: "+91 98123 45678" } },

  { id: "550e8400-0003-4a1b-9f3e-000000000003", name: "Veridian Health", key: "veridian", status: "active", created_at: ago(268), industry: "Healthcare", size: "51-200", city: "Hyderabad", state: "Telangana",
    plan: { code: "growth_monthly", name: "Growth Plan", max_employees: 180, current_period_end: ahead(21), subscription_status: "active", is_override: false },
    usage: { active_employees: 164, seat_limit: 180, quota_utilization_percent: 91.1 },
    primary_contact: { name: "Anil Kumar", email: "people@veridian.example", identifier: "people@veridian.example", identifier_type: "email", phone: null } },

  // Granted by platform staff rather than paid for, on a plan with NO ceiling.
  { id: "550e8400-0004-4a1b-9f3e-000000000004", name: "Brightpath Schools", key: "brightpath", status: "active", created_at: ago(520), industry: "Education", size: "201-500", city: "Lucknow", state: "Uttar Pradesh",
    plan: { code: "enterprise_custom", name: "Enterprise (Custom)", max_employees: null, current_period_end: null, subscription_status: "active", is_override: true },
    usage: { active_employees: 338, seat_limit: null, quota_utilization_percent: null },
    primary_contact: { name: "Agnes Dsouza", email: "admin@brightpath.example", identifier: "admin@brightpath.example", identifier_type: "email", phone: "+91 91234 56780" } },

  // No live subscription AND no HR contact. Both are real operational problems.
  { id: "550e8400-0005-4a1b-9f3e-000000000005", name: "Tidewater Marine", key: "tidewater", status: "active", created_at: ago(372), industry: "Shipping", size: "11-50", city: "Kochi", state: "Kerala",
    plan: null,
    usage: { active_employees: 19, seat_limit: null, quota_utilization_percent: null },
    primary_contact: null },

  { id: "550e8400-0006-4a1b-9f3e-000000000006", name: "Mandal Textiles", key: "mandal-tex", status: "suspended", created_at: ago(298), industry: "Manufacturing", size: "11-50", city: "Surat", state: "Gujarat",
    plan: { code: "starter_monthly", name: "Starter Plan", max_employees: 20, current_period_end: ago(34), subscription_status: "expired", is_override: false },
    usage: { active_employees: 20, seat_limit: 20, quota_utilization_percent: 100.0 },
    primary_contact: { name: "Bhavin Mandal", email: "bhavin@mandal.example", identifier: "bhavin@mandal.example", identifier_type: "email", phone: "+91 90000 11111" } },

  // Registration never completed, so there is no profile row at all.
  { id: "550e8400-0007-4a1b-9f3e-000000000007", name: "Peak Ridge Travel", key: "peak-ridge", status: "inactive", created_at: ago(3), industry: null, size: null, city: null, state: null,
    plan: null,
    usage: { active_employees: 0, seat_limit: null, quota_utilization_percent: null },
    primary_contact: null },

  { id: "550e8400-0008-4a1b-9f3e-000000000008", name: "Ironleaf Energy", key: "ironleaf", status: "active", created_at: ago(455), industry: "Energy", size: "201-500", city: "Ahmedabad", state: "Gujarat",
    plan: { code: "growth_yearly", name: "Growth Plan (Annual)", max_employees: 300, current_period_end: ahead(95), subscription_status: "active", is_override: false },
    usage: { active_employees: 271, seat_limit: 300, quota_utilization_percent: 90.3 },
    primary_contact: { name: "Sneha Patel", email: "hr@ironleaf.example", identifier: "hr@ironleaf.example", identifier_type: "email", phone: null } },

  // The headcount FAILED to count: null, not zero. "0 of 150 seats" here
  // could talk an operator into cutting seats a customer is actually using.
  { id: "550e8400-0009-4a1b-9f3e-000000000009", name: "Corvus Security", key: "corvus", status: "active", created_at: ago(187), industry: "Security", size: "51-200", city: "Chennai", state: "Tamil Nadu",
    plan: { code: "growth_monthly", name: "Growth Plan", max_employees: 150, current_period_end: ahead(16), subscription_status: "active", is_override: false },
    usage: { active_employees: null, seat_limit: 150, quota_utilization_percent: null },
    primary_contact: { name: "Vikram Reddy", email: "ops@corvus.example", identifier: "ops@corvus.example", identifier_type: "email", phone: "+91 93333 44444" } },

  { id: "550e8400-0010-4a1b-9f3e-000000000010", name: "Quartz Analytics", key: "quartz", status: "active", created_at: ago(154), industry: "Software", size: "51-200", city: "Gurugram", state: "Haryana",
    plan: { code: "growth_monthly", name: "Growth Plan", max_employees: 120, current_period_end: ahead(8), subscription_status: "active", is_override: false },
    usage: { active_employees: 97, seat_limit: 120, quota_utilization_percent: 80.8 },
    primary_contact: { name: "Tara Menon", email: "tara@quartz.example", identifier: "tara@quartz.example", identifier_type: "email", phone: null } },

  { id: "550e8400-0011-4a1b-9f3e-000000000011", name: "Alder and Finch Legal", key: "alder-finch", status: "active", created_at: ago(205), industry: "Legal", size: "11-50", city: "Mumbai", state: "Maharashtra",
    plan: { code: "starter_yearly", name: "Starter Plan (Annual)", max_employees: 20, current_period_end: ahead(160), subscription_status: "active", is_override: false },
    usage: { active_employees: 14, seat_limit: 20, quota_utilization_percent: 70.0 },
    primary_contact: { name: "Farah Siddiqui", email: "farah@alderfinch.example", identifier: "farah@alderfinch.example", identifier_type: "email", phone: null } },

  { id: "550e8400-0012-4a1b-9f3e-000000000012", name: "Lotus Wellness", key: "lotus", status: "active", created_at: ago(61), industry: "Healthcare", size: "11-50", city: "Indore", state: "Madhya Pradesh",
    plan: { code: "starter_monthly", name: "Starter Plan", max_employees: 20, current_period_end: ahead(5), subscription_status: "active", is_override: false },
    usage: { active_employees: 11, seat_limit: 20, quota_utilization_percent: 55.0 },
    primary_contact: { name: "Deepa Shah", email: "deepa@lotus.example", identifier: "deepa@lotus.example", identifier_type: "email", phone: "+91 95555 66666" } },
];

/**
 * #290 — the detail card, built from a directory row.
 *
 * Every panel but `organization` is fetched best-effort on the server. One
 * organisation here has panels in `unavailable` so the degraded rendering is
 * something you SEE in sample mode rather than something you hope works.
 */
export function buildOrgDetail(org) {
  if (!org) return null;

  // Corvus is the designated casualty: two panels down, which is exactly the
  // "a broken organisation still produces a usable card" case.
  const broken = org.key === "corvus";
  const neverProvisioned = org.status === "inactive";

  const subscription = org.plan
    ? {
        id: `sub_${org.key}`,
        is_live: org.plan.subscription_status === "active",
        status: org.plan.subscription_status,
        is_override: org.plan.is_override,
        // Read off the catalogue rather than guessed from the code's suffix.
        // Guessing got `enterprise_custom` — a yearly plan — reported as
        // billed monthly, which is exactly the sort of quiet wrongness a
        // stand-in is supposed to not teach anybody.
        plan: {
          code: org.plan.code,
          name: org.plan.name,
          amount: planOf(org.plan.code)?.amount ?? "0.00",
          currency: planOf(org.plan.code)?.currency ?? "INR",
          billing_cycle: planOf(org.plan.code)?.billing_cycle ?? "monthly",
        },
        current_period_start: ago(90),
        current_period_end: org.plan.current_period_end,
        cancel_at_period_end: false,
        limits: { max_employees: org.plan.max_employees, max_managers: 10, max_hrs: 3 },
        feature_keys: ["attendance.access", "leave.access", "documents.access"],
      }
    : null;

  return {
    organization: { id: org.id, name: org.name, key: org.key, status: org.status, created_at: org.created_at },
    profile: org.industry
      ? { industry: org.industry, size: org.size, city: org.city, state: org.state, logo_url: null, pan_number: "AAAAA0000A", gst_number: "27AAAAA0000A1Z5" }
      : null,
    subscription,
    usage: broken ? { active_employees: null, seat_limit: 150, quota_utilization_percent: null } : org.usage,
    // `null` for an inactive organisation is NOT a failure — it never
    // completed registration, so it has no onboarding to report. The server
    // leaves it out of `unavailable` precisely to say so.
    setup: neverProvisioned || broken ? null : { completed_steps: 6, total_steps: 8, percent: 75, pending: ["Payroll details", "Holiday calendar"] },
    limits_audit: subscription
      ? { drifted: org.key === "nimbus-log", snapshot: { max_employees: org.plan.max_employees }, current: { max_employees: org.key === "nimbus-log" ? 100 : org.plan.max_employees } }
      : null,
    recent_subscription_events: subscription
      ? [
          { id: "ev_1", type: org.plan.is_override ? "admin_override_granted" : "subscription_renewed", at: ago(18), note: org.plan.is_override ? "Granted by platform staff" : "Renewed automatically" },
          { id: "ev_2", type: "subscription_created", at: org.created_at, note: "First subscription" },
        ]
      : null,
    recent_audit_logs: broken
      ? null
      : [
          { id: "al_1", action: "ORG_STATUS_CHANGED", actor: "admin@hrclouds.in", at: ago(34), reason: "Payment default on annual invoice" },
          { id: "al_2", action: "PLAN_OVERRIDE_GRANTED", actor: "sarah.ops@hrclouds.in", at: ago(120), reason: "Enterprise pilot agreed with the client" },
        ].slice(0, org.status === "suspended" ? 2 : 1),
    unavailable: broken ? ["setup", "recent_audit_logs"] : [],
  };
}

const planOf = (code) => SAMPLE_PLANS.find((p) => p.code === code) || null;
