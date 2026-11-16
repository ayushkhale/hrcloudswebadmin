// ─────────────────────────────────────────────────────────────────────────────
// ConsoleLayout.jsx — the shell every signed-in screen mounts inside.
//
// The sidebar renders ONCE for the whole route group, so moving between pages
// keeps its scroll position instead of rebuilding the menu each time.
//
// It is also the gate: no token, no shell. The redirect carries where the
// person was going, so signing in puts them back there rather than on the
// Overview.
// ─────────────────────────────────────────────────────────────────────────────
import { Navigate, Outlet, useLocation } from "react-router-dom";

import ConsoleSidebar from "../components/ConsoleSidebar";
import { SidebarProvider } from "../contexts/SidebarContext";
import { useAuth } from "../contexts/AuthContext";

export default function ConsoleLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

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
