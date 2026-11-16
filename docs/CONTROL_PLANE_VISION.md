# HR Clouds — Control Plane

### A vision for the platform console above every organisation

**Status:** Draft for discussion · **Date:** 27 October 2026
**Scope:** The Super Admin console (this repository), the backend plane it needs,
and the roles that come after Super Admin.

---

## 0. The one-paragraph version

HR Clouds sells a workspace. A company signs up, invites its people, and runs
attendance, leave, payroll, documents and tasks inside four roles — employee,
manager, HR and guest. Every API in the product answers for *one* organisation.
That is correct for the product and insufficient for the business: nobody at HR
Clouds can currently answer "how many organisations do we have, how many people
have they added, which of them are about to churn, and did last night's payroll
jobs run for all of them?" without opening a database. **The Control Plane is the
plane above the product**: one console where HR Clouds sees every organisation at
once, acts on them deliberately, and leaves a record of having done so. This
document says what it should contain, what the backend must grow to support it,
and in what order to build it.

---

## 1. What exists today

Facts, not aspirations. Everything below was read out of the product repositories
(`../HR Clouds`, `../HR Clouds App/HRCloudsEmployee`) and
`public/ref docs/api_registry.md`.

### 1.1 The product

A React 18 SPA plus a React Native employee app, against a Node/Express API at
`/api/v1`. Eight functional modules:

| Module | What a customer does with it |
|---|---|
| **Organisation** | Register the company, invite people, set up departments, locations, HODs, org chart, company profile |
| **Attendance** | Web clocking, shifts and rotations, breaks, overtime, comp-off, regularisation approvals, trusted-device binding, biometric hardware webhook, GPS geofencing (Growth tier) |
| **Leave** | Policies and rules engine, assignment ledger, balances, accruals, sandwich rules, pro-rata, approvals, payouts |
| **Payroll** | CTC structures, attendance-driven unpaid-day deductions, PF/ESI/PT, TDS (old and new regimes), bank advice, payslips, loans, reimbursements, arrears, full-and-final settlements |
| **Documents** | S3 vault, policy publishing, acknowledgements, digital signatures, templates, dynamic letter generation, bulk issuance, offboarding archive |
| **Tasks** | Delegation to direct reports, SLA tracking, deliverable submission, review gate, comment threads, S3 attachments |
| **Settings** | A 138-key registry across five stores, with per-role catalogue metadata and change history |
| **Billing** | Razorpay checkout, prorated upgrades, cycle-end downgrades, 3-day grace, GST invoices, subscription event ledger |

Plus **Maya**, a conversational HR assistant, and a field-help (ⓘ) layer wired
into every form.

### 1.2 The roles

`super-admin` → `admin` → `hr` → `manager` → `employee` → `guest`, by privilege.
**Critically: `workspaceForRole()` maps super-admin, admin and hr all to the `hr`
workspace.** A `super-admin` today is not a platform operator — it is the most
privileged person *inside one customer organisation*. The role name is already
taken, and it means something else.

> **Naming consequence.** The platform role this console authenticates must not
> reuse the tenant `super-admin` string. It needs its own identity — a
> `platform_admin` on a separate principal table, with its own token audience.
> See §4.1. Until that exists, "Super Admin" in this console is a label for a
> person, not a claim the API can verify.

### 1.3 The commercial model

Six plans. Seat caps are frozen at purchase and enforced at invite time.

| | Free | Starter | Growth | Internal Unlimited |
|---|:--:|:--:|:--:|:--:|
| Price (INR) | ₹0 | ₹49/mo · ₹500/yr | ₹99/mo · ₹990/yr | ₹0 (private) |
| Employee seats | 10 | 20 | 300 | Unlimited |
| Manager seats | 2 | 5 | 10 | Unlimited |
| HR seats | 1 | 2 | 5 | Unlimited |
| GPS geofencing | — | — | ✓ | ✓ |
| Grace period | 3 days | 3 days | 3 days | 0 |

Yearly saves 17%. Upgrades are prorated and immediate; downgrades are scheduled
to cycle end and validated against current headcount. Every settled payment
produces a sequentially numbered GST invoice (`INV-YYYY-YY-XXXXXX`).

### 1.4 The machinery that runs overnight

This is the part nobody can currently see across organisations, and the part most
likely to fail quietly:

| Job | Schedule (IST) | What breaks if it doesn't run |
|---|---|---|
| Nightly status finalisation | 00:00 | Open sessions never close; attendance is wrong; payroll inherits it |
| Payroll auto-draft | 02:15 | No draft payroll waiting for HR |
| Document offboarding archive + letter auto-issue | 02:30 | Leavers keep obligations; exit letters never issue |
| Document sweeper (5 passes) | 03:45 | Retention breached; the only irreversible job of the night |
| PDF artifact sweeper + object verification | 04:00 | Lost S3 objects go unnoticed |
| PDF cache purge | 04:15 | Storage grows without bound |
| PDF render worker | every 15 min | Payslips and letters sit queued forever |
| Monthly leave accrual | 1st of month | Balances silently stop growing |

They "never rethrow" by design — which is right for resilience and **exactly why
a platform-level view of them is not optional.** A job that swallows its failure
and a job that succeeded look identical from outside.

### 1.5 The gap, stated plainly

- **No cross-organisation read exists.** Not one endpoint in the registry returns
  data about more than one org.
- **Billing is `hr`-only and tenant-scoped.** HR Clouds cannot see its own revenue
  through its own API.
- **There is no platform audit log.** Audit trails exist *within* a tenant
  (`attendance_logs` is append-only, subscription events are immutable). There is
  no record of HR Clouds acting *on* a tenant, because there is no way to do so.
- **There is no support path.** A customer reporting "payroll didn't generate"
  can only be helped by someone with database access.

---

## 2. What the Control Plane is for

Three jobs, in priority order. Every feature below earns its place by serving one
of them.

1. **See.** One honest picture of every organisation, what they are using, what
   they are paying, and whether the system served them last night.
2. **Act.** Do the handful of things only HR Clouds can do — suspend, reinstate,
   credit, extend, issue a private plan, flip a flag — deliberately, with a reason.
3. **Account.** Leave a record of every act, that no platform role can edit,
   because the power to see every customer's payroll is only acceptable if it is
   observed.

### Three principles

> **Read by default, write by exception.** Most of the console is a window. Every
> write is a named action with a reason, a confirmation, and an audit row. There
> is no "edit this org's data" screen, ever — if HR Clouds needs to change a
> customer's payroll, the customer needs a feature, not an operator with a cursor.

> **The tenant's consent is a real thing.** Impersonation is the sharpest tool
> here. It is time-boxed, logged, visible to the customer, and read-only by
> default (§3.4). A console that can silently become anyone has no honest story
> to tell an auditor.

> **Never invent a number.** An ops console that shows a plausible figure it
> could not compute is worse than one that shows nothing. Unknown reads **N/A**;
> a failed load reads **"Couldn't load"**, never "0" and never a dash.

---

## 3. What the Super Admin could have

Sections map 1:1 to `src/config/navigation.js`. **P0** = cannot operate the
business without it. **P1** = needed within two quarters. **P2** = the mature
console.

---

### 3.1 Organisations — *P0*

> *Every customer company on HR Clouds — who they are, how many people they have
> added, what they are paying and whether anything is wrong.*

**The list.** One scannable row per organisation: name, industry, headcount split
(employees / managers / HR), seat usage against the plan's frozen caps,
subscription state, setup-checklist completion, last activity. Filterable into the
queues an operator actually works — *needs attention*, *leaving*, *on Free plan*,
*stalled setup*, *near seat cap*. This is the only screen built today.

**The record.** Opening a row gives the whole customer in one inspector:

- **Who they are** — legal entity, GSTIN, locations, departments, the org chart's
  shape, owner and HR contacts, when they registered and through which flow.
- **What they are using** — which modules have ever been touched, and when. An org
  on Growth that has never run payroll is a different customer from one that runs
  it on the 28th every month. Adoption per module is the single best churn signal
  the platform has, and it is currently invisible.
- **How they are set up** — the org's own setup checklist (`/organizations/setup-checklist`
  already exists per-tenant), shift and leave policies configured, biometric
  devices registered, letter templates uploaded.
- **Their money** — current plan, renewal date, lifetime value, payment history,
  invoices, open dunning.
- **Their health** — last 30 days of background jobs for this org, failed renders,
  stuck queues, anomaly counts.
- **Their people, in aggregate only.** Headcount by department and location,
  joiners and leavers by month, role distribution. **Never a roster of names.**
  See §5.2.

**Actions** (each with a mandatory reason, each audited):

| Action | What it does | Guard |
|---|---|---|
| **Suspend** | Nobody in the org can sign in; data untouched | Typed confirmation of the org name |
| **Reinstate** | Restores access | — |
| **Extend trial / grace** | Pushes the cut-off date | Max extension per policy |
| **Issue private plan** | Assigns `internal_unlimited` or a bespoke tier | Two-person approval at P2 |
| **Transfer ownership** | Moves the owner role to another member | Both parties notified |
| **Schedule deletion** | Starts the contractual erasure clock | 30-day hold, reversible, never immediate |

> **Deletion is a scheduled state, not a button.** A customer's payroll records
> are statutory documents. Erasure runs on a clock the customer is told about,
> is reversible for its whole duration, and produces an export first.

---

### 3.2 Subscriptions — *P0*

> *Money across every organisation: what renews, what failed, what is in grace and
> what was refunded.*

The product has a complete billing engine. It has no business-side view of it.

**The picture.** MRR and ARR with their movement decomposed — new, expansion,
contraction, churn, reactivation — because "MRR fell 4%" is not actionable but
"two Growth-yearly orgs downgraded at cycle end" is. Plan mix, average revenue per
organisation, revenue per seat actually used (the gap between seats sold and seats
filled is the upsell map), cohort retention by signup month.

**The queues.** The operator's actual daily work:

- **Payments failed** — in the 3-day grace window, with hours remaining, the
  Razorpay failure reason, and the dunning emails already sent.
- **Renewing in 7 days** — especially large accounts and anyone whose card expires
  before the renewal date.
- **Cancelling at period end** — the window in which a save is still possible,
  with the cancellation reason the customer gave.
- **Seat-capped** — orgs whose next invite will be rejected. They want to pay more
  and the system is currently just saying no to them.
- **Webhook reconciliation** — Razorpay events the inbox received but could not
  match to a subscription. Silent money bugs live here.

**Actions.** Apply a credit, waive a charge, extend a period, refund a transaction,
force a plan change, retry a failed charge, regenerate an invoice. Each writes a
`billing_override` audit row carrying the operator, the amount, the reason, and
the before/after state. **Money actions over a threshold require a second
approver** (§5.4).

---

### 3.3 Plans & Pricing — *P1*

> *The catalogue itself — the tiers, their seat caps, and which capabilities each
> one unlocks.*

Today the catalogue is configuration in the backend. Changing a price is a
deployment. It should be an operation.

- **Edit a plan** — price, billing cycle, seat caps per role, grace period, public
  visibility, display order. Existing subscribers keep the terms they bought; a
  price change applies to new purchases and to renewals only after notice.
- **Private plans** — a bespoke tier issued to one named organisation. This is how
  enterprise deals happen without a code change, and it is why
  `internal_unlimited` already exists as a private catalogue status.
- **The capability matrix** — which features each plan unlocks, as the source of
  truth the product reads at runtime rather than a constant compiled into it. GPS
  geofencing is Growth-only today via such a check; recruitment (ATS) and
  performance/OKRs are on the roadmap and will need the same.
- **Coupons and trials** — a percentage or fixed discount, redemption limits,
  expiry, and which plans it applies to.
- **Change history** — who changed which plan, when, and what it was before. Pricing
  is the most consequential configuration in the business.

> **Prices are versioned, never overwritten.** An invoice issued last March must
> be reconstructible from the catalogue as it stood last March.

---

### 3.4 Support — *P1*

> *Seeing what a customer sees, safely, so a question can be answered in one call.*

The highest-leverage section and the most dangerous. It gets the most design.

**Impersonation, done properly.** A support operator can enter a customer
workspace as a named role to reproduce what the customer is describing.

- **Read-only by default.** A write-enabled session is a separate, rarer grant.
- **Consented.** The customer's HR admin approves the session — in-app, with a
  stated reason and duration. A break-glass path exists for a customer who cannot
  sign in at all; it requires two platform approvers and alerts the account owner
  immediately.
- **Time-boxed.** Sessions expire in minutes, not hours, and cannot be silently
  renewed.
- **Visible.** A persistent banner in the impersonated session says who is
  watching. The customer sees the session in their own audit trail, live and
  afterwards.
- **Recorded.** Every request made during the session is attributed to the
  operator, not to the impersonated user. `actor_id` and `on_behalf_of_id` are
  different columns and both are written.
- **Masked.** Even inside a session, salary figures, bank details and identity
  numbers are redacted unless the grant explicitly includes them. Most support
  questions are about a *workflow*, not a *number*.

**Diagnostics without impersonation.** Most tickets never need a session:

- The org's recent errors, from the existing error-logging layer, in plain words
  mapped through the product's own `*Errors.js` dictionaries.
- Its background-job history: did the 02:15 auto-draft run, did the render worker
  drain, did the accrual credit.
- Its webhook and device history: biometric punches received, Razorpay callbacks,
  push delivery failures.
- The settings that explain the behaviour — "payroll didn't include overtime"
  usually resolves to one of the 138 settings keys, and the console should say
  which one and what it is set to.

**Safe operator actions**, without entering the workspace at all: resend an
invitation, reset a member's MFA, unlock a locked account, re-queue a stuck PDF
render, re-run a failed job for one org, force a directory refresh.

**Tickets.** Each conversation links to its organisation, carries the diagnostics
gathered, and records what was done. At P2 this merges with whatever helpdesk the
business runs rather than replacing it.

---

### 3.5 System Health — *P0 for jobs, P1 for the rest*

> *Whether the background work every organisation depends on actually ran.*

§1.4 lists eight scheduled jobs that never rethrow. This section is the answer to
"did they work, for everyone?"

**The job matrix.** Organisations down one axis, nightly jobs across the other,
last N nights deep. A cell is ran / skipped / failed / *never started*. **The
fourth state is the one that matters** — a job that silently did nothing for one
org leaves no error anywhere, and today nothing would ever notice. Clicking a cell
gives the run: duration, rows touched, what it logged, and a re-run control.

**Queues.** Depth and age for the PDF render queue, the notification outbox and
the biometric log sweep. An ageing queue is the earliest honest signal that
something is wrong, and it precedes every customer complaint.

**Integrations.**

- **Biometric devices** — registered devices per org, last punch received, devices
  that have gone quiet. A device silent for three days is an attendance
  catastrophe building up.
- **Razorpay** — webhook delivery, signature failures, unmatched events.
- **S3** — upload and presign failure rates, the object-verification pass's
  `pdf.record.object_missing` findings, storage per org (and therefore cost per
  org).
- **Push and email** — delivery and bounce rates; a bounced invite is a customer
  who thinks the product is broken.

**Platform vitals.** API latency and error rate by endpoint family, database
connection and slow-query pressure, auth failure spikes, and per-org API volume —
which doubles as the fair-use and abuse signal.

> **This section earns its keep by being boring.** Its success condition is that
> it is empty, and that when it is not, HR Clouds knows before the customer calls.

---

### 3.6 Audit Log — *P0*

> *Every platform-level action, who took it, against which organisation and why.*

The product already believes in immutable records: `attendance_logs` is
append-only, subscription events are an immutable ledger, soft deletion preserves
history. The Control Plane must hold itself to the standard it holds its
customers to.

- **Append-only.** No platform role — including the highest — can edit or delete a
  row. Enforced in the database, not in application code.
- **Complete.** Every read of customer data, not only every write. "Who looked at
  this organisation's payroll?" is a question a customer is entitled to ask, and
  a console that can only answer it for writes is not actually accountable.
- **Attributed.** Actor, their role at the time, source IP, organisation acted on,
  action, before/after state, the reason given, and the correlation id tying it to
  the API request.
- **Legible.** Rendered in the product's own plain-language register (§6 of the
  product's house rules): "Priya suspended Nimbus Logistics because their payment
  failed twice", not `UPDATE org SET status=2`.
- **Exportable.** Filterable by actor, organisation, action and date; exportable
  for a customer's own auditor. **A customer should be able to request every
  platform action taken against them and receive it.** That is the promise that
  makes the rest of this console defensible.
- **Alerting.** Sensitive actions — impersonation, suspension, deletion, money
  overrides, plan edits — notify a second operator in real time.

---

### 3.7 Settings — *P1*

> *The switches that apply to everybody at once, and the people allowed to throw
> them.*

- **Feature flags.** Roll a capability out to one org, a named cohort, a percentage,
  or everyone — with an instant kill switch. The product ships large features
  (letter generation, task assignment, push notifications) in phases; today those
  phases are deployments. They should be flags.
- **Platform staff.** Create, suspend and offboard operator accounts; assign roles
  (§6); require MFA; review active sessions; enforce IP allow-lists for the
  dangerous capabilities.
- **Announcements.** A banner in the product for maintenance windows, incidents and
  releases — targeted by plan, role or org, with a start and end time.
- **Statutory defaults.** PF, ESI, PT and TDS parameters change by law and by state.
  The default an organisation inherits at registration belongs here, versioned by
  effective date, so a change does not retroactively rewrite last year's payroll.
- **Email and notification templates.** The platform-level transactional messages —
  invitations, dunning, grace-period warnings, renewal notices — with a preview and
  a test send.
- **Data retention.** Default retention windows new organisations inherit, and the
  erasure clock used by scheduled deletion (§3.1).

---

### 3.8 The sections after that — *P2*

Named so the shape of the mature console is visible, not specified in detail here.

- **Growth & Funnel.** Signups that never completed registration, where they
  abandoned, time-to-first-payroll, activation rate by acquisition source. The
  registration flow already has distinct initiate/verify stages — the drop-off
  between them is measurable today and measured by nobody.
- **Maya analytics.** What customers ask the assistant, what it could not answer,
  and which questions recur. This is a product-roadmap instrument: a question
  asked two hundred times is a missing feature or a missing ⓘ hint.
- **Field-help coverage.** The product requires every new surface to ship with its
  ⓘ help. A platform view of which surfaces lack it turns a house rule into a
  measurement.
- **Compliance centre.** Per-customer data-processing records, consent and DPA
  status, export and erasure requests with their clocks, sub-processor list.
- **Partners & resellers.** Agencies managing several client organisations — a
  partner identity that legitimately spans orgs, with its own scoped console.

---

## 4. What the backend must grow

The console cannot be built past its first screen without this. **This is the
critical path.**

### 4.1 A platform plane

A new route family, `/api/v1/platform/*`, with properties the tenant plane
deliberately does not have:

- **A separate principal.** Platform operators are not rows in a tenant's user
  table. Separate table, separate credentials, mandatory MFA, separate token
  audience. A tenant token must never satisfy a platform route, and a platform
  token must never satisfy a tenant route except through an explicit, logged
  impersonation grant.
- **Capability-based authorisation**, not role string comparison — so §6's future
  roles need no re-architecture.
- **Audited by middleware, not by discipline.** Every platform request writes its
  audit row in the request pipeline. If writing the audit row fails, the request
  fails. An operator must not be able to act without being recorded, and a
  developer must not be able to forget.
- **Rate-limited and IP-constrained** independently of tenant limits.

### 4.2 The reads

| Endpoint | Returns |
|---|---|
| `GET /platform/organisations` | Paginated list: headcount split, plan, seat usage, state, setup %, last activity |
| `GET /platform/organisations/:id` | The record of §3.1 |
| `GET /platform/organisations/:id/adoption` | Per-module usage and last-touched |
| `GET /platform/organisations/:id/jobs` | Background-job history for this org |
| `GET /platform/metrics/summary` | Platform totals — orgs, members, MRR, at-risk counts |
| `GET /platform/metrics/revenue` | MRR/ARR with movement decomposition |
| `GET /platform/subscriptions` | Cross-org subscriptions, filterable by state |
| `GET /platform/payments` | Cross-org transactions and their failure reasons |
| `GET /platform/jobs` | The job matrix of §3.5 |
| `GET /platform/queues` | Depth and age per queue |
| `GET /platform/audit` | The platform audit log, filtered |

**These must be aggregates computed server-side.** A console that fetches eight
hundred organisations to count them is a console that stops working at a thousand
customers. Pagination is keyset, as the product's settings history already is.

### 4.3 The writes

`POST /platform/organisations/:id/suspend` · `/reinstate` · `/extend` ·
`/schedule-deletion` · `/transfer-ownership`
`POST /platform/subscriptions/:id/credit` · `/refund` · `/force-change`
`POST /platform/plans` · `PATCH /platform/plans/:id`
`POST /platform/impersonation/request` · `/approve` · `/end`
`POST /platform/flags/:key/assign`

Every one takes a **mandatory `reason`** (minimum length, as the product already
requires for task cancellation and due-date extension) and is **idempotent under a
client-supplied key** — the pattern the Razorpay verification and biometric webhook
already use. An operator double-clicking "refund" must not refund twice.

### 4.4 The data the product does not yet record

Some of §3 cannot be built because nothing writes the underlying fact:

- **Per-module adoption.** Nothing records "this org used payroll on this date".
  A lightweight per-org, per-module, per-day activity roll-up is needed. It is
  cheap to write and it is the foundation of every churn and upsell signal.
- **Job outcomes per organisation.** The crons log; they do not write a queryable
  per-org run record. Without one, §3.5's fourth state — *never started* — is
  unknowable.
- **Cancellation reasons.** Captured at cancellation, or churn analysis is guesswork.
- **Registration funnel events.** The stages exist; the drop-off is not recorded.

> **Recommendation: build §4.4 first, or at least alongside.** These are small
> schema additions whose value compounds with every day they have been collecting.
> A metric you start recording in Q1 is a trend by Q3; one you start in Q3 is a
> number.

---

## 5. The hard parts

### 5.1 The `super-admin` name collision
`super-admin` already means "most privileged user inside one tenant" (§1.2).
Reusing it for a platform operator would make every authorisation check in the
product ambiguous — and ambiguous authorisation checks are how privilege
escalation happens. The platform principal needs its own name and its own table
before any platform route is written. **This is a blocking decision, not a
detail.**

### 5.2 Seeing customer data without becoming a liability
This console can see every organisation's payroll. The defence is layered:

- **Aggregates by default.** The organisation record shows headcount by department,
  never a roster of names.
- **Field-level masking.** Salary, bank details and identity numbers are redacted
  in the platform plane, period — a distinct grant unmasks them, and unmasking is
  itself an audited event.
- **Purpose binding.** A read of sensitive data requires a stated reason, exactly
  as a write does.
- **The customer can see what we saw** (§3.6).

> The product's own rule — **never show an ID** — applies here with more force,
> not less. A platform console is precisely where someone would be tempted to put
> a UUID column "just for support". It is also where a leaked screenshot does the
> most damage.

### 5.3 Multi-tenancy at the query layer
Every tenant query is currently scoped by the caller's `organization_id`. Platform
queries deliberately are not, which removes the safety net that has been silently
preventing cross-tenant leaks. Platform reads should go through a distinct data
access layer whose aggregate queries are reviewed as security-sensitive code, not
through the same helpers with the scope omitted.

### 5.4 Two-person integrity
Some actions should not be available to one person alone: deleting an
organisation, refunding above a threshold, granting write-enabled impersonation,
editing a live plan's price, or disabling the audit alerting itself. A request /
approve flow, with the approver notified and recorded, and **no self-approval**.

### 5.5 The console must survive the product's bad day
When the platform is degraded is exactly when this console is most needed. It
should fail soft — a section whose upstream is down shows "Couldn't load" and
leaves the rest usable — and its health reads should not share a connection pool
with the customer-facing API they are reporting on.

---

## 6. Roles after Super Admin

One role ships today. The capability model (`src/config/brand.js`) is already
written for more, so adding one is a map entry rather than a refactor.

| Role | Holds | Explicitly does not hold |
|---|---|---|
| **Super Admin** | Everything | — |
| **Support** | `orgs.read`, `support.impersonate` (read-only, consented), diagnostics, safe actions | Money, plans, suspension, platform settings |
| **Finance Ops** | `billing.*`, `plans.manage`, invoices, refunds within a limit | Impersonation, customer HR data |
| **Engineering / SRE** | `health.*`, queues, job re-runs, flags | Money, customer records, impersonation |
| **Compliance** | `audit.read`, export and erasure requests, retention policy | Any write against a customer |
| **Read-only / Executive** | Aggregate metrics and dashboards | Every per-customer detail and every write |

Two rules that make the model hold:

1. **A capability a role lacks is absent, not disabled.** The product's rule; the
   console enforces it in `DashboardLayout` already. Never render a control that
   would 403 on press.
2. **Capabilities compose; roles do not nest.** Support is not "Super Admin minus
   things" — it is its own list. Subtractive role definitions drift into
   over-permission one exception at a time.

---

## 7. Delivery sequence

Each phase ends somewhere worth stopping. Sizes are relative, not estimates.

### Phase 0 — Foundations *(blocking, small)*
Platform principal and auth (§4.1 · §5.1). Audit middleware (§3.6) — **before the
first platform endpoint, not after**. The activity roll-up and per-org job records
(§4.4). Capability map wired end to end.
**Done when:** an operator can sign in against a real platform identity and every
request they make is recorded.

### Phase 1 — See *(P0, medium)*
`GET /platform/organisations` + `/metrics/summary`. The Organisations list and
record. Replace this console's sample data with real reads.
**Done when:** HR Clouds can answer "how many organisations, how many people, who
is at risk" without a database client. *This is the phase that pays for itself.*

### Phase 2 — Money *(P0, medium)*
Cross-org subscriptions, payments, revenue movement. The failed-payment,
renewal and cancellation queues. Credits, refunds and extensions with two-person
integrity.
**Done when:** a failed renewal is noticed and worked the same day it fails.

### Phase 3 — Health *(P0, medium)*
The job matrix with its *never started* state. Queue depth. Integration status.
Alerting on silent failure.
**Done when:** HR Clouds learns about a failed nightly job from the console rather
than from a customer.

### Phase 4 — Support *(P1, large)*
Diagnostics without impersonation first — it resolves most tickets and carries none
of the risk. Then consented, time-boxed, masked, recorded impersonation.
**Done when:** a support question is answered in one call, and the customer can see
exactly what was looked at.

### Phase 5 — Control *(P1, medium)*
Plans and pricing as operations. Feature flags. Platform staff and roles.
Announcements. Statutory defaults.
**Done when:** a price change and a feature rollout are both operations, not deployments.

### Phase 6 — Mature *(P2)*
Growth funnel, Maya analytics, compliance centre, partners (§3.8).

---

## 8. What success looks like

Measurable claims, so this document can be checked against reality later.

| Question | Today | After Phase 1–3 |
|---|---|---|
| How many organisations do we have? | Database query | The first tile on the Overview |
| Which customers will churn this month? | Guesswork | A worked queue |
| Did last night's payroll jobs run for everyone? | Unknowable | A matrix, with alerts on the gaps |
| A customer says payroll failed — why? | Engineer with DB access | Support reads the job history |
| What did we do to this customer, and when? | No record exists | An exportable audit trail |
| What is our MRR, and why did it move? | Spreadsheet | Decomposed, live |
| Can we ship a feature to one customer first? | No | A flag |

**The anti-goals matter as much.** This console must never become: a place to edit
customer data by hand; a second product with its own divergent design language; a
way to see a named employee's salary without a logged reason; or a dashboard
nobody opens because its numbers are not trusted.

---

## 9. Open questions

Decisions this document cannot make alone.

1. **The platform principal's name and home.** `platform_admin` on a separate
   table is the recommendation (§5.1). Needs a decision before Phase 0.
2. **Impersonation: consent-first or break-glass-first?** This document argues
   consent-first with a two-approver break-glass. It is a trust posture, and the
   business should choose it deliberately.
3. **Refund and credit thresholds** for the second approver (§5.4).
4. **Data residency.** If HR Clouds ever serves customers outside India, the
   platform plane is the first thing that spans regions. Cheaper to decide now.
5. **Build or buy for billing analytics?** Razorpay and an analytics tool cover
   part of §3.2. The argument for building is that revenue must reconcile against
   seat usage and adoption, which only HR Clouds holds.
6. **Does the console get its own API gateway**, or share the product's? §5.5
   argues for separation at least at the connection-pool level.
7. **Who is the first user?** The sequence in §7 is ordered for a founder-operator.
   A dedicated support team first would move Phase 4 earlier.

---

## 10. How the console is built

Conventions already in force in this repository, recorded so they survive.

- **One product, one language.** The console uses HR Clouds' palette, typography
  and component vocabulary. A person moving between the product and the console
  should not feel they changed software.
- **Purple only.** Green/emerald → violet, amber/orange → fuchsia, blue/sky →
  indigo. The ten palette slots live in `src/index.css`; no component holds a hex
  value that is not one of them.
- **Sidebar label = page `<h1>` = top bar title.** One string, from
  `src/config/navigation.js`.
- **Never render a dash.** Unknown is **N/A**; an unlimited allowance is
  **Unlimited**, never `0` and never `—`.
- **Never show a blank page while data loads.** Loading, empty and error states are
  part of the build, not a follow-up.
- **A capability a role lacks is absent, not broken.**
- **Forms validate before they call.** The button stays live; the press reveals the
  problems and travels to the first one.
- **Say the consequence, not the mechanism.** "Keeps full access for 3 days, then
  loses it", not "enters dunning state 2".
- **Sections that do not exist say so**, and point at the section of this document
  that specifies them.

The full set of product house rules is `../HR Clouds/CLAUDE.md`. Where this
console disagrees with it, this console is wrong.

---

### Appendix — sources

Read on 27 October 2026 from:

- `../HR Clouds/CLAUDE.md` — house rules, role model, visual and writing language
- `../HR Clouds/public/ref docs/api_registry.md` — 278 endpoints, roles, dashboards
- `../HR Clouds/public/ref docs/md_system/hr_clouds_complete_product_features.md` — modules, plans, commercial terms
- `../HR Clouds/public/ref docs/md_system/background-jobs.md` — the nightly machinery
- `../HR Clouds/public/ref docs/md_system/architecture.md` — soft deletion, idempotency, immutable logs
- `../HR Clouds/src/shared/auth/permissions.js` — role priority and workspace mapping
- `../HR Clouds App/HRCloudsEmployee/src/theme/tokens.js` — the purple design tokens
