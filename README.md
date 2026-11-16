# HR Clouds — Control Plane

The platform console that sits above every customer organisation on HR Clouds.

HR Clouds lets companies run their own HR, payroll, attendance, leave, documents
and tasks. Each company gets its own workspace with four roles inside it —
employee, manager, HR and guest. **This console is not one of them.** It is the
plane above: the one place where HR Clouds itself sees every organisation, every
subscription, and the health of the system they all depend on.

- **The product:** `../HR Clouds` (React 18 · Vite 6 · Tailwind 3)
- **The mobile app:** `../HR Clouds App/HRCloudsEmployee` (React Native)
- **The roadmap:** [`docs/CONTROL_PLANE_VISION.md`](docs/CONTROL_PLANE_VISION.md)

## Running it

```bash
npm install
npm run dev
```

With `VITE_API_BASE_URL` blank, sign-in is handled locally so the console can be
walked without a backend. The Overview's figures come from
`src/data/sampleOrganisations.js` and the screen says so — **there is no
platform-wide API yet.** Every HR Clouds endpoint today answers for one
organisation only; the console needs `/api/v1/platform/*` to exist. The shape it
should have is specified in the vision document §4.

## What is built

| Section | State |
|---|---|
| **Overview** | Built, against sample data — totals, operator queues, the organisations table |
| Organisations · Subscriptions · Plans & Pricing · Support · System Health · Audit Log · Settings | Listed and described, not built. Each renders what will live there and points at its section of the vision document. |

## Roles

One role ships today: **Super Admin**. The console is written for more. Gates go
through `can(role, capability)` in `src/config/brand.js`, never through
`role === 'super-admin'`, so adding Support or Finance Ops is a change to the
capability map and nothing else. See the vision document §6.

> Note: `super-admin` already means something else inside the product — the most
> privileged user of *one* organisation. The platform operator needs its own
> principal before any platform endpoint is written. Vision document §5.1.

## House rules

The console follows the product's visual and writing rules so the two read as one
piece of software. The full set is `../HR Clouds/CLAUDE.md`; the ones that bite
here:

- **Purple only.** Green/emerald → violet, amber/orange → fuchsia, blue/sky →
  indigo. The ten palette slots live in `src/index.css` — no component holds a hex
  value that is not one of them.
- **Sidebar label = page `<h1>` = top bar title.** One string, from
  `src/config/navigation.js`.
- **Never render a dash.** Unknown reads **N/A**; an unlimited seat allowance reads
  **Unlimited**, never `0` and never `—`.
- **Never show a blank page while data loads.** Every fetching surface starts in a
  skeleton. Loading, empty and error states are part of the build.
- **A capability a role lacks is absent, not broken** — never render a control that
  would 403 on press.
- **Never show an ID.** No UUID, database id or raw enum reaches the screen.
- **Say the consequence, not the mechanism.** "Keeps full access for 3 days, then
  loses it", not "enters dunning state 2".

## Layout

```
src/
  api.js              fetch wrapper, refresh queue, session persistence
  config/
    brand.js          product strings, roles, capabilities
    navigation.js     the sidebar — one entry per section, built or planned
  data/               stand-in data, to be deleted when the platform API lands
  components/         DashboardOverview, PlannedSection
  layouts/            DashboardLayout — sidebar, top bar, content well
  pages/              LoginPage, DashboardPage
  index.css           design tokens, buttons, badges, table, skeleton
docs/
  CONTROL_PLANE_VISION.md
```

## Theme

The palette moved from the red it was templated with to HR Clouds purple, ported
from the product's own tokens (`../HR Clouds App/HRCloudsEmployee/src/theme/tokens.js`).
**The type scale, layout, grid and component structure are unchanged** — ten colour
slots were repointed, nothing else. The typeface is still Bricolage Grotesque.
