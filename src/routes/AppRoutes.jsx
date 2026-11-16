// Every route in one file. Screens are lazy, so the sign-in page is the only
// chunk a signed-out browser downloads.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ConsoleLayout from "../shared/layouts/ConsoleLayout";
import { SkeletonTiles } from "../shared/components/Skeleton";

const LoginPage = lazy(() => import("../auth/pages/LoginPage"));
const OverviewPage = lazy(() => import("../screens/OverviewPage"));

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

        <Route element={<ConsoleLayout />}>
          <Route path="/console" element={<OverviewPage />} />
        </Route>

        {/* The console has one home, and it is the Overview. Anything else —
            a stale bookmark, a typo — lands there rather than on a 404 that
            tells an internal user nothing useful. */}
        <Route path="*" element={<Navigate to="/console" replace />} />
      </Routes>
    </Suspense>
  );
}
