# Platform Admin Phase 2 — Hand-Back Note

**Date:** 2026-11-17 · **Branch:** `development` · **Plan:** [`phase2_implementation_plan.md`](./phase2_implementation_plan.md)
**Status:** implemented and unit-verified in this working tree. **One environmental prerequisite is outstanding** (§2) before the write path works — it is Phase 1's, not Phase 2's.

Phase 2 ships **no migration, no seeder, no env var, no cron, no dependency and no model change.** It is a pure code deploy.

---

## 1. What was built

| # | Deliverable | File(s) |
|---|---|---|
| 1 | Platform membership repository — every read/write scoped to `org_id IS NULL`, plus the grouped counts and the advisory lock | `src/modules/platform/repositories/platform_admin.repository.js` (NEW) |
| 2 | Activation-token store in Redis — issue/rotate, validate, Lua consume, revoke | `src/modules/platform/repositories/platform_invite.repository.js` (NEW) |
| 3 | Audit request context, truncated at the call site | `src/modules/platform/utils/platform_request_context.utils.js` (NEW directory + file) |
| 4 | Request schemas for #282–#287 and for #288 | `src/modules/platform/validators/platform_admin.validator.js`, `platform_auth.validator.js` (NEW directory + 2 files) |
| 5 | Staff and role business logic (#282–#287) | `src/modules/platform/services/platform_admin.service.js` (NEW) |
| 6 | Six thin handlers | `src/modules/platform/controllers/platform_admin.controller.js` (NEW) |
| 7 | Routes #282–#287, each with its own guard | `src/modules/platform/routes/platform_admin.routes.js` (NEW) |
| 8 | Public activation (#288) added to the Phase 1 auth files | `platform_auth.{service,controller,routes}.js` (**extended, additive**) |
| 9 | Module mount | `platform.index.js` (**+2 lines**) |
| 10 | Three additive extensions outside the module | `src/modules/auth/repositories/role.repository.js` (+3 methods), `src/modules/auth/repositories/user_profile.repository.js` (+1 method), `configs/default.json` (+1 key) |
| 11 | Unit suites T-7 … T-13 | `tests/unit/platform/platform_{staff_directory,role_service,admin_invite,invite_repository,accept_invite,role_change,revoke}.test.js` (7 new files, **136 tests**) |
| 12 | Phase 1's T-5 strengthened to T-5′ | `tests/unit/platform/plane_separation.test.js` (**the only non-additive change in the phase**) |
| 13 | Documentation | `public/md_system/api_registry.md` (#282–#288 + two section bullets), `public/md_updates/2026-11-17_platform_staff_and_roles_api.md`, this note |

**Requirements discharged:** REQ-P4 (staff directory), REQ-P5 (invitation + activation), REQ-P6 (role change + revocation), REQ-P7 (custom platform roles).

### Endpoints

| # | Endpoint | Method | Tier |
|---|---|---|---|
| 282 | `/api/v1/platform/admins` | GET | SUPER_ADMIN |
| 283 | `/api/v1/platform/admins/invite` | POST | SUPER_ADMIN |
| 284 | `/api/v1/platform/admins/:userId/role` | PATCH | SUPER_ADMIN (`reason` required) |
| 285 | `/api/v1/platform/admins/:userId` | DELETE | SUPER_ADMIN (`reason` required, in the body) |
| 286 | `/api/v1/platform/roles` | GET | ADMIN |
| 287 | `/api/v1/platform/roles` | POST | SUPER_ADMIN |
| 288 | `/api/v1/platform/auth/accept-invite` | POST | **public**, 10/IP/hour |

---

## 2. Outstanding prerequisite — migration `00089` must be applied

```bash
npm run db:migrate:status      # expect 00089-create-platform-audit-logs.js = up
```

Phase 1 handed `00089` back **unrun**, and Phase 2 adds no migration of its own. **Every one of Phase 2's five mutations inserts its audit row inside the same transaction as the change**, so without that table:

* #283, #284, #285, #287 and #288 all **fail and roll back completely** — a safe failure (nothing commits unaudited) but a total one for the write path;
* #282 and #286 (the two reads) work regardless.

This is a hard deployment gate, not a warning. There is no second operator action: no seeder, no env var, no CLI run, no cron registration.

---

## 3. Test numbers

### The number that matters

```
npm test  →  4,316 tests · 4,316 pass · 0 fail · 0 skipped · exit 0
```

Baseline at Step 0 was **4,177**. Phase 2 adds **exactly 139**: 136 tests across seven new suites, plus 3 to the strengthened T-5. Nothing was deleted, skipped or edited away to get there.

### Full record — `npm test` was run four times

| Run | Tests | Pass | Fail | Skipped | Exit | Note |
|---|---|---|---|---|---|---|
| **Step 0 baseline** (before any Phase 2 file existed) | 4,177 | 4,176 | 1 | 0 | 1 | `payroll_pdf_template_preview` → `PDF_RENDER_FAILED` |
| Mid-phase | 4,313 | 4,300 | 0 | 13 | 0 | database offline, so 13 DB-gated tests skipped |
| After the last fixes | 4,316 | 4,315 | 1 | 0 | 1 | `task_phase5_notifications_and_crons` T-P5-13 → backoff state |
| **Final** | **4,316** | **4,316** | **0** | **0** | **0** | every DB-gated test ran, and all passed |

**Those two intermittent failures were flakes in modules Phase 2 does not touch, and the final run proves it** — both tests passed there, with nothing changed in either of them.

They are worth recording anyway, because they tell you something about this suite: several existing tests guard themselves with a *"Database offline"* skip and run only when a live PostgreSQL happens to be reachable. When it is, a few then depend on things that are not reliable here — a headless Chromium render (payroll PDF preview, which is also **what failed at the Step 0 baseline, before a single Phase 2 file existed**) or wall-clock retry timing (the task email backoff). Each skips itself in isolation, which is how I confirmed the dependency rather than guessing at it.

Neither is reachable from Phase 2 in any case: the payroll and task suites do not import the platform module, and the only shared files Phase 2 touched are provably additive — `git diff --numstat` gives **51 insertions / 0 deletions** on `role.repository.js` and **19 / 0** on `user_profile.repository.js`, so every pre-existing method is byte-identical. The third change is one new key in `configs/default.json`.

**One correction to the plan:** it recorded the baseline as "4,177 · 0 failures". The measured baseline in this environment was 4,177 · **1** environment-dependent failure. I did not "fix" either flaky test — both are outside this phase, and quieting them would hide a real signal about the suite's determinism.

**Phase 1's suites pass unedited:** T-1 (guard matrix), T-2 (migration parity), T-3 (audit repository), T-4 (`/me`) and T-6 (the CLI's 30 tests) were not touched. T-5 (`plane_separation.test.js`) was strengthened — see §5. The settings catalog parity test (T-S2) passes; Phase 2 adds no org-configurable setting and changes no domain Joi schema or model column.

```
tests/unit/platform/  →  217 tests, 217 pass, 0 fail, 0 skipped

  Phase 1 suites, unedited .................................  71   (T-1, T-2, T-3, T-4, T-6)
  plane_separation.test.js (T-5 -> T-5') ...................  10   (was 7; +3, see §5)
  Phase 2 suites (7 new files, T-7 .. T-13) ................ 136
```

---

## 4. Blast radius

`git status` after the phase:

```
 M configs/default.json                                  (+1 key)
 M src/modules/auth/repositories/role.repository.js       (+3 methods, findByKey untouched)
 M src/modules/auth/repositories/user_profile.repository.js (+1 method, create untouched)
?? src/modules/platform/                                  (the module; 8 new files, 4 extended)
?? tests/unit/platform/                                   (7 new suites, 1 strengthened)
 M public/md_system/api_registry.md                        (+7 rows, +2 bullets, section renamed)
?? public/md_updates/2026-11-17_platform_staff_and_roles_api.md
```

**Exactly three files outside `src/modules/platform/` were touched, all additively.** Not touched: `authenticate`, `authorize`, `requireActiveOrg`, `requireFeature`, `requireSubscription`, `platform_access.middleware.js`, `platform.constants.js`, `userRoleRepository`, `invitation.service.js`, `organization.service.js`, `auth.service.js`, `role_planes.js`, any model, any migration, any seeder.

(The working tree also shows pre-existing modifications to `.agents/rules/*`, `CLAUDE.md`, `package.json`, `package-lock.json`, `src/app.js` and `models.index.js`. Those are Phase 1's and the repository owner's; Phase 2 changed none of them.)

---

## 5. The one non-additive change: T-5 → T-5′

Phase 1's `plane_separation.test.js:186` asserted, for **every file** in `src/modules/platform/routes/`, that its source contains the string `requirePlatformRole`. #288 is public by design and lives in `platform_auth.routes.js`, so that assertion blocked the phase — and it was simultaneously **too loose**: a file in which one route was guarded and three were not would have passed it.

It is now a **per-route** assertion. The test parses every `router.<verb>('<path>', …)` declaration (comments stripped) and requires each one's middleware chain to name `requirePlatformRole`, **unless** its path appears in an explicit allow-list:

```js
const PUBLIC_PLATFORM_ROUTES = ['/auth/accept-invite']
```

…which a separate test asserts holds **exactly that one entry**. Two more assertions were added: a self-check that proves the scanner detects a guarded route, an unguarded route and a multi-line chain before trusting a pass, and a check that `platform.index.js` still adds no router-level middleware (so a missing guard stays visible where the route is declared).

**Net effect: adding a second public platform route now requires editing a security test.** That is the review checkpoint. Every other assertion in the file — the role-planes check, the `requireFeature` 400, the inbox 400, the body-scope scanner, the tenant-token-refused loop — is unchanged and green.

---

## 6. Deviations from the plan and the master plan

All of these were recorded as decisions in the Phase 2 plan before implementation, except I-1 and I-2, which are implementation findings.

| | Deviation | Why |
|---|---|---|
| **D-S3** | Platform membership writes go through the new `platform_admin.repository`, **not** `userRoleRepository.updateUserRole`, which master §5.3 M1 listed as reusable | `updateUserRole` returns an affected-row count with no lock, never sets `is_active`, and is the tenant plane's mutator — widening it would couple the two planes in the one file that must not couple them |
| **D-S11** | A new `src/modules/platform/utils/` directory, absent from the master's layout | One `buildAuditContext(req)` helper, so the ip/user-agent truncation rule exists once instead of in four controllers |
| **D-S22** | #286 returns a flat, unpaginated array — a deviation from master D-P12's "lists paginate" | Seven seeded roles plus whatever operators create, with no edit and no delete and therefore no churn. A paginated role dropdown is a defect |
| **I-1** | **`findPlatformRoles(minPriority, transaction)` takes the floor as a parameter**, where the plan's §8.1 sketch showed `findPlatformRoles(transaction)` with `priority >= 70` inlined | The plan's own §6.3 forbids `role.repository.js` (an **auth**-module file) from knowing "the platform plane's priority windows". Both constraints cannot hold with a hard-coded 70, so the service passes `TIERS.WORKER` and the auth repository stays ignorant of the platform plane. Smallest change that satisfies the layering rule. |
| **I-2** | **#283 branch B splits on account status.** The plan's branch table left one state uncovered: an existing account that is `pending_verification` with no tenant membership and **no** staff-priority platform row — which is exactly the state a **revoked pending invitee** is in. Branch B as written requires `active`; branches C/D/E/F do not match it | The plan's own RS-9 requires re-inviting a revoked staff member to work. So branch B now decides `activation_required` from the **account** (`pending_verification` → `invited`, with an activation link; `active` → `granted`, no link), rather than from the branch. No new error code, no new outcome value, and the audit `details` shape is unchanged. Covered by *"a previously revoked staff member can be re-invited, and gets a NEW grant with activation"* in T-9. |
| **I-3** | `countStaffByRole` uses `fn('COUNT', col('id'))` where the plan's sketch wrote `fn('COUNT','*')` | `fn('COUNT', '*')` renders `COUNT('*')` — a string literal, not a row count. A correctness fix to pseudo-code. |
| **I-4** | #283's response omits `sessions_revoked` | The plan's §F3.3 contract does not list it, and acceptance criterion 11 requires the response to match that contract field for field. The grant branch still revokes sessions; the outcome is in the log, not the body. |
| **I-5** | **#283 no longer overwrites an existing surname.** The plan's branch B says "global profile upsert (only the name fields the request supplies)"; a literal `last_name: last_name \|\| null` would have written `null` whenever the invite form left the field blank | The global `user_profiles` row belongs to the **person**, not to the grant, so an invite that simply omits `last_name` must not destroy a surname already on it. `_buildProfileNames()` writes `last_name` only when the request carried the key; an explicit `""` is still treated as a deliberate clear (which is why the schema allows one), and `display_name` is always derived from the resulting pair so the three fields cannot disagree. Costs one extra read on branch B only. |
| **I-6** | **#283 branch C also reactivates a deactivated membership row**, not only when the role differs | The Phase 1 guard refuses a deactivated row, so re-inviting without reactivating it would hand the invitee a working password and no access — the exact stranding the plan's F5.7 wants prevented. Phase 2 never writes `is_active: false` (D-S8), so this only ever repairs a row some other agent left deactivated. #288 now applies the same check (`membership.is_active`) that the guard does, for the same reason. |
| **I-7** | **#283 sends no email when activation is required but the token store was unreachable** | With `activation_link: null` there is nothing actionable to send, and the alternative "sign in with your existing credentials" message would be actively misleading to an invitee who has none yet. The response still reports `activation_required: true`, `activation_link: null`, `email_delivered: false`, which is what tells the operator to re-invite. |

**Explicitly NOT done, per the plan:** the Phase 1 CLI was not refactored and its eligibility logic was not extracted into a shared helper (D-S2 — a break-glass tool must not share failure modes with the request layer it exists to rescue); `role_invitation_policies` was not extended (D-S6); `user_roles.is_active` is read and displayed but never written (D-S8); no role edit/delete, no staff suspend toggle, no permission matrix, no invitation-validate endpoint, no durable platform-invitation table, no email on role change or revocation.

---

## 7. Findings

| # | Finding | Severity | Owner / disposition |
|---|---|---|---|
| **F-5** | `src/modules/organization/services/invitation.service.js:334, :351, :521` prints **raw invitation tokens** to stdout on every tenant invite and resend, where PM2's logs keep them well past the 48-hour TTL | MEDIUM | **Not fixed** — tenant-plane business logic, queued under master **D-4**. Phase 2 does not copy it: no platform code path logs a token, a hash or a link, and T-9/T-11 capture `console.log/warn/error/info/debug` across the whole invite and activation paths and fail if the token or the link appears in any argument. |
| **F-6** | Phase 1's per-file `requirePlatformRole` assertion blocked the public #288 and was too loose besides | MEDIUM | **Fixed in this phase** as T-5′ (§5). |
| **F-7** | No API in phases 2–11 can move a `users.status` out of `suspended`/`blocked`/`inactive`, so a platform staff member suspended by other means cannot be re-enabled | INFORMATIONAL | **Documented** (plan EC-S19). #282 shows the status so the condition is diagnosable; #283 refuses such an account with `USER_NOT_ELIGIBLE`. The remedy is an auth-module feature or a database change. |
| **F-1** | `inbox.routes.js`, `notification.routes.js`, `notification_device.routes.js` list `admin`/`super-admin` in `authorize()` with no feature gate | LOW | **Carried forward unchanged** (master D-4). Phase 2 makes it matter more — it is the first phase that mints `admin`-role tokens, where Phase 1 only created `super-admin`. The `md_updates` record repeats the "do not call these from the console" warning. T-5's assertions still pin the behaviour. |
| **F-2 / F-3 / F-4** | `npm run cap:task-emails` points at a missing file · `00074` passes an ignored `order` to `addIndex` · `requireFeature` resolves the org from `req.body` as a last resort | LOW / COSMETIC / LOW | **Carried forward unchanged** (master D-4). Phase 2 adds no controller that reads tenant scope from anywhere, so it cannot be what breaks T-5's body-scope scanner. |

One finding of my own, raised during implementation and already fixed in the tests rather than the code: **double-mocking the same method in one `node:test` file leaves the first stub installed after `mock.restoreAll()`** (the second mock captures the first as its "original", and restore order reinstates it). It cost one false failure in T-7 and is noted in that file so the next author does not repeat it.

---

## 8. Rollback

**Remove the two mount lines in `platform.index.js`.** The seven routes disappear.

**What rollback does NOT do: it does not un-grant anyone.** Every row Phase 2 created — staff memberships in `user_roles`, custom roles in `roles`, audit rows — stays valid and keeps working, because they are ordinary rows in pre-existing tables that the **Phase 1 guard** already understands. A custom role at priority 85 continues to confer ADMIN-tier authority after a Phase 2 rollback, because the guard, not the endpoint, is what confers access.

To actually remove someone's access, use #285 while it is deployed, or `npm run platform:grant-super-admin` plus a database change afterwards.

Redis keys (`platform_invite:*`, `platform_invite_target:*`, `platform_invite_blocked:*`) all carry a 48-hour TTL and expire on their own; no cleanup is needed.

---

## 9. Verification performed

* `npm test` at Step 0 and three times after; final run **4,316 / 4,316, 0 failures, 0 skips, exit 0** (§3).
* `node --test tests/unit/platform/*.test.js` → **217/217, 0 skipped**, on every run.
* `node --check` on every new and every modified `.js` file.
* **Route-mount smoke test:** `platform.index.js` mounted into a bare Express app lists exactly the eight expected routes (#281 plus #282–#288) and raises no boot-time error — which also proves every `requirePlatformRole(TIERS.…)` argument passed the Phase 1 guard's require-time integer-tier check.
* **Prohibition greps:** no `requireActiveOrg` / `requireFeature` / `requireSubscription` / `req.user.orgId` in any platform code path (only in comments explaining why); no audit `action`/`target_type` passed as a literal rather than an `ACTIONS.*`/`TARGET_TYPES.*` constant; no `console.*` call receiving a token, hash or link; no Sequelize outside `repositories/`.
* `git diff --stat` reviewed line by line against the plan's §1.4 boundary statements: no migration, no seeder, no model, no change to any existing method or response shape.
* Column counts of the seven new `api_registry.md` rows checked against the section's 13-column header.

**A post-implementation review (§11) later captured the generated SQL offline and found five defects; the four SQL assumptions it confirmed are listed there.**

**Not verified, and it cannot be from here:** nothing was exercised against a live PostgreSQL or Redis instance, so the advisory lock's real contention behaviour, the partial unique index's real race behaviour and the actual SQL Sequelize emits for the `distinct`/`of:`-lock queries are asserted at the option-object level only. The first environment with `00089` applied should run one end-to-end pass: invite → activate → login → `/platform/me` → role change → revoke, and confirm five audit rows.

---

## 10. Phase 3

Unblocked and independent (master §10: P2 and P3 depend only on P1). The only shared file is `platform.index.js`, where each adds a mount line. Phase 3 will be the first phase to touch `authenticate` (suspension enforcement, master D-3); Phase 2 did not.

---

## 11. Post-implementation review (2026-11-17)

A production review of the delivered code, run after §9's verification, found **five real defects**.
All five are fixed, each with tests; the frontend-visible two are recorded in §6 of
`public/md_updates/2026-11-17_platform_staff_and_roles_api.md`. Nothing in §§1–10 above changed as
a result — no contract moved, no new file appeared, and the blast radius in §4 is unchanged.

| # | Severity | Where | Defect | Fix |
|---|---|---|---|---|
| **R-1** | **HIGH** | all five write controllers | **Express 5 leaves `req.body` undefined** unless `express.json()` actually parsed a JSON body, and `validateOrThrow` passes `undefined` through an object schema **without error** (the object itself is optional; only its keys are required). The service then destructured `undefined` → `TypeError` → **500 `INTERNAL_ERROR` plus a `system_error_logs` row**. On **#288** this is reachable **unauthenticated and unthrottled**: the rate limiter lives inside the service, past the destructure, so a bodyless `POST /platform/auth/accept-invite` was an error-log amplifier. | `req.body \|\| {}` at all five call sites → `400 VALIDATION_ERROR` |
| **R-2** | **HIGH** | `platform_admin.validator.js` | **An upper-cased UUID walked past `CANNOT_REVOKE_SELF`.** Joi's `guid()` accepts upper-case hex and returned it **unchanged**, while PostgreSQL compares `uuid` values case-insensitively — so `DELETE /admins/<OWN-ID-UPPERCASED>` compared `false` in JavaScript, skipped the self-revoke guard, and then matched the actor's own row in SQL. A super-admin could revoke themselves; recovery is CLI-only. (`LAST_SUPER_ADMIN` still held — its exclusion runs in SQL — so the set could not be emptied.) | `.lowercase()` on `userIdParamRule`, normalising the self-check, the audit `target_id` and every later phase at once |
| **R-3** | MEDIUM | `platform_auth.service.acceptInvite` | **Plane separation was enforced at invite time only.** #283 branch E refuses an address that belongs to an organization, but invite and activation are up to 48 hours apart and the tenant invite flow has no reverse guard. Activating anyway minted platform staff holding a tenant membership — forbidden by CLAUDE.md, and useless to its holder, because with more than one membership row `_generateLoginResponse` offers only the rows that **have** an organization, so the null-org row is dropped at login (master D-2). | Re-check `countTenantMemberships` inside the transaction → the same opaque `400 INVALID_INVITATION` |
| **R-4** | MEDIUM | `platform_admin.repository.findMembership` | **`SET LOCAL lock_timeout` leaks to later statements.** `SET LOCAL` lasts for the rest of the transaction, so the 3-second bound taken for the advisory lock also governs the `FOR UPDATE` on the membership row two statements later. A concurrent re-invite (#283 branches B and C lock the same row *without* taking the advisory lock) therefore made #284/#285 raise `55P03` instead of blocking — unmapped, that was a **500 for a plain lost race**. | Map `55P03` to the already-documented retryable `409 STAFF_CHANGE_IN_PROGRESS`, but **only when the read actually requested a lock** |
| **R-5** | LOW | `platform_admin.service._sendInviteEmail` path | The activation link was built by **string concatenation**, `${base}${configuredPath}`. Editing `configs/default.json` to `"platform/accept-invite"` (no leading slash) would silently produce `https://hostplatform/accept-invite` — a broken link emailed to invitees, with nothing in the logs, because the link is deliberately never logged. | Use the existing `buildFrontendUrl`, which joins with exactly one slash either way |

**Tests added: 9** new tests, plus missing-body rows folded into the four existing validation
tables. Platform suites **226/226** (from 217). Full suite re-run after every fix: **exit 0, zero
failures**, 4,356 dot-reporter events — which reconciles exactly to §3's 4,316-test / 31-suite
baseline plus these 9 tests (4,325 + 31). This run was clean on the first attempt, with neither of
the two environment-dependent flakes §3 records. R-2 is asserted through the
*controller*, because the normalisation is the validator's job and the service only ever sees what
it is handed.

### Reported, deliberately not fixed

* ~~**The `req.body` defect is codebase-wide.**~~ **Done — see §12.**
* ~~**`findStaffPage` and `countStaffByRole` read every `org_id IS NULL` row.**~~ **Done — see §12.**
* **`users_identifier_identifier_type_unique_idx` is case-sensitive** while the invite validator
  lower-cases the email. A legacy mixed-case `users.identifier` would be missed by branches E and F
  and a second account created for the same person. Pre-existing and repository-wide — the tenant
  invite flow behaves identically — so it is not Phase 2's to change.
* **`roleRepository.findById` is unused by Phase 2.** It is mandated by the plan (§8.1, table row
  18) and has a test, so it stays rather than being deleted as speculative surface.

### What this review added to §9's verification

The SQL Sequelize actually emits was **captured offline** (patching `sequelize.query` and
`QueryInterface.select`, no database needed) and read statement by statement. That confirmed four
assumptions §9 could only assert at the option-object level:

* `findStaffPage` emits **no subquery**, so `ORDER BY role.priority DESC, assigned_at DESC, id ASC`
  is applied **before** `LIMIT` — pagination is stable, which is the one thing a hoisted order
  would have broken silently.
* `distinct: true, col: 'id'` renders `count(DISTINCT("UserRole"."id"))` — **table-qualified**, so
  it is not ambiguous against the two joined tables' own `id` columns.
* `countTenantMemberships`'s `{ [Op.ne]: null }` renders **`IS NOT NULL`**, not `!= NULL` (which is
  always NULL and would have made branch E a no-op). This is branch E's whole load-bearing filter.
* `findMembership`'s lock renders `FOR UPDATE OF "UserRole"` — the joined `roles` row is not locked.

Still not verified from here: real lock contention, the partial unique index's real race behaviour,
and anything requiring a live Redis. §9's end-to-end recommendation stands unchanged.

---

## 12. The two carried items, now implemented (2026-11-17)

§11 deferred two items as out-of-boundary. Both were subsequently approved and are now done. They
are **two independent changes**, documented together only because they came from the same review.

### 12.1 The `req.body` defect, fixed centrally

`src/common/utilities/validator.utils.js` now normalises an absent payload to `{}` before
validating. That fixes R-1 for **all 374 `validateOrThrow` call sites in every module**, not just
the five platform ones.

**Why it is safe to do once, centrally.** Two properties hold across every call site, and both were
verified by enumeration rather than assumed:

* every schema handed to the helper is a Joi **object** schema — there is no top-level
  `Joi.array()`/`Joi.string()` validator anywhere in `src/`;
* every payload is `req.body`, `req.query`, `req.params`, `req[source]` (a dynamic `'body'`/
  `'query'` in five attendance route files) or a literal object — 359 of 374 matched by pattern, the
  remainder read by hand.

So `{}` is always the right stand-in for "the client sent nothing". `req.query` and `req.params` are
never absent in Express, which is why the change is observable **only** for a missing body.

**Only `undefined` and `null` are substituted**, deliberately not `|| {}`: `''`, `0`, `false`, `NaN`,
`[]` and a JSON string body must stay invalid against an object schema rather than quietly becoming
an empty one. A test enumerates all of them.

**What was deliberately NOT touched.** Eight controllers in the document and payroll modules already
guard their own call sites with `req.body || {}` — evidence this bug was hit and patched locally
before. They are now redundant but harmless, and they are in other modules' files. The five
platform guards stay for the same consistency reason, with their comments rewritten to point at the
central fix rather than restate it.

**Tests:** `tests/unit/system/validator_utils.test.js`, 10 tests, alongside the existing
`app_url.utils` and `email_utils` suites. It pins the new behaviour *and* the unchanged behaviour —
unknown-key stripping (the thing that makes mass assignment impossible), coercion, defaults, the
400/`VALIDATION_ERROR` envelope, first-message selection, and that the caller's object is not
mutated — because a regression in any of those would be far worse than the bug being fixed.

**Frontend record:** `public/md_updates/2026-11-17_missing_request_body_returns_400.md`. It is a
cross-module change, so it gets its own record rather than an appendix to the platform one. The one
case worth a client check is a `DELETE` that carries a body and omits `Content-Type`.

### 12.2 The platform staff scan, fixed with a partial index

**New migration `00090-add-platform-staff-role-index.js` — HANDED BACK UNRUN**, like `00089`:

```sql
CREATE INDEX IF NOT EXISTS user_roles_system_role_idx
  ON user_roles (role_id, is_active) WHERE org_id IS NULL AND deleted_at IS NULL;
```

`role_id` leads because the planner drives the join from `roles` — a handful of staff rows — and
probes `user_roles` by `role_id`. `is_active` rides along so #286's `WHERE is_active = true
GROUP BY role_id` can be served index-only instead of fetching each row from the heap to test one
boolean. `is_active` is **not** in the predicate: the staff directory must still show a deactivated
membership. The pre-existing non-partial `user_roles_role_id_idx` (migration 00004) is left alone —
it serves the tenant-plane lookups this phase does not touch.

**The index alone was not enough for #286.** `countStaffByRole` had no join at all, so its
`GROUP BY role_id` over every `org_id IS NULL` row would scan the whole user table regardless of any
index. It now carries the same `role.priority >= minPriority` inner join `findStaffPage` has, with
the floor passed in by the service (the repository owns role rows, not the plane's windows, §6.3).
`COUNT` had to become `COUNT("UserRole"."id")`: with the join present a bare `id` is **ambiguous
against `roles.id`** and Postgres rejects the statement. The generated SQL was captured offline and
read to confirm exactly that, plus that `attributes: []` keeps role columns out of a grouped
projection and that `GROUP BY` is table-qualified.

**No API contract changed.** `assigned_count` for every role in #286's response is identical — the
guest-role counts the old query computed were already discarded by the service, so nothing visible
moved. No `md_updates` record is required for 12.2.

**A second defect found while doing this.** A forgotten priority floor is **not** a harmless
omission: Sequelize renders `{ [Op.gte]: undefined }` as `>= NULL`, which matches no rows and raises
no error — so `countStaffByRole()` would have reported every role as having zero holders, and
`findPlatformRoles()` would have returned an **empty role catalog**, both silently. Both now reject
a non-integer floor with a loud programming error. Verified by rendering the SQL for
`{ [Op.gte]: undefined }` and reading the `>= NULL` it produces.

**Tests:** `tests/unit/platform/platform_staff_role_index_migration.test.js` (10 tests, static
verification against a recording `queryInterface`, following `platform_audit_log_migration.test.js`
— leading column, both predicates, idempotency, no `CONCURRENTLY` inside a transaction,
reversibility, rollback on failure) plus 4 tests in `platform_role_service.test.js` for the new join
and the two floor guards.

### 12.3 Numbers

Platform suites **239/239**. Full suite after both changes: **4,348 / 4,348 pass, 0 fail, 0 skipped,
exit 0** (spec reporter, 220s). That is +23 on the 4,325 standing after §11's fixes, which
reconciles exactly to the 23 tests added here: 10 in `validator_utils.test.js`, 10 in
`platform_staff_role_index_migration.test.js`, and 3 in `platform_role_service.test.js`. Clean on
the first attempt — neither of the two environment-dependent flakes §3 records appeared.

The full-suite run is the real gate for 12.1: the central validator change is in the request path of
every module, so a regression would surface somewhere in those 4,348 tests rather than in the
platform ones.

### 12.4 Still open, and why

* **`CREATE INDEX` is not `CONCURRENTLY`**, because every migration in this project runs inside a
  transaction and `CONCURRENTLY` is illegal there. At current table sizes the brief lock is fine; on
  a large `user_roles` the migration header carries the by-hand `CONCURRENTLY` statement to run
  instead, after which the migration is marked applied.
* **The query plan is not verified against a live planner.** Nothing here ran against PostgreSQL, so
  that the planner *chooses* the nested loop over `roles` is a reasoned expectation, not a measured
  fact. The first environment with `00089` and `00090` applied should run
  `EXPLAIN (ANALYZE, BUFFERS)` on #282's page query and #286's grouped count and confirm
  `user_roles_system_role_idx` appears in both plans. If the planner still prefers a scan, the
  fallback is to resolve the platform role ids first and filter `role_id IN (…)`, which forces the
  access path at the cost of one extra query.
* **Unrelated, found during the call-site survey, NOT fixed:** five attendance route files use a
  local `validate(schema, source)` middleware that does `req[source] = validateOrThrow(schema,
  req[source])`. For `source = 'query'` that assignment **silently does nothing** on Express 5 —
  `req.query` is getter-only, and assigning to it neither throws nor takes effect (confirmed by
  probe). Those routes therefore run on the raw query string, losing Joi's coercion and defaults.
  It is another module's business logic and outside this change; `hr_attendance_read.routes.js` is
  the one to look at first.
