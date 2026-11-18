# Platform Staff & Roles API — Phase 2

**Date:** 2026-11-17 · **Module:** `src/modules/platform/` · **Endpoints:** #282–#288
**Breaking changes: none.** No existing endpoint changes its request or response shape — #281 `GET /platform/me` is byte-identical. Nothing in the tenant plane changes.

Seven new endpoints turn the platform plane from *one bootstrapped super-admin* into *a team the owner can run from the panel*: a staff directory, invitation and activation, role change, revocation, and a custom-role catalog.

---

## 1. The two rules that matter most to the client

1. **Branch on `tier`, never on `role.key`.** This is the phase that makes custom platform role keys real. A role created at priority 85 confers `ADMIN`-tier authority and will have a key nobody has seen before (`support-lead`, `ops-oncall`, …), so a key-based console cannot place it. `#281`, `#282`, `#286` and `#287` all return `tier` (`SUPER_ADMIN` | `ADMIN` | `WORKER`) computed from one server-side helper.
2. **Drive the role picker from `assignable_via_api`, not from `is_assignable`.** `is_assignable` is informational metadata and is **`false` on the seeded `admin` role**, which is the primary invite target — filtering on it would hide the most common choice. `assignable_via_api` is `is_active && 70 ≤ priority ≤ 99`, the exact window the write endpoints enforce.

---

## 2. Endpoints

### #282 `GET /api/v1/platform/admins` — staff directory
*Super-admin tier only.* Query `page` (≥ 1, default 1), `limit` (1–100, default 25). No filters exist.

```json
{
  "success": true,
  "message": "Platform staff fetched successfully",
  "data": {
    "pagination": { "total": 4, "page": 1, "limit": 25, "total_pages": 1 },
    "rows": [{
      "user_id": "8a93ef20-…",
      "email": "sarah.ops@hrclouds.in",
      "identifier_type": "email",
      "first_name": "Sarah", "last_name": "Jenkins", "display_name": "Sarah Jenkins",
      "role": { "key": "admin", "name": "Admin", "priority": 80, "is_active": true },
      "tier": "ADMIN",
      "is_active": true,
      "status": "active",
      "invitation_pending": false,
      "assigned_at": "2026-09-01T10:00:00.000Z",
      "assigned_by": "0f1d4a2e-…",
      "last_login_at": "2026-11-16T14:22:10.000Z",
      "created_at": "2026-09-01T10:00:00.000Z"
    }]
  }
}
```

* **Render both `is_active` and `status`.** They are independent: `is_active` is the membership row's flag, `status` is the account's (`pending_verification` | `active` | `inactive` | `suspended` | `blocked`). The server refuses a staff member on **either**, so showing only one leaves an operator unable to explain why somebody is locked out.
* `first_name`/`last_name`/`display_name` are legitimately `null` — the CLI-bootstrapped super-admin has no profile row. Fall back to `email`.
* `assigned_by` is a raw user id and is `null` for that same CLI grant. Render "—".
* This is a **summary** projection. There is no staff-detail endpoint; nothing here exposes credentials, auth provider, lock state or any organization field.

### #283 `POST /api/v1/platform/admins/invite` — invite or grant
*Super-admin tier only.* No `reason` field.

```json
{ "email": "alex.support@hrclouds.in", "first_name": "Alex", "last_name": "Rivera", "role_key": "worker" }
```

Three success shapes, distinguished by `outcome`:

| `outcome` | HTTP | What happened | `activation_link` |
|---|---|---|---|
| `invited` | **201** | A new account (or a never-activated one) was created/granted and must set a password | present, **shown once** |
| `granted` | **201** | An existing active account was given platform access; no new credential needed | `null` |
| `reinvited` | **200** | A pending invitee's link was **rotated**; the previous link is dead immediately | present, **shown once** |

Response also carries `user_id`, `email`, `role`, `tier`, `previous_role`, `activation_required`, `activation_expires_at` and `email_delivered`.

* **Show `activation_link` once, with a copy button, and say it will not be shown again.** The server stores only its SHA-256 and never logs it. Re-sending it means calling #283 again, which rotates it.
* **`email_delivered: false` is not an error.** The staff member exists; the email did not go out. Tell the operator to copy the link and send it themselves.
* `activation_link: null` with `activation_required: true` means the token store was unreachable after the (committed) grant — prompt the operator to re-invite.
* **`outcome: "granted"` invalidates the person's current session.** They must sign in again before the new access appears.

Refusals and the correct client response:

| Code | HTTP | What to tell the operator |
|---|---|---|
| `USER_HAS_TENANT_MEMBERSHIP` | 409 | This address belongs to an organization. Platform staff must be dedicated identities — use a different address. **No retry.** |
| `USER_NOT_ELIGIBLE` | 409 | The account is inactive, suspended or blocked. **No retry** (no API can re-enable it). |
| `ALREADY_PLATFORM_STAFF` | 409 | They are already staff — offer #284 to change their role instead. |
| `INVITE_IN_PROGRESS` | 409 | A concurrent invite won. Retry **once**; it will report the real state. |
| `INVALID_PLATFORM_ROLE` | 400 | Refresh #286 and re-render the picker. `super-admin` can never be assigned. |

### #284 `PATCH /api/v1/platform/admins/:userId/role` — change role
*Super-admin tier only.* **`reason` is required**, 5–500 characters — prompt for it in the confirmation dialog.

```json
{ "role_key": "admin", "reason": "Promoted to run the support desk (OPS-214)" }
```

Returns `changed`, `previous_role`, `role`, `tier`, `sessions_revoked`. Requesting the role they already hold returns `200` with **`changed: false`** and writes nothing — safe to retry. The member must sign in again afterwards.

### #285 `DELETE /api/v1/platform/admins/:userId` — revoke access
*Super-admin tier only.* **`reason` is required (5–500 chars) and goes in the request BODY**, not the query string.

```json
{ "reason": "Left the company 2026-11-30 (OPS-301)" }
```

Returns `revoked_role`, `sessions_revoked`, `pending_invitation_cleared`.

* **Irreversible from the console's point of view.** Re-inviting the person later creates a **new** grant with fresh `assigned_at`/`assigned_by`; it does not restore the old one. Say so in the confirmation dialog.
* The account itself survives. The person can still sign in — they simply have no platform access, and the panel must sign them out when it sees `PLATFORM_ACCESS_REVOKED`.
* A **retried** DELETE answers `404 PLATFORM_STAFF_NOT_FOUND`. Treat that as "already done" and re-read #282.

### #286 `GET /api/v1/platform/roles` — role catalog
*Admin tier and above*, so an admin-tier operator can populate a picker. A **flat, unpaginated** `{ "roles": [...] }`.

```json
{ "id": "…", "key": "support-lead", "name": "Support Lead", "description": "…",
  "priority": 75, "tier": "WORKER", "is_system_role": false,
  "is_assignable": true, "is_active": true, "assigned_count": 3, "assignable_via_api": true }
```

Inactive roles are included, flagged `is_active: false` — grey them out rather than hiding them, because a retired role may still have holders who appear in #282.

### #287 `POST /api/v1/platform/roles` — create a custom role
*Super-admin tier only.*

```json
{ "key": "support-lead", "name": "Support Lead", "description": "Runs the support desk", "priority": 75 }
```

* `key`: 3–50 chars, slug `^[a-z][a-z0-9-]*$`, lower-cased server-side.
* `priority`: integer **71–99**. 70 (`worker`) and 100 (`super-admin`) are both rejected.
* `is_system_role`, `is_assignable` and `is_active` are set by the server; sending them has no effect.
* `201` echoes the row plus the resolved `tier`. **Show that tier at creation time** — a role's priority *is* its authority (there is no permission matrix), so 85 silently grants ADMIN-tier access to everything that tier reaches.
* Duplicate key → `409 ROLE_KEY_TAKEN`. There is **no** edit and **no** delete endpoint.

### #288 `POST /api/v1/platform/auth/accept-invite` — activation (**public**)
No `Authorization` header. Rate-limited to **10 attempts per IP per hour**; honour `Retry-After` on `429`.

```json
{ "token": "<64 hex chars>", "password": "<min 8, mixed>" }
```

→ `200 { "success": true, "message": "Your platform account is active. Please sign in.", "data": { "email": "alex.support@hrclouds.in" } }`

* **Activation page route:** `/platform/accept-invite?token=…`. The path is server-configurable (`urls.platformInviteAcceptPath` in `configs/default.json`) and is what the emailed link uses, so keep the client route matching it.
* **Password rule, mirrored from the server:** at least 8 characters with a lower-case letter, an upper-case letter, a digit and a symbol.
* **No session is issued.** There is no auto-login: on success, send the user to the normal login page (`POST /api/v1/auth/login`), pre-filled with the returned `email`. Login already issues the correct platform token.
* **Every failure returns the same `400 INVALID_INVITATION`** — unknown, expired, rotated, already used, revoked meanwhile, role retired meanwhile. This is deliberate: the endpoint is unauthenticated, and a differentiated error would let anyone enumerate accounts. Render **one** message: *"This invitation is no longer valid — ask your administrator to re-send it."*

---

## 3. New error codes

| Code | HTTP | Endpoint | Client response |
|---|---|---|---|
| `INVALID_PLATFORM_ROLE` | 400 | #283, #284 | Refresh #286, re-render the picker |
| `INVALID_INVITATION` | 400 | #288 | One generic message; offer to contact the administrator |
| `PLATFORM_STAFF_NOT_FOUND` | 404 | #284, #285 | Re-read #282 — the grant is gone |
| `USER_HAS_TENANT_MEMBERSHIP` | 409 | #283 | Explain; use a different address. No retry |
| `USER_NOT_ELIGIBLE` | 409 | #283 | Explain the account state. No retry |
| `ALREADY_PLATFORM_STAFF` | 409 | #283 | Offer #284 instead |
| `INVITE_IN_PROGRESS` | 409 | #283 | Retry once |
| `LAST_SUPER_ADMIN` | 409 | #284, #285 | Explain, and offer to promote someone first |
| `CANNOT_REVOKE_SELF` | 409 | #285 | Ask a colleague |
| `STAFF_CHANGE_IN_PROGRESS` | 409 | #284, #285 | **Retry once automatically** |
| `ROLE_KEY_TAKEN` | 409 | #287 | Ask for a different key |

Reused unchanged: `VALIDATION_ERROR` (400), `RATE_LIMITED` (429, with `Retry-After`), `NOT_AUTHENTICATED` (401), and the Phase 1 guard's `PLATFORM_ACCESS_REQUIRED` / `PLATFORM_ACCESS_REVOKED` / `FORBIDDEN` (403).

---

## 4. Still applies from Phase 1

* **Do not call `/api/v1/inbox/*` or `/api/v1/notifications/*` from the platform console.** Those routers still list `admin`/`super-admin` in their `authorize()` lists with no feature gate, and a null-org token produces `400 MISSING_ORG_CONTEXT`, an empty feed or a `500` on device registration. This matters *more* now: Phase 2 mints `admin`-role tokens, where Phase 1 only ever created `super-admin`. A fix is tracked separately.
* **Ignore `onboarding_step` in a platform token** — it drives tenant onboarding and is meaningless for staff.
* The three 403 codes still mean different things: `PLATFORM_ACCESS_REQUIRED` → do not show the panel; `PLATFORM_ACCESS_REVOKED` → sign out; `FORBIDDEN` → keep the session, hide the action.

## 5. No changes required to any existing frontend call

No request or response shape changed anywhere in the API. `#281` is untouched.

---

## 6. Post-review hardening (same day, before first release)

A production review of the Phase 2 code found four defects. All four are fixed in this same
changeset, so the contracts above are what ships — nothing documented earlier has moved. The two
that are visible from a client are called out here because they change what you get back for a
*malformed* request, not for a correct one.

| # | Endpoint(s) | Was | Now |
|---|---|---|---|
| 1 | #283, #284, #285, #287, #288 | A request with no JSON body — or any `Content-Type` other than `application/json` — returned **500 `INTERNAL_ERROR`** | **400 `VALIDATION_ERROR`** naming the missing field |
| 2 | #284, #285 | `:userId` was accepted in upper case and used verbatim | Normalised to lower case before any comparison |

**1. Always send `Content-Type: application/json`.** Express 5 leaves the parsed body undefined
unless it actually parsed JSON, so a bodyless `DELETE /admins/:userId` reached the service as
`undefined`. The fix means a missing body now answers `400 VALIDATION_ERROR` with
`"Reason is required for this operation"`, as it always should have. **Note for #285 in
particular:** `reason` travels in the DELETE *body*, so the header is mandatory there even though
many HTTP clients omit it for DELETE by default.

**2. `:userId` is now case-normalised.** It was already required to be a UUID; upper-case hex was
accepted and passed through unchanged, while PostgreSQL compares `uuid` values case-insensitively.
The visible consequence was on **#285**: a super-admin who sent their own id upper-cased slipped
past `CANNOT_REVOKE_SELF` and revoked themselves. Both spellings now behave identically — #285
answers `409 CANNOT_REVOKE_SELF`, and `target_id` in the audit ledger is always lower case. No
client action needed; keep sending ids exactly as #282 returns them.

The other two fixes are server-side only and change no contract: **#288** now also re-checks that
the invitee has not acquired an organization membership since the invitation was issued (the
address can be claimed by a tenant in the 48-hour window), answering the same opaque
`400 INVALID_INVITATION`; and a membership row-lock timeout in **#284/#285** now maps to the
documented retryable `409 STAFF_CHANGE_IN_PROGRESS` instead of a 500.
