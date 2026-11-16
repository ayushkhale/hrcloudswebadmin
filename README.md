# HR Clouds — Platform Console

The control plane that sits above every organisation on HR Clouds. Where the
product gives one organisation a view of itself, this gives HR Clouds a view of
all of them: who signed up, how many people they carry, what they pay, and what
needs a person today.

One role today — **Platform Admin** — with Support, Finance and Auditor planned.

## Running it

```bash
npm install
npm run dev      # http://localhost:5174
```

The platform API does not exist on the backend yet, so the console reads
realistic stand-in numbers from `src/data/sample.js`. **Any email and password
signs you in** while that is the case.

```bash
npm run build
npm run lint
```

## Configuration

Copy `.env.example` to `.env`:

| Variable | What it does |
| --- | --- |
| `VITE_API_BASE_URL` | Where the platform API lives |
| `VITE_USE_SAMPLE_DATA` | `true` until real endpoints exist. Set `false` to call the server |

## What's here

| | |
| --- | --- |
| **Sign in** | `/login` — split panel, the product's own theme |
| **Overview** | `/console` — totals, growth, plan mix, who needs attention |

The sidebar also lists the screens that are **designed but not built**, greyed
with a "Soon" tag. That is deliberate: the shape of the product is useful to
see, a dead link never is. Each one is specified in the vision document.

## Layout

```
src/
  config/     dictionary.js — every shared word · navigation.js · env.js
  routes/     every route, lazy
  auth/       the sign-in screen
  screens/    one file per page
  shared/
    api/      the only place a network call happens
    components/ PageHeader · Card · StatTile · StatusPill · Dialog ·
                AlertProvider · Skeleton · States · the console chrome
    contexts/ AuthContext · SidebarContext
    layouts/  ConsoleLayout — the shell every signed-in screen mounts inside
    utils/    format.js — the only place a number becomes text
  data/       sample.js — reachable from the api layer and nowhere else
```

## The two documents

- **[`CLAUDE.md`](CLAUDE.md)** — the house rules. Naming, the four screen
  states, one-read-per-screen, the purple-only palette, how dialogs work.
  Read it before writing a screen.
- **[`docs/PLATFORM_CONSOLE_VISION.md`](docs/PLATFORM_CONSOLE_VISION.md)** —
  what this should become: twelve capability areas, a four-phase roadmap, and
  what the backend has to build for any of it to be real.

## Built to match

React 18 · Vite 6 · React Router 7 · Tailwind 3.4 · Recharts ·
`react-icons/hi` only — the same stack and the same theme as HR Clouds Web, on
purpose. Staff move between the two all day, and a second visual language is a
tax on everyone who does.
