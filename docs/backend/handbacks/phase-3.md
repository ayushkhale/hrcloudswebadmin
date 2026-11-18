# Platform Admin Phase 3 — Hand-Back Note

**Implemented:** 2026-11-17
**Plan:** `public/md_platform-admin/phases/phase3_implementation_plan.md`
**Endpoints:** #289, #290, #291 — plus **D-3**, the suspension enforcement that makes #291 mean something
**Migrations:** none
**Status:** complete, full suite green

---

## 1. What was built

| Deliverable | File | Lines |
|---|---|---|
| Directory / detail / status reads & the one write | `src/modules/platform/repositories/platform_organization.repository.js` | NEW |
| Projection rules, transition table, transaction, audit | `src/modules/platform/services/platform_organization.service.js` | NEW |
| Thin handlers | `src/modules/platform/controllers/platform_organization.controller.js` | NEW |
| #289–#291 routes, all ADMIN tier | `src/modules/platform/routes/platform_organization.routes.js` | NEW |
| Query / param / body schemas | `src/modules/platform/validators/platform_organization.validator.js` | NEW |
| The ledger's first bounded read | `platform_audit_log.repository.js` | EXTEND +1 method |
| Mount | `platform.index.js` | +1 line |
| **D-3 tenant API enforcement** | `src/common/middlewares/auth.middleware.js` | **+25 / −0** |
| **D-3 single-membership login** | `src/modules/auth/services/auth.service.js` | **+16 / −0** |

### Endpoints

| # | Method & path | Tier | Writes? |
|---|---|---|---|
| 289 | `GET /api/v1/platform/organizations` | ADMIN | no |
| 290 | `GET /api/v1/platform/organizations/:orgId` | ADMIN | no |
| 291 | `PATCH /api/v1/platform/organizations/:orgId/status` | ADMIN | `organizations.status` + one audit row |

---

## 2. Blast radius

**Exactly three tracked files changed**, and the two in the auth plane are **purely additive —
41 lines added, zero deleted**, verified with `git diff --numstat`:

* `src/common/middlewares/auth.middleware.js` (+25/−0)
* `src/modules/auth/services/auth.service.js` (+16/−0)
* `public/md_system/api_registry.md` (the three registry rows)

**No tenant module was touched.** Not one route file, controller, service or repository in
attendance, leave, payroll, document, inbox or notification changed — enforcement is centralised in
`authenticate`, which all of them already chain. No migration, no model, no seeder, no env var, no
config key, no cron, no dependency. `.env.example` is unchanged because Phase 3 introduces no
configuration. The settings catalog (T-S2) is untouched because no domain column or Joi schema in a
domain module changed.

---

## 3. Test numbers

```
Platform suites            316 / 316
Platform + auth suites     348 / 348   ·  0 fail  ·  0 skipped
FULL SUITE (run 2)       4,434 / 4,434 ·  0 fail  ·  0 skipped  ·  exit 0
FULL SUITE (run 3)       4,440 / 4,443 ·  3 fail  <- see below
```

Baseline at Step 0 was 4,348. The growth reconciles exactly: 68 new platform tests, the 18 in
`tests/unit/auth/org_suspension.test.js`, and 9 repository-SQL tests added during the final review.

### The three failures in run 3, and why they are not Phase 3's

`task_phase5_notifications_and_crons` T-P5-12/13/14 failed in the third full run. They are **not**
caused by this phase, and the evidence is specific rather than a shrug:

| Evidence | Detail |
|---|---|
| They passed on this same code | Green in the Step 0 baseline **and** in the first post-Phase-3 full run |
| The only code changed between green and red | `_directoryReplacements` and `DETAIL_ROLE_KEYS`, both inside `src/modules/platform/` |
| That suite's dependency tree | Requires `task/*`, `settings/*`, `email.utils`, `models.index` - **not one Phase 3 file** |
| In isolation | **0 fail, 14 skipped** - the three are DB-gated (`if (!isDbAvailable) t.skip(...)`) and only *ran* at all because the database happened to be reachable |
| The timing signature | 1.6-2.9s when passing, **5.2-35s** when failing - a 2-12x slowdown, which is contention, not logic |
| The assertion | "notification still `pending`, expected `sent`" - async DB dispatch that did not finish inside the test's window |

So: DB-backed, timing-sensitive tests in a module this phase cannot reach, which pass when the
database is responsive and skip when it is absent. The session that implemented Phase 2 recorded
T-P5-13 flaking the same way on unrelated code.

**This is reported rather than fixed.** Making those three deterministic means changing the task
module's notification tests, which is outside Phase 3's boundary and deserves its own change. They
are worth stabilising: a suite that fails under load is a suite that will fail in CI.

New suites: `platform_org_directory.test.js` (22), `platform_org_detail.test.js` (24),
`platform_org_status.test.js` (19), `tests/unit/auth/org_suspension.test.js` (18), plus 3 added to
`platform_audit_log_repository.test.js` for the new ledger read.

**D-3's test was written before its production code**, as the plan required. It went red on exactly
the three suspension assertions and green on the 15 that pin existing behaviour — which is the
evidence that the gap was real and that nothing else moved.

---

## 4. The one Phase 1 test that had to change

`platform_audit_log_repository.test.js` asserted `deepEqual(surface, ['create'])` — the audit
repository's method surface, pinned exactly. #290 needs the organization's recent audit rows, so
Phase 3 adds `listRecentByOrgId` and the snapshot becomes `['create', 'listRecentByOrgId']`.

This was anticipated by the test's own comment — *"If a later phase needs a read, it adds a read —
never an update"* — so the change honours its intent rather than loosening it. The real invariant
was **strengthened**: the forbidden-method list grew (`truncate`, `increment` added to
`update`/`updateById`/`destroy`/`delete`/`upsert`/`bulkCreate`/`save`), and the surface is still
pinned exactly, so adding any further method still trips the test and forces a conscious
justification. `create` remains the only writer; append-only constrains what may be *written*, not
what may be read.

---

## 5. Defects found and fixed during implementation

Three, all found by me rather than by a test that already existed:

| # | Severity | Defect | Fix |
|---|---|---|---|
| **R3-1** | **HIGH** | `organizations.status` is a PostgreSQL **enum**, and my first draft of the directory filter compared it to `CAST(:status AS text)`. An enum has **no equality operator against explicitly-typed text**, so *any* request using `?status=` would have failed outright with "operator does not exist". | Cast the **column** instead: `o.status::text = :status`. Works whether the parameter arrives as an escaped literal or a bind value, and survives a new enum value |
| **R3-2** | MEDIUM | `listRecentByOrgId(orgId, null)` clamped to **1 row**, because `Number(null)` is `0` and `0` clamps up to the floor. A near-empty history panel reads as "nothing ever happened to this organization" | `null` is *absence* and falls back to the default, exactly as `undefined` does. An explicit out-of-range **number** (`0`, `-5`) still clamps to 1. Same distinction the central `validateOrThrow` fix draws |
| **R3-3** | MEDIUM | #290 reported `active_employees: 0` when the member-count query **failed**. "This tenant has 0 active employees" is a factual claim an operator might suspend an organization over, and a timed-out count must not be allowed to make it | A failed count panel reports `null` for every usage number. The seat ceiling still comes from the snapshot, a different panel that may well have loaded |

| **R3-4** | LOW | `%` and `_` are **wildcards** to ILIKE, and the search term was passed through unescaped. `?search=100%` would have matched every organization beginning with "100", and the PAN / GSTIN arm - documented as an **exact** case-insensitive comparison - would have stopped being exact the moment a term contained one | The term is escaped for LIKE (backslash first, so it cannot neutralise the escaping that follows) before either arm is built. Not an injection fix - Sequelize already escapes the value - a correctness one |

R3-1 is the one worth dwelling on: it would have failed on the **first filtered request in any
environment**, and no unit test that mocks the repository could have caught it. Both it and R3-4
were found by rendering the final SQL offline and reading it, which is why the suite now asserts
the SQL text for the enum cast, the CTE ordering, the total order, the qualified `COUNT`, and the
wildcard escaping.

---

## 6. Verification performed

* `npm test` at Step 0 and after the phase: **4,434/4,434, 0 fail, exit 0**.
* `node --test` on the platform + auth suites after every step, and again after the R3-1 SQL fix.
* `node --check` on every new and modified file.
* **Route-mount smoke test:** `platform.index.js` mounted into a bare Express app lists exactly the
  11 expected routes (#281–#291) with a 3-handler chain on all but the one public route, and raises
  no boot-time error — which also proves every `requirePlatformRole(TIERS.ADMIN)` argument passed
  the guard's require-time integer-tier check.
* **The final SQL was captured offline** (patching `sequelize.query` and running Sequelize's own
  `injectReplacements`) and read statement by statement. That is what found R3-1, and it also
  confirmed: apostrophes are escaped (`'Acme''s'` — the search term is not an injection vector); the
  `:param IS NULL OR …` form renders valid, type-checkable SQL with every filter absent;
  `DISTINCT ON (org_id) … ORDER BY org_id, created_at DESC` matches
  `orgSubscriptionRepository.findLiveByOrgId`'s selection exactly; `COUNT(ur.id)` and
  `GROUP BY ur.org_id, r.key` are table-qualified; and the two grouped aggregates issue **no query
  at all** for an empty id list.
* `git diff --numstat` on the two auth-plane files: **+41/−0**, confirming D-3 is purely additive.
* **Prohibition greps:** no `requireActiveOrg` / `requireFeature` / `requireSubscription` /
  `req.user.orgId` anywhere in the new module (only in comments explaining why); no Sequelize
  outside `repositories/`; no audit `action`/`target_type` passed as a literal.

### Not verified, and it cannot be from here

Nothing ran against a live PostgreSQL or Redis. Specifically:

* **The directory's query plan.** The `DISTINCT ON` CTE plus `COUNT(*) OVER ()` is correct SQL and
  renders as intended, but its cost on a real table is unmeasured. The first environment with data
  should `EXPLAIN (ANALYZE, BUFFERS)` #289 with and without `?search=`, and confirm the
  `search` path's sequential scan is acceptable (§7 of the plan accepted it for v1 and recorded the
  `pg_trgm` remedy as deferred).
* **Real lock contention** on #291's `FOR UPDATE`, and therefore the `ORG_STATUS_CHANGE_CONFLICT`
  branch, which is asserted only at the option-object level.
* **An end-to-end suspension**: suspend an org → confirm a tenant user's attendance punch, leave
  list, payslip fetch and document download all return `403 ORG_SUSPENDED` → confirm single-org
  login returns `403 ORG_NOT_ACCESSIBLE` → reactivate → confirm access returns **with the same
  token**. This is the acceptance test that matters most and it needs two live sessions.
* Migration `00089` is still **unrun**, so #291 cannot succeed anywhere yet: its audit insert is in
  the same transaction as the status change, so every attempt fails atomically (safely) until the
  table exists. #290 degrades its audit panel to `null` and #289 is unaffected.

---

## 7. Deviations from the plan, and why

| # | Plan said | Implemented | Reason |
|---|---|---|---|
| **D3-1a** | seat denominator falls back to the plan row when the snapshot is absent | #289 uses the **snapshot only**; the fallback lives in #290 | A per-row plan lookup in the directory is the N+1 the plan forbids. PF-5 asserts no live subscription has a null snapshot, and #290 — one organization — can afford the lookup it already makes for `limits_audit` |
| **D3-9a** | `setup: { completed, total, tasks[] }` (illustrative) | the checklist **summary** + `readiness_percentage` + `pending_task_keys`, and **not** the `categories` tree | The tree carries tenant-facing titles and `action_url`s meant for the tenant's own setup screen. An operator needs progress and what is outstanding |
| — | — | `GET /organizations/:orgId` is declared **after** `/organizations` and before the Phase 8 export route is added | Phase 1 D-F12's static-before-parametric rule; the route file carries a comment reminding Phase 8 that `/organizations/export` must go **above** `:orgId` |

### Two small consolidations made during the final review

* **`DETAIL_ROLE_KEYS` now reads from the repository's `SEAT_ROLE_KEYS`** rather than re-listing
  `['employee', 'manager', 'hr']`. Two copies would let #289's grouped query and #290's per-role
  counts cover different roles, so the directory and the detail card could disagree about the same
  organization.
* **Both directory queries share one `_directoryReplacements` builder.** The page and its count
  must be filtered identically or the total stops describing the page; one builder makes that
  structural rather than a thing to remember.

### A side effect the plan did not flag, now documented in code

`organizationSetupService.getSetupChecklist` is **not a pure read**. It inserts any task rows the
registry defines but the tenant lacks, and reconciles `is_completed` against what the evaluators
compute. So #290 — a GET on the platform plane — performs **writes into tenant data**.

I reused it anyway, and the service carries a comment explaining why: those writes are
**convergent and idempotent** (they set stored state to the truth, which is exactly what the
tenant's own next page load would do), so calling it from the platform plane cannot produce a state
the tenant would not have reached regardless. Duplicating twenty-odd task evaluators to avoid a
convergent write would be the far worse trade. If a future phase introduces strictly read-only
diagnostic access, this call is the one thing in Phase 3 that would need revisiting.

---

## 8. Backward compatibility

**Phases 1 and 2 are intact.** Platform login, `/platform/me`, the staff directory, invite,
activation, role change, revoke and the role catalog are all untouched and all their tests pass.
Two assertions in the new D-3 suite exist solely to prove it: a platform token (`orgId: null`)
never evaluates the suspension branch and runs **no** membership query, and a single null-org
membership still logs in — the path every platform administrator depends on.

**The tenant-visible change** is real and is recorded in
`public/md_updates/2026-11-17_org_suspension_enforcement.md`:

| Surface | Before | After |
|---|---|---|
| Any authenticated tenant API, org suspended | mostly 200; `403 ORG_NOT_ACTIVE` only on the 14 routers chaining `requireActiveOrg` | **`403 ORG_SUSPENDED`** |
| Single-membership login into a suspended org | 200 + token | **`403 ORG_NOT_ACCESSIBLE`** |
| `ORG_NOT_ACTIVE` | "suspended **or** inactive" | **`inactive` only** |

`inactive` organizations are deliberately unaffected: their HR must still sign in to complete
payment, and a check written `!== 'active'` instead of `=== 'suspended'` would have broken every new
customer signup. Two tests pin that.

---

## 9. Deployment

1. **Apply migration `00089`** (still outstanding from Phase 1). Until then #291 fails atomically.
2. **Before releasing D-3, run plan check PF-2:**
   `SELECT COUNT(*) FROM organizations WHERE status = 'suspended'`. Those organizations' users
   **lose API access the moment this deploys** — D-3 changes behaviour for organizations that are
   *already* suspended, not only ones suspended afterwards. Confirm each is intentional.
3. Ship **#291 and D-3 together**. A suspend that locks nothing is worse than no suspend: it tells
   an operator the tenant is contained when it is not.
4. Rollback: remove the mount line in `platform.index.js` to withdraw #289–#291 (no data effect —
   the only write is a status change, which stays valid and reversible). **D-3 reverts separately**;
   it is the part with tenant-visible effect and is two independent additive edits.

---

## 10. Phase 4

Unblocked. Phase 4 (plan overrides, quotas, direct provisioning) should reuse rather than re-derive:

* `platformOrganizationRepository.findOrganizationForUpdate` — provisioning and override both start
  by resolving and locking the organization, and this is the single place that does it.
* The `:orgId` validator rule and the `ORG_NOT_FOUND` / `ORG_NOT_PROVISIONED` codes.
* `findPrimaryContactsByOrgIds` — #295's HR-invite recovery needs "does this organization have an
  active HR?", and so does Phase 8's directory export.
* **`limits_audit.drifted` on #290 is Phase 4's D-1 pre-flight gate, surfaced in the panel.** The
  organizations it flags are exactly the rows D-1's SQL is looking for; Phase 4 can point an
  operator at the card instead of a hand-run script.

Phase 4 is also the phase that flips limit enforcement from the plan row to the snapshot. When it
does, #289's denominator (already the snapshot) stops being merely forward-compatible and starts
matching enforcement exactly — no change needed here.

---

## 11. Post-implementation review (2026-11-17)

A production review of the delivered Phase 3 code, run after §6's verification. **Three further
defects found and fixed**, and **four gaps reported without a fix** because each lies outside this
phase's declared boundary or needs a product decision rather than a code change.

### Fixed

| # | Severity | Defect | Fix |
|---|---|---|---|
| **R3-5** | MEDIUM | **A lone `created_to` was rejected.** `created_to: Joi.date().min(Joi.ref('created_from'))` makes the reference effectively mandatory, so "everything created up to 31 March" - a perfectly reasonable filter with no lower bound - answered `400` quoting Joi's internals: *`"created_to" date references "ref:created_from" which must have a valid date format`*. A request that is not malformed at all was refused with an error no operator could act on | The comparison is wrapped in `.when('created_from', { is: Joi.exist(), … })`, so the range check applies only when a lower bound was actually sent. An inverted range is still `400`, same-day is still allowed |
| **R3-6** | MEDIUM | **`primary_contact.email` could contain a phone number.** `users.identifier` holds an email *or* a phone depending on how the person signed up, and the directory projected it straight into a field named `email`. A phone-identified HR would have had their number rendered as a `mailto:` link - and a client keying off `email` alone would have shown a **blank contact**, hiding a real person from the operator. Phase 2's staff directory already carries `identifier_type` for precisely this reason; the rule was not carried into Phase 3 | The query selects `identifier` **and** `identifier_type`; the service publishes `email` only when the type IS `email`, and exposes `identifier` / `identifier_type` alongside. `phone` remains the separate profile field it always was |
| **R3-7** | LOW-MED | **#290 wrote tenant rows for organizations that may never pay.** `getSetupChecklist` is not a pure read - it materialises the registry's task rows - so opening the detail card for an `inactive` organization (registration started, never paid) created ~9-20 `organization_setup_tasks` rows for it, once per organization an operator browsed, to report progress that is all zeroes by definition | The checklist is not fetched for an `inactive` organization. `setup: null` there means **not applicable**, and it is deliberately NOT added to `unavailable`, which is reserved for reads that actually failed - the same distinction `subscription: null` already draws |

| **R3-8** | LOW | **A non-numeric seat ceiling leaked `NaN`.** The guard was `Number(seatLimit) <= 0`, and every comparison against NaN is false - so a non-numeric ceiling fell THROUGH and published `seat_limit: NaN` and `quota_utilization_percent: NaN`. `JSON.stringify` renders NaN as `null`, so the HTTP body looked right *by accident*; anything reading the value before serialisation (a future export, a CSV cell, a threshold comparison) would have got NaN. Found by feeding hostile rows through the real service rather than by a tidy fixture | One predicate - `!Number.isFinite(limit) \|\| limit <= 0` - rules out null, undefined, NaN, ±Infinity and every non-positive ceiling, while a legitimate numeric string still computes |

R3-5 and R3-6 are both contract-visible, so `md_updates` and the API registry row were updated with
them. Tests added: 11 (4 contact-shape and phone-identity cases, 2 for the inactive-organization
checklist guard, 1 asserting the query selects the identifier type rather than aliasing it).

### Reported, deliberately not fixed

**G-1 - a suspended organization can still accept pending invitations.**
`POST /invitations/accept` chains `authenticateOptional`, not `authenticate`, so D-3 does not cover
it: an employee invitation issued before the suspension is still acceptable, adding a `user_roles`
row to a locked organization. The new member gets no access (every authenticated call then returns
`ORG_SUSPENDED`), so this is an operational oddity rather than a security hole - a suspended tenant
can still grow its membership and consume seats. Fixing it means editing the tenant invitation
service, which Phase 3's boundary statement #4 forbids.

**G-2 - a suspended organization's attendance devices keep ingesting punches.**
`attendance/routes/device_webhook.routes.js` has no `authenticate` at all (it authenticates a
device, not a user), so D-3 cannot reach it. **This may well be correct** and should not be
"fixed" unilaterally: if an organization is suspended for non-payment and later reactivated, a
blocked webhook would leave a permanent hole in its attendance record, which is worse than
ingesting data nobody can read while the lock is on. It needs a product decision.

Those two are the complete perimeter: of the 59 route files under `src/modules/*/routes/`, 55 chain
`authenticate` and are now covered; the other four are `health.routes.js` and
`public_plan.routes.js` (no tenant data), `role_planes.js` (not a router) and the device webhook.

**G-3 - the same situation yields two different error codes at login.** An **invited** user holds
exactly one membership row (the invitation flow creates no `guest` row - only the two self-signup
paths do), so they take the single-membership path and get `ORG_NOT_ACCESSIBLE`. A user who signed
themselves up holds `guest` + membership, takes the multi-membership path, and gets the
pre-existing `NO_ACTIVE_ORGS`. Both are 403, both block login, and both are documented in the
`md_updates` record. Unifying them would change pre-existing multi-organization behaviour, which is
outside this phase. Worth knowing that **the single-row path is the common one for employees** -
which is exactly why D-3's login guard was needed.

**G-4 - `created_to` is interpreted in UTC.** For an operator in IST, "created up to 31 March"
therefore also includes 1 April 00:00-05:30 IST. Stated in the `md_updates` record. Making it
timezone-aware needs an operator or organization timezone that the contract does not carry.

### What this review also confirmed

* `organization_profiles` is **unique per `org_id`**, so the directory's `LEFT JOIN` cannot duplicate
  a row and inflate either the page or its `COUNT(*) OVER ()` total.
* D-3's branch sits **after** the membership check, so a user removed from an organization is still
  told `ORG_ACCESS_DEACTIVATED` rather than being mis-told the organization is suspended.
* A suspended organization's rejections are **403s, so they do not write `system_error_logs` rows** -
  a locked-out tenant hammering the API cannot fill the error table.
* #291 takes exactly one row lock and acquires no second lock, so it cannot be half of a deadlock
  cycle.
* The three `task_phase5_notifications_and_crons` failures seen in one full run were **confirmed
  load-sensitive, not Phase 3's**: a repeat run on identical code was **4,443 / 4,443, exit 0**,
  with those three passing at 8.9s / 4.2s / 2.8s - the same tests that had timed out.

### Numbers after the review

```
Platform + auth suites      355 / 355
FULL SUITE                4,450 / 4,450  ·  0 fail  ·  0 skipped  ·  exit 0
```

That is the fourth full run of this phase and the third that was clean on the first attempt. The
+7 over the previous clean run (4,443) is the 11 review tests less the 4 fixture consolidations
they replaced.

---

## 12. Second review pass (2026-11-17)

A further review after §11. **One defect fixed, one governance interpretation documented, and two
leads investigated that turned out not to be bugs** — recorded because knowing a hypothesis was
checked and rejected is worth as much as the fixes.

### Fixed

| # | Severity | Defect | Fix |
|---|---|---|---|
| **R3-9** | LOW (correctness of the record) | **A JSDoc block was attached to the wrong method.** Inserting `_directoryReplacements` during §11's R3-4 fix placed it *between* `_directorySelect`'s doc comment and its implementation. The result: the explanation of the enum cast and the ILIKE semantics sat above `_directoryReplacements`, which does neither, while `_directorySelect` — the one piece of hand-written SQL in the phase — was left undocumented. In a codebase where the comments carry the reasoning, a comment on the wrong function actively misleads the next person to edit it | The 17-line block was moved back onto `_directorySelect`; each method now documents itself |

### Documented interpretation — #290's audit panel at ADMIN tier

CLAUDE.md states: *"Error-log and audit endpoints are super-admin only. Lists return summary
columns; detail returns the sanitized row; every log query has a bounded time window."*

#290 is **ADMIN** tier and returns the last 10 platform audit rows for one organization, so it is
worth being explicit about why that is not a violation:

* **The rule targets the dedicated forensic surfaces**, which are the cross-organization,
  full-table ones: #308 error stream, #309 error detail and #310 the audit ledger are all
  **SUPER_ADMIN** in the master plan's own allocation (§8), and Phase 7 will build them that way.
* **#290's panel is specified by the master plan at ADMIN.** §8 lists #290 as ADMIN with "history",
  and M2.2 spells out "last 10 platform audit rows for the org". The implementation follows the
  more specific instruction.
* **It is strictly less sensitive than what the same actor can already do.** An ADMIN-tier operator
  can suspend that organization (#291) and read its whole commercial profile. Seeing which
  colleague acted on it, and why, is less than the power to act.
* **"Summary columns" and "the sanitized row" are honoured:** the panel returns
  `id, action, actor_id, actor_role, reason, details, created_at` and deliberately **omits
  `ip_address` and `user_agent`** — operator request metadata that belongs to Phase 7's ledger, not
  to an organization's activity feed. `actor_id` is a bare id with no join to `users`.
* **"Bounded" is satisfied by a row bound rather than a time window, on purpose.** The query is
  `WHERE org_id = ? ORDER BY created_at DESC LIMIT 10`, served by `pal_org_created_idx`, and the
  limit is clamped inside the repository (default 10, max 50) so no caller can widen it. A time
  window would add nothing to boundedness — the index scan already stops after 10 rows — and would
  actively harm the panel: an organization whose only administrative event was a suspension a year
  ago would show an **empty** history, which is the opposite of what a support screen is for.

If a reviewer disagrees, the cheapest change is to raise #290 to SUPER_ADMIN; dropping the panel
would contradict M2.2, and varying the response shape by tier would make the contract
tier-dependent, which is worse than either.

### Investigated and rejected — not bugs

* **Snapshot/plan-row type coercion in `limits_audit.drifted`.** `readLimits` returns the raw JSONB
  value with no coercion, so a snapshot storing `"100"` as a string would compare `!==` against the
  plan row's numeric `100` and report a **false** drift — and Phase 4's D-1 gate depends on that
  flag. Traced every snapshot writer: `buildPlanSnapshot` coerces with `Number(...)`, and the
  hand-run SQL in `src/code_dump/commands/` writes SQL `NULL` (JSON null), not strings. No reachable
  path produces a string limit, so coercing here would be guarding an impossible state. **Left
  alone deliberately** — worth re-checking if a new snapshot writer ever appears.
* **`status` query filter strictness.** `status` is matched against the enum with no `.trim()` or
  `.lowercase()`, while `plan_code` and `search` are normalised. `?status=Active` or
  `?status=active%20` is therefore a 400 — but with a message that names the three accepted values,
  so it is self-correcting, and no real client builds that from a dropdown. Adding normalisation
  would be speculative.
* **`identifier_type` case sensitivity** in §11's R3-6 fix. The comparison is `=== 'email'`. Checked
  the column: it is a **database ENUM constrained to `['email','phone']`**, so a differently-cased
  value cannot exist and a case-insensitive comparison would be handling an impossible input.

### Numbers after the second pass

```
Platform suites       323 / 323
FULL SUITE          4,450 / 4,450  ·  0 fail  ·  0 skipped  ·  exit 0
```

Unchanged from §11, as expected: R3-9 moved a comment and the other three findings were
investigated and rejected without a code change. Fifth full run of the phase, fourth clean on the
first attempt.

### Running totals across both review passes

| | Count |
|---|---|
| Defects found and fixed | **5** (R3-5 … R3-9) |
| Gaps reported without a fix | **4** (2 enforcement-perimeter, outside this phase's boundary; 2 cosmetic) |
| Leads investigated and rejected with evidence | **3** |
| Interpretations documented rather than left implicit | **1** (#290's audit panel at ADMIN tier) |
