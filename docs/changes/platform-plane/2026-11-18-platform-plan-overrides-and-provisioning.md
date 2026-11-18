# 2026-11-18 — Platform admin: plan overrides, seat quotas and direct provisioning (#292–#295)

**Scope:** four NEW platform-plane endpoints. **Super-admin only** (role priority = 100).
**Type:** additive. No existing endpoint's request or response shape changes.
**Action required of the frontend:** new screens only. See §6 for the one field that is easy to get
wrong.

Platform Admin Module **Phase 4**. These are the two commercial operations the panel exists for:
change an organization's plan without a payment, and onboard a client directly.

---

## 1. The endpoints

| # | Method | Path | Purpose |
|---|---|---|---|
| **292** | POST | `/api/v1/platform/organizations/:orgId/plan/override` | Grant a plan, seats, validity and (gated) features without a payment |
| **293** | PATCH | `/api/v1/platform/organizations/:orgId/plan/quotas` | Change the employee seat ceiling only |
| **294** | POST | `/api/v1/platform/organizations` | Provision a tenant + subscription + first-HR invitation |
| **295** | POST | `/api/v1/platform/organizations/:orgId/hr-invitation` | Re-issue / re-send the first-HR invitation (recovery) |

All four chain `authenticate → requirePlatformRole(SUPER_ADMIN)`, require a **`reason` of 5–500
characters**, and write a `platform_audit_logs` row **in the same transaction as the change**.

## 2. #292 — plan override

```http
POST /api/v1/platform/organizations/550e8400-.../plan/override
{
  "plan_code": "growth_monthly",
  "override_seats": 200,
  "valid_until": null,
  "custom_features": { "payroll.access": true },
  "reason": "Enterprise pilot agreed with the client",
  "expected_subscription_id": "660e8400-..."
}
```

```jsonc
{
  "success": true,
  "message": "Plan override applied successfully",
  "data": {
    "org_id": "550e8400-...",
    "subscription": {
      "id": "…", "previous_subscription_id": "660e8400-...", "status": "active",
      "change_type": "upgrade", "is_override": true,
      "plan": { "code": "growth_monthly", "name": "Growth (Monthly)", "amount": "990.00",
                "currency": "INR", "billing_cycle": "monthly" },
      "current_period_start": "2026-11-18T10:00:00.000Z",
      "current_period_end": null,            // perpetual, because valid_until was null
      "grace_ends_at": null,
      "cancel_at_period_end": false,
      "limits": { "max_employees": 200, "max_managers": 10, "max_hrs": 3 },
      "feature_keys": ["attendance.access", "payroll.access"],
      "override": { "by_user_id": "…", "at": "…", "base_max_employees": 50,
                    "features_added": ["payroll.access"], "features_removed": [],
                    "source_transaction_id": null }
    },
    "superseded": { "id": "660e8400-...", "status": "canceled",
                    "cancel_reason": "superseded_by_admin_override",
                    "dropped": { "cancel_at_period_end": true, "scheduled_plan_id": null,
                                 "canceled_at": "…", "cancel_effective": "period_end",
                                 "cancel_reason": "too pricey" } },
    "usage": { "active_employees": 240, "seat_limit": 200, "quota_utilization_percent": 120 },
    "over_quota": true,
    "enforcement": "Seat limits apply from the tenant's next invitation. …"
  }
}
```

**Rules worth knowing before building the form:**

- **`valid_until` omitted ≠ `valid_until: null`.** Omitted = the plan's standard billing cycle;
  `null` = **perpetual** (no end date, never picked up by the expiry cron). A past date is a `400`.
- **`override_seats` omitted** keeps the plan's own ceiling, including `null` for an unlimited plan.
- **Seats below current headcount are allowed** and flagged `over_quota: true`. Nobody is removed;
  the tenant's next invitation is refused with the existing `403 LIMIT_EXCEEDED`.
- **Private plans are grantable** (that is what a private plan is for). Inactive ones are not.
- A **`suspended`** organization can still be overridden — status and billing are independent, and a
  billing dispute is often why it was suspended. An **`inactive`** one cannot (`409
  ORG_NOT_PROVISIONED`): use #294.
- An organization with **no live subscription** is fine: send `expected_subscription_id: null` and
  the grant is recorded as a `reactivation`.
- `superseded.dropped` reports the pending cancellation or scheduled downgrade the override
  replaced, so nothing is silently lost. Show it.

## 3. #293 — seat quota

```http
PATCH /api/v1/platform/organizations/550e8400-.../plan/quotas
{ "max_employees": 120, "reason": "Client bought 70 extra seats offline",
  "expected_subscription_id": "660e8400-..." }
```

Same response shape as #292. It changes **only** the employee ceiling and preserves the plan, its
price, its features, any earlier override's `base_max_employees`, the paying transaction's reference
and the **exact** period — which is why it **works during grace**. It also carries the tenant's own
`cancel_at_period_end` / scheduled downgrade forward: a support seat bump must not resurrect a
subscription the customer cancelled. `superseded.dropped` is therefore always `null` here.

`max_employees: null` ("make it unlimited") is **not** accepted — that is a plan decision, so use
#292 with an unlimited plan. Needs a live row (`409 NO_LIVE_SUBSCRIPTION`).

## 4. #294 — direct provisioning

```http
POST /api/v1/platform/organizations
{
  "key": "acme-india",
  "name": "Acme India",
  "plan_code": "growth_monthly",
  "override_seats": 80,
  "valid_until": null,
  "profile": { "industry": "IT", "city": "Pune", "gst_number": "27AAAAA0000A1Z5" },
  "hr_admin": { "email": "hr@acme.example", "name": "Asha Rao" },
  "reason": "Signed enterprise contract, invoiced offline"
}
```

Returns **`201`** with `organization`, `subscription`, `hr_invitation` and
`defaults: { leave_types: ["CO"] }`.

- **`key` is operator-supplied and required.** It is unique, and that is deliberate: a request that
  times out after committing can be retried safely — the retry answers `409 ORG_KEY_TAKEN` instead
  of creating a second tenant. Offer a slug field, pre-filled from the name, and treat
  `ORG_KEY_TAKEN` as "it already exists — check the directory" rather than as a validation error.
- **`hr_invitation.status` has three values:** `sent`, `email_failed` (the invitation exists, the
  email did not go out) and `failed` (no invitation was created). **All three return `201`** — the
  organization *was* created, which is what the status code describes. Both failure values are
  recovered with **#295**.
- `profile` accepts only `organization_profiles` columns; anything else is dropped.
- `custom_features` is not accepted here. Apply #292 straight afterwards if the client needs one.
- A platform staff email cannot be a tenant's HR administrator (`409 PLATFORM_STAFF_EMAIL`): the
  two planes never mix.
- **No invitation token or activation link is returned.** The HR admin receives it by email.

## 5. #295 — HR-invitation recovery

```http
POST /api/v1/platform/organizations/550e8400-.../hr-invitation
{ "email": "hr@acme.example", "name": "Asha Rao", "reason": "First invitation email bounced" }
```

Returns `hr_invitation: { email, status, mode, invited_at, error_code }` where `mode` is `invited`
(a new invitation) or `resent` (the existing one's token was rotated, which **invalidates the
previous link**).

Deliberately narrow, so the platform never takes over tenant HR operations:

| Response | Meaning |
|---|---|
| `409 ORG_HAS_ACTIVE_HR` | the organization already has an HR — invitations are theirs to send now |
| `409 ORG_SUSPENDED` | reactivate first; a suspended organization cannot accept an invitation |
| `409 ORG_NOT_PROVISIONED` | the organization never completed registration |
| `409 HR_INVITATION_PENDING` | an invitation is outstanding for a **different** address (`details.pending_email`). Re-send to that address or wait for the 48-hour expiry |
| `409 PLATFORM_STAFF_EMAIL` | that email belongs to the platform plane |

Errors from the tenant invitation flow itself (`DUPLICATE_MEMBERSHIP`,
`INVITATION_ALREADY_EXISTS`, `INVITE_IN_PROGRESS`, `403 LIMIT_EXCEEDED`) are surfaced unchanged.

## 6. `expected_subscription_id` — the one field that is easy to get wrong

It is **required as a key** on #292 and #293, and `null` is a legal value meaning *"I believe this
organization has no live subscription"*. Omitting it is a `400`, on purpose: a forgotten field would
silently skip the concurrency check.

Send the `subscription.id` you read from `GET /platform/organizations/:orgId` (#290). If it no
longer matches the live row when the request lands, the answer is:

```json
{ "success": false, "message": "This organization's subscription changed while you were working on it. Reload and try again.",
  "errorCode": "STALE_SUBSCRIPTION", "details": { "expected": "…", "actual": "…" } }
```

**Treat `STALE_SUBSCRIPTION` as "reload, then decide again" — never as a reason to retry
automatically.** It is also what a double-submitted override produces, which is exactly the point:
the first one succeeded.

## 7. Error codes introduced

| Code | Status | Where |
|---|---|---|
| `STALE_SUBSCRIPTION` | 409 | #292, #293 |
| `PAYMENT_IN_PROGRESS` | 409 | #292, #293 — a Razorpay checkout is pending; retry once it settles or expires |
| `NO_LIVE_SUBSCRIPTION` | 409 | #293 |
| `CONCURRENT_SUBSCRIPTION_MODIFICATION` | 409 | #292, #293 — lost a race; retryable |
| `FEATURE_OVERRIDE_UNAVAILABLE` | 409 | #292 — see §8 |
| `UNKNOWN_FEATURE_KEY` | 400 | #292 — `details.keys` lists the offending keys |
| `ORG_KEY_TAKEN` | 409 | #294 |
| `PLATFORM_STAFF_EMAIL` | 409 | #294, #295 |
| `ORG_HAS_ACTIVE_HR` | 409 | #295 |
| `HR_INVITATION_PENDING` | 409 | #295 |

Reused unchanged: `ORG_NOT_FOUND` (404), `ORG_NOT_PROVISIONED` (409), `ORG_SUSPENDED` (409),
`PLAN_NOT_FOUND` (404), `LIMIT_EXCEEDED` (403), `VALIDATION_ERROR` (400).

## 8. `custom_features` is gated, and why

While `BILLING_PERIOD_ENFORCEMENT=false`, tenant feature access is resolved from the **live**
`plan_features` join, not from the subscription snapshot. A feature override written into the
snapshot would therefore appear on the customer's billing page and never actually be granted. #292
answers **`409 FEATURE_OVERRIDE_UNAVAILABLE`** rather than writing a promise the system will not
keep. Seat, plan and validity overrides work regardless of the flag.

Hide or disable the feature-toggle section of the override form until the flag is on. When it is,
unknown or inactive keys answer `400 UNKNOWN_FEATURE_KEY` with `details.keys`.

## 9. Tenant-visible side effect

Seat ceilings are now enforced from the subscription snapshot, which is what makes #292/#293 bite.
That is a change to existing tenant endpoints and has its own record:
**`public/md_updates/2026-11-18_snapshot_based_seat_limits.md`**.

## 10. What these endpoints deliberately do not do

- **No money moves.** No `transactions` row, no invoice, no proration, no refund. A complimentary
  grant can neither be blocked by nor block a paying customer's checkout.
- **No in-place plan swap.** A change closes the live subscription and inserts a new one, so every
  historical row — and every invoice quoting one — stays true. `#289`/`#290` already report such a
  row as `is_override: true`.
- **No tenant email.** A plan changed by support is a ledger event, not a notification; support is
  normally talking to the customer while doing it.
- **No `If-Match` header and no idempotency key.** `expected_subscription_id` and the database's
  one-live-subscription unique index do that job.
