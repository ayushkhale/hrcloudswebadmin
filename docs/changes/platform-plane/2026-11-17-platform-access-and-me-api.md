# 2026-11-17 — Platform Super Admin Panel: access guard and `GET /platform/me` (#281)

**Change type:** additive. One new endpoint on a new URL namespace. **No existing endpoint, request shape, response shape or error code changes.**
**Phase:** Platform Admin Phase 1 ([plan](../md_platform-admin/phases/phase1_implementation_plan.md) · [master plan](../md_platform-admin/implementation_plan.md))
**Frontend action required:** only for the Platform Super Admin Panel. Existing tenant apps (HR, manager, employee) need no change.

---

## 1. What shipped

| Item | Detail |
|---|---|
| New endpoint | `GET /api/v1/platform/me` — registry **#281** |
| New namespace | `/api/v1/platform/*` (previously unused) |
| New authorization | `requirePlatformRole(<tier>)`, chained after `authenticate` on every platform route |
| New table | `platform_audit_logs` (append-only administrative ledger; no API reads it yet — the read API is Phase 7 `#310`) |
| New operator command | `npm run platform:grant-super-admin -- --email <address>` |
| Changed | Nothing tenant-facing. `authenticate`, `authorize`, `requireActiveOrg`, `requireFeature` and `requireSubscription` are untouched. |

---

## 2. Login is unchanged — do not build a platform login

Platform staff sign in through the **existing** `POST /api/v1/auth/login`. A staff member's only membership row is the platform one (`org_id IS NULL`), so the existing single-membership path issues a normal access token with:

```json
{ "role": "super-admin", "orgId": null }
```

Two consequences for the panel's client:

1. **Skip organization selection.** The login response for platform staff is the ordinary token response, not `requires_org_selection`. Do not send platform staff through the org picker.
2. **Do not derive authority from the token.** `role` in the token is a claim, not a permission. The server re-reads the actual role from the database on every platform request; call `#281` to learn what the UI may show.

---

## 3. `GET /api/v1/platform/me`

**Request:** `Authorization: Bearer <access token>`. No path, query or body parameters.

**200 response:**

```json
{
  "success": true,
  "message": "Platform profile fetched successfully",
  "data": {
    "id": "8f2c1d4a-57c6-4a1b-9f3e-6c2b8d4a1e55",
    "identifier": "ops@hrclouds.in",
    "identifier_type": "email",
    "first_name": "Asha",
    "last_name": "Rao",
    "display_name": "Asha Rao",
    "avatar_url": null,
    "role": { "key": "super-admin", "name": "Super Admin", "priority": 100 },
    "tier": "SUPER_ADMIN",
    "last_login_at": "2026-11-17T04:12:09.000Z"
  }
}
```

| Field | Notes |
|---|---|
| `tier` | `"SUPER_ADMIN"` \| `"ADMIN"` \| `"WORKER"`. **Gate all navigation and menus on this field.** |
| `role.key` / `role.name` | For display only ("acting as Super Admin"). Never branch on `role.key`. |
| `role.priority` | 70–100. Informational. |
| `first_name`, `last_name`, `display_name`, `avatar_url` | **Can all be `null`** — a staff member created by the bootstrap command has no global profile row. Fall back to `identifier`. |
| `last_login_at` | ISO 8601, or `null` for an account that has never signed in. |

**Why `tier` and not the role key.** From Phase 2 the platform can define custom roles at priority 71–99 with arbitrary keys the client has never seen. A key-based client would fail to place them; `tier` always resolves (71–79 → `WORKER`, 80–99 → `ADMIN`, 100 → `SUPER_ADMIN`).

**There is deliberately no `capabilities` or `permissions` array.** The tier is the whole client-side contract; the server remains the only authority on what an actor may do, and every endpoint enforces its own tier.

---

## 4. Error contract — three different 403s, three different client responses

| Status | `errorCode` | Means | Client must |
|---|---|---|---|
| 401 | `AUTH_TOKEN_MISSING` / `TOKEN_EXPIRED` / `TOKEN_INVALID` / `TOKEN_REVOKED` | Standard `authenticate` outcomes (unchanged) | Send to login |
| 403 | `PLATFORM_ACCESS_REQUIRED` | Not a platform actor: the token carries an `orgId`, or the caller's null-org role is below priority 70 (e.g. an ordinary signed-up user, who holds a `guest` row) | **Do not show the panel at all.** Not an error to surface as "access revoked" |
| 403 | `PLATFORM_ACCESS_REVOKED` | The token claims platform access the database no longer grants — revoked, deactivated, role changed, role retired, or the account is no longer `active` | **Sign the user out** and return to login |
| 403 | `FORBIDDEN` | Is platform staff, but below this route's tier | Keep the session; hide that action/menu |
| 500 | `AUTH_INTERNAL_ERROR` | The guard could not reach the database. It fails closed by design | Retry / incident message. Never treat as "logged out" |
| 503 | `AUTH_DEPENDENCY_FAILURE` | Redis unavailable during `authenticate` (existing behaviour) | Retry |

Response envelope is unchanged throughout: `{ success, message, data }` on success, `{ success: false, message, errorCode }` on failure.

**Revocation is immediate.** Because the guard re-reads the database on every request, a revoked or demoted staff member is refused on their **next** call — not when their 72-hour token expires. Clients must handle a `PLATFORM_ACCESS_REVOKED` arriving mid-session on any platform request.

---

## 5. Endpoints the platform console must NOT call

Three tenant routers list `admin` / `super-admin` in their role lists for historical reasons, and a platform token now exists for the first time. None of them leaks another tenant's data, but none of them works either:

| Endpoint | Result with a platform token |
|---|---|
| `GET /api/v1/inbox/badges` (#272) | `400 MISSING_ORG_CONTEXT` |
| `GET /api/v1/notifications` (#273), `/unread-count` (#274), `GET /devices` (#279) | Empty feed / `0` / empty list — rows are scoped `(org_id, user_id)` and a platform actor has no org |
| `PATCH /api/v1/notifications/:id/read` (#276), `DELETE /:id` (#277), `DELETE /devices/:id` (#280) | `404 NOT_FOUND` |
| `POST /api/v1/notifications/devices` (#278) | **`500 INTERNAL_ERROR`** — the insert violates a NOT NULL `org_id` |

The panel has no inbox or notification feature in any planned phase. Do not call these from it.

---

## 6. Operations

**Creating the first super-admin** (run by the operator, once per environment, after migration `00089` is applied):

```bash
npm run platform:grant-super-admin -- --email ops@hrclouds.in
npm run platform:grant-super-admin -- --email ops@hrclouds.in --dry-run    # check only, writes nothing
```

- Requires an **existing** account that is `active`, verified, and able to sign in. The command never creates users, never sets a password.
- Refuses an account that holds **any** organization membership: platform staff are dedicated identities.
- Idempotent — a second run reports "already a super-admin" and writes nothing.
- Revokes the user's existing sessions, so they must sign in again for the new role to take effect.

**Migration:** `00089-create-platform-audit-logs.js` — creates one new, empty table. No alterations, no backfill, no locks on existing tables. Safe to apply before or after the code deploy.

**New environment variables:** none. **New config keys:** none. **New background jobs:** none.

---

## 7. Compatibility

- No existing API changed. The only edits outside the new module are one mount line in `src/app.js`, one path in `MODEL_ROOTS`, and one npm script.
- No existing table, column, index, constraint or business rule was modified.
- Tenant request paths are byte-identical to before this change.
- Full unit suite green: **4,166 tests, 0 failures** (baseline before the phase: 4,099).
