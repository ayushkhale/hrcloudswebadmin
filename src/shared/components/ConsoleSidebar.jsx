// ─────────────────────────────────────────────────────────────────────────────
// ConsoleSidebar.jsx — the menu. Same chrome as HR Clouds Web's sidebar: 16rem
// wide, white, one hairline border, the active row in the brand's pale purple.
//
// It renders `NAV_SECTIONS` and holds no knowledge of its own. Every row in
// it is a link to a screen that exists; nothing is drawn as a preview of work
// that hasn't shipped.
// ─────────────────────────────────────────────────────────────────────────────
import { Link, useLocation } from "react-router-dom";
import { HiX } from "react-icons/hi";

import { navSectionsFor } from "../../config/navigation";
import { useSidebar } from "../contexts/SidebarContext";
import { useAuth } from "../contexts/AuthContext";

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-purple-200 dark:focus-visible:ring-purple-500/40";

export default function ConsoleSidebar() {
  const location = useLocation();
  const { isMobileSidebarOpen, closeSidebar } = useSidebar();
  // The menu is the viewer's menu. A row above their tier is absent, not
  // greyed — see the note in navigation.js.
  const { tier } = useAuth();
  const sections = navSectionsFor(tier);

  const closeOnMobile = () => closeSidebar();

  const renderItem = (item) => {
    // Every row is a link. There is no greyed "Soon" variant any more — see
    // the note in navigation.js for why those rows were removed outright
    // rather than left in as a preview of the roadmap.
    const active = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={closeOnMobile}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${FOCUS} ${
          active
            ? "bg-[#F3E8FF] text-[#7E22CE] dark:bg-purple-500/15 dark:text-purple-200"
            : "text-slate-600 hover:bg-slate-50 hover:text-purple-700 dark:text-slate-400 dark:hover:bg-night-800 dark:hover:text-purple-200"
        }`}
      >
        <item.icon className={`w-4 h-4 ${active ? "text-[#7E22CE] dark:text-purple-300" : "text-slate-400 dark:text-slate-500"}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden dark:bg-black/70" onClick={closeSidebar} />
      )}

      {/* `no-scrollbar` hides this column's own scrollbar without taking away
          its scrolling — two grey bars side by side is what it looked like
          before, on any window short enough to overflow the menu. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:z-10 w-64 bg-white border-r border-slate-100 dark:bg-night-900 dark:border-night-700 flex flex-col h-screen overflow-y-auto no-scrollbar transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:flex-shrink-0 font-sans ${
          isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-7 flex items-center justify-between lg:justify-center">
          {/* Both marks ship and CSS picks one. Swapping the `src` from the
              theme hook would re-request the image on every theme change and
              flash an empty box while it arrives; this way both are cached
              and the switch is instant. Only one is ever shown, and the
              `alt` lives on whichever that is. */}
          <Link to="/console" className="flex items-center">
            <img src="/logocolored.png" alt="HR Clouds" className="h-10 w-auto object-contain dark:hidden" />
            <img src="/logocolorwhite.png" alt="HR Clouds" className="h-10 w-auto object-contain hidden dark:block" />
          </Link>
          <button
            onClick={closeSidebar}
            aria-label="Close the menu"
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors dark:hover:text-slate-200 dark:hover:bg-night-800"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Main" className="px-4 pt-1 pb-6 space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!section.flat && (
                <p className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">
                  {section.title}
                </p>
              )}
              {section.items.map(renderItem)}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
