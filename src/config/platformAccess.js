// ─────────────────────────────────────────────────────────────────────────────
// platformAccess.js — who may see what, as data.
//
// The server answers `GET /platform/me` with a `tier`, and the tier is the
// WHOLE client-side contract. There is deliberately no capabilities array and
// no permissions list: the server is the only authority on what an actor may
// do, and every endpoint enforces its own tier. What lives here is only how
// the console decides which menu rows to draw.
//
// ─── Branch on `tier`, NEVER on `role.key` ──────────────────────────────────
// From Phase 2 the platform can define custom roles at priority 71–99 with
// keys nobody has seen before — `support-lead`, `ops-oncall`, anything. A
// console that switched on the key would fail to place them and would show a
// real operator an empty menu. `tier` always resolves, because the server
// computes it from the priority band. `role.name` is for display only.
// ─────────────────────────────────────────────────────────────────────────────

/** The three bands. Priority 70–79 → WORKER, 80–99 → ADMIN, 100 → SUPER_ADMIN. */
export const TIER = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  WORKER: "WORKER",
};

/**
 * Rank, for comparisons. An unknown tier scores 0 and therefore fails every
 * check — if the server ever sends a band this build has never heard of, the
 * console hides the action rather than guessing it is allowed. Fail closed,
 * the same way the backend guard does.
 */
const TIER_RANK = { [TIER.WORKER]: 1, [TIER.ADMIN]: 2, [TIER.SUPER_ADMIN]: 3 };

/** `canAccessTier(actor.tier, TIER.ADMIN)` — may this person see that? */
export function canAccessTier(actorTier, requiredTier) {
  if (!requiredTier) return true;
  return (TIER_RANK[actorTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

/**
 * What each band is called and what it actually means, in words someone who
 * has never read the RBAC table would use. The console says these out loud on
 * the account screen, because "WORKER" on its own tells a new support hire
 * nothing about what they are about to be able to do.
 *
 * Note the names: nothing here is "super" anything. Inside a customer's own
 * workspace HR Clouds already has `super-admin`, the most senior person in
 * THAT organisation, and the two must stay impossible to confuse in a
 * sentence. `role.name` from the server may well say "Super Admin"; that is
 * the server's word for the row, and it is shown as given, not as a title we
 * invent for the person.
 */
export const TIER_META = {
  [TIER.SUPER_ADMIN]: {
    label: "Full access",
    summary: "Everything in this console, including what it costs a customer.",
    allows: [
      "Everything an operator can do, on every organisation",
      "Add, promote and remove platform staff",
      "Grant a plan or extra seats without a payment",
      "Create an organisation and invite its first HR",
    ],
  },
  [TIER.ADMIN]: {
    label: "Operator",
    summary: "Run the customer base day to day, without touching what they pay.",
    allows: [
      "Search every organisation and open its record",
      "Suspend an organisation, or switch it back on",
      "See the staff roster and who holds which role",
    ],
  },
  [TIER.WORKER]: {
    label: "Support",
    summary: "Look things up to answer a customer. Nothing here changes a record.",
    allows: ["Read an organisation’s record to answer a question", "Work the support queue"],
  },
};

/**
 * The error codes the platform plane answers with, and what each one MEANS to
 * a person. Three different 403s that each need a different response from the
 * console — getting these the wrong way round is how you sign out somebody
 * who merely opened a page above their tier.
 */
export const PLATFORM_ERROR = {
  /** Not platform staff at all: a tenant token, or a null-org role under 70. */
  ACCESS_REQUIRED: "PLATFORM_ACCESS_REQUIRED",
  /** Was staff; the database no longer says so. Revoked mid-session. */
  ACCESS_REVOKED: "PLATFORM_ACCESS_REVOKED",
  /** Is staff, but below this route's tier. Keep the session; hide the action. */
  FORBIDDEN: "FORBIDDEN",
  /** The guard could not reach its database and failed closed. NOT a logout. */
  AUTH_INTERNAL: "AUTH_INTERNAL_ERROR",
  /** Redis unreachable during authenticate. NOT a logout. */
  AUTH_DEPENDENCY: "AUTH_DEPENDENCY_FAILURE",
};

/**
 * What each of those means on screen. One sentence, the consequence rather
 * than the mechanism — nobody signing in needs the words "role priority".
 */
export const PLATFORM_ERROR_COPY = {
  [PLATFORM_ERROR.ACCESS_REQUIRED]:
    "This account doesn’t have access here. If you administer an organisation on HR Clouds, sign in there instead.",
  [PLATFORM_ERROR.ACCESS_REVOKED]: "Your access has been removed.",
  [PLATFORM_ERROR.AUTH_INTERNAL]: "We couldn’t check your access just now. This is us, not you.",
  [PLATFORM_ERROR.AUTH_DEPENDENCY]: "We couldn’t check your access just now. This is us, not you.",
};
