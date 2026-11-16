# CLAUDE.md

**HR Clouds Platform Console** — the control plane that sits above every organisation
on HR Clouds. One workspace today (Platform Admin); more roles will be added, and the
structure below already assumes them.

React 18 · Vite 6 · React Router 7 · Tailwind 3.4 · Recharts · ESLint 9 flat ·
icons from `react-icons/hi` **only**. No component library, no Framer Motion, no GSAP.

```bash
npm run dev · npm run build · npm run lint
```

The house rules below are decisions already made. Most of them were made once in
HR Clouds Web after something was built the wrong way; don't relitigate them here.

---

## 0. Naming — read this first

The word **"SupAdmin" does not exist** in this product. It is not a word, and it
is not what this is. Say:

| Thing | Call it |
| --- | --- |
| This product | **Platform Console** (`HR Clouds Platform Console` in full) |
| The person using it | **Platform Admin** (role code `platform_admin`) |
| A customer | **Organisation** — never "tenant", never "client", never "account" |
| A customer's staff | **People**, or **Employees** |

Careful: inside a customer's own workspace, HR Clouds already has a role called
`super-admin` — the most senior person in **that organisation**. This console is a
plane above it. Nothing here is called "super" anything, or the two are impossible
to tell apart in a conversation.

---

## 1. Layout

```
src/
  config/        dictionary.js · navigation.js · env.js
  routes/        AppRoutes.jsx — every route, all lazy
  auth/pages/    the sign-in screen
  screens/       one file per page
  shared/
    api/         one file per domain + client.js. NO fetch in a component, ever
    components/  cross-screen UI
    contexts/    AuthContext · SidebarContext
    layouts/     ConsoleLayout — the shell every signed-in screen mounts inside
    utils/       format.js — the only place a number becomes text
  data/          sample.js — stand-in numbers until the platform API exists
```

One screen uses it → keep it in the screen. Two or more → `shared/`. Domain
knowledge (labels, state machines, enum maps, error copy) goes in config or a
`*Meta.js`, never inline in JSX.

## 2. One architecture, one theme — no screen is a special case

Every screen is built the same way, out of the same parts:

```jsx
<ConsoleTopBar title={…} />
<main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
  <PageHeader … />      {/* the purple hero. Every screen has one, same size */}
  …cards…
</main>
```

Don't rebuild these — use them: `PageHeader` · `Card` / `CardHeader` · `StatTile` ·
`StatusPill` / `OrgMark` · `Dialog` / `DialogButton` · `Skeleton` family ·
`ErrorState` / `EmptyState` · `AlertProvider`.

If a screen needs something none of these give, **add it to `shared/components`**
and use it from there. A one-off styled `<div>` on one page is how two screens
start to look like two products.

The theme is HR Clouds Web's theme, to the class: page `bg-[#F8F7FB]`, cards
`bg-white rounded-3xl border border-slate-100 shadow-xs`, Manrope, `rounded-xl`
controls, purple-600 primary.

## 3. Every screen is four states, and all four are designed

**loading → error → empty → data.** Never a blank page, never a bare spinner,
never `return null` while a read is in flight.

- **Loading is a skeleton**, shaped like the content that is coming, so the page
  does not jump when it lands. `Skeleton`, `SkeletonTiles`, `SkeletonCard`,
  `SkeletonRows` — or an inline `animate-pulse` block in that shape.
- **A skeleton ships in the same commit as the screen.** It is part of building
  the screen, not a follow-up someone has to ask for.
- **"Nothing on file" and "couldn't load" are different facts.** A failed read
  shows `ErrorState` with a retry, never `EmptyState` — an empty state where a
  read actually failed invites someone to create a duplicate of a record that
  already exists.
- An empty state always says what would put something there.

## 4. One read per screen

**A page makes one API call.** `OverviewPage` calls `platformAPI.getOverview()`
and gets every figure it draws from that one answer.

- A new card needs a new number → **the number joins that response.** It does not
  get a fetch of its own.
- Never a request per row. Use the bulk endpoint; refresh one row after a write.
- Guard against a stale response with an `AbortController` or a request token —
  an answer that lands after the screen is gone must not set state.
- Pollers check `document.visibilityState`. Duplicate requests in dev are
  StrictMode, not a bug.

Three reads of the same table is three spinners where one would do, and three
chances to render a screen that disagrees with itself.

## 5. Say it once

**No redundant data on a screen.** If a figure is on a tile, the card below it
does not repeat the figure — it says what you'd click into.

- The top bar prints a name above a role; they must not be the same word.
- A list row says what is *different* about that row, not what the heading above
  it already said.
- A legend that fits on screen carries its own counts, so nobody hovers a chart
  slice to read a number that could just be printed.

## 6. Words — write for someone who has never used an admin console

- **Use fewer of them.** A tile is a figure and two or three words. A card gets one
  subtitle line, at most. There are no paragraphs on a dashboard.
- Say the **consequence**, not the mechanism. "Payment overdue", not
  "subscription in grace state".
- Labels are sentences, not enum names.
- A term shared by two screens lives in `DICTIONARY` (`src/config/dictionary.js`)
  and is **added there before it is typed on a screen** — same rule as HR Clouds
  Web and the mobile app, so one idea has one name across all three.
- **Never render a dash.** Unknown → `N/A` (`displayValue`). A measured zero is
  `0`. The two are different facts and a dash tells you neither.
- Use `’` (U+2019) in JSX text.

## 7. Visual language

**Purple only.** green/emerald/teal → **violet** (good); amber/yellow/orange →
**fuchsia** (waiting on somebody); sky/blue/cyan → **indigo** (informational).
**rose stays**, for errors and destructive actions, and nothing else. Never add a
new green, amber or blue class.

- Every screen is full width (`max-w-7xl`). **Grid, don't narrow.**
- Charts take three shades of the one purple. No second hue enters a chart.
- Works at phone width with no horizontal scroll. Check it before you call it done.

## 8. Dialogs, alerts and toasts are global

One shell, one voice. Never hand-roll a `fixed inset-0`.

```jsx
if (!(await window.confirm("Suspend this organisation?"))) return;   // ← await it
window.alert("…");                                                    // in-app, styled
const toast = useToast(); toast.show("Plan updated");                 // after a write
```

⚠ **`window.confirm` returns a Promise here** (`AlertProvider` overrides it).
Without `await`, the Promise object is truthy and the action runs while the
question is still on screen. That exact bug suspended things nobody agreed to in
the main product; don't reintroduce it.

`Dialog` already handles the dim layer, Escape, the backdrop click, the focus
trap, returning focus and locking the page behind it. `tone="danger"` is for
anything that destroys or cuts off access.

## 9. Data and API

- All calls go through `shared/api/*.api.js`. No `fetch` in a component.
- **Gate the UI on what the server returned**, not on the spec. An absent key is
  a hidden feature, never a crash.
- The platform plane **does not exist on the backend yet**. Each read has a
  sample branch behind `ENV.USE_SAMPLE_DATA`, and the paths in `platform.api.js`
  are the contract being proposed. When a real endpoint ships, delete that
  branch — nothing above the api layer changes.
- `src/data/sample.js` is reachable only from the api layer. A screen that
  imports it is a bug.

## 10. This console can see everything — act like it

A Platform Admin can read every organisation's data. That is the whole point of
the product and the whole risk of it.

- Anything that touches a customer's data or money is **confirmed first**, with a
  `Dialog` that names the organisation.
- Every action is attributable. When the audit trail ships, a write that isn't
  recorded is a bug.
- Nothing in this console accepts a tenant token, and a tenant login can't reach
  it. Keep the two planes' credentials separate.

## 11. Code style

Comments explain **why**, not what — the decision, and what broke when it was
done the other way. Match the density of the file you're in. No `console.log`
left behind. `npm run lint` passes with zero errors before anything ships.
