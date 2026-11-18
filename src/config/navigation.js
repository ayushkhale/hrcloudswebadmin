// ─────────────────────────────────────────────────────────────────────────────
// navigation.js — the menu, as data.
//
// The sidebar renders this and nothing else, so adding a screen is one entry
// here plus one route. Labels come from the dictionary where the word is
// shared with another screen.
//
// ─── Every row here goes somewhere ──────────────────────────────────────────
// There used to be eight more rows carrying a `soon: true` flag — People,
// Plans & billing, Support, Usage & growth, Service health, Announcements,
// Audit trail, Console settings — drawn greyed out with a "Soon" tag, on the
// theory that the shape of the product is useful to see.
//
// It isn't. Two thirds of the menu was furniture, every row of it an
// invitation to click something that would never answer, and the five real
// screens were lost among them. A menu is a list of places you can go. When
// one of those screens is built it gets a row, that day. The plan for what is
// coming lives in docs/product/platform-console-vision.md, which is where a
// plan belongs.
//
// `minTier` is who may see a row at all. A row above your tier is not greyed
// out — it is ABSENT. A disabled row advertising "Plan overrides" to a support
// hire who will never be allowed near it is an invitation to go and ask why,
// which is a conversation nobody needs to have. The tiers are in
// config/platformAccess.js; the server enforces each one independently, and
// this only decides what gets drawn.
//
// No `minTier` means everyone signed in, which is WORKER and above — there is
// no fourth, lower band, because an actor below priority 70 is refused by the
// access guard and never reaches a menu at all.
// ─────────────────────────────────────────────────────────────────────────────
import { HiTemplate, HiOfficeBuilding, HiUserGroup, HiIdentification, HiCollection } from "react-icons/hi";

import { DICTIONARY } from "./dictionary";
import { canAccessTier, TIER } from "./platformAccess";

export const NAV_SECTIONS = [
  {
    // No heading: the first rows are where everyone starts.
    flat: true,
    title: "Home",
    items: [
      { label: DICTIONARY.HEADERS.OVERVIEW, path: "/console", icon: HiTemplate },
      { label: DICTIONARY.TERMS.ORGANISATIONS, path: "/console/organisations", icon: HiOfficeBuilding, minTier: TIER.ADMIN },
      { label: DICTIONARY.HEADERS.ACCOUNT, path: "/console/account", icon: HiIdentification },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: DICTIONARY.STAFF.HEADER, path: "/console/staff", icon: HiUserGroup, minTier: TIER.SUPER_ADMIN },
      { label: DICTIONARY.ROLES.HEADER, path: "/console/roles", icon: HiCollection, minTier: TIER.SUPER_ADMIN },
    ],
  },
];

/** Flat list of every destination, for the top bar's search. */
export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.flat ? "" : section.title })),
);

/**
 * The menu as this person may see it. Sections that lose every row disappear
 * with them — a "Governance" heading over nothing is worse than no heading,
 * because it reads as a page that failed to load.
 */
export function navSectionsFor(tier) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessTier(tier, item.minTier)),
  })).filter((section) => section.items.length > 0);
}

/** The searchable destinations for this person. Same gate, one source. */
export function navItemsFor(tier) {
  return NAV_ITEMS.filter((item) => canAccessTier(tier, item.minTier));
}
