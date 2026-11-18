# Phase 1: Platform Foundation & Identity — Complete API Analysis

> **Module:** Platform Admin (`src/modules/platform/`)  
> **Phase:** Phase 1 — Platform Access Guard, Administrative Audit Ledger & Super-Admin Bootstrap  
> **API Registry Reference:** API **#281** (`GET /api/v1/platform/me`)  
> **URL Namespace:** `/api/v1/platform/*`  
> **Status:** Shipped & Verified (`node --test tests/unit/platform/*.test.js` — 78 passing tests, 0 failures)  

---

## 1. What Shipped & Scope of Changes

Phase 1 establishes the security boundary, audit memory, and identity resolution for the Platform Super Admin Panel:

| Item | Type | Location / Artifact | Description |
|---|:---:|---|---|
| **API #281** | NEW | `GET /api/v1/platform/me` | Operator identity, role, priority, and navigation tier bootstrap. |
| **Platform Guard** | NEW | `src/common/middlewares/platform_access.middleware.js` | Priority-based authorization (`requirePlatformRole`) with per-request DB re-check. |
| **Audit Ledger** | NEW | `platform_audit_logs` (Migration `00089`) | Append-only administrative action ledger; repository enforces mandatory transaction. |
| **Bootstrap CLI** | NEW | `src/modules/platform/scripts/grant_super_admin.js` | Out-of-band super-admin grant (`npm run platform:grant-super-admin`). |
| **Module Scaffold** | NEW | `src/modules/platform/platform.index.js` | Router mount at `/api/v1/platform`. |
| **Constants** | NEW | `src/modules/platform/constants/platform.constants.js` | Closed vocabularies for tiers (`100/80/70`), actions, and target types. |
| **Existing Code** | EXTEND | `src/app.js` (+1 line), `models.index.js` (+1 line) | Mounted platform router and added model autoload path. |
| **Existing APIs** | UNCHANGED | All 280 existing endpoints | Zero existing tenant APIs, models, or middlewares modified. |

---

## 2. Core Architectural & Security Invariants

### 2.1 Dual-Plane Isolation (`org_id IS NULL`)
- **Tenant Plane:** Normal employees/HRs hold tokens with `orgId = <UUID>` and `user_roles.org_id = <UUID>`.
- **Platform Plane:** Platform staff hold tokens with `orgId = null` and `user_roles.org_id IS NULL`.
- **Cross-Plane Boundary:** Org-scoped tokens calling `/api/v1/platform/*` are rejected immediately with `403 PLATFORM_ACCESS_REQUIRED`. Platform tokens calling tenant endpoints are blocked by `requireFeature` (`400 MISSING_ORG_CONTEXT`).

### 2.2 Per-Request Database Re-Check Pattern
Existing `authenticate` middleware re-reads the database only when `payload.orgId` exists. Platform tokens carry `orgId: null` and would otherwise be trusted on signature for their full 72-hour life.  
`requirePlatformRole` performs a mandatory per-request database lookup against `user_roles`, `roles`, and `users`. Demotions, deactivations, or role changes take effect **instantly on the next HTTP request**.

### 2.3 Priority-Driven Tier RBAC
Authorization evaluates integer `priority` ($70 \le \text{priority} \le 100$), **never role-key strings**:
- `SUPER_ADMIN` (100): Master owner operations.
- `ADMIN` (80): Operational administration (includes custom roles 80–99).
- `WORKER` (70): Support operators (includes custom roles 71–79).

Custom roles defined in Phase 2 are automatically placed into the correct tier without frontend or backend code modifications.

### 2.4 Three Distinct 403 Scenarios
The platform guard returns three distinct HTTP 403 error codes. Frontend clients must handle each differently:

| HTTP Status | Error Code | Meaning | Client Action |
|:---:|---|---|---|
| **403** | `PLATFORM_ACCESS_REQUIRED` | Caller is not platform staff (token has an `orgId`, or null-org role has priority $< 70$ like `guest`). | Do not show the admin panel. |
| **403** | `PLATFORM_ACCESS_REVOKED` | User was staff, but database shows membership soft-deleted, deactivated, role changed, or account not `active`. | **Log out immediately** and redirect to login. |
| **403** | `FORBIDDEN` | Valid staff member, but role priority is below route's required tier. | Retain session; hide restricted UI action. |
| **500** | `AUTH_INTERNAL_ERROR` | Database outage during membership lookup. Fail-closed. | Show retry alert. |

---

## 3. Detailed Endpoint Specification: API #281 — GET `/api/v1/platform/me`

### 3.1 Overview & Purpose
- **Endpoint:** `GET /api/v1/platform/me`
- **Purpose:** Fetches the authenticated operator's identity, role details, and canonical authorization `tier`.
- **Business Function:** Identity bootstrap. The frontend inspects `data.tier` to conditionally render navigation menus and module controls.
- **Minimum Tier Required:** `WORKER` (Priority $\ge 70$).

### 3.2 Request Contract
- **Headers:**
  ```http
  Authorization: Bearer <platform_access_token>
  Accept: application/json
  ```
- **Path Parameters:** None.
- **Query Parameters:** None.
- **Request Body:** None.

### 3.3 Backend Processing Flow & Database Lookups
1. **`authenticate`:** Validates JWT signature, expiration, and Redis blacklist / revocation keys. Injects `req.user`.
2. **`requirePlatformRole(TIERS.WORKER)`:**
   - Asserts `req.user.orgId === null`.
   - Executes indexed lookup on `user_roles` joined to `roles` and `users` (`user_roles_system_user_unique_idx`).
   - Asserts `membership.is_active`, `role.is_active`, `role.key === req.user.role`, and `user.status === 'active'`.
   - Asserts `role.priority >= 70`.
   - Attaches frozen `req.platformActor = Object.freeze({ id, roleKey, roleName, priority })`.
3. **`platform_auth.service.getMe`:**
   - Issues two parallel indexed lookups via `Promise.all`:
     - `userRepository.getGlobalProfile(id)`: Queries `user_profiles` where `user_id = id AND org_id IS NULL`.
     - `userRepository.findById(id)`: Queries `users` for `last_login_at`.
   - Derives `tier`: $\ge 100 \rightarrow$ `"SUPER_ADMIN"`, $\ge 80 \rightarrow$ `"ADMIN"`, else `"WORKER"`.
   - Formulates sanitized JSON response.

### 3.4 Success Response Contract (`200 OK`)
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
    "role": {
      "key": "super-admin",
      "name": "Super Admin",
      "priority": 100
    },
    "tier": "SUPER_ADMIN",
    "last_login_at": "2026-11-17T04:12:09.000Z"
  }
}
```

#### Field Definitions:
| Field | Type | Nullable | Notes |
|---|---|:---:|---|
| `id` | UUIDv4 | No | User ID (`users.id`). |
| `identifier` | String | No | Primary login email / username (`users.identifier`). |
| `identifier_type` | String | No | `"email"` or `"phone"`. |
| `first_name` | String | **Yes** | Operator first name from global profile. `null` if profile omitted. |
| `last_name` | String | **Yes** | Operator last name from global profile. `null` if profile omitted. |
| `display_name` | String | **Yes** | Display name from global profile. Fall back to `identifier`. |
| `avatar_url` | String | **Yes** | Public avatar URL if set. |
| `role.key` | String | No | Programmatic role key (e.g. `"super-admin"`, `"worker"`). For display only. |
| `role.name` | String | No | Human-readable role title. |
| `role.priority` | Integer | No | Role priority number ($70 \le \text{priority} \le 100$). |
| `tier` | String | No | **Frontend gate field:** `"SUPER_ADMIN"`, `"ADMIN"`, or `"WORKER"`. |
| `last_login_at` | ISO 8601 | **Yes** | Timestamp of last login. `null` if user has never signed in. |

> **Security Note:** Excludes `password_hash`, tokens, auth providers, and all organization-specific data.

### 3.5 Error Responses Matrix
| Status | Error Code | Condition |
|:---:|---|---|
| `401` | `AUTH_TOKEN_MISSING` / `TOKEN_EXPIRED` / `TOKEN_INVALID` / `TOKEN_REVOKED` | Standard JWT authentication failure. |
| `403` | `PLATFORM_ACCESS_REQUIRED` | Caller token carries an `orgId`, or null-org role priority $< 70$. |
| `403` | `PLATFORM_ACCESS_REVOKED` | Database role changed, deactivated, soft-deleted, or user inactive. |
| `403` | `FORBIDDEN` | Staff priority is below route's required tier. |
| `500` | `AUTH_INTERNAL_ERROR` | Database outage during membership lookup (fails closed). |
| `503` | `AUTH_DEPENDENCY_FAILURE` | Redis unreachable during token blacklist check. |

---

## 4. Platform Foundation Components

### 4.1 Append-Only Audit Ledger (`platform_audit_logs`)
- **Migration:** `00089-create-platform-audit-logs.js`.
- **Columns:** `id`, `actor_id` (FK `users.id`), `actor_role`, `action`, `target_type`, `target_id`, `org_id` (FK `organizations.id`), `reason`, `details` (JSONB), `ip_address`, `user_agent`, `created_at`.
- **Indexes:**
  - `pal_created_at_idx`: `(created_at DESC)` — primary chronological stream.
  - `pal_org_created_idx`: `(org_id, created_at DESC) WHERE org_id IS NOT NULL` — partial per-org history.
  - `pal_actor_created_idx`: `(actor_id, created_at DESC)` — staff audit filter.
  - `pal_action_created_idx`: `(action, created_at DESC)` — category filter.
- **Repository Invariant:** `PlatformAuditLogRepository.create(data, transaction)` **strictly requires an active transaction**. Mutations commit together with their audit record or roll back completely.

### 4.2 Super-Admin Bootstrap CLI (`grant_super_admin.js`)
- **Command:** `npm run platform:grant-super-admin -- --email <email> [--reason <text>] [--dry-run]`
- **Pre-Conditions:** User must already exist, be active and verified, and have **zero tenant memberships** (`org_id IS NOT NULL`).
- **Concurrency & Invariants:**
  - Takes a transaction advisory lock: `pg_advisory_xact_lock(hashtext('platform:super_admin_set'))` (10s timeout).
  - Converts existing `guest` row to `super-admin` (priority 100).
  - Inserts audit record with `actor_role = 'system'`.
  - Sets Redis key `user_revoked_at:<userId>` (72h TTL) to invalidate active sessions.

---

## 5. Existing HR Clouds APIs — Consistency & Impact

1. **Login Flow (`POST /api/v1/auth/login`):**
   - Platform staff sign in through the standard login endpoint.
   - For users with a single null-org row, login returns an access token with `{ "role": "super-admin", "orgId": null }`.
   - **Frontend Action:** Platform staff bypass organization selection (`requires_org_selection` is `false`).
2. **Latent Route Safety:**
   - Routes historically listing `admin`/`super-admin` (`inbox`, `notifications`) were audited.
   - Calling tenant endpoints with a platform token fails safely with `400 MISSING_ORG_CONTEXT` or returns empty arrays. Zero tenant data is leaked.
3. **Modified Existing APIs:** **0** (Zero existing endpoints, models, or middlewares were modified).

---

## 6. Final Coverage & Verification Summary

```text
Total Platform Admin Phase 1 APIs discovered: 1
Total Platform Admin Phase 1 APIs documented: 1
New APIs added: 1 (#281 GET /api/v1/platform/me)
Existing HR Clouds APIs modified: 0
APIs still missing: 0

Request contracts verified: 1 / 1 (100%)
Success responses verified: 1 / 1 (100%)
Error handling verified: 1 / 1 (100%)
Security/authorization verified: 1 / 1 (100%)
Database behavior verified: 1 / 1 (100%)
Unit test assertions: 78 passing, 0 failures
```
