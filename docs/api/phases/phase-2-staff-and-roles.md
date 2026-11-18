# Phase 2: Staff & Platform Roles — Complete API Analysis

> **Module:** Platform Admin (`src/modules/platform/`)  
> **Phase:** Phase 2 — Staff Directory, Invitations, Role Management, Revocation & Role Catalog  
> **API Registry Reference:** APIs **#282–#288**  
> **URL Namespace:** `/api/v1/platform/*`  
> **Status:** Shipped & Verified (`node --test tests/unit/platform/*.test.js` — 217 passing tests, 0 failures)  

---

## 1. What Shipped & Scope of Changes

Phase 2 builds administrative staff management on top of the Phase 1 identity foundation. It enables the Platform Super Admin to invite operators, promote or demote roles, revoke access safely, manage a custom role catalog, and allow invited operators to activate their accounts publicly.

| API # | Method | Endpoint | Tier / Auth | Purpose |
|:---:|:---:|---|---|---|
| **#282** | `GET` | `/api/v1/platform/admins` | `SUPER_ADMIN` (100) | Paginated staff directory with dual usability signals. |
| **#283** | `POST` | `/api/v1/platform/admins/invite` | `SUPER_ADMIN` (100) | Invite new staff or grant access to existing accounts. |
| **#284** | `PATCH` | `/api/v1/platform/admins/:userId/role` | `SUPER_ADMIN` (100) | Update platform role with mandatory reason & lock protection. |
| **#285** | `DELETE` | `/api/v1/platform/admins/:userId` | `SUPER_ADMIN` (100) | Soft-delete staff membership with self-revocation guard. |
| **#286** | `GET` | `/api/v1/platform/roles` | `ADMIN` (80+) | Flat, unpaginated catalog of platform roles and holder counts. |
| **#287** | `POST` | `/api/v1/platform/roles` | `SUPER_ADMIN` (100) | Create custom platform role in priority range 71–99. |
| **#288** | `POST` | `/api/v1/platform/auth/accept-invite` | **Public** (Rate-limited) | Set password and activate account using single-use token. |

### Auxiliary & Subsystem Changes
- **Repositories Added:** `platform_admin.repository.js` (platform membership operations scoped to `org_id IS NULL`), `platform_invite.repository.js` (Redis token management).
- **Utility Added:** `platform_request_context.utils.js` (`buildAuditContext` with IP and user-agent string truncation).
- **Additive Extensions Outside Module:** `role.repository.js` (+3 methods), `user_profile.repository.js` (+1 method), `configs/default.json` (+1 key `urls.platformInviteAcceptPath`).
- **Database Impact:** Zero schema migrations or table modifications. Operates against existing tables (`user_roles`, `roles`, `users`, `user_profiles`, `platform_audit_logs`). Requires Phase 1's migration `00089` to be applied.

---

## 2. Core Architectural & Security Invariants

### 2.1 The Super-Admin Set Mutex (`SUPER_ADMIN_SET_LOCK_KEY`)
- **Vulnerability Solved:** Two concurrent demotions or revocations targeting two different super-admins could both check "at least 1 active super-admin remains", both pass, and both commit, completely locking the platform out.
- **Mechanism:** Both #284 (role change) and #285 (revocation) acquire a PostgreSQL transaction-scoped advisory lock before reading the target's current state:
  ```sql
  SET LOCAL lock_timeout = '3000ms';
  SELECT pg_advisory_xact_lock(hashtext('platform:super_admin_set'));
  ```
- Shares the identical key with `scripts/grant_super_admin.js`, guaranteeing cross-process serialization between web traffic and terminal operations.
- Contention or timeout raises `55P03`, mapped cleanly to `409 STAFF_CHANGE_IN_PROGRESS` (clients can retry automatically).

### 2.2 Dedicated Platform Identity Invariant (Branch E)
- Platform staff must be dedicated accounts. A user holding any live tenant membership (`org_id IS NOT NULL`) cannot be granted platform staff access (`409 USER_HAS_TENANT_MEMBERSHIP`).
- Prevents multi-membership credential confusion at login (`_generateLoginResponse` prioritizes tenant roles and drops null-org platform roles when multiple memberships exist).

### 2.3 Strict Priority Window & Authority Floor
- Priority 100 (`super-admin`) is structurally unreachable via any API. The CLI (`npm run platform:grant-super-admin`) is the only path to priority 100.
- Custom roles (#287) are restricted strictly to **71–99**. Priority 70 (`worker`) and 100 (`super-admin`) are rejected.
- Role assignments (#283, #284) accept only roles with active status and priority **70–99**.
- Authority is derived directly from priority: 70–79 $\rightarrow$ `WORKER`, 80–99 $\rightarrow$ `ADMIN`, 100 $\rightarrow$ `SUPER_ADMIN`. There is no separate permission matrix.

### 2.4 Token Security & Privacy at Rest
- Activation tokens are 256-bit cryptographically secure hex strings (`crypto.randomBytes(32).toString('hex')`).
- Only the SHA-256 hash is persisted in Redis (`platform_invite:<sha256>`), with a strict 48-hour TTL.
- Raw tokens are never logged. The raw token appears only once in the HTTP response of #283 and in the SES invitation email.
- Token invalidation/consumption uses an atomic Lua script (`platform_invite_blocked:<sha256>` prevents replay).

### 2.5 Uniform Failure Masking on Public Route #288
- Route #288 is unauthenticated. To prevent account and token enumeration, all failures (token expired, token unknown, already consumed, staff revoked, role retired, or user not pending verification) return the identical generic error:
  `400 INVALID_INVITATION` ("This invitation is no longer valid. Ask your administrator to re-send it.").
- Rate limited by client IP: 10 attempts per IP per hour.

### 2.6 GET List vs. Detail Projection
- In accordance with project architectural guidelines, multi-row endpoints (#282, #286) return lightweight, summary fields only.
- Credentials, password hashes, auth provider details, secret tokens, and organization fields are completely excluded from list projections.

---

## 3. Detailed Endpoint Specifications

### 3.1 API #282 — GET `/api/v1/platform/admins`

#### Overview & Purpose
- **Endpoint:** `GET /api/v1/platform/admins`
- **Method:** `GET`
- **Access / Role:** Protected · Platform Plane · `SUPER_ADMIN` (Priority 100)
- **Purpose:** Fetches a paginated summary list of platform staff accounts.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`
- **Query Parameters:**
  | Parameter | Type | Required | Default | Validation Rules |
  |---|---|:---:|:---:|---|
  | `page` | Integer | No | `1` | Minimum `1` |
  | `limit` | Integer | No | `25` | Minimum `1`, Maximum `100` |

#### Database & Processing Flow
1. Validates query parameters using Joi schema with `stripUnknown: true`.
2. Issues Query 1: `UserRole.findAndCountAll` scoped to `org_id IS NULL`, inner joined to `Role` where `priority >= 70` (excluding `guest` accounts), and `User` (`status`, `identifier`, `last_login_at`). Ordered by `Role.priority DESC, assigned_at DESC, id ASC`.
3. Issues Query 2: Batched read of global user profiles via `userProfileRepository.findGlobalByUserIds`.
4. Exactly 2 queries executed regardless of page size. Derives `invitation_pending` from `user.status === 'pending_verification'`.

#### Success Response Contract (`200 OK`)
```json
{
  "success": true,
  "message": "Platform staff fetched successfully",
  "data": {
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 25,
      "total_pages": 1
    },
    "rows": [
      {
        "user_id": "8a93ef20-4b5c-4d1e-9f3a-2b7c1d4e5f60",
        "email": "sarah.ops@hrclouds.in",
        "identifier_type": "email",
        "first_name": "Sarah",
        "last_name": "Jenkins",
        "display_name": "Sarah Jenkins",
        "role": {
          "key": "admin",
          "name": "Admin",
          "priority": 80,
          "is_active": true
        },
        "tier": "ADMIN",
        "is_active": true,
        "status": "active",
        "invitation_pending": false,
        "assigned_at": "2026-09-01T10:00:00.000Z",
        "assigned_by": "0f1d4a2e-3c5b-4a1d-8e2f-1a9b8c7d6e5f",
        "last_login_at": "2026-11-16T14:22:10.000Z",
        "created_at": "2026-09-01T10:00:00.000Z"
      }
    ]
  }
}
```

#### Field Meanings:
- `is_active`: Membership status in `user_roles`.
- `status`: Account lifecycle status in `users` (`active`, `pending_verification`, `inactive`, `suspended`, `blocked`). Both fields are surfaced because the platform guard rejects if either is inactive.
- `assigned_by`: User ID of assigning super-admin, or `null` for CLI-bootstrapped accounts.
- `first_name` / `last_name` / `display_name`: May be `null` for CLI-bootstrapped staff without profiles.

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | `page < 1` or `limit > 100`. |
| `401` | `NOT_AUTHENTICATED` | Missing or invalid Bearer token. |
| `403` | `PLATFORM_ACCESS_REQUIRED` | Non-platform token or priority < 70. |
| `403` | `PLATFORM_ACCESS_REVOKED` | User deactivated or role revoked in DB. |
| `403` | `FORBIDDEN` | Platform staff priority < 100. |

---

### 3.2 API #283 — POST `/api/v1/platform/admins/invite`

#### Overview & Purpose
- **Endpoint:** `POST /api/v1/platform/admins/invite`
- **Method:** `POST`
- **Access / Role:** Protected · Platform Plane · `SUPER_ADMIN` (Priority 100)
- **Purpose:** Invites a new operator or grants platform access to an existing non-staff user.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "alex.support@hrclouds.in",
  "first_name": "Alex",
  "last_name": "Rivera",
  "role_key": "worker"
}
```

| Field | Type | Required | Nullable | Validation Constraints |
|---|---|:---:|:---:|---|
| `email` | String | Yes | No | Trimmed, lowercase, valid email, max 255. |
| `first_name` | String | Yes | No | Trimmed, 1–100 characters. |
| `last_name` | String | No | Yes | Trimmed, max 100 characters, allows `""`. |
| `role_key` | String | Yes | No | Trimmed, lowercase slug, max 50. Must resolve to active role priority 70–99. |

#### Processing Flow & Invariant Branches
1. Resolves `role_key` against `roles`. Rejects `super-admin` or retired roles with `400 INVALID_PLATFORM_ROLE`.
2. Starts Sequelize transaction.
3. Checks existing user by email with `FOR UPDATE` row lock:
   - **Branch E:** If user has ANY tenant membership (`org_id IS NOT NULL`), rolls back with `409 USER_HAS_TENANT_MEMBERSHIP`.
   - **Branch F:** If user exists with status not in `['active', 'pending_verification']`, rolls back with `409 USER_NOT_ELIGIBLE`.
   - **Branch D:** If user is already active staff (`role.priority >= 70` and `status === 'active'`), rolls back with `409 ALREADY_PLATFORM_STAFF`.
   - **Branch C (Re-invite):** If user is staff but `status === 'pending_verification'`, updates role/reactivates membership if changed, rotates activation token (`outcome = 'reinvited'`).
   - **Branch B (Grant Existing):** Existing user without staff role (e.g., `guest` or previously revoked). Activates membership as target role. If `status === 'active'`, `outcome = 'granted'` (no token needed); if `pending_verification`, `outcome = 'invited'`.
   - **Branch A (New User):** Creates user (`status: 'pending_verification'`), upserts global `user_profiles`, inserts `user_roles` with `org_id: null`. `outcome = 'invited'`.
4. Appends audit record to `platform_audit_logs` (`action = 'STAFF_INVITED'`).
5. Commits transaction.
6. Post-Commit Actions:
   - If `activation_required`: Issues Redis token via `platformInviteRepository.issue` (48h TTL); builds `activation_link`.
   - If `outcome === 'granted'`: Sets `user_revoked_at:<userId>` in Redis (72h TTL) to invalidate previous sessions.
   - Dispatches notification email via AWS SES (`orgName: 'HR Clouds'`).

#### Success Response Contract
- **Status:** `201 Created` (`outcome: "invited"` or `"granted"`), `200 OK` (`outcome: "reinvited"`).
```json
{
  "success": true,
  "message": "Platform staff invited successfully",
  "data": {
    "user_id": "8a93ef20-4b5c-4d1e-9f3a-2b7c1d4e5f60",
    "email": "alex.support@hrclouds.in",
    "role": {
      "key": "worker",
      "name": "Worker",
      "priority": 70
    },
    "tier": "WORKER",
    "outcome": "invited",
    "previous_role": null,
    "activation_required": true,
    "activation_link": "https://console.hrclouds.in/platform/accept-invite?token=4a7b8c...",
    "activation_expires_at": "2026-11-19T13:20:00.000Z",
    "email_delivered": true
  }
}
```

> **Security Note:** `activation_link` is returned **exactly once** in this response and is never stored in plaintext or logged. If email delivery fails (`email_delivered: false`), the operator must manually copy the link.

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | Malformed email, missing first name, invalid role key format. |
| `400` | `INVALID_PLATFORM_ROLE` | Role key does not exist, is inactive, or priority is outside 70–99 (including `super-admin`). |
| `409` | `USER_HAS_TENANT_MEMBERSHIP` | Account belongs to a tenant organization. |
| `409` | `USER_NOT_ELIGIBLE` | Account is `suspended`, `inactive`, or `blocked`. |
| `409` | `ALREADY_PLATFORM_STAFF` | User is already an active platform staff member. |
| `409` | `INVITE_IN_PROGRESS` | Concurrent invite race on email or membership unique index. |

---

### 3.3 API #284 — PATCH `/api/v1/platform/admins/:userId/role`

#### Overview & Purpose
- **Endpoint:** `PATCH /api/v1/platform/admins/:userId/role`
- **Method:** `PATCH`
- **Access / Role:** Protected · Platform Plane · `SUPER_ADMIN` (Priority 100)
- **Purpose:** Promotes or demotes an existing platform staff member's role.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`, `Content-Type: application/json`
- **Path Parameters:**
  - `userId`: UUIDv4 string, required.
- **Request Body:**
```json
{
  "role_key": "admin",
  "reason": "Promoted to run the support desk operations (OPS-214)"
}
```

| Field | Type | Required | Nullable | Validation Constraints |
|---|---|:---:|:---:|---|
| `role_key` | String | Yes | No | Trimmed, lowercase slug, max 50. Must resolve to active role priority 70–99. |
| `reason` | String | Yes | No | Trimmed text, 5–500 characters. |

#### Database & Concurrency Behavior
1. Validates `userId` UUID and body schema.
2. Starts transaction and acquires advisory lock: `pg_advisory_xact_lock(hashtext('platform:super_admin_set'))` with 3s `lock_timeout`.
3. Resolves new role (cannot be `super-admin`).
4. Reads target's current platform membership with row lock (`FOR UPDATE OF user_roles`). Throws `404 PLATFORM_STAFF_NOT_FOUND` if target is not active staff.
5. **Idempotency Check:** If `currentRole.id === newRole.id`, commits immediately and returns `200 OK` with `changed: false` without creating an audit log.
6. **Last Super-Admin Check:** If target is currently `super-admin`, executes `countActiveSuperAdmins({ excludeUserId: userId })`. If count $< 1$, rolls back with `409 LAST_SUPER_ADMIN`.
7. Updates `user_roles.role_id`, `assigned_by`, `assigned_at` (never touches `is_active`).
8. Appends audit record to `platform_audit_logs` (`action = 'STAFF_ROLE_CHANGED'`).
9. Commits transaction and sets `user_revoked_at:<userId>` in Redis (72h TTL).

#### Success Response Contract (`200 OK`)
```json
{
  "success": true,
  "message": "Platform role updated successfully",
  "data": {
    "user_id": "8a93ef20-4b5c-4d1e-9f3a-2b7c1d4e5f60",
    "changed": true,
    "previous_role": {
      "key": "worker",
      "name": "Worker",
      "priority": 70
    },
    "role": {
      "key": "admin",
      "name": "Admin",
      "priority": 80
    },
    "tier": "ADMIN",
    "sessions_revoked": true
  }
}
```

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid UUID, missing or short reason (< 5 chars). |
| `400` | `INVALID_PLATFORM_ROLE` | Target role outside priority 70–99 (e.g. `super-admin`). |
| `404` | `PLATFORM_STAFF_NOT_FOUND` | User ID does not exist or has no staff membership. |
| `409` | `LAST_SUPER_ADMIN` | Change would leave platform with zero active super-admins. |
| `409` | `STAFF_CHANGE_IN_PROGRESS` | Lock timeout or concurrent race detected. |

---

### 3.4 API #285 — DELETE `/api/v1/platform/admins/:userId`

#### Overview & Purpose
- **Endpoint:** `DELETE /api/v1/platform/admins/:userId`
- **Method:** `DELETE`
- **Access / Role:** Protected · Platform Plane · `SUPER_ADMIN` (Priority 100)
- **Purpose:** Revokes platform access by soft-deleting the staff membership.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`, `Content-Type: application/json`
- **Path Parameters:**
  - `userId`: UUIDv4 string, required.
- **Request Body (JSON):**
```json
{
  "reason": "Offboarding from platform engineering team (TICKET-892)"
}
```

> **Design Note:** The mandatory justification `reason` (5–500 chars) is placed in the DELETE request body rather than query parameters to prevent sensitive text from leaking into intermediate reverse-proxy and access logs.

#### Processing Flow & Invariants
1. **Self-Revocation Pre-check:** If `userId === platformActor.id`, immediately throws `409 CANNOT_REVOKE_SELF` without database work.
2. Starts transaction and acquires advisory lock `platform:super_admin_set`.
3. Finds membership with row lock. If missing or priority < 70, throws `404 PLATFORM_STAFF_NOT_FOUND`.
4. If target is `super-admin`, verifies `countActiveSuperAdmins({ excludeUserId: userId }) >= 1`. If zero, throws `409 LAST_SUPER_ADMIN`.
5. Soft-deletes `user_roles` (`deleted_at = NOW()`).
6. Appends audit record to `platform_audit_logs` (`action = 'STAFF_REVOKED'`).
7. Commits transaction.
8. Post-Commit Actions:
   - Invalidates any active invitation token in Redis: `platformInviteRepository.revoke(userId)`.
   - Invalidates active sessions in Redis: `user_revoked_at:<userId>` (72h TTL).

#### Success Response Contract (`200 OK`)
```json
{
  "success": true,
  "message": "Platform access revoked successfully",
  "data": {
    "user_id": "8a93ef20-4b5c-4d1e-9f3a-2b7c1d4e5f60",
    "revoked_role": {
      "key": "admin",
      "name": "Admin",
      "priority": 80
    },
    "sessions_revoked": true,
    "pending_invitation_cleared": false
  }
}
```

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | Missing or invalid reason (length < 5 or > 500 chars). |
| `404` | `PLATFORM_STAFF_NOT_FOUND` | Target has no active staff membership (or retried DELETE). |
| `409` | `CANNOT_REVOKE_SELF` | Caller attempted to delete their own staff membership. |
| `409` | `LAST_SUPER_ADMIN` | Revoking target would leave zero active super-admins. |
| `409` | `STAFF_CHANGE_IN_PROGRESS` | Advisory lock contention timeout. |

---

### 3.5 API #286 — GET `/api/v1/platform/roles`

#### Overview & Purpose
- **Endpoint:** `GET /api/v1/platform/roles`
- **Method:** `GET`
- **Access / Role:** Protected · Platform Plane · `ADMIN` (Priority $\ge 80$)
- **Purpose:** Fetches the platform role catalog to populate role assignment pickers.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`
- **Parameters:** None. Flat, unpaginated collection (bounded system catalog).

#### Database & Processing Flow
- Executes two parallel reads via `Promise.all`:
  1. `roleRepository.findPlatformRoles(70)`: Selects all roles where `priority >= 70` (both active and inactive), ordered by `priority DESC, key ASC`.
  2. `platformAdminRepository.countStaffByRole()`: Grouped query `SELECT role_id, COUNT(id) FROM user_roles WHERE org_id IS NULL AND is_active = true GROUP BY role_id`.
- Computes `assignable_via_api = is_active && priority >= 70 && priority <= 99`.

#### Success Response Contract (`200 OK`)
```json
{
  "success": true,
  "message": "Platform roles fetched successfully",
  "data": {
    "roles": [
      {
        "id": "11111111-2222-3333-4444-555555555555",
        "key": "super-admin",
        "name": "Super Admin",
        "description": "Full platform authority",
        "priority": 100,
        "tier": "SUPER_ADMIN",
        "is_system_role": true,
        "is_assignable": true,
        "is_active": true,
        "assigned_count": 1,
        "assignable_via_api": false
      },
      {
        "id": "22222222-3333-4444-5555-666666666666",
        "key": "admin",
        "name": "Admin",
        "description": "Operational platform administration",
        "priority": 80,
        "tier": "ADMIN",
        "is_system_role": true,
        "is_assignable": false,
        "is_active": true,
        "assigned_count": 2,
        "assignable_via_api": true
      },
      {
        "id": "33333333-4444-5555-6666-777777777777",
        "key": "support-lead",
        "name": "Support Lead",
        "description": "Runs support operations",
        "priority": 75,
        "tier": "WORKER",
        "is_system_role": false,
        "is_assignable": true,
        "is_active": true,
        "assigned_count": 0,
        "assignable_via_api": true
      }
    ]
  }
}
```

> **Client Guidance:** Role assignment pickers must filter on `assignable_via_api === true`. Do not use `is_assignable` (which is `false` on the seeded `admin` role).

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `401` | `NOT_AUTHENTICATED` | Invalid or expired token. |
| `403` | `FORBIDDEN` | Caller priority < 80 (`WORKER` tier cannot read role catalog). |

---

### 3.6 API #287 — POST `/api/v1/platform/roles`

#### Overview & Purpose
- **Endpoint:** `POST /api/v1/platform/roles`
- **Method:** `POST`
- **Access / Role:** Protected · Platform Plane · `SUPER_ADMIN` (Priority 100)
- **Purpose:** Creates a custom platform role with priority between 71 and 99.

#### Request Contract
- **Headers:** `Authorization: Bearer <platform_token>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "key": "support-lead",
  "name": "Support Lead",
  "description": "Team lead for platform support desk",
  "priority": 75
}
```

| Field | Type | Required | Nullable | Validation Constraints |
|---|---|:---:|:---:|---|
| `key` | String | Yes | No | Trimmed, lowercase, 3–50 chars, regex `^[a-z][a-z0-9-]*$`. |
| `name` | String | Yes | No | Trimmed, 1–100 chars. |
| `description` | String | No | Yes | Trimmed, max 255 chars, allows `""`. |
| `priority` | Integer | Yes | No | Integer **71–99** (70 and 100 rejected). |

#### Processing Flow & Invariants
1. Validates body. Fixed server values: `is_system_role: false`, `is_assignable: true`, `is_active: true`.
2. Starts transaction and inserts into `roles`. Unique constraint catches collisions (`409 ROLE_KEY_TAKEN`).
3. Appends audit record to `platform_audit_logs` (`action = 'ROLE_CREATED'`).
4. Commits transaction.

#### Success Response Contract (`201 Created`)
```json
{
  "success": true,
  "message": "Platform role created successfully",
  "data": {
    "id": "33333333-4444-5555-6666-777777777777",
    "key": "support-lead",
    "name": "Support Lead",
    "description": "Team lead for platform support desk",
    "priority": 75,
    "tier": "WORKER",
    "is_system_role": false,
    "is_assignable": true,
    "is_active": true
  }
}
```

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | Priority < 71 or > 99, or malformed slug key. |
| `409` | `ROLE_KEY_TAKEN` | Key already exists in `roles` (including system roles). |

---

### 3.7 API #288 — POST `/api/v1/platform/auth/accept-invite`

#### Overview & Purpose
- **Endpoint:** `POST /api/v1/platform/auth/accept-invite`
- **Method:** `POST`
- **Access / Role:** **PUBLIC** (Unauthenticated, no Authorization header required).
- **Purpose:** Public onboarding endpoint. Invitee sets password and activates platform account.

#### Request Contract
- **Headers:** `Content-Type: application/json`
- **Rate Limit:** 10 attempts per IP per hour. `Retry-After` header returned on `429`.
- **Request Body:**
```json
{
  "token": "4a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
  "password": "StrongPassword@2026"
}
```

| Field | Type | Required | Nullable | Validation Constraints |
|---|---|:---:|:---:|---|
| `token` | String | Yes | No | Trimmed, exactly 64 lowercase hex characters (`^[0-9a-f]{64}$`). |
| `password` | String | Yes | No | Minimum 8 chars, mixed case, number, special character. |

#### Processing Flow & Invariants
1. **IP Rate Limit Check:** Executed before any database or Redis operation to defend argon2 against resource exhaustion.
2. **Redis Token Validation:** Retrieves payload via `platformInviteRepository.validate(token)`. If invalid, blocked, or missing, throws `400 INVALID_INVITATION`.
3. Starts Sequelize transaction:
   - Row-locks target account: `User.findById(userId, { lock: true })`.
   - Asserts `user.status === 'pending_verification'`.
   - Asserts membership is active, role is active, and role `priority >= 70`.
   - Hashes password using argon2id.
   - Updates user: `password_hash`, `status: 'active'`, `identifier_verified: true`, `verified_at = NOW()`.
   - Appends audit record to `platform_audit_logs` (`actor_id = user.id`, `action = 'STAFF_ACTIVATED'`).
   - Commits transaction.
4. Post-Commit Actions:
   - Consumes Redis token via Lua script.
   - Returns email to pre-fill login form.
   - **No session is issued.** User signs in via `POST /api/v1/auth/login`.

#### Success Response Contract (`200 OK`)
```json
{
  "success": true,
  "message": "Your platform account is active. Please sign in.",
  "data": {
    "email": "alex.support@hrclouds.in"
  }
}
```

#### Error Responses Matrix
| Status | Error Code | Trigger Condition |
|:---:|---|---|
| `400` | `VALIDATION_ERROR` | Non-hex token, or password fails complexity rules. |
| `400` | `INVALID_INVITATION` | Expired, already used, revoked, rotated, or nonexistent token. |
| `429` | `RATE_LIMITED` | More than 10 attempts from the same IP in one hour. |
| `500` | `INTERNAL_SERVER_ERROR` | Database outage or unexpected error. |

---

## 4. Platform Foundation Components

### 4.1 Audit Ledger Actions in Phase 2
All mutations write an immutable record into `platform_audit_logs` inside the primary transaction:

| Action | Target Type | Triggering Endpoint | Details Captured |
|---|---|:---:|---|
| `STAFF_INVITED` | `platform_staff` | #283 | `outcome`, `role`, `priority`, `tier`, `previous_role`, `activation_required` |
| `STAFF_ROLE_CHANGED` | `platform_staff` | #284 | `previous_role`, `new_role`, `previous_priority`, `new_priority`, `previous_tier`, `new_tier` |
| `STAFF_REVOKED` | `platform_staff` | #285 | `revoked_role`, `revoked_priority`, `was_pending_activation` |
| `ROLE_CREATED` | `role` | #287 | `key`, `name`, `priority`, `tier` |
| `STAFF_ACTIVATED` | `platform_staff` | #288 | `via: 'accept_invite'`, `role` |

### 4.2 Redis Key Schema for Platform Invitations
All keys reside exclusively under the `platform_` prefix to guarantee complete tenant isolation:
- `platform_invite:<token_sha256>`: JSON payload containing `{ user_id, email, role_id, role_key, invited_by }` (TTL: 48 hours).
- `platform_invite_target:<user_id>`: Holds active token hash for fast lookup and rotation (TTL: 48 hours).
- `platform_invite_blocked:<token_sha256>`: Marker for consumed/rotated tokens (TTL: 48 hours).
- `platform:platform_accept_invite:<ip>`: Rate limit sliding window (10 hits/hour).
- `user_revoked_at:<user_id>`: Session invalidation timestamp (TTL: 72 hours).

---

## 5. Existing HR Clouds APIs — Consistency & Impact

1. **Phase 1 Identity Endpoint (`#281 GET /api/v1/platform/me`):**
   - Untouched. Byte-identical request and response contracts.
   - Accurately projects `tier` for custom roles (71–99) created in Phase 2 without backend modifications.
2. **Tenant Plane Endpoints (APIs #1–#280):**
   - Zero existing tenant APIs modified.
   - `role.repository.js` received three additive helper methods (`findPlatformRoles`, `create`, `findById`) while leaving existing methods byte-identical.
   - `user_profile.repository.js` received one additive helper method (`findGlobalByUserIds`).
   - Tenant isolation verified: `requireFeature` and `requireActiveOrg` reject platform tokens with `400 MISSING_ORG_CONTEXT`.

---

## 6. Final Coverage & Verification Summary

```text
Total Platform Admin Phase 2 APIs discovered: 7
Total Platform Admin Phase 2 APIs documented: 7
New Phase 2 APIs added: 7 (#282, #283, #284, #285, #286, #287, #288)
Existing Platform Admin Phase 1 APIs modified by Phase 2: 0
Existing HR Clouds APIs modified by Platform Admin Phase 2: 0
APIs corrected: 0
APIs still missing: 0

Request contracts verified: 7 / 7 (100%)
Success responses verified: 7 / 7 (100%)
Error handling verified: 7 / 7 (100%)
Security/authorization verified: 7 / 7 (100%)
Database behavior verified: 7 / 7 (100%)
Side effects and dependencies verified: 7 / 7 (100%)

Existing HR Clouds APIs reviewed for Platform Admin impact: 280
Existing Platform Admin Phase 1 APIs reviewed for Phase 2 impact: 1 (#281)
Existing HR Clouds APIs actually changed by Platform Admin Phase 2: 0
Existing Platform Admin Phase 1 APIs actually changed by Phase 2: 0
Existing APIs extended by Platform Admin Phase 2: 0
APIs incorrectly assumed as changed: 0
```

- **Unit Test Suite Verification:** `node --test tests/unit/platform/*.test.js` $\rightarrow$ **217 passed, 0 failed, 0 skipped**.
- **Full Test Suite Status:** `npm test` $\rightarrow$ **4,316 passed, 0 failed**.
