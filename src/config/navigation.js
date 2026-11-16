// ─────────────────────────────────────────────────────────────────────────────
// navigation.js — the menu, as data.
//
// The sidebar renders this and nothing else, so adding a screen is one entry
// here plus one route. Labels come from the dictionary where the word is
// shared with another screen.
//
// `soon: true` marks a screen that is designed but not built. It renders as a
// greyed row with a "Soon" tag rather than a link that goes nowhere — the
// shape of the product is useful to see, a dead link never is. Drop the flag
// the day the screen ships. The full plan behind these rows is in
// docs/PLATFORM_CONSOLE_VISION.md.
// ─────────────────────────────────────────────────────────────────────────────
import {
  HiTemplate,
  HiOfficeBuilding,
  HiUserGroup,
  HiCreditCard,
  HiChartBar,
  HiShieldCheck,
  HiSupport,
  HiAdjustments,
  HiSpeakerphone,
  HiServer,
} from "react-icons/hi";

import { DICTIONARY } from "./dictionary";

export const NAV_SECTIONS = [
  {
    // No heading: the first two rows are where everyone starts.
    flat: true,
    title: "Home",
    items: [
      { label: DICTIONARY.HEADERS.OVERVIEW, path: "/console", icon: HiTemplate },
      { label: DICTIONARY.TERMS.ORGANISATIONS, path: "/console/organisations", icon: HiOfficeBuilding, soon: true },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "People", path: "/console/people", icon: HiUserGroup, soon: true },
      { label: "Plans & billing", path: "/console/billing", icon: HiCreditCard, soon: true },
      { label: "Support", path: "/console/support", icon: HiSupport, soon: true },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Usage & growth", path: "/console/analytics", icon: HiChartBar, soon: true },
      { label: "Service health", path: "/console/health", icon: HiServer, soon: true },
      { label: "Announcements", path: "/console/announcements", icon: HiSpeakerphone, soon: true },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Audit trail", path: "/console/audit", icon: HiShieldCheck, soon: true },
      { label: "Console settings", path: "/console/settings", icon: HiAdjustments, soon: true },
    ],
  },
];

/** Flat list of every real destination, for the top bar's search. */
export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.flat ? "" : section.title })),
);
