// ─────────────────────────────────────────────────────────────────────────────
// ThemeContext.jsx — light, dark, or whatever the computer is set to.
//
// One read of localStorage, one class on <html>, and nothing else in the app
// touches either. A screen asks `useTheme()`; it never reads the storage key
// or looks at `documentElement.classList` to find out which theme it is in.
//
// WHY A THIRD CHOICE: "System" is the default, not light. Someone who has
// already told their laptop they want dark has said it once; asking them to
// say it again in every product is how a console ends up being the one white
// rectangle on a dark screen at night.
//
// The <html> class is also set by a small script in index.html, BEFORE React
// mounts. Without it the first paint is the light theme and a dark-theme user
// gets a white flash on every page load — and because that script runs first,
// the dark styling is already correct even on a screen that crashes before
// this provider mounts.
//
// `only` on the matchMedia listener is not available in older Safari, hence
// the addListener fallback: a browser that misses the OS switching to dark
// would sit in the wrong theme until a reload.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "hrclouds_console_theme";

/** The three answers. "system" means "ask the computer, and keep asking". */
export const THEME_CHOICES = ["light", "dark", "system"];

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

function prefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** What was chosen last time. Anything unrecognised falls back to "system". */
function readStoredChoice() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEME_CHOICES.includes(stored) ? stored : "system";
  } catch {
    // Private mode, or storage blocked. The console still works; the choice
    // just doesn't outlive the tab.
    return "system";
  }
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readStoredChoice);
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  // Follow the OS while — and only while — "System" is the choice. The
  // listener stays attached either way, so switching back to System picks up
  // a change that happened in the meantime.
  useEffect(() => {
    let media;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const onChange = (e) => setSystemIsDark(e.matches);
    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener(onChange);
    };
  }, []);

  const isDark = choice === "dark" || (choice === "system" && systemIsDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    // Tells the browser which theme its own furniture is in — scrollbars, the
    // caret, a date picker, the flash behind a reload. Without it those stay
    // light-coloured inside an otherwise dark console.
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  const setTheme = useCallback((next) => {
    const value = THEME_CHOICES.includes(next) ? next : "system";
    setChoice(value);
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      // Not worth telling anyone about: the theme still changed, it just
      // won't be remembered next time.
    }
  }, []);

  const value = useMemo(() => ({ theme: choice, isDark, setTheme }), [choice, isDark, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
