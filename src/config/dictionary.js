// ─────────────────────────────────────────────────────────────────────────────
// dictionary.js — every word this console says about a shared idea, in one
// place. Same rule as HR Clouds Web and the mobile app: a term with a single
// source lives here, so three screens can't call one thing three names.
//
// Add a word here BEFORE you type it on a screen.
// ─────────────────────────────────────────────────────────────────────────────

export const DICTIONARY = {
  /**
   * The product, as people read it.
   *
   * "Platform Console" is what this thing IS — it is the name in CLAUDE.md,
   * in the docs and in every conversation about it — but it is deliberately
   * not printed anywhere in the interface. Someone who has been handed this
   * URL knows what they opened; a badge repeating it on every screen spends
   * the most valuable space on the page telling them something they already
   * know. The name lives in the window title and nowhere else.
   */
  PRODUCT: {
    NAME: "HR Clouds",
    // What the console governs: every organisation, on every plan.
    PLANE: "Platform",
  },

  // ── There is deliberately NO role-code → label map here ──────────────────
  // There used to be one, keyed on invented codes (`platform_admin`,
  // `platform_support`). It had to go, for two reasons:
  //
  //   1. The server sends `role.name` already written for a human ("Super
  //      Admin"), so a second table here is a second opinion about one thing.
  //   2. From Phase 2 the platform can define CUSTOM roles at priority 71–99
  //      with keys no build has ever seen. Any lookup table is guaranteed to
  //      miss them, and a console that renders an empty role for a real
  //      operator looks broken to the one person who can't fix it.
  //
  // So: show `role.name` as sent, and gate on `tier` — never on `role.key`.
  // The bands and what they mean live in config/platformAccess.js.
  //
  // NOTE ON NAMING: inside a customer's organisation HR Clouds has a role
  // called `super-admin` — the most senior person in THAT organisation. This
  // console sits a plane above it. Nothing the console itself calls a person
  // is "super" anything, or the two are impossible to tell apart out loud.

  /**
   * Words about the person signed in and what they may do. The server decides
   * all of this (`GET /platform/me`); these are only how the console says it.
   */
  ACCESS: {
    // The page where you can read your own access back.
    HEADER: "Your access",
    SUBTITLE: "Who you are on this console, and what it lets you do.",
    // `role.name` as the server sent it. "Acting as", not "You are" — the
    // role is a hat somebody handed you and can take back, not an identity.
    ACTING_AS: "Acting as",
    TIER: "Access level",
    SIGNED_IN_AS: "Signed in as",
    LAST_SIGNED_IN: "Last signed in",
    NEVER_SIGNED_IN: "First time here",
    ALLOWS: "What this lets you do",
    // Said once, on the account screen: the console is watched.
    RECORDED: "Every action you take here is recorded against your name.",
    // Shown where a row is hidden because of the viewer's tier.
    ABOVE_YOUR_LEVEL: "That page is above your access level.",
    ASK_FOR_ACCESS: "Ask a colleague with full access if you need it.",
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

  /**
   * The Overview's DERIVED states — the five buckets its tiles and its "needs
   * attention" list sort organisations into. They mix the organisation's own
   * state with its subscription's, on purpose, because that card answers one
   * question ("what should I look at today?") and that is the honest answer to
   * it.
   *
   * They are NOT an organisation's real status. The server has exactly three
   * of those — active, inactive, suspended — and they live in
   * `config/platformMeta.js` beside the subscription states they are so easily
   * confused with. The organisations screens read that map, never this one.
   * This one goes the day `/platform/overview` is built on real figures.
   */
  ORG_STATUS: {
    active: "Active",
    trial: "On trial",
    in_grace: "Payment overdue",
    suspended: "Suspended",
    cancelled: "Cancelled",
  },

  /** Words about the people who run the platform. Phase 2. */
  STAFF: {
    HEADER: "Platform staff",
    SUBTITLE: "Everyone who can open this console, and what they can reach.",
    // "Access", not "member" or "user": what is granted and taken away is the
    // access, and the account underneath it carries on existing either way.
    GRANT: "Give someone access",
    GRANT_SUBTITLE: "An email or phone number. If they already use HR Clouds, they keep their password.",
    CHANGE_ROLE: "Change role",
    REVOKE: "Remove access",
    // Said on the revoke dialog. The distinction matters: an operator who
    // thinks this deletes an account will hesitate over the right button.
    REVOKE_MEANING: "They keep their HR Clouds account. What goes is the access to this console.",
    ROLE: "Role",
    ADDED: "Added",
    ADDED_BY: "Added by",
    // The bootstrap CLI left no actor behind, and that is not a data error.
    ADDED_BY_SETUP: "Set up at installation",
    LAST_SEEN: "Last seen",
    NEVER_SIGNED_IN: "Hasn’t signed in yet",
    SELF: "This is you",
    // The invitation link, which the server hands over exactly once.
    LINK_ONCE: "Copy this link now",
  },

  /** Words about the roles themselves. Phase 2. */
  ROLES: {
    HEADER: "Roles",
    SUBTITLE: "What each role is allowed to reach, and how many people hold it.",
    CREATE: "Create a role",
    CREATE_SUBTITLE: "For a job that sits between support and running the platform.",
    PRIORITY: "Priority",
    // Said where the number is entered. The band is the whole constraint.
    PRIORITY_BAND: "Between 71 and 99 — above support, below an operator.",
    HOLDERS: "People holding it",
    SYSTEM: "Built in",
    RETIRED: "Retired",
    // A retired role still names the role of whoever holds it.
    RETIRED_MEANING: "Can’t be handed out any more. People who already hold it keep it.",
    NOT_ASSIGNABLE: "Can’t be handed out from here",
  },

  /** Words about one customer's record. Phases 3 and 4. */
  ORG: {
    HEADER: "Organisations",
    SUBTITLE: "Every customer on HR Clouds, what they’re on, and who to call.",
    // Said on the DIRECTORY row, where the contact is actually known. The
    // detail read carries no contact panel, so that screen never says this.
    NO_CONTACT: "Nobody at this organisation can be reached",
    JOINED: "Joined",
    SUSPEND: "Suspend this organisation",
    SUSPEND_MEANING: "Everybody there is locked out of HR Clouds until it is switched back on.",
    REACTIVATE: "Switch back on",
    REACTIVATE_MEANING: "Everybody there can sign in again.",
    PROVISION: "Add an organisation",
    PROVISION_SUBTITLE: "For a signed deal that isn’t coming through sign-up.",
    GRANT_PLAN: "Put on a plan",
    GRANT_PLAN_MEANING: "Gives this plan without a payment. It shows as granted, not purchased.",
    GRANTED: "Granted, not paid for",
    CHANGE_SEATS: "Change the seat limit",
    INVITE_HR: "Invite an HR",
    INVITE_HR_SUBTITLE: "Sends a fresh link. Any earlier invitation stops working.",
    // The limits snapshot drifting from the plan's current limits.
    LIMITS_DRIFTED: "This customer’s limits were set when they subscribed and the plan has changed since.",
    PLAN_PERIOD_ENDS: "Paid up to",
    NO_PLAN: "Never had a plan",
  },

  /** Page and card headings, so two screens can't name the same thing twice. */
  HEADERS: {
    OVERVIEW: "Overview",
    ACCOUNT: "Your access",
    STAFF: "Platform staff",
    ROLES: "Roles",
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
    // A search that found nothing is NOT the same as a table with nothing in
    // it, and it must not suggest adding a record — somebody would create a
    // duplicate of the row their spelling missed.
    NO_MATCHES: "Nothing matches that.",
    NO_MATCHES_HINT: "Try a shorter search, or clear the filters.",
    STAFF: "Only you have access so far.",
    STAFF_HINT: "Give a colleague access and they will show here.",
    ROLES: "No roles are defined yet.",
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
