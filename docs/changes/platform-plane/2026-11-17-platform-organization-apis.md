# 2026-11-17 — Platform Admin: tenant directory, organization detail & status control (#289–#291)

**Audience:** frontend engineers building the Platform Super Admin panel's Organizations area.
**Scope:** three **new** endpoints. No existing contract changes here — the tenant-visible side of
#291 is recorded separately in `2026-11-17_org_suspension_enforcement.md`, which the console team
should also read.

All three require a platform token and **ADMIN tier** (role priority ≥ 80: `admin`, `super-admin`,
or a custom platform role at 80–99). A `worker`-tier actor gets `403 FORBIDDEN`; a tenant token gets
`403 PLATFORM_ACCESS_REQUIRED`.

---

## 1. `GET /api/v1/platform/organizations` — directory

```
GET /api/v1/platform/organizations?page=1&limit=25&search=acme&status=active
      &plan_code=growth_yearly&created_from=2026-01-01&created_to=2026-03-31
```

| Param | Rule |
|---|---|
| `page` | integer ≥ 1, default 1 |
| `limit` | integer 1–100, default 25 |
| `search` | 1–255 chars. Matches org **name**, **key** and registered **profile name** as *contains*; matches **PAN** and **GSTIN** as an *exact, case-insensitive* value |
| `status` | `active` \| `inactive` \| `suspended` |
| `plan_code` | the live subscription's plan code |
| `created_from` / `created_to` | ISO dates, **each usable on its own**. `created_to` **includes the whole named day, interpreted in UTC**. An inverted range is `400` |

```json
{
  "success": true,
  "message": "Organizations fetched successfully",
  "data": {
    "pagination": { "total": 142, "page": 1, "limit": 25, "total_pages": 6 },
    "rows": [{
      "id": "550e8400-…", "name": "Acme Technologies Pvt Ltd", "key": "acme-tech",
      "status": "active", "created_at": "2026-03-15T08:30:00.000Z",
      "industry": "Information Technology", "size": "51-200",
      "city": "Pune", "state": "Maharashtra",
      "plan": {
        "code": "growth_yearly", "name": "Growth Plan (Annual)", "max_employees": 100,
        "current_period_end": "2027-03-14T23:59:59.000Z",
        "subscription_status": "active", "is_override": false
      },
      "usage": { "active_employees": 78, "seat_limit": 100, "quota_utilization_percent": 78.0 },
      "primary_contact": {
        "name": "Rajesh Sharma", "email": "hr@acme.com",
        "identifier": "hr@acme.com", "identifier_type": "email",
        "phone": "+91 98765 43210"
      }
    }]
  }
}
```

### Nulls you must render, because each is a real state

| Field is `null` | Meaning | Suggested display |
|---|---|---|
| `plan` | no live subscription — expired, or `inactive` before payment | "No active plan" |
| `usage.seat_limit` and `usage.quota_utilization_percent` | the plan has **no ceiling**, or there is no plan | "Unlimited" / "—". **Never** render `0` or a progress bar at 0% |
| `primary_contact` | the organization has **no active HR member** | "No HR contact" — worth flagging in the UI; it is a real operational problem |
| `industry`, `size`, `city`, `state` | the organization has no profile row yet | "—" |

`usage.active_employees` of `0` here **is** a count (the organization genuinely has no active
employees) — unlike on #290, where `null` means "could not be counted".

`is_override: true` marks a subscription granted by platform staff rather than paid for.

### `primary_contact`: render `identifier`, not only `email`

`users.identifier` holds an **email or a phone number**, depending on how that person signed up.
So:

* **`email`** is populated only when `identifier_type === "email"`. For a phone-identified HR it is
  **`null`** - it is not an email address and must not be rendered as a `mailto:` link.
* **`identifier`** is the account's login identity whatever its kind, and **`identifier_type`** is
  `"email"` or `"phone"`.
* **`phone`** is a different field: the HR's *profile* phone number, which an email-identified HR
  may also have.

Render the contact from `identifier` + `identifier_type`, and use `email` only to decide whether a
mail link is appropriate. Showing a blank contact for a phone-identified HR (which keying off
`email` alone would do) hides a real person from the operator.

## 2. `GET /api/v1/platform/organizations/:orgId` — detail

Returns `organization`, `profile`, `subscription`, `limits_audit`, `usage`, `setup`,
`recent_subscription_events`, `recent_audit_logs`, and `unavailable`.

**Three things to design for:**

**(a) `unavailable: []` — partial cards are normal.** Every panel except `organization` is fetched
best-effort. A panel whose query fails comes back `null` and its name appears in `unavailable`.
Render those sections as "temporarily unavailable" rather than as empty data — the deliberate
choice is that a broken organization still produces a usable card, because that is the organization
support most needs to see.

```json
{ "setup": null, "recent_audit_logs": null, "unavailable": ["setup", "recent_audit_logs"] }
```

**(b) `usage` nulls mean "not counted", not "zero".** If `active_employees` is `null`, the count
failed; do not render "0 employees".

**(c) `subscription.is_live`.** `false` means there is no live subscription and you are looking at
the **latest terminal row** — show it as history ("Expired on …"), not as the current plan.
`subscription` itself is `null` only when the organization has never had one.

**`setup` is `null` for an `inactive` organization**, and that is not a failure - it will not be
listed in `unavailable`. An `inactive` organization never completed registration, so it has no
onboarding progress to report. Render "Not applicable" rather than "0% complete".

`limits_audit` exposes the subscription's frozen snapshot limits beside the plan's current limits
with a `drifted` boolean — useful as an operator warning ("this organization's plan was changed
after they subscribed"). `profile.logo_url` is returned **as stored** and is not a presigned URL, so
it may not be directly renderable depending on bucket policy. There is **no CIN field** — the column
does not exist in the schema.

## 3. `PATCH /api/v1/platform/organizations/:orgId/status` — suspend / reactivate

```json
{ "status": "suspended", "reason": "Payment default on annual invoice INV-2026-89" }
```

* `status` — **`active` or `suspended` only**. Sending `inactive` is a `400`.
* `reason` — **required**, 5–500 characters. It is written to the append-only platform audit ledger,
  so tell operators it is permanent and attributable.
* **Send `Content-Type: application/json`.** A bodyless request is a `400`.

```json
{
  "success": true,
  "message": "Organization suspended successfully",
  "data": {
    "org_id": "550e8400-…", "changed": true,
    "previous_status": "active", "status": "suspended",
    "enforcement": "Tenant users are rejected on their next API request. A request already in flight completes."
  }
}
```

**`changed: false`** means the organization was already in that state: still `200`, nothing was
written, no audit entry. Safe to retry — a repeat after a timeout converges rather than
double-suspending. Use `changed` to decide between a success toast and a "no change" notice.

Echo the `enforcement` string to the operator: "instant" means *on the tenant's next request*, and
an operator watching a suspended user's current page not break immediately needs to know that is
expected. **Reactivation requires no re-login** by the tenant's users.

| Code | HTTP | Meaning |
|---|---|---|
| `ORG_NOT_FOUND` | 404 | refresh the directory; the id is wrong or gone |
| `ORG_NOT_PROVISIONED` | 409 | the organization is `inactive` — registration was never completed. No retry; it must be provisioned instead |
| `ORG_STATUS_CHANGE_CONFLICT` | 409 | a concurrent change won the race. **Retry once** |
| `VALIDATION_ERROR` | 400 | bad status, missing/short `reason`, malformed `:orgId`, or no JSON body |

## 4. Not in this release

`engagement` fields and the `engagement=dormant` filter on #289, organization **editing**,
organization **deletion**, direct **provisioning**, plan **overrides** and quota changes. Do not
send `engagement` or `dormant_days` to #289 yet — unknown query params are ignored, so the request
would succeed while silently returning unfiltered results.
