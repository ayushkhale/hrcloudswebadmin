# Platform Admin Phase 1 — Hand-Back Note

**Date:** 2026-11-17 · **Branch:** `development` · **Plan:** [`phase1_implementation_plan.md`](./phase1_implementation_plan.md)
**Status:** implemented and unit-verified in this working tree. **Two operator actions are outstanding** (§2) before Phase 2 may start.

---

## 1. What was built

| # | Deliverable | File(s) |
|---|---|---|
| 1 | Append-only administrative audit ledger | `src/infrastructure/postgres-sql/migrations/00089-create-platform-audit-logs.js`, `src/modules/platform/models/platform_audit_logs.model.js`, `src/modules/platform/repositories/platform_audit_log.repository.js` |
| 2 | Platform access guard (tier-based, per-request DB re-check) | `src/common/middlewares/platform_access.middleware.js` |
| 3 | Platform vocabularies (tiers, audit actions, target types, lock key) | `src/modules/platform/constants/platform.constants.js` |
| 4 | `GET /api/v1/platform/me` (#281) | `src/modules/platform/{routes,controllers,services}/platform_auth.*` |
| 5 | Module scaffold and mounting | `src/modules/platform/platform.index.js`, `src/app.js` (+1 line), `src/infrastructure/postgres-sql/models.index.js` (+1 line) |
| 6 | Super-admin bootstrap / break-glass CLI | `src/modules/platform/scripts/grant_super_admin.js`, `package.json` (+1 script) |
| 7 | Unit suites (T-1 … T-6) | `tests/unit/platform/*.test.js` (6 files, 78 tests) |
| 8 | Documentation | `public/md_system/api_registry.md` (#281 + new section), `public/md_updates/2026-11-17_platform_access_and_me_api.md`, this note |

**Requirements discharged:** REQ-P1 (access guard), REQ-P2 (bootstrap and break-glass), REQ-P3 write side (ledger exists; the read API is Phase 7 #310).

---

## 2. Outstanding operator actions

### 2.1 Apply migration `00089` — handed back UNRUN

```bash
npm run db:migrate
npm run db:migrate:status      # expect 00089-create-platform-audit-logs.js = up
```

Creates one new, empty table (`platform_audit_logs`) with four indexes and two foreign keys. No `ALTER`, no backfill, no lock on any existing table. Order-independent of every other pending migration — it depends only on `users` and `organizations`. Safe to apply before or after the code deploy.

⚠ **`down()` is destructive**: it drops the table and every audit row in it. For a post-release rollback, prefer leaving the table in place — it is inert without the platform module.

### 2.2 Create the first super-admin

```bash
npm run platform:grant-super-admin -- --email <founder@…> --dry-run   # verify eligibility first
npm run platform:grant-super-admin -- --email <founder@…>
```

Then confirm the round trip on a real environment:

1. The founder signs in at `POST /api/v1/auth/login` (the existing endpoint — there is no platform login).
2. `GET /api/v1/platform/me` returns `200` with `"tier": "SUPER_ADMIN"`.
3. `SELECT action, actor_role, target_type FROM platform_audit_logs;` shows exactly one `SUPER_ADMIN_GRANTED` / `system` / `platform_staff` row.

**Per the plan's §26.4, Phase 2 does not begin until this round trip has happened on a real environment.** Everything above it is verified by unit tests; this is the only part that proves the real database, the real token path and the real guard agree.

---

## 3. Test baseline

| Point | Result |
|---|---|
| Before the phase (after clearing the blocker in §4) | **4,099 tests · 0 failures · exit 0** |
| After the phase | **4,166 tests · 0 failures · exit 0** |
| After the review pass (§5a) | **4,177 tests · 0 failures · exit 0** |

The delta is the six new `tests/unit/platform/` suites — 78 tests, 11 of them added by the review pass to pin each defect it fixed. The settings catalog parity test (T-S2) passes: Phase 1 adds no org-configurable setting and changes no domain Joi schema or model column.

---

## 4. Findings raised during the phase

| # | Finding | Severity | Disposition |
|---|---|---|---|
| **B-1** | `package.json` in the working tree had `sequelize` downgraded to `^3.30.0` (and `3.30.0` installed), so the model layer did not load at all — 212 of 370 test files failed on `Unrecognized data type for field max_active_devices` | CRITICAL | **Fixed in Step 0.** Restored `sequelize@^6.37.8` / `sequelize-cli@^6.6.5` and reinstalled. The change was uncommitted and unrelated to this phase — **please confirm nothing depended on it.** |
| **F-1** | `inbox.routes.js`, `notification.routes.js`, `notification_device.routes.js` list `admin`/`super-admin` in `authorize()` with no feature gate. Latent until this phase, which creates the first such token | LOW | **Documented and tested, not changed.** No tenant data is exposed; `POST /notifications/devices` 500s. Pinned by T-5; the frontend is warned in the md_updates record. Fix belongs to master **D-4**. |
| **F-4** | `requireFeature` resolves the org as `… \|\| req.body?.orgId`, so on the fourteen gated routers the gate can be opened by client input | LOW | **Documented and tested, not changed.** Harmless today: a repo-wide scan finds **zero** consumers that read tenant scope from the body, so the request still executes against `org_id = null`. T-5 contains a static scan that **fails if that ever changes**. Fix belongs to master **D-4**. |
| **F-2** | `npm run cap:task-emails` points at `scripts/cap_task_overdue_reminders.js`, which does not exist (no root `scripts/` directory) | LOW | **Raised, not fixed** — pre-existing dead configuration, unrelated to this phase. |
| **F-3** | `00074` passes `order: [['created_at','DESC']]` to `addIndex`, which Sequelize ignores (direction belongs on the field) | COSMETIC | **Raised, not fixed.** No practical impact. `00089` writes its indexes as raw SQL so the created object matches the written intent. |

---

## 5. Deviations from the plan, and decisions made during implementation

The plan was followed as written. Two small things are worth a reviewer's eye:

1. **`/me` reads the user row for `last_login_at`.** The plan's §F3.3 contract includes `last_login_at`, which `req.user` does not carry. Rather than widen `req.platformActor` — the authorization decision object — with a display timestamp, the service issues a second primary-key read, run in parallel with the profile read. Two indexed reads on a page-load endpoint.
2. **The CLI uses `db.UserRole` / `db.Role` directly** for the locked read, the insert and the tenant-membership count, as the plan's §F4.1 anticipated. The request-layer equivalents arrive with Phase 2's `platform_admin.repository`; adding half of that repository now, for one non-request caller, would be speculative and would likely mismatch Phase 2's needs.

Everything else — including all thirteen plan decisions D-F1…D-F13 — is implemented as specified. Notably: the guard validates its tier argument at require time; the audit repository refuses a missing transaction; the three distinct 403 codes; no `validators/` directory (nothing to validate yet); `pg_advisory_xact_lock` rather than the session-scoped `withAdvisoryLock` helper.

---

## 5a. Post-implementation review — defects found and fixed

A dedicated review pass over the Phase 1 code found eight defects. All are fixed, each with a test that fails without the fix. Test count rose 67 → 78.

| # | Defect | Severity | Fix |
|---|---|---|---|
| R-1 | **The guard's tier check failed OPEN for a non-numeric priority.** `undefined < 70` and `undefined < 100` are both `false`, so an unusable `priority` would pass *both* the plane floor and the route tier — turning the panel's only authorization boundary into a no-op. Unreachable today (`roles.priority` is NOT NULL and is selected), but one edit to the guard's attribute list would make it reachable with no test failure | HIGH | Explicit `Number.isInteger` check → `500 AUTH_INTERNAL_ERROR`, fail closed |
| R-2 | **`--reason --dry-run` silently performed a REAL grant.** The flag parser took the next token as a value, so `--dry-run` was consumed as the reason text and `dryRun` stayed `false` — an operator who believed they were previewing would grant super-admin for real | HIGH | A flag value starting with `--`, or missing, is a usage error |
| R-3 | **`pg_advisory_xact_lock` could block forever.** A hung session holding the lock would leave the break-glass tool silent and stuck with no explanation | MEDIUM | Transaction-scoped `SET LOCAL lock_timeout = '10000ms'`, with `55P03` mapped to a `GRANT_IN_PROGRESS` refusal. Also bounds both `FOR UPDATE` reads |
| R-4 | **`process.exit(code)` could truncate stdout.** When stdout is a pipe (`\| tee`, CI, PowerShell redirection) writes are async and `process.exit` discards them — losing the only record of what a privileged command did | MEDIUM | `process.exitCode` plus an unref'd 2s force-exit net (measured: never fires; the process drains cleanly) |
| R-5 | **The audit ledger accepted any string as `action`/`target_type`.** The column carries no DB CHECK by design, so one typo'd literal would land a permanent row that Phase 7's filters and the Phase 8 export never return — an audit trail with a silent hole, found during an incident review rather than at write time | MEDIUM | The closed lists are enforced at `platform_audit_log.repository.create`, the single chokepoint every writer passes through |
| R-6 | **A temporarily locked account was granted with no warning.** A 15-minute login lockout left the operator reading "Granted" while the user could not sign in | LOW | The result carries `lockedUntil`; the CLI reports it |
| R-7 | **`redisClient.quit()` could hang the CLI** after a committed grant (it waits for a server reply), and the success message was printed *after* the Redis step | LOW | `disconnect()` (no round trip, cannot block); the grant confirmation is printed **before** Redis is touched, so the fact that must not be lost cannot be swallowed by a broken cache |
| R-8 | **Introduced by the R-4 fix, caught by re-reviewing it:** the "cannot reach Postgres" path returned before `sequelize.close()`, so with a non-forced exit the pool's eviction timer could keep the process alive — the operator would read the error and then watch the CLI hang | MEDIUM | One `try/finally` around every path that touches Postgres |

Two further review items were deliberately **not** changed:

- **The F-4 scan in `plane_separation.test.js` was strengthened**, not the production code. Its original regex would have missed `const { orgId } = req.body` — the likelier future pattern — so the "F-4 is harmless" conclusion rested on a scan that could not have caught the thing that would break it. It now covers member, bracket and destructuring access, and self-verifies against known-bad samples before trusting a pass. Re-run across `src/modules` and `src/common`: still zero offenders, so the conclusion holds on firmer ground.
- **"No live null-org row" still returns `PLATFORM_ACCESS_REVOKED`, not `PLATFORM_ACCESS_REQUIRED`.** A user with zero memberships would more accurately get "not staff", but master D-P3 chose REVOKED deliberately, and the alternative is worse: a genuinely revoked staff member would be left staring at a dead console instead of being signed out. The practical impact is nil — only the platform console ever receives these codes.

Also checked and found sound, so unchanged: `selectOrganization` / `switchOrganization` require a real `user_roles` row, so a platform token cannot switch into a tenant; `transaction.finished` is a real Sequelize 6 property and an established pattern in this repo; the rendered `00089` DDL is correct (verified offline); no controller or service anywhere derives tenant scope from the request body.

---

## 6. What Phase 1 deliberately did **not** do

`authenticate` was not touched (suspension enforcement is Phase 3, the diagnostic branch is Phase 11). No staff invite, role change, revoke or custom-role API (Phase 2). No audit **read** API (Phase 7). No rate limiting on platform routes (master §8.5; the first limited surface is Phase 2's public accept-invite). No DB trigger or `REVOKE` for append-only enforcement (plan D-F7). No `.env` variable, config key, cron job, notification event or npm dependency was added.

---

## 7. Diff outside the new module — three lines

| File | Change |
|---|---|
| `src/app.js` | `require('./modules/platform/platform.index')(app)` after the `inbox` mount |
| `src/infrastructure/postgres-sql/models.index.js` | `modules/platform/models` added to `MODEL_ROOTS` |
| `package.json` | `platform:grant-super-admin` script; plus the §4 B-1 dependency restoration |

No existing endpoint, response shape, table, column, index, constraint or business rule was modified.
