// ─────────────────────────────────────────────────────────────────────────────
// ConsoleTopBar.jsx — the bar across the top of every signed-in screen.
//
// Left: the menu button on a phone, then which plane you are on. Right: page
// search, and the person signed in.
//
// Search here searches PAGES, not customers. Searching organisations belongs
// on the Organisations screen, where the result can be a row with everything
// you need on it — a dropdown of names would make you click twice to learn
// anything. Keep the two apart.
//
// The theme lives in the account menu rather than as a button in the bar: it
// is set once and then rarely again, and a permanent sun icon beside the
// search box spends every day advertising a decision nobody is making. The
// menu is already where everything about the person, rather than about a
// customer, is kept.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiChevronDown, HiLogout, HiMenuAlt2, HiSearch } from "react-icons/hi";

import { NAV_ITEMS } from "../../config/navigation";
import { roleTitle } from "../../config/dictionary";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import ThemeToggle from "./ThemeToggle";

/** How to write the search shortcut for the keyboard in front of the person. */
const SEARCH_SHORTCUT = (() => {
  try {
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
    return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘F" : "Ctrl F";
  } catch {
    return "Ctrl F";
  }
})();

export default function ConsoleTopBar({ title }) {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { toggleSidebar } = useSidebar();

  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? NAV_ITEMS.filter((item) => !item.soon && `${item.label} ${item.section}`.toLowerCase().includes(needle)).slice(0, 8)
    : [];

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goTo = (item) => {
    if (!item) return;
    setQuery("");
    setSearchOpen(false);
    searchRef.current?.blur();
    navigate(item.path);
  };

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <header className="bg-white dark:bg-night-900 px-3 sm:px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-20 font-sans gap-2 sm:gap-4 border-b lg:border-none border-slate-100 dark:border-night-700 shadow-sm lg:shadow-none dark:shadow-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={toggleSidebar}
          aria-label="Open the menu"
          className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors shrink-0 dark:hover:text-slate-200 dark:hover:bg-night-800"
        >
          <HiMenuAlt2 className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">{title}</p>
          <p className="hidden sm:block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Every organisation on HR Clouds
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative hidden md:flex md:w-56 lg:w-72 items-center bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus-within:bg-white focus-within:border-purple-400 transition-all dark:bg-night-800 dark:border-night-700 dark:focus-within:border-purple-500">
          <HiSearch className="w-4 h-4 text-slate-400 mr-2 shrink-0 dark:text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            // Delayed so a click on a result lands before the list closes.
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goTo(matches[0]);
              if (e.key === "Escape") {
                setQuery("");
                searchRef.current?.blur();
              }
            }}
            placeholder="Search pages..."
            aria-label="Search pages"
            className="w-full bg-transparent text-slate-800 placeholder-slate-400 outline-none text-xs font-medium dark:text-slate-100 dark:placeholder-slate-500"
          />
          {/* The handler takes both ⌘ and Ctrl; only the label follows the
              platform, so a Windows keyboard isn't shown a key it doesn't have. */}
          <kbd className="hidden lg:inline-flex items-center bg-white border border-slate-200 text-slate-500 font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0 shadow-sm dark:bg-night-700 dark:border-night-600 dark:text-slate-400 dark:shadow-none">
            {SEARCH_SHORTCUT}
          </kbd>
          {searchOpen && needle && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50 max-h-80 overflow-y-auto dark:bg-night-850 dark:border-night-600">
              {matches.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">No pages match that.</p>
              ) : (
                matches.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-purple-50 transition-colors dark:hover:bg-night-800"
                  >
                    <span className="text-xs font-semibold text-slate-800 truncate dark:text-slate-100">{item.label}</span>
                    {item.section && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 dark:text-slate-500">
                        {item.section}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-50 transition-colors dark:hover:bg-night-800"
          >
            <span className="w-9 h-9 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="hidden sm:flex flex-col text-left leading-tight min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate max-w-[9rem] dark:text-slate-100">
                {user?.name || user?.email}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{roleTitle(role)}</span>
            </span>
            <HiChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform dark:text-slate-500 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <>
              {/* Clicking anywhere else closes it, including on a touch screen
                  where there is no blur to listen for. */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              {/* No `role="menu"`: it promises arrow-key navigation between
                  menuitems, which this never implemented, and it cannot hold
                  the theme radio group. A panel of buttons reads correctly as
                  it stands, and claims nothing it does not do. */}
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-lg py-2 z-50 dark:bg-night-850 dark:border-night-600">
                <div className="px-4 pb-2 mb-1 border-b border-slate-50 dark:border-night-700">
                  <p className="text-xs font-bold text-slate-800 truncate dark:text-slate-100">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 truncate dark:text-slate-400">{user?.email}</p>
                </div>

                <ThemeToggle className="pb-2 mb-1 border-b border-slate-50 dark:border-night-700" />

                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!(await window.confirm("Sign out of the Platform Console?"))) return;
                    await logout();
                    navigate("/login", { replace: true });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:text-slate-300 dark:hover:bg-night-800 dark:hover:text-slate-100"
                >
                  <HiLogout className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
