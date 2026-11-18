# 2026-11-17 — Suspended organizations are now rejected on every tenant API (ACTION REQUIRED)

**Scope:** every authenticated tenant API, and `POST /api/v1/auth/login`.
**Type:** new terminal 403 on existing endpoints, plus a narrowed meaning for an existing code.
**Action required of the frontend:** yes — handle **`ORG_SUSPENDED`**. See §3.

This is the tenant-facing half of the new platform admin capability to suspend an organization. It
changes the behaviour of **existing** endpoints, which is why it has its own record.

---

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Any authenticated tenant API, organization **suspended** | mostly **200** — only the routes that happened to chain `requireActiveOrg` refused, with `403 ORG_NOT_ACTIVE` | **`403 ORG_SUSPENDED`** everywhere |
| `POST /auth/login`, user whose **single** membership is in a suspended organization | **200** + token | **`403 ORG_NOT_ACCESSIBLE`** |
| `ORG_NOT_ACTIVE` | meant "suspended **or** inactive" | means **`inactive` only** (registration incomplete / unpaid) |

```json
{
  "success": false,
  "message": "This organization has been suspended. Please contact support.",
  "errorCode": "ORG_SUSPENDED"
}
```

## 2. Why it changed — and the gap it closed

Suspension existed as a column value, but it was only enforced on **14 of the 55** route files that
authenticate. The other 41 — **attendance, leave, payroll, documents, inbox, notifications** — never
chained `requireActiveOrg`, so a suspended organization kept **full access** to all of them. The
check now lives in `authenticate` itself, which every one of them does chain.

It reads the organization's status that `authenticate` was **already fetching** on every org-scoped
request, so this costs no extra query and no added latency.

## 3. What the client must do

**Treat `ORG_SUSPENDED` as terminal for that organization.** Sign the user out of the org context,
show a suspension notice, and offer a support contact.

**Do not retry, and do not refresh the token.** The token is valid; the organization is not. Retrying
will produce the same 403 for as long as the suspension lasts, so a blanket retry-on-403
interceptor will loop.

Because it can arrive on **any** authenticated call, handle it in the shared HTTP interceptor rather
than per screen — the same place `TOKEN_REVOKED` is handled.

**Distinguish it from the two codes it is easy to confuse:**

| Code | Meaning | What the user should see |
|---|---|---|
| `ORG_SUSPENDED` | the platform team has locked this organization | "Your organization's access has been suspended. Please contact support." No self-service action exists |
| `ORG_NOT_ACTIVE` | registration was never completed / not paid | "Complete your registration" — route to checkout. This is now the **only** meaning of this code |
| `ORG_ACCESS_DEACTIVATED` | this *user's* membership was deactivated, the org is fine | "Your access to this organization was removed." Unchanged |

**At login**, a single-organization user now gets `403 ORG_NOT_ACCESSIBLE` — the code
`selectOrganization` has always returned for this condition, so if you already handle it on the
organization-switcher you may already be covered on the login screen too.

## 4. What did **not** change

* **Multi-organization users.** Login already filtered suspended organizations out of the selection
  list, and `selectOrganization` / `switchOrganization` already answered `ORG_NOT_ACCESSIBLE`. Such a
  user signs in and picks another organization, exactly as before. A user whose organizations are
  *all* suspended still gets `403 NO_ACTIVE_ORGS`.
* **`inactive` organizations.** The registration-to-payment flow is untouched: an `inactive`
  organization's HR can still sign in and still reach checkout. The new check fires on `suspended`
  only.
* **Reactivation needs no re-login.** The status is re-read on every request, so the moment the
  platform team reactivates the organization, existing tokens work again. There is **no** session
  invalidation and no forced sign-out to handle.
* Nothing about request shapes, fields, pagination or any other status code.

## 5. Timing, and the one operational caveat

Enforcement is **per request**: a request already in flight when the suspension commits completes
normally, and the *next* one is refused. In practice this is immediate, but a page mid-load may
finish rendering before the lockout appears.

**One known consequence, accepted for this release:** a suspended organization's HR cannot raise a
support ticket through the API either, because that route authenticates the same way. Suspended
customers must be contacted out of band.
