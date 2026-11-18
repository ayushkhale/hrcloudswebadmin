// ─────────────────────────────────────────────────────────────────────────────
// ConsoleLayout.jsx — the shell every signed-in screen mounts inside.
//
// The sidebar renders ONCE for the whole route group, so moving between pages
// keeps its scroll position instead of rebuilding the menu each time.
//
// It is also the gate, and the gate has four states like any other screen:
//
//   booting  — we hold a token and are asking the server what it is worth.
//              A skeleton shaped like the shell, NOT a redirect: bouncing
//              someone to /login for the half second that answer takes would
//              throw away a perfectly good session on every refresh.
//   error    — the access guard failed closed (500/503). The token is fine
//              and the person is probably staff; we simply cannot prove it
//              right now. Offer the retry. Signing them out over our own
//              outage would lose their place and tell them something untrue.
//   anonymous— no session. Redirect, carrying where they were going.
//   ready    — the shell.
// ─────────────────────────────────────────────────────────────────────────────
import { Navigate, Outlet, useLocation } from "react-router-dom";

import ConsoleSidebar from "../components/ConsoleSidebar";
import { ErrorState } from "../components/States";
import { SkeletonTiles } from "../components/Skeleton";
import { SidebarProvider } from "../contexts/SidebarContext";
import { useAuth } from "../contexts/AuthContext";

/** The shell's own loading state: the page, before we know whose it is. */
function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F7FB] dark:bg-night-950 flex font-sans">
      <div className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-100 dark:bg-night-900 dark:border-night-700" />
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-28 rounded-3xl bg-slate-200/70 animate-pulse dark:bg-night-800" />
          <SkeletonTiles count={4} />
        </div>
      </div>
    </div>
  );
}

export default function ConsoleLayout() {
  const { isAuthenticated, isBooting, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();

  if (isBooting) return <ShellSkeleton />;

  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-[#F8F7FB] dark:bg-night-950 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs max-w-md w-full dark:bg-night-850 dark:border-night-700 dark:shadow-none">
          <ErrorState
            error={bootstrapError}
            onRetry={retryBootstrap}
            fallback="Couldn’t confirm your access."
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F8F7FB] flex font-sans text-slate-800 dark:bg-night-950 dark:text-slate-200">
        <ConsoleSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
