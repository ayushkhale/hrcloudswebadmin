# Docs

Everything written down about the Platform Console. Four folders, by **who the
document is for**:

| Folder | What's in it | Read it when |
| --- | --- | --- |
| [`product/`](product/) | What the console is for and where it's going | You're deciding *what* to build |
| [`api/`](api/) | The contract this console codes against | You're building a screen |
| [`changes/`](changes/) | Dated records of backend behaviour changing | Something that worked stopped working |
| [`backend/`](backend/) | How the API was built, phase by phase | You're debugging across the two repos |

Most frontend work needs only `api/` — start with the integration guide.

---

## Start here

**[`api/frontend-integration-guide.md`](api/frontend-integration-guide.md)** — the
authoritative specification. Every implemented endpoint (#281–#295), the screens
they back, the error-code contract, the tier model and the route-guard matrix,
plus the roadmap for #296–#335 so today's screens leave room for tomorrow's.

If you read one document before touching `shared/api/`, read that one.

---

## product/

| File | What it says |
| --- | --- |
| [`platform-console-vision.md`](product/platform-console-vision.md) | What the control plane should become over ~four quarters: the gap it closes, its principles, the data already available to it, and the roadmap. Referenced from the root `README.md`, `src/config/navigation.js` and `src/data/sample.js`. |

## api/

The contract. [`frontend-integration-guide.md`](api/frontend-integration-guide.md)
is the one to read; [`phases/`](api/phases/) is the per-phase detail behind it —
request and response shapes, validation rules, every error code — when the guide
isn't specific enough.

| Phase | File | Endpoints |
| --- | --- | --- |
| 1 | [`phase-1-access-and-identity.md`](api/phases/phase-1-access-and-identity.md) | #281 — `GET /platform/me`, the access guard, the audit ledger |
| 2 | [`phase-2-staff-and-roles.md`](api/phases/phase-2-staff-and-roles.md) | #282–#288 — staff directory, invitations, role changes, revocation, role catalog, activation |
| 3 | [`phase-3-organizations.md`](api/phases/phase-3-organizations.md) | #289–#291 — organisation directory, detail card, suspend/reactivate |
| 4 | [`phase-4-plans-and-provisioning.md`](api/phases/phase-4-plans-and-provisioning.md) | #292–#295 — plan override, seat quotas, direct provisioning, HR-invitation recovery |

## changes/

Dated records of **existing** behaviour changing — the backend's changelog. Split
by which plane is affected, because that decides whether it's this console's
problem:

- **[`platform-plane/`](changes/platform-plane/)** — the `/api/v1/platform/*`
  namespace. **This console.** Each file is the release note for the endpoints the
  matching `api/phases/` document specifies.
- **[`tenant-plane/`](changes/tenant-plane/)** — the organisation-facing API that
  HR Clouds Web and the mobile app call. **Not this console**, but the consequences
  of what a Platform Admin does here land there: suspending an organisation
  (#291) is what produces `ORG_SUSPENDED`, and granting a seat quota (#292/#293)
  is what the snapshot seat limits enforce. Read these to know what an action in
  this console actually does to a customer.

## backend/

[`handbacks/`](backend/handbacks/) — one note per shipped phase: files added,
migrations, outstanding operator actions, test counts. Written by the backend
team for the backend team. Nothing here changes how a screen is built; it's for
tracing a behaviour back to the code that produces it.

---

## Two notes on reading these

**They came from the API repo.** Relative links inside them (`../md_platform-admin/…`,
`public/md_system/api_registry.md`) point at paths in that repository, not this
one. They're left as written rather than silently rewritten, so a link that
doesn't resolve here is a pointer, not a bug.

**"Super Admin Panel" means this console.** The backend docs predate the naming
decision in `CLAUDE.md` §0. In anything written *here*, it is the **Platform
Console**, used by a **Platform Admin**, and a customer is an **Organisation** —
`super-admin` is a role inside a customer's own workspace and is a different
thing entirely.
