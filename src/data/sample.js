// ─────────────────────────────────────────────────────────────────────────────
// sample.js — stand-in numbers for a platform API that does not exist yet.
//
// This file is NOT a fixture library and it is not test data. It is the shape
// of the answer `platform.api.js` will one day get from the server, written
// out so the console can be built, reviewed and demoed before the backend
// plane exists. Every field here corresponds to something HR Clouds already
// stores about an organisation (see docs/PLATFORM_CONSOLE_VISION.md).
//
// When the real endpoint ships, delete the matching branch in platform.api.js
// — not this file's consumers. Nothing above the api layer knows this exists.
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_LABEL = {
  free: "Free",
  starter_monthly: "Starter",
  starter_yearly: "Starter",
  growth_monthly: "Growth",
  growth_yearly: "Growth",
};

/** Tier, which is what a person means when they ask "what plan are they on". */
export const planTier = (code) => PLAN_LABEL[code] || "N/A";

/** Monthly or yearly, for the one place that needs to tell them apart. */
export const planCycle = (code) => (String(code).endsWith("_yearly") ? "Yearly" : code === "free" ? "Free" : "Monthly");

const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const ahead = (days) => new Date(Date.now() + days * DAY).toISOString();

export const SAMPLE_ORGANISATIONS = [
  { id: "org_1a2b", name: "Nimbus Logistics", industry: "Logistics", city: "Pune", status: "active", plan: "growth_yearly", seats: 250, employees: 212, managers: 18, hrs: 4, mrr: 24000, signedUp: ago(410), lastActive: ago(0.02), renews: ahead(142), payrollRuns: 13, openTickets: 0 },
  { id: "org_3c4d", name: "Kettle and Co Foods", industry: "Food and Beverage", city: "Bengaluru", status: "active", plan: "starter_monthly", seats: 20, employees: 17, managers: 3, hrs: 1, mrr: 980, signedUp: ago(96), lastActive: ago(0.4), renews: ahead(12), payrollRuns: 3, openTickets: 1 },
  { id: "org_5e6f", name: "Veridian Health", industry: "Healthcare", city: "Hyderabad", status: "active", plan: "growth_monthly", seats: 180, employees: 164, managers: 14, hrs: 3, mrr: 17600, signedUp: ago(268), lastActive: ago(0.1), renews: ahead(21), payrollRuns: 8, openTickets: 2 },
  { id: "org_7g8h", name: "Saffron Interiors", industry: "Design", city: "Jaipur", status: "trial", plan: "free", seats: 10, employees: 8, managers: 1, hrs: 1, mrr: 0, signedUp: ago(9), lastActive: ago(1.2), trialEnds: ahead(5), payrollRuns: 0, openTickets: 0 },
  { id: "org_9i0j", name: "Tidewater Marine", industry: "Shipping", city: "Kochi", status: "in_grace", plan: "starter_yearly", seats: 20, employees: 19, managers: 2, hrs: 1, mrr: 820, signedUp: ago(372), lastActive: ago(6), renews: ago(4), payrollRuns: 12, openTickets: 3 },
  { id: "org_1k2l", name: "Alder and Finch Legal", industry: "Legal", city: "Mumbai", status: "active", plan: "starter_yearly", seats: 20, employees: 14, managers: 2, hrs: 1, mrr: 820, signedUp: ago(205), lastActive: ago(0.3), renews: ahead(160), payrollRuns: 6, openTickets: 0 },
  { id: "org_3m4n", name: "Brightpath Schools", industry: "Education", city: "Lucknow", status: "active", plan: "growth_yearly", seats: 400, employees: 338, managers: 26, hrs: 6, mrr: 31000, signedUp: ago(520), lastActive: ago(0.05), renews: ahead(68), payrollRuns: 17, openTickets: 1 },
  { id: "org_5o6p", name: "Quartz Analytics", industry: "Software", city: "Gurugram", status: "active", plan: "growth_monthly", seats: 120, employees: 97, managers: 9, hrs: 2, mrr: 11800, signedUp: ago(154), lastActive: ago(0.08), renews: ahead(8), payrollRuns: 5, openTickets: 0 },
  { id: "org_7q8r", name: "Mandal Textiles", industry: "Manufacturing", city: "Surat", status: "suspended", plan: "starter_monthly", seats: 20, employees: 20, managers: 2, hrs: 1, mrr: 0, signedUp: ago(298), lastActive: ago(41), renews: ago(34), payrollRuns: 9, openTickets: 4 },
  { id: "org_9s0t", name: "Peak Ridge Travel", industry: "Travel", city: "Dehradun", status: "trial", plan: "free", seats: 10, employees: 6, managers: 1, hrs: 1, mrr: 0, signedUp: ago(3), lastActive: ago(0.6), trialEnds: ahead(11), payrollRuns: 0, openTickets: 0 },
  { id: "org_1u2v", name: "Corvus Security", industry: "Security", city: "Chennai", status: "active", plan: "growth_monthly", seats: 150, employees: 143, managers: 12, hrs: 3, mrr: 14700, signedUp: ago(187), lastActive: ago(0.15), renews: ahead(16), payrollRuns: 6, openTickets: 1 },
  { id: "org_3w4x", name: "Lotus Wellness", industry: "Healthcare", city: "Indore", status: "active", plan: "starter_monthly", seats: 20, employees: 11, managers: 1, hrs: 1, mrr: 980, signedUp: ago(61), lastActive: ago(2.1), renews: ahead(5), payrollRuns: 2, openTickets: 0 },
  { id: "org_5y6z", name: "Ironleaf Energy", industry: "Energy", city: "Ahmedabad", status: "active", plan: "growth_yearly", seats: 300, employees: 271, managers: 21, hrs: 5, mrr: 27500, signedUp: ago(455), lastActive: ago(0.03), renews: ahead(95), payrollRuns: 15, openTickets: 2 },
  { id: "org_7a8b", name: "Dovetail Studios", industry: "Media", city: "Goa", status: "cancelled", plan: "free", seats: 10, employees: 4, managers: 1, hrs: 1, mrr: 0, signedUp: ago(340), lastActive: ago(120), payrollRuns: 1, openTickets: 0 },
  { id: "org_9c0d", name: "Harbour Retail", industry: "Retail", city: "Kolkata", status: "active", plan: "starter_yearly", seats: 20, employees: 18, managers: 2, hrs: 1, mrr: 820, signedUp: ago(233), lastActive: ago(0.9), renews: ahead(131), payrollRuns: 7, openTickets: 0 },
  { id: "org_1e2f", name: "Northfield Agri", industry: "Agriculture", city: "Nashik", status: "trial", plan: "free", seats: 10, employees: 9, managers: 1, hrs: 1, mrr: 0, signedUp: ago(12), lastActive: ago(0.2), trialEnds: ahead(2), payrollRuns: 0, openTickets: 1 },
  { id: "org_3g4h", name: "Cobalt Fintech", industry: "Finance", city: "Mumbai", status: "active", plan: "growth_monthly", seats: 90, employees: 78, managers: 7, hrs: 2, mrr: 9100, signedUp: ago(121), lastActive: ago(0.06), renews: ahead(25), payrollRuns: 4, openTickets: 0 },
  { id: "org_5i6j", name: "Terra Build", industry: "Construction", city: "Noida", status: "in_grace", plan: "growth_monthly", seats: 200, employees: 188, managers: 15, hrs: 4, mrr: 19500, signedUp: ago(312), lastActive: ago(9), renews: ago(6), payrollRuns: 10, openTickets: 5 },
  { id: "org_7k8l", name: "Juniper HR Services", industry: "Consulting", city: "Pune", status: "active", plan: "starter_monthly", seats: 20, employees: 13, managers: 2, hrs: 1, mrr: 980, signedUp: ago(44), lastActive: ago(1.5), renews: ahead(17), payrollRuns: 1, openTickets: 0 },
  { id: "org_9m0n", name: "Everlight Pharma", industry: "Pharma", city: "Hyderabad", status: "active", plan: "growth_yearly", seats: 260, employees: 229, managers: 19, hrs: 5, mrr: 25400, signedUp: ago(389), lastActive: ago(0.04), renews: ahead(53), payrollRuns: 12, openTickets: 1 },
];

/**
 * How many organisations joined each month. Twelve points: a console is read
 * a year at a time, and anything longer stops being legible on a card.
 */
export const SAMPLE_SIGNUPS = [
  { month: "Nov", organisations: 2 },
  { month: "Dec", organisations: 1 },
  { month: "Jan", organisations: 3 },
  { month: "Feb", organisations: 2 },
  { month: "Mar", organisations: 4 },
  { month: "Apr", organisations: 3 },
  { month: "May", organisations: 5 },
  { month: "Jun", organisations: 4 },
  { month: "Jul", organisations: 6 },
  { month: "Aug", organisations: 5 },
  { month: "Sep", organisations: 7 },
  { month: "Oct", organisations: 4 },
];

/**
 * The person signed in, as `/platform/auth/me` will one day return them.
 * A real NAME, not "Platform Admin" — the top bar prints the name above the
 * role, and a person called after their own job title made that read as the
 * same word twice.
 */
export const SAMPLE_VIEWER = {
  id: "pa_0001",
  name: "Aarav Mehta",
  email: "admin@hrclouds.in",
  role: "platform_admin",
};
