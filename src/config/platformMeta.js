// ─────────────────────────────────────────────────────────────────────────────
// platformMeta.js — the state machines, enum maps and error copy for the
// endpoints that exist on the backend today (#282–#295).
//
// This is the "domain knowledge lives in config, never inline in JSX" rule.
// A screen asks this file what a word means and what colour it wears; it never
// decides either itself, or two screens end up disagreeing about what
// `pending_verification` is called.
//
// `platformAccess.js` is the tier model and the auth errors. This is everything
// downstream of being let in.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Purple-only tones ───────────────────────────────────────────────────────
// violet = good · fuchsia = waiting on somebody · indigo = informational ·
// rose = broken or cut off · slate = retired, over, not applicable.
const TONE = {
  good: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  waiting: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/25",
  info: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
  bad: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
  off: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-night-800 dark:text-slate-400 dark:border-night-700",
};

export const PILL_TONE = TONE;

// ─── An organisation's state ─────────────────────────────────────────────────
/**
 * The ONLY three states an organisation has: `active`, `inactive`, `suspended`.
 *
 * There is no "trial" and no "grace" organisation status, however much it
 * would be convenient — those belong to the subscription, and merging the two
 * vocabularies is how a console ends up telling an operator that a paying
 * customer is suspended because their card bounced once.
 *
 * `inactive` is the one that needs the careful wording. It does not mean
 * dormant or switched off: the organisation row exists because somebody
 * started signing up and never finished, so there is no profile, no
 * subscription and nobody to email. "Never finished signing up" is the fact.
 */
export const ORG_STATE = {
  active: { label: "Active", tone: TONE.good, meaning: "Open for business." },
  inactive: { label: "Never finished signing up", tone: TONE.off, meaning: "Registration was started and abandoned. Nothing was ever set up." },
  suspended: { label: "Suspended", tone: TONE.bad, meaning: "Nobody at this organisation can sign in." },
};

export const orgState = (status) => ORG_STATE[status] || { label: "N/A", tone: TONE.off, meaning: null };

// ─── A subscription's state ──────────────────────────────────────────────────
/**
 * Said as the consequence, not the mechanism — the house rule. "Payment
 * overdue", not "in grace state"; an operator needs to know whether to ring
 * the customer, not which column the billing job wrote.
 */
export const SUBSCRIPTION_STATE = {
  active: { label: "Paid up", tone: TONE.good },
  trialing: { label: "On trial", tone: TONE.info },
  past_due: { label: "Payment overdue", tone: TONE.waiting },
  grace: { label: "Payment overdue", tone: TONE.waiting },
  expired: { label: "Lapsed", tone: TONE.bad },
  cancelled: { label: "Cancelled", tone: TONE.off },
  canceled: { label: "Cancelled", tone: TONE.off },
};

export const subscriptionState = (status) =>
  SUBSCRIPTION_STATE[status] || { label: "N/A", tone: TONE.off };

// ─── A staff member's state ──────────────────────────────────────────────────
/**
 * Two independent flags, and BOTH have to be drawn.
 *
 * `is_active` is the platform grant; `status` is the user account underneath
 * it. The server refuses a sign-in on either one, so a console that shows only
 * the grant will insist a person has access while they sit locked out of the
 * login screen — and the operator looking at that screen is the person meant
 * to fix it.
 *
 * `staffState` collapses the pair into the one sentence that is true, in the
 * order that matters: revoked beats suspended beats never-signed-in.
 */
export const ACCOUNT_STATE = {
  active: { label: "Active", tone: TONE.good },
  pending_verification: { label: "Invitation not accepted", tone: TONE.waiting },
  suspended: { label: "Account suspended", tone: TONE.bad },
  deleted: { label: "Account deleted", tone: TONE.off },
};

export function staffState(member) {
  if (!member) return { label: "N/A", tone: TONE.off, why: null };
  if (!member.isActive) {
    return { label: "Access removed", tone: TONE.off, why: "The platform grant was revoked. Signing in to the console is refused." };
  }
  if (member.status === "suspended") {
    return { label: "Account suspended", tone: TONE.bad, why: "The grant is intact, but the user account itself is suspended, so sign-in is refused." };
  }
  if (member.invitationPending) {
    return { label: "Invitation not accepted", tone: TONE.waiting, why: "The invitation has been sent. The link stops working once it is used." };
  }
  if (member.status && member.status !== "active") {
    return { label: ACCOUNT_STATE[member.status]?.label || "N/A", tone: ACCOUNT_STATE[member.status]?.tone || TONE.off, why: null };
  }
  return { label: "Active", tone: TONE.good, why: null };
}

// ─── Reasons ─────────────────────────────────────────────────────────────────
/**
 * Every write that changes somebody's access or somebody's bill takes a
 * reason, and the server validates its length. The bounds are here so the
 * dialog can enforce them before the round trip rather than bouncing an
 * operator who typed "fix" and waited two seconds to find out.
 */
export const REASON = { MIN: 5, MAX: 500 };

export function reasonError(text) {
  const value = (text || "").trim();
  if (value.length === 0) return "Say why. It goes in the audit trail under your name.";
  if (value.length < REASON.MIN) return `A few more words — at least ${REASON.MIN} characters.`;
  if (value.length > REASON.MAX) return `That is ${value.length} characters; the limit is ${REASON.MAX}.`;
  return null;
}

// ─── Error codes from the platform writes ────────────────────────────────────
/**
 * `retry: true` means the console may quietly try the same call ONCE more. It
 * is set only on the two codes that mean "another request got there a
 * half-second before you", where a second attempt is the right answer and
 * showing the operator a race condition is not.
 *
 * `reload: true` means the console's copy of the record is out of date and
 * must be re-read before anything else is attempted.
 *
 * STALE_SUBSCRIPTION is deliberately `reload`, NEVER `retry`. It is the guard
 * on `expected_subscription_id`: it fires because the subscription changed
 * under you, so repeating the write is repeating it against the wrong record —
 * which is how you grant an enterprise plan to a customer who cancelled while
 * the dialog was open.
 */
export const WRITE_ERROR = {
  STAFF_CHANGE_IN_PROGRESS: { retry: true, copy: "Another change to this person was already running. Trying once more." },
  ORG_STATUS_CHANGE_CONFLICT: { retry: true, copy: "Someone else was changing this organisation at the same time. Trying once more." },
  STALE_SUBSCRIPTION: { reload: true, copy: "This organisation’s plan changed while you had it open. Reload before you change it again." },
  CANNOT_MODIFY_SELF: { copy: "You can’t change your own access. Ask a colleague with full access." },
  CANNOT_MODIFY_LAST_SUPER_ADMIN: { copy: "This is the last person with full access. Promote someone else first." },
  ROLE_NOT_ASSIGNABLE: { copy: "That role can’t be handed out through the console." },
  ROLE_KEY_TAKEN: { copy: "A role with that key already exists." },
  PRIORITY_OUT_OF_RANGE: { copy: "A custom role has to sit between 71 and 99." },
  USER_ALREADY_STAFF: { copy: "This person already has platform access." },
  USER_IN_ORGANIZATION: { copy: "This account belongs to a customer’s organisation, so it can’t also be platform staff." },
  SEAT_LIMIT_BELOW_USAGE: { copy: "That is fewer seats than the organisation is already using." },
  ORGANIZATION_KEY_TAKEN: { copy: "That key is taken. Pick another." },
  PLAN_NOT_FOUND: { copy: "That plan no longer exists." },
  INVALID_INVITATION: { copy: "This link doesn’t work any more." },
  VALIDATION_ERROR: { copy: "Check the form — something doesn’t look right." },
};

export const writeErrorCopy = (code, fallback) => WRITE_ERROR[code]?.copy || fallback;
export const shouldRetry = (code) => Boolean(WRITE_ERROR[code]?.retry);
export const shouldReload = (code) => Boolean(WRITE_ERROR[code]?.reload);

// ─── Seats ───────────────────────────────────────────────────────────────────
/**
 * Seats, said safely.
 *
 * Three different facts hide in this one line and only one of them is a
 * fraction:
 *   used = null  → the headcount FAILED TO LOAD. Never "0 of 150": that
 *                  sentence has talked an operator into cutting seats a
 *                  customer was using.
 *   limit = null → no ceiling. Not zero, not unknown — unlimited.
 *   both known   → the fraction.
 */
export function seatSummary(used, limit) {
  if (used === null || used === undefined) {
    return { text: "N/A", note: "Headcount didn’t load", percent: null, unknown: true };
  }
  if (limit === null || limit === undefined) {
    return { text: `${used.toLocaleString("en-IN")}`, note: "No seat limit", percent: null, unlimited: true };
  }
  const percent = limit > 0 ? Math.round((used / limit) * 100) : null;
  return { text: `${used.toLocaleString("en-IN")} of ${limit.toLocaleString("en-IN")}`, note: null, percent };
}

/**
 * How full an organisation is, as both a bar colour and a tile tone — from
 * ONE threshold table, so a row and a tile can never disagree about whether a
 * customer is close to their ceiling.
 *
 * Over 90% is worth a glance (fuchsia: somebody will be calling soon); at the
 * ceiling it is rose, because they can no longer add an employee and that is
 * a broken product, not a warning.
 *
 * An unknown percentage is slate, never green. "We don't know how full they
 * are" must not look like "they have plenty of room".
 */
export function seatPressure(percent) {
  if (percent === null || percent === undefined) return { bar: "bg-slate-300 dark:bg-night-600", tone: "slate", pill: TONE.off };
  if (percent >= 100) return { bar: "bg-rose-500", tone: "rose", pill: TONE.bad };
  if (percent >= 90) return { bar: "bg-fuchsia-500", tone: "fuchsia", pill: TONE.waiting };
  return { bar: "bg-violet-500", tone: "violet", pill: TONE.good };
}

// ─── The detail card's optional panels ───────────────────────────────────────
/**
 * `GET /platform/organizations/:id` fetches everything but the organisation
 * row best-effort, and names whatever failed in `unavailable`. Those panels
 * render as "temporarily unavailable" with a retry — NOT as empty, and not as
 * a reason to fail the whole screen. An operator with a customer on the phone
 * needs the nine panels that did load.
 *
 * A `null` panel NOT listed in `unavailable` is a different fact: there is
 * genuinely nothing there. An organisation that never finished signing up has
 * no onboarding progress to report, and "Not applicable" is the honest word
 * for that, not "couldn't load".
 */
export const PANEL = {
  profile: { title: "Company details", absent: "No company details on file" },
  subscription: { title: "Plan", absent: "No subscription has ever been created" },
  usage: { title: "Seats", absent: "No usage recorded" },
  setup: { title: "Onboarding", absent: "Not applicable" },
  limits_audit: { title: "Plan limits", absent: "Nothing to compare" },
  recent_subscription_events: { title: "Billing history", absent: "No billing events yet" },
  recent_audit_logs: { title: "What staff have done here", absent: "No platform staff have touched this organisation" },
};

export const PANEL_UNAVAILABLE = "This part didn’t load. The rest of the page is complete.";
