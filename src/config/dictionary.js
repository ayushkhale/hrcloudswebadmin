// ─────────────────────────────────────────────────────────────────────────────
// dictionary.js — every word this console says about a shared idea, in one
// place. Same rule as HR Clouds Web and the mobile app: a term with a single
// source lives here, so three screens can't call one thing three names.
//
// Add a word here BEFORE you type it on a screen.
// ─────────────────────────────────────────────────────────────────────────────

export const DICTIONARY = {
  /** The product, as people read it. Never "SupAdmin" — it isn't a word. */
  PRODUCT: {
    NAME: "HR Clouds",
    CONSOLE: "Platform Console",
    FULL: "HR Clouds Platform Console",
    // What the console governs: every organisation, on every plan.
    PLANE: "Platform",
  },

  /**
   * What each role is CALLED in front of the person holding it. The API sends
   * a code (`platform_admin`); a code on screen reads like a database value.
   *
   * NOTE ON NAMING: inside a customer's organisation, HR Clouds already has a
   * role called `super-admin` — the most senior person in THAT organisation.
   * This console sits a plane above it, so its roles are never called "super"
   * anything. The people here are Platform staff.
   */
  ROLE_TITLE: {
    platform_admin: "Platform Admin",
    platform_support: "Support",
    platform_finance: "Finance",
    platform_auditor: "Auditor",
  },

  /** Words used about a customer. "Tenant" is jargon; say organisation. */
  TERMS: {
    ORGANISATION: "Organisation",
    ORGANISATIONS: "Organisations",
    PEOPLE: "People",
    EMPLOYEE: "Employee",
    PLAN: "Plan",
    SEATS: "Seats",
    SEATS_USED: "Seats used",
    // Money in, counted the way finance counts it.
    MRR: "Monthly revenue",
    ARR: "Yearly revenue",
    SIGNED_UP: "Signed up",
    LAST_ACTIVE: "Last active",
    TRIAL_ENDS: "Trial ends",
    RENEWS: "Renews",
    // An organisation that stopped paying but hasn't been shut off yet.
    GRACE: "Grace period",
    // Reading a customer's workspace as them, with their permission.
    IMPERSONATE: "Open as this organisation",
  },

  /** The state an organisation is in. One map; no screen invents a label. */
  ORG_STATUS: {
    active: "Active",
    trial: "On trial",
    in_grace: "Payment overdue",
    suspended: "Suspended",
    cancelled: "Cancelled",
  },

  /** Page and card headings, so two screens can't name the same thing twice. */
  HEADERS: {
    OVERVIEW: "Overview",
    ORGANISATIONS: "Organisations",
    SIGNUPS: "New organisations",
    PLATFORM_HEALTH: "Platform health",
    REVENUE: "Revenue",
    PLAN_MIX: "Who is on which plan",
    BIGGEST_ORGS: "Biggest organisations",
    NEEDS_ATTENTION: "Needs attention",
  },

  /** One line under a heading, at most. Never a paragraph. */
  DESCRIPTIONS: {
    SIGNUPS: "Organisations that joined, by month",
    PLAN_MIX: "Share of organisations on each plan",
    BIGGEST_ORGS: "By people on the payroll",
    NEEDS_ATTENTION: "Overdue, suspended, or a trial about to end",
  },

  /** What an empty list says. It always says what to do next. */
  EMPTY: {
    ORGANISATIONS: "No organisations yet. The first sign-up will show here.",
    NEEDS_ATTENTION: "Nothing needs you right now.",
  },

  /**
   * How the console asks which theme you want. "Appearance" and not "Theme",
   * because the answer includes "follow my computer", which isn't a theme.
   * "System" is the one piece of machinery named here: every other word for
   * it ("Auto", "Default") hides what it actually does.
   */
  THEME: {
    LABEL: "Appearance",
    LIGHT: "Light",
    DARK: "Dark",
    SYSTEM: "System",
    // Said once, in the one place the choice is made.
    SYSTEM_HINT: "Matches your computer",
  },
};

/** Display name for a role, whatever casing the API sent. */
export function roleTitle(role) {
  const key = (role || "").toString().trim().toLowerCase().replace(/-/g, "_");
  return DICTIONARY.ROLE_TITLE[key] || "";
}

/** Display name for an organisation's state. */
export function orgStatusLabel(status) {
  const key = (status || "").toString().trim().toLowerCase();
  return DICTIONARY.ORG_STATUS[key] || "N/A";
}

/**
 * The pill an organisation's state is drawn in. Purple-only palette, per the
 * house rule: violet = good, fuchsia = waiting on something, rose = broken.
 */
export const ORG_STATUS_TONE = {
  active: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  trial: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
  in_grace: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/25",
  suspended: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-night-800 dark:text-slate-400 dark:border-night-700",
};
