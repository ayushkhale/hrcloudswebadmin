# HR Clouds Platform Console — Vision

**Status:** draft for review · **Date:** 27 October 2026
**Scope:** what the platform plane should become, over roughly four quarters.

---

## 1. What this is

HR Clouds sells an HRMS. Organisations sign up, invite their people, and run
attendance, leave, payroll, documents and tasks inside their own walled
workspace. Everything built so far lives **inside** those walls: the most senior
role in the product, `super-admin`, is the most senior person in *one*
organisation, and can see exactly one organisation's data.

Nobody can see **across** them. Today, answering "how many organisations are
there", "how many people are on HR Clouds", "who hasn't paid", "which customer
is about to churn" or "why is this org's payroll failing" means a database
query by a developer. That is the gap this console closes.

The Platform Console is the **control plane**: one place where HR Clouds staff
see every organisation, the people inside them, what they use, what they pay,
and what is going wrong — and act on it.

### Naming

"SupAdmin" is retired. It isn't a word, and it collides with the tenant role.

| Thing | Name | Code |
| --- | --- | --- |
| This product | Platform Console | — |
| Its users | Platform Admin, and later Support / Finance / Auditor | `platform_admin` |
| A customer | Organisation | `organisation` |

The distinction that matters: **`super-admin` is the top of one organisation.
`platform_admin` is above all organisations.** Never let a conversation blur them.

---

## 2. Principles

These are not nice-to-haves; they are what makes a console like this safe to own.

1. **It reads far more than it writes.** The default posture is observation.
   Every write is deliberate, confirmed, and named.
2. **Every action is attributable.** A console that can open any customer's
   payroll must be able to answer "who looked, when, and why" — for the
   customer, for a security review, and for the staff member's own protection.
3. **Customer data is the customer's.** Seeing that an organisation has 212
   people is platform business. Reading one of those people's salary is not,
   unless there is a recorded reason.
4. **It is one product with the HRMS.** Same theme, same words, same components.
   Staff move between the two all day; a second visual language is a tax.
5. **Answers, not tables.** A console earns its place by saying *"these five
   organisations need you today"*, not by rendering a database.
6. **It never becomes the HRMS.** If a feature belongs in a customer's own
   workspace, build it there. This console is about the platform.

---

## 3. What HR Clouds already knows (the raw material)

The console invents nothing. Every capability below is a new *view* of data the
product already stores. This is what exists to draw on:

| Area | Already in the product |
| --- | --- |
| **Organisations** | Profile, logo, address, departments, office locations, reporting hierarchy, org chart |
| **People** | Roles (`super-admin`/`admin`/`hr`/`manager`/`employee`/`guest`), invitations, acceptance, deactivation, multi-org membership, profile completeness |
| **Attendance** | Shifts, rotations, policies, holidays, period locks, geofencing, registered devices, biometric devices, regularisations, overtime, comp-off |
| **Leave** | Types, templates, assignments, balances, accrual runs, rollover runs, payouts |
| **Payroll** | Runs, salary components, adjustments, arrears, exits and final pay, statutory config (PF / ESI / PT / TDS), reimbursements, bonuses, benefits, payslips, loans |
| **Documents** | Templates, issued documents, the verification queue, the employee vault |
| **Tasks & approvals** | Task assignment, the approvals inbox, twelve distinct approval queues with badge counts |
| **Billing** | Plan catalogue (`free` / `starter` / `growth` × monthly / yearly), subscriptions, `days_remaining`, `in_grace` / `past_due` states, seat limits per plan (employees / managers / HRs), per-module feature flags |
| **Mobile** | The React Native employee app: attendance, leave, pay, documents, tasks, push via FCM, device registration |
| **AI** | Maya, the in-product assistant |

Three things are worth calling out, because they shape half the roadmap:

- **Plans already carry hard limits and feature flags.** `employees: 20`,
  `attendance.geofencing: false`, `recruitment.access: comingSoon`. Seat
  pressure and upgrade intent are therefore *measurable today*, not someday.
- **The grace / past-due machinery already exists.** Revenue risk is a state
  the backend already computes; the console just has to surface it.
- **A user can belong to several organisations.** Cross-org identity is already
  a real thing, which makes platform-wide people search coherent rather than odd.

---

## 4. What the console should become

Twelve capability areas. Each is written as: *what a person comes here to do*,
then what the screen is, then what the backend has to add.

### 4.1 Overview — "how is HR Clouds doing" ✅ *built*

The opening screen, read in ten seconds: organisations, people on all payrolls,
monthly revenue, and who needs attention today. One read, one loading state.

Grows later with: revenue trend against last month, churn in the period, and
activation rate for the cohort that signed up this month.

> **Backend:** `GET /platform/overview` returning totals, signups-by-month,
> plan mix, biggest organisations, and the attention list.

### 4.2 Organisations — the directory

The list everything else hangs off. Searchable by name, city or industry;
filterable by state, plan and size; sortable by people, revenue or last active.
Each row: mark, name, state pill, plan, people / seats, monthly revenue, last
active.

**The organisation record** is the console's most important screen. Tabs:

- **Summary** — who they are, who signed them up, which modules they actually
  use, the last ten things that happened.
- **People** — the roster, by role, with who has never signed in.
- **Usage** — attendance marked, leave requests, payroll runs completed,
  documents issued, app vs web, over time.
- **Billing** — plan, seats used against the limit, invoices, payment state,
  what they'd pay on the next tier up.
- **Configuration** — shifts, leave types, statutory setup, geofencing,
  device trust: the settings a support call is usually about.
- **Health** — failed payroll runs, stuck approvals, verification backlog,
  anything half-configured.

> **Backend:** `GET /platform/organisations` (paged, filtered),
> `GET /platform/organisations/:id`, plus one read per tab.

### 4.3 People across the platform

Every person on HR Clouds, in one search — by name, email or phone. Answers the
support question that is impossible today: *"a user says they can't log in; which
organisations are they even in?"*

Shows their organisations and role in each, their last sign-in, their devices,
and whether they're on the app. **Not** their salary, leave balance or documents
— that needs the access flow in §4.11.

> **Backend:** `GET /platform/people?query=` across tenants, deliberately
> returning identity and membership only.

### 4.4 Plans, billing and revenue

What finance opens. Monthly and yearly revenue with their trend; revenue split
by plan and by cohort; renewals due in the next 30 days; failed payments and who
is in grace; expansion (organisations that outgrew their seats) against
contraction (downgrades and cancellations).

It is also where the plan catalogue is **edited** rather than deployed: price,
limits and feature flags per plan, with the change recorded. A one-off
arrangement for a single customer — an extra ten seats, a waived month, a
custom price — belongs here too, where it is visible, instead of in a database
row nobody can find later.

> **Backend:** `GET /platform/billing/summary`, `/revenue?period=`,
> `/renewals`, `/failures`; `PATCH /platform/plans/:code`;
> `POST /platform/organisations/:id/overrides`.

### 4.5 Usage and growth

The product question: *which parts of HR Clouds are actually used?*

Module adoption across the base (what share of organisations run payroll vs just
attendance), feature adoption inside a module, the activation funnel from
sign-up to first payroll run, web against app, and a retention curve by sign-up
cohort. This is where "recruitment is coming soon" either becomes a priority or
gets dropped, on evidence.

> **Backend:** an events pipeline. The one capability here with no existing
> data behind it, and the reason it sits in a later phase.

### 4.6 Support console

Where a ticket gets answered. Open an organisation and see, on one screen,
everything a support call usually needs: their plan, their configuration, their
recent errors, their last payroll run, what they clicked before it broke.

Includes the **impersonation** flow (§4.11) and a per-organisation note history,
so the next person on the ticket starts where the last one stopped.

Later: an inbound queue, if support tickets move in-product.

### 4.7 Service health

Is the platform itself up? API error rates and latency by endpoint, background
job health (payroll runs, accrual and rollover runs, notification delivery),
queue depths, third-party status (storage, push, SMS, email, payments), and
recent deploys. When a customer says "it's slow", this says whether it is.

> **Backend:** metrics scrape and job telemetry — an infrastructure piece, not
> an application one.

### 4.8 Announcements and release notes

One place to say something to every organisation, or to a slice of them ("every
Growth customer", "everyone on the old statutory config"). Scheduled, targeted,
previewable, with read counts. Today this is a mail merge; it should be a
product surface, with in-app and push delivery reusing the existing FCM pipe.

### 4.9 Onboarding and sales assist

Most churn is decided in week one. This watches it: every organisation signed up
in the last 30 days, with how far through setup they got — departments created,
people invited, invitations accepted, attendance configured, first payroll run.

An organisation stalled at "invited nobody" after five days is a phone call, and
this screen is how anyone knows to make it.

> The setup checklist already exists inside the HR workspace. The console
> reads the *same* completion state, from above, across everyone.

### 4.10 Compliance and data governance

The things a growing Indian SaaS gets asked about by its larger customers:
data-export and deletion requests and their status, retention policy per
organisation, statutory-config drift (organisations on a PF or PT setup that
regulation has moved past), and consent records for location and device trust.

### 4.11 Access, accountability and impersonation

The spine of the whole product, and the reason it is a separate section rather
than a line in §4.6.

- **Separate credentials.** A platform account is issued, never self-registered,
  and no tenant token is ever accepted here.
- **Mandatory second factor.** These accounts can read every customer's payroll.
- **Impersonation with a reason.** "Open as this organisation" asks what for,
  records it against the staff member, is time-boxed, is read-only by default,
  and is **visible to the customer** — their own audit log shows that HR Clouds
  staff opened their workspace, when, and why. A vendor that can enter silently
  is a vendor nobody large will buy from.
- **An audit trail that cannot be edited.** Every read of customer data, every
  write, every impersonation session, every plan override.
- **Roles within the console.** Support reads and impersonates; Finance sees
  money and changes plans; Auditor reads the trail and nothing else; Platform
  Admin does everything. One person should not hold all four by default.

### 4.12 Platform settings

The plan catalogue's defaults, feature-flag rollout (switch a module on for 10%
of organisations), statutory rate tables shared by every tenant's payroll,
system-wide maintenance windows, and the console's own staff accounts.

---

## 5. Roadmap

Ordered by *what unblocks a decision someone is making anyway*, not by how
interesting it is to build.

### Phase 1 — See it (now → ~6 weeks)

The console stops being a database query.

- Platform auth, with the second factor
- Overview ✅
- Organisations list and the organisation record (Summary, People, Billing)
- People search
- The audit trail, recording from day one

**Done when:** nobody writes SQL to answer a question about a customer.

### Phase 2 — Run it (~6 → 14 weeks)

The console stops being read-only.

- Support console, with impersonation and the reason flow
- Plans and billing: renewals, failures, overrides, catalogue editing
- Onboarding watch
- Announcements
- Console roles (Support / Finance / Auditor)

**Done when:** a support call and a billing exception are both handled here.

### Phase 3 — Understand it (~14 → 26 weeks)

The console starts answering product questions.

- The events pipeline, and Usage & growth on top of it
- Service health
- Cohort retention and the activation funnel
- Compliance and data governance

**Done when:** a roadmap decision cites this console as its evidence.

### Phase 4 — Anticipate it (beyond)

- Churn risk scoring from usage decay, seat shrinkage and support volume
- Expansion signals: who is against their seat limit and should be called
- Anomaly alerts: a payroll run that failed twice, a sign-in spike, a geofence
  switched off mid-month
- Maya for the platform: "which Growth customers haven't run payroll this month?"

---

## 6. What has to be built on the backend

The console is a client. Almost nothing here is blocked on UI work; it is
blocked on a platform plane that does not exist.

1. **A platform identity service** — accounts, MFA, console roles. Separate
   from tenant auth, sharing no tokens.
2. **Cross-tenant read endpoints** under `/platform/*`, authorised by platform
   role, each one returning an answer rather than a table dump.
3. **An aggregation layer.** `GET /platform/overview` must not fan out across
   every tenant on every page load. Nightly rollups, with live reads only for a
   single organisation's record.
4. **An append-only audit log**, written by the platform service itself so a
   console bug cannot skip it.
5. **An impersonation grant** — scoped, expiring, reason-carrying, and mirrored
   into the tenant's own audit log.
6. **An events pipeline**, for Phase 3. The only piece with no existing data.

Until these exist, the console reads `src/data/sample.js` behind
`VITE_USE_SAMPLE_DATA`, and the paths in `src/shared/api/platform.api.js` are
the proposed contract — written down precisely so the server team has something
exact to build against.

---

## 7. How we will know it worked

- Time to answer "what's going on with customer X": **minutes → seconds**
- Questions about customers that need a developer: **most → none**
- Churn caught before the renewal date rather than after it
- Every access to customer data attributable, with zero unexplained reads
- A roadmap decision made on this console's numbers instead of an opinion
