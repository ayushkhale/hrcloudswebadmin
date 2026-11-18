# Platform Admin Module — Phase 4 Hand-Back

**Phase:** 4 — Plan Overrides, Quotas & Direct Provisioning (M3, M2.4)
**Endpoints:** #292, #293, #294, #295 — all **SUPER_ADMIN**
**Plan:** `public/md_platform-admin/phases/phase4_implementation_plan.md`
**Date:** 2026-11-18
**Suite:** **4,611 / 4,611 pass · 0 fail · 0 skipped · 31 suites**

---

## 1. What was built

| Step | Item | Files |
|---|---|---|
| 1 | `applySnapshotOverrides` + two `EVENT_TYPES` | `billing/utils/plan_snapshot.utils.js` (+102), `billing/utils/billing_defaults.js` (+7) |
| 2 | `subscription_override.service.grant()` — the only non-payment subscription writer | `billing/services/subscription_override.service.js` (NEW, 330 lines) |
| 3 | **#292** plan override | `platform_subscription.{routes,controller,validator,service}.js` (NEW) |
| 4 | **#293** seat quota | same four files |
| 5 | **#294** direct provisioning | `platform_organization.{routes,controller,validator,service,repository}.js` (EXTENDED) |
| 6 | **#295** HR-invitation recovery | same |
| 7 | **D-1** snapshot-based seat enforcement + the raw-token log fix | `invitation.service.js`, `organization.service.js`, `subscription.middleware.js` |
| 8 | Documentation | `api_registry.md` (+59), `database.md`, 2 × `md_updates`, the SQL runbook, `.env.example` |

**No migration. No new table, column, index or environment variable** — exactly as the plan's §7
predicted, and as master §6.1 states. Phase 4 writes new *rows* plus one optional *key*
(`plan_snapshot.override`) inside existing JSONB.

### The shape of a grant, in one paragraph

A plan change is a **supersession**, never an in-place update: the live row is closed
(`status: 'canceled'`, `cancel_reason: 'superseded_by_admin_override'`, `ended_at`) and a new row is
inserted in the same transaction with its own frozen snapshot, `transaction_id NULL` and
`activated_by_user_id` set — the pair Phase 3's `is_override` already reads. One
`subscription_events` row and one `platform_audit_logs` row go in with it. No `transactions` row, no
invoice number, no proration, no tenant email.

---

## 2. Blast radius

```
NEW (platform plane)          platform_subscription.*  (4 files)
NEW (billing)                 subscription_override.service.js
EXTENDED (platform plane)     platform_organization.{routes,controller,validator,service,repository}
                              platform.index.js            +1 mount line
EXTENDED (billing utils)      plan_snapshot.utils.js       +102/-0   (purely additive)
                              billing_defaults.js          +7/-0     (purely additive)
CHANGED (tenant plane)        invitation.service.js        +31/-19
                              organization.service.js      +15/-8
                              subscription.middleware.js   +13/-10
```

**Phase 1, 2 and 3 code is untouched** apart from the two additive `platform_organization`
extensions and the one mount line. `git diff --numstat` still shows `auth.middleware.js` **25 0**
and `auth.service.js` **16 0** — Phase 3's D-3 suspension change is exactly as it was.

**Every other module is untouched:** checkout, settlement, webhooks, refunds, proration, the
lifecycle cron, attendance, leave, payroll, documents, tasks, notifications. The three tenant-plane
files above are the entire tenant-visible surface of this phase, and all three are the D-1 switch
the master plan assigned to Phase 4.

---

## 3. Test numbers

| Suite | Cases |
|---|---|
| `billing/plan_snapshot_overrides.test.js` (NEW) | 15 |
| `billing/subscription_override_service.test.js` (NEW) | 34 |
| `platform/platform_plan_override.test.js` (NEW) | 29 |
| `platform/platform_quota_adjust.test.js` (NEW) | 16 |
| `platform/platform_provisioning.test.js` (NEW) | 25 |
| `platform/platform_hr_invitation.test.js` (NEW) | 17 |
| `organization/snapshot_seat_limits.test.js` (NEW) | 21 |
| `platform/plane_separation.test.js` (+1 tier assertion) | 11 |
| `billing/plan_snapshot.test.js` (+1) | 7 |
| `billing/subscription_service.test.js` (+1) | 14 |
| `billing/subscription_lifecycle_service.test.js` (+1) | 10 |
| **Phase 4 total added** | **+161** |
| **FULL SUITE** | **4,611 / 4,611, 0 fail, 0 skipped, exit 0** |

Baseline before this phase was 4,450. Every pre-existing test still passes; exactly **one** had to
change, and §4 explains why.

### The assertions worth knowing about

- **Audit atomicity, once per mutation.** Force the audit insert to reject → the subscription or
  organization write rolls back. Master D-P6 as an executable claim, not a comment.
- **The close writes exactly three columns**, asserted by key set, and **never `canceled_at`** —
  `org_subscriptions_cancel_chk` would reject it (plan C-2).
- **Quota mode copies the period byte-for-byte**, including on an `in_grace` row whose period end is
  already in the past (EC-P10).
- **`source_transaction_id` survives two hops** — from a paid row, and from a prior override's own
  value (EC-P33).
- **The on-behalf actor shape** `{ id, orgId, role: 'hr' }` is asserted field by field, because a
  later refactor passing `req.user` instead would silently re-introduce `orgId: null`.
- **No secret anywhere:** the `inviteUser` stub returns `invitation_token: 'RAW-TOKEN-SHOULD-NEVER-LEAK'`
  and three tests assert that string appears in neither the response nor any audit row. A fourth
  scans `invitation.service.js`'s own source for token interpolation in log lines.
- **The decisive D-1 pair:** the same experiment run both ways — a snapshot ceiling *lower* than the
  plan row's, and *higher* than it — across all three call sites. Only one source can be in force,
  and these tests say which.
- **`#292` → the (N+1)-th invite is refused**, built from the real `applySnapshotOverrides` output.
  Without this test, F3 and F7 could both pass in isolation while the feature did not work.

---

## 4. The one pre-existing test that had to change

`tests/unit/organization/role_switch.test.js` — **T-RS-10** ("exceeding the seat limit throws
`LIMIT_EXCEEDED`"). Its fixture stubbed a subscription with **no `plan_snapshot`** and supplied the
ceilings through `subscriptionPlanRepository.findById` — i.e. it encoded the *old* source of truth.
After F7 the limits come from the snapshot, the absent snapshot reads as "unlimited", and nothing was
refused.

Fixed by moving the ceilings onto the stubbed row's `plan_snapshot` **and** replacing the plan-row
stub with one that **throws** — so the test now fails if anything on this path ever consults the plan
catalogue again. The test's intent (capacity 2 managers, 2 in place, refuse) is unchanged.

That one test is also the measurement of F7's blast radius: of 4,450 pre-existing cases, it was the
only one that depended on enforcement reading the live plan row.

---

## 5. Found during implementation, and fixed

| # | What | Where |
|---|---|---|
| **1** | **A fourth raw-secret log line.** The plan named three (`invitation.service.js:334, 351, 521`). A fourth, `[EMAIL DISPATCH] Sent invitation to … Link: ${inviteLink}`, printed the full accept link — which embeds the token — on every **successful** send. Fixing only the three named lines would have left the exposure fully intact on the happy path | `invitation.service.js` |
| **2** | **A duplicate object key.** The provisioning profile literal set `org_name` twice (a sloppy spread ordering). Harmless by luck — both expressions computed the same value — and removed | `platform_organization.service.js` |
| **3** | **`applySnapshotOverrides` accepted a numeric string for `seats`.** `Number('12')` is an integer, so `'12'` would have been coerced silently. A numeric string here means the value reached the utility without passing the Joi schema, so the guard is now type-strict and says so | `plan_snapshot.utils.js` |
| **4** | **Two Joi messages did not cover `number.integer`.** `max_employees: 12.5` answered Joi's default *"must be an integer"* instead of the project's wording. Both rules now carry the message | `platform_subscription.validator.js` |
| **5** | **The plan's own §F3.5 step 4 was not implemented by §F2.** A past `valid_until` was rejected by Joi (the HTTP surface) but not by the service, so an internal caller would have reached `org_subscriptions_period_chk` and produced a 500 for bad input. The guard now lives in `grant()` — the single chokepoint for #292 **and** #294 | `subscription_override.service.js` |

Two checks in my own verification script also failed on the first run and were **false negatives in
the checker**, not defects: an escaped apostrophe in a source string, and `readLimits(snapshot)`
written via a local variable rather than inline. Both patterns were corrected and re-run rather than
waved away.

---

## 6. Verification performed

**Automated**

- `npm test` → **4,611 / 4,611**, 0 fail, 0 skipped, exit 0. Run twice end-to-end.
- A 77-check structural verification script (requirement-by-requirement against the plan), covering:
  every file that must exist; no migration numbered 00091+; all four routes present and
  `SUPER_ADMIN`; the three Phase 3 routes still `ADMIN`; the close's exact column set; `transaction_id:
  null`; the transaction requirement; the row lock; the pending-checkout check; the 409 mapping;
  `dedupe_key: null`; no `transactions` row; no invoice allocation; all four audit actions used via
  constants and none as literals; `platform.constants` unmodified; `reason` required on all four;
  `expected_subscription_id` nullable-but-required; all three D-1 call sites reading the snapshot and
  no plan-row read remaining; orphaned imports removed; no `rawToken`/`inviteLink` in any log line;
  `SNAPSHOT_VERSION` still 1; neither new event type notifiable; four 13-column registry rows;
  `database.md`, the runbook marker and `.env.example`; and the four plane-isolation prohibitions
  across every file in the platform module.
- Module-load smoke check: `platform.index.js` and the three edited tenant files require cleanly —
  no circular-import breakage from the new cross-service edges.

**By hand**

- Read every constraint in migration `00065` before writing the close and the insert:
  `org_subscriptions_one_live_uidx`, `period_chk`, `cancel_chk`, `grace_chk`, and the `change_type`
  enum. The close's three-column shape is copied from `settlement.service.js:149-151`, the proven
  supersession.
- Confirmed `subscription_events.event_type` is `VARCHAR(50)` with **no** CHECK constraint
  (model + migration 00065:282), so the two new types need no migration.
- Confirmed seeder `003` permits `hr → hr`, which is what lets the on-behalf actor invite an HR.
- Confirmed `acceptInvitation` calls the **same** `_checkSubscriptionLimits` (line 622), so one
  change covers D-1's "at invite **and** at accept".
- Confirmed `req.subscription` has no readers anywhere in `src/`, which is what made the middleware
  edit low-risk.
- Probed Joi's real behaviour before writing the schemas rather than assuming it: `allow(null).required()`
  (null passes, absent fails), `date.greater('now')`, `.lowercase()` on a GUID and an email, the
  absent-vs-null key distinction, and what `stripUnknown` does to a `pattern()` object whose key
  fails the pattern (**it strips the key and `min(1)` then fails loudly** — nothing is silently
  ignored).

**Not verified, and it cannot be from here**

Nothing ran against a live PostgreSQL, Redis or SES. Specifically:

- **The constraints themselves.** `period_chk`, `cancel_chk`, `grace_chk` and
  `org_subscriptions_one_live_uidx` are reasoned about from the migration source and asserted at the
  payload level. The first environment with a database should run one override, one quota change
  during grace, and one provisioning, and confirm no check violation.
- **Real lock contention**, and therefore the `CONCURRENT_SUBSCRIPTION_MODIFICATION` branch, which is
  asserted only by stubbing a zero-row update.
- **An end-to-end provisioning**: #294 → the HR receives the email → accepts → becomes the org's HR
  → invites an employee → the (N+1)-th invite is refused at the granted ceiling. This is the
  acceptance test that matters most and it needs a live DB, Redis and a mail sink.
- **`PAYMENT_IN_PROGRESS` against a real pending Razorpay order.**
- Migration **`00089` is still UNRUN**, so no Phase 4 mutation can succeed anywhere yet: every one
  of them inserts its audit row inside the mutation's transaction, so each attempt fails atomically
  (and safely) until the table exists. This is the same gate Phases 1–3 handed back.

---

## 7. Deviations from the plan, and why

| # | Plan said | Implemented | Why |
|---|---|---|---|
| **1** | three raw-token log lines | **four** | §5 item 1 — the fourth printed the same secret on the success path |
| **2** | the service re-checks a past `valid_until` (F3.5/F3.6) | the check lives in **`grant()`**, not in the platform service | One guard at the chokepoint covers #292 *and* #294, instead of two copies that can drift |
| **3** | `platform_organization.validator` declares its own seat/validity rules | they are **imported** from `platform_subscription.validator` | #294 and #292 must validate these two fields identically; two copies is two chances for one to drift. The `:orgId` rule is likewise imported from Phase 3 rather than redeclared |
| **4** | — | `_computeSeatUsage` / `_projectSnapshotPlan` are called **across services** (`platform_subscription` → `platform_organization`) | The plan requires #289, #290, #292 and #293 to agree about what "120 %" means. One helper, used by all four, rather than a second implementation. Both are intra-module calls on a singleton; no Phase 3 file changed |
| **5** | — | `_assertNotPlatformStaff` reuses Phase 2's `_isStaffMembership` | The distinction that must not drift is "a `guest` row is **not** staff". One predicate, two endpoints |

Nothing else in the plan was altered, narrowed or widened. All sixteen plan decisions (D4-1 … D4-16)
are implemented as written, including the two conservative ones: `#292` is **allowed** on a
`suspended` organization (D4-15) and `#295` is **refused** on one (D4-16).

---

## 8. Backward compatibility

| Surface | Impact |
|---|---|
| #281–#291 (Phases 1–3) | **none**. #289/#290 render richer data for an overridden organization because they already read the row shape Phase 4 writes |
| Tenant billing reads (#225–#238) | **no contract change**. `GET /subscription` reports the overridden limits — same fields, different numbers, which is the point |
| Tenant invitation / accept / role switch | **behaviour change**: the enforced seat ceiling now comes from the snapshot. Identical for every organization whose snapshot matches its plan row. Recorded in `md_updates` and covered by 21 tenant-path tests |
| `requireSubscription` consumers | none — `req.subscription` has no readers |
| Checkout / settlement / webhook / refund | **untouched**. A grant writes no `transactions` row, so settlement's idempotent re-entry (keyed on `transaction_id`) cannot collide with one |
| Lifecycle cron | unchanged code. An override with `valid_until` expires normally; a perpetual one is never due (its `current_period_end` and `grace_ends_at` are both NULL and the query requires a non-null value in one of them) |
| Existing `plan_snapshot` rows | unchanged. `override` is absent and every accessor already tolerates that. `SNAPSHOT_VERSION` stays `1` |
| Error codes | ten new ones, all on new endpoints. No existing code changes meaning |

---

## 9. Deployment

```
1. Apply migration 00089 (and 00090)      ← HARD GATE: nothing in Phase 4 commits without 00089
2. Deploy F1 + F2 (dormant — nothing calls grant() yet)
3. Deploy #292-#295
4. Re-run the D-1 pre-flight reads (plan §2, PF-1/PF-2) and resolve every row
5. Deploy F7 (snapshot enforcement) + the log-line fix
6. (Separate operator decision) BILLING_PERIOD_ENFORCEMENT=true
```

**Before step 5**, run PF-1, PF-3 and PF-4 from the plan and confirm all three return **0 rows**.
PF-1's population is also visible in the UI: #290's `limits_audit.drifted` flags exactly those
organizations. An unresolved row means a tenant's enforced ceiling changes the moment F7 deploys.

**Step 6 has a consequence the owner must accept** (master D-1): turning the flag on also enables
period-based feature gating, so organizations on **expired** subscriptions lose feature access. It is
also what unlocks `custom_features` on #292; until then that payload answers
`409 FEATURE_OVERRIDE_UNAVAILABLE` rather than writing an entitlement nothing honours.

**Rollback.** F1/F2 and F7 are code-only reverts. #292–#295 are code reverts too, but **rows already
written stay** — a superseded subscription is not un-superseded by a deploy. The reverse operation is
another #292. That is inherent to an append-only billing ledger and should be understood before
release.

---

## 10. Two operational consequences worth knowing

**A perpetual grant cannot be cancelled by the tenant.** `subscription_management.cancel` refuses any
subscription whose `current_period_end` is `NULL` with `409 CANNOT_CANCEL_FREE_PLAN`
(`subscription_management.service.js:49`). So a client on a perpetual complimentary plan has no
self-service cancel; they must ask support, who moves them with another #292. This is the
pre-existing free-plan rule rather than something Phase 4 introduced — a perpetual grant simply looks
like a free plan to the billing module — but it is a direct consequence of choosing
`valid_until: null`, and the operator should know it before offering one.

The same rule is what makes the plan's **N-4** unreachable rather than merely unlikely: a perpetual
row can never carry `cancel_at_period_end`, because the only code that sets that flag refuses
perpetual rows outright. So a quota adjustment cannot produce "a cancellation that never matures".

**`#294`'s invitation audit row is the one Phase 4 write that is not atomic with what it records.**
It cannot be: the provisioning transaction has already committed by the time the invitation is
attempted, and the invitation owns its own transaction inside a tenant service. Its failure is
therefore logged and swallowed — failing the response would tell an operator that a successful
provisioning had failed. The next #295 writes the row. The *provisioning* audit row is never at risk;
it is inside the transaction.

---

## 11. Phase 5

Unblocked, with one dependency worth stating. Phase 5 (plan catalog) carries **EC-P18**: editing a
plan's limits or features while a plan has live subscribers is refused with
`409 PLAN_HAS_SUBSCRIBERS`, *because* the live-join path would retroactively change every
subscriber. **F7 removes that reason for seat limits** — enforcement now reads each subscriber's own
snapshot, so a limit edit no longer touches existing subscribers at all. Features are still
live-joined until `BILLING_PERIOD_ENFORCEMENT=true`, so EC-P18 should be relaxed for `max_*` and
**kept** for `feature_keys` until the flag flips. Phase 5 should make that split explicitly rather
than inheriting one blanket refusal.

Phase 5 should also reuse rather than re-derive:

- `subscriptionOverrideService.grant()` — nothing else may write a subscription without a payment.
- `applySnapshotOverrides` — the only sanctioned way to write the `override` block.
- The `expected_subscription_id` idiom for the write class the master plan assigns it to; Phase 5's
  plan edit uses `If-Match` instead, which is a different control for a different race.
- `platform_subscription.validator`'s `reasonRule`, `overrideSeatsRule` and `validUntilRule`.

Phase 8's revenue desk depends on two things this phase writes: `transaction_id IS NULL AND
activated_by_user_id IS NOT NULL` identifying a complimentary subscription, and
`plan_snapshot.override.source_transaction_id` keeping a paying customer in MRR after a seat-only
change (EC-P33). Both are covered by tests here.
