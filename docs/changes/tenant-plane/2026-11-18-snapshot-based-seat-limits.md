# 2026-11-18 — Seat limits are now enforced from the subscription snapshot, not the live plan

**Scope:** tenant invitation (`POST /users/invite`, invitation accept), HR role switch, and every
route chaining `requireSubscription({ checkLimit })`.
**Type:** behaviour change on existing endpoints. **No request or response field changes.**
**Action required of the frontend:** **no** — the error codes, statuses and payloads are identical.
Read §4 if your client caches plan limits from the plan catalogue.

This is the tenant-facing half of the platform admin capability to grant a seat quota without a
payment (platform `#292`/`#293`). It changes which **number** an existing check enforces, which is
why it has its own record.

---

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Employee / manager / HR seat ceiling at invite and at accept | the **live `subscription_plans` row** | the subscription's frozen **`plan_snapshot`** |
| The same ceiling on a role switch | live plan row | `plan_snapshot` |
| `requireSubscription({ checkLimit })` with `BILLING_PERIOD_ENFORCEMENT=false` | live plan row | `plan_snapshot` |
| `req.subscription.limits.features` (flag-off path) | `subscription_plans.features` (a legacy JSONB column) | the snapshot's `feature_keys` |
| An organization whose plan row was deleted | `500 PLAN_NOT_FOUND` | works — no plan read happens at all |

`403 LIMIT_EXCEEDED`, `400/402 NO_ACTIVE_SUBSCRIPTION` and `403 ORG_CONTEXT_REQUIRED` keep their
status codes, their error codes and their messages.

## 2. Why it changed

The tenant's own billing page (`GET /api/v1/subscription`) has **always** read `plan_snapshot` — it
is the historical-integrity mechanism the billing module is built on. Seat *enforcement* read the
live plan row. The two disagreed in two situations that matter:

1. **An administratively granted seat quota was displayed and then refused.** Support could raise an
   organization's ceiling to 200; the customer saw 200 on their billing page and the 51st
   invitation was still rejected at the plan's 50.
2. **Re-pricing or re-sizing a plan silently changed what existing subscribers were allowed.** An
   organization that bought 50 seats could find itself enforced at a new, lower number it never
   agreed to. The snapshot exists precisely so that cannot happen.

For every organization whose snapshot matches its plan row — which is the normal case, and was
verified to be **all** of them before this shipped — the enforced number is **unchanged**.

## 3. What a tenant can now observe

- A seat quota granted by support (`#292`/`#293`) takes effect on the **next** invitation. No
  re-login, no cache to clear.
- A seat quota **reduced** below current headcount does **not** remove anybody. Existing members
  keep working; the next invitation is refused with the usual `403 LIMIT_EXCEEDED`.
- The near-capacity notification (`billing.seat_limit_near_capacity`, fired at ≥ 90 % of the
  ceiling) now counts against the same snapshot ceiling, and names the plan from the snapshot — the
  same plan name the billing page shows.

## 4. If your client caches plan limits

Read limits from **`GET /api/v1/subscription`** (`subscription.plan.max_*`, or `usage.*.limit`),
never from the plan catalogue (`GET /api/v1/plans`). The catalogue describes what is on sale
**today**; the subscription describes what this organization actually bought, including any
administrative override. When an override is in force, `subscription.plan.override` is present and
carries `base_max_employees` — the plan's own ceiling — so a client can show both numbers if it
wants to.

## 5. What did not change

- Which subscriptions count as live for this check: still the organization's `active` row. An
  organization in `in_grace` or `past_due` is treated exactly as before.
- The role-switch gate's pre-existing pass-through: an organization with no live subscription row is
  still not blocked from switching a member's role.
- Feature entitlement. `entitlement.service` is untouched, and features still come from the live
  `plan_features` join while `BILLING_PERIOD_ENFORCEMENT=false`. That flag is the separate, later
  step (`D-1` step 3); platform feature overrides are refused with
  `409 FEATURE_OVERRIDE_UNAVAILABLE` until it is on, rather than being written and not honoured.

## 6. Files

- `src/modules/organization/services/invitation.service.js` — `_checkSubscriptionLimits`
  (covers both the invite and the accept gate; they share this method)
- `src/modules/organization/services/organization.service.js` — `_checkSubscriptionLimits`
- `src/common/middlewares/subscription.middleware.js` — the flag-off branch

Tests: `tests/unit/organization/snapshot_seat_limits.test.js` (21 cases, including the decisive
pair — a snapshot ceiling lower than the plan row's, and higher than it — run against all three
call sites).

## 7. Related, shipped at the same time

- `public/md_updates/2026-11-18_platform_plan_overrides_and_provisioning.md` — the platform
  endpoints that write these overrides (`#292`–`#295`).
- Raw invitation tokens and accept links are no longer written to the application log
  (`invitation.service.js`). No API behaviour changes; the invitee still receives the link by email.
