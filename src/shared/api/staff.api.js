// ─────────────────────────────────────────────────────────────────────────────
// staff.api.js — Phase 2. Who works on the platform, and what they may do.
//
// Endpoints #282–#288. Unlike the Overview, these are REAL: they exist on the
// backend behind `/api/v1/platform`. The sample branch is here so the console
// is designable without a server running, not because the contract is a guess.
//
// Two rules this module exists to enforce once, rather than in six screens:
//
//   1. REASONS GO IN THE BODY, including on the DELETE. A revoke is
//      `DELETE /platform/staff/:id` with `{ reason }` as JSON — a request body
//      on a DELETE is unusual enough that fetch will happily send it with no
//      Content-Type and the server will reject it as malformed. `request()`
//      sets the header whenever there is a body, so passing one is enough.
//
//   2. A ROLE PICKER FILTERS ON `assignable_via_api`, NOT `is_assignable`.
//      The seeded `admin` role has `is_assignable: false` and yet is the most
//      common thing anybody invites someone as. The two fields mean different
//      things and using the obvious-looking one hides the role an operator
//      actually wants. `assignableRoles()` below is the only way to get a list
//      for a form, so nobody has to remember that twice.
// ─────────────────────────────────────────────────────────────────────────────
import { request, qs } from "./client";
import { ENV } from "../../config/env";
import { SAMPLE_PLATFORM_ROLES, SAMPLE_PLATFORM_STAFF } from "../../data/samplePlatform";

const settle = (value, ms = 420) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

// ─── Shapes ──────────────────────────────────────────────────────────────────

/**
 * One staff row, camelCased, with every nullable field kept nullable.
 *
 * `name` falls back to the identifier rather than to an empty string: the
 * person who bootstrapped this platform from the CLI has no profile row at
 * all, and they are the first row in the table. A blank cell there reads as a
 * broken page.
 */
function normaliseStaff(row) {
  if (!row) return null;
  const name = row.display_name || [row.first_name, row.last_name].filter(Boolean).join(" ");
  return {
    userId: row.user_id,
    identifier: row.email ?? row.identifier ?? null,
    identifierType: row.identifier_type || null,
    name: name || null,
    // Kept apart from `name` so a screen can say "no profile name on file"
    // instead of silently presenting an email address as somebody's name.
    hasProfileName: Boolean(name),
    // Display only. NEVER branch on `role.key` — from this phase on, custom
    // roles carry keys no build has seen.
    role: row.role ? { key: row.role.key, name: row.role.name, priority: row.role.priority, isActive: row.role.is_active !== false } : null,
    tier: row.tier || null,
    // The two independent flags. Both are rendered; see `staffState`.
    isActive: row.is_active !== false,
    status: row.status || null,
    invitationPending: Boolean(row.invitation_pending),
    assignedAt: row.assigned_at ?? null,
    // Null for anyone the bootstrap CLI created — there was no actor.
    assignedBy: row.assigned_by ?? null,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function normaliseRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    priority: row.priority,
    tier: row.tier || null,
    isSystemRole: Boolean(row.is_system_role),
    // Both, because they are not the same question. See the header note.
    isAssignable: Boolean(row.is_assignable),
    assignableViaApi: Boolean(row.assigned_via_api ?? row.assignable_via_api),
    isActive: row.is_active !== false,
    assignedCount: row.assigned_count ?? null,
  };
}

// ─── #282 Reads ──────────────────────────────────────────────────────────────

/**
 * `GET /platform/staff` — the roster.
 *
 * Filtered and paged on the server. `includeInactive` is off by default and
 * is a deliberate choice rather than an oversight: the roster answers "who
 * can get in right now", and people whose access was revoked years ago are a
 * different question that the operator has to ask for.
 */
export async function listStaff({ query, tier, includeInactive = false, page = 1, limit = 25, signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/staff${qs({ search: query, tier, include_inactive: includeInactive || undefined, page, limit })}`, { signal });
    const payload = res?.data ?? res;
    const rows = payload?.staff || payload?.rows || payload?.items || [];
    return {
      rows: rows.map(normaliseStaff),
      page: payload?.pagination?.page ?? page,
      total: payload?.pagination?.total ?? rows.length,
      totalPages: payload?.pagination?.total_pages ?? 1,
    };
  }

  const needle = (query || "").trim().toLowerCase();
  const rows = SAMPLE_PLATFORM_STAFF.map(normaliseStaff).filter((row) => {
    if (!includeInactive && !row.isActive) return false;
    if (tier && row.tier !== tier) return false;
    if (needle && !`${row.name || ""} ${row.identifier || ""} ${row.role?.name || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  return settle({ rows, page: 1, total: rows.length, totalPages: 1 });
}

/** `GET /platform/roles` (#286) — the catalog. Flat, unpaginated, small. */
export async function listRoles({ includeInactive = true, signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/roles${qs({ include_inactive: includeInactive || undefined })}`, { signal });
    const payload = res?.data ?? res;
    const rows = payload?.roles || payload?.rows || (Array.isArray(payload) ? payload : []);
    return rows.map(normaliseRole);
  }
  return settle(SAMPLE_PLATFORM_ROLES.map(normaliseRole).filter((r) => includeInactive || r.isActive));
}

/**
 * The roles a form may offer. The ONE place that decision is made.
 *
 * A retired role (`is_active: false`) still appears in the catalog, because
 * people still hold it and the roster has to be able to name their role. It
 * must not appear in a picker, or an operator will hand out a role that is
 * being wound down.
 */
export const assignableRoles = (roles = []) => roles.filter((r) => r.assignableViaApi && r.isActive);

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * `POST /platform/staff` (#283) — give somebody platform access.
 *
 * One endpoint, two outcomes, and the UI has to tell them apart:
 *   • the identifier belongs to an existing HR Clouds user → access granted,
 *     no invitation, they sign in with the password they already have;
 *   • nobody has that identifier → a user is created and invited, and the
 *     response carries an `activation_link`.
 *
 * `activation_link` is returned ONCE and never again. Whatever the console
 * does with it, it must do before this promise's value is discarded — which
 * is why the invite dialog shows the link with a copy button instead of a
 * toast that disappears.
 *
 * `email_delivered: false` is NOT an error. The access exists either way; the
 * email just didn't go out, and the operator can hand over the link
 * themselves. Treating it as a failure would have an operator re-invite
 * somebody who already has access.
 */
export async function grantStaffAccess({ identifier, roleKey, firstName, lastName, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request("/platform/staff", {
      method: "POST",
      body: {
        identifier,
        role_key: roleKey,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        reason,
      },
    });
    return normaliseGrant(res?.data ?? res);
  }

  const known = SAMPLE_PLATFORM_STAFF.some((s) => s.email === identifier);
  return settle(
    normaliseGrant(
      known
        ? { user_id: "sample-existing", created_user: false, invitation_sent: false, email_delivered: null, activation_link: null }
        : {
            user_id: "sample-new",
            created_user: true,
            invitation_sent: true,
            // The deliberately awkward case: access granted, email bounced.
            email_delivered: false,
            activation_link: `${window.location.origin}/platform/accept-invite?token=sample-invitation-token`,
          },
    ),
    700,
  );
}

function normaliseGrant(data) {
  if (!data) return null;
  return {
    userId: data.user_id ?? null,
    createdUser: Boolean(data.created_user),
    invitationSent: Boolean(data.invitation_sent),
    // Tri-state on purpose: true, false, or "no email was involved".
    emailDelivered: data.email_delivered ?? null,
    activationLink: data.activation_link ?? null,
  };
}

/**
 * `PATCH /platform/staff/:userId/role` (#284) — move somebody to another role.
 *
 * `changed: false` is a SUCCESS, not a failure: the person already held that
 * role, so there was nothing to do. The console says "already on that role"
 * rather than "saved", because claiming to have saved a change that didn't
 * happen is how an operator stops trusting the screen.
 */
export async function changeStaffRole({ userId, roleKey, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/staff/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: { role_key: roleKey, reason },
    });
    const data = res?.data ?? res;
    return { changed: data?.changed !== false, tier: data?.tier ?? null };
  }
  return settle({ changed: true, tier: null }, 600);
}

/**
 * `DELETE /platform/staff/:userId` (#285) — take platform access away.
 *
 * The reason travels in the BODY of a DELETE. That is unusual, and it is the
 * single most likely thing to be dropped by a well-meaning refactor that
 * "tidies up" the call into a bare delete — at which point every revoke in
 * the audit trail loses its justification. The body is required; the server
 * rejects the call without it.
 *
 * Revoking is not deleting. The user keeps their HR Clouds account; what goes
 * is the platform grant.
 */
export async function revokeStaffAccess({ userId, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/staff/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      body: { reason },
    });
    const data = res?.data ?? res;
    return { changed: data?.changed !== false };
  }
  return settle({ changed: true }, 600);
}

/**
 * `POST /platform/roles` (#287) — define a custom role.
 *
 * Priority must land in 71–99, which is the band BETWEEN worker and the
 * seeded admin. The server enforces it; the form says so up front, because
 * "PRIORITY_OUT_OF_RANGE" after a submit teaches nobody anything.
 */
export const CUSTOM_ROLE_PRIORITY = { MIN: 71, MAX: 99 };

export async function createRole({ key, name, description, priority, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request("/platform/roles", {
      method: "POST",
      body: { key, name, description: description || undefined, priority: Number(priority), reason },
    });
    return normaliseRole(res?.data?.role ?? res?.data ?? res);
  }
  return settle(
    normaliseRole({
      id: `rl_${key}`,
      key,
      name,
      description,
      priority: Number(priority),
      tier: Number(priority) >= 80 ? "ADMIN" : "WORKER",
      is_system_role: false,
      is_assignable: true,
      assignable_via_api: true,
      is_active: true,
      assigned_count: 0,
    }),
    700,
  );
}

// ─── #288 The public one ─────────────────────────────────────────────────────

/**
 * `POST /platform/invitations/accept` — set a password from an invite link.
 *
 * The only platform endpoint that takes no token, and the only screen in this
 * app that renders outside the console shell.
 *
 * Two things about it shape the UI:
 *   • Every failure is ONE opaque `INVALID_INVITATION`. Expired, already
 *     used, wrong token, no such user — all the same answer, deliberately, so
 *     the endpoint can't be used to find out whether a token or an account
 *     exists. The screen therefore cannot say WHY, and must not guess: it
 *     says the link doesn't work and points at the person who sent it.
 *   • It issues NO SESSION. Accepting an invitation is not signing in, so the
 *     screen ends by sending them to the sign-in page rather than pretending
 *     they are already through the door.
 */
export async function acceptInvitation({ token, password, firstName, lastName }) {
  if (!ENV.USE_SAMPLE_DATA) {
    await request("/platform/invitations/accept", {
      method: "POST",
      body: { token, password, first_name: firstName || undefined, last_name: lastName || undefined },
    });
    return { accepted: true };
  }
  if (token === "expired") {
    const err = new Error("This link doesn’t work any more.");
    err.code = "INVALID_INVITATION";
    err.status = 400;
    throw err;
  }
  return settle({ accepted: true }, 800);
}

export const staffAPI = {
  listStaff,
  listRoles,
  assignableRoles,
  grantStaffAccess,
  changeStaffRole,
  revokeStaffAccess,
  createRole,
  acceptInvitation,
};
