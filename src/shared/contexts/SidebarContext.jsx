// Whether the menu is showing on a phone. One piece of state, shared by the
// top bar's hamburger and the sidebar itself, so neither has to reach for the
// other through a ref.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const SidebarContext = createContext(null);

export function useSidebar() {
  return useContext(SidebarContext) || { isMobileSidebarOpen: false, openSidebar: () => {}, closeSidebar: () => {}, toggleSidebar: () => {} };
}

export function SidebarProvider({ children }) {
  const [isMobileSidebarOpen, setOpen] = useState(false);

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);
  const toggleSidebar = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ isMobileSidebarOpen, openSidebar, closeSidebar, toggleSidebar }),
    [isMobileSidebarOpen, openSidebar, closeSidebar, toggleSidebar],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
