// Every route in one file. Screens are lazy, so the sign-in page is the only
// chunk a signed-out browser downloads.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ConsoleLayout from "../shared/layouts/ConsoleLayout";
import RequireTier from "../shared/components/RequireTier";
import { SkeletonTiles } from "../shared/components/Skeleton";
import { TIER } from "../config/platformAccess";
import { DICTIONARY } from "../config/dictionary";

const LoginPage = lazy(() => import("../auth/pages/LoginPage"));
const AcceptInvitePage = lazy(() => import("../screens/AcceptInvitePage"));
const OverviewPage = lazy(() => import("../screens/OverviewPage"));
const AccountPage = lazy(() => import("../screens/AccountPage"));
const StaffPage = lazy(() => import("../screens/StaffPage"));
const RolesPage = lazy(() => import("../screens/RolesPage"));
const OrganisationsPage = lazy(() => import("../screens/OrganisationsPage"));
const OrganisationDetailPage = lazy(() => import("../screens/OrganisationDetailPage"));

/** What a lazy chunk shows while it arrives. Never a blank page. */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#F8F7FB] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-28 rounded-3xl bg-slate-200/70 animate-pulse" />
        <SkeletonTiles count={4} />
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* ⚠ CONTRACT. The server builds the invitation link in its email from
            `urls.platformInviteAcceptPath`. Move this path and every
            invitation already sitting in an inbox lands on the catch-all
            below and bounces somebody to a sign-in they cannot pass. Change
            both or neither.

            Outside ConsoleLayout, because whoever opens it has no session —
            that is the entire point of the screen. */}
        <Route path="/platform/accept-invite" element={<AcceptInvitePage />} />

        {/* Everything inside ConsoleLayout is behind the access gate. A screen
            that additionally needs a tier wraps itself in <RequireTier>, so
            the requirement is readable here rather than buried in the page.
            The server enforces it regardless; this only decides what renders. */}
        <Route element={<ConsoleLayout />}>
          <Route path="/console" element={<OverviewPage />} />
          <Route path="/console/account" element={<AccountPage />} />

          {/* Reading a customer's record is an operator's job. */}
          <Route
            path="/console/organisations"
            element={
              <RequireTier tier={TIER.ADMIN} title={DICTIONARY.HEADERS.ORGANISATIONS}>
                <OrganisationsPage />
              </RequireTier>
            }
          />
          <Route
            path="/console/organisations/:orgId"
            element={
              <RequireTier tier={TIER.ADMIN} title={DICTIONARY.HEADERS.ORGANISATIONS}>
                <OrganisationDetailPage />
              </RequireTier>
            }
          />

          {/* Who may open this console, and what the roles are, is a decision
              only somebody with full access gets to look at. */}
          <Route
            path="/console/staff"
            element={
              <RequireTier tier={TIER.SUPER_ADMIN} title={DICTIONARY.HEADERS.STAFF}>
                <StaffPage />
              </RequireTier>
            }
          />
          <Route
            path="/console/roles"
            element={
              <RequireTier tier={TIER.SUPER_ADMIN} title={DICTIONARY.HEADERS.ROLES}>
                <RolesPage />
              </RequireTier>
            }
          />
        </Route>

        {/* The console has one home, and it is the Overview. Anything else —
            a stale bookmark, a typo — lands there rather than on a 404 that
            tells an internal user nothing useful. */}
        <Route path="*" element={<Navigate to="/console" replace />} />
      </Routes>
    </Suspense>
  );
}
